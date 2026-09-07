from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from unittest import skipUnless

from django.db import connection
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, TransactionTestCase
from rest_framework.test import APIClient

from .calculations import calculate_invoice
from .models import (
    AuditLog,
    Business,
    Customer,
    CustomerLedger,
    CustomerPayment,
    Expense,
    InventoryTransaction,
    Invoice,
    InvoiceItem,
    Payment,
    Product,
    Purchase,
    PurchaseItem,
    PurchaseReturn,
    SalesReturn,
    Setting,
    Supplier,
    SupplierPayment,
    SupplierLedger,
    User,
)
from .services.invoice_service import InvoiceService
from .utils import get_next_invoice_number
from .pdf_utils import invoice_tax_breakup, item_tax_breakup
from .services.inventory_service import InventoryService
from .services.ledger_service import LedgerService


class InvoiceBusinessRuleTests(SimpleTestCase):
    def test_tax_inclusive_and_exclusive_totals(self):
        exclusive = calculate_invoice([{
            'quantity': '1', 'unit_price': '100', 'gst_percent': '18',
        }], tax_inclusive=False, round_total=False)
        inclusive = calculate_invoice([{
            'quantity': '1', 'unit_price': '118', 'gst_percent': '18',
        }], tax_inclusive=True, round_total=False)
        self.assertEqual(exclusive.subtotal, Decimal('100.00'))
        self.assertEqual(exclusive.tax_amount, Decimal('18.00'))
        self.assertEqual(exclusive.grand_total, Decimal('118.00'))
        self.assertEqual(inclusive.subtotal, Decimal('100.00'))
        self.assertEqual(inclusive.tax_amount, Decimal('18.00'))
        self.assertEqual(inclusive.grand_total, Decimal('118.00'))

    def test_item_discount_bill_discount_gst_and_rounding(self):
        result = calculate_invoice([{
            'quantity': '3', 'unit_price': '19.99', 'discount_percent': '10', 'gst_percent': '18',
        }], bill_discount='1.11')
        self.assertEqual(result.discount_amount, Decimal('7.11'))
        self.assertEqual(result.tax_amount, Decimal('9.51'))
        self.assertEqual(result.grand_total, Decimal('62.00'))
        self.assertEqual(result.round_off, Decimal('-0.37'))

    def test_tax_breakup_supports_cgst_sgst_and_igst_without_recalculation(self):
        invoice = type('InvoiceStub', (), {'tax_amount': Decimal('18.00'), 'igst_amount': None, 'sgst_amount': None, 'cgst_amount': None})()
        self.assertEqual(invoice_tax_breakup(invoice, interstate=False), (Decimal('9.00'), Decimal('9.00'), Decimal('0.00')))
        self.assertEqual(invoice_tax_breakup(invoice, interstate=True), (Decimal('0.00'), Decimal('0.00'), Decimal('18.00')))
        item = type('ItemStub', (), {'gst_amount': Decimal('9.00'), 'igst_amount': None, 'sgst_amount': None, 'cgst_amount': None})()
        self.assertEqual(item_tax_breakup(item, interstate=False), (Decimal('4.50'), Decimal('4.50'), Decimal('0.00')))


class BusinessRuleAPITests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name='Rules Business')
        self.user = User.objects.create_user(username='rules-admin', password='password', role='admin', business=self.business)
        self.product = Product.objects.create(
            business=self.business, name='Rules Product', sku='RULE-1',
            purchase_price=Decimal('10'), selling_price=Decimal('20'),
            current_stock=Decimal('10'), minimum_stock=Decimal('2'), gst_percent=Decimal('18'),
        )
        self.customer = Customer.objects.create(
            business=self.business, name='Rules Customer', credit_limit=Decimal('100'),
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def invoice_payload(self, **overrides):
        payload = {
            'customer': self.customer.pk,
            'customer_name': self.customer.name,
            'payment_status': 'paid',
            'payment_method': 'cash',
            'items': [{
                'product_id': self.product.pk, 'quantity': '2', 'unit_price': '20',
                'discount_percent': '0', 'gst_percent': '18',
            }],
            'payments': [{'method': 'cash', 'amount': '47.00'}],
        }
        payload.update(overrides)
        return payload

    def create_invoice(self, **overrides):
        response = self.client.post('/api/invoices/', self.invoice_payload(**overrides), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def test_normal_sale_stock_gst_payment_and_audit(self):
        response = self.create_invoice()
        invoice = Invoice.objects.get(pk=response.data['id'])
        self.product.refresh_from_db()
        self.assertEqual(invoice.grand_total, Decimal('47.00'))
        self.assertEqual(invoice.payment_status, 'paid')
        self.assertEqual(self.product.current_stock, Decimal('8.00'))
        self.assertTrue(InventoryTransaction.objects.filter(reference=invoice.invoice_number, transaction_type='sale').exists())
        self.assertTrue(AuditLog.objects.filter(action='INVOICE_CREATED', entity_id=str(invoice.pk)).exists())

    def test_partial_payment_credit_sale_and_credit_limit(self):
        partial = self.create_invoice(
            payment_status='partial', payments=[{'method': 'cash', 'amount': '10'}],
        )
        self.assertEqual(partial.data['payment_status'], 'partial')
        self.assertEqual(partial.data['balance_due'], '37.00')
        credit = self.client.post('/api/invoices/', self.invoice_payload(
            payment_status='credit', payment_method='credit', payments=[],
        ), format='json')
        self.assertEqual(credit.status_code, 201, credit.data)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.outstanding_amount, Decimal('84.00'))

        self.customer.credit_limit = Decimal('100')
        self.customer.save(update_fields=['credit_limit'])
        rejected = self.client.post('/api/invoices/', self.invoice_payload(
            payment_status='credit', payment_method='credit', payments=[],
        ), format='json')
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(Invoice.objects.filter(business=self.business).count(), 2)

    def test_negative_stock_setting_and_insufficient_stock(self):
        rejected = self.client.post('/api/invoices/', self.invoice_payload(
            items=[{'product_id': self.product.pk, 'quantity': '11', 'unit_price': '20', 'gst_percent': '0'}],
            payments=[{'method': 'cash', 'amount': '220'}],
        ), format='json')
        self.assertEqual(rejected.status_code, 400)
        self.assertFalse(Invoice.objects.filter(business=self.business).exists())

        Setting.objects.create(business=self.business, key='allow_negative_stock', value='true')
        allowed = self.client.post('/api/invoices/', self.invoice_payload(
            items=[{'product_id': self.product.pk, 'quantity': '11', 'unit_price': '20', 'gst_percent': '0'}],
            payments=[{'method': 'cash', 'amount': '220'}],
        ), format='json')
        self.assertEqual(allowed.status_code, 201, allowed.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, Decimal('-1.00'))

    def test_overpayment_is_explicit_and_customer_payment_updates_ledger(self):
        response = self.create_invoice(
            payments=[{'method': 'cash', 'amount': '50'}],
        )
        self.assertEqual(response.data['payment_status'], 'overpaid')
        payment = self.client.post('/api/customer-payments/', {
            'customer': self.customer.pk, 'amount': '10', 'method': 'cash',
        }, format='json')
        self.assertEqual(payment.status_code, 201, payment.data)
        self.assertEqual(LedgerService.reconcile_customer(customer_id=self.customer.pk, business=self.business), Decimal('0'))

    def test_adjustment_bulk_import_and_purchase(self):
        adjustment = self.client.post('/api/inventory/adjust/', {
            'product_id': self.product.pk, 'quantity': '2', 'transaction_type': 'adjustment',
        }, format='json')
        self.assertEqual(adjustment.status_code, 200, adjustment.data)
        bulk = self.client.post('/api/inventory/bulk-adjust/', {
            'items': [{'product_id': self.product.pk, 'quantity': '-1'}],
        }, format='json')
        self.assertEqual(bulk.status_code, 200, bulk.data)
        supplier = Supplier.objects.create(business=self.business, name='Rules Supplier')
        purchase = self.client.post('/api/purchases/', {
            'supplier': supplier.pk, 'purchase_date': '2026-09-07',
            'items': [{'product': self.product.pk, 'quantity': '3', 'purchase_price': '10'}],
        }, format='json')
        self.assertEqual(purchase.status_code, 201, purchase.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, Decimal('14.00'))
        self.assertTrue(InventoryTransaction.objects.filter(transaction_type='purchase').exists())

        import_file = SimpleUploadedFile(
            'stock.csv', b'SKU,Quantity\nRULE-1,2\n', content_type='text/csv',
        )
        imported = self.client.post('/api/inventory/import/', {'file': import_file}, format='multipart')
        self.assertEqual(imported.status_code, 200, imported.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, Decimal('16.00'))

    def test_purchase_return_and_invoice_cancellation_restore_stock(self):
        supplier = Supplier.objects.create(business=self.business, name='Return Supplier')
        purchase = self.client.post('/api/purchases/', {
            'supplier': supplier.pk, 'purchase_date': '2026-09-07',
            'items': [{'product': self.product.pk, 'quantity': '3', 'purchase_price': '10'}],
        }, format='json')
        self.assertEqual(purchase.status_code, 201, purchase.data)
        purchase_item_id = purchase.data['items'][0]['id']
        returned = self.client.post('/api/purchase-returns/', {
            'purchase': purchase.data['id'],
            'items': [{'purchase_item_id': purchase_item_id, 'quantity': '1'}],
        }, format='json')
        self.assertEqual(returned.status_code, 201, returned.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, Decimal('12.00'))

        invoice = self.create_invoice()
        self.product.refresh_from_db()
        before_cancel = self.product.current_stock
        cancelled = self.client.post(f'/api/invoices/{invoice.data["id"]}/cancel/')
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, before_cancel + Decimal('2.00'))
        self.assertEqual(Invoice.objects.get(pk=invoice.data['id']).status, 'cancelled')

    def test_customer_and_supplier_payment_paths(self):
        customer_payment = self.client.post('/api/customer-payments/', {
            'customer': self.customer.pk, 'amount': '10', 'method': 'cash',
        }, format='json')
        self.assertEqual(customer_payment.status_code, 201, customer_payment.data)
        supplier = Supplier.objects.create(business=self.business, name='Pay Supplier')
        purchase = self.client.post('/api/purchases/', {
            'supplier': supplier.pk, 'purchase_date': '2026-09-07',
            'items': [{'product': self.product.pk, 'quantity': '5', 'purchase_price': '10'}],
        }, format='json')
        self.assertEqual(purchase.status_code, 201, purchase.data)
        supplier_payment = self.client.post('/api/supplier-payments/', {
            'supplier': supplier.pk, 'amount': '20', 'method': 'upi',
        }, format='json')
        self.assertEqual(supplier_payment.status_code, 201, supplier_payment.data)
        supplier.refresh_from_db()
        self.assertEqual(supplier.outstanding_amount, Decimal('30'))
        self.assertEqual(LedgerService.reconcile_supplier(supplier_id=supplier.pk, business=self.business), Decimal('30'))

    def test_partial_full_duplicate_excessive_and_cancel_refund_returns(self):
        invoice = self.create_invoice()
        item_id = invoice.data['items'][0]['id']
        partial = self.client.post('/api/sales-returns/', {
            'invoice': invoice.data['id'], 'items': [{'invoice_item_id': item_id, 'quantity': '1'}],
        }, format='json')
        self.assertEqual(partial.status_code, 201, partial.data)
        invoice_obj = Invoice.objects.get(pk=invoice.data['id'])
        self.assertEqual(invoice_obj.status, 'partially_refunded')
        duplicate = self.client.post('/api/sales-returns/', {
            'invoice': invoice.data['id'], 'items': [{'invoice_item_id': item_id, 'quantity': '1'}],
        }, format='json')
        self.assertEqual(duplicate.status_code, 201, duplicate.data)
        excessive = self.client.post('/api/sales-returns/', {
            'invoice': invoice.data['id'], 'items': [{'invoice_item_id': item_id, 'quantity': '1'}],
        }, format='json')
        self.assertEqual(excessive.status_code, 400)
        invoice_obj.refresh_from_db()
        self.assertEqual(invoice_obj.status, 'refunded')
        after_full = self.product.current_stock
        refund_again = self.client.post(f'/api/invoices/{invoice.data["id"]}/refund/')
        self.assertEqual(refund_again.status_code, 400)
        self.assertEqual(Invoice.objects.get(pk=invoice.data['id']).status, 'refunded')
        self.assertEqual(Product.objects.get(pk=self.product.pk).current_stock, after_full)

    def test_invoice_numbering_configuration_existing_and_business_scope(self):
        Setting.objects.create(business=self.business, key='invoice_prefix', value='SALE')
        Setting.objects.create(business=self.business, key='invoice_start_number', value='500')
        first = self.create_invoice()
        self.assertEqual(first.data['invoice_number'], 'SALE-0500')
        Invoice.objects.create(business=self.business, invoice_number='SALE-0999', customer_name='Existing')
        next_invoice = self.create_invoice()
        self.assertEqual(next_invoice.data['invoice_number'], 'SALE-1000')


class TenantIsolationTests(TestCase):
    def setUp(self):
        self.business_a = Business.objects.create(name='Business A')
        self.business_b = Business.objects.create(name='Business B')
        self.user_a = User.objects.create_user(username='tenant-a', password='password', role='admin', business=self.business_a)
        self.user_b = User.objects.create_user(username='tenant-b', password='password', role='admin', business=self.business_b)
        self.product_a = Product.objects.create(business=self.business_a, name='A Product', sku='A-1', purchase_price=5, selling_price=10, current_stock=5)
        self.product_b = Product.objects.create(business=self.business_b, name='B Product', sku='B-1', purchase_price=5, selling_price=10, current_stock=5)
        self.customer_a = Customer.objects.create(business=self.business_a, name='A Customer')
        self.customer_b = Customer.objects.create(business=self.business_b, name='B Customer')
        self.supplier_a = Supplier.objects.create(business=self.business_a, name='A Supplier')
        self.supplier_b = Supplier.objects.create(business=self.business_b, name='B Supplier')
        self.client = APIClient()
        self.client.force_authenticate(self.user_a)

    def test_tenant_lists_detail_mutations_and_cross_tenant_references(self):
        list_expectations = {
            '/api/products/': 'A Product', '/api/customers/': 'A Customer',
            '/api/suppliers/': 'A Supplier', '/api/invoices/': None,
            '/api/purchases/': None, '/api/inventory/': None,
            '/api/expenses/': None, '/api/settings/': None,
            '/api/audit-logs/': None,
        }
        for path, expected in list_expectations.items():
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)
            body = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
            text = str(body)
            self.assertIn(expected, text) if expected else self.assertNotIn('B Product', text)

        detail = self.client.get(f'/api/products/{self.product_b.pk}/')
        self.assertEqual(detail.status_code, 404)
        update = self.client.patch(f'/api/products/{self.product_b.pk}/', {'name': 'Hijacked'}, format='json')
        self.assertEqual(update.status_code, 404)
        foreign_product_invoice = self.client.post('/api/invoices/', {
            'payment_status': 'paid', 'payment_method': 'cash',
            'items': [{'product_id': self.product_b.pk, 'quantity': '1', 'unit_price': '10', 'gst_percent': '0'}],
            'payments': [{'method': 'cash', 'amount': '10'}],
        }, format='json')
        self.assertEqual(foreign_product_invoice.status_code, 400)

    def test_tenant_reports_search_settings_pdf_and_exports_do_not_leak(self):
        foreign_invoice = Invoice.objects.create(business=self.business_b, invoice_number='B-1001', customer_name='B Customer', grand_total=10)
        Setting.objects.create(business=self.business_b, key='shop_name', value='Business B')
        self.client.force_authenticate(self.user_a)
        for path in ('sales', 'products', 'profit', 'gst', 'customers', 'payments', 'expenses'):
            response = self.client.get(f'/api/reports/{path}/')
            self.assertEqual(response.status_code, 200, path)
            self.assertNotIn('B Customer', str(response.data))
        search = self.client.get('/api/search/?q=B%20Customer')
        self.assertEqual(search.status_code, 200)
        self.assertNotIn('B Customer', str(search.data))
        pdf = self.client.get(f'/api/invoices/{foreign_invoice.pk}/pdf/')
        self.assertEqual(pdf.status_code, 404)
        export = self.client.get('/api/reports/sales/?export=xlsx')
        self.assertEqual(export.status_code, 200)
        self.assertNotIn(b'B Customer', export.content)
        settings = self.client.get('/api/settings/all/')
        self.assertEqual(settings.status_code, 200)
        self.assertNotEqual(settings.data.get('shop_name'), 'Business B')

    def test_returns_payments_expenses_and_audit_are_tenant_scoped(self):
        foreign_invoice = Invoice.objects.create(business=self.business_b, invoice_number='B-2001', customer=self.customer_b, customer_name='B Customer', grand_total=10)
        self.client.force_authenticate(self.user_a)
        foreign_payment = self.client.post('/api/customer-payments/', {'customer': self.customer_b.pk, 'amount': '1', 'method': 'cash'}, format='json')
        self.assertEqual(foreign_payment.status_code, 400)
        foreign_return = self.client.post('/api/sales-returns/', {'invoice': foreign_invoice.pk, 'items': []}, format='json')
        self.assertEqual(foreign_return.status_code, 400)
        expense = self.client.post('/api/expenses/', {'description': 'A Expense', 'amount': '5', 'payment_method': 'cash', 'expense_date': '2026-09-07'}, format='json')
        self.assertEqual(expense.status_code, 201, expense.data)
        self.assertNotIn('B Customer', str(self.client.get('/api/audit-logs/').data))

    def test_all_major_tenant_domains_exclude_foreign_records(self):
        foreign_invoice = Invoice.objects.create(
            business=self.business_b, invoice_number='B-3001', customer=self.customer_b,
            customer_name='B Customer', grand_total=10, paid_amount=10,
        )
        foreign_item = InvoiceItem.objects.create(
            invoice=foreign_invoice, product=self.product_b, product_name='B Product',
            quantity=1, unit_price=10, cost_price=5, total=10,
        )
        Payment.objects.create(invoice=foreign_invoice, method='cash', amount=10)
        foreign_purchase = Purchase.objects.create(
            business=self.business_b, supplier=self.supplier_b,
            purchase_date='2026-09-07', total_amount=10, paid_amount=0,
        )
        PurchaseItem.objects.create(
            purchase=foreign_purchase, product=self.product_b, quantity=1,
            purchase_price=5, total=5,
        )
        PurchaseReturn.objects.create(
            business=self.business_b, purchase=foreign_purchase,
            return_number='B-PRET-1', debit_amount=5,
        )
        SalesReturn.objects.create(
            business=self.business_b, invoice=foreign_invoice,
            return_number='B-RET-1', refund_amount=5,
        )
        InventoryTransaction.objects.create(
            business=self.business_b, product=self.product_b,
            transaction_type='sale', quantity=-1, before_stock=5, after_stock=4,
            reference='B-3001',
        )
        Expense.objects.create(
            business=self.business_b, description='B Expense', amount=9,
            payment_method='cash', expense_date='2026-09-07',
        )
        CustomerPayment.objects.create(
            business=self.business_b, customer=self.customer_b, amount=2, method='cash',
        )
        SupplierPayment.objects.create(
            business=self.business_b, supplier=self.supplier_b, amount=2, method='cash',
        )
        Setting.objects.create(business=self.business_b, key='private_setting', value='B secret')
        AuditLog.objects.create(
            business=self.business_b, user=self.user_b, action='B_EVENT',
            module='private', entity='BusinessB', entity_id='b',
        )

        endpoints = (
            '/api/invoices/', '/api/purchases/', '/api/sales-returns/',
            '/api/purchase-returns/', '/api/inventory/', '/api/expenses/',
            '/api/customer-payments/', '/api/supplier-payments/', '/api/settings/',
            '/api/audit-logs/',
        )
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, 200, endpoint)
            self.assertNotIn('B-', str(response.data), endpoint)
            self.assertNotIn('B Expense', str(response.data), endpoint)
            self.assertNotIn('B secret', str(response.data), endpoint)


class InventoryConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.business = Business.objects.create(name='Concurrency Business')
        self.user = User.objects.create_user(username='concurrency', password='password', role='admin', business=self.business)
        self.product = Product.objects.create(business=self.business, name='Concurrent', sku='CON-1', purchase_price=1, selling_price=2, current_stock=10)

    @skipUnless(connection.vendor == 'postgresql', 'Row-lock concurrency test requires PostgreSQL')
    def test_concurrent_stock_updates_preserve_inventory(self):
        def move():
            return InventoryService.move_stock(
                product_id=self.product.pk, quantity=-1, transaction_type='sale',
                business=self.business, user=self.user, reference='CONCURRENT',
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: move(), range(2)))
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, Decimal('8.00'))
        self.assertEqual(len(results), 2)
        self.assertEqual(InventoryTransaction.objects.filter(product=self.product, reference='CONCURRENT').count(), 2)


class InvoiceNumberingTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.business = Business.objects.create(name='Numbering Business')
        self.other_business = Business.objects.create(name='Other Numbering Business')
        self.user = User.objects.create_user(username='numbering', password='password', role='admin', business=self.business)
        self.other_user = User.objects.create_user(username='other-numbering', password='password', role='admin', business=self.other_business)
        self.product = Product.objects.create(business=self.business, name='Numbered', sku='NUM-1', purchase_price=1, selling_price=2, current_stock=20)
        self.other_product = Product.objects.create(business=self.other_business, name='Other Numbered', sku='NUM-1', purchase_price=1, selling_price=2, current_stock=20)

    def make_invoice(self, business, user, product):
        return InvoiceService.create_invoice(
            attributes={'payment_method': 'cash', 'payment_status': 'paid', 'customer_name': 'Walk-in Customer'},
            items_data=[{'product_id': product.pk, 'quantity': '1', 'unit_price': '2', 'gst_percent': '0'}],
            payments_data=[{'method': 'cash', 'amount': '2'}],
            bill_discount=0, business=business, created_by=user,
        )

    def test_first_configured_existing_and_multiple_business_numbers(self):
        Setting.objects.create(business=self.business, key='invoice_prefix', value='POS')
        Setting.objects.create(business=self.business, key='invoice_start_number', value='700')
        self.assertEqual(self.make_invoice(self.business, self.user, self.product).invoice_number, 'POS-0700')
        Invoice.objects.create(business=self.business, invoice_number='POS-0999', customer_name='Existing')
        self.assertEqual(self.make_invoice(self.business, self.user, self.product).invoice_number, 'POS-1000')
        self.assertTrue(self.make_invoice(self.other_business, self.other_user, self.other_product).invoice_number.startswith('INV-'))

    @skipUnless(connection.vendor == 'postgresql', 'Numbering concurrency test requires PostgreSQL')
    def test_concurrent_invoice_numbers_are_unique(self):
        Setting.objects.create(business=self.business, key='invoice_prefix', value='CON')
        Setting.objects.create(business=self.business, key='invoice_start_number', value='1')
        with ThreadPoolExecutor(max_workers=2) as executor:
            invoices = list(executor.map(lambda _: self.make_invoice(self.business, self.user, self.product), range(2)))
        self.assertEqual(len({invoice.invoice_number for invoice in invoices}), 2)
