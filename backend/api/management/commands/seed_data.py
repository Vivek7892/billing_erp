from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
import random

from api.models import *
from api.utils import get_next_invoice_number


class Command(BaseCommand):
    help = 'Seed demo data'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding data...')

        # ============================================================
        # Settings
        # ============================================================
        defaults = {
            'shop_name': 'dreamwithtech',
            'shop_address': '123 Market Street, Mumbai, Maharashtra 400001',
            'shop_phone': '+91 98765 43210',
            'shop_email': 'info@dreamwithtech.com',
            'shop_gstin': '27AABCU9603R1ZX',
            'invoice_prefix': 'INV',
            'invoice_start_number': '1001',
            'invoice_footer': 'Thank you for shopping with us! Visit again.',
            'currency': 'INR',
            'date_format': 'DD/MM/YYYY',
            'allow_negative_stock': 'false',
            'default_payment_method': 'cash',
            'printer_type': 'a4',
        }

        for k, v in defaults.items():
            Setting.objects.get_or_create(
                key=k,
                defaults={'value': v}
            )

        # ============================================================
        # Users
        # ============================================================

        # ADMIN USER
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@shopease.com',
                'role': 'admin',
                'first_name': 'Admin',
                'last_name': 'User',
            }
        )

        # Always make sure admin credentials are correct
        admin_user.email = 'admin@shopease.com'
        admin_user.role = 'admin'
        admin_user.first_name = 'Admin'
        admin_user.last_name = 'User'
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.is_active = True
        admin_user.set_password('admin123')
        admin_user.save()

        # CASHIER USER
        cashier, created = User.objects.get_or_create(
            username='cashier',
            defaults={
                'email': 'cashier@shopease.com',
                'role': 'cashier',
                'first_name': 'John',
                'last_name': 'Cashier',
            }
        )

        # Always make sure cashier credentials are correct
        cashier.email = 'cashier@shopease.com'
        cashier.role = 'cashier'
        cashier.first_name = 'John'
        cashier.last_name = 'Cashier'
        cashier.is_active = True
        cashier.set_password('cashier123')
        cashier.save()

        # ============================================================
        # Categories
        # ============================================================
        cats = [
            'Electronics',
            'Groceries',
            'Beverages',
            'Snacks',
            'Personal Care',
            'Dairy',
            'Bakery',
            'Household',
            'Stationery',
            'Clothing'
        ]

        cat_objs = {}

        for c in cats:
            obj, _ = Category.objects.get_or_create(name=c)
            cat_objs[c] = obj

        # ============================================================
        # Suppliers
        # ============================================================
        suppliers_data = [
            (
                'TechWorld Distributors',
                '+91 98001 11111',
                'techworld@email.com'
            ),
            (
                'FreshFarm Supplies',
                '+91 98002 22222',
                'freshfarm@email.com'
            ),
            (
                'Metro Wholesale',
                '+91 98003 33333',
                'metro@email.com'
            ),
            (
                'National Distributors',
                '+91 98004 44444',
                'national@email.com'
            ),
        ]

        sup_objs = []

        for name, phone, email in suppliers_data:
            obj, _ = Supplier.objects.get_or_create(
                name=name,
                defaults={
                    'phone': phone,
                    'email': email
                }
            )

            sup_objs.append(obj)

        # ============================================================
        # Products
        # ============================================================
        products_data = [
            ('Basmati Rice 5kg', 'RICE001', 'Groceries', 180, 220, 5, 100, 20),
            ('Toor Dal 1kg', 'DAL001', 'Groceries', 90, 115, 5, 80, 15),
            ('Sunflower Oil 1L', 'OIL001', 'Groceries', 110, 140, 5, 60, 10),
            ('Wheat Flour 5kg', 'FLOUR001', 'Groceries', 150, 185, 5, 50, 10),
            ('Sugar 1kg', 'SUGAR001', 'Groceries', 40, 52, 5, 100, 20),
            ('Salt 1kg', 'SALT001', 'Groceries', 15, 22, 0, 120, 20),

            ('Amul Butter 500g', 'BUTTER001', 'Dairy', 220, 265, 12, 30, 10),
            ('Amul Milk 1L', 'MILK001', 'Dairy', 52, 62, 5, 50, 15),
            ('Paneer 200g', 'PANEER001', 'Dairy', 70, 90, 5, 25, 8),
            ('Curd 400g', 'CURD001', 'Dairy', 35, 45, 5, 40, 10),

            ('Bread White', 'BREAD001', 'Bakery', 28, 40, 5, 30, 10),
            ('Brown Bread', 'BREAD002', 'Bakery', 35, 50, 5, 20, 8),

            ('Biscuits Parle-G', 'BISC001', 'Snacks', 8, 12, 12, 200, 30),
            ('Lays Chips 26g', 'CHIPS001', 'Snacks', 15, 20, 12, 150, 25),
            ('Maggi Noodles', 'MAGGI001', 'Snacks', 12, 16, 12, 100, 20),

            ('Coca Cola 500ml', 'COKE001', 'Beverages', 20, 30, 12, 120, 24),
            ('Pepsi 500ml', 'PEPSI001', 'Beverages', 18, 28, 12, 100, 24),
            ('Mineral Water 1L', 'WATER001', 'Beverages', 10, 20, 12, 200, 30),
            ('Green Tea 25bags', 'TEA001', 'Beverages', 80, 110, 5, 40, 10),

            ('Shampoo 200ml', 'SHAMP001', 'Personal Care', 120, 165, 18, 30, 8),
            ('Soap Dove 100g', 'SOAP001', 'Personal Care', 35, 50, 18, 60, 15),
            ('Toothpaste 150g', 'TOOTH001', 'Personal Care', 55, 75, 18, 40, 10),

            ('Detergent 1kg', 'DET001', 'Household', 80, 110, 18, 50, 10),
            ('Dish Wash 500ml', 'DISH001', 'Household', 55, 75, 18, 40, 10),

            ('Notebook A4', 'NOTE001', 'Stationery', 30, 45, 12, 50, 10),
            ('Pen Blue', 'PEN001', 'Stationery', 5, 10, 12, 200, 30),
            ('Pencil HB', 'PENCIL001', 'Stationery', 3, 6, 12, 150, 25),

            ('USB Cable Type-C', 'USB001', 'Electronics', 80, 149, 18, 20, 5),
            ('Earphones', 'EAR001', 'Electronics', 150, 299, 18, 15, 5),
            ('Phone Cover', 'COVER001', 'Electronics', 50, 120, 18, 25, 5),
            ('AAA Batteries 4pk', 'BATT001', 'Electronics', 40, 75, 18, 30, 8),

            ('Coconut Oil 500ml', 'COCOIL001', 'Groceries', 90, 120, 5, 35, 8),
            ('Turmeric Powder', 'TURM001', 'Groceries', 25, 38, 5, 60, 12),
        ]

        prod_objs = []

        for name, sku, cat, pp, sp, gst, stock, min_stock in products_data:

            obj, _ = Product.objects.get_or_create(
                sku=sku,
                defaults={
                    'name': name,
                    'category': cat_objs.get(cat),
                    'purchase_price': pp,
                    'selling_price': sp,
                    'gst_percent': gst,
                    'current_stock': stock,
                    'minimum_stock': min_stock,
                    'supplier': random.choice(sup_objs),
                    'unit': 'pcs',
                    'status': 'active',
                }
            )

            prod_objs.append(obj)

        # ============================================================
        # Customers
        # ============================================================
        customers_data = [
            ('Walk-in Customer', '', '', 0),
            ('Rahul Sharma', '9876543210', 'rahul@email.com', 5000),
            ('Priya Patel', '9876543211', 'priya@email.com', 3000),
            ('Amit Kumar', '9876543212', 'amit@email.com', 2000),
            ('Sunita Devi', '9876543213', '', 1000),
            ('Rajesh Gupta', '9876543214', 'rajesh@email.com', 5000),
            ('Meena Singh', '9876543215', '', 2000),
            ('Vikram Joshi', '9876543216', 'vikram@email.com', 3000),
            ('Anita Verma', '9876543217', '', 1500),
            ('Suresh Nair', '9876543218', 'suresh@email.com', 4000),
        ]

        cust_objs = []

        for name, mobile, email, credit in customers_data:

            obj, _ = Customer.objects.get_or_create(
                name=name,
                defaults={
                    'mobile': mobile,
                    'email': email,
                    'credit_limit': credit
                }
            )

            cust_objs.append(obj)

        # ============================================================
        # Admin user for invoices
        # ============================================================
        admin_user = User.objects.get(username='admin')

        # ============================================================
        # Sample invoices
        # ============================================================
        if Invoice.objects.count() < 5:

            for i in range(15):

                days_ago = random.randint(0, 30)
                inv_date = timezone.now() - timedelta(days=days_ago)

                customer = random.choice(cust_objs[1:])

                invoice = Invoice.objects.create(
                    invoice_number=f"INV-{1000 + i + 1}",
                    customer=customer,
                    customer_name=customer.name,
                    customer_phone=customer.mobile,
                    payment_method=random.choice(
                        ['cash', 'upi', 'card']
                    ),
                    payment_status='paid',
                    status='completed',
                    created_by=admin_user,
                )

                invoice.created_at = inv_date

                subtotal = Decimal('0')
                tax_total = Decimal('0')

                selected = random.sample(
                    prod_objs,
                    random.randint(2, 5)
                )

                for prod in selected:

                    qty = Decimal(
                        str(random.randint(1, 4))
                    )

                    price = prod.selling_price
                    gst_pct = prod.gst_percent

                    gst_amt = (
                        price * qty * gst_pct / 100
                    ).quantize(
                        Decimal('0.01')
                    )

                    total = price * qty + gst_amt

                    InvoiceItem.objects.create(
                        invoice=invoice,
                        product=prod,
                        product_name=prod.name,
                        sku=prod.sku,
                        quantity=qty,
                        unit_price=price,
                        gst_percent=gst_pct,
                        gst_amount=gst_amt,
                        total=total,
                    )

                    subtotal += price * qty
                    tax_total += gst_amt

                grand_total = subtotal + tax_total

                invoice.subtotal = subtotal
                invoice.tax_amount = tax_total
                invoice.grand_total = grand_total
                invoice.paid_amount = grand_total

                invoice.save()

                Payment.objects.create(
                    invoice=invoice,
                    method=invoice.payment_method,
                    amount=grand_total
                )

                # Preserve the generated demo invoice date
                Invoice.objects.filter(
                    pk=invoice.pk
                ).update(
                    created_at=inv_date
                )

        # ============================================================
        # Done
        # ============================================================
        self.stdout.write(
            self.style.SUCCESS(
                'Seed data created successfully!'
            )
        )

        self.stdout.write('Admin username: admin')
        self.stdout.write('Admin password: admin123')
        self.stdout.write('Cashier username: cashier')
        self.stdout.write('Cashier password: cashier123')