from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from api.models import Business, User, Product, Customer, Invoice, Setting, AuditLog


class AuditAndRecycleBinTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.business = Business.objects.create(
            name='Alpha Store',
            email='alpha@store.com',
            mobile='9876543210',
            address='123 Main St',
            gstin='29ABCDE1234F1Z5',
            pan='ABCDE1234F',
            invoice_prefix='ALP',
            invoice_start_number=1001,
        )
        self.admin = User.objects.create_user(
            username='admin_user',
            password='Password123!',
            role='admin',
            business=self.business,
            email='admin@store.com',
        )
        self.customer = Customer.objects.create(
            business=self.business,
            name='Test Customer',
            mobile='9123456780',
        )

    def test_settings_bulk_update_syncs_business(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            reverse('setting-bulk-update'),
            {
                'shop_name': 'Beta Supermarket',
                'shop_phone': '9998887776',
                'shop_email': 'beta@supermarket.com',
                'shop_address': '456 Commercial Rd',
                'shop_gstin': '33AAAAA0000A1Z5',
                'invoice_prefix': 'BET',
                'invoice_start_number': 2000,
                'reason': 'Annual store re-branding',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200)

        # Verify Business model was synced
        self.business.refresh_from_db()
        self.assertEqual(self.business.name, 'Beta Supermarket')
        self.assertEqual(self.business.mobile, '9998887776')
        self.assertEqual(self.business.email, 'beta@supermarket.com')
        self.assertEqual(self.business.address, '456 Commercial Rd')
        self.assertEqual(self.business.gstin, '33AAAAA0000A1Z5')
        self.assertEqual(self.business.invoice_prefix, 'BET')
        self.assertEqual(self.business.invoice_start_number, 2000)

        # Verify AuditLog recorded the settings change
        log = AuditLog.objects.filter(action='SETTINGS_CHANGED').latest('created_at')
        self.assertEqual(log.user, self.admin)
        self.assertEqual(log.reason, 'Annual store re-branding')

    def test_settings_all_populates_from_business(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(reverse('setting-all'))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get('shop_name'), 'Alpha Store')
        self.assertEqual(res.data.get('shop_phone'), '9876543210')
        self.assertEqual(res.data.get('invoice_prefix'), 'ALP')
        self.assertEqual(res.data.get('enable_invoice_qr'), 'true')

    def test_financial_transactions_cannot_be_deleted(self):
        self.client.force_authenticate(user=self.admin)
        inv = Invoice.objects.create(
            business=self.business,
            invoice_number='ALP-1001',
            customer=self.customer,
            subtotal=Decimal('500.00'),
            grand_total=Decimal('500.00'),
            balance_due=Decimal('500.00'),
            created_by=self.admin,
        )
        # Attempt DELETE on invoice
        res = self.client.delete(reverse('invoice-detail', kwargs={'pk': inv.pk}))
        self.assertEqual(res.status_code, 405)
        self.assertIn('Financial transactions cannot be permanently deleted', res.data.get('detail', ''))

    def test_invoice_edit_records_audit_trail_with_reason(self):
        self.client.force_authenticate(user=self.admin)
        inv = Invoice.objects.create(
            business=self.business,
            invoice_number='ALP-1002',
            customer=self.customer,
            subtotal=Decimal('1000.00'),
            discount_amount=Decimal('100.00'),
            tax_amount=Decimal('0.00'),
            grand_total=Decimal('900.00'),
            balance_due=Decimal('900.00'),
            created_by=self.admin,
        )

        # Missing reason must be rejected
        res_fail = self.client.patch(
            reverse('invoice-detail', kwargs={'pk': inv.pk}),
            {'discount_amount': '250.00'},
            format='json',
        )
        self.assertEqual(res_fail.status_code, 400)
        self.assertEqual(res_fail.data.get('error'), 'reason_required')

        # Edit with statutory audit reason
        res_ok = self.client.patch(
            reverse('invoice-detail', kwargs={'pk': inv.pk}),
            {
                'discount_amount': '250.00',
                'reason': 'Special customer loyalty discount approval',
            },
            format='json',
        )
        self.assertEqual(res_ok.status_code, 200)

        inv.refresh_from_db()
        self.assertEqual(inv.discount_amount, Decimal('250.00'))
        self.assertEqual(inv.grand_total, Decimal('750.00'))

        log = AuditLog.objects.filter(action='INVOICE_EDITED').latest('created_at')
        self.assertEqual(log.user, self.admin)
        self.assertEqual(log.entity_name, 'ALP-1002')
        self.assertEqual(log.reason, 'Special customer loyalty discount approval')
        self.assertIn('100.0', log.previous_value)
        self.assertIn('250.0', log.new_value)

    def test_recycle_bin_and_statutory_immutability(self):
        self.client.force_authenticate(user=self.admin)
        # Create cancelled invoice
        inv = Invoice.objects.create(
            business=self.business,
            invoice_number='ALP-1003',
            customer=self.customer,
            subtotal=Decimal('200.00'),
            grand_total=Decimal('200.00'),
            status='cancelled',
            cancel_reason='Customer cancelled order',
            created_by=self.admin,
        )
        # Create archived product
        prod = Product.objects.create(
            business=self.business,
            name='Vintage Lamp',
            sku='LAMP-001',
            selling_price=Decimal('150.00'),
            purchase_price=Decimal('80.00'),
            status='inactive',
        )

        # GET /api/recycle-bin/
        res = self.client.get(reverse('recycle-bin'))
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.data['cancelled_invoices']) >= 1)
        self.assertTrue(len(res.data['archived_products']) >= 1)
        self.assertIn('statutory_notice', res.data)

        # Attempt to restore cancelled invoice -> MUST fail with statutory violation HTTP 400
        res_inv_restore = self.client.post(
            reverse('recycle-bin-restore', kwargs={'entity_type': 'invoice', 'pk': inv.pk}),
            {'reason': 'Try un-cancelling'},
            format='json',
        )
        self.assertEqual(res_inv_restore.status_code, 400)
        self.assertEqual(res_inv_restore.data.get('error'), 'financial_restoration_forbidden')

        # Restore archived product -> MUST succeed HTTP 200
        res_prod_restore = self.client.post(
            reverse('recycle-bin-restore', kwargs={'entity_type': 'product', 'pk': prod.pk}),
            {'reason': 'Restocking item'},
            format='json',
        )
        self.assertEqual(res_prod_restore.status_code, 200)
        self.assertEqual(res_prod_restore.data.get('status'), 'restored')

        prod.refresh_from_db()
        self.assertEqual(prod.status, 'active')

