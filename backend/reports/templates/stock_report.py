from decimal import Decimal
from django.db.models import F, Sum
from api.models import InventoryTransaction, Product
from .base_report import ReportData
from ..utils.date_formatter import format_date, format_datetime, parse_period_params


def build_stock_summary(business, params):
    qs = Product.objects.filter(business=business).select_related('category').order_by('name')
    category_id = params.get('category') or params.get('category_id')
    filter_label = ''
    if category_id:
        qs = qs.filter(category_id=category_id)
        first_p = qs.first()
        if first_p and first_p.category:
            filter_label = f"Category: {first_p.category.name}"

    rows = []
    tot_cost_val = Decimal('0.00')
    tot_retail_val = Decimal('0.00')
    tot_stock = Decimal('0.00')
    low_stock_count = 0

    for p in qs:
        stock = p.current_stock or Decimal('0.00')
        cost = p.purchase_price or Decimal('0.00')
        sell = p.selling_price or Decimal('0.00')
        valuation = stock * cost
        retail_val = stock * sell

        tot_cost_val += valuation
        tot_retail_val += retail_val
        tot_stock += stock

        if p.minimum_stock is not None and stock <= p.minimum_stock:
            low_stock_count += 1

        cat_name = p.category.name if p.category else 'General'

        rows.append([
            p.name,
            p.sku or p.barcode or '—',
            cat_name,
            float(stock),
            p.unit or 'Pcs',
            float(cost),
            float(sell),
            float(valuation),
        ])

    headers = [
        'Product Name', 'SKU / Code', 'Category', 'Current Stock',
        'Unit', 'Cost Price', 'Selling Price', 'Total Valuation'
    ]

    summary_rows = [
        ('Total Products', len(rows)),
        ('Total Units in Stock', float(tot_stock)),
        ('Low Stock Items', low_stock_count),
        ('Total Valuation (Cost)', float(tot_cost_val)),
        ('Total Valuation (Retail)', float(tot_retail_val)),
    ]

    payload = {
        'summary': {
            'total_products': len(rows),
            'total_stock': float(tot_stock),
            'low_stock_items': low_stock_count,
            'valuation_cost': float(tot_cost_val),
            'valuation_retail': float(tot_retail_val),
        },
        'rows': rows,
    }

    return ReportData(
        title='Stock Summary Report',
        filename='stock-summary-report',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=filter_label,
    )


def build_stock_movement(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    qs = InventoryTransaction.objects.filter(business=business)
    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    product_id = params.get('product') or params.get('product_id')
    filter_label = ''
    if product_id:
        qs = qs.filter(product_id=product_id)
        first_tx = qs.first()
        if first_tx and first_tx.product:
            filter_label = f"Product: {first_tx.product.name}"

    qs = qs.select_related('product').order_by('-created_at')[:500]

    rows = []
    tot_in = Decimal('0.00')
    tot_out = Decimal('0.00')

    for tx in qs:
        dt_str = format_datetime(tx.created_at)
        prod_name = tx.product.name if tx.product else '—'
        tx_type = (tx.transaction_type or 'ADJUSTMENT').upper()
        qty = tx.quantity or Decimal('0.00')
        before = tx.before_stock or Decimal('0.00')
        after = tx.after_stock or Decimal('0.00')
        cost = tx.unit_cost or Decimal('0.00')
        ref = tx.reference or (f"{tx.reference_type} #{tx.reference_id}" if tx.reference_type else '—')

        if qty >= 0:
            tot_in += qty
        else:
            tot_out += abs(qty)

        rows.append([
            dt_str,
            prod_name,
            tx_type,
            float(qty),
            float(before),
            float(after),
            float(cost),
            ref,
        ])

    headers = [
        'Date & Time', 'Product', 'Movement Type', 'Quantity',
        'Stock Before', 'Stock After', 'Unit Cost', 'Reference'
    ]

    summary_rows = [
        ('Total Inward Quantity', float(tot_in)),
        ('Total Outward Quantity', float(tot_out)),
        ('Net Movement Quantity', float(tot_in - tot_out)),
        ('Total Transactions', len(rows)),
    ]

    payload = {
        'period': period_label,
        'summary': {
            'inward': float(tot_in),
            'outward': float(tot_out),
            'net': float(tot_in - tot_out),
            'count': len(rows),
        },
        'rows': rows,
    }

    return ReportData(
        title='Stock Movement Report',
        filename='stock-movement-report',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=filter_label,
    )

