from decimal import Decimal

from django.db.models import F, Sum

from ..models import Expense, InvoiceItem, SalesReturn
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    filters = dict(invoice__business=business, invoice__created_at__date__gte=start, invoice__created_at__date__lte=end, invoice__status='completed')
    expense_total = Expense.objects.filter(business=business, expense_date__gte=start, expense_date__lte=end).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    returns_total = SalesReturn.objects.filter(business=business, created_at__date__gte=start, created_at__date__lte=end).aggregate(total=Sum('refund_amount'))['total'] or Decimal('0')
    aggregate = InvoiceItem.objects.filter(**filters).annotate(
        net_revenue=F('total') - F('gst_amount'), cogs=F('quantity') * F('cost_price'),
    ).aggregate(total_net_revenue=Sum('net_revenue'), total_cogs=Sum('cogs'), total_gst=Sum('gst_amount'), total_discount=Sum('discount_amount'))
    gross_sales = InvoiceItem.objects.filter(**filters).aggregate(s=Sum(F('unit_price') * F('quantity')))['s'] or 0
    net_revenue = aggregate['total_net_revenue'] or Decimal('0')
    total_cogs = aggregate['total_cogs'] or Decimal('0')
    gross_profit = net_revenue - total_cogs
    net_profit = gross_profit - expense_total - returns_total
    items = InvoiceItem.objects.filter(**filters).values('product_name', 'sku').annotate(
        total_qty=Sum('quantity'), total_revenue=Sum(F('total') - F('gst_amount')), total_cost=Sum(F('quantity') * F('cost_price')),
    ).order_by('-total_revenue')
    result = [{'product': row['product_name'], 'sku': row['sku'], 'qty': float(row['total_qty'] or 0), 'revenue': float(row['total_revenue'] or 0), 'cost': float(row['total_cost'] or 0), 'profit': float((row['total_revenue'] or 0) - (row['total_cost'] or 0))} for row in items]
    payload = {'items': result, 'gross_sales': float(gross_sales), 'total_discount': float(aggregate['total_discount'] or 0), 'total_gst': float(aggregate['total_gst'] or 0), 'net_revenue': float(net_revenue), 'total_cogs': float(total_cogs), 'gross_profit': float(gross_profit), 'expenses': float(expense_total), 'sales_returns': float(returns_total), 'net_profit': float(net_profit), 'gross_margin': round(float(gross_profit / net_revenue * 100), 1) if net_revenue else 0, 'net_margin': round(float(net_profit / net_revenue * 100), 1) if net_revenue else 0}
    summary = [('Gross Sales', gross_sales), ('Net Revenue', net_revenue), ('Total COGS', total_cogs), ('Gross Profit', gross_profit), ('Expenses', expense_total), ('Net Profit', net_profit)]
    rows = [[r['product'], r['sku'], r['qty'], r['revenue'], r['cost'], r['profit']] for r in result]
    return ReportData('Profit Report', 'profit-report', payload, ['Product', 'SKU', 'Qty', 'Revenue', 'Cost', 'Profit'], rows, summary)
