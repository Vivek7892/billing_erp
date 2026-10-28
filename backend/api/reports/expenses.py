from django.db.models import Avg, Count, Sum

from ..models import Expense
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    expenses = (
        Expense.objects.filter(
            business=business,
            expense_date__gte=start,
            expense_date__lte=end,
        )
        .select_related('category', 'created_by')
        .order_by('-expense_date')
    )

    summary = expenses.aggregate(
        total_amount=Sum('amount'),
        count=Count('id'),
        avg_amount=Avg('amount'),
    )

    by_category_qs = list(
        expenses.values('category__name')
        .annotate(total=Sum('amount'), count=Count('id'))
        .order_by('-total')
    )

    categories = [
        {
            'category': row['category__name'] or 'Uncategorised',
            'name': row['category__name'] or 'Uncategorised',
            'category__name': row['category__name'] or 'Uncategorised',
            'count': int(row['count'] or 0),
            'total': float(row['total'] or 0),
        }
        for row in by_category_qs
    ]

    expense_list = []
    for exp in expenses:
        creator = (
            (exp.created_by.get_full_name() or exp.created_by.username)
            if exp.created_by
            else '—'
        )
        cat_name = exp.category.name if exp.category else 'Uncategorised'
        method_name = (exp.payment_method or '—').replace('_', ' ').title()
        amt = float(exp.amount or 0)

        expense_list.append({
            'id': exp.id,
            'expense_date': str(exp.expense_date),
            'description': exp.description or '—',
            'category': cat_name,
            'category__name': cat_name,
            'payment_method': method_name,
            'amount': amt,
            'created_by': creator,
            'notes': exp.notes or '',
        })

    total_amount = float(summary['total_amount'] or 0)
    total_count = int(summary['count'] or 0)
    avg_amount = round(float(summary['avg_amount'] or 0), 2)

    payload = {
        'expenses': expense_list,
        'by_category': categories,
        'categories': categories,
        'total_expenses': total_amount,
        'summary': {
            'total_amount': total_amount,
            'count': total_count,
            'avg_amount': avg_amount,
        },
    }

    headers = ['Date', 'Description', 'Category', 'Payment Method', 'Amount', 'Recorded By', 'Notes']
    rows = [
        [
            r['expense_date'],
            r['description'],
            r['category'],
            r['payment_method'],
            r['amount'],
            r['created_by'],
            r['notes'],
        ]
        for r in expense_list
    ]
    summary_rows = [
        ('Total Operating Expenses', total_amount),
        ('Total Expense Entries', total_count),
        ('Average per Entry', avg_amount),
    ]

    return ReportData(
        'Operating Expenses Report',
        'operating-expenses-report',
        payload,
        headers,
        rows,
        summary_rows,
    )
