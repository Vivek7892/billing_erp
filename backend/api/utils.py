import random
import string
import json
from django.utils import timezone
from datetime import timedelta


def get_next_invoice_number(business=None):
    from django.db import connection
    from .models import Setting, Invoice
    # Lock the setting row while an invoice is being created.  The caller is
    # already inside transaction.atomic(), so the displayed "Next" number and
    # the issued invoice cannot drift apart on a normal sale.
    qs = Setting.objects.filter(business=business)
    if connection.in_atomic_block:
        qs = qs.select_for_update()
    prefix_setting = qs.filter(key='invoice_prefix').first()
    raw_prefix = (prefix_setting.value if prefix_setting else 'INV').strip() or 'INV'
    separator = '' if raw_prefix.endswith(('-', '/', '_')) else '-'
    prefix = raw_prefix + separator
    start_setting = qs.filter(key='invoice_start_number').first()
    try:
        configured_next = max(1, int((start_setting.value if start_setting else '1001').strip()))
    except (TypeError, ValueError):
        configured_next = 1001

    # Only invoices with the active prefix participate.  This lets a business
    # start a new sequence after changing its prefix without colliding with an
    # older series.
    highest_issued = 0
    for number in Invoice.objects.filter(business=business, invoice_number__startswith=prefix).values_list('invoice_number', flat=True):
        try:
            highest_issued = max(highest_issued, int(number[len(prefix):]))
        except (TypeError, ValueError):
            continue
    next_num = max(configured_next, highest_issued + 1)
    Setting.objects.update_or_create(
        business=business,
        key='invoice_start_number',
        defaults={'value': str(next_num + 1)},
    )
    return f"{prefix}{next_num:04d}"


def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))


def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def audit(request, action, module='', entity='', entity_id='', prev='', new='', result='success', reason=''):
    from .models import AuditLog
    user = request.user if request.user.is_authenticated else None
    business = getattr(user, 'business', None) if user else None
    AuditLog.objects.create(
        user=user,
        business=business,
        action=action,
        module=module,
        entity=entity,
        entity_id=str(entity_id),
        previous_value=str(prev),
        new_value=str(new),
        ip_address=get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
        result=result,
        failure_reason=reason,
    )


def audit_event(request, event, entity_type='', entity_id='', before=None, after=None, metadata=None, reason='', entity_name='', result='success', user=None, business=None):
    """Record a named business event without changing legacy audit callers."""
    from .models import AuditLog

    if not user:
        user = request.user if (request and getattr(request, 'user', None) and request.user.is_authenticated) else None
    if not business:
        business = getattr(user, 'business', None) if user else None
        if not business and request and hasattr(request, 'business'):
            business = request.business

    previous = json.dumps(before, default=str) if before is not None else ''
    current = json.dumps(after, default=str) if after is not None else ''

    ip = get_client_ip(request) if request else '127.0.0.1'
    ua = request.META.get('HTTP_USER_AGENT', '')[:500] if (request and hasattr(request, 'META')) else ''

    name = str(entity_name or '')
    if not name and isinstance(after, dict):
        name = after.get('invoice_number') or after.get('name') or after.get('sku') or ''
    elif not name and isinstance(before, dict):
        name = before.get('invoice_number') or before.get('name') or before.get('sku') or ''

    rec = AuditLog.objects.create(
        user=user,
        business=business,
        action=event,
        module=entity_type.lower(),
        entity=entity_type,
        entity_id=str(entity_id),
        entity_name=name,
        previous_value=previous,
        new_value=current,
        reason=str(reason or ''),
        ip_address=ip,
        user_agent=ua,
        result=result,
        failure_reason=str(reason) if result == 'failure' else '',
    )

    legacy_events = {
        'INVOICE_CREATED': ('create', 'invoices'),
        'INVOICE_CANCELLED': ('cancel', 'invoices'),
        'INVOICE_REFUNDED': ('refund', 'invoices'),
        'PAYMENT_RECEIVED': ('create', 'payments'),
        'STOCK_ADJUSTED': ('adjust', 'inventory'),
        'PURCHASE_CREATED': ('create', 'purchases'),
        'SALES_RETURN_CREATED': ('create', 'returns'),
        'PURCHASE_RETURN_CREATED': ('create', 'returns'),
        'SETTINGS_CHANGED': ('update', 'settings'),
        'PRODUCT_CREATED': ('create', 'products'),
        'PRODUCT_UPDATED': ('update', 'products'),
        'PRODUCT_ARCHIVED': ('archive', 'products'),
        'USER_CREATED': ('create', 'users'),
        'EXPENSE_CREATED': ('create', 'expenses'),
    }
    legacy = legacy_events.get(event)
    if legacy:
        AuditLog.objects.create(
            user=user,
            business=business,
            action=legacy[0],
            module=legacy[1],
            entity=entity_type,
            entity_id=str(entity_id),
            entity_name=name,
            previous_value=previous,
            new_value=current,
            reason=str(reason or ''),
            ip_address=ip,
            user_agent=ua,
            result='success',
        )
    return rec


