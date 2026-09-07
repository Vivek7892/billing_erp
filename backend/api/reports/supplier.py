from django.db.models import Sum

from ..models import Supplier
from . import ReportData


def build(business, params):
    suppliers = list(Supplier.objects.filter(business=business).values('id', 'name', 'phone', 'outstanding_amount').order_by('name'))
    rows = [[row['name'], row['phone'], row['outstanding_amount']] for row in suppliers]
    total = Supplier.objects.filter(business=business).aggregate(total=Sum('outstanding_amount'))['total'] or 0
    return ReportData('Supplier Outstanding Report', 'supplier-report', {'suppliers': suppliers, 'total_outstanding': float(total)}, ['Supplier', 'Phone', 'Outstanding'], rows, [('Total Outstanding', total)])
