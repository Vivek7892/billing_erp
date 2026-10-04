from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from api.models import Business, User, Customer, Supplier, Invoice, Purchase, CommunicationLog, ShortLink


class CommunicationActionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.business = Business.objects.create(
            name='Sri Balaji Store',
            email='balaji@store.com',
            mobile='9876543210',
            address='123 Main Bazaar',
            gstin='29ABCDE1234F1Z5',
            invoice_prefix='INV',
            invoice_start_number=1001,
        )
        self.admin = User.objects.create_user(
            username='cashier_1',
            password='Password123!',
            role='cashier',
            business=self.business,
            email='cashier@store.com',
        )
        self.client.force_authenticate(user=self.admin)

        self.customer = Customer.objects.create(
            business=self.business,
            name='Ramesh Kumar',
            mobile='9876501234',
            outstanding_amount=Decimal('1500.00'),
        )
        self.supplier = Supplier.objects.create(
            business=self.business,
            name='Global Wholesalers',
            phone='9845012345',
            email='sales@global.com',
        )
        self.invoice = Invoice.objects.create(
            business=self.business,
            invoice_number='INV-1001',
            customer=self.customer,
            customer_name='Ramesh Kumar',
            customer_phone='9876501234',
            subtotal=Decimal('2000.00'),
            grand_total=Decimal('2000.00'),
            balance_due=Decimal('1500.00'),
            payment_status='partial',
            created_by=self.admin,
        )
        self.purchase = Purchase.objects.create(
            business=self.business,
            invoice_number='PO-8801',
            supplier=self.supplier,
            purchase_date=self.invoice.created_at.date(),
            total_amount=Decimal('45000.00'),
            payment_status='pending',
            created_by=self.admin,
        )

    def test_invoice_send_whatsapp_uses_short_url_and_logs(self):
        url = reverse('invoice-send-whatsapp', kwargs={'pk': self.invoice.pk})
        res = self.client.post(url, {}, format='json')
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertEqual(data['status'], 'sent')
        # Must contain /s/<code>/ short link format
        self.assertIn('/s/', data['short_url'])
        self.assertIn('https://wa.me/919876501234', data['whatsapp_url'])
        self.assertIn('INV-1001', data['message'])

        # Communication log must be recorded
        log = CommunicationLog.objects.filter(reference_type='invoice', reference_id=str(self.invoice.pk)).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.channel, 'whatsapp')
        self.assertEqual(log.message_type, 'invoice')
        self.assertEqual(log.status, 'sent')
        self.assertIn('/s/', log.short_url)

    def test_customer_send_reminder(self):
        url = reverse('customer-send-reminder', kwargs={'pk': self.customer.pk})
        res = self.client.post(url, {'channel': 'whatsapp'}, format='json')
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertEqual(data['status'], 'sent')
        self.assertIn('1,500.00', data['message'])
        self.assertIn('/s/', data['short_url'])

        log = CommunicationLog.objects.filter(reference_type='customer', message_type='payment_reminder').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.recipient_name, 'Ramesh Kumar')
        self.assertEqual(log.status, 'sent')

    def test_customer_send_statement(self):
        url = reverse('customer-send-statement', kwargs={'pk': self.customer.pk})
        res = self.client.post(url, {'channel': 'whatsapp'}, format='json')
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertEqual(data['status'], 'sent')
        self.assertIn('Statement of Account', data['message'])

        log = CommunicationLog.objects.filter(reference_type='customer', message_type='statement').first()
        self.assertIsNotNone(log)

    def test_purchase_send_confirmation(self):
        self.admin.role = 'manager'
        self.admin.save()
        url = reverse('purchase-send-confirmation', kwargs={'pk': self.purchase.pk})
        res = self.client.post(url, {'channel': 'whatsapp'}, format='json')
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertEqual(data['status'], 'sent')
        self.assertIn('PO-8801', data['message'])
        self.assertIn('45,000.00', data['message'])

        log = CommunicationLog.objects.filter(reference_type='purchase', message_type='purchase_confirmation').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.recipient_name, 'Global Wholesalers')
