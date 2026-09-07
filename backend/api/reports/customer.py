from django.db.models import Sum

from ..models import Customer
from . import ReportData


def build(business, params):
    customers = list(Customer.objects.filter(business=business, outstanding_amount__gt=0).values('id', 'name', 'mobile', 'outstanding_amount', 'credit_limit'))
    total = Customer.objects.filter(business=business).aggregate(total=Sum('outstanding_amount'))['total'] or 0
    rows = [[row['name'], row['mobile'], row['outstanding_amount'], row['credit_limit']] for row in customers]
    return ReportData('Customer Credit Report', 'customer-credit-report', {'customers': customers, 'total_outstanding': float(total)}, ['Customer', 'Mobile', 'Outstanding', 'Credit Limit'], rows, [('Total Outstanding', total)])
