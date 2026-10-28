from decimal import Decimal
from django.db.models import Sum
from rest_framework import serializers
from .models import *
from datetime import date


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


import re

GSTIN_REGEX = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')
PHONE_REGEX = re.compile(r'^(\+91[\-\s]?)?[6789]\d{9}$')


def normalize_phone_number(val):
    if not val:
        return ''
    digits = re.sub(r'\D', '', str(val))
    if digits.startswith('91') and len(digits) == 12:
        digits = digits[2:]
    return digits


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    username = serializers.CharField(max_length=150, min_length=3)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    terms_accepted = serializers.BooleanField(required=True)

    def validate_username(self, value):
        val = value.strip().lower()
        if not re.match(r'^[a-z0-9_.]+$', val):
            raise serializers.ValidationError('Username can only contain lowercase letters, numbers, dots, and underscores.')
        if User.objects.filter(username__iexact=val).exists():
            raise serializers.ValidationError('This username is already taken.')
        return val

    def validate_email(self, value):
        val = value.strip().lower()
        if User.objects.filter(email__iexact=val).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return val

    def validate_phone(self, value):
        val = value.strip()
        if not val:
            return ''
        normalized = normalize_phone_number(val)
        if len(normalized) != 10 or not normalized.isdigit():
            raise serializers.ValidationError('Enter a valid 10-digit Indian mobile number.')
        return normalized

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError('You must accept the terms and conditions to register.')
        return value

    def validate(self, attrs):
        password = attrs.get('password')
        confirm = attrs.get('confirm_password')
        if password != confirm:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
            raise serializers.ValidationError({'password': 'Password must contain at least one letter and one number.'})
        return attrs


class OnboardingBusinessStepSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    business_type = serializers.CharField(max_length=100)
    owner_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    mobile = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    pincode = serializers.CharField(max_length=10, required=False, allow_blank=True)

    def validate_name(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError('Business or shop name is required.')
        return val

    def validate_business_type(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError('Please select a business type.')
        return val

    def validate_mobile(self, value):
        val = value.strip()
        if not val:
            return ''
        normalized = normalize_phone_number(val)
        if len(normalized) != 10:
            raise serializers.ValidationError('Enter a valid 10-digit mobile number.')
        return normalized

    def validate_pincode(self, value):
        val = value.strip()
        if not val:
            return ''
        if not (len(val) == 6 and val.isdigit()):
            raise serializers.ValidationError('PIN code must be 6 digits.')
        return val


class OnboardingPreferencesStepSerializer(serializers.Serializer):
    gst_registered = serializers.BooleanField(default=False)
    gstin = serializers.CharField(max_length=15, required=False, allow_blank=True)
    tax_enabled = serializers.BooleanField(default=True)
    currency = serializers.CharField(max_length=10, default='₹')
    invoice_prefix = serializers.CharField(max_length=20, default='INV')
    invoice_start_number = serializers.IntegerField(default=1001, min_value=1)
    invoice_format = serializers.ChoiceField(
        choices=['thermal-80mm', 'thermal-58mm', 'A4'],
        default='thermal-80mm'
    )

    def validate(self, attrs):
        gst_reg = attrs.get('gst_registered', False)
        gstin = attrs.get('gstin', '').strip().upper()
        if gst_reg:
            if not gstin:
                raise serializers.ValidationError({'gstin': 'GSTIN is required when GST registered is selected.'})
            if not GSTIN_REGEX.match(gstin):
                raise serializers.ValidationError({'gstin': 'Enter a valid 15-character GSTIN format (e.g. 29ABCDE1234F1Z5).'})
            attrs['gstin'] = gstin
        else:
            attrs['gstin'] = gstin
        return attrs


class OnboardingProductItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    selling_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    purchase_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, default=0)
    mrp = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, default=0)
    unit = serializers.CharField(max_length=20, default='pcs')
    current_stock = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    category_name = serializers.CharField(max_length=100, required=False, allow_blank=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        if attrs.get('new_password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        pwd = attrs.get('new_password')
        if not re.search(r'[A-Za-z]', pwd) or not re.search(r'\d', pwd):
            raise serializers.ValidationError({'new_password': 'Password must contain at least one letter and one number.'})
        return attrs


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    business_name = serializers.CharField(source='business.name', read_only=True)
    onboarding_completed = serializers.BooleanField(source='has_completed_onboarding', read_only=True)
    onboarding_step = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone',
                  'is_active', 'password', 'business', 'business_name', 'is_verified',
                  'onboarding_completed', 'onboarding_step']
        read_only_fields = ['business', 'is_verified', 'onboarding_completed', 'onboarding_step']

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
    batches = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['business']

    def validate(self, attrs):
        mrp = attrs.get('mrp', getattr(self.instance, 'mrp', None))
        selling = attrs.get('selling_price', getattr(self.instance, 'selling_price', None))
        if mrp is not None and selling is not None and mrp > 0 and mrp < selling:
            raise serializers.ValidationError({'mrp': 'MRP cannot be lower than the selling price.'})
        for field in ('category', 'supplier'):
            related = attrs.get(field, getattr(self.instance, field, None))
            if related and hasattr(related, 'business_id') and related.business_id is not None:
                request = self.context.get('request')
                if request and getattr(request.user, 'business_id', None) and related.business_id != request.user.business_id:
                    raise serializers.ValidationError({field: f'{field.title()} does not belong to this business.'})
        return attrs

    def get_batches(self, obj):
        return ProductBatchSerializer(obj.batches.filter(active=True), many=True).data


class ProductBatchSerializer(serializers.ModelSerializer):
    inventory_status = serializers.ReadOnlyField()

    class Meta:
        model = ProductBatch
        fields = '__all__'
        read_only_fields = ['business', 'created_at', 'updated_at']

    def validate(self, attrs):
        manufacturing = attrs.get('manufacturing_date', getattr(self.instance, 'manufacturing_date', None))
        expiry = attrs.get('expiry_date', getattr(self.instance, 'expiry_date', None))
        if manufacturing and expiry and expiry < manufacturing:
            raise serializers.ValidationError({'expiry_date': 'Expiry date cannot be before manufacturing date.'})
        mrp = attrs.get('mrp', getattr(self.instance, 'mrp', None))
        selling = attrs.get('selling_rate', getattr(self.instance, 'selling_rate', None))
        if mrp is not None and selling is not None and mrp > 0 and mrp < selling:
            raise serializers.ValidationError({'mrp': 'Batch MRP cannot be lower than its selling rate.'})
        quantity = attrs.get('quantity', getattr(self.instance, 'quantity', 0))
        if quantity < 0:
            raise serializers.ValidationError({'quantity': 'Quantity cannot be negative.'})
        product = attrs.get('product', getattr(self.instance, 'product', None))
        request = self.context.get('request')
        if product and request and product.business_id != request.user.business_id:
            raise serializers.ValidationError({'product': 'Product does not belong to this business.'})
        return attrs


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
    transaction_id = serializers.CharField(source='reference', read_only=True)
    collected_by_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_mobile = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    payment_date = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'customer_payment', 'method', 'amount',
            'reference', 'transaction_id', 'notes', 'collected_by_name',
            'customer_name', 'customer_mobile', 'payment_date', 'created_at'
        ]

    def get_collected_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        if obj.customer_payment and obj.customer_payment.created_by:
            return obj.customer_payment.created_by.get_full_name() or obj.customer_payment.created_by.username
        if obj.invoice and obj.invoice.created_by:
            return obj.invoice.created_by.get_full_name() or obj.invoice.created_by.username
        return 'Staff'

    def get_customer_name(self, obj):
        if obj.customer_payment and obj.customer_payment.customer:
            return obj.customer_payment.customer.name
        if obj.invoice:
            if obj.invoice.customer:
                return obj.invoice.customer.name
            if obj.invoice.customer_name:
                return obj.invoice.customer_name
        return 'Walk-in Customer'

    def get_customer_mobile(self, obj):
        if obj.customer_payment and obj.customer_payment.customer:
            return obj.customer_payment.customer.mobile or ''
        if obj.invoice:
            if obj.invoice.customer and obj.invoice.customer.mobile:
                return obj.invoice.customer.mobile
            if obj.invoice.customer_phone:
                return obj.invoice.customer_phone
        return ''

    def get_notes(self, obj):
        if obj.notes:
            return obj.notes
        if obj.customer_payment and obj.customer_payment.notes:
            return obj.customer_payment.notes
        return ''

    def get_payment_date(self, obj):
        if not obj.created_at:
            return ''
        return obj.created_at.strftime('%d %b %Y, %I:%M %p')


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
    customer_email = serializers.EmailField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Invoice
        fields = ['customer', 'customer_name', 'customer_phone', 'customer_email', 'notes', 'place_of_supply', 'items', 'payments',
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
    transaction_id = serializers.CharField(source='reference', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_mobile = serializers.CharField(source='customer.mobile', read_only=True, default='')
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True, default='')
    created_by_name = serializers.SerializerMethodField()
    collected_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomerPayment
        fields = '__all__'
        read_only_fields = ['business', 'created_by']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ''
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_collected_by_name(self, obj):
        return self.get_created_by_name(obj)

    def validate(self, attrs):
        if attrs.get('amount') is not None and attrs['amount'] <= 0:
            raise serializers.ValidationError({'amount': 'Payment amount must be greater than zero.'})
        business = self.context['request'].user.business
        customer = attrs.get('customer')
        if customer and customer.business_id != business.id:
            raise serializers.ValidationError({'customer': 'Customer does not belong to this business.'})
        invoice = attrs.get('invoice')
        if invoice:
            if invoice.business_id != business.id:
                raise serializers.ValidationError({'invoice': 'Invoice does not belong to this business.'})
            if customer and invoice.customer_id != customer.id:
                raise serializers.ValidationError({'invoice': 'Invoice does not belong to the selected customer.'})
            if invoice.status in ('cancelled', 'refunded'):
                raise serializers.ValidationError({'invoice': f'Cannot collect payment on a {invoice.status} invoice.'})
            if attrs.get('amount') and attrs['amount'] > invoice.balance_due:
                raise serializers.ValidationError({'amount': f'Payment amount ({attrs["amount"]}) exceeds invoice balance due ({invoice.balance_due}).'})
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
    customer_name = serializers.CharField(source='invoice.customer_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default='')

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


class ApprovalRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.username', read_only=True)
    requested_by_full_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'business', 'request_type', 'request_type_display',
            'entity_type', 'entity_id', 'entity_name',
            'current_data', 'proposed_data', 'threshold_rule', 'reason',
            'requested_by', 'requested_by_name', 'requested_by_full_name',
            'created_at', 'status', 'status_display',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_notes',
            'applied_at', 'execution_error', 'notification',
        ]
        read_only_fields = [
            'id', 'business', 'created_at', 'status',
            'reviewed_by', 'reviewed_at', 'applied_at', 'execution_error',
        ]

    def get_requested_by_full_name(self, obj):
        if not obj.requested_by:
            return ''
        return obj.requested_by.get_full_name() or obj.requested_by.username
