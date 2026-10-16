from decimal import Decimal

from django.db.models import Sum

from ..models import Customer
from . import ReportData


def build(business, params):
    customers = list(
        Customer.objects.filter(business=business, outstanding_amount__gt=0)
        .values('id', 'name', 'mobile', 'outstanding_amount', 'credit_limit')
        .order_by('-outstanding_amount')
    )
    total = (
        Customer.objects.filter(business=business).aggregate(
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

    total_outstanding = float(total)
    payload = {
        'customers': customer_rows,
        'results': customer_rows,
        'total_outstanding': total_outstanding,
        'count': len(customer_rows),
    }

    headers = [
        'Customer Name',
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
    ]

    return ReportData(
        'Customer Receivables Report',
        'customer-receivables-report',
        payload,
        headers,
        rows,
        summary_rows,
    )
