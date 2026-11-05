from dataclasses import replace
from decimal import Decimal
from django.db.models import F, Sum
from api.models import Invoice, InvoiceItem, Purchase
from .base_report import ReportData
from ..utils.date_formatter import format_date, parse_period_params


def build_gstr1(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    invoices = Invoice.objects.filter(business=business, status='completed')
    if start_date:
        invoices = invoices.filter(created_at__date__gte=start_date)
    if end_date:
        invoices = invoices.filter(created_at__date__lte=end_date)

    invoices = invoices.select_related('customer').order_by('created_at')

    rows = []
    tot_taxable = Decimal('0.00')
    tot_cgst = Decimal('0.00')
    tot_sgst = Decimal('0.00')
    tot_igst = Decimal('0.00')
    tot_grand = Decimal('0.00')

    for inv in invoices:
        inv_date = format_date(inv.created_at.date() if hasattr(inv.created_at, 'date') else inv.created_at)
        cust_name = inv.customer_name or (inv.customer.name if inv.customer else 'Consumer')
        gstin = getattr(inv.customer, 'gstin', '') if inv.customer else ''
        pos = inv.place_of_supply or 'Intrastate'
        taxable = inv.subtotal or Decimal('0.00')
        tax = inv.tax_amount or Decimal('0.00')
        grand = inv.grand_total or Decimal('0.00')

        # Split tax between CGST/SGST (intrastate) or IGST (interstate)
        is_interstate = 'inter' in pos.lower()
        if is_interstate:
            cgst = Decimal('0.00')
            sgst = Decimal('0.00')
            igst = tax
        else:
            cgst = (tax / Decimal('2.0')).quantize(Decimal('0.01'))
            sgst = tax - cgst
            igst = Decimal('0.00')

        tot_taxable += taxable
        tot_cgst += cgst
        tot_sgst += sgst
        tot_igst += igst
        tot_grand += grand

        rows.append([
            inv.invoice_number,
            inv_date,
            cust_name,
            gstin or '—',
            pos,
            float(taxable),
            float(cgst),
            float(sgst),
            float(igst),
            float(grand),
        ])

    headers = [
        'Invoice No.', 'Date', 'Customer Name', 'GSTIN', 'Place of Supply',
        'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Invoice Value'
    ]

    summary_rows = [
        ('Total Invoices', len(rows)),
        ('Total Taxable Value', float(tot_taxable)),
        ('Total CGST', float(tot_cgst)),
        ('Total SGST', float(tot_sgst)),
        ('Total IGST', float(tot_igst)),
        ('Total Tax Liability', float(tot_cgst + tot_sgst + tot_igst)),
        ('Total Invoiced Value', float(tot_grand)),
    ]

    payload = {
        'period': period_label,
        'summary': {
            'count': len(rows),
            'taxable_value': float(tot_taxable),
            'cgst': float(tot_cgst),
            'sgst': float(tot_sgst),
            'igst': float(tot_igst),
            'grand_total': float(tot_grand),
        },
        'rows': rows,
    }

    return ReportData(
        title='GST GSTR-1 Outward Supplies Report',
        filename='gstr1-report',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_gstr2(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    purchases = Purchase.objects.filter(business=business)
    if start_date:
        purchases = purchases.filter(purchase_date__gte=start_date)
    if end_date:
        purchases = purchases.filter(purchase_date__lte=end_date)

    purchases = purchases.select_related('supplier').order_by('purchase_date')

    rows = []
    tot_taxable = Decimal('0.00')
    tot_tax = Decimal('0.00')
    tot_grand = Decimal('0.00')

    for p in purchases:
        p_date = format_date(p.purchase_date)
        supp_name = p.supplier.name if p.supplier else 'Supplier'
        gstin = getattr(p.supplier, 'gstin', '') if p.supplier else ''
        grand = p.total_amount or Decimal('0.00')
        # Standard estimation: taxable ~ grand / 1.18, tax ~ remainder (or if explicit)
        taxable = (grand / Decimal('1.18')).quantize(Decimal('0.01'))
        tax = grand - taxable

        tot_taxable += taxable
        tot_tax += tax
        tot_grand += grand

        rows.append([
            p.invoice_number or f"PUR-{p.id}",
            p_date,
            supp_name,
            gstin or '—',
            float(taxable),
            float(tax),
            float(grand),
        ])

    headers = [
        'Bill / Invoice No.', 'Date', 'Supplier Name', 'GSTIN',
        'Taxable Value', 'Input Tax Credit (ITC)', 'Total Bill Amount'
    ]

    summary_rows = [
        ('Purchase Bills', len(rows)),
        ('Total Inward Taxable Value', float(tot_taxable)),
        ('Total Input Tax Credit (ITC)', float(tot_tax)),
        ('Total Purchases Value', float(tot_grand)),
    ]

    payload = {
        'period': period_label,
        'summary': {
            'count': len(rows),
            'taxable_value': float(tot_taxable),
            'itc': float(tot_tax),
            'grand_total': float(tot_grand),
        },
        'rows': rows,
    }

    return ReportData(
        title='GST GSTR-2 Inward Supplies (ITC) Report',
        filename='gstr2-report',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_gstr3b(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    data = list(
        InvoiceItem.objects.filter(
            invoice__business=business,
            invoice__status='completed',
            **({'invoice__created_at__date__gte': start_date} if start_date else {}),
            **({'invoice__created_at__date__lte': end_date} if end_date else {}),
        )
        .values('gst_percent')
        .annotate(
            taxable_amount=Sum(F('total') - F('gst_amount')),
            gst_collected=Sum('gst_amount'),
        )
        .order_by('gst_percent')
    )

    rates = []
    for row in data:
        pct = float(row['gst_percent'] or 0)
        taxable = round(float(row['taxable_amount'] or 0), 2)
        tax = round(float(row['gst_collected'] or 0), 2)
        cgst = round(tax / 2, 2)
        sgst = round(tax / 2, 2)
        rates.append({
            'gst_percent': pct,
            'taxable_amount': taxable,
            'taxable': taxable,
            'gst_collected': tax,
            'tax': tax,
            'cgst': cgst,
            'sgst': sgst,
        })

    total_taxable = round(sum(r['taxable'] for r in rates), 2)
    total_tax = round(sum(r['tax'] for r in rates), 2)
    total_cgst = round(sum(r['cgst'] for r in rates), 2)
    total_sgst = round(sum(r['sgst'] for r in rates), 2)

    rows = []
    for r in rates:
        rows.append([
            f"{r['gst_percent']:.1f}% Slab",
            r['taxable'],
            r['cgst'],
            r['sgst'],
            r['tax'],
        ])

    headers = ['GST Rate Slab', 'Taxable Turnover', 'Output CGST', 'Output SGST', 'Total GST Liability']
    summary_rows = [
        ('Total Taxable Turnover', total_taxable),
        ('Total Central GST (CGST)', total_cgst),
        ('Total State GST (SGST)', total_sgst),
        ('Total Tax Liability', total_tax),
    ]

    payload = {
        'period': period_label,
        'by_rate': rates,
        'total_taxable': total_taxable,
        'total_cgst': total_cgst,
        'total_sgst': total_sgst,
        'total_tax': total_tax,
        'rows': rows,
    }

    return ReportData(
        title='GST GSTR-3B Summary Report',
        filename='gstr3b-report',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_gst_summary(business, params):
    report = build_gstr3b(business, params)
    return replace(report, title='GST Summary Report', filename='gst-summary-report')

