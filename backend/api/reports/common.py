from datetime import date, datetime, time, timedelta

from django.utils import timezone


def period(params):
    today = timezone.localdate()
    start = params.get('start_date') or str(today.replace(day=1))
    end = params.get('end_date') or str(today)
    return start, end


def report_format(params):
    value = params.get('export', '').lower()
    return value if value in {'pdf', 'xlsx'} else ''
