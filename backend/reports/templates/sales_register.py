from decimal import Decimal
from django.db.models import Count, Sum
from api.models import CustomerPayment, Invoice, InvoiceItem, Payment, SalesReturn
from .base_report import ReportData
from ..utils.date_formatter import format_date, parse_period_params


def build_sales_register(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    qs = Invoice.objects.filter(business=business, status='completed')
    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    customer_id = params.get('customer') or params.get('customer_id')
    filter_label = ''
    if customer_id:
        qs = qs.filter(customer_id=customer_id)
        first_inv = qs.first()
        if first_inv:
            filter_label = f"Customer: {first_inv.customer_name}"

    qs = qs.select_related('customer').order_by('created_at')

    rows = []
    tot_taxable = Decimal('0.00')
    tot_tax = Decimal('0.00')
    tot_grand = Decimal('0.00')

    for inv in qs:
        inv_date = format_date(inv.created_at.date() if hasattr(inv.created_at, 'date') else inv.created_at)
        cust_name = inv.customer_name or (inv.customer.name if inv.customer else 'Walk-in Customer')
        gstin = getattr(inv.customer, 'gstin', '') if inv.customer else ''
        taxable = inv.subtotal or Decimal('0.00')
        tax = inv.tax_amount or Decimal('0.00')
        round_off = inv.round_off or Decimal('0.00')
        grand = inv.grand_total or Decimal('0.00')

        tot_taxable += taxable
        tot_tax += tax
        tot_grand += grand

        rows.append([
            inv_date,
            inv.invoice_number,
            cust_name,
            gstin or '—',
            (inv.payment_method or 'Cash').upper(),
            float(taxable),
            float(tax),
            float(round_off),
            float(grand),
        ])

    headers = [
        'Date', 'Invoice No.', 'Customer Name', 'GSTIN', 'Payment Mode',
        'Taxable Amount', 'Tax Amount', 'Round Off', 'Invoice Total'
    ]

    summary_rows = [
        ('Total Invoices', len(rows)),
        ('Total Taxable Amount', float(tot_taxable)),
        ('Total Tax Collected', float(tot_tax)),
        ('Total Invoiced Value', float(tot_grand)),
    ]

    payload = {
        'period': period_label,
        'summary': {
            'count': len(rows),
            'taxable_amount': float(tot_taxable),
            'tax_amount': float(tot_tax),
            'grand_total': float(tot_grand),
        },
        'rows': rows,
    }

    return ReportData(
        title='Sales Register',
        filename='sales-register',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=filter_label,
    )


def build_sales_summary(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    invoices = Invoice.objects.filter(business=business, status='completed')
    if start_date:
        invoices = invoices.filter(created_at__date__gte=start_date)
    if end_date:
        invoices = invoices.filter(created_at__date__lte=end_date)

    summary = invoices.aggregate(
        total_sales=Sum('grand_total'),
        total_discount=Sum('discount_amount'),
        total_tax=Sum('tax_amount'),
        count=Count('id'),
    )
    returns_qs = SalesReturn.objects.filter(business=business)
    if start_date:
        returns_qs = returns_qs.filter(created_at__date__gte=start_date)
    if end_date:
        returns_qs = returns_qs.filter(created_at__date__lte=end_date)
    returns_total = returns_qs.aggregate(total=Sum('refund_amount'))['total'] or Decimal('0.00')

    payment_qs = Payment.objects.filter(
        invoice__business=business, invoice__status='completed', customer_payment__isnull=True,
    )
    if start_date:
        payment_qs = payment_qs.filter(created_at__date__gte=start_date)
    if end_date:
        payment_qs = payment_qs.filter(created_at__date__lte=end_date)
    collection = payment_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    cust_pmt_qs = CustomerPayment.objects.filter(business=business)
    if start_date:
        cust_pmt_qs = cust_pmt_qs.filter(created_at__date__gte=start_date)
    if end_date:
        cust_pmt_qs = cust_pmt_qs.filter(created_at__date__lte=end_date)
    collection += cust_pmt_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    outstanding = invoices.aggregate(total=Sum('balance_due'))['total'] or Decimal('0.00')
    gross_sales = summary['total_sales'] or Decimal('0.00')
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

    rows = [[format_date(row['created_at__date']), int(row['count'] or 0), float(row['total'] or 0)] for row in daily]

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

    return ReportData(
        title='Sales Summary Report',
        filename='sales-summary-report',
        payload={'summary': float_summary, 'daily': rows},
        headers=['Date', 'Invoice Count', 'Total Sales'],
        rows=rows,
        summary_rows=summary_rows,
    )


def build_item_wise_sales(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    qs = InvoiceItem.objects.filter(invoice__business=business, invoice__status='completed')
    if start_date:
        qs = qs.filter(invoice__created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(invoice__created_at__date__lte=end_date)

    category_id = params.get('category') or params.get('category_id')
    filter_label = ''
    if category_id:
        qs = qs.filter(product__category_id=category_id)
        first_item = qs.first()
        if first_item and first_item.product and first_item.product.category:
            filter_label = f"Category: {first_item.product.category.name}"

    raw_data = list(
        qs.values('product_name', 'sku')
        .annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum('total'),
            total_tax=Sum('gst_amount'),
        )
        .order_by('-total_qty')
    )

    rows = []
    tot_qty = Decimal('0.00')
    tot_tax = Decimal('0.00')
    tot_rev = Decimal('0.00')

    for r in raw_data:
        qty = r['total_qty'] or Decimal('0.00')
        tax = r['total_tax'] or Decimal('0.00')
        rev = r['total_revenue'] or Decimal('0.00')
        taxable = rev - tax
        avg_rate = (taxable / qty) if qty > 0 else Decimal('0.00')

        tot_qty += qty
        tot_tax += tax
        tot_rev += rev

        rows.append([
            r['product_name'] or 'Unknown Product',
            r['sku'] or '—',
            float(qty),
            float(avg_rate),
            float(tax),
            float(rev),
        ])

    headers = [
        'Product Name', 'SKU / Code', 'Quantity Sold',
        'Avg Rate', 'Tax Amount', 'Total Revenue'
    ]

    summary_rows = [
        ('Total Distinct Items', len(rows)),
        ('Total Quantity Sold', float(tot_qty)),
        ('Total Tax Amount', float(tot_tax)),
        ('Total Sales Revenue', float(tot_rev)),
    ]

    payload = {
        'period': period_label,
        'summary': {
            'distinct_items': len(rows),
            'total_qty': float(tot_qty),
            'total_tax': float(tot_tax),
            'total_revenue': float(tot_rev),
        },
        'rows': rows,
        'products': [
            {
                'product_name': r[0],
                'sku': r[1],
                'total_qty': r[2],
                'total_revenue': r[5],
            } for r in rows
        ],
    }

    return ReportData(
        title='Item-Wise Sales Report',
        filename='item-wise-sales-report',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=filter_label,
    )

