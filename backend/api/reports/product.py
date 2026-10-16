from django.db.models import Sum

from ..models import InvoiceItem
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    raw_data = list(
        InvoiceItem.objects.filter(
            invoice__business=business,
            invoice__created_at__date__gte=start,
            invoice__created_at__date__lte=end,
            invoice__status='completed',
        )
        .values('product_name', 'sku')
        .annotate(total_qty=Sum('quantity'), total_revenue=Sum('total'))
        .order_by('-total_qty')
    )

    items = [
        {
            'product_name': row['product_name'] or 'Unknown Product',
            'sku': row['sku'] or '—',
            'total_qty': int(row['total_qty'] or 0),
            'total_revenue': float(row['total_revenue'] or 0),
        }
        for row in raw_data
    ]

    total_products = len(items)
    total_qty = sum(r['total_qty'] for r in items)
    total_revenue = sum(r['total_revenue'] for r in items)

    payload = {
        'products': items,
        'results': items,
        'summary': {
            'total_products': total_products,
            'total_qty': total_qty,
            'total_revenue': total_revenue,
        },
    }

    headers = ['Product Name', 'SKU', 'Quantity Sold', 'Total Revenue']
    rows = [
        [r['product_name'], r['sku'], r['total_qty'], r['total_revenue']]
        for r in items
    ]
    summary_rows = [
        ('Total Products Sold', total_products),
        ('Total Quantity Sold', total_qty),
        ('Total Revenue', total_revenue),
    ]

    return ReportData(
        'Product Sales Report',
        'product-sales-report',
        payload,
        headers,
        rows,
        summary_rows,
    )
