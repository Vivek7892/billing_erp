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
        invoice__business=business, invoice__status='completed', customer_payment__isnull=True,
        created_at__date__gte=start, created_at__date__lte=end,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    collection += CustomerPayment.objects.filter(
        business=business, created_at__date__gte=start, created_at__date__lte=end,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    outstanding = invoices.aggregate(total=Sum('balance_due'))['total'] or Decimal('0')
    gross_sales = summary['total_sales'] or Decimal('0')
    net_sales = gross_sales - returns_total
    float_summary = {
        'count': int(summary['count'] or 0),
        'gross_sales': float(gross_sales),
        'total_sales': float(gross_sales),
        'total_discount': float(summary['total_discount'] or 0),
        'total_tax': float(summary['total_tax'] or 0),
        'returns': float(returns_total),
        'net_sales': float(net_sales),
        'collection': float(collection),
        'outstanding': float(outstanding),
    }
    daily = list(invoices.values('created_at__date').annotate(
        total=Sum('grand_total'), count=Count('id'),
    ).order_by('created_at__date'))
    daily_serializable = [
        {'created_at__date': str(row['created_at__date']), 'total': float(row['total'] or 0), 'count': int(row['count'] or 0)}
        for row in daily
    ]
    payload = {'summary': float_summary, 'daily': daily_serializable}
    rows = [[row['created_at__date'], int(row['count'] or 0), float(row['total'] or 0)] for row in daily_serializable]
    summary_rows = [
        ('Gross Invoiced Sales', float_summary['gross_sales']),
        ('Total Discounts', float_summary['total_discount']),
        ('Sales Returns', float_summary['returns']),
        ('Net Sales Revenue', float_summary['net_sales']),
        ('Output GST Tax', float_summary['total_tax']),
        ('Total Collections', float_summary['collection']),
        ('Outstanding Balance', float_summary['outstanding']),
        ('Completed Invoices', float_summary['count']),
    ]
    return ReportData('Sales Summary Report', 'sales-summary-report', payload, ['Date', 'Invoice Count', 'Total Sales'], rows, summary_rows)
