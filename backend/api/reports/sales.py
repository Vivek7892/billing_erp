from decimal import Decimal

from django.db.models import Count, Sum

from ..models import CustomerPayment, Invoice, Payment, SalesReturn
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    invoices = Invoice.objects.filter(
        business=business,
        created_at__date__gte=start,
        created_at__date__lte=end,
        status='completed',
    )
    summary = invoices.aggregate(
        total_sales=Sum('grand_total'),
        total_discount=Sum('discount_amount'),
        total_tax=Sum('tax_amount'),
        count=Count('id'),
    )
    returns_total = SalesReturn.objects.filter(
        business=business, created_at__date__gte=start, created_at__date__lte=end,
    ).aggregate(total=Sum('refund_amount'))['total'] or Decimal('0')
    collection = Payment.objects.filter(
        invoice__business=business, invoice__status='completed',
        created_at__date__gte=start, created_at__date__lte=end,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    collection += CustomerPayment.objects.filter(
        business=business, created_at__date__gte=start, created_at__date__lte=end,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    summary.update({
        'returns': returns_total,
        'net_sales': (summary['total_sales'] or Decimal('0')) - returns_total,
        'collection': collection,
        'outstanding': invoices.aggregate(total=Sum('balance_due'))['total'] or Decimal('0'),
    })
    daily = list(invoices.values('created_at__date').annotate(
        total=Sum('grand_total'), count=Count('id'),
    ).order_by('created_at__date'))
    payload = {'summary': summary, 'daily': daily}
    rows = [[row['created_at__date'], row['count'], row['total']] for row in daily]
    summary_rows = [
        ('Total Sales', summary['total_sales'] or 0),
        ('Total Discount', summary['total_discount'] or 0),
        ('Returns', summary['returns'] or 0),
        ('Net Sales', summary['net_sales'] or 0),
        ('Total Tax', summary['total_tax'] or 0),
        ('Collection', summary['collection'] or 0),
        ('Outstanding', summary['outstanding'] or 0),
        ('Invoice Count', summary['count'] or 0),
    ]
    return ReportData('Sales Report', 'sales-report', payload, ['Date', 'Invoices', 'Total Sales'], rows, summary_rows)
