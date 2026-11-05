from ..templates.financial_report import (
    build_balance_sheet,
    build_bank_book,
    build_cash_book,
    build_day_book,
    build_expense_report,
    build_payment_collection,
    build_profit_loss,
    build_trial_balance,
)
from ..templates.gst_report import build_gstr1, build_gstr2, build_gstr3b, build_gst_summary
from ..templates.ledger_report import (
    build_customer_ledger,
    build_outstanding_payables,
    build_outstanding_receivables,
    build_supplier_ledger,
)
from ..templates.purchase_register import (
    build_item_wise_purchases,
    build_purchase_register,
    build_purchase_summary,
)
from ..templates.sales_register import (
    build_item_wise_sales,
    build_sales_register,
    build_sales_summary,
)
from ..templates.stock_report import build_stock_movement, build_stock_summary


class AccountingReportDataService:
    BUILDERS = {
        # 1. Sales Register
        'sales_register': build_sales_register,
        'sales-register': build_sales_register,
        # 2. Purchase Register
        'purchase_register': build_purchase_register,
        'purchase-register': build_purchase_register,
        # 3. Sales Summary
        'sales_summary': build_sales_summary,
        'sales-summary': build_sales_summary,
        'sales': build_sales_summary,
        # 4. Purchase Summary
        'purchase_summary': build_purchase_summary,
        'purchase-summary': build_purchase_summary,
        'purchases': build_purchase_summary,
        # 5. Stock Summary
        'stock_summary': build_stock_summary,
        'stock-summary': build_stock_summary,
        'inventory': build_stock_summary,
        # 6. Stock Movement Report
        'stock_movement': build_stock_movement,
        'stock-movement': build_stock_movement,
        # 7. Customer Ledger
        'customer_ledger': build_customer_ledger,
        'customer-ledger': build_customer_ledger,
        # 8. Supplier Ledger
        'supplier_ledger': build_supplier_ledger,
        'supplier-ledger': build_supplier_ledger,
        # 9. Outstanding Receivables
        'outstanding_receivables': build_outstanding_receivables,
        'outstanding-receivables': build_outstanding_receivables,
        'customers': build_outstanding_receivables,
        # 10. Outstanding Payables
        'outstanding_payables': build_outstanding_payables,
        'outstanding-payables': build_outstanding_payables,
        'suppliers': build_outstanding_payables,
        # 11. Day Book
        'day_book': build_day_book,
        'day-book': build_day_book,
        # 12. Cash Book
        'cash_book': build_cash_book,
        'cash-book': build_cash_book,
        # 13. Bank Book
        'bank_book': build_bank_book,
        'bank-book': build_bank_book,
        # 14. Profit & Loss Report
        'profit_loss': build_profit_loss,
        'profit-loss': build_profit_loss,
        'profit': build_profit_loss,
        # 15. Balance Sheet
        'balance_sheet': build_balance_sheet,
        'balance-sheet': build_balance_sheet,
        # 16. Trial Balance
        'trial_balance': build_trial_balance,
        'trial-balance': build_trial_balance,
        # 17. GST GSTR-1 Report
        'gstr1': build_gstr1,
        'gstr-1': build_gstr1,
        # 18. GST GSTR-2 Report
        'gstr2': build_gstr2,
        'gstr-2': build_gstr2,
        # 19. GST GSTR-3B Report
        'gstr3b': build_gstr3b,
        'gstr-3b': build_gstr3b,
        # 20. GST Summary Report
        'gst_summary': build_gst_summary,
        'gst-summary': build_gst_summary,
        'gst': build_gst_summary,
        # 21. Payment Collection Report
        'payment_collection': build_payment_collection,
        'payment-collection': build_payment_collection,
        'payments': build_payment_collection,
        # 22. Expense Report
        'expense_report': build_expense_report,
        'expense-report': build_expense_report,
        'expenses': build_expense_report,
        # 23. Item-wise Sales Report
        'item_wise_sales': build_item_wise_sales,
        'item-wise-sales': build_item_wise_sales,
        'products': build_item_wise_sales,
        # 24. Item-wise Purchase Report
        'item_wise_purchases': build_item_wise_purchases,
        'item-wise-purchases': build_item_wise_purchases,
    }

    @classmethod
    def get_builder(cls, report_name):
        key = str(report_name or '').lower().strip()
        if key in cls.BUILDERS:
            return cls.BUILDERS[key]

        # Fallback to existing api.reports builders if available
        try:
            from api.services.report_service import ReportService
            if key in ReportService.BUILDERS:
                return ReportService.BUILDERS[key]
        except Exception:
            pass

        raise ValueError(f"Unknown report name: '{report_name}'")

    @classmethod
    def build(cls, report_name, business, params):
        builder = cls.get_builder(report_name)
        return builder(business, params)

