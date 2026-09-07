from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from ..models import (
    Invoice,
    InvoiceItem,
    Product,
    SalesReturn,
    SalesReturnItem,
)
from .inventory_service import InventoryService
from .ledger_service import LedgerService


class SalesReturnService:
    @staticmethod
    def create_sales_return(*, invoice_id, reason, refund_method, items_data, business, created_by):
        if not items_data:
            raise ValueError('Select at least one item to return.')

        with transaction.atomic():
            try:
                invoice = Invoice.objects.select_for_update().get(
                    pk=invoice_id,
                    business=business,
                )
            except Invoice.DoesNotExist as exc:
                raise LookupError('Invoice not found.') from exc
            if invoice.status not in ('completed', 'partially_refunded'):
                raise ValueError('Only completed invoices can be returned.')

            last = SalesReturn.objects.filter(business=business).order_by('-id').first()
            return_number = f"RET-{last.id + 1 if last else 1:04d}"
            return_obj = SalesReturn.objects.create(
                business=business,
                invoice=invoice,
                return_number=return_number,
                reason=reason,
                refund_method=refund_method,
                created_by=created_by,
            )
            refund_total = Decimal('0')
            requested_by_item = {}

            for row in items_data:
                try:
                    invoice_item_id = row['invoice_item_id']
                    invoice_item = InvoiceItem.objects.select_related('product').get(
                        pk=invoice_item_id,
                        invoice=invoice,
                    )
                except (InvoiceItem.DoesNotExist, KeyError) as exc:
                    raise ValueError(f'Invalid item id {row.get("invoice_item_id")}.') from exc

                ret_qty = Decimal(str(row.get('quantity', invoice_item.quantity)))
                already_returned = SalesReturnItem.objects.filter(
                    invoice_item=invoice_item,
                ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
                requested_by_item[invoice_item.pk] = (
                    requested_by_item.get(invoice_item.pk, Decimal('0')) + ret_qty
                )
                remaining_qty = invoice_item.quantity - already_returned
                if ret_qty <= 0 or requested_by_item[invoice_item.pk] > remaining_qty:
                    raise ValueError(f'Invalid return qty for {invoice_item.product_name}.')

                line_total = (
                    invoice_item.total / invoice_item.quantity * ret_qty
                ).quantize(Decimal('0.01'))
                refund_total += line_total
                SalesReturnItem.objects.create(
                    sales_return=return_obj,
                    invoice_item=invoice_item,
                    product=invoice_item.product,
                    product_name=invoice_item.product_name,
                    quantity=ret_qty,
                    unit_price=invoice_item.unit_price,
                    total=line_total,
                )

                if invoice_item.product:
                    product = Product.objects.select_for_update().get(pk=invoice_item.product_id)
                    InventoryService.restore_stock(
                        product_id=product.pk,
                        quantity=ret_qty,
                        transaction_type='returned',
                        business=business,
                        user=created_by,
                        reference=return_number,
                        unit_cost=invoice_item.cost_price,
                        movement_key=f'sales-return:{return_obj.pk}:item:{invoice_item.pk}',
                        reference_type='sales_return',
                        reference_id=return_obj.pk,
                    )

            return_obj.refund_amount = refund_total
            return_obj.save(update_fields=['refund_amount'])

            returned_quantity = SalesReturnItem.objects.filter(
                invoice_item__invoice=invoice,
            ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
            original_quantity = InvoiceItem.objects.filter(invoice=invoice).aggregate(
                total=Sum('quantity'),
            )['total'] or Decimal('0')
            if returned_quantity >= original_quantity:
                invoice.status = 'refunded'
                invoice.payment_status = 'refunded'
            elif returned_quantity > 0:
                invoice.status = 'partially_refunded'
            invoice.save(update_fields=['status', 'payment_status'])

            if invoice.customer_id and invoice.balance_due > 0 and invoice.grand_total > 0:
                proportion = refund_total / invoice.grand_total
                credit_reduction = (invoice.balance_due * proportion).quantize(Decimal('0.01'))
                LedgerService.record_customer(
                    customer_id=invoice.customer_id,
                    business=business,
                    entry_type='sales_return',
                    credit=credit_reduction,
                    event_key=f'sales-return:{return_obj.pk}:customer-ledger',
                    reference_type='sales_return',
                    reference_id=return_obj.pk,
                    description=return_number,
                    user=created_by,
                )

        return return_obj
