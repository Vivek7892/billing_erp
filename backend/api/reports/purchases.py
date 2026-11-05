from reports.templates.purchase_register import build_purchase_summary


def build(business, params):
    return build_purchase_summary(business, params)

