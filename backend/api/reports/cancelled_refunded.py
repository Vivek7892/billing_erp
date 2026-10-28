from decimal import Decimal

from django.db.models import Count, Q, Sum

from ..models import Invoice
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)

    invoices_qs = (
        Invoice.objects.filter(
            business=business,
            status__in=['cancelled', 'refunded'],
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
        .select_related('customer', 'cancelled_by')
        .order_by('-created_at')
    )

    # Optional status filter (cancelled vs refunded)
    status_filter = (params.get('status') or '').strip().lower()
    if status_filter in ('cancelled', 'refunded'):
        invoices_qs = invoices_qs.filter(status=status_filter)

    records = []
    total_cancelled_amt = Decimal('0')
    total_refunded_amt = Decimal('0')
    cancelled_count = 0
    refunded_count = 0

    for inv in invoices_qs[:500]:
        amt = Decimal(str(inv.grand_total or 0))
        if inv.status == 'cancelled':
            cancelled_count += 1
            total_cancelled_amt += amt
        elif inv.status == 'refunded':
            refunded_count += 1
            total_refunded_amt += amt

        cust_name = inv.customer.name if inv.customer else (inv.customer_name or 'Walk-in Customer')
        canceller = (
            inv.cancelled_by.get_full_name() or inv.cancelled_by.username
            if inv.cancelled_by
            else 'System / Cashier'
        )
        date_str = inv.created_at.strftime('%d/%b/%Y') if inv.created_at else '—'
        cancelled_at_str = (
            inv.cancelled_at.strftime('%d/%b/%Y %I:%M %p')
            if inv.cancelled_at
            else (inv.updated_at.strftime('%d/%b/%Y %I:%M %p') if hasattr(inv, 'updated_at') and inv.updated_at else '—')
        )

        records.append({
            'id': inv.id,
            'invoice_number': inv.invoice_number,
            'invoice_date': date_str,
            'status': inv.status.upper(),
            'customer_name': cust_name,
            'customer_phone': inv.customer_phone or (inv.customer.mobile if inv.customer else '—'),
            'amount': float(amt),
            'cancelled_by': canceller,
            'reason': inv.cancel_reason or 'No reason provided',
            'cancelled_at': cancelled_at_str,
        })

    total_count = len(records)
    total_amount = float(total_cancelled_amt + total_refunded_amt)

    payload = {
        'invoices': records,
        'results': records,
        'count': total_count,
        'cancelled_count': cancelled_count,
        'refunded_count': refunded_count,
        'total_cancelled_amount': float(total_cancelled_amt),
        'total_refunded_amount': float(total_refunded_amt),
        'total_amount': total_amount,
        'period_start': str(start),
        'period_end': str(end),
    }

    headers = [
        'Invoice #',
        'Date',
        'Status',
        'Customer',
        'Invoiced Amount',
        'Action Performed By',
        'Reason for Void / Refund',
        'Cancelled At',
    ]

    rows = [
        [
            r['invoice_number'],
            r['invoice_date'],
            r['status'],
            r['customer_name'],
            r['amount'],
            r['cancelled_by'],
            r['reason'],
            r['cancelled_at'],
        ]
        for r in records
    ]

    summary_rows = [
        ('Total Voided / Refunded Invoices', total_count),
        ('Cancelled Invoices Count', cancelled_count),
        ('Refunded Invoices Count', refunded_count),
        ('Total Cancelled Amount', float(total_cancelled_amt)),
        ('Total Refunded Amount', float(total_refunded_amt)),
        ('Total Reversal Impact', total_amount),
    ]

    return ReportData(
        'Cancelled & Refunded Transactions Report',
        'cancelled-refunded-report',
        payload,
        headers,
        rows,
        summary_rows,
    )
