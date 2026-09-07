from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from ..models import Customer, CustomerLedger, Supplier, SupplierLedger


class LedgerService:
    @staticmethod
    def record_customer(*, customer_id, business, entry_type, debit=0, credit=0,
                        event_key, reference_type='', reference_id='', description='', user=None):
        debit = Decimal(str(debit))
        credit = Decimal(str(credit))
        if debit < 0 or credit < 0 or (debit and credit):
            raise ValueError('Ledger entries must contain one non-negative amount.')
        with transaction.atomic():
            existing = CustomerLedger.objects.filter(event_key=event_key).first()
            if existing:
                return existing
            customer = Customer.objects.select_for_update().get(pk=customer_id, business=business)
            entry = CustomerLedger.objects.create(
                business=business, customer=customer, entry_type=entry_type,
                debit=debit, credit=credit, event_key=event_key,
                reference_type=reference_type, reference_id=str(reference_id),
                description=description, created_by=user,
            )
            customer.outstanding_amount = max(
                Decimal('0'), customer.outstanding_amount + debit - credit
            )
            customer.save(update_fields=['outstanding_amount'])
        return entry

    @staticmethod
    def record_supplier(*, supplier_id, business, entry_type, debit=0, credit=0,
                        event_key, reference_type='', reference_id='', description='', user=None):
        debit = Decimal(str(debit))
        credit = Decimal(str(credit))
        if debit < 0 or credit < 0 or (debit and credit):
            raise ValueError('Ledger entries must contain one non-negative amount.')
        with transaction.atomic():
            existing = SupplierLedger.objects.filter(event_key=event_key).first()
            if existing:
                return existing
            supplier = Supplier.objects.select_for_update().get(pk=supplier_id, business=business)
            entry = SupplierLedger.objects.create(
                business=business, supplier=supplier, entry_type=entry_type,
                debit=debit, credit=credit, event_key=event_key,
                reference_type=reference_type, reference_id=str(reference_id),
                description=description, created_by=user,
            )
            supplier.outstanding_amount = max(
                Decimal('0'), supplier.outstanding_amount + debit - credit
            )
            supplier.save(update_fields=['outstanding_amount'])
        return entry

    @staticmethod
    def reconcile_customer(*, customer_id, business):
        customer = Customer.objects.get(pk=customer_id, business=business)
        totals = CustomerLedger.objects.filter(customer=customer).aggregate(
            debit=Sum('debit'), credit=Sum('credit'),
        )
        return max(Decimal('0'), (totals['debit'] or 0) - (totals['credit'] or 0))

    @staticmethod
    def reconcile_supplier(*, supplier_id, business):
        supplier = Supplier.objects.get(pk=supplier_id, business=business)
        totals = SupplierLedger.objects.filter(supplier=supplier).aggregate(
            debit=Sum('debit'), credit=Sum('credit'),
        )
        return max(Decimal('0'), (totals['debit'] or 0) - (totals['credit'] or 0))
