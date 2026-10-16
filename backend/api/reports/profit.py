from decimal import Decimal

from django.db.models import F, Sum

from ..models import Expense, InvoiceItem, SalesReturn
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    filters = dict(
        invoice__business=business,
        invoice__created_at__date__gte=start,
        invoice__created_at__date__lte=end,
        invoice__status='completed',
    )
    expense_total = (
        Expense.objects.filter(
            business=business,
            expense_date__gte=start,
            expense_date__lte=end,
        ).aggregate(total=Sum('amount'))['total']
        or Decimal('0')
    )
    returns_total = (
        SalesReturn.objects.filter(
            business=business,
            created_at__date__gte=start,
            created_at__date__lte=end,
        ).aggregate(total=Sum('refund_amount'))['total']
        or Decimal('0')
    )
    aggregate = (
        InvoiceItem.objects.filter(**filters)
        .annotate(
            net_revenue=F('total') - F('gst_amount'),
            cogs=F('quantity') * F('cost_price'),
        )
        .aggregate(
            total_net_revenue=Sum('net_revenue'),
            total_cogs=Sum('cogs'),
            total_gst=Sum('gst_amount'),
            total_discount=Sum('discount_amount'),
        )
    )
    gross_sales = (
        InvoiceItem.objects.filter(**filters).aggregate(
            s=Sum(F('unit_price') * F('quantity'))
        )['s']
        or Decimal('0')
    )
    net_revenue = aggregate['total_net_revenue'] or Decimal('0')
    total_cogs = aggregate['total_cogs'] or Decimal('0')
    gross_profit = net_revenue - total_cogs
    net_profit = gross_profit - expense_total - returns_total

    items = (
        InvoiceItem.objects.filter(**filters)
        .values('product_name', 'sku')
        .annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum(F('total') - F('gst_amount')),
            total_cost=Sum(F('quantity') * F('cost_price')),
        )
        .order_by('-total_revenue')
    )
    result = [
        {
            'product': row['product_name'] or 'Unknown Product',
            'sku': row['sku'] or '—',
            'qty': float(row['total_qty'] or 0),
            'revenue': float(row['total_revenue'] or 0),
            'cost': float(row['total_cost'] or 0),
            'profit': float((row['total_revenue'] or 0) - (row['total_cost'] or 0)),
        }
        for row in items
    ]

    gross_margin = (
        round(float(gross_profit / net_revenue * 100), 1) if net_revenue else 0
    )
    net_margin = (
        round(float(net_profit / net_revenue * 100), 1) if net_revenue else 0
    )

    payload = {
        'items': result,
        'gross_sales': float(gross_sales),
        'total_discount': float(aggregate['total_discount'] or 0),
        'total_gst': float(aggregate['total_gst'] or 0),
        'net_revenue': float(net_revenue),
        'total_cogs': float(total_cogs),
        'gross_profit': float(gross_profit),
        'expenses': float(expense_total),
        'operating_expenses': float(expense_total),
        'sales_returns': float(returns_total),
        'net_profit': float(net_profit),
        'gross_margin': gross_margin,
        'net_margin': net_margin,
        # Backward/UI convenience aliases
        'total_revenue': float(net_revenue),
        'total_cost': float(total_cogs),
        'total_profit': float(gross_profit),
    }

    summary_rows = [
        ('Gross Invoiced Sales', float(gross_sales)),
        ('Net Revenue', float(net_revenue)),
        ('Cost of Goods Sold (COGS)', float(total_cogs)),
        ('Gross Profit', float(gross_profit)),
        ('Gross Margin', f"{gross_margin}%"),
        ('Operating Expenses', float(expense_total)),
        ('Sales Returns', float(returns_total)),
        ('Net Profit', float(net_profit)),
        ('Net Margin', f"{net_margin}%"),
    ]
    headers = ['Product Name', 'SKU', 'Quantity Sold', 'Revenue', 'Cost (COGS)', 'Gross Profit']
    rows = [
        [r['product'], r['sku'], r['qty'], r['revenue'], r['cost'], r['profit']]
        for r in result
    ]

    return ReportData(
        'Profit & Loss Report',
        'profit-and-loss-report',
        payload,
        headers,
        rows,
        summary_rows,
    )
