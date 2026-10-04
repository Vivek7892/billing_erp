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
        items_data = validated_data.pop('items')
        from .services.purchase_service import PurchaseService

        try:
            return PurchaseService.create_purchase(
                attributes=validated_data,
                items_data=items_data,
                business=validated_data['business'],
                created_by=validated_data['created_by'],
            )
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


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
    created_by_name = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()
    short_url = serializers.SerializerMethodField()
    communication_history = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = [
            'business', 'invoice_number', 'subtotal', 'discount_amount',
            'tax_amount', 'round_off', 'grand_total', 'paid_amount', 'balance_due',
            'payment_status', 'status', 'created_by', 'created_at',
            'confirmed_at', 'posted_at', 'cancelled_by', 'cancelled_at', 'cancel_reason',
            'public_token',
        ]

    def get_short_url(self, obj):
        request = self.context.get('request')
        return obj.get_short_url(request=request)

    def get_communication_history(self, obj):
        logs = obj.communication_logs.all()[:10] if hasattr(obj, 'communication_logs') else []
        if not logs:
            from .models import CommunicationLog
            logs = CommunicationLog.objects.filter(reference_type='invoice', reference_id=str(obj.pk)).order_by('-sent_at')[:10]
        return CommunicationLogSerializer(logs, many=True).data

    def get_customer_name_display(self, obj):
        return obj.customer.name if obj.customer else obj.customer_name

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_cancelled_by_name(self, obj):
        if not obj.cancelled_by:
            return None
        return obj.cancelled_by.get_full_name() or obj.cancelled_by.username


class InvoiceCreateSerializer(serializers.ModelSerializer):
    items = serializers.ListField(child=serializers.DictField(), write_only=True)
    payments = serializers.ListField(child=serializers.DictField(), write_only=True)
    bill_discount = serializers.DecimalField(max_digits=10, decimal_places=2, default=0, write_only=True)

    class Meta:
        model = Invoice
        fields = ['customer', 'customer_name', 'customer_phone', 'notes', 'items', 'payments']
        fields = ['customer', 'customer_name', 'customer_phone', 'notes', 'place_of_supply', 'items', 'payments',
                  'payment_method', 'payment_status', 'bill_discount']

    def validate(self, attrs):
        business = self.context['request'].user.business
        if not business:
            raise serializers.ValidationError({'detail': 'Your account is not linked to a business. Please contact admin.'})
        customer = attrs.get('customer')
        if customer and customer.business_id != business.id:
            raise serializers.ValidationError({'customer': 'Customer does not belong to this business.'})
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        payments_data = validated_data.pop('payments')
        bill_discount = validated_data.pop('bill_discount', 0)
        request = self.context.get('request')
        business = validated_data.pop('business', None) or request.user.business
        created_by = validated_data.pop('created_by', None) or request.user
        from .services.invoice_service import InvoiceService

        try:
            return InvoiceService.create_invoice(
                attributes=validated_data,
                items_data=items_data,
                payments_data=payments_data,
                bill_discount=bill_discount,
                business=business,
                created_by=created_by,
                request=request,
            )
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


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
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'


class RazorpayTransactionSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = RazorpayTransaction
        fields = [
            'id', 'invoice', 'invoice_number', 'provider',
            'merchant_transaction_id', 'razorpay_order_id', 'razorpay_payment_id',
            'amount', 'status', 'response_code', 'provider_reference',
            'failure_reason', 'created_at', 'updated_at',
        ]


class NotificationSerializer(serializers.ModelSerializer):
    read_by_name = serializers.CharField(source='read_by.username', read_only=True)
    actioned_by_name = serializers.CharField(source='actioned_by.username', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'severity', 'title', 'message',
            'action_url', 'action_label', 'data', 'is_read', 'read_at',
            'read_by', 'read_by_name', 'status', 'requires_approval',
            'actioned_by', 'actioned_by_name', 'actioned_at', 'action_notes',
            'created_at', 'updated_at',
        ]
class CommunicationLogSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source='sent_by.username', read_only=True)

    class Meta:
        model = CommunicationLog
        fields = [
            'id', 'channel', 'message_type', 'recipient_name', 'recipient_phone',
            'recipient_email', 'reference_type', 'reference_id', 'short_url',
            'content', 'status', 'sent_by', 'sent_by_name', 'sent_at', 'error_message',
        ]
        read_only_fields = ['id', 'sent_at']
