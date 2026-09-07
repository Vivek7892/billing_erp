from decimal import Decimal

from django.db import transaction

from ..models import CustomerPayment, SupplierPayment
from .ledger_service import LedgerService


class PaymentService:
    @staticmethod
    def record_customer_payment(*, attributes, business, created_by):
        attributes = dict(attributes)
        attributes.pop('business', None)
        attributes.pop('created_by', None)
        with transaction.atomic():
            payment = CustomerPayment.objects.create(
                business=business,
                created_by=created_by,
                **attributes,
            )
            LedgerService.record_customer(
                customer_id=payment.customer_id,
                business=business,
                entry_type='payment',
                credit=payment.amount,
                event_key=f'customer-payment:{payment.pk}:ledger',
                reference_type='customer_payment',
                reference_id=payment.pk,
                description=payment.reference,
                user=created_by,
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
