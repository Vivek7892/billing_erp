from decimal import Decimal
from django.db.models import Sum
from rest_framework import serializers
from .models import *


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
        read_only_fields = ['business', 'outstanding_amount']


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
        read_only_fields = ['business', 'outstanding_amount']

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
        read_only_fields = ['purchase', 'total']


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Purchase
        fields = '__all__'
        read_only_fields = ['created_by', 'total_amount', 'business']

    def validate(self, attrs):
        business = self.context['request'].user.business
        supplier = attrs.get('supplier')
        if supplier and supplier.business_id != business.id:
            raise serializers.ValidationError({'supplier': 'Supplier does not belong to this business.'})
        if attrs.get('paid_amount', 0) < 0:
            raise serializers.ValidationError({'paid_amount': 'Paid amount cannot be negative.'})
        return attrs

    def create(self, validated_data):
        from django.db import transaction
        items_data = validated_data.pop('items')
        with transaction.atomic():
            purchase = Purchase.objects.create(**validated_data)
            total = Decimal('0')
            for item_data in items_data:
                product_value = item_data.get('product') or item_data.get('product_id')
                if isinstance(product_value, Product):
                    product = Product.objects.select_for_update().get(
                        pk=product_value.pk, business=purchase.business, status='active'
                    )
                else:
                    product = Product.objects.select_for_update().get(
                        pk=product_value, business=purchase.business, status='active'
                    )
                quantity = Decimal(str(item_data['quantity']))
                purchase_price = Decimal(str(item_data['purchase_price']))
                gst_percent = Decimal(str(item_data.get('gst_percent', 0)))
                if quantity <= 0 or purchase_price < 0 or not 0 <= gst_percent <= 100:
                    raise serializers.ValidationError('Invalid purchase item values.')
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
                    created_by=purchase.created_by,
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
        read_only_fields = [
            'business', 'invoice_number', 'date', 'subtotal', 'discount_amount',
            'tax_amount', 'round_off', 'grand_total', 'paid_amount', 'balance_due',
            'payment_status', 'status', 'created_by', 'created_at',
        ]

    def get_customer_name_display(self, obj):
        return obj.customer.name if obj.customer else obj.customer_name


class InvoiceCreateSerializer(serializers.ModelSerializer):
    items = serializers.ListField(child=serializers.DictField(), write_only=True)
    payments = serializers.ListField(child=serializers.DictField(), write_only=True)
    bill_discount = serializers.DecimalField(max_digits=10, decimal_places=2, default=0, write_only=True)

    class Meta:
        model = Invoice
        fields = ['customer', 'customer_name', 'customer_phone', 'notes', 'items', 'payments',
                  'payment_method', 'payment_status', 'bill_discount']

    def validate(self, attrs):
        business = self.context['request'].user.business
        customer = attrs.get('customer')
        if customer and customer.business_id != business.id:
            raise serializers.ValidationError({'customer': 'Customer does not belong to this business.'})
        return attrs

    def create(self, validated_data):
        from django.db import transaction
        from .calculations import calculate_invoice
        from .utils import get_next_invoice_number
        items_data = validated_data.pop('items')
        payments_data = validated_data.pop('payments')
        bill_discount = validated_data.pop('bill_discount', 0)
        business = validated_data.get('business')

        with transaction.atomic():
            invoice = Invoice.objects.create(
                invoice_number=get_next_invoice_number(business),
                **validated_data
            )

            allow_negative = Setting.objects.filter(business=business, key='allow_negative_stock').first()
            allow_neg = allow_negative and allow_negative.value == 'true'

            tax_on_price = (Setting.objects.filter(business=business, key='tax_on_price').first() or type('', (), {'value': 'exclusive'})()).value
            tax_inclusive = tax_on_price == 'inclusive'

            try:
                calculation = calculate_invoice(
                    items_data,
                    tax_inclusive=tax_inclusive,
                    bill_discount=bill_discount,
                )
            except ValueError as exc:
                raise serializers.ValidationError(str(exc)) from exc

            for item_data, line in zip(items_data, calculation.lines):
                product = Product.objects.select_for_update().get(
                    id=item_data['product_id'], business=business, status='active'
                )
                qty = line.quantity
                unit_price = line.unit_price
                disc_pct = line.discount_percent
                gst_pct = Decimal(str(item_data.get('gst_percent', product.gst_percent)))

                if not allow_neg and product.current_stock < qty:
                    raise serializers.ValidationError(f"Insufficient stock for {product.name}")

                InvoiceItem.objects.create(
                    invoice=invoice,
                    product=product,
                    product_name=product.name,
                    sku=product.sku,
                    hsn_code=item_data.get('hsn_code', product.hsn_code),
                    mrp=Decimal(str(item_data.get('mrp', product.mrp or product.selling_price))),
                    quantity=qty,
                    unit_price=unit_price,
                    cost_price=product.purchase_price,
                    discount_percent=disc_pct,
                    discount_amount=line.discount_amount,
                    gst_percent=gst_pct,
                    gst_amount=line.gst_amount,
                    total=line.total,
                )

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

            grand_total = calculation.grand_total

            requested_status = invoice.payment_status
            valid_methods = {choice[0] for choice in Payment.METHOD_CHOICES}
            for payment_data in payments_data:
                amount = Decimal(str(payment_data.get('amount', 0)))
                if amount <= 0 or payment_data.get('method') not in valid_methods:
                    raise serializers.ValidationError('Payments must have a valid method and positive amount.')
            paid_amount = (
                sum(Decimal(str(p['amount'])) for p in payments_data)
                if requested_status not in ('pending', 'failed') else Decimal('0')
            )
            if requested_status in ('pending', 'failed') and payments_data:
                raise serializers.ValidationError('Pending or failed invoices cannot contain payments.')
            if paid_amount > grand_total:
                raise serializers.ValidationError('Paid amount cannot exceed the invoice total.')
            balance_due = grand_total - paid_amount

            invoice.subtotal = calculation.subtotal
            invoice.discount_amount = calculation.discount_amount
            invoice.tax_amount = calculation.tax_amount
            invoice.round_off = calculation.round_off
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
                customer = invoice.customer
                # Credit limit check
                if customer.credit_limit > 0:
                    available = customer.credit_limit - customer.outstanding_amount
                    if balance_due > available:
                        raise serializers.ValidationError(
                            f"Credit limit exceeded. Available credit: {available:.2f}, required: {balance_due:.2f}"
                        )
                customer.outstanding_amount += balance_due
                customer.save()

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

    def validate(self, attrs):
        if attrs['amount'] <= 0:
            raise serializers.ValidationError({'amount': 'Payment amount must be greater than zero.'})
        business = self.context['request'].user.business
        if attrs['customer'].business_id != business.id:
            raise serializers.ValidationError({'customer': 'Customer does not belong to this business.'})
        return attrs


class SupplierPaymentSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = SupplierPayment
        fields = '__all__'
        read_only_fields = ['business', 'created_by']

    def validate(self, attrs):
        if attrs['amount'] <= 0:
            raise serializers.ValidationError({'amount': 'Payment amount must be greater than zero.'})
        business = self.context['request'].user.business
        if attrs['supplier'].business_id != business.id:
            raise serializers.ValidationError({'supplier': 'Supplier does not belong to this business.'})
        return attrs


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


