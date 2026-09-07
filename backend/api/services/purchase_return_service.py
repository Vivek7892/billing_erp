from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from ..models import (
    Product,
    Purchase,
    PurchaseItem,
    PurchaseReturn,
    PurchaseReturnItem,
)
from .inventory_service import InventoryService
from .ledger_service import LedgerService


class PurchaseReturnService:
    @staticmethod
    def create_purchase_return(*, purchase_id, reason, items_data, business, created_by):
        if not items_data:
            raise ValueError('Select at least one item to return.')

        with transaction.atomic():
            try:
                purchase = Purchase.objects.select_for_update().get(
                    pk=purchase_id,
                    business=business,
                )
            except Purchase.DoesNotExist as exc:
                raise LookupError('Purchase not found.') from exc

            last = PurchaseReturn.objects.filter(business=business).order_by('-id').first()
            return_number = f"PRET-{last.id + 1 if last else 1:04d}"
            return_obj = PurchaseReturn.objects.create(
                business=business,
                purchase=purchase,
                return_number=return_number,
                reason=reason,
                created_by=created_by,
            )
            debit_total = Decimal('0')
            requested_by_item = {}

            for row in items_data:
                try:
                    purchase_item_id = row['purchase_item_id']
                    purchase_item = PurchaseItem.objects.select_related('product').get(
                        pk=purchase_item_id,
                        purchase=purchase,
                    )
                except (PurchaseItem.DoesNotExist, KeyError) as exc:
                    raise ValueError(f'Invalid item id {row.get("purchase_item_id")}.') from exc

                ret_qty = Decimal(str(row.get('quantity', purchase_item.quantity)))
                already_returned = PurchaseReturnItem.objects.filter(
                    purchase_item=purchase_item,
                ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
                requested_by_item[purchase_item.pk] = (
                    requested_by_item.get(purchase_item.pk, Decimal('0')) + ret_qty
                )
                remaining_qty = purchase_item.quantity - already_returned
                if ret_qty <= 0 or requested_by_item[purchase_item.pk] > remaining_qty:
                    raise ValueError(f'Invalid return qty for {purchase_item.product.name}.')

                line_total = (
                    purchase_item.total / purchase_item.quantity * ret_qty
                ).quantize(Decimal('0.01'))
                debit_total += line_total
                PurchaseReturnItem.objects.create(
                    purchase_return=return_obj,
                    purchase_item=purchase_item,
                    product=purchase_item.product,
                    product_name=purchase_item.product.name,
                    quantity=ret_qty,
                    purchase_price=purchase_item.purchase_price,
                    total=line_total,
                )

                if purchase_item.product:
                    product = Product.objects.select_for_update().get(pk=purchase_item.product_id)
                    InventoryService.deduct_stock(
                        product_id=product.pk,
                        quantity=ret_qty,
                        transaction_type='stock_out',
                        business=business,
                        user=created_by,
                        reference=return_number,
                        unit_cost=purchase_item.purchase_price,
                        movement_key=f'purchase-return:{return_obj.pk}:item:{purchase_item.pk}',
                        reference_type='purchase_return',
                        reference_id=return_obj.pk,
                    )

            return_obj.debit_amount = debit_total
            return_obj.save(update_fields=['debit_amount'])

            if purchase.supplier and debit_total > 0:
                LedgerService.record_supplier(
                    supplier_id=purchase.supplier_id,
                    business=business,
                    entry_type='purchase_return',
                    credit=debit_total,
                    event_key=f'purchase-return:{return_obj.pk}:supplier-ledger',
                    reference_type='purchase_return',
                    reference_id=return_obj.pk,
                    description=return_number,
                    user=created_by,
                )

        return return_obj
