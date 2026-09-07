from django.db.models import F, Sum

from ..models import Invoice, InvoiceItem
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    data = list(InvoiceItem.objects.filter(invoice__business=business, invoice__created_at__date__gte=start, invoice__created_at__date__lte=end, invoice__status='completed').values('gst_percent').annotate(taxable_amount=Sum(F('total') - F('gst_amount')), gst_collected=Sum('gst_amount')).order_by('gst_percent'))
    total_gst = Invoice.objects.filter(business=business, created_at__date__gte=start, created_at__date__lte=end, status='completed').aggregate(total=Sum('tax_amount'))['total'] or 0
    payload = {'by_rate': data, 'total_gst': float(total_gst)}
    rows = [[row['gst_percent'], row['taxable_amount'], row['gst_collected']] for row in data]
    return ReportData('GST Report', 'gst-report', payload, ['GST %', 'Taxable Amount', 'GST Collected'], rows, [('Total GST', total_gst)])
