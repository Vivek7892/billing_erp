from decimal import Decimal
from django.db.models import Count, Sum
from api.models import Purchase, PurchaseReturn
from .base_report import ReportData
from ..utils.date_formatter import format_date, parse_period_params


def build_purchase_register(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    qs = Purchase.objects.filter(business=business)
    if start_date:
        qs = qs.filter(purchase_date__gte=start_date)
    if end_date:
        qs = qs.filter(purchase_date__lte=end_date)

    supplier_id = params.get('supplier') or params.get('supplier_id')
    filter_label = ''
    if supplier_id:
        qs = qs.filter(supplier_id=supplier_id)
        first_p = qs.first()
        if first_p and first_p.supplier:
            filter_label = f"Supplier: {first_p.supplier.name}"

    qs = qs.select_related('supplier').order_by('purchase_date')

    rows = []
    tot_amount = Decimal('0.00')
    tot_paid = Decimal('0.00')
    tot_balance = Decimal('0.00')

    for p in qs:
        p_date = format_date(p.purchase_date)
        supp_name = p.supplier.name if p.supplier else 'Direct Supplier'
        gstin = getattr(p.supplier, 'gstin', '') if p.supplier else ''
        amt = p.total_amount or Decimal('0.00')
        paid = p.paid_amount or Decimal('0.00')
        bal = amt - paid
        status = (p.payment_status or 'UNPAID').upper()

        tot_amount += amt
        tot_paid += paid
        tot_balance += bal

        rows.append([
            p_date,
            p.invoice_number or f"PUR-{p.id}",
            supp_name,
            gstin or '—',
            float(amt),
            float(paid),
            float(bal),
            status,
        ])

    headers = [
        'Date', 'Bill No.', 'Supplier Name', 'GSTIN',
        'Total Amount', 'Paid Amount', 'Balance Due', 'Status'
    ]

    summary_rows = [
        ('Total Purchases', len(rows)),
        ('Total Invoiced Amount', float(tot_amount)),
        ('Total Paid Amount', float(tot_paid)),
        ('Total Balance Due', float(tot_balance)),
    ]

    payload = {
        'period': period_label,
        'summary': {
            'count': len(rows),
            'total_amount': float(tot_amount),
            'paid_amount': float(tot_paid),
            'balance_due': float(tot_balance),
        },
        'rows': rows,
    }

    return ReportData(
        title='Purchase Register',
        filename='purchase-register',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=filter_label,
    )


def build_purchase_summary(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    qs = Purchase.objects.filter(business=business)
    if start_date:
        qs = qs.filter(purchase_date__gte=start_date)
    if end_date:
        qs = qs.filter(purchase_date__lte=end_date)

    summary = qs.aggregate(
        total_purchases=Sum('total_amount'),
        total_paid=Sum('paid_amount'),
        count=Count('id'),
    )
    total_purchases = summary['total_purchases'] or Decimal('0.00')
    total_paid = summary['total_paid'] or Decimal('0.00')
    balance_due = total_purchases - total_paid

    returns_qs = PurchaseReturn.objects.filter(business=business)
    if start_date:
        returns_qs = returns_qs.filter(created_at__date__gte=start_date)
    if end_date:
        returns_qs = returns_qs.filter(created_at__date__lte=end_date)
    returns_total = returns_qs.aggregate(total=Sum('debit_amount'))['total'] or Decimal('0.00')

    daily = list(qs.values('purchase_date').annotate(
        total=Sum('total_amount'), count=Count('id'),
    ).order_by('purchase_date'))

    rows = [[format_date(row['purchase_date']), int(row['count'] or 0), float(row['total'] or 0)] for row in daily]

    summary_rows = [
        ('Gross Purchases', float(total_purchases)),
        ('Total Paid to Suppliers', float(total_paid)),
        ('Purchase Returns', float(returns_total)),
        ('Net Purchases', float(total_purchases - returns_total)),
        ('Outstanding Payables', float(balance_due)),
        ('Purchase Invoices Count', int(summary['count'] or 0)),
    ]

    return ReportData(
        title='Purchase Summary Report',
        filename='purchase-summary-report',
        payload={
            'summary': {
                'total_purchases': float(total_purchases),
                'total_paid': float(total_paid),
                'balance_due': float(balance_due),
                'returns': float(returns_total),
                'count': int(summary['count'] or 0),
            },
            'daily': rows,
        },
        headers=['Date', 'Purchase Count', 'Total Purchases'],
        rows=rows,
        summary_rows=summary_rows,
    )


def build_item_wise_purchases(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    from api.models import PurchaseItem
    qs = PurchaseItem.objects.filter(purchase__business=business)
    if start_date:
        qs = qs.filter(purchase__purchase_date__gte=start_date)
    if end_date:
        qs = qs.filter(purchase__purchase_date__lte=end_date)

    supplier_id = params.get('supplier') or params.get('supplier_id')
    filter_label = ''
    if supplier_id:
        qs = qs.filter(purchase__supplier_id=supplier_id)
        first_item = qs.first()
        if first_item and first_item.purchase and first_item.purchase.supplier:
            filter_label = f"Supplier: {first_item.purchase.supplier.name}"

    raw_data = list(
        qs.values('product__name', 'product__sku', 'product__unit')
        .annotate(
            total_qty=Sum('quantity'),
            total_amt=Sum('total'),
        )
        .order_by('-total_amt')
    )

    rows = []
    tot_qty = Decimal('0.00')
    tot_amt = Decimal('0.00')

    for r in raw_data:
        p_name = r['product__name'] or 'Unknown Item'
        sku = r['product__sku'] or '—'
        unit = r['product__unit'] or 'pcs'
        qty = r['total_qty'] or Decimal('0.00')
        amt = r['total_amt'] or Decimal('0.00')
        avg_cost = (amt / qty) if qty > 0 else Decimal('0.00')

        tot_qty += qty
        tot_amt += amt

        rows.append([
            p_name,
            sku,
            unit,
            float(qty),
            float(avg_cost),
            float(amt),
        ])

    headers = [
        'Product Name', 'SKU / Code', 'Unit', 'Qty Purchased',
        'Avg Cost Price', 'Total Purchase Amount'
    ]

    summary_rows = [
        ('Distinct Items Purchased', len(rows)),
        ('Total Quantity Purchased', float(tot_qty)),
        ('Total Purchase Expenditure', float(tot_amt)),
    ]

    payload = {
        'period': period_label,
        'summary': {
            'distinct_items': len(rows),
            'total_qty': float(tot_qty),
            'total_amount': float(tot_amt),
        },
        'rows': rows,
    }

    return ReportData(
        title='Item-Wise Purchase Report',
        filename='item-wise-purchase-report',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=filter_label,
    )
