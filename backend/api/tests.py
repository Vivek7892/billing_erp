from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.db.models import Sum
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from .calculations import calculate_invoice
from .models import AuditLog, Business, Customer, CustomerLedger, Invoice, Product, Supplier, SupplierLedger, User
from .services.ledger_service import LedgerService


class InvoiceCalculationTests(SimpleTestCase):
	def test_exclusive_tax_discount_and_rounding(self):
		result = calculate_invoice([
			{
				'quantity': '2',
				'unit_price': '100.00',
				'discount_percent': '10',
				'gst_percent': '18',
			},
		])

		self.assertEqual(result.subtotal, Decimal('200.00'))
		self.assertEqual(result.discount_amount, Decimal('20.00'))
		self.assertEqual(result.tax_amount, Decimal('32.40'))
		self.assertEqual(result.grand_total, Decimal('212.00'))

	def test_inclusive_tax_uses_base_amount(self):
		result = calculate_invoice([
			{
				'quantity': '1',
				'unit_price': '118.00',
				'gst_percent': '18',
			},
		], tax_inclusive=True, round_total=False)

		self.assertEqual(result.subtotal, Decimal('100.00'))
		self.assertEqual(result.tax_amount, Decimal('18.00'))
		self.assertEqual(result.grand_total, Decimal('118.00'))

	def test_bill_discount_is_included_in_taxable_amount(self):
		result = calculate_invoice([
			{
				'quantity': '1',
				'unit_price': '100.00',
				'gst_percent': '18',
			},
		], bill_discount='10', round_total=False)

		self.assertEqual(result.discount_amount, Decimal('10.00'))
		self.assertEqual(result.taxable_amount, Decimal('90.00'))
		self.assertEqual(result.grand_total, Decimal('106.20'))


class TransactionWorkflowTests(TestCase):
	def setUp(self):
		self.business = Business.objects.create(name='Test Business')
		self.user = User.objects.create_user(
			username='admin', password='password', role='admin', business=self.business
		)
		self.manager = User.objects.create_user(
			username='manager', password='password', role='manager', business=self.business
		)
		self.cashier = User.objects.create_user(
			username='cashier', password='password', role='cashier', business=self.business
		)
		self.accountant = User.objects.create_user(
			username='accountant', password='password', role='accountant', business=self.business
		)
		self.product = Product.objects.create(
			business=self.business,
			name='Test Product',
			sku='TEST-1',
			purchase_price=Decimal('10.00'),
			selling_price=Decimal('20.00'),
			current_stock=Decimal('10.00'),
			minimum_stock=Decimal('2.00'),
		)
		self.customer = Customer.objects.create(
			business=self.business, name='Test Customer', credit_limit=Decimal('1000.00')
		)
		self.client = APIClient()
		self.client.force_authenticate(self.user)

	def test_purchase_sale_credit_payment_and_return_keep_stock_consistent(self):
		purchase_response = self.client.post('/api/purchases/', {
			'purchase_date': '2026-09-05',
			'items': [{
				'product': self.product.pk,
				'quantity': '5',
				'purchase_price': '10.00',
				'gst_percent': '0',
			}],
		}, format='json')
		self.assertEqual(purchase_response.status_code, 201, purchase_response.data)
		self.product.refresh_from_db()
		self.assertEqual(self.product.current_stock, Decimal('15.00'))
		invoice_response = self.client.post('/api/invoices/', {
			'customer': self.customer.pk,
			'payment_status': 'credit',
			'payment_method': 'credit',
			'items': [{
				'product_id': self.product.pk,
				'quantity': '3',
				'unit_price': '20.00',
				'discount_percent': '0',
				'gst_percent': '0',
			}],
			'payments': [],
		}, format='json')
		self.assertEqual(invoice_response.status_code, 201, invoice_response.data)
		self.product.refresh_from_db()
		self.customer.refresh_from_db()
		self.assertEqual(self.product.current_stock, Decimal('12.00'))
		self.assertEqual(self.customer.outstanding_amount, Decimal('60.00'))

		invoice_item_id = invoice_response.data['items'][0]['id']
		return_response = self.client.post('/api/sales-returns/', {
			'invoice': invoice_response.data['id'],
			'reason': 'Damaged',
			'items': [{'invoice_item_id': invoice_item_id, 'quantity': '1'}],
		}, format='json')
		self.assertEqual(return_response.status_code, 201, return_response.data)
		self.product.refresh_from_db()
		self.assertEqual(self.product.current_stock, Decimal('13.00'))

		repeat_response = self.client.post('/api/sales-returns/', {
			'invoice': invoice_response.data['id'],
			'reason': 'Damaged',
			'items': [{'invoice_item_id': invoice_item_id, 'quantity': '3'}],
		}, format='json')
		self.assertEqual(repeat_response.status_code, 400)

		refund_response = self.client.post(
			f'/api/invoices/{invoice_response.data["id"]}/refund/'
		)
		self.assertEqual(refund_response.status_code, 200, refund_response.data)
		self.product.refresh_from_db()
		self.assertEqual(self.product.current_stock, Decimal('15.00'))
		self.assertEqual(LedgerService.reconcile_customer(
			customer_id=self.customer.pk, business=self.business,
		), Decimal('0'))
		ledger_totals = CustomerLedger.objects.filter(customer=self.customer).aggregate(
			debit=Sum('debit'), credit=Sum('credit'),
		)
		self.assertEqual(ledger_totals['debit'], Decimal('60.00'))
		self.assertEqual(ledger_totals['credit'], Decimal('60.00'))

	def test_bulk_stock_adjust_rolls_back_when_a_later_row_is_invalid(self):
		second_product = Product.objects.create(
			business=self.business,
			name='Second Product',
			sku='TEST-2',
			purchase_price=Decimal('5.00'),
			selling_price=Decimal('8.00'),
			current_stock=Decimal('4.00'),
		)

		response = self.client.post('/api/inventory/bulk-adjust/', {
			'items': [
				{'product_id': self.product.pk, 'quantity': '2'},
				{'product_id': second_product.pk, 'quantity': '-99'},
			],
		}, format='json')

		self.assertEqual(response.status_code, 400)
		self.product.refresh_from_db()
		second_product.refresh_from_db()
		self.assertEqual(self.product.current_stock, Decimal('10.00'))
		self.assertEqual(second_product.current_stock, Decimal('4.00'))

	def test_sales_return_rolls_back_when_a_later_item_is_invalid(self):
		invoice_response = self.client.post('/api/invoices/', {
			'payment_status': 'paid',
			'payment_method': 'cash',
			'items': [{
				'product_id': self.product.pk,
				'quantity': '2',
				'unit_price': '20.00',
				'discount_percent': '0',
				'gst_percent': '0',
			}],
			'payments': [{'method': 'cash', 'amount': '40.00'}],
		}, format='json')
		self.assertEqual(invoice_response.status_code, 201, invoice_response.data)
		invoice_item_id = invoice_response.data['items'][0]['id']

		response = self.client.post('/api/sales-returns/', {
			'invoice': invoice_response.data['id'],
			'items': [
				{'invoice_item_id': invoice_item_id, 'quantity': '1'},
				{'invoice_item_id': 999999, 'quantity': '1'},
			],
		}, format='json')

		self.assertEqual(response.status_code, 400)
		self.product.refresh_from_db()
		self.assertEqual(self.product.current_stock, Decimal('8.00'))
		self.assertFalse(self.product.inventorytransaction_set.filter(reference__startswith='RET-').exists())
		self.assertFalse(self.business.salesreturn_set.exists())

	def test_invoice_creation_failure_leaves_no_partial_records_or_stock_change(self):
		response = self.client.post('/api/invoices/', {
			'payment_status': 'paid',
			'payment_method': 'cash',
			'items': [{
				'product_id': self.product.pk,
				'quantity': '2',
				'unit_price': '20.00',
				'discount_percent': '0',
				'gst_percent': '0',
			}],
			'payments': [{'method': 'invalid', 'amount': '40.00'}],
		}, format='json')

		self.assertEqual(response.status_code, 400)
		self.product.refresh_from_db()
		self.assertEqual(self.product.current_stock, Decimal('10.00'))
		self.assertFalse(Invoice.objects.filter(business=self.business).exists())
		self.assertFalse(AuditLog.objects.filter(business=self.business, module='invoices').exists())

	def test_supplier_balance_reconciles_from_purchase_payment_and_return_ledger(self):
		supplier = Supplier.objects.create(business=self.business, name='Test Supplier')
		purchase_response = self.client.post('/api/purchases/', {
			'supplier': supplier.pk,
			'purchase_date': '2026-09-05',
			'items': [{'product': self.product.pk, 'quantity': '5', 'purchase_price': '10.00'}],
		}, format='json')
		self.assertEqual(purchase_response.status_code, 201, purchase_response.data)

		payment_response = self.client.post('/api/supplier-payments/', {
			'supplier': supplier.pk, 'amount': '20.00', 'method': 'cash',
		}, format='json')
		self.assertEqual(payment_response.status_code, 201, payment_response.data)
		supplier.refresh_from_db()
		self.assertEqual(supplier.outstanding_amount, Decimal('30.00'))
		self.assertEqual(LedgerService.reconcile_supplier(
			supplier_id=supplier.pk, business=self.business,
		), Decimal('30.00'))
		self.assertEqual(SupplierLedger.objects.filter(supplier=supplier).count(), 2)

	def test_report_service_supports_json_and_export_formats(self):
		for path in ('sales', 'products', 'profit', 'gst', 'customers', 'payments', 'expenses'):
			response = self.client.get(f'/api/reports/{path}/')
			self.assertEqual(response.status_code, 200, path)

		xlsx_response = self.client.get('/api/reports/sales/?export=xlsx')
		self.assertEqual(xlsx_response.status_code, 200)
		self.assertIn('spreadsheetml', xlsx_response['Content-Type'])
		pdf_response = self.client.get('/api/reports/sales/?export=pdf')
		self.assertEqual(pdf_response.status_code, 200)
		self.assertEqual(pdf_response['Content-Type'], 'application/pdf')

	def test_dashboard_collection_and_action_counts_use_database_data(self):
		response = self.client.get('/api/dashboard/')
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['today_collection'], 0)
		action_counts = {item['key']: item['count'] for item in response.data['action_required']}
		self.assertEqual(action_counts['stock'], 0)
		self.assertEqual(action_counts['credit'], 0)

	def test_global_search_and_customer_collection_are_live(self):
		search_response = self.client.get('/api/search/?q=Test')
		self.assertEqual(search_response.status_code, 200)
		self.assertTrue(any(item['type'] == 'product' for item in search_response.data['results']))

		payment_response = self.client.post('/api/customer-payments/', {
			'customer': self.customer.pk,
			'amount': '25.00',
			'method': 'cash',
		}, format='json')
		self.assertEqual(payment_response.status_code, 201, payment_response.data)
		dashboard_response = self.client.get('/api/dashboard/')
		self.assertEqual(dashboard_response.data['today_collection'], 25.0)

	def test_role_permissions_protect_sensitive_operations(self):
		self.client.force_authenticate(self.cashier)
		cashier_product = self.client.post('/api/products/', {
			'name': 'Cashier Product',
			'sku': 'CASH-1',
			'purchase_price': '5.00',
			'selling_price': '8.00',
		}, format='json')
		self.assertEqual(cashier_product.status_code, 403)
		self.assertEqual(self.client.post('/api/settings/bulk_update/', {'shop_name': 'Nope'}, format='json').status_code, 403)

		self.client.force_authenticate(self.manager)
		manager_product = self.client.post('/api/products/', {
			'name': 'Manager Product',
			'sku': 'MGR-1',
			'purchase_price': '5.00',
			'selling_price': '8.00',
		}, format='json')
		self.assertEqual(manager_product.status_code, 201, manager_product.data)

		self.client.force_authenticate(self.accountant)
		report_response = self.client.get('/api/reports/profit/')
		self.assertEqual(report_response.status_code, 200)

		self.client.force_authenticate(self.cashier)
		profile_response = self.client.put('/api/me/', {
			'first_name': 'Cashier',
			'role': 'admin',
			'is_active': False,
		}, format='json')
		self.assertEqual(profile_response.status_code, 200)
		self.assertEqual(profile_response.data['role'], 'cashier')
		self.cashier.refresh_from_db()
		self.assertTrue(self.cashier.is_active)
		self.assertTrue(AuditLog.objects.filter(action='create', module='products').exists())

	@patch('api.views.upload_shop_logo', return_value='https://cdn.example.com/business/logo.png')
	def test_logo_upload_persists_and_remove_clears_setting(self, upload_logo):
		logo = SimpleUploadedFile('logo.png', b'fake-png-data', content_type='image/png')
		response = self.client.post('/api/settings/upload-logo/', {'logo': logo}, format='multipart')
		self.assertEqual(response.status_code, 200, response.data)
		upload_logo.assert_called_once()

		settings_response = self.client.get('/api/settings/all/')
		self.assertEqual(settings_response.data['shop_logo'], 'https://cdn.example.com/business/logo.png')

		remove_response = self.client.post('/api/settings/remove-logo/')
		self.assertEqual(remove_response.status_code, 200, remove_response.data)
		settings_response = self.client.get('/api/settings/all/')
		self.assertEqual(settings_response.data['shop_logo'], '')

	def test_invalid_login_returns_unauthorized(self):
		response = self.client.post('/api/auth/login/', {
			'username': 'missing-user',
			'password': 'wrong-password',
		}, format='json')
		self.assertEqual(response.status_code, 401)
		self.assertEqual(response.data['code'], 'invalid_credentials')

# Create your tests here.
