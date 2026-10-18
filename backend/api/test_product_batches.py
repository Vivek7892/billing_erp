from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from .models import ApprovalRequest, Business, Product, ProductBatch, Setting, User
from .services.approval_service import ApprovalService
from .services.invoice_service import InvoiceService


class ProductBatchFlowTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name='Batch Business')
        self.user = User.objects.create_user(
            username='batch-admin', password='password', role='admin', business=self.business,
        )
        self.product = Product.objects.create(
            business=self.business, name='Tracked Item', sku='BATCH-1', purchase_price=10,
            selling_price=20, mrp=25, gst_percent=0, current_stock=0,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def create_batch(self, **overrides):
        payload = {
            'product': self.product.pk, 'batch_number': 'LOT-001',
            'manufacturing_date': date.today().isoformat(),
            'expiry_date': (date.today() + timedelta(days=365)).isoformat(),
            'mrp': '30.00', 'purchase_rate': '15.00', 'selling_rate': '25.00',
            'quantity': '5.00', **overrides,
        }
        response = self.client.post('/api/product-batches/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return ProductBatch.objects.get(pk=response.data['id'])

    def test_batch_stock_and_invoice_snapshot_restore(self):
        batch = self.create_batch()
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, Decimal('5.00'))

        invoice = InvoiceService.create_invoice(
            attributes={'customer_name': 'Walk-in Customer', 'payment_method': 'cash', 'payment_status': 'credit'},
            items_data=[{
                'product_id': self.product.pk, 'batch_id': batch.pk, 'quantity': '2',
                'unit_price': '25', 'discount_percent': '0', 'gst_percent': '0',
            }], payments_data=[], bill_discount=0, business=self.business, created_by=self.user,
        )
        item = invoice.items.get()
        batch.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual((item.batch_number, item.mrp, item.manufacturing_date, item.expiry_date), ('LOT-001', Decimal('30.00'), batch.manufacturing_date, batch.expiry_date))
        self.assertEqual((batch.quantity, self.product.current_stock), (Decimal('3.00'), Decimal('3.00')))

        InvoiceService.cancel_invoice(invoice_id=invoice.pk, business=self.business, performed_by=self.user)
        batch.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual((batch.quantity, self.product.current_stock), (Decimal('5.00'), Decimal('5.00')))

    def test_expired_batch_is_rejected_when_rule_enabled(self):
        batch = self.create_batch(
            manufacturing_date=(date.today() - timedelta(days=365)).isoformat(),
            expiry_date=(date.today() - timedelta(days=1)).isoformat(),
        )
        Setting.objects.create(business=self.business, key='prevent_expired_batch_sale', value='true')
        with self.assertRaisesMessage(ValueError, 'is expired'):
            InvoiceService.create_invoice(
                attributes={'customer_name': 'Walk-in Customer', 'payment_method': 'cash', 'payment_status': 'credit'},
                items_data=[{
                    'product_id': self.product.pk, 'batch_id': batch.pk, 'quantity': '1',
                    'unit_price': '25', 'discount_percent': '0', 'gst_percent': '0',
                }], payments_data=[], bill_discount=0, business=self.business, created_by=self.user,
            )

    def test_batch_dates_and_tenant_scope_are_validated(self):
        response = self.client.post('/api/product-batches/', {
            'product': self.product.pk, 'batch_number': 'BAD-DATES',
            'manufacturing_date': '2026-10-20', 'expiry_date': '2026-10-19',
            'mrp': '30', 'purchase_rate': '10', 'selling_rate': '20', 'quantity': '1',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        other_business = Business.objects.create(name='Other Batch Business')
        other_product = Product.objects.create(
            business=other_business, name='Other Item', sku='OTHER-1', purchase_price=1, selling_price=2,
        )
        response = self.client.post('/api/product-batches/', {
            'product': other_product.pk, 'batch_number': 'OTHER-LOT', 'mrp': '3',
            'purchase_rate': '1', 'selling_rate': '2', 'quantity': '1',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_large_batch_stock_change_waits_for_approval(self):
        self.user.role = 'manager'
        self.user.save(update_fields=['role'])
        response = self.client.post('/api/product-batches/', {
            'product': self.product.pk, 'batch_number': 'LOT-APPROVAL',
            'mrp': '30', 'purchase_rate': '15', 'selling_rate': '25', 'quantity': '20',
        }, format='json')
        self.assertEqual(response.status_code, 202, response.data)
        batch = ProductBatch.objects.get(pk=response.data['id'])
        self.assertEqual(batch.quantity, Decimal('0.00'))
        request = ApprovalRequest.objects.get(pk=response.data['approval_request_id'])
        reviewer = User.objects.create_user(username='batch-reviewer', password='password', role='admin', business=self.business)
        ApprovalService.approve_request(approval_request_id=request.pk, admin_user=reviewer)
        batch.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual((batch.quantity, self.product.current_stock), (Decimal('20.00'), Decimal('20.00')))

    def test_settings_validation_preserves_known_keys_and_rejects_unknown_keys(self):
        response = self.client.post('/api/settings/bulk_update/', {
            'show_mrp_col': 'true', 'thermal_show_barcode': 'false',
            'approval_invoice_cancellation_enabled': 'true', 'invoice_start_number': '1200',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        values = {row.key: row.value for row in Setting.objects.filter(business=self.business)}
        self.assertEqual(values['show_mrp_col'], 'true')
        self.assertEqual(values['thermal_show_barcode'], 'false')
        response = self.client.post('/api/settings/bulk_update/', {'unsupported_ui_key': 'yes'}, format='json')
        self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/settings/bulk_update/', {'default_gst_rate': '150'}, format='json')
        self.assertEqual(response.status_code, 400)

