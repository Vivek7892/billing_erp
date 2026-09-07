from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from ..calculations import calculate_invoice
from ..models import (
    Invoice,
    InvoiceItem,
    InventoryTransaction,
    Payment,
    Product,
    SalesReturnItem,
    Setting,
)
from ..utils import audit_event, get_next_invoice_number
from .inventory_service import InventoryService
from .ledger_service import LedgerService


class InvoiceService:
    @staticmethod
    def create_invoice(*, attributes, items_data, payments_data, bill_discount, business, created_by, request=None):
        attributes = dict(attributes)
        attributes.pop('business', None)
        attributes.pop('created_by', None)
        with transaction.atomic():
            allow_negative_setting = Setting.objects.filter(
                business=business,
                key='allow_negative_stock',
            ).first()
            allow_negative = bool(
                allow_negative_setting and allow_negative_setting.value == 'true'
            )
            tax_setting = Setting.objects.filter(
                business=business,
                key='tax_on_price',
            ).first()
            tax_inclusive = (tax_setting.value if tax_setting else 'exclusive') == 'inclusive'

            try:
                calculation = calculate_invoice(
                    items_data,
                    tax_inclusive=tax_inclusive,
                    bill_discount=bill_discount,
                )
            except ValueError as exc:
                raise ValueError(str(exc)) from exc

            valid_methods = {choice[0] for choice in Payment.METHOD_CHOICES}
            payment_amounts = []
            for payment_data in payments_data:
                amount = Decimal(str(payment_data.get('amount', 0)))
                if amount <= 0 or payment_data.get('method') not in valid_methods:
                    raise ValueError('Payments must have a valid method and positive amount.')
                payment_amounts.append(amount)

            requested_status = attributes.get('payment_status', 'paid')
            if requested_status in ('pending', 'failed') and payments_data:
                raise ValueError('Pending or failed invoices cannot contain payments.')
            paid_amount = (
                sum(payment_amounts, Decimal('0'))
                if requested_status not in ('pending', 'failed')
                else Decimal('0')
            )
            balance_due = max(Decimal('0'), calculation.grand_total - paid_amount)

            product_ids = sorted({item_data['product_id'] for item_data in items_data})
            products = Product.objects.select_for_update().filter(
                id__in=product_ids,
                business=business,
                status='active',
            )
            locked_products = {str(product.pk): product for product in products}
            if len(locked_products) != len(product_ids):
                raise ValueError('One or more products are unavailable.')

            projected_stock = {key: product.current_stock for key, product in locked_products.items()}
            for item_data, line in zip(items_data, calculation.lines):
                product_key = str(item_data['product_id'])
                product = locked_products[product_key]
                if not allow_negative and projected_stock[product_key] < line.quantity:
                    raise ValueError(f'Insufficient stock for {product.name}')
                projected_stock[product_key] -= line.quantity

            customer = None
            if attributes.get('customer') and balance_due > 0:
                customer = attributes['customer'].__class__.objects.select_for_update().get(
                    pk=attributes['customer'].pk,
                    business=business,
                )
                if customer.credit_limit > 0:
                    available = customer.credit_limit - customer.outstanding_amount
                    if balance_due > available:
                        raise ValueError(
                            f'Credit limit exceeded. Available credit: {available:.2f}, '
                            f'required: {balance_due:.2f}'
                        )

            invoice = Invoice.objects.create(
                invoice_number=get_next_invoice_number(business),
                business=business,
                created_by=created_by,
                **attributes,
            )

            for item_data, line in zip(items_data, calculation.lines):
                product = locked_products[str(item_data['product_id'])]
                gst_percent = Decimal(str(item_data.get('gst_percent', product.gst_percent)))
                invoice_item = InvoiceItem.objects.create(
                    invoice=invoice,
                    product=product,
                    product_name=product.name,
                    sku=product.sku,
                    hsn_code=item_data.get('hsn_code', product.hsn_code),
                    mrp=Decimal(str(item_data.get('mrp', product.mrp or product.selling_price))),
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                    cost_price=product.purchase_price,
                    discount_percent=line.discount_percent,
                    discount_amount=line.discount_amount,
                    gst_percent=gst_percent,
                    gst_amount=line.gst_amount,
                    total=line.total,
                )

                InventoryService.deduct_stock(
                    product_id=product.pk,
                    quantity=line.quantity,
                    transaction_type='sale',
                    business=business,
                    user=created_by,
                    reference=invoice.invoice_number,
                    unit_cost=product.purchase_price,
                    movement_key=f'invoice:{invoice.pk}:item:{invoice_item.pk}',
                    reference_type='invoice',
                    reference_id=invoice.pk,
                    allow_negative=allow_negative,
                )

            grand_total = calculation.grand_total

            invoice.subtotal = calculation.subtotal
            invoice.discount_amount = calculation.discount_amount
            invoice.tax_amount = calculation.tax_amount
            invoice.round_off = calculation.round_off
            invoice.grand_total = grand_total
            invoice.paid_amount = paid_amount
            invoice.balance_due = balance_due

            if requested_status in ('pending', 'failed', 'credit'):
                invoice.payment_status = requested_status
            elif paid_amount > grand_total:
                invoice.payment_status = 'overpaid'
            elif balance_due <= 0:
                invoice.payment_status = 'paid'
            elif paid_amount > 0:
                invoice.payment_status = 'partial'
            else:
                invoice.payment_status = 'credit'
            invoice.save()

            for payment_data, amount in zip(payments_data, payment_amounts):
                Payment.objects.create(
                    invoice=invoice,
                    method=payment_data['method'],
                    amount=amount,
                    reference=payment_data.get('reference', ''),
                )

            if customer is not None:
                LedgerService.record_customer(
                    customer_id=customer.pk,
                    business=business,
                    entry_type='invoice',
                    debit=balance_due,
                    event_key=f'invoice:{invoice.pk}:customer-ledger',
                    reference_type='invoice',
                    reference_id=invoice.pk,
                    description=invoice.invoice_number,
                    user=created_by,
                )

            if request is not None:
                audit_event(
                    request,
                    'INVOICE_CREATED',
                    'Invoice',
                    invoice.id,
                    after={'invoice_number': invoice.invoice_number, 'grand_total': invoice.grand_total},
                )

        return invoice

    @staticmethod
    def cancel_invoice(*, invoice_id, business, performed_by, request=None):
        return InvoiceService._reverse_invoice(
            invoice_id=invoice_id,
            business=business,
            performed_by=performed_by,
            request=request,
            status='cancelled',
            reference_prefix='CANCEL',
        )

    @staticmethod
    def refund_invoice(*, invoice_id, business, performed_by, request=None):
        return InvoiceService._reverse_invoice(
            invoice_id=invoice_id,
            business=business,
            performed_by=performed_by,
            request=request,
            status='refunded',
            reference_prefix='REFUND',
        )

    @staticmethod
    def _reverse_invoice(*, invoice_id, business, performed_by, status, reference_prefix, request=None):
        with transaction.atomic():
            try:
                invoice = Invoice.objects.select_for_update().get(
                    pk=invoice_id,
                    business=business,
                )
            except Invoice.DoesNotExist as exc:
                raise LookupError('Not found') from exc
            if invoice.status not in ('completed', 'partially_refunded'):
                raise ValueError('Invoice already cancelled/refunded')

            for item in InvoiceItem.objects.filter(invoice=invoice).select_related('product'):
                returned = SalesReturnItem.objects.filter(
                    invoice_item=item,
                ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
                remaining_quantity = item.quantity - returned
                if remaining_quantity <= 0 or not item.product_id:
                    continue
                product = Product.objects.select_for_update().get(pk=item.product_id)
                InventoryService.restore_stock(
                    product_id=product.pk,
                    quantity=remaining_quantity,
                    transaction_type='returned',
                    business=business,
                    user=performed_by,
                    reference=f'{reference_prefix}-{invoice.invoice_number}',
                    unit_cost=item.cost_price,
                    movement_key=f'invoice:{invoice.pk}:{status}:item:{item.pk}',
                    reference_type='invoice_reversal',
                    reference_id=invoice.pk,
                )

            invoice.status = status
            invoice.payment_status = 'refunded' if status == 'refunded' else invoice.payment_status
            invoice.save(update_fields=['status', 'payment_status'])

            if invoice.customer_id and invoice.balance_due > 0 and invoice.grand_total > 0:
                returned_total = SalesReturnItem.objects.filter(
                    invoice_item__invoice=invoice,
                ).aggregate(total=Sum('total'))['total'] or Decimal('0')
                remaining_value = max(Decimal('0'), invoice.grand_total - returned_total)
                reduction = (invoice.balance_due * remaining_value / invoice.grand_total).quantize(
                    Decimal('0.01')
                )
                LedgerService.record_customer(
                    customer_id=invoice.customer_id,
                    business=business,
                    entry_type='sales_return',
                    credit=reduction,
                    event_key=f'invoice:{invoice.pk}:{status}:customer-ledger',
                    reference_type='invoice',
                    reference_id=invoice.pk,
                    description=f'{reference_prefix} {invoice.invoice_number}',
                    user=performed_by,
                )

            if request is not None:
                audit_event(
                    request,
                    'INVOICE_CANCELLED' if status == 'cancelled' else 'INVOICE_REFUNDED',
                    'Invoice',
                    invoice.id,
                    after={'status': invoice.status, 'payment_status': invoice.payment_status},
                )

        return invoice
