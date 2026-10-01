from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from api.models import (
    Business,
    User,
    Product,
    Invoice,
    Purchase,
    Payment,
    Notification,
)
from api.services.notification_engine import NotificationEngine


class NotificationEngineTests(APITestCase):
    def setUp(self):
        self.business = Business.objects.create(name='Test Retailer', mobile='9876543210')
        self.admin = User.objects.create_user(
            username='admin_user',
            password='password123',
            role='admin',
            business=self.business,
            is_verified=True,
        )
        self.client.force_authenticate(user=self.admin)

    def test_low_stock_notification(self):
        # Create an out-of-stock product and a low-stock product
        Product.objects.create(
            business=self.business,
            name='Test Flour',
            sku='FLOUR-01',
            purchase_price=Decimal('40'),
            selling_price=Decimal('50'),
            current_stock=Decimal('0'),
            minimum_stock=Decimal('10'),
            status='active',
        )
        NotificationEngine.check_low_stock(self.business)
        notif = Notification.objects.filter(business=self.business, notification_type='low_stock').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.severity, 'danger')
        self.assertIn('FLOUR-01', notif.message)

    def test_invoice_overdue_notification(self):
        # Create an invoice older than 15 days with pending balance
        inv = Invoice.objects.create(
            business=self.business,
            invoice_number='INV-OLD-01',
            grand_total=Decimal('2500'),
            paid_amount=Decimal('0'),
            balance_due=Decimal('2500'),
            payment_status='credit',
            status='completed',
        )
        # Manually backdate created_at
        Invoice.objects.filter(id=inv.id).update(
            created_at=timezone.now() - timedelta(days=20)
        )
        NotificationEngine.check_invoices_overdue(self.business)
        notif = Notification.objects.filter(business=self.business, notification_type='invoice_overdue').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.severity, 'danger')
        self.assertIn('INV-OLD-01', notif.title)

    def test_payment_received_notification(self):
        inv = Invoice.objects.create(
            business=self.business,
            invoice_number='INV-PAY-01',
            grand_total=Decimal('1200'),
            paid_amount=Decimal('1200'),
            balance_due=Decimal('0'),
            payment_status='paid',
            status='completed',
        )
        Payment.objects.create(
            invoice=inv,
            amount=Decimal('1200'),
            method='upi',
        )
        NotificationEngine.check_payments_received(self.business)
        notif = Notification.objects.filter(business=self.business, notification_type='payment_received').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.severity, 'success')
        self.assertIn('1,200', notif.title)

    def test_purchase_order_pending_notification(self):
        Purchase.objects.create(
            business=self.business,
            invoice_number='PO-TEST-99',
            total_amount=Decimal('15000'),
            paid_amount=Decimal('0'),
            payment_status='pending',
            purchase_date=timezone.now().date(),
        )
        NotificationEngine.check_purchase_orders_pending(self.business)
        notif = Notification.objects.filter(business=self.business, notification_type='purchase_order_pending').first()
        self.assertIsNotNone(notif)
        self.assertIn('PO-TEST-99', notif.title)

    def test_quotation_expiring_notification(self):
        draft = Invoice.objects.create(
            business=self.business,
            invoice_number='DRAFT-EXP-01',
            grand_total=Decimal('8500'),
            status='draft',
        )
        Invoice.objects.filter(id=draft.id).update(
            created_at=timezone.now() - timedelta(days=8)
        )
        NotificationEngine.check_quotations_expiring(self.business)
        notif = Notification.objects.filter(business=self.business, notification_type='quotation_expiring').first()
        self.assertIsNotNone(notif)
        self.assertIn('DRAFT-EXP-01', notif.title)

    def test_approval_action_workflow(self):
        # Create an approval required notification
        notif = Notification.objects.create(
            business=self.business,
            notification_type='approval_required',
            title='Approval Required: Discount',
            message='High discount requested',
            requires_approval=True,
            status='active',
        )
        # Test approval via API
        resp = self.client.post(f'/api/notifications/{notif.id}/action/', {
            'action': 'approve',
            'notes': 'Approved by owner',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertEqual(notif.status, 'approved')
        self.assertEqual(notif.action_notes, 'Approved by owner')
        self.assertTrue(notif.is_read)

    def test_notification_list_and_read_api(self):
        Notification.objects.create(
            business=self.business,
            notification_type='low_stock',
            title='Low Stock 1',
            message='Message 1',
            is_read=False,
        )
        resp = self.client.get('/api/notifications/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('notifications', resp.data)
        self.assertGreaterEqual(resp.data['unread_count'], 1)

        # Test mark all read
        resp_read_all = self.client.post('/api/notifications/read-all/')
        self.assertEqual(resp_read_all.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(business=self.business, is_read=False).count(), 0)
