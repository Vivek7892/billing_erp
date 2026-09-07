from django.db.models import Count, Sum

from ..models import Payment
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    data = list(Payment.objects.filter(invoice__business=business, invoice__created_at__date__gte=start, invoice__created_at__date__lte=end, invoice__status='completed', invoice__payment_status__in=['paid', 'partial']).values('method').annotate(total=Sum('amount'), count=Count('id')))
    return ReportData('Payment Report', 'payment-report', data, ['Method', 'Count', 'Total'], [[row['method'], row['count'], row['total']] for row in data])
