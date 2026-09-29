from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
import random

from api.models import (
    Business,
    User,
    Setting,
    Category,
    Supplier,
    Product,
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
)
from api.services.inventory_service import InventoryService
from api.services.purchase_service import PurchaseService
from api.services.invoice_service import InvoiceService
from api.services.payment_service import PaymentService
from api.services.sales_return_service import SalesReturnService
from api.services.purchase_return_service import PurchaseReturnService


class Command(BaseCommand):
    help = 'Seed comprehensive demo data for the entire Billing ERP based on existing business logic and services'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Clean existing business transactions before seeding',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('Starting comprehensive Billing ERP data seed...'))

        # ============================================================
        # 1. BUSINESS
        # ============================================================
        business, _ = Business.objects.get_or_create(
            name='dreamwithtech',
            defaults={
                'business_type': 'retail',
                'owner_name': 'Admin User',
                'mobile': '+91 98765 43210',
                'email': 'contact@balajistore.com',
                'address': '123 Market Road, T. Nagar, Chennai, Tamil Nadu 600017',
                'gstin': '33AABCU9603R1ZX',
                'invoice_prefix': 'INV',
                'invoice_start_number': 1001,
                'currency': '₹',
            }
        )

        # Update business info to ensure consistency with invoice templates
        business.address = '123 Market Road, T. Nagar, Chennai, Tamil Nadu 600017'
        business.gstin = '33AABCU9603R1ZX'
        business.mobile = '+91 98765 43210'
        business.email = 'contact@balajistore.com'
        business.currency = '₹'
        business.save()

        # ============================================================
        # 2. SETTINGS
        # ============================================================
        self.stdout.write('Configuring ERP settings...')
        settings_map = {
            # Business Info
            'shop_name': 'SRI BALAJI STORE',
            'shop_address': '123 Market Road, T. Nagar, Chennai, Tamil Nadu 600017',
            'shop_phone': '+91 98765 43210',
            'shop_email': 'contact@balajistore.com',
            'shop_gstin': '33AABCU9603R1ZX',
            'shop_pan': 'AABCU9603R',
            'shop_state': 'Tamil Nadu (33)',
            'place_of_supply': 'Tamil Nadu (33)',
            'currency': 'INR',

            # Invoice Numbering & Layout
            'invoice_prefix': 'INV',
            'invoice_start_number': '1001',
            'invoice_template': 'modern',
            'invoice_paper_size': 'a4',
            'invoice_font': 'inter',
            'printer_type': 'a4',
            'default_printer': 'standard',
            'copies_per_bill': '1',
            'date_format': 'DD/MM/YYYY',

            # Invoice Visibility Flags
            'show_business_logo': 'true',
            'show_business_address': 'true',
            'show_business_phone': 'true',
            'show_business_email': 'true',
            'show_business_gstin': 'true',
            'show_business_pan': 'true',
            'show_customer_phone': 'true',
            'show_customer_address': 'true',
            'show_customer_gstin': 'true',
            'show_place_of_supply': 'true',
            'show_payment_mode': 'true',
            'show_payment_status': 'true',
            'show_payment_summary': 'true',
            'show_balance_due': 'true',
            'show_amount_in_words': 'true',
            'show_sku_col': 'true',
            'show_hsn_col': 'true',
            'show_unit_col': 'true',
            'show_discount_col': 'true',
            'show_tax_cols': 'true',
            'hsn_summary_on_invoice': 'true',
            'show_signature_area': 'true',

            # Terms & Footer
            'show_terms': 'true',
            'invoice_terms': '1. Goods once sold will not be accepted back without original invoice.\n2. Warranty strictly as per manufacturer terms.\n3. Subject to local Chennai jurisdiction.',
            'show_footer': 'true',
            'invoice_footer': 'Thank you for shopping at Sri Balaji Store! Visit us again.',

            # Bank & UPI Configuration
            'show_bank_details': 'true',
            'shop_bank_name': 'State Bank of India',
            'shop_bank_account': '384920194829',
            'shop_bank_ifsc': 'SBIN0001234',
            'shop_bank_branch': 'T. Nagar Branch',
            'shop_upi_id': 'balajistore@sbi',
            'upi_merchant_name': 'Sri Balaji Store',
            'upi_qr_enabled': 'true',
            'show_upi_qr_on_invoice': 'true',
            'show_upi_qr_on_thermal': 'true',
            'upi_qr_size_a4': '120',
            'upi_qr_size_thermal': '140',

            # Business Rules & Taxes
            'tax_on_price': 'exclusive',
            'default_gst_rate': '18',
            'round_off': 'true',
            'allow_negative_stock': 'false',
            'default_payment_method': 'cash',
        }

        for key, val in settings_map.items():
            Setting.objects.update_or_create(
                business=business,
                key=key,
                defaults={'value': str(val)}
            )

        # ============================================================
        # 3. USERS
        # ============================================================
        self.stdout.write('Configuring system users...')
        admin_user, _ = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@balajistore.com',
                'role': 'admin',
                'first_name': 'Admin',
                'last_name': 'User',
            }
        )
        admin_user.role = 'admin'
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.is_active = True
        admin_user.business = business
        admin_user.set_password('admin123')
        admin_user.save()

        cashier_user, _ = User.objects.get_or_create(
            username='cashier',
            defaults={
                'email': 'cashier@balajistore.com',
                'role': 'cashier',
                'first_name': 'Karthik',
                'last_name': 'Raman',
            }
        )
        cashier_user.role = 'cashier'
        cashier_user.is_active = True
        cashier_user.business = business
        cashier_user.set_password('cashier123')
        cashier_user.save()

        manager_user, _ = User.objects.get_or_create(
            username='manager',
            defaults={
                'email': 'manager@balajistore.com',
                'role': 'admin',
                'first_name': 'Sundar',
                'last_name': 'Murthy',
            }
        )
        manager_user.role = 'admin'
        manager_user.is_active = True
        manager_user.business = business
        manager_user.set_password('manager123')
        manager_user.save()

        User.objects.filter(business__isnull=True).update(business=business)

        # Optional Clean
        if options.get('clean'):
            self.stdout.write(self.style.WARNING('Cleaning existing transaction records...'))
            SalesReturnItem.objects.filter(sales_return__business=business).delete()
            SalesReturn.objects.filter(business=business).delete()
            PurchaseReturnItem.objects.filter(purchase_return__business=business).delete()
            PurchaseReturn.objects.filter(business=business).delete()
            RazorpayTransaction.objects.filter(invoice__business=business).delete()
            Payment.objects.filter(invoice__business=business).delete()
            InvoiceItem.objects.filter(invoice__business=business).delete()
            Invoice.objects.filter(business=business).delete()
            PurchaseItem.objects.filter(purchase__business=business).delete()
            Purchase.objects.filter(business=business).delete()
            CustomerPayment.objects.filter(business=business).delete()
            SupplierPayment.objects.filter(business=business).delete()
            CustomerLedger.objects.filter(business=business).delete()
            SupplierLedger.objects.filter(business=business).delete()
            InventoryTransaction.objects.filter(business=business).delete()
            Expense.objects.filter(business=business).delete()

        # ============================================================
        # 4. CATEGORIES
        # ============================================================
        self.stdout.write('Seeding product categories...')
        categories_data = [
            'Groceries & Staples',
            'Dairy & Fresh',
            'Beverages & Drinks',
            'Snacks & Confectionery',
            'Personal Care & Hygiene',
            'Household Cleaning',
            'Stationery & Office',
            'Packaged Foods',
            'Electronics & Accessories',
        ]
        cat_objs = {}
        for cat_name in categories_data:
            cat_obj, _ = Category.objects.get_or_create(business=business, name=cat_name)
            cat_objs[cat_name] = cat_obj

        # ============================================================
        # 5. SUPPLIERS
        # ============================================================
        self.stdout.write('Seeding suppliers...')
        suppliers_data = [
            ('National FMCG Distributors', '+91 98401 11223', 'orders@nationalfmcg.com', '33AAACN1234F1Z1', 'No. 45 Wholesale Market, Koyambedu, Chennai'),
            ('Metro Wholesale Cash & Carry', '+91 98402 22334', 'sales@metrowholesale.in', '33AABCM5678M1Z2', 'Survey 102, Poonamallee High Road, Chennai'),
            ('FreshFarm Agro Supplies', '+91 98403 33445', 'freshfarm@agrochennai.com', '33AADCF9012A1Z3', 'Agro Complex, Palladam Road, Tiruppur'),
            ('Techtronics India Pvt Ltd', '+91 98404 44556', 'supply@techtronics.in', '33AABCT3456T1Z4', 'Electronics Zone, Guindy Industrial Estate, Chennai'),
            ('Sri Lakshmi Trading Co', '+91 98405 55667', 'lakshmi.trading@yahoo.com', '33AAGCS7890S1Z5', 'Grain Mandi, Madurai Main Road, Madurai'),
        ]
        sup_objs = []
        for name, phone, email, gstin, address in suppliers_data:
            sup, _ = Supplier.objects.get_or_create(
                business=business,
                name=name,
                defaults={
                    'phone': phone,
                    'email': email,
                    'gstin': gstin,
                    'address': address,
                }
            )
            sup_objs.append(sup)

        # ============================================================
        # 6. PRODUCTS
        # ============================================================
        self.stdout.write('Seeding products catalog with barcodes, brands & tax rates...')
        # (Name, SKU, Barcode, Category, Brand, Unit, HSN, Purchase Price, Selling Price, MRP, GST%, Initial Stock, Min Stock, Status)
        catalog = [
            # Groceries & Staples
            ('India Gate Basmati Rice 5kg', 'RICE-001', '8901030382910', 'Groceries & Staples', 'India Gate', 'kg', '100630', 210, 260, 290, 5, 80, 15, 'active'),
            ('Tata Sampann Toor Dal 1kg', 'DAL-001', '8901030382911', 'Groceries & Staples', 'Tata Sampann', 'kg', '071360', 95, 125, 140, 5, 60, 15, 'active'),
            ('Fortune Sunflower Oil 1L', 'OIL-001', '8901030382912', 'Groceries & Staples', 'Fortune', 'L', '151219', 115, 145, 160, 5, 50, 12, 'active'),
            ('Aashirvaad Shudh Chakki Atta 5kg', 'ATTA-001', '8901030382913', 'Groceries & Staples', 'Aashirvaad', 'kg', '110100', 160, 210, 235, 5, 75, 15, 'active'),
            ('Madhur Pure Refined Sugar 1kg', 'SUGAR-001', '8901030382914', 'Groceries & Staples', 'Madhur', 'kg', '170199', 42, 54, 60, 5, 110, 20, 'active'),
            ('Tata Salt Vacuum Evaporated 1kg', 'SALT-001', '8901030382915', 'Groceries & Staples', 'Tata', 'kg', '250100', 18, 25, 28, 0, 140, 25, 'active'),
            ('Everest Turmeric Powder 200g', 'SPICE-001', '8901030382916', 'Groceries & Staples', 'Everest', 'pack', '091030', 32, 45, 50, 5, 65, 10, 'active'),

            # Dairy & Fresh
            ('Amul Pasteurised Butter 500g', 'DAIRY-001', '8901030382917', 'Dairy & Fresh', 'Amul', 'pack', '040510', 225, 275, 295, 12, 35, 10, 'active'),
            ('Amul Taaza Homogenised Milk 1L', 'DAIRY-002', '8901030382918', 'Dairy & Fresh', 'Amul', 'L', '040120', 54, 66, 72, 5, 45, 15, 'active'),
            ('Milky Mist Fresh Paneer 200g', 'DAIRY-003', '8901030382919', 'Dairy & Fresh', 'Milky Mist', 'pack', '040610', 75, 95, 105, 5, 30, 8, 'active'),
            ('Amul Masti Dahi 400g', 'DAIRY-004', '8901030382920', 'Dairy & Fresh', 'Amul', 'pack', '040310', 36, 48, 52, 5, 4, 10, 'active'), # LOW STOCK SAMPLE

            # Snacks & Confectionery
            ('Britannia Good Day Butter 200g', 'SNACK-001', '8901030382921', 'Snacks & Confectionery', 'Britannia', 'pack', '190531', 28, 40, 45, 12, 120, 25, 'active'),
            ('Parle-G Gold Biscuits 1kg', 'SNACK-002', '8901030382922', 'Snacks & Confectionery', 'Parle', 'pack', '190531', 65, 85, 95, 12, 90, 20, 'active'),
            ('Lays Classic Salted Chips 50g', 'SNACK-003', '8901030382923', 'Snacks & Confectionery', 'Lays', 'pack', '200520', 14, 20, 20, 12, 110, 20, 'active'),
            ('Cadbury Dairy Milk Silk 60g', 'SNACK-004', '8901030382924', 'Snacks & Confectionery', 'Cadbury', 'pack', '180632', 60, 80, 85, 18, 0, 10, 'active'), # OUT OF STOCK SAMPLE

            # Beverages & Drinks
            ('Brooke Bond Red Label Tea 500g', 'BEV-001', '8901030382925', 'Beverages & Drinks', 'Red Label', 'pack', '090240', 190, 245, 270, 5, 50, 12, 'active'),
            ('Nescafe Classic Coffee Jar 100g', 'BEV-002', '8901030382926', 'Beverages & Drinks', 'Nescafe', 'pack', '210111', 185, 240, 265, 18, 40, 10, 'active'),
            ('Coca Cola Pet Bottle 750ml', 'BEV-003', '8901030382927', 'Beverages & Drinks', 'Coca Cola', 'pcs', '220210', 30, 40, 40, 28, 80, 15, 'active'),
            ('Kinley Mineral Water 1L', 'BEV-004', '8901030382928', 'Beverages & Drinks', 'Kinley', 'pcs', '220110', 11, 20, 20, 18, 150, 30, 'active'),

            # Personal Care & Hygiene
            ('Dettol Original Bathing Soap 125g', 'PERS-001', '8901030382929', 'Personal Care & Hygiene', 'Dettol', 'pcs', '340111', 38, 52, 56, 18, 90, 20, 'active'),
            ('Head & Shoulders Shampoo 340ml', 'PERS-002', '8901030382930', 'Personal Care & Hygiene', 'P&G', 'pcs', '330510', 210, 285, 310, 18, 35, 8, 'active'),
            ('Colgate Total Toothpaste 150g', 'PERS-003', '8901030382931', 'Personal Care & Hygiene', 'Colgate', 'pcs', '330610', 85, 115, 125, 18, 60, 15, 'active'),

            # Household Cleaning
            ('Surf Excel Matic Liquid Detergent 1L', 'CLEAN-001', '8901030382932', 'Household Cleaning', 'Surf Excel', 'pcs', '340220', 165, 220, 240, 18, 45, 10, 'active'),
            ('Vim Lemon Dishwash Gel 500ml', 'CLEAN-002', '8901030382933', 'Household Cleaning', 'Vim', 'pcs', '340220', 85, 110, 120, 18, 55, 12, 'active'),
            ('Harpic Power Plus Toilet Cleaner 1L', 'CLEAN-003', '8901030382934', 'Household Cleaning', 'Harpic', 'pcs', '340220', 135, 180, 195, 18, 2, 8, 'active'), # LOW STOCK SAMPLE

            # Packaged Foods
            ('Maggi 2-Minute Masala Noodles 4pk', 'PACK-001', '8901030382935', 'Packaged Foods', 'Nestle', 'pack', '190230', 44, 56, 60, 12, 100, 25, 'active'),
            ('Kissan Fresh Tomato Ketchup 1kg', 'PACK-002', '8901030382936', 'Packaged Foods', 'Kissan', 'pcs', '210320', 95, 130, 145, 12, 40, 10, 'active'),

            # Stationery & Office
            ('Classmate Notebook A4 240 Pages', 'STAT-001', '8901030382937', 'Stationery & Office', 'Classmate', 'pcs', '482010', 50, 75, 85, 12, 70, 15, 'active'),
            ('Reynolds 045 Fine Carbure Ball Pen', 'STAT-002', '8901030382938', 'Stationery & Office', 'Reynolds', 'pcs', '960810', 6, 10, 10, 12, 250, 50, 'active'),

            # Electronics & Accessories
            ('Portronics Type-C Fast Charging Cable', 'ELEC-001', '8901030382939', 'Electronics & Accessories', 'Portronics', 'pcs', '854442', 90, 180, 299, 18, 25, 6, 'active'),
            ('boAt BassHeads 100 Wired Earphones', 'ELEC-002', '8901030382940', 'Electronics & Accessories', 'boAt', 'pcs', '851830', 210, 399, 599, 18, 18, 5, 'active'),
            ('Duracell Ultra AA Batteries 4pk', 'ELEC-003', '8901030382941', 'Electronics & Accessories', 'Duracell', 'pack', '850610', 110, 160, 180, 18, 30, 8, 'inactive'),
        ]

        products_map = {}
        for (name, sku, barcode, cat_name, brand, unit, hsn, pp, sp, mrp, gst, stock, min_stock, status) in catalog:
            sup = random.choice(sup_objs)
            prod, created = Product.objects.update_or_create(
                business=business,
                sku=sku,
                defaults={
                    'name': name,
                    'barcode': barcode,
                    'category': cat_objs.get(cat_name),
                    'brand': brand,
                    'unit': unit,
                    'hsn_code': hsn,
                    'purchase_price': Decimal(str(pp)),
                    'selling_price': Decimal(str(sp)),
                    'mrp': Decimal(str(mrp)),
                    'gst_percent': Decimal(str(gst)),
                    'current_stock': Decimal(str(stock)),
                    'minimum_stock': Decimal(str(min_stock)),
                    'supplier': sup,
                    'status': status,
                }
            )
            products_map[sku] = prod

        # ============================================================
        # 7. CUSTOMERS
        # ============================================================
        self.stdout.write('Seeding customers with contact details & credit limits...')
        customers_info = [
            ('Walk-in Customer', '', '', 0, 'Retail Cash Customer'),
            ('Rahul Sharma', '9876543210', 'rahul.sharma@gmail.com', 15000, 'Flat 4A, Green Park Apartments, Chennai'),
            ('Priya Patel', '9876543211', 'priya.patel@yahoo.com', 10000, 'No. 18 Gandhi Street, T. Nagar, Chennai'),
            ('Amit Kumar', '9876543212', 'amit.k@hotmail.com', 8000, '32 Second Cross, Anna Nagar, Chennai'),
            ('Sunita Devi', '9876543213', 'sunita.devi@outlook.com', 5000, 'No. 5 Church Road, Royapettah, Chennai'),
            ('Rajesh Gupta', '9876543214', 'rajesh.g@rediffmail.com', 12000, 'Shop 12, Commercial Complex, Chennai'),
            ('Meena Singh', '9876543215', 'meena.singh@gmail.com', 6000, 'No. 89 Lake View Road, Adyar, Chennai'),
            ('Vikram Joshi', '9876543216', 'vikram.j@techcorp.in', 10000, '14 Velachery Main Road, Chennai'),
            ('Anita Verma', '9876543217', 'anita.verma@gmail.com', 4000, 'No. 22 Mount Road, Guindy, Chennai'),
            ('Suresh Nair', '9876543218', 'suresh.nair@chennaibiz.com', 15000, 'Flat 10B, Shanthi Heights, Chennai'),
        ]
        customers_list = []
        for name, mobile, email, credit, address in customers_info:
            c, _ = Customer.objects.update_or_create(
                business=business,
                name=name,
                defaults={
                    'mobile': mobile,
                    'email': email,
                    'credit_limit': Decimal(str(credit)),
                    'address': address,
                }
            )
            customers_list.append(c)

        # ============================================================
        # 8. PURCHASES (via PurchaseService)
        # ============================================================
        self.stdout.write('Seeding supplier purchases via PurchaseService...')
        active_products = [p for p in products_map.values() if p.status == 'active']
        all_purchases = []

        if Purchase.objects.filter(business=business).count() < 5:
            # Create 8 purchases across last 45 days
            for p_idx in range(8):
                days_ago = random.randint(5, 45)
                supplier = sup_objs[p_idx % len(sup_objs)]
                p_date = timezone.now() - timedelta(days=days_ago)

                # Select 3-6 products to purchase
                selected_prods = random.sample(active_products, random.randint(3, 6))
                items_data = []
                expected_total = Decimal('0')

                for prod in selected_prods:
                    qty = Decimal(str(random.randint(15, 50)))
                    cost = prod.purchase_price
                    gst = prod.gst_percent
                    line_amt = (qty * cost * (Decimal('1') + gst / Decimal('100'))).quantize(Decimal('0.01'))
                    expected_total += line_amt
                    items_data.append({
                        'product_id': prod.id,
                        'quantity': qty,
                        'purchase_price': cost,
                        'gst_percent': gst,
                    })

                # Decide if fully paid or partial
                paid = expected_total if p_idx % 2 == 0 else (expected_total * Decimal('0.6')).quantize(Decimal('0.01'))

                purchase = PurchaseService.create_purchase(
                    attributes={
                        'supplier': supplier,
                        'invoice_number': f'BILL-{supplier.name[:3].upper()}-{2000 + p_idx}',
                        'purchase_date': p_date.date(),
                        'paid_amount': paid,
                        'notes': f'Standard stock replenishment PO-{1000 + p_idx}',
                    },
                    items_data=items_data,
                    business=business,
                    created_by=admin_user,
                )

                # Backdate created_at timestamp
                Purchase.objects.filter(id=purchase.id).update(created_at=p_date)
                all_purchases.append(purchase)

        # ============================================================
        # 9. SUPPLIER PAYMENTS (via PaymentService)
        # ============================================================
        self.stdout.write('Seeding supplier payments via PaymentService...')
        unpaid_suppliers = Supplier.objects.filter(business=business, outstanding_amount__gt=0)
        for s in unpaid_suppliers[:3]:
            pay_amt = (s.outstanding_amount * Decimal('0.5')).quantize(Decimal('0.01'))
            if pay_amt > 0:
                PaymentService.record_supplier_payment(
                    attributes={
                        'supplier': s,
                        'amount': pay_amt,
                        'method': 'bank_transfer',
                        'reference': f'NEFT-{random.randint(10000000, 99999999)}',
                        'notes': 'Part payment toward outstanding purchases',
                    },
                    business=business,
                    created_by=admin_user,
                )

        # ============================================================
        # 10. INVOICES & SALES (via InvoiceService)
        # ============================================================
        self.stdout.write('Seeding retail & credit invoices via InvoiceService...')
        all_invoices = []
        if Invoice.objects.filter(business=business).count() < 10:
            for inv_i in range(26):
                days_ago = random.randint(0, 30)
                inv_date = timezone.now() - timedelta(days=days_ago)

                customer = random.choice(customers_list)
                # 3-5 random products per bill
                prods_sample = random.sample(active_products, random.randint(2, 5))
                items_payload = []
                for p in prods_sample:
                    # ensure stock is available or add a little if needed
                    if p.current_stock < 5:
                        p.current_stock = Decimal('60')
                        p.save()

                    items_payload.append({
                        'product_id': p.id,
                        'quantity': Decimal(str(random.randint(1, 3))),
                        'unit_price': p.selling_price,
                        'gst_percent': p.gst_percent,
                        'discount_percent': Decimal('5') if random.random() < 0.25 else Decimal('0'),
                        'hsn_code': p.hsn_code,
                        'mrp': p.mrp,
                    })

                # Decide payment mode and status
                method = random.choice(['cash', 'upi', 'card', 'cash', 'upi'])
                is_credit = (customer.name != 'Walk-in Customer' and random.random() < 0.20)

                # Pre-calculate to know amount
                from api.calculations import calculate_invoice
                calc = calculate_invoice(items_payload, tax_inclusive=False, bill_discount=Decimal('0'))

                if is_credit:
                    status_req = 'credit'
                    payments_payload = []
                else:
                    status_req = 'paid'
                    payments_payload = [{'method': method, 'amount': calc.grand_total}]

                invoice = InvoiceService.create_invoice(
                    attributes={
                        'customer': customer,
                        'customer_name': customer.name,
                        'customer_phone': customer.mobile,
                        'payment_method': 'credit' if is_credit else method,
                        'payment_status': status_req,
                        'status': 'completed',
                        'notes': 'Thank you for shopping with us!',
                    },
                    items_data=items_payload,
                    payments_data=payments_payload,
                    bill_discount=Decimal('0'),
                    business=business,
                    created_by=random.choice([admin_user, cashier_user]),
                )

                # Backdate invoice & payments
                Invoice.objects.filter(id=invoice.id).update(created_at=inv_date, posted_at=inv_date)
                Payment.objects.filter(invoice=invoice).update(created_at=inv_date)
                all_invoices.append(invoice)

        # ============================================================
        # 11. CUSTOMER PAYMENTS (via PaymentService)
        # ============================================================
        self.stdout.write('Seeding customer credit payments via PaymentService...')
        customers_with_dues = Customer.objects.filter(business=business, outstanding_amount__gt=0)
        for c in customers_with_dues[:3]:
            credit_payment_amt = (c.outstanding_amount * Decimal('0.5')).quantize(Decimal('0.01'))
            if credit_payment_amt > 0:
                PaymentService.record_customer_payment(
                    attributes={
                        'customer': c,
                        'amount': credit_payment_amt,
                        'method': 'upi',
                        'reference': f'UPI-CR-{random.randint(100000, 999999)}',
                        'notes': 'Customer settlement against credit purchase',
                    },
                    business=business,
                    created_by=admin_user,
                )

        # ============================================================
        # 12. STOCK ADJUSTMENTS (via InventoryService)
        # ============================================================
        self.stdout.write('Seeding stock adjustments and audit counts...')
        adjustments_plan = [
            (catalog[0][1], Decimal('5'), 'adjustment', 'Annual stock audit count adjustment'),
            (catalog[1][1], Decimal('-2'), 'damaged', 'Damaged bag during warehouse transport'),
            (catalog[2][1], Decimal('3'), 'stock_in', 'Inward discrepancy recount correction'),
            (catalog[3][1], Decimal('-1'), 'stock_out', 'Seal broken wastage written off'),
        ]
        for sku, qty, r_type, note in adjustments_plan:
            p_obj = products_map.get(sku)
            if p_obj:
                try:
                    InventoryService.adjust_stock(
                        product_id=p_obj.id,
                        quantity=qty,
                        transaction_type=r_type,
                        notes=note,
                        business=business,
                        created_by=admin_user,
                    )
                except Exception as exc:
                    self.stdout.write(f'Skipped adjustment for {sku}: {exc}')

        # ============================================================
        # 13. SALES RETURNS (via SalesReturnService)
        # ============================================================
        self.stdout.write('Seeding sales returns via SalesReturnService...')
        completed_invoices = Invoice.objects.filter(business=business, status='completed').order_by('-id')
        if completed_invoices.exists() and SalesReturn.objects.filter(business=business).count() < 2:
            return_target_inv = completed_invoices.first()
            first_item = return_target_inv.items.first()
            if first_item:
                try:
                    SalesReturnService.create_sales_return(
                        invoice_id=return_target_inv.id,
                        reason='Customer requested exchange of sealed product',
                        refund_method='cash',
                        items_data=[{
                            'invoice_item_id': first_item.id,
                            'quantity': Decimal('1'),
                        }],
                        business=business,
                        created_by=admin_user,
                    )
                except Exception as e:
                    self.stdout.write(f'Sales return note: {e}')

        # ============================================================
        # 14. PURCHASE RETURNS (via PurchaseReturnService)
        # ============================================================
        self.stdout.write('Seeding purchase returns via PurchaseReturnService...')
        sample_purchases = Purchase.objects.filter(business=business).order_by('-id')
        if sample_purchases.exists() and PurchaseReturn.objects.filter(business=business).count() < 1:
            p_return_target = sample_purchases.first()
            p_first_item = p_return_target.items.first()
            if p_first_item and p_first_item.quantity >= 2:
                try:
                    PurchaseReturnService.create_purchase_return(
                        purchase_id=p_return_target.id,
                        reason='Damaged cartons returned back to distributor',
                        items_data=[{
                            'purchase_item_id': p_first_item.id,
                            'quantity': Decimal('1'),
                        }],
                        business=business,
                        created_by=admin_user,
                    )
                except Exception as e:
                    self.stdout.write(f'Purchase return note: {e}')

        # ============================================================
        # 15. EXPENSE CATEGORIES & EXPENSES
        # ============================================================
        self.stdout.write('Seeding expense categories & operational expenses...')
        expense_cats = [
            'Shop Rent',
            'Electricity & Power',
            'Staff Payroll',
            'Store Upkeep & Repair',
            'Packaging & Bags',
            'Internet & Software',
            'Transportation & Freight',
        ]
        exp_cat_objs = {}
        for ec in expense_cats:
            obj, _ = ExpenseCategory.objects.get_or_create(business=business, name=ec)
            exp_cat_objs[ec] = obj

        if Expense.objects.filter(business=business).count() < 8:
            sample_expenses = [
                ('Shop Rent', 'Monthly Store Lease for T. Nagar premises', 35000, 'bank_transfer', 25),
                ('Electricity & Power', 'TNEB Commercial Power Bill', 6450, 'upi', 20),
                ('Staff Payroll', 'Monthly Cashier Salary Advance', 14000, 'bank_transfer', 15),
                ('Store Upkeep & Repair', 'A/C Servicing & filter change', 1850, 'cash', 12),
                ('Packaging & Bags', 'Custom printed biodegradable carry bags (5000 pcs)', 4200, 'upi', 10),
                ('Internet & Software', 'High speed fiber broadband & cloud ERP backup', 1199, 'card', 7),
                ('Transportation & Freight', 'Local tempos for wholesale goods movement', 2500, 'cash', 4),
                ('Electricity & Power', 'Store lighting LED replacement', 1200, 'cash', 2),
            ]
            for c_name, desc, amt, pay_meth, days_ago in sample_expenses:
                Expense.objects.create(
                    business=business,
                    category=exp_cat_objs[c_name],
                    description=desc,
                    amount=Decimal(str(amt)),
                    payment_method=pay_meth,
                    expense_date=(timezone.now() - timedelta(days=days_ago)).date(),
                    notes='Authorized regular business operational expense',
                    created_by=admin_user,
                )

        # ============================================================
        # 16. PAYMENT RECONCILIATION RECORDS (RazorpayTransaction)
        # ============================================================
        self.stdout.write('Seeding payment gateway reconciliation records...')
        upi_invoices = Invoice.objects.filter(business=business, payment_method='upi').order_by('-id')
        if upi_invoices.exists() and RazorpayTransaction.objects.filter(invoice__business=business).count() < 3:
            for idx, inv in enumerate(upi_invoices[:4]):
                status = 'settled' if idx < 3 else 'authorized'
                RazorpayTransaction.objects.create(
                    invoice=inv,
                    provider='razorpay',
                    merchant_transaction_id=f'TXN_{inv.invoice_number}',
                    razorpay_order_id=f'order_demo_{inv.id}_{random.randint(1000, 9999)}',
                    razorpay_payment_id=f'pay_demo_{inv.id}_{random.randint(1000, 9999)}',
                    razorpay_signature='sig_demo_verified_hash',
                    amount=inv.grand_total,
                    status=status,
                    response_code='SUCCESS',
                    provider_reference=f'rrn_{random.randint(100000000000, 999999999999)}',
                    response_data='{"status": "captured", "method": "upi"}',
                )

        # ============================================================
        # 17. AUDIT LOGS
        # ============================================================
        self.stdout.write('Seeding system audit trails...')
        if AuditLog.objects.filter(business=business).count() < 5:
            audit_events = [
                ('USER_LOGIN', 'Auth', 'User', str(admin_user.id), 'Administrator logged in from POS terminal'),
                ('INVOICE_CREATED', 'Invoices', 'Invoice', 'INV-1001', 'Sale invoice completed successfully'),
                ('STOCK_ADJUSTED', 'Inventory', 'Product', 'RICE-001', 'Physical inventory adjustment +5 verified'),
                ('SETTINGS_UPDATED', 'Settings', 'Setting', 'invoice_prefix', 'Invoice settings verified and synchronized'),
                ('PRICE_UPDATED', 'Catalog', 'Product', 'OIL-001', 'Selling price aligned with new MRP rate'),
            ]
            for action, module, entity, entity_id, note in audit_events:
                AuditLog.objects.create(
                    user=admin_user,
                    business=business,
                    action=action,
                    module=module,
                    entity=entity,
                    entity_id=entity_id,
                    new_value=note,
                    ip_address='127.0.0.1',
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Billing-ERP/1.0',
                    result='success',
                )

        # ============================================================
        # COMPLETION SUMMARY
        # ============================================================
        self.stdout.write(self.style.SUCCESS('========================================================'))
        self.stdout.write(self.style.SUCCESS('*** Billing ERP Demo Data Seed Completed Successfully! ***'))
        self.stdout.write(self.style.SUCCESS('========================================================'))
        self.stdout.write(f'- Business: {business.name} (Display: SRI BALAJI STORE)')
        self.stdout.write(f'- Products Seeded: {Product.objects.filter(business=business).count()}')
        self.stdout.write(f'- Categories: {Category.objects.filter(business=business).count()}')
        self.stdout.write(f'- Suppliers: {Supplier.objects.filter(business=business).count()}')
        self.stdout.write(f'- Customers: {Customer.objects.filter(business=business).count()}')
        self.stdout.write(f'- Purchases (Inward): {Purchase.objects.filter(business=business).count()}')
        self.stdout.write(f'- Invoices (Sales): {Invoice.objects.filter(business=business).count()}')
        self.stdout.write(f'- Stock Movements: {InventoryTransaction.objects.filter(business=business).count()}')
        self.stdout.write(f'- Sales Returns: {SalesReturn.objects.filter(business=business).count()}')
        self.stdout.write(f'- Purchase Returns: {PurchaseReturn.objects.filter(business=business).count()}')
        self.stdout.write(f'- Expenses: {Expense.objects.filter(business=business).count()}')
        self.stdout.write(f'- Reconciliation Txns: {RazorpayTransaction.objects.filter(invoice__business=business).count()}')
        self.stdout.write(f'- Audit Logs: {AuditLog.objects.filter(business=business).count()}')
        self.stdout.write('--------------------------------------------------------')
        self.stdout.write('Default Credentials:')
        self.stdout.write('  Admin:    admin   / admin123')
        self.stdout.write('  Cashier:  cashier / cashier123')
        self.stdout.write('  Manager:  manager / manager123')
        self.stdout.write('========================================================')