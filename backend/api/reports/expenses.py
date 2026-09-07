from django.db.models import Avg, Count, Sum

from ..models import Expense
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    expenses = Expense.objects.filter(business=business, expense_date__gte=start, expense_date__lte=end).order_by('-expense_date')
    summary = expenses.aggregate(total_amount=Sum('amount'), count=Count('id'), avg_amount=Avg('amount'))
    by_category = list(expenses.values('category__name').annotate(total=Sum('amount'), count=Count('id')).order_by('-total'))
    for row in by_category:
        row['category'] = row.pop('category__name') or 'Uncategorised'
    expense_list = list(expenses.values('expense_date', 'description', 'amount', 'payment_method', 'category__name', 'notes'))
    for row in expense_list:
        row['category'] = row.pop('category__name') or ''
    payload = {'expenses': expense_list, 'summary': {'total_amount': float(summary['total_amount'] or 0), 'count': summary['count'] or 0, 'avg_amount': round(float(summary['avg_amount'] or 0), 2)}, 'by_category': by_category}
    rows = [[str(row['expense_date']), row['description'], row['category'], row['payment_method'], row['amount']] for row in expense_list]
    cards = [('Total Expenses', summary['total_amount'] or 0), ('Number of Entries', summary['count'] or 0), ('Average per Entry', round(summary['avg_amount'] or 0, 2))]
    return ReportData('Expenses Report', 'expenses-report', payload, ['Date', 'Description', 'Category', 'Method', 'Amount'], rows, cards)
