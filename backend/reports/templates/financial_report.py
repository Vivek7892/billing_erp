from decimal import Decimal
from django.db.models import Sum
from api.models import (
    Customer,
    CustomerPayment,
    Expense,
    ExpenseCategory,
    Invoice,
    Payment,
    Product,
    Purchase,
    SalesReturn,
    Supplier,
    SupplierPayment,
)
from .base_report import ReportData
from ..utils.date_formatter import format_date, format_datetime, parse_period_params


def build_day_book(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    entries = []

    # 1. Invoices
    inv_qs = Invoice.objects.filter(business=business, status='completed')
    if start_date:
        inv_qs = inv_qs.filter(created_at__date__gte=start_date)
    if end_date:
        inv_qs = inv_qs.filter(created_at__date__lte=end_date)
    for inv in inv_qs:
        entries.append({
            'time': inv.created_at,
            'type': 'SALES INVOICE',
            'voucher_no': inv.invoice_number,
            'party': inv.customer_name or 'Walk-in Customer',
            'debit': float(inv.grand_total or 0),
            'credit': 0.0,
        })

    # 2. Customer Payments
    cp_qs = CustomerPayment.objects.filter(business=business)
    if start_date:
        cp_qs = cp_qs.filter(created_at__date__gte=start_date)
    if end_date:
        cp_qs = cp_qs.filter(created_at__date__lte=end_date)
    for cp in cp_qs.select_related('customer'):
        entries.append({
            'time': cp.created_at,
            'type': 'RECEIPT',
            'voucher_no': f"REC-{cp.id}",
            'party': cp.customer.name if cp.customer else 'Customer',
            'debit': 0.0,
            'credit': float(cp.amount or 0),
        })

    # 3. Purchases
    pur_qs = Purchase.objects.filter(business=business)
    if start_date:
        pur_qs = pur_qs.filter(purchase_date__gte=start_date)
    if end_date:
        pur_qs = pur_qs.filter(purchase_date__lte=end_date)
    for p in pur_qs.select_related('supplier'):
        entries.append({
            'time': p.created_at if hasattr(p, 'created_at') else None,
            'type': 'PURCHASE',
            'voucher_no': p.invoice_number or f"PUR-{p.id}",
            'party': p.supplier.name if p.supplier else 'Supplier',
            'debit': 0.0,
            'credit': float(p.total_amount or 0),
        })

    # 4. Supplier Payments
    sp_qs = SupplierPayment.objects.filter(business=business)
    if start_date:
        sp_qs = sp_qs.filter(created_at__date__gte=start_date)
    if end_date:
        sp_qs = sp_qs.filter(created_at__date__lte=end_date)
    for sp in sp_qs.select_related('supplier'):
        entries.append({
            'time': sp.created_at,
            'type': 'PAYMENT',
            'voucher_no': f"PAY-{sp.id}",
            'party': sp.supplier.name if sp.supplier else 'Supplier',
            'debit': float(sp.amount or 0),
            'credit': 0.0,
        })

    # 5. Expenses
    exp_qs = Expense.objects.filter(business=business)
    if start_date:
        exp_qs = exp_qs.filter(expense_date__gte=start_date)
    if end_date:
        exp_qs = exp_qs.filter(expense_date__lte=end_date)
    for exp in exp_qs.select_related('category'):
        cat_name = exp.category.name if exp.category else 'General Expense'
        entries.append({
            'time': exp.created_at,
            'type': 'EXPENSE',
            'voucher_no': f"EXP-{exp.id}",
            'party': f"{cat_name}: {exp.description or ''}".strip(),
            'debit': float(exp.amount or 0),
            'credit': 0.0,
        })

    # Sort chronologically
    entries.sort(key=lambda x: str(x['time'] or ''))

    rows = []
    tot_debit = 0.0
    tot_credit = 0.0

    for e in entries:
        dt_str = format_datetime(e['time']) if e['time'] else '—'
        tot_debit += e['debit']
        tot_credit += e['credit']
        rows.append([
            dt_str,
            e['type'],
            e['voucher_no'],
            e['party'],
            e['debit'],
            e['credit'],
        ])

    headers = ['Date & Time', 'Voucher Type', 'Voucher No.', 'Particulars / Account', 'Debit (Dr)', 'Credit (Cr)']
    summary_rows = [
        ('Total Debit (Dr)', tot_debit),
        ('Total Credit (Cr)', tot_credit),
        ('Total Day Book Vouchers', len(rows)),
    ]

    return ReportData(
        title='Day Book',
        filename='day-book',
        payload={'period': period_label, 'rows': rows, 'total_debit': tot_debit, 'total_credit': tot_credit},
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_cash_book(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    entries = []

    # Cash In: Cash Invoices
    cash_inv = Invoice.objects.filter(business=business, status='completed', payment_method__iexact='cash')
    if start_date:
        cash_inv = cash_inv.filter(created_at__date__gte=start_date)
    if end_date:
        cash_inv = cash_inv.filter(created_at__date__lte=end_date)
    for inv in cash_inv:
        entries.append({
            'date': inv.created_at.date() if hasattr(inv.created_at, 'date') else inv.created_at,
            'particulars': f"Cash Sale: {inv.customer_name or 'Walk-in'}",
            'voucher': inv.invoice_number,
            'cash_in': float(inv.paid_amount or inv.grand_total or 0),
            'cash_out': 0.0,
        })

    # Cash Out: Cash Expenses
    cash_exp = Expense.objects.filter(business=business, payment_method__iexact='cash')
    if start_date:
        cash_exp = cash_exp.filter(expense_date__gte=start_date)
    if end_date:
        cash_exp = cash_exp.filter(expense_date__lte=end_date)
    for exp in cash_exp.select_related('category'):
        cat_name = exp.category.name if exp.category else 'Expense'
        entries.append({
            'date': exp.expense_date,
            'particulars': f"{cat_name}: {exp.description or ''}".strip(),
            'voucher': f"EXP-{exp.id}",
            'cash_in': 0.0,
            'cash_out': float(exp.amount or 0),
        })

    entries.sort(key=lambda x: str(x['date']))

    rows = []
    tot_in = 0.0
    tot_out = 0.0
    bal = 0.0

    for e in entries:
        tot_in += e['cash_in']
        tot_out += e['cash_out']
        bal += (e['cash_in'] - e['cash_out'])
        rows.append([
            format_date(e['date']),
            e['particulars'],
            e['voucher'],
            e['cash_in'],
            e['cash_out'],
            bal,
        ])

    headers = ['Date', 'Particulars', 'Voucher / Ref No.', 'Cash In (Receipts)', 'Cash Out (Payments)', 'Closing Balance']
    summary_rows = [
        ('Total Cash Receipts', tot_in),
        ('Total Cash Payments', tot_out),
        ('Net Cash Flow', bal),
        ('Cash Transactions', len(rows)),
    ]

    return ReportData(
        title='Cash Book',
        filename='cash-book',
        payload={'period': period_label, 'rows': rows, 'total_in': tot_in, 'total_out': tot_out, 'balance': bal},
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_bank_book(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    entries = []

    # Bank/UPI Invoices
    bank_inv = Invoice.objects.filter(business=business, status='completed').exclude(payment_method__iexact='cash')
    if start_date:
        bank_inv = bank_inv.filter(created_at__date__gte=start_date)
    if end_date:
        bank_inv = bank_inv.filter(created_at__date__lte=end_date)
    for inv in bank_inv:
        entries.append({
            'date': inv.created_at.date() if hasattr(inv.created_at, 'date') else inv.created_at,
            'particulars': f"Sale: {inv.customer_name or 'Customer'}",
            'ref': inv.invoice_number,
            'mode': (inv.payment_method or 'Online').upper(),
            'bank_in': float(inv.paid_amount or inv.grand_total or 0),
            'bank_out': 0.0,
        })

    # Bank/UPI Expenses
    bank_exp = Expense.objects.filter(business=business).exclude(payment_method__iexact='cash')
    if start_date:
        bank_exp = bank_exp.filter(expense_date__gte=start_date)
    if end_date:
        bank_exp = bank_exp.filter(expense_date__lte=end_date)
    for exp in bank_exp.select_related('category'):
        cat_name = exp.category.name if exp.category else 'Expense'
        entries.append({
            'date': exp.expense_date,
            'particulars': f"{cat_name}: {exp.description or ''}".strip(),
            'ref': f"EXP-{exp.id}",
            'mode': (exp.payment_method or 'Bank').upper(),
            'bank_in': 0.0,
            'bank_out': float(exp.amount or 0),
        })

    entries.sort(key=lambda x: str(x['date']))

    rows = []
    tot_in = 0.0
    tot_out = 0.0
    bal = 0.0

    for e in entries:
        tot_in += e['bank_in']
        tot_out += e['bank_out']
        bal += (e['bank_in'] - e['bank_out'])
        rows.append([
            format_date(e['date']),
            e['particulars'],
            e['ref'],
            e['mode'],
            e['bank_in'],
            e['bank_out'],
            bal,
        ])

    headers = ['Date', 'Particulars', 'Ref / UTR No.', 'Payment Mode', 'Bank Inflow', 'Bank Outflow', 'Bank Balance']
    summary_rows = [
        ('Total Bank Inflow', tot_in),
        ('Total Bank Outflow', tot_out),
        ('Net Bank Movement', bal),
        ('Bank Transactions', len(rows)),
    ]

    return ReportData(
        title='Bank Book',
        filename='bank-book',
        payload={'period': period_label, 'rows': rows, 'total_in': tot_in, 'total_out': tot_out, 'balance': bal},
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_profit_loss(business, params):
    start_date, end_date, period_label = parse_period_params(params)

    # 1. Revenue
    invoices = Invoice.objects.filter(business=business, status='completed')
    if start_date:
        invoices = invoices.filter(created_at__date__gte=start_date)
    if end_date:
        invoices = invoices.filter(created_at__date__lte=end_date)
    total_sales = invoices.aggregate(total=Sum('grand_total'))['total'] or Decimal('0.00')

    returns_qs = SalesReturn.objects.filter(business=business)
    if start_date:
        returns_qs = returns_qs.filter(created_at__date__gte=start_date)
    if end_date:
        returns_qs = returns_qs.filter(created_at__date__lte=end_date)
    total_returns = returns_qs.aggregate(total=Sum('refund_amount'))['total'] or Decimal('0.00')
    net_revenue = total_sales - total_returns

    # 2. Purchases & COGS
    purchases = Purchase.objects.filter(business=business)
    if start_date:
        purchases = purchases.filter(purchase_date__gte=start_date)
    if end_date:
        purchases = purchases.filter(purchase_date__lte=end_date)
    total_purchases = purchases.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

    # Gross Profit = Net Revenue - Total Purchases
    gross_profit = net_revenue - total_purchases

    # 3. Operating Expenses
    expenses = Expense.objects.filter(business=business)
    if start_date:
        expenses = expenses.filter(expense_date__gte=start_date)
    if end_date:
        expenses = expenses.filter(expense_date__lte=end_date)

    exp_by_cat = list(expenses.values('category__name').annotate(total=Sum('amount')).order_by('-total'))
    total_expenses = expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    net_profit = gross_profit - total_expenses

    rows = [
        ['Operating Revenue: Gross Sales', float(total_sales)],
        ['Less: Sales Returns', float(total_returns)],
        ['Net Sales Revenue', float(net_revenue)],
        ['Cost of Goods / Purchases', float(total_purchases)],
        ['Gross Profit / (Loss)', float(gross_profit)],
    ]

    for ec in exp_by_cat:
        cat_name = ec['category__name'] or 'General Overhead'
        rows.append([f"Operating Expense: {cat_name}", float(ec['total'] or 0)])

    rows.append(['Total Operating Expenses', float(total_expenses)])
    rows.append(['Net Operating Profit / (Loss)', float(net_profit)])

    headers = ['Account / Particulars', 'Amount (Rs.)']
    summary_rows = [
        ('Net Revenue', float(net_revenue)),
        ('Purchases / COGS', float(total_purchases)),
        ('Gross Profit', float(gross_profit)),
        ('Total Expenses', float(total_expenses)),
        ('Net Profit / (Loss)', float(net_profit)),
    ]

    return ReportData(
        title='Profit & Loss Report',
        filename='profit-loss-report',
        payload={
            'period': period_label,
            'revenue': float(net_revenue),
            'gross_profit': float(gross_profit),
            'expenses': float(total_expenses),
            'net_profit': float(net_profit),
            'rows': rows,
        },
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_balance_sheet(business, params):
    start_date, end_date, period_label = parse_period_params(params)

    # Assets
    # 1. Closing Stock valuation
    stock_val = Product.objects.filter(business=business).aggregate(
        total=Sum('current_stock')
    )['total'] or Decimal('0.00')
    # Average inventory estimate:
    inv_val = Product.objects.filter(business=business).annotate(
        val=Sum('current_stock')
    )
    total_inv_val = sum((p.current_stock or 0) * (p.purchase_price or 0) for p in Product.objects.filter(business=business))

    # 2. Sundry Debtors (Receivables)
    total_debtors = Customer.objects.filter(business=business, outstanding_amount__gt=0).aggregate(
        total=Sum('outstanding_amount')
    )['total'] or Decimal('0.00')

    # 3. Cash in Hand (from completed cash invoices minus cash expenses)
    cash_in = Invoice.objects.filter(business=business, status='completed', payment_method__iexact='cash').aggregate(total=Sum('paid_amount'))['total'] or Decimal('0.00')
    cash_out = Expense.objects.filter(business=business, payment_method__iexact='cash').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    cash_balance = max(Decimal('0.00'), cash_in - cash_out)

    # 4. Bank Balance
    bank_in = Invoice.objects.filter(business=business, status='completed').exclude(payment_method__iexact='cash').aggregate(total=Sum('paid_amount'))['total'] or Decimal('0.00')
    bank_out = Expense.objects.filter(business=business).exclude(payment_method__iexact='cash').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    bank_balance = max(Decimal('0.00'), bank_in - bank_out)

    total_assets = Decimal(str(total_inv_val)) + total_debtors + cash_balance + bank_balance

    # Liabilities
    # 1. Sundry Creditors (Payables)
    total_creditors = Supplier.objects.filter(business=business, outstanding_amount__gt=0).aggregate(
        total=Sum('outstanding_amount')
    )['total'] or Decimal('0.00')

    # 2. Capital & Retained Earnings
    retained_earnings = max(Decimal('0.00'), total_assets - total_creditors)
    total_liabilities = total_creditors + retained_earnings

    rows = [
        ['Current Assets: Closing Stock Valuation', float(total_inv_val), 'Current Liabilities: Sundry Creditors', float(total_creditors)],
        ['Current Assets: Sundry Debtors', float(total_debtors), 'Capital & Retained Earnings', float(retained_earnings)],
        ['Current Assets: Cash in Hand', float(cash_balance), '', ''],
        ['Current Assets: Bank Account Balance', float(bank_balance), '', ''],
        ['Total Assets', float(total_assets), 'Total Liabilities & Equity', float(total_liabilities)],
    ]

    headers = ['Assets', 'Amount (Rs.)', 'Liabilities & Equity', 'Amount (Rs.)']
    summary_rows = [
        ('Total Current Assets', float(total_assets)),
        ('Total Liabilities & Equity', float(total_liabilities)),
    ]

    return ReportData(
        title='Balance Sheet',
        filename='balance-sheet',
        payload={'rows': rows, 'total_assets': float(total_assets), 'total_liabilities': float(total_liabilities)},
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_trial_balance(business, params):
    start_date, end_date, period_label = parse_period_params(params)

    # Accounts
    sales_tot = Invoice.objects.filter(business=business, status='completed').aggregate(total=Sum('grand_total'))['total'] or Decimal('0.00')
    pur_tot = Purchase.objects.filter(business=business).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    exp_tot = Expense.objects.filter(business=business).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    debtors_tot = Customer.objects.filter(business=business, outstanding_amount__gt=0).aggregate(total=Sum('outstanding_amount'))['total'] or Decimal('0.00')
    creditors_tot = Supplier.objects.filter(business=business, outstanding_amount__gt=0).aggregate(total=Sum('outstanding_amount'))['total'] or Decimal('0.00')

    rows = [
        ['Sales Account', 0.0, float(sales_tot)],
        ['Purchase Account', float(pur_tot), 0.0],
        ['Operating Expenses', float(exp_tot), 0.0],
        ['Sundry Debtors (Receivables)', float(debtors_tot), 0.0],
        ['Sundry Creditors (Payables)', 0.0, float(creditors_tot)],
    ]

    tot_dr = float(pur_tot + exp_tot + debtors_tot)
    tot_cr = float(sales_tot + creditors_tot)

    headers = ['Account Head / Ledger', 'Debit (Dr)', 'Credit (Cr)']
    summary_rows = [
        ('Total Debit (Dr)', tot_dr),
        ('Total Credit (Cr)', tot_cr),
        ('Difference', abs(tot_dr - tot_cr)),
    ]

    return ReportData(
        title='Trial Balance',
        filename='trial-balance',
        payload={'rows': rows, 'total_debit': tot_dr, 'total_credit': tot_cr},
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
    )


def build_expense_report(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    qs = Expense.objects.filter(business=business)
    if start_date:
        qs = qs.filter(expense_date__gte=start_date)
    if end_date:
        qs = qs.filter(expense_date__lte=end_date)

    cat_id = params.get('category') or params.get('category_id')
    filter_label = ''
    if cat_id:
        qs = qs.filter(category_id=cat_id)
        cat = ExpenseCategory.objects.filter(id=cat_id, business=business).first()
        if cat:
            filter_label = f"Category: {cat.name}"

    qs = qs.select_related('category', 'created_by').order_by('-expense_date')

    rows = []
    tot_amt = Decimal('0.00')

    for exp in qs:
        dt_str = format_date(exp.expense_date)
        cat_name = exp.category.name if exp.category else 'General'
        amt = exp.amount or Decimal('0.00')
        tot_amt += amt
        mode = (exp.payment_method or 'CASH').upper()
        creator = exp.created_by.username if exp.created_by else '—'

        rows.append([
            dt_str,
            cat_name,
            exp.description or '—',
            mode,
            float(amt),
            creator,
        ])

    headers = ['Date', 'Category', 'Description', 'Payment Method', 'Amount', 'Created By']
    summary_rows = [
        ('Total Expenses Recorded', len(rows)),
        ('Total Expense Amount', float(tot_amt)),
    ]

    return ReportData(
        title='Expense Report',
        filename='expense-report',
        payload={'period': period_label, 'rows': rows, 'total_amount': float(tot_amt)},
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=filter_label,
    )


def build_payment_collection(business, params):
    start_date, end_date, period_label = parse_period_params(params)
    entries = []

    # 1. Invoice Payments
    p_qs = Payment.objects.filter(
        invoice__business=business,
        invoice__status='completed',
        customer_payment__isnull=True,
    )
    if start_date:
        p_qs = p_qs.filter(created_at__date__gte=start_date)
    if end_date:
        p_qs = p_qs.filter(created_at__date__lte=end_date)

    method_filter = params.get('method')
    if method_filter:
        p_qs = p_qs.filter(method__iexact=method_filter)

    for p in p_qs.select_related('invoice'):
        entries.append({
            'date': format_date(p.created_at.date() if hasattr(p.created_at, 'date') else p.created_at),
            'time': p.created_at,
            'ref': p.invoice.invoice_number if p.invoice else f"PMT-{p.id}",
            'party': p.invoice.customer_name if p.invoice and p.invoice.customer_name else 'Walk-in Customer',
            'method': (p.method or 'Cash').upper(),
            'notes': p.notes or 'Invoice Settlement',
            'amount': float(p.amount or 0),
        })

    # 2. Customer Credit Payments
    cp_qs = CustomerPayment.objects.filter(business=business)
    if start_date:
        cp_qs = cp_qs.filter(created_at__date__gte=start_date)
    if end_date:
        cp_qs = cp_qs.filter(created_at__date__lte=end_date)
    if method_filter:
        cp_qs = cp_qs.filter(method__iexact=method_filter)

    for cp in cp_qs.select_related('customer'):
        entries.append({
            'date': format_date(cp.created_at.date() if hasattr(cp.created_at, 'date') else cp.created_at),
            'time': cp.created_at,
            'ref': f"REC-{cp.id}",
            'party': cp.customer.name if cp.customer else 'Credit Customer',
            'method': (cp.method or 'Cash').upper(),
            'notes': cp.notes or 'Khata / Credit Receipt',
            'amount': float(cp.amount or 0),
        })

    # Sort chronologically
    entries.sort(key=lambda x: str(x.get('time', '')))

    rows = []
    tot_collected = Decimal('0.00')
    by_method = {}

    for e in entries:
        amt = Decimal(str(e['amount']))
        tot_collected += amt
        m = e['method']
        by_method[m] = by_method.get(m, Decimal('0.00')) + amt

        rows.append([
            e['date'],
            e['ref'],
            e['party'],
            e['method'],
            e['notes'],
            e['amount'],
        ])

    headers = [
        'Date', 'Receipt / Bill No.', 'Customer / Party',
        'Payment Mode', 'Remarks / Notes', 'Amount Collected'
    ]

    summary_rows = [('Total Collections', float(tot_collected))]
    for m, m_amt in sorted(by_method.items()):
        summary_rows.append((f"Collections ({m})", float(m_amt)))

    payload = {
        'period': period_label,
        'summary': {
            'total_collected': float(tot_collected),
            'by_method': {k: float(v) for k, v in by_method.items()},
            'count': len(rows),
        },
        'rows': rows,
    }

    return ReportData(
        title='Payment Collection Report',
        filename='payment-collection-report',
        payload=payload,
        headers=headers,
        rows=rows,
        summary_rows=summary_rows,
        filter_label=f"Mode: {method_filter.upper()}" if method_filter else '',
    )

