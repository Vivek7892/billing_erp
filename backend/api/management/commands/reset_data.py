from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import (
    Business,
    User,
    Setting,
    InvoiceTemplateSetting,
    Category,
    Supplier,
    Product,
    ProductBatch,
    Customer,
    Purchase,
    PurchaseItem,
    Invoice,
    InvoiceItem,
    Payment,
    InventoryTransaction,
    ExpenseCategory,
    Expense,
    CustomerPayment,
    SupplierPayment,
    CustomerLedger,
    SupplierLedger,
    SalesReturn,
    SalesReturnItem,
    PurchaseReturn,
    PurchaseReturnItem,
    AuditLog,
    RazorpayTransaction,
    Notification,
    CommunicationLog,
    ApprovalRequest,
    ShortLink,
)


class Command(BaseCommand):
    help = 'Cleanly delete all products, bills, purchases, inventory, returns, reports data while preserving Users, Business profile, and Settings'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Resetting ERP transactional and catalog data...'))

        with transaction.atomic():
            # 1. Invoice & Sales Returns
            SalesReturnItem.objects.all().delete()
            SalesReturn.objects.all().delete()
            RazorpayTransaction.objects.all().delete()
            Payment.objects.all().delete()
            InvoiceItem.objects.all().delete()
            ShortLink.objects.all().delete()
            Invoice.objects.all().delete()

            # 2. Purchases & Purchase Returns
            PurchaseReturnItem.objects.all().delete()
            PurchaseReturn.objects.all().delete()
            PurchaseItem.objects.all().delete()
            Purchase.objects.all().delete()

            # 3. Ledgers & Payments
            CustomerPayment.objects.all().delete()
            SupplierPayment.objects.all().delete()
            CustomerLedger.objects.all().delete()
            SupplierLedger.objects.all().delete()

            # 4. Inventory, Batches, Products, Categories
            InventoryTransaction.objects.all().delete()
            ProductBatch.objects.all().delete()
            Product.objects.all().delete()
            Category.objects.all().delete()

            # 5. Expenses
            Expense.objects.all().delete()
            ExpenseCategory.objects.all().delete()

            # 6. Parties (Reset balances or clean test parties)
            Customer.objects.all().delete()
            Supplier.objects.all().delete()

            # 7. Audit logs & notifications
            AuditLog.objects.all().delete()
            Notification.objects.all().delete()
            CommunicationLog.objects.all().delete()
            ApprovalRequest.objects.all().delete()

            user_count = User.objects.count()
            business_count = Business.objects.count()
            settings_count = Setting.objects.count()

        self.stdout.write(self.style.SUCCESS(
            f'Successfully reset database! Preserved: {user_count} Users, {business_count} Business profiles, and {settings_count} Settings.'
        ))

