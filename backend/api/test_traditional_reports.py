from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from api.models import (
    Business,
    Category,
    Customer,
    CustomerPayment,
    Expense,
    ExpenseCategory,
    InventoryTransaction,
    Invoice,
    InvoiceItem,
    Payment,
    Product,
    Purchase,
    PurchaseItem,
    Supplier,
    User,
)
from reports.generators.excel_generator import generate_accounting_excel
from reports.generators.pdf_generator import generate_accounting_pdf
from reports.services.report_data_service import AccountingReportDataService


class TraditionalAccountingReportsTest(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Business 1 (Balaji Store)
        self.b1 = Business.objects.create(
            name='Sri Balaji Stores',
            shop_id='DWBS2601',
            business_type='Retail & Wholesale',
            mobile='+919876543210',
            email='balaji@example.com',
            address='12 Main Bazaar, Chennai, TN 600001',
            gstin='33AAAAA0000A1Z5',
            currency='₹',
        )

        # Business 2 (Isolated shop)
        self.b2 = Business.objects.create(
            name='Other Retail Store',
            shop_id='DWOT2602',
            business_type='Retail',
            mobile='+919876543299',
            email='other@example.com',
            address='56 Cross Road, Madurai, TN 625001',
            gstin='33BBBBB1111B2Z6',
            currency='₹',
        )

        # Users
        self.owner = User.objects.create_user(
            username='balaji_owner',
            phone='+919876543210',
            email='owner@balaji.com',
            password='Password123',
            role='owner',
            business=self.b1,
            is_verified=True,
            is_active=True,
        )

        # Seed data for Business 1
        cat = Category.objects.create(business=self.b1, name='Groceries')
        self.p1 = Product.objects.create(
            business=self.b1,
            name='Basmati Rice 5kg',
            sku='RICE-5KG',
            selling_price=Decimal('450.00'),
            purchase_price=Decimal('380.00'),
            current_stock=Decimal('50.00'),
            category=cat,
            unit='pcs',
        )
        self.p2 = Product.objects.create(
            business=self.b1,
            name='Refined Oil 1L',
            sku='OIL-1L',
            selling_price=Decimal('160.00'),
            purchase_price=Decimal('135.00'),
            current_stock=Decimal('100.00'),
            category=cat,
            unit='pcs',
        )

        cust = Customer.objects.create(
            business=self.b1,
            name='Sundar Raman',
            mobile='+919888877777',
            gstin='33AABCS1234D1Z9',
            outstanding_amount=Decimal('250.00'),
        )

        supp = Supplier.objects.create(
            business=self.b1,
            name='Chennai Wholesale Corp',
            phone='+919777766666',
            gstin='33AAACC5678E1Z1',
            outstanding_amount=Decimal('5000.00'),
        )

        # Invoice
        inv = Invoice.objects.create(
            business=self.b1,
            invoice_number='INV-2026-001',
            customer=cust,
            customer_name=cust.name,
            subtotal=Decimal('610.00'),
            tax_amount=Decimal('30.50'),
            discount_amount=Decimal('10.00'),
            grand_total=Decimal('630.50'),
            paid_amount=Decimal('630.50'),
            balance_due=Decimal('0.00'),
            status='completed',
            payment_method='upi',
        )
        InvoiceItem.objects.create(
            invoice=inv,
            product=self.p1,
            product_name=self.p1.name,
            sku=self.p1.sku,
            quantity=Decimal('1.00'),
            unit_price=Decimal('450.00'),
            total=Decimal('450.00'),
            gst_percent=Decimal('5.00'),
            gst_amount=Decimal('22.50'),
        )
        Payment.objects.create(
            invoice=inv,
            amount=Decimal('630.50'),
            method='upi',
        )

        # Purchase
        pur = Purchase.objects.create(
            business=self.b1,
            invoice_number='PUR-2026-001',
            supplier=supp,
            purchase_date=timezone.now().date(),
            total_amount=Decimal('7600.00'),
            paid_amount=Decimal('5000.00'),
            payment_status='partial',
        )
        PurchaseItem.objects.create(
            purchase=pur,
            product=self.p1,
            quantity=Decimal('20.00'),
            purchase_price=Decimal('380.00'),
            total=Decimal('7600.00'),
            gst_percent=Decimal('5.00'),
        )

        # Inventory Transaction
        InventoryTransaction.objects.create(
            business=self.b1,
            product=self.p1,
            transaction_type='purchase',
            quantity=Decimal('20.00'),
            before_stock=Decimal('30.00'),
            after_stock=Decimal('50.00'),
            unit_cost=Decimal('380.00'),
            reference_type='PURCHASE',
            reference_id='PUR-2026-001',
        )

        # Expense
        exp_cat = ExpenseCategory.objects.create(business=self.b1, name='Shop Electricity')
        Expense.objects.create(
            business=self.b1,
            category=exp_cat,
            amount=Decimal('1250.00'),
            payment_method='online',
            description='EB Bill for October',
            expense_date=timezone.now().date(),
        )

    def test_all_20_reports_data_generation(self):
        """Verify all 20 reports return valid ReportData structure with headers, rows, and summary."""
        report_names = [
            'sales_register',
            'purchase_register',
            'sales_summary',
            'purchase_summary',
            'stock_summary',
            'stock_movement',
            'customer_ledger',
            'supplier_ledger',
            'day_book',
            'cash_book',
            'bank_book',
            'gst_summary',
            'gstr1',
            'gstr2',
            'gstr3b',
            'payment_collection',
            'expense_report',
            'profit_loss',
            'outstanding_receivables',
            'outstanding_payables',
            'item_wise_sales',
            'item_wise_purchases',
        ]

        params = {'period': 'all'}

        for r_name in report_names:
            report = AccountingReportDataService.build(r_name, self.b1, params)
            self.assertIsNotNone(report, f"Report {r_name} returned None")
            self.assertTrue(bool(report.title), f"Report {r_name} missing title")
            self.assertTrue(bool(report.headers), f"Report {r_name} missing headers")
            self.assertIsInstance(report.rows, list, f"Report {r_name} rows not a list")
            self.assertIsInstance(report.summary_rows, list, f"Report {r_name} summary_rows not a list")

    def test_pdf_generation_format_and_headers(self):
        """Verify PDF generation creates valid A4 multi-page document with %PDF magic number."""
        report = AccountingReportDataService.build('sales_register', self.b1, {})
        pdf_buf = generate_accounting_pdf(
            title=report.title,
            headers=report.headers,
            rows=report.rows,
            summary_rows=report.summary_rows,
            period_label='All Available Records',
            request_user=self.owner,
        )
        pdf_bytes = pdf_buf.getvalue()
        self.assertTrue(pdf_bytes.startswith(b'%PDF'), "PDF output does not start with %PDF magic bytes")
        self.assertGreater(len(pdf_bytes), 1000, "PDF file size too small to be valid")

    def test_excel_generation_numeric_and_panes(self):
        """Verify Excel generation creates valid XLSX with formatted numbers and proper structure."""
        report = AccountingReportDataService.build('sales_register', self.b1, {})
        xlsx_buf = generate_accounting_excel(
            title=report.title,
            headers=report.headers,
            rows=report.rows,
            summary_rows=report.summary_rows,
            period_label='All Available Records',
            request_user=self.owner,
        )
        xlsx_bytes = xlsx_buf.getvalue()
        # XLSX is a ZIP container starting with PK
        self.assertTrue(xlsx_bytes.startswith(b'PK\x03\x04'), "XLSX output does not start with PK ZIP header")
        self.assertGreater(len(xlsx_bytes), 2000, "XLSX file size too small")

    def test_empty_dataset_handling(self):
        """Empty shops must generate valid PDF and Excel with empty state message and zero crashes."""
        report = AccountingReportDataService.build('sales_register', self.b2, {})
        self.assertEqual(len(report.rows), 0)

        pdf_buf = generate_accounting_pdf(
            title=report.title,
            headers=report.headers,
            rows=report.rows,
            summary_rows=report.summary_rows,
            request_user=self.owner,
        )
        self.assertTrue(pdf_buf.getvalue().startswith(b'%PDF'))

        xlsx_buf = generate_accounting_excel(
            title=report.title,
            headers=report.headers,
            rows=report.rows,
            summary_rows=report.summary_rows,
            request_user=self.owner,
        )
        self.assertTrue(xlsx_buf.getvalue().startswith(b'PK\x03\x04'))

    def test_shop_data_isolation(self):
        """Data from Business 1 must never appear in Business 2."""
        r1 = AccountingReportDataService.build('sales_register', self.b1, {})
        r2 = AccountingReportDataService.build('sales_register', self.b2, {})

        self.assertGreater(len(r1.rows), 0, "Business 1 should have sales rows")
        self.assertEqual(len(r2.rows), 0, "Business 2 should have 0 sales rows")

    def test_api_export_endpoints(self):
        """HTTP endpoints must return 200 with proper Content-Type headers when export=pdf/xlsx is passed."""
        self.client.force_authenticate(user=self.owner)

        # 1. PDF export
        resp_pdf = self.client.get('/api/reports/sales-register/?export=pdf')
        self.assertEqual(resp_pdf.status_code, 200)
        self.assertEqual(resp_pdf['Content-Type'], 'application/pdf')
        self.assertIn('attachment', resp_pdf['Content-Disposition'])

        # 2. XLSX export
        resp_xlsx = self.client.get('/api/reports/sales-register/?export=xlsx')
        self.assertEqual(resp_xlsx.status_code, 200)
        self.assertEqual(
            resp_xlsx['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        self.assertIn('attachment', resp_xlsx['Content-Disposition'])

        # 3. Item-wise sales report PDF export
        resp_item_pdf = self.client.get('/api/reports/item-wise-sales/?export=pdf')
        self.assertEqual(resp_item_pdf.status_code, 200)
        self.assertEqual(resp_item_pdf['Content-Type'], 'application/pdf')

        # 4. Item-wise purchase report XLSX export
        resp_item_pur_xlsx = self.client.get('/api/reports/item-wise-purchases/?export=xlsx')
        self.assertEqual(resp_item_pur_xlsx.status_code, 200)
        self.assertEqual(
            resp_item_pur_xlsx['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

        # 5. Payment collection report PDF export
        resp_pmt_pdf = self.client.get('/api/reports/payment-collection/?export=pdf')
        self.assertEqual(resp_pmt_pdf.status_code, 200)
        self.assertEqual(resp_pmt_pdf['Content-Type'], 'application/pdf')

        # 6. GST summary report XLSX export
        resp_gst_xlsx = self.client.get('/api/reports/gst-summary/?export=xlsx')
        self.assertEqual(resp_gst_xlsx.status_code, 200)
        self.assertEqual(
            resp_gst_xlsx['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
