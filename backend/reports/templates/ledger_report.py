from decimal import Decimal
from django.db.models import Sum
from api.models import Customer, CustomerLedger, Supplier, SupplierLedger
from .base_report import ReportData
from ..utils.date_formatter import format_date, parse_period_params


def build_customer_ledger(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    customer_id = params.get('customer') or params.get('customer_id')

    qs = CustomerLedger.objects.filter(business=business)
    filter_label = ''
    if customer_id:
        qs = qs.filter(customer_id=customer_id)
        cust = Customer.objects.filter(id=customer_id, business=business).first()
        if cust:
            filter_label = f"Customer: {cust.name} (Phone: {cust.mobile or '—'})"

    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    qs = qs.select_related('customer').order_by('created_at')

    rows = []
    tot_debit = Decimal('0.00')
    tot_credit = Decimal('0.00')
    running_balance = Decimal('0.00')

    for entry in qs:
        dt_str = format_date(entry.created_at.date() if hasattr(entry.created_at, 'date') else entry.created_at)
        particulars = entry.description or (f"{entry.reference_type} #{entry.reference_id}" if entry.reference_type else 'Transaction')
        v_type = (entry.entry_type or entry.reference_type or 'JOURNAL').upper()
        debit = entry.debit or Decimal('0.00')
        credit = entry.credit or Decimal('0.00')

        tot_debit += debit
        tot_credit += credit
        running_balance += (debit - credit)

        cust_label = entry.customer.name if entry.customer else '—'

        rows.append([
            dt_str,
            cust_label,
            particulars,
            v_type,
            float(debit),
            float(credit),
            float(running_balance),
        ])

    headers = [
        'Date', 'Customer', 'Particulars / Description', 'Type',
        'Debit (Dr)', 'Credit (Cr)', 'Running Balance'
    ]

    summary_rows = [
        ('Total Debit (Invoiced)', float(tot_debit)),
        ('Total Credit (Paid)', float(tot_credit)),
        ('Closing Balance Due', float(running_balance)),
        ('Ledger Entries', len(rows)),
    ]

    payload = {
        'period': period_label,
        'summary': {
            'total_debit': float(tot_debit),
            'total_credit': float(tot_credit),
            'closing_balance': float(running_balance),
            'count': len(rows),
        },
        'rows': rows,
    }

    return ReportData(
        title='Customer Ledger',
        filename='customer-ledger',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=filter_label,
    )


def build_supplier_ledger(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    supplier_id = params.get('supplier') or params.get('supplier_id')

    qs = SupplierLedger.objects.filter(business=business)
    filter_label = ''
    if supplier_id:
        qs = qs.filter(supplier_id=supplier_id)
        supp = Supplier.objects.filter(id=supplier_id, business=business).first()
        if supp:
            filter_label = f"Supplier: {supp.name} (Phone: {supp.phone or '—'})"

    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    qs = qs.select_related('supplier').order_by('created_at')

    rows = []
    tot_debit = Decimal('0.00')
    tot_credit = Decimal('0.00')
    running_balance = Decimal('0.00')

    for entry in qs:
        dt_str = format_date(entry.created_at.date() if hasattr(entry.created_at, 'date') else entry.created_at)
        particulars = entry.description or (f"{entry.reference_type} #{entry.reference_id}" if entry.reference_type else 'Transaction')
        v_type = (entry.entry_type or entry.reference_type or 'JOURNAL').upper()
        debit = entry.debit or Decimal('0.00')
        credit = entry.credit or Decimal('0.00')

        tot_debit += debit
        tot_credit += credit
        running_balance += (credit - debit)

        supp_label = entry.supplier.name if entry.supplier else '—'

        rows.append([
            dt_str,
            supp_label,
            particulars,
            v_type,
            float(debit),
            float(credit),
            float(running_balance),
        ])

    headers = [
        'Date', 'Supplier', 'Particulars / Description', 'Type',
        'Debit (Paid)', 'Credit (Purchased)', 'Running Balance'
    ]

    summary_rows = [
        ('Total Debit (Paid)', float(tot_debit)),
        ('Total Credit (Purchased)', float(tot_credit)),
        ('Closing Payable Balance', float(running_balance)),
        ('Ledger Entries', len(rows)),
    ]

    payload = {
        'period': period_label,
        'summary': {
            'total_debit': float(tot_debit),
            'total_credit': float(tot_credit),
            'closing_balance': float(running_balance),
            'count': len(rows),
        },
        'rows': rows,
    }

    return ReportData(
        title='Supplier Ledger',
        filename='supplier-ledger',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=filter_label,
    )


def build_outstanding_receivables(business, params):
    qs = Customer.objects.filter(business=business, outstanding_amount__gt=0).order_by('-outstanding_amount')
    rows = []
    tot_receivable = Decimal('0.00')

    for c in qs:
        bal = c.outstanding_amount or Decimal('0.00')
        tot_receivable += bal
        rows.append([
            c.name,
            c.mobile or '—',
            float(c.credit_limit or 0),
            float(bal),
        ])

    headers = ['Customer Name', 'Phone / Mobile', 'Credit Limit', 'Outstanding Balance']
    summary_rows = [
        ('Customers with Outstanding', len(rows)),
        ('Total Outstanding Receivables', float(tot_receivable)),
    ]

    return ReportData(
        title='Outstanding Receivables Report',
        filename='outstanding-receivables',
        payload={'customers': rows, 'total_outstanding': float(tot_receivable)},
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_outstanding_payables(business, params):
    qs = Supplier.objects.filter(business=business, outstanding_amount__gt=0).order_by('-outstanding_amount')
    rows = []
    tot_payable = Decimal('0.00')

    for s in qs:
        bal = s.outstanding_amount or Decimal('0.00')
        tot_payable += bal
        rows.append([
            s.name,
            s.phone or '—',
            s.gstin or '—',
            float(bal),
        ])

    headers = ['Supplier Name', 'Phone', 'GSTIN', 'Outstanding Payable']
    summary_rows = [
        ('Suppliers with Outstanding', len(rows)),
        ('Total Outstanding Payables', float(tot_payable)),
    ]

    return ReportData(
        title='Outstanding Payables Report',
        filename='outstanding-payables',
        payload={'suppliers': rows, 'total_outstanding': float(tot_payable)},
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )

