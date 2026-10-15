from django.db.models import Count, Sum, Avg

from ..models import Payment, CustomerPayment
from . import ReportData
from .common import period


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
        base_qs.values('method').annotate(
            total=Sum('amount'),
            count=Count('id'),
            avg_amount=Avg('amount'),
        ).order_by('-total')
    )

    # Customer credit collections in the same period
    cust_methods = list(
        CustomerPayment.objects.filter(
            business=business,
            created_at__date__gte=start,
            created_at__date__lte=end,
        ).values('method').annotate(
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
        methods.append({'method': method, 'total': cust['total'], 'count': cust['count'], 'avg_amount': None})

    total_amount = sum(float(r['total'] or 0) for r in methods)
    total_count = sum(int(r['count'] or 0) for r in methods)

    # Daily breakdown
    daily = list(
        base_qs.values('created_at__date').annotate(
            total=Sum('amount'),
            count=Count('id'),
        ).order_by('created_at__date')
    )

    payload = {
        'methods': [
            {
                'method': r['method'],
                'total': float(r['total'] or 0),
                'count': int(r['count'] or 0),
                'avg_amount': float(r['avg_amount'] or 0) if r.get('avg_amount') else 0,
                'share_pct': round(float(r['total'] or 0) / total_amount * 100, 1) if total_amount else 0,
            }
            for r in methods
        ],
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

    rows = [[r['method'], r['count'], r['total'], f"{r['share_pct']}%"] for r in payload['methods']]
    summary_rows = [
        ('Total Collections', total_amount),
        ('Total Transactions', total_count),
        ('Period', f'{start} to {end}'),
    ]

    return ReportData(
        'Payment Collections Report',
        'payment-collections-report',
        payload,
        ['Payment Method', 'Transactions', 'Total Amount', 'Share %'],
        rows,
        summary_rows=summary_rows,
    )
