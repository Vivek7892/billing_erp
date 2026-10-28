from django.db.models import Avg, Count, Sum

from ..models import CustomerPayment, Payment
from . import ReportData
from .common import period

METHOD_LABELS = {
    'cash': 'Cash',
    'upi': 'UPI',
    'card': 'Credit / Debit Card',
    'bank': 'Bank Transfer',
    'online': 'Online Payment',
    'credit': 'Customer Credit / Khata',
    'cheque': 'Cheque',
    'bank_transfer': 'Bank Transfer',
    'net_banking': 'Net Banking',
}


def build(business, params):
    start, end = period(params)

    base_qs = Payment.objects.filter(
        invoice__business=business,
        invoice__created_at__date__gte=start,
        invoice__created_at__date__lte=end,
        invoice__status='completed',
        customer_payment__isnull=True,
    )

    # Per-method breakdown
    methods = list(
        base_qs.values('method')
        .annotate(
            total=Sum('amount'),
            count=Count('id'),
            avg_amount=Avg('amount'),
        )
        .order_by('-total')
    )

    # Customer credit collections in the same period
    cust_methods = list(
        CustomerPayment.objects.filter(
            business=business,
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
        .values('method')
        .annotate(
            total=Sum('amount'),
            count=Count('id'),
        )
    )

    # Merge customer payments into methods
    cust_map = {r['method']: r for r in cust_methods}
    for row in methods:
        cust = cust_map.pop(row['method'], None)
        if cust:
            row['total'] = (row['total'] or 0) + (cust['total'] or 0)
            row['count'] = (row['count'] or 0) + (cust['count'] or 0)
    for method, cust in cust_map.items():
        methods.append({
            'method': method,
            'total': cust['total'],
            'count': cust['count'],
            'avg_amount': None,
        })

    total_amount = round(sum(float(r['total'] or 0) for r in methods), 2)
    total_count = sum(int(r['count'] or 0) for r in methods)

    method_rows = []
    for r in methods:
        raw_m = str(r['method'] or '').lower()
        label = METHOD_LABELS.get(raw_m, raw_m.replace('_', ' ').title() if raw_m else 'Other')
        tot = round(float(r['total'] or 0), 2)
        cnt = int(r['count'] or 0)
        share = round(tot / total_amount * 100, 1) if total_amount else 0
        avg_amt = (
            float(r['avg_amount'])
            if r.get('avg_amount') is not None
            else (round(tot / cnt, 2) if cnt else 0)
        )
        method_rows.append({
            'method': label,
            'raw_method': r['method'],
            'payment_method': label,
            'total': tot,
            'count': cnt,
            'avg_amount': avg_amt,
            'share_pct': share,
        })

    # Sort by total descending
    method_rows.sort(key=lambda m: m['total'], reverse=True)

    # Daily breakdown
    daily = list(
        base_qs.values('created_at__date')
        .annotate(
            total=Sum('amount'),
            count=Count('id'),
        )
        .order_by('created_at__date')
    )

    # Detailed collections & audit trail in date range:
    # Captures: Who gave, Who collected, Date & Time, Payment Method, Reference, Linked Invoice, Amount
    detailed_payments = Payment.objects.filter(
        invoice__business=business,
        created_at__date__gte=start,
        created_at__date__lte=end,
    ).select_related(
        'invoice', 'invoice__customer', 'customer_payment',
        'customer_payment__customer', 'created_by', 'customer_payment__created_by'
    ).order_by('-created_at')[:100]

    transactions = []
    for p in detailed_payments:
        # Who gave
        who_gave = 'Walk-in Customer'
        who_gave_phone = ''
        if p.customer_payment and p.customer_payment.customer:
            who_gave = p.customer_payment.customer.name
            who_gave_phone = p.customer_payment.customer.mobile or ''
        elif p.invoice and p.invoice.customer:
            who_gave = p.invoice.customer.name
            who_gave_phone = p.invoice.customer.mobile or ''
        elif p.invoice and p.invoice.customer_name:
            who_gave = p.invoice.customer_name
            who_gave_phone = p.invoice.customer_phone or ''

        # Who collected
        who_collected = 'Staff'
        if p.created_by:
            who_collected = p.created_by.get_full_name() or p.created_by.username
        elif p.customer_payment and p.customer_payment.created_by:
            who_collected = p.customer_payment.created_by.get_full_name() or p.customer_payment.created_by.username
        elif p.invoice and p.invoice.created_by:
            who_collected = p.invoice.created_by.get_full_name() or p.invoice.created_by.username

        raw_m = str(p.method or 'cash').lower()
        method_label = METHOD_LABELS.get(raw_m, raw_m.upper())

        transactions.append({
            'id': p.id,
            'who_gave': who_gave,
            'who_gave_phone': who_gave_phone,
            'who_collected': who_collected,
            'amount': float(p.amount),
            'method': method_label,
            'reference': p.reference or f'TXN-{p.id}',
            'invoice_number': p.invoice.invoice_number if p.invoice else '—',
            'created_at': p.created_at.isoformat() if p.created_at else '',
            'date_time': p.created_at.strftime('%d %b %Y, %I:%M %p') if p.created_at else '',
            'notes': p.notes or (p.customer_payment.notes if p.customer_payment else ''),
        })

    payload = {
        'methods': method_rows,
        'transactions': transactions,
        'daily': [
            {
                'date': str(r['created_at__date']),
                'total': float(r['total'] or 0),
                'count': int(r['count'] or 0),
            }
            for r in daily
        ],
        'total_amount': total_amount,
        'total_count': total_count,
        'period_start': str(start),
        'period_end': str(end),
    }

    headers = ['Payment Channel', 'Number of Transactions', 'Total Amount', 'Share %']
    rows = [
        [m['method'], m['count'], m['total'], f"{m['share_pct']}%"]
        for m in method_rows
    ]
    summary_rows = [
        ('Total Collections', total_amount),
        ('Total Transactions', total_count),
    ]

    return ReportData(
        'Payment Collections Report',
        'payment-collections-report',
        payload,
        headers,
        rows,
        summary_rows,
    )
