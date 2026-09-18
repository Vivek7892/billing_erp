import uuid
import hashlib
import secrets
import string
from django.db import models
from django.db.models import Q
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta


SHORT_LINK_ALPHABET = string.ascii_letters + string.digits


def generate_short_link_code():
    """Return an opaque, URL-safe code suitable for public invoice links."""
    return ''.join(secrets.choice(SHORT_LINK_ALPHABET) for _ in range(6))


def default_short_link_expiry():
    return timezone.now() + timedelta(days=30)


class Business(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    business_type = models.CharField(max_length=100, blank=True)
    owner_name = models.CharField(max_length=200, blank=True)
    mobile = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    pan = models.CharField(max_length=10, blank=True)
    logo = models.ImageField(upload_to='shop_logos/', blank=True, null=True)
    invoice_prefix = models.CharField(max_length=20, default='INV')
    invoice_start_number = models.PositiveIntegerField(default=1001)
    currency = models.CharField(max_length=10, default='₹')
    tax_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'businesses'

    def __str__(self):
        return self.name


class User(AbstractUser):
    ROLE_CHOICES = [
        ('owner', 'Owner'), ('admin', 'Admin'), ('manager', 'Manager'),
        ('cashier', 'Cashier'), ('accountant', 'Accountant'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='cashier')
    phone = models.CharField(max_length=15, blank=True)
    is_active = models.BooleanField(default=True)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True, related_name='members')
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    last_failed_login = models.DateTimeField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.role})"


class OTPRecord(models.Model):
    PURPOSE_CHOICES = [('signup', 'Signup'), ('login', 'Login'), ('reset', 'Password Reset')]
    identifier = models.CharField(max_length=200)  # email or phone
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    otp_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_resend_at = models.DateTimeField(null=True, blank=True)
    resend_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=['identifier', 'purpose', 'is_verified'], name='otp_lookup_idx')]

    @staticmethod
    def hash_otp(otp):
        return hashlib.sha256(otp.encode()).hexdigest()


class AuditLog(models.Model):
    RESULT_CHOICES = [('success', 'Success'), ('failure', 'Failure')]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    business = models.ForeignKey(Business, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    module = models.CharField(max_length=100, blank=True)
    entity = models.CharField(max_length=100, blank=True)
    entity_id = models.CharField(max_length=100, blank=True)
    previous_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    result = models.CharField(max_length=10, choices=RESULT_CHOICES, default='success')
    failure_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Category(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'categories'
        unique_together = [('business', 'name')]

    def __str__(self):
        return self.name


class Supplier(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    outstanding_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(outstanding_amount__gte=0), name='supplier_outstanding_nonnegative'),
        ]
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    STATUS_CHOICES = [('active', 'Active'), ('inactive', 'Inactive')]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    brand = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=20, default='pcs')
    hsn_code = models.CharField(max_length=20, blank=True)
    mrp = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    current_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    minimum_stock = models.DecimalField(max_digits=10, decimal_places=2, default=5)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('business', 'sku')]
        constraints = [
            models.CheckConstraint(check=Q(mrp__gte=0), name='product_mrp_nonnegative'),
            models.CheckConstraint(check=Q(purchase_price__gte=0), name='product_purchase_price_nonnegative'),
            models.CheckConstraint(check=Q(selling_price__gte=0), name='product_selling_price_nonnegative'),
            models.CheckConstraint(check=Q(gst_percent__gte=0) & Q(gst_percent__lte=100), name='product_gst_valid'),
            models.CheckConstraint(check=Q(minimum_stock__gte=0), name='product_minimum_stock_nonnegative'),
        ]

    def __str__(self):
        return self.name

    @property
    def stock_status(self):
        if self.current_stock <= 0:
            return 'out_of_stock'
        elif self.current_stock <= self.minimum_stock:
            return 'low_stock'
        return 'in_stock'


class Customer(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=200)
    mobile = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    credit_limit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    outstanding_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(credit_limit__gte=0), name='customer_credit_limit_nonnegative'),
            models.CheckConstraint(check=Q(outstanding_amount__gte=0), name='customer_outstanding_nonnegative'),
        ]


class Purchase(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('paid', 'Paid'), ('partial', 'Partial')]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True)
    invoice_number = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"PO-{self.id}"

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(total_amount__gte=0), name='purchase_total_nonnegative'),
            models.CheckConstraint(check=Q(paid_amount__gte=0), name='purchase_paid_nonnegative'),
        ]


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(quantity__gt=0), name='purchase_item_quantity_positive'),
            models.CheckConstraint(check=Q(purchase_price__gte=0), name='purchase_item_price_nonnegative'),
            models.CheckConstraint(check=Q(gst_percent__gte=0) & Q(gst_percent__lte=100), name='purchase_item_gst_valid'),
            models.CheckConstraint(check=Q(total__gte=0), name='purchase_item_total_nonnegative'),
        ]


class Invoice(models.Model):
    STATUS_CHOICES = [('completed', 'Completed'), ('cancelled', 'Cancelled'), ('refunded', 'Refunded')]
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed'),
        ('partial', 'Partial'), ('credit', 'Credit'), ('refunded', 'Refunded'),
    ]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    invoice_number = models.CharField(max_length=50)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    customer_name = models.CharField(max_length=200, default='Walk-in Customer')
    customer_phone = models.CharField(max_length=15, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    round_off = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, default='cash')
    payment_status = models.CharField(max_length=12, choices=PAYMENT_STATUS_CHOICES, default='paid')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('business', 'invoice_number')]
        constraints = [
            models.CheckConstraint(check=Q(subtotal__gte=0), name='invoice_subtotal_nonnegative'),
            models.CheckConstraint(check=Q(discount_amount__gte=0), name='invoice_discount_nonnegative'),
            models.CheckConstraint(check=Q(tax_amount__gte=0), name='invoice_tax_nonnegative'),
            models.CheckConstraint(check=Q(grand_total__gte=0), name='invoice_total_nonnegative'),
            models.CheckConstraint(check=Q(paid_amount__gte=0), name='invoice_paid_nonnegative'),
            models.CheckConstraint(check=Q(balance_due__gte=0), name='invoice_balance_nonnegative'),
        ]

    def __str__(self):
        return self.invoice_number


class ShortLink(models.Model):
    """A time-limited public link to an invoice PDF."""
    code = models.CharField(max_length=6, unique=True, default=generate_short_link_code, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='short_links')
    expires_at = models.DateTimeField(default=default_short_link_expiry)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['expires_at'], name='shortlink_expiry_idx')]

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()

    def __str__(self):
        return f'{self.code} → {self.invoice.invoice_number}'


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=200)
    hsn_code = models.CharField(max_length=20, blank=True)
    sku = models.CharField(max_length=100, blank=True)
    mrp = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(quantity__gt=0), name='invoice_item_quantity_positive'),
            models.CheckConstraint(check=Q(unit_price__gte=0), name='invoice_item_price_nonnegative'),
            models.CheckConstraint(check=Q(cost_price__gte=0), name='invoice_item_cost_nonnegative'),
            models.CheckConstraint(check=Q(mrp__gte=0), name='invoice_item_mrp_nonnegative'),
            models.CheckConstraint(check=Q(discount_percent__gte=0) & Q(discount_percent__lte=100), name='invoice_item_discount_valid'),
            models.CheckConstraint(check=Q(gst_percent__gte=0) & Q(gst_percent__lte=100), name='invoice_item_gst_valid'),
            models.CheckConstraint(check=Q(total__gte=0), name='invoice_item_total_nonnegative'),
        ]


class Payment(models.Model):
    METHOD_CHOICES = [('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('online', 'Online'), ('credit', 'Credit'), ('razorpay', 'Razorpay')]
    invoice = models.ForeignKey(Invoice, related_name='payments', on_delete=models.CASCADE)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(amount__gt=0), name='payment_amount_positive'),
        ]


class InventoryTransaction(models.Model):
    TYPE_CHOICES = [
        ('stock_in', 'Stock In'), ('stock_out', 'Stock Out'), ('adjustment', 'Adjustment'),
        ('damaged', 'Damaged'), ('returned', 'Returned'), ('sale', 'Sale'), ('purchase', 'Purchase'),
    ]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    before_stock = models.DecimalField(max_digits=10, decimal_places=2)
    after_stock = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.CharField(max_length=100, blank=True)
    movement_key = models.CharField(max_length=200, null=True, blank=True, unique=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=~Q(quantity=0), name='inventory_quantity_nonzero'),
            models.CheckConstraint(check=Q(unit_cost__gte=0) | Q(unit_cost__isnull=True), name='inventory_unit_cost_nonnegative'),
        ]


class Setting(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    key = models.CharField(max_length=100)
    value = models.TextField(blank=True)

    class Meta:
        unique_together = [('business', 'key')]

    def __str__(self):
        return self.key


class ExpenseCategory(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=100)

    class Meta:
        unique_together = [('business', 'name')]

    def __str__(self):
        return self.name


class Expense(models.Model):
    METHOD_CHOICES = [('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('online', 'Online')]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    category = models.ForeignKey(ExpenseCategory, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.CharField(max_length=300)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')
    expense_date = models.DateField()
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(amount__gt=0), name='expense_amount_positive'),
        ]


class CustomerPayment(models.Model):
    METHOD_CHOICES = [('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('online', 'Online')]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='ledger_payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(amount__gt=0), name='customer_payment_amount_positive'),
        ]


class SupplierPayment(models.Model):
    METHOD_CHOICES = [('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('online', 'Online')]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='ledger_payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(amount__gt=0), name='supplier_payment_amount_positive'),
        ]


class CustomerLedger(models.Model):
    ENTRY_TYPES = [
        ('invoice', 'Invoice Debit'), ('payment', 'Payment Credit'),
        ('sales_return', 'Sales Return'), ('credit_adjustment', 'Credit Adjustment'),
        ('debit_adjustment', 'Debit Adjustment'),
    ]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='ledger_entries')
    entry_type = models.CharField(max_length=30, choices=ENTRY_TYPES)
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.CharField(max_length=100, blank=True)
    event_key = models.CharField(max_length=200, null=True, blank=True, unique=True)
    description = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(debit__gte=0), name='customer_ledger_debit_nonnegative'),
            models.CheckConstraint(check=Q(credit__gte=0), name='customer_ledger_credit_nonnegative'),
            models.CheckConstraint(check=Q(debit=0) | Q(credit=0), name='customer_ledger_one_sided'),
        ]


class SupplierLedger(models.Model):
    ENTRY_TYPES = [
        ('purchase', 'Purchase Debit'), ('payment', 'Payment Credit'),
        ('purchase_return', 'Purchase Return'), ('credit_adjustment', 'Credit Adjustment'),
        ('debit_adjustment', 'Debit Adjustment'),
    ]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='ledger_entries')
    entry_type = models.CharField(max_length=30, choices=ENTRY_TYPES)
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.CharField(max_length=100, blank=True)
    event_key = models.CharField(max_length=200, null=True, blank=True, unique=True)
    description = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(debit__gte=0), name='supplier_ledger_debit_nonnegative'),
            models.CheckConstraint(check=Q(credit__gte=0), name='supplier_ledger_credit_nonnegative'),
            models.CheckConstraint(check=Q(debit=0) | Q(credit=0), name='supplier_ledger_one_sided'),
        ]


class SalesReturn(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='returns')
    return_number = models.CharField(max_length=50)
    reason = models.TextField(blank=True)
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    refund_method = models.CharField(max_length=20, default='cash')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(refund_amount__gte=0), name='sales_return_refund_nonnegative'),
        ]


class SalesReturnItem(models.Model):
    sales_return = models.ForeignKey(SalesReturn, on_delete=models.CASCADE, related_name='items')
    invoice_item = models.ForeignKey(InvoiceItem, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(quantity__gt=0), name='sales_return_item_quantity_positive'),
            models.CheckConstraint(check=Q(unit_price__gte=0), name='sales_return_item_price_nonnegative'),
            models.CheckConstraint(check=Q(total__gte=0), name='sales_return_item_total_nonnegative'),
        ]


class PurchaseReturn(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='returns')
    return_number = models.CharField(max_length=50)
    reason = models.TextField(blank=True)
    debit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(debit_amount__gte=0), name='purchase_return_debit_nonnegative'),
        ]


class PurchaseReturnItem(models.Model):
    purchase_return = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='items')
    purchase_item = models.ForeignKey(PurchaseItem, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(quantity__gt=0), name='purchase_return_item_quantity_positive'),
            models.CheckConstraint(check=Q(purchase_price__gte=0), name='purchase_return_item_price_nonnegative'),
            models.CheckConstraint(check=Q(total__gte=0), name='purchase_return_item_total_nonnegative'),
        ]


class RazorpayTransaction(models.Model):
    STATUS_CHOICES = [
        ('created', 'Created'),
        ('initiated', 'Initiated'),
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
    ]
    invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='razorpay_transactions')
    provider = models.CharField(max_length=50, default='razorpay')
    merchant_transaction_id = models.CharField(max_length=100, blank=True)
    razorpay_order_id = models.CharField(max_length=100, unique=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    razorpay_signature = models.CharField(max_length=200, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='created')
    response_code = models.CharField(max_length=50, blank=True)
    provider_reference = models.CharField(max_length=200, blank=True)
    failure_reason = models.TextField(blank=True)
    response_data = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.razorpay_order_id} ({self.status})'