from decimal import Decimal

from django.db import transaction

from ..models import Customer, CustomerPayment, Invoice, Payment, Supplier, SupplierPayment
from .ledger_service import LedgerService
from ..utils import audit_event


class PaymentService:
    @staticmethod
    def record_customer_payment(*, attributes, business, created_by, request=None):
        attributes = dict(attributes)
        attributes.pop('business', None)
        attributes.pop('created_by', None)

        customer = attributes.get('customer')
        if isinstance(customer, (int, str)):
            customer = Customer.objects.get(pk=customer, business=business)

        amount = Decimal(str(attributes['amount']))
        if amount <= 0:
            raise ValueError('Payment amount must be greater than zero.')

        method = attributes.get('method', 'cash')
        reference = (attributes.get('reference', '') or '').strip()
        if not reference:
            import uuid
            from django.utils import timezone
            reference = f"TXN-{timezone.now().strftime('%y%m%d%H%M')}-{uuid.uuid4().hex[:4].upper()}"
        notes = attributes.get('notes', '') or ''

        invoice = attributes.get('invoice')
        if isinstance(invoice, (int, str)):
            invoice = Invoice.objects.get(pk=invoice, business=business)

        valid_payment_methods = {choice[0] for choice in Payment.METHOD_CHOICES}
        pay_method = method if method in valid_payment_methods else 'cash'

        with transaction.atomic():
            locked_customer = Customer.objects.select_for_update().get(pk=customer.pk, business=business)

            if invoice is not None:
                locked_invoice = Invoice.objects.select_for_update().get(pk=invoice.pk, business=business)
                if locked_invoice.customer_id != locked_customer.pk:
                    raise ValueError('Invoice does not belong to the selected customer.')
                if locked_invoice.status in ('cancelled', 'refunded'):
                    raise ValueError(f'Cannot collect payment on a {locked_invoice.status} invoice.')
                if amount > locked_invoice.balance_due:
                    raise ValueError(
                        f'Payment amount ({amount:.2f}) exceeds invoice balance due ({locked_invoice.balance_due:.2f}).'
                    )

                payment = CustomerPayment.objects.create(
                    business=business,
                    customer=locked_customer,
                    invoice=locked_invoice,
                    amount=amount,
                    method=method if method in dict(CustomerPayment.METHOD_CHOICES) else 'cash',
                    reference=reference,
                    notes=notes,
                    created_by=created_by,
                )

                LedgerService.record_customer(
                    customer_id=locked_customer.pk,
                    business=business,
                    entry_type='payment',
                    credit=amount,
                    event_key=f'customer-payment:{payment.pk}:ledger',
                    reference_type='customer_payment',
                    reference_id=payment.pk,
                    description=reference or f'Payment for {locked_invoice.invoice_number}',
                    user=created_by,
                )

                Payment.objects.create(
                    invoice=locked_invoice,
                    customer_payment=payment,
                    method=pay_method,
                    amount=amount,
                    reference=reference,
                )

                locked_invoice.paid_amount += amount
                locked_invoice.balance_due = max(Decimal('0'), locked_invoice.grand_total - locked_invoice.paid_amount)
                if locked_invoice.balance_due <= 0:
                    locked_invoice.payment_status = 'paid'
                elif locked_invoice.paid_amount > 0:
                    locked_invoice.payment_status = 'partial'
                else:
                    locked_invoice.payment_status = 'credit'
                locked_invoice.save(update_fields=['paid_amount', 'balance_due', 'payment_status'])

            else:
                payment = CustomerPayment.objects.create(
                    business=business,
                    customer=locked_customer,
                    invoice=None,
                    amount=amount,
                    method=method if method in dict(CustomerPayment.METHOD_CHOICES) else 'cash',
                    reference=reference,
                    notes=notes,
                    created_by=created_by,
                )

                LedgerService.record_customer(
                    customer_id=locked_customer.pk,
                    business=business,
                    entry_type='payment',
                    credit=amount,
                    event_key=f'customer-payment:{payment.pk}:ledger',
                    reference_type='customer_payment',
                    reference_id=payment.pk,
                    description=reference or 'Account payment',
                    user=created_by,
                )

                open_invoices = Invoice.objects.select_for_update().filter(
                    customer=locked_customer,
                    business=business,
                    balance_due__gt=0,
                    status__in=['completed', 'posted'],
                ).order_by('created_at', 'id')

                remaining = amount
                for inv in open_invoices:
                    if remaining <= 0:
                        break
                    alloc = min(remaining, inv.balance_due)
                    inv.paid_amount += alloc
                    inv.balance_due = max(Decimal('0'), inv.grand_total - inv.paid_amount)
                    if inv.balance_due <= 0:
                        inv.payment_status = 'paid'
                    elif inv.paid_amount > 0:
                        inv.payment_status = 'partial'
                    else:
                        inv.payment_status = 'credit'
                    inv.save(update_fields=['paid_amount', 'balance_due', 'payment_status'])

                    Payment.objects.create(
                        invoice=inv,
                        customer_payment=payment,
                        method=pay_method,
                        amount=alloc,
                        reference=reference,
                    )
                    remaining -= alloc

            if request is not None:
                audit_event(
                    request,
                    'PAYMENT_COLLECTED',
                    'CustomerPayment',
                    payment.id,
                    entity_name=locked_customer.name,
                    after={
                        'amount': str(amount),
                        'method': method,
                        'customer_id': locked_customer.id,
                        'invoice_id': invoice.id if invoice else None,
                    },
                )

        return payment

    @staticmethod
    def record_supplier_payment(*, attributes, business, created_by):
        attributes = dict(attributes)
        attributes.pop('business', None)
        attributes.pop('created_by', None)
        with transaction.atomic():
            payment = SupplierPayment.objects.create(
                business=business,
                created_by=created_by,
                **attributes,
            )
            LedgerService.record_supplier(
                supplier_id=payment.supplier_id,
                business=business,
                entry_type='payment',
                credit=payment.amount,
                event_key=f'supplier-payment:{payment.pk}:ledger',
                reference_type='supplier_payment',
                reference_id=payment.pk,
                description=payment.reference,
                user=created_by,
            )
        return payment
