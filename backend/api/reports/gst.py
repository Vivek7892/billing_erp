from django.db.models import F, Sum

from ..models import InvoiceItem
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    data = list(
        InvoiceItem.objects.filter(
            invoice__business=business,
            invoice__created_at__date__gte=start,
            invoice__created_at__date__lte=end,
            invoice__status='completed',
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

    payload = {
        'by_rate': rates,
        'rates': rates,
        'total_taxable': total_taxable,
        'total_cgst': total_cgst,
        'total_sgst': total_sgst,
        'total_tax': total_tax,
        'total_gst': total_tax,
    }

    headers = [
        'GST Rate Slab',
        'Taxable Turnover',
        'Output CGST',
        'Output SGST',
        'Total GST Tax',
    ]
    rows = [
        [
            f"{int(r['gst_percent']) if float(r['gst_percent']).is_integer() else r['gst_percent']}% GST",
            r['taxable'],
            r['cgst'],
            r['sgst'],
            r['tax'],
        ]
        for r in rates
    ]
    summary_rows = [
        ('Taxable Turnover', total_taxable),
        ('Output CGST', total_cgst),
        ('Output SGST', total_sgst),
        ('Total Output GST Tax', total_tax),
    ]

    return ReportData(
        'GST Tax Summary Report',
        'gst-tax-summary-report',
        payload,
        headers,
        rows,
        summary_rows,
    )
