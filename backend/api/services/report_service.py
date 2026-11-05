from ..reports import (
    cancelled_refunded,
    customer,
    expenses,
    gst,
    inventory,
    payment,
    product,
    profit,
    purchases,
    reconciliation,
    sales,
    supplier,
)


class ReportService:
    BUILDERS = {
        'sales': sales.build,
        'purchases': purchases.build,
        'products': product.build,
        'profit': profit.build,
        'gst': gst.build,
        'customers': customer.build,
        'suppliers': supplier.build,
        'payments': payment.build,
        'expenses': expenses.build,
        'inventory': inventory.build,
        'cancelled_refunded': cancelled_refunded.build,
        'reconciliation': reconciliation.build,
    }

    @classmethod
    def build(cls, name, business, params):
        clean_name = str(name or '').lower().strip()
        # Check AccountingReportDataService first for traditional accounting reports
        try:
            from reports.services.report_data_service import AccountingReportDataService
            has_accounting_builder = clean_name in AccountingReportDataService.BUILDERS
        except ImportError:
            has_accounting_builder = False

        if has_accounting_builder:
            return AccountingReportDataService.build(clean_name, business, params)

        try:
            builder = cls.BUILDERS[clean_name]
        except KeyError as exc:
            raise ValueError(f'Unknown report: {name}') from exc
        return builder(business, params)
