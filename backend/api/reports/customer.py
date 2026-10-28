from decimal import Decimal

from django.db.models import Sum

from ..models import Customer, CustomerPayment
from . import ReportData


def build(business, params):
    customers = list(
        Customer.objects.filter(business=business, outstanding_amount__gt=0)
        .values('id', 'name', 'mobile', 'outstanding_amount', 'credit_limit')
        .order_by('-outstanding_amount')
    )
    total = (
        Customer.objects.filter(business=business, outstanding_amount__gt=0).aggregate(
            total=Sum('outstanding_amount')
        )['total']
        or Decimal('0')
    )

    customer_rows = [
        {
            'id': row['id'],
            'name': row['name'] or 'Customer',
            'mobile': row['mobile'] or '—',
            'outstanding_amount': float(row['outstanding_amount'] or 0),
            'credit_limit': float(row['credit_limit'] or 0),
        }
        for row in customers
    ]

    # Customer receivable collections (Who gave, Who collected, When collected)
    collections_qs = CustomerPayment.objects.filter(
        business=business
    ).select_related('customer', 'created_by', 'invoice').order_by('-created_at')[:100]

    collections_data = [
        {
            'id': col.id,
            'who_gave': col.customer.name if col.customer else 'Customer',
            'who_gave_phone': col.customer.mobile if col.customer and col.customer.mobile else '—',
            'who_collected': col.created_by.get_full_name() or col.created_by.username if col.created_by else 'Staff',
            'amount': float(col.amount),
            'method': (col.method or 'cash').upper(),
            'reference': col.reference or f'TXN-COL-{col.id}',
            'invoice_number': col.invoice.invoice_number if col.invoice else 'Direct Khata',
            'notes': col.notes or '',
            'created_at': col.created_at.isoformat() if col.created_at else '',
            'date_time': col.created_at.strftime('%d %b %Y, %I:%M %p') if col.created_at else '',
        }
        for col in collections_qs
    ]

    total_outstanding = float(total)
    total_collected_amount = round(sum(c['amount'] for c in collections_data), 2)

    payload = {
        'customers': customer_rows,
        'results': customer_rows,
        'collections': collections_data,
        'total_outstanding': total_outstanding,
        'total_collected_amount': total_collected_amount,
        'count': len(customer_rows),
    }

    headers = [
        'Customer Name (Who Gave)',
        'Mobile Number',
        'Credit Limit',
        'Outstanding Balance',
    ]
    rows = [
        [c['name'], c['mobile'], c['credit_limit'], c['outstanding_amount']]
        for c in customer_rows
    ]
    summary_rows = [
        ('Total Outstanding Receivables', total_outstanding),
        ('Customers with Due Balance', len(customer_rows)),
        ('Recent Collections Count', len(collections_data)),
        ('Recent Collections Total', total_collected_amount),
    ]

    return ReportData(
        'Customer Receivables Report',
        'customer-receivables-report',
        payload,
        headers,
        rows,
        summary_rows,
    )
