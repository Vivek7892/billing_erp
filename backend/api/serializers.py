from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import *
from decimal import Decimal


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    business_name = serializers.CharField(source='business.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone',
                  'is_active', 'password', 'business', 'business_name', 'is_verified']
        read_only_fields = ['business', 'is_verified']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ['business']

    def get_product_count(self, obj):
        return obj.product_set.count()


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ['business']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    stock_status = serializers.ReadOnlyField()

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['business']


class CustomerSerializer(serializers.ModelSerializer):
    total_bills = serializers.SerializerMethodField()
    total_purchases = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = ['business']

    def get_total_bills(self, obj):
        return obj.invoice_set.filter(status='completed').count()

    def get_total_purchases(self, obj):
        result = obj.invoice_set.filter(status='completed').aggregate(total=Sum('grand_total'))
        return result['total'] or 0


class PurchaseItemSerializer(serializers.ModelSerializer):
    purchase = serializers.PrimaryKeyRelatedField(read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = PurchaseItem
        fields = '__all__'


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Purchase
        fields = '__all__'
        read_only_fields = ['created_by', 'total_amount', 'business']

    def create(self, validated_data):
        from django.db import transaction
        items_data = validated_data.pop('items')
        with transaction.atomic():
            purchase = Purchase.objects.create(**validated_data)
            total = Decimal('0')
            for item_data in items_data:
                product_value = item_data.get('product') or item_data.get('product_id')
                if isinstance(product_value, Product):
                    product = Product.objects.select_for_update().get(pk=product_value.pk)
                else:
                    product = Product.objects.select_for_update().get(pk=product_value)
                item = PurchaseItem.objects.create(
                    purchase=purchase,
                    product=product,
                    quantity=Decimal(str(item_data['quantity'])),
                    purchase_price=Decimal(str(item_data['purchase_price'])),
                    gst_percent=Decimal(str(item_data.get('gst_percent', 0))),
                    total=Decimal(str(item_data['total'])),
                )
                total += item.total
                before = product.current_stock
                product.current_stock += item.quantity
                product.save()
                InventoryTransaction.objects.create(
                    business=purchase.business,
                    product=product,
                    transaction_type='purchase',
                    quantity=item.quantity,
                    before_stock=before,
                    after_stock=product.current_stock,
                    reference=f"PO-{purchase.id}",
                )
            purchase.total_amount = total
            # Update supplier outstanding if not fully paid
            balance = total - purchase.paid_amount
            if balance > 0 and purchase.supplier:
                purchase.supplier.outstanding_amount += balance
                purchase.supplier.save()
            purchase.save()
        return purchase


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    customer_name_display = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'

    def get_customer_name_display(self, obj):
        return obj.customer.name if obj.customer else obj.customer_name


class InvoiceCreateSerializer(serializers.ModelSerializer):
    items = serializers.ListField(child=serializers.DictField(), write_only=True)
    payments = serializers.ListField(child=serializers.DictField(), write_only=True)

    class Meta:
        model = Invoice
        fields = ['customer', 'customer_name', 'customer_phone', 'notes', 'items', 'payments',
                  'payment_method', 'payment_status']

    def create(self, validated_data):
        from django.db import transaction
        from .utils import get_next_invoice_number
        items_data = validated_data.pop('items')
        payments_data = validated_data.pop('payments')
        business = validated_data.get('business')

        with transaction.atomic():
            invoice = Invoice.objects.create(
                invoice_number=get_next_invoice_number(business),
                **validated_data
            )

            subtotal = Decimal('0')
            total_discount = Decimal('0')
            total_tax = Decimal('0')

            allow_negative = Setting.objects.filter(business=business, key='allow_negative_stock').first()
            allow_neg = allow_negative and allow_negative.value == 'true'

            tax_on_price = (Setting.objects.filter(business=business, key='tax_on_price').first() or type('', (), {'value': 'exclusive'})()).value
            tax_inclusive = tax_on_price == 'inclusive'

            for item_data in items_data:
                product = Product.objects.select_for_update().get(id=item_data['product_id'])
                qty = Decimal(str(item_data['quantity']))
                unit_price = Decimal(str(item_data['unit_price']))
                disc_pct = Decimal(str(item_data.get('discount_percent', 0)))
                gst_pct = Decimal(str(item_data.get('gst_percent', product.gst_percent)))

                if not allow_neg and product.current_stock < qty:
                    raise serializers.ValidationError(f"Insufficient stock for {product.name}")

                if tax_inclusive and gst_pct > 0:
                    # Back-calculate: unit_price already includes GST
                    base_price = (unit_price / (1 + gst_pct / 100)).quantize(Decimal('0.0001'))
                    disc_amt = (base_price * qty * disc_pct / 100).quantize(Decimal('0.01'))
                    taxable = base_price * qty - disc_amt
                    gst_amt = (taxable * gst_pct / 100).quantize(Decimal('0.01'))
                    total = taxable + gst_amt
                else:
                    disc_amt = (unit_price * qty * disc_pct / 100).quantize(Decimal('0.01'))
                    taxable = unit_price * qty - disc_amt
                    gst_amt = (taxable * gst_pct / 100).quantize(Decimal('0.01'))
                    total = taxable + gst_amt

                InvoiceItem.objects.create(
                    invoice=invoice,
                    product=product,
                    product_name=product.name,
                    sku=product.sku,
                    hsn_code=item_data.get('hsn_code', product.hsn_code),
                    mrp=Decimal(str(item_data.get('mrp', product.mrp or product.selling_price))),
                    quantity=qty,
                    unit_price=unit_price,
                    discount_percent=disc_pct,
                    discount_amount=disc_amt,
                    gst_percent=gst_pct,
                    gst_amount=gst_amt,
                    total=total,
                )

                subtotal += unit_price * qty
                total_discount += disc_amt
                total_tax += gst_amt

                before = product.current_stock
                product.current_stock -= qty
                product.save()
                InventoryTransaction.objects.create(
                    business=business,
                    product=product,
                    transaction_type='sale',
                    quantity=-qty,
                    before_stock=before,
                    after_stock=product.current_stock,
                    reference=invoice.invoice_number,
                )

            grand_total_raw = subtotal - total_discount + total_tax
            round_off_setting = (Setting.objects.filter(business=business, key='round_off').first() or type('', (), {'value': 'nearest'})()).value
            if round_off_setting == 'nearest':
                round_off = round(float(grand_total_raw)) - float(grand_total_raw)
            else:
                round_off = 0
            grand_total = grand_total_raw + Decimal(str(round_off)).quantize(Decimal('0.01'))

            requested_status = invoice.payment_status
            paid_amount = (
                sum(Decimal(str(p['amount'])) for p in payments_data)
                if requested_status not in ('pending', 'failed') else Decimal('0')
            )
            balance_due = grand_total - paid_amount

            invoice.subtotal = subtotal
            invoice.discount_amount = total_discount
            invoice.tax_amount = total_tax
            invoice.round_off = Decimal(str(round_off)).quantize(Decimal('0.01'))
            invoice.grand_total = grand_total
            invoice.paid_amount = paid_amount
            invoice.balance_due = balance_due

            if requested_status in ('pending', 'failed', 'credit'):
                invoice.payment_status = requested_status
            elif balance_due <= 0:
                invoice.payment_status = 'paid'
            elif paid_amount > 0:
                invoice.payment_status = 'partial'
            else:
                invoice.payment_status = 'credit'

            invoice.save()

            for p in payments_data:
                Payment.objects.create(
                    invoice=invoice,
                    method=p['method'],
                    amount=Decimal(str(p['amount'])),
                    reference=p.get('reference', ''),
                )

            if invoice.customer and balance_due > 0:
                invoice.customer.outstanding_amount += balance_due
                invoice.customer.save()

        return invoice


class InventoryTransactionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = '__all__'


class SettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setting
        fields = '__all__'


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'
        read_only_fields = ['business']


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['business', 'created_by']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value


class CustomerPaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = CustomerPayment
        fields = '__all__'
        read_only_fields = ['business', 'created_by']


class SupplierPaymentSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = SupplierPayment
        fields = '__all__'
        read_only_fields = ['business', 'created_by']


class SalesReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesReturnItem
        fields = '__all__'


class SalesReturnSerializer(serializers.ModelSerializer):
    items = SalesReturnItemSerializer(many=True, read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = SalesReturn
        fields = '__all__'
        read_only_fields = ['business', 'created_by', 'return_number']


class PurchaseReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseReturnItem
        fields = '__all__'


class PurchaseReturnSerializer(serializers.ModelSerializer):
    items = PurchaseReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseReturn
        fields = '__all__'
        read_only_fields = ['business', 'created_by', 'return_number']


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'


from django.db.models import Sum  # noqa: E402 — needed by CustomerSerializer
