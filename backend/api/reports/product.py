from django.db.models import Sum

from ..models import InvoiceItem
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    data = list(InvoiceItem.objects.filter(invoice__business=business, invoice__created_at__date__gte=start, invoice__created_at__date__lte=end, invoice__status='completed').values('product_name', 'sku').annotate(total_qty=Sum('quantity'), total_revenue=Sum('total')).order_by('-total_qty'))
    return ReportData('Product Sales Report', 'product-report', data, ['Product', 'SKU', 'Qty Sold', 'Revenue'], [[row['product_name'], row['sku'], row['total_qty'], row['total_revenue']] for row in data])
