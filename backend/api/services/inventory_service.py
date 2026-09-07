from decimal import Decimal
from uuid import uuid4

from django.db import transaction

from ..models import InventoryTransaction, Product


class DuplicateStockMovement(ValueError):
    pass


class InventoryService:
    @staticmethod
    def move_stock(*, product_id, quantity, transaction_type, business, user,
                   reference='', notes='', unit_cost=None, movement_key=None,
                   allow_negative=False, expected_before=None,
                   reference_type='', reference_id=''):
        quantity = Decimal(str(quantity))
        if quantity == 0:
            raise ValueError('Quantity cannot be zero.')
        if transaction_type not in dict(InventoryTransaction.TYPE_CHOICES):
            raise ValueError('Invalid inventory transaction type.')

        with transaction.atomic():
            if movement_key and InventoryTransaction.objects.filter(
                business=business, movement_key=movement_key,
            ).exists():
                raise DuplicateStockMovement('Stock movement has already been recorded.')
            try:
                product = Product.objects.select_for_update().get(
                    pk=product_id, business=business,
                )
            except Product.DoesNotExist as exc:
                raise ValueError('Product not found') from exc
            before_stock = product.current_stock
            if expected_before is not None and before_stock != expected_before:
                raise ValueError('Stock changed while applying the movement.')
            after_stock = before_stock + quantity
            if not allow_negative and after_stock < 0:
                raise ValueError(f'Insufficient stock for {product.name}.')
            product.current_stock = after_stock
            product.save(update_fields=['current_stock', 'updated_at'])
            return InventoryTransaction.objects.create(
                business=business,
                product=product,
                transaction_type=transaction_type,
                quantity=quantity,
                before_stock=before_stock,
                after_stock=after_stock,
                reference=reference,
                reference_type=reference_type,
                reference_id=str(reference_id) if reference_id else '',
                movement_key=movement_key,
                unit_cost=unit_cost,
                notes=notes,
                created_by=user,
            )

    @staticmethod
    def deduct_stock(*, product_id, quantity, transaction_type='sale', **kwargs):
        return InventoryService.move_stock(
            product_id=product_id, quantity=-Decimal(str(quantity)),
            transaction_type=transaction_type, **kwargs,
        )

    @staticmethod
    def restore_stock(*, product_id, quantity, transaction_type='returned', **kwargs):
        return InventoryService.move_stock(
            product_id=product_id, quantity=Decimal(str(quantity)),
            transaction_type=transaction_type, **kwargs,
        )

    @staticmethod
    def adjust_stock(*, product_id, quantity, transaction_type, notes, business, created_by, reference='', unit_cost=None):
        movement = InventoryService.move_stock(
            product_id=product_id, quantity=quantity, transaction_type=transaction_type,
            business=business, user=created_by, reference=reference, notes=notes,
            unit_cost=unit_cost,
        )
        return movement.product

    @staticmethod
    def bulk_adjust_stock(*, items, notes, business, created_by, reference='BULK-STOCK'):
        if not isinstance(items, list) or not items:
            raise ValueError('Add at least one product quantity.')
        with transaction.atomic():
            planned = []
            operation_key = f'{reference}:{uuid4()}'
            for item in items:
                try:
                    product = Product.objects.select_for_update().get(
                        pk=item['product_id'], business=business,
                    )
                    quantity = Decimal(str(item['quantity']))
                except (Product.DoesNotExist, KeyError, ValueError, TypeError) as exc:
                    raise ValueError('One or more stock rows are invalid.') from exc
                if quantity == 0:
                    continue
                after_stock = product.current_stock + quantity
                if after_stock < 0:
                    raise ValueError(f'Insufficient stock for {product.name}.')
                planned.append((product, quantity, product.current_stock, after_stock))
            for index, (product, quantity, before_stock, after_stock) in enumerate(planned):
                InventoryService.move_stock(
                    product_id=product.pk,
                    quantity=quantity,
                    transaction_type='stock_in' if quantity > 0 else 'stock_out',
                    business=business,
                    user=created_by,
                    reference=reference,
                    movement_key=f'{operation_key}:{product.pk}:{index}',
                    notes=notes,
                )
        return len(planned)

    @staticmethod
    def import_stock(*, planned_rows, business, created_by, source_name):
        with transaction.atomic():
            imported = 0
            for row_number, product, quantity, before_stock, after_stock in planned_rows:
                if quantity == 0:
                    continue
                InventoryService.move_stock(
                    product_id=product.pk,
                    quantity=quantity,
                    transaction_type='stock_in' if quantity > 0 else 'stock_out',
                    business=business,
                    user=created_by,
                    reference='STOCK-IMPORT',
                    movement_key=f'STOCK-IMPORT:{source_name}:{row_number}',
                    notes=f'Imported from {source_name}',
                    expected_before=before_stock,
                )
                imported += 1
        return imported
