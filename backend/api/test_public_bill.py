from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from api.models import Business, User, Customer, Product, Invoice, InvoiceItem, Payment, Setting
from api.pdf_utils import generate_invoice_pdf, generate_thermal_invoice_pdf


class PublicBillEndpointTests(APITestCase):
    def setUp(self):
        self.business = Business.objects.create(name='Test Retailer Hub', mobile='9876543210', gstin='33AAAAA0000A1Z5')
        self.customer = Customer.objects.create(business=self.business, name='Priya Sharma', mobile='9123456780')
        self.product = Product.objects.create(
            business=self.business,
            name='Basmati Rice 5kg',
            sku='RICE-05',
            purchase_price=Decimal('350.00'),
            selling_price=Decimal('450.00'),
            gst_percent=Decimal('5.00'),
            current_stock=50,
            minimum_stock=10,
        )
        self.invoice = Invoice.objects.create(
            business=self.business,
            invoice_number='INV-TEST-9001',
            customer=self.customer,
            customer_name=self.customer.name,
            customer_phone=self.customer.mobile,
            subtotal=Decimal('428.57'),
            discount_amount=Decimal('0.00'),
            tax_amount=Decimal('21.43'),
            round_off=Decimal('0.00'),
            grand_total=Decimal('450.00'),
            paid_amount=Decimal('450.00'),
            balance_due=Decimal('0.00'),
            payment_method='cash',
            payment_status='paid',
            status='completed',
        )
        self.item = InvoiceItem.objects.create(
            invoice=self.invoice,
            product=self.product,
            product_name=self.product.name,
            quantity=Decimal('1'),
            unit_price=Decimal('428.57'),
            gst_percent=Decimal('5.00'),
            gst_amount=Decimal('21.43'),
            total=Decimal('450.00'),
        )
        self.payment = Payment.objects.create(
            invoice=self.invoice,
            method='cash',
            amount=Decimal('450.00'),
        )

    def test_invoice_has_public_token_and_url(self):
        self.assertIsNotNone(self.invoice.public_token)
        self.assertTrue(len(self.invoice.public_token) >= 20)
        url = self.invoice.get_public_url()
        self.assertIn(f"/bill/{self.invoice.public_token}", url)
        self.assertIn("/s/", url)

    def test_public_bill_detail_view(self):
        response = self.client.get(f"/api/public/bill/{self.invoice.public_token}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['invoice']['invoice_number'], 'INV-TEST-9001')
        self.assertEqual(data['invoice']['grand_total'], 450.0)
        self.assertEqual(len(data['invoice']['items']), 1)
        self.assertEqual(data['invoice']['items'][0]['product_name'], 'Basmati Rice 5kg')
        self.assertEqual(data['business']['name'], 'Test Retailer Hub')
        self.assertEqual(data['settings']['enable_invoice_qr'], 'true')

    def test_public_bill_not_found(self):
        response = self.client.get("/api/public/bill/invalid-token-12345/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_bill_pdf_view_a4(self):
        response = self.client.get(f"/api/public/bill/{self.invoice.public_token}/pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(len(response.content) > 1000)

    def test_public_bill_pdf_view_thermal(self):
        response = self.client.get(f"/api/public/bill/{self.invoice.public_token}/pdf/?printer=thermal")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(len(response.content) > 500)
