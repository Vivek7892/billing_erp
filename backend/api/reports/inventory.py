from django.db.models import F, Sum

from ..models import InventoryTransaction, Product
from . import ReportData


def build(business, params):
    products = list(Product.objects.filter(business=business, status='active').values('id', 'name', 'sku', 'current_stock', 'minimum_stock').order_by('name'))
    movements = list(InventoryTransaction.objects.filter(business=business).values('transaction_type').annotate(quantity=Sum('quantity')).order_by('transaction_type'))
    return ReportData('Inventory Report', 'inventory-report', {'products': products, 'movements': movements}, ['Product', 'SKU', 'Current Stock', 'Minimum Stock'], [[row['name'], row['sku'], row['current_stock'], row['minimum_stock']] for row in products])
