from decimal import Decimal

from django.db import transaction

from ..models import Product, Purchase, PurchaseItem
from .inventory_service import InventoryService
from .ledger_service import LedgerService


class PurchaseService:
    @staticmethod
    def create_purchase(*, attributes, items_data, business, created_by):
        attributes = dict(attributes)
        attributes.pop('business', None)
        attributes.pop('created_by', None)

        with transaction.atomic():
            purchase = Purchase.objects.create(
                business=business,
                created_by=created_by,
                **attributes,
            )
            total = Decimal('0')
            for item_data in items_data:
                product_value = item_data.get('product') or item_data.get('product_id')
                product_id = product_value.pk if isinstance(product_value, Product) else product_value
                product = Product.objects.select_for_update().get(
                    pk=product_id,
                    business=business,
                    status='active',
                )
                quantity = Decimal(str(item_data['quantity']))
                purchase_price = Decimal(str(item_data['purchase_price']))
                gst_percent = Decimal(str(item_data.get('gst_percent', 0)))
                if quantity <= 0 or purchase_price < 0 or not 0 <= gst_percent <= 100:
                    raise ValueError('Invalid purchase item values.')

                line_total = (quantity * purchase_price * (1 + gst_percent / 100)).quantize(Decimal('0.01'))
                item = PurchaseItem.objects.create(
                    purchase=purchase,
                    product=product,
                    quantity=quantity,
                    purchase_price=purchase_price,
                    gst_percent=gst_percent,
                    total=line_total,
                )
                total += item.total
                InventoryService.move_stock(
                    product_id=product.pk,
                    quantity=item.quantity,
                    transaction_type='purchase',
                    business=business,
                    user=created_by,
                    reference=f'PO-{purchase.id}',
                    unit_cost=purchase_price,
                    movement_key=f'purchase:{purchase.pk}:item:{item.pk}',
                    reference_type='purchase',
                    reference_id=purchase.pk,
                )

            paid_amount = purchase.paid_amount
            if paid_amount < 0 or paid_amount > total:
                raise ValueError('Paid amount cannot exceed the purchase total.')
            purchase.total_amount = total
            purchase.payment_status = (
                'paid' if paid_amount == total
                else 'partial' if paid_amount > 0
                else 'pending'
            )
            balance = total - paid_amount
            if balance > 0 and purchase.supplier:
                LedgerService.record_supplier(
                    supplier_id=purchase.supplier_id,
                    business=business,
                    entry_type='purchase',
                    debit=balance,
                    event_key=f'purchase:{purchase.pk}:supplier-ledger',
                    reference_type='purchase',
                    reference_id=purchase.pk,
                    description=f'PO-{purchase.pk}',
                    user=created_by,
                )
            purchase.save(update_fields=['total_amount', 'payment_status'])

        return purchase
