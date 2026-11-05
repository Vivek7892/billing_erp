from datetime import date, datetime
from django.utils import timezone


def format_date(val, fmt='%d-%b-%Y'):
    if not val:
        return ''
    if isinstance(val, str):
        try:
            val = datetime.strptime(val[:10], '%Y-%m-%d').date()
        except ValueError:
            return val
    if isinstance(val, (datetime, date)):
        return val.strftime(fmt)
    return str(val)


def format_datetime(val, fmt='%d-%b-%Y, %I:%M:%S %p'):
    if not val:
        return ''
    if isinstance(val, str):
        try:
            val = datetime.fromisoformat(val.replace('Z', '+00:00'))
        except ValueError:
            return val
    if hasattr(val, 'tzinfo') and val.tzinfo:
        val = timezone.localtime(val)
    if isinstance(val, (datetime, date)):
        return val.strftime(fmt)
    return str(val)


def parse_period_params(params):
    start = params.get('start_date') or params.get('from_date') or params.get('start')
    end = params.get('end_date') or params.get('to_date') or params.get('end')

    start_date = None
    end_date = None
    if start:
        try:
            start_date = datetime.strptime(str(start).strip()[:10], '%Y-%m-%d').date()
        except ValueError:
            pass
    if end:
        try:
            end_date = datetime.strptime(str(end).strip()[:10], '%Y-%m-%d').date()
        except ValueError:
            pass

    if not start_date and not end_date:
        today_str = format_date(date.today(), '%d-%b-%Y')
        label = f'All Available Records (as of {today_str})'
    elif start_date and end_date:
        if start_date == end_date:
            label = f"{format_date(start_date, '%d-%b-%Y')} (Full Day)"
        else:
            days = (end_date - start_date).days + 1
            label = f"{format_date(start_date, '%d-%b-%Y')} to {format_date(end_date, '%d-%b-%Y')} ({days} Days)"
    elif start_date:
        label = f"From {format_date(start_date, '%d-%b-%Y')} to Present"
    else:
        label = f"Up to {format_date(end_date, '%d-%b-%Y')}"

    return start_date, end_date, label
