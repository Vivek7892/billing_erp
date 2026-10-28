from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from ..models import Invoice, Payment, RazorpayTransaction
from . import ReportData
from .common import period


def build(business, params):
    start, end = period(params)
    exception_type = (params.get('exception_type') or 'all').strip().lower()

    exceptions = []
    gateway_count = 0
    mismatch_count = 0
    cancelled_with_funds_count = 0
    overdue_count = 0
    total_discrepancy = Decimal('0')

    # 1. Gateway Exceptions (Razorpay transactions that failed or remain uncaptured)
    if exception_type in ('all', 'gateway'):
        gw_qs = (
            RazorpayTransaction.objects.filter(
                business=business,
                created_at__date__gte=start,
                created_at__date__lte=end,
                status__in=['failed', 'created', 'authorized'],
            )
            .select_related('invoice')
            .order_by('-created_at')[:200]
        )

        for tx in gw_qs:
            gateway_count += 1
            amt = Decimal(str(tx.amount or 0))
            total_discrepancy += amt
            inv_num = tx.invoice.invoice_number if tx.invoice else (tx.merchant_transaction_id or '—')
            cust = (
                (tx.invoice.customer.name if tx.invoice.customer else tx.invoice.customer_name)
                if tx.invoice
                else '—'
            )
            date_str = tx.created_at.strftime('%d/%b/%Y %H:%M') if tx.created_at else '—'
            reason = tx.failure_reason or (f'Pending status: {tx.status}')
            exceptions.append({
                'id': f'GW-{tx.id}',
                'date': date_str,
                'category': 'Gateway Failure / Pending',
                'reference': tx.razorpay_payment_id or tx.razorpay_order_id or tx.merchant_transaction_id or str(tx.id),
                'entity_type': 'Gateway Transaction',
                'customer': cust,
                'expected_amount': float(amt),
                'actual_amount': 0.0,
                'discrepancy': float(amt),
                'status': tx.status.upper(),
                'severity': 'HIGH' if tx.status == 'failed' else 'MEDIUM',
                'details': f'Gateway {tx.status.upper()}: {reason} (Inv #{inv_num})',
            })

    # 2. Payment vs Invoice Balance Mismatches & Cancelled Invoices with Active Funds
    if exception_type in ('all', 'mismatch', 'cancelled_funds'):
        invoices_qs = (
            Invoice.objects.filter(
                business=business,
                created_at__date__gte=start,
                created_at__date__lte=end,
            )
            .select_related('customer')
            .prefetch_related('payments')
            .order_by('-created_at')[:300]
        )

        for inv in invoices_qs:
            grand_total = Decimal(str(inv.grand_total or 0))
            paid_amount = Decimal(str(inv.paid_amount or 0))
            balance_due = Decimal(str(inv.balance_due or 0))
            actual_payment_sum = inv.payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')
            cust = inv.customer.name if inv.customer else (inv.customer_name or 'Walk-in')
            date_str = inv.created_at.strftime('%d/%b/%Y') if inv.created_at else '—'

            # A. Cancelled invoice with recorded payments or paid_amount > 0
            if inv.status in ('cancelled', 'refunded'):
                if actual_payment_sum > 0 or paid_amount > 0:
                    if exception_type in ('all', 'cancelled_funds'):
                        cancelled_with_funds_count += 1
                        reversal_needed = max(actual_payment_sum, paid_amount)
                        total_discrepancy += reversal_needed
                        exceptions.append({
                            'id': f'INV-REV-{inv.id}',
                            'date': date_str,
                            'category': 'Cancelled with Active Funds',
                            'reference': inv.invoice_number,
                            'entity_type': 'Invoice',
                            'customer': cust,
                            'expected_amount': 0.0,
                            'actual_amount': float(reversal_needed),
                            'discrepancy': float(reversal_needed),
                            'status': inv.status.upper(),
                            'severity': 'HIGH',
                            'details': f'Invoice is {inv.status.upper()} but holds recorded payments of INR {reversal_needed:.2f}. Refund / reconciliation required.',
                        })
            else:
                # B. Non-cancelled invoice: check arithmetic integrity
                # Discrepancy between invoice paid_amount and sum of Payment records
                diff_recorded = abs(paid_amount - actual_payment_sum)
                if diff_recorded > Decimal('0.05') and exception_type in ('all', 'mismatch'):
                    mismatch_count += 1
                    total_discrepancy += diff_recorded
                    exceptions.append({
                        'id': f'INV-DIFF-{inv.id}',
                        'date': date_str,
                        'category': 'Payment Audit Variance',
                        'reference': inv.invoice_number,
                        'entity_type': 'Invoice',
                        'customer': cust,
                        'expected_amount': float(actual_payment_sum),
                        'actual_amount': float(paid_amount),
                        'discrepancy': float(diff_recorded),
                        'status': inv.status.upper(),
                        'severity': 'MEDIUM',
                        'details': f'Invoice header paid_amount ({paid_amount:.2f}) does not match line payment records ({actual_payment_sum:.2f}).',
                    })

                # Discrepancy between grand_total and paid_amount + balance_due
                calc_total = paid_amount + balance_due
                diff_total = abs(grand_total - calc_total)
                if diff_total > Decimal('0.05') and exception_type in ('all', 'mismatch'):
                    mismatch_count += 1
                    total_discrepancy += diff_total
                    exceptions.append({
                        'id': f'INV-BAL-{inv.id}',
                        'date': date_str,
                        'category': 'Balance Computation Mismatch',
                        'reference': inv.invoice_number,
                        'entity_type': 'Invoice',
                        'customer': cust,
                        'expected_amount': float(grand_total),
                        'actual_amount': float(calc_total),
                        'discrepancy': float(diff_total),
                        'status': inv.status.upper(),
                        'severity': 'HIGH',
                        'details': f'Grand total ({grand_total:.2f}) differs from Paid ({paid_amount:.2f}) + Due ({balance_due:.2f}).',
                    })

    # 3. Uncollected Overdue Credit Sales (older than 30 days or substantial balance)
    if exception_type in ('all', 'overdue'):
        cutoff_date = (timezone.now() - timezone.timedelta(days=30)).date()
        overdue_qs = (
            Invoice.objects.filter(
                business=business,
                status='completed',
                balance_due__gt=0,
                created_at__date__lt=cutoff_date,
                created_at__date__gte=start,
            )
            .select_related('customer')
            .order_by('created_at')[:100]
        )

        for inv in overdue_qs:
            overdue_count += 1
            bal = Decimal(str(inv.balance_due or 0))
            cust = inv.customer.name if inv.customer else (inv.customer_name or 'Walk-in')
            date_str = inv.created_at.strftime('%d/%b/%Y') if inv.created_at else '—'
            days_overdue = (timezone.now().date() - inv.created_at.date()).days
            exceptions.append({
                'id': f'INV-DUE-{inv.id}',
                'date': date_str,
                'category': 'Aged Receivables (>30d)',
                'reference': inv.invoice_number,
                'entity_type': 'Invoice',
                'customer': cust,
                'expected_amount': float(bal),
                'actual_amount': 0.0,
                'discrepancy': float(bal),
                'status': 'OVERDUE',
                'severity': 'LOW' if days_overdue < 60 else 'MEDIUM',
                'details': f'Unsettled balance of INR {bal:.2f} outstanding for {days_overdue} days.',
            })

    total_count = len(exceptions)

    payload = {
        'exceptions': exceptions,
        'results': exceptions,
        'count': total_count,
        'gateway_count': gateway_count,
        'mismatch_count': mismatch_count,
        'cancelled_with_funds_count': cancelled_with_funds_count,
        'overdue_count': overdue_count,
        'total_discrepancy_amount': float(total_discrepancy),
        'period_start': str(start),
        'period_end': str(end),
        'clean': total_count == 0,
        'message': (
            'No reconciliation exceptions found for the selected filters.'
            if total_count == 0
            else f'Identified {total_count} reconciliation exceptions requiring auditor review.'
        ),
    }

    headers = [
        'Date',
        'Category',
        'Reference',
        'Entity',
        'Customer',
        'Expected (INR)',
        'Recorded (INR)',
        'Discrepancy (INR)',
        'Severity',
        'Audit Findings',
    ]

    rows = [
        [
            ex['date'],
            ex['category'],
            ex['reference'],
            ex['entity_type'],
            ex['customer'],
            f"{ex['expected_amount']:,.2f}",
            f"{ex['actual_amount']:,.2f}",
            f"{ex['discrepancy']:,.2f}",
            ex['severity'],
            ex['details'],
        ]
        for ex in exceptions
    ]

    summary_rows = [
        ['Total Audit Exceptions', str(total_count)],
        ['Gateway Errors / Pending', str(gateway_count)],
        ['Payment / Balance Mismatches', str(mismatch_count)],
        ['Cancelled Invoices with Active Funds', str(cancelled_with_funds_count)],
        ['Aged Uncollected Balances (>30d)', str(overdue_count)],
        ['Total Audited Discrepancy Amount', f'INR {float(total_discrepancy):,.2f}'],
    ]

    return ReportData(
        title='Reconciliation & Audit Exceptions Report',
        filename=f'reconciliation_exceptions_{start}_{end}.pdf',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )
