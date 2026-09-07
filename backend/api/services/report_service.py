from ..reports import customer, expenses, gst, inventory, payment, product, profit, sales, supplier


class ReportService:
    BUILDERS = {
        'sales': sales.build,
        'products': product.build,
        'profit': profit.build,
        'gst': gst.build,
        'customers': customer.build,
        'suppliers': supplier.build,
        'payments': payment.build,
        'expenses': expenses.build,
        'inventory': inventory.build,
    }

    @classmethod
    def build(cls, name, business, params):
        try:
            builder = cls.BUILDERS[name]
        except KeyError as exc:
            raise ValueError(f'Unknown report: {name}') from exc
        return builder(business, params)
