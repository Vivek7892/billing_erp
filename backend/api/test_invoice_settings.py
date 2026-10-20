from decimal import Decimal
from django.test import TestCase
from api.models import Business, Invoice, InvoiceItem, InvoiceTemplateSetting, Setting, Customer
from api.services.template_service import (
    save_template_config,
    get_template_config,
    resolve_invoice_template_settings,
    reset_template_config,
    to_bool
)
from api.pdf_utils import generate_invoice_pdf, generate_thermal_invoice_pdf


class InvoiceSettingsConfigurationTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(
            name='Test Matrix Mart',
            email='matrix@test.com',
            mobile='9876543210',
            address='123 Test Plaza, MG Road',
            city='Bengaluru',
            state='Karnataka',
            pincode='560001',
            gstin='29ABCDE1234F1Z5',
        )

        self.customer = Customer.objects.create(
            business=self.business,
            mobile='9123456780',
            name='Rahul Sharma',
            address='Flat 402, Sunshine Apts',
            gstin='29XYZAB5678C1Z2',
        )

        self.invoice = Invoice.objects.create(
            business=self.business,
            customer=self.customer,
            customer_name='Rahul Sharma',
            customer_phone='9123456780',
            invoice_number='INV-TEST-001',
            payment_status='UNPAID',
            payment_method='CASH',
            subtotal=Decimal('1000.00'),
            tax_amount=Decimal('180.00'),
            discount_amount=Decimal('50.00'),
            round_off=Decimal('0.00'),
            grand_total=Decimal('1130.00'),
            balance_due=Decimal('1130.00'),
            notes='Thank you for testing.',
            place_of_supply='29'
        )

        self.item = InvoiceItem.objects.create(
            invoice=self.invoice,
            product_name='Sample Premium Widget',
            hsn_code='84713010',
            sku='WIDG-001',
            barcode='8901234567890',
            quantity=Decimal('2.00'),
            unit='Pcs',
            unit_price=Decimal('500.00'),
            discount_percent=Decimal('5.00'),
            discount_amount=Decimal('50.00'),
            gst_percent=Decimal('18.00'),
            gst_amount=Decimal('180.00'),
            total=Decimal('1130.00')
        )

    def test_template_independence_and_isolation(self):
        """Modifying Template A must NOT alter Template B."""
        config_a = {
            'invoice_title': 'CUSTOM A4 INVOICE',
            'show_business_logo': True,
            'show_customer_phone': True,
            'show_qty_col': True,
            'show_rate_col': True,
            'show_discount_col': False,
            'show_tax_cols': False,
            'show_total_col': True,
            'show_upi_qr_on_invoice': True,
            'enable_invoice_qr': False,
        }
        save_template_config(self.business, 'gst_a4', config_a)

        config_b = {
            'invoice_title': 'STYLISH CORPORATE BILL',
            'show_business_logo': False,
            'show_customer_phone': False,
            'show_qty_col': False,
            'show_rate_col': False,
            'show_discount_col': True,
            'show_tax_cols': True,
            'show_total_col': True,
            'show_upi_qr_on_invoice': False,
            'enable_invoice_qr': True,
        }
        save_template_config(self.business, 'stylish', config_b)

        resolved_a = resolve_invoice_template_settings(self.invoice, 'gst_a4')
        resolved_b = resolve_invoice_template_settings(self.invoice, 'stylish')

        self.assertEqual(resolved_a.get('invoice_title'), 'CUSTOM A4 INVOICE')
        self.assertEqual(resolved_b.get('invoice_title'), 'STYLISH CORPORATE BILL')
        self.assertTrue(to_bool(resolved_a.get('show_business_logo')))
        self.assertFalse(to_bool(resolved_b.get('show_business_logo')))
        self.assertFalse(to_bool(resolved_a.get('show_discount_col')))
        self.assertTrue(to_bool(resolved_b.get('show_discount_col')))
        self.assertTrue(to_bool(resolved_a.get('show_upi_qr_on_invoice')))
        self.assertFalse(to_bool(resolved_b.get('show_upi_qr_on_invoice')))
        self.assertFalse(to_bool(resolved_a.get('enable_invoice_qr')))
        self.assertTrue(to_bool(resolved_b.get('enable_invoice_qr')))

    def test_precedence_hierarchy(self):
        """Hierarchy: Template Specific > Thermal Specific > Global > Default."""
        Setting.objects.update_or_create(
            business=self.business,
            key='show_item_description',
            defaults={'value': 'true'}
        )
        config_c = {'invoice_title': 'HALF A4 COMPACT BILL'}
        save_template_config(self.business, 'half_a4', config_c)
        resolved_c = resolve_invoice_template_settings(self.invoice, 'half_a4')
        self.assertTrue(to_bool(resolved_c.get('show_item_description')))

        # Override in template
        config_c['show_item_description'] = False
        save_template_config(self.business, 'half_a4', config_c)
        resolved_c_overridden = resolve_invoice_template_settings(self.invoice, 'half_a4')
        self.assertFalse(to_bool(resolved_c_overridden.get('show_item_description')))

    def test_thermal_58_and_80_independence(self):
        """Thermal 58mm and 80mm have independent column and QR settings."""
        config_t80 = {
            'thermal_show_logo': False,
            'thermal_show_qty': True,
            'thermal_show_rate': False,
            'thermal_show_total': True,
            'thermal_show_upi_qr': True,
            'thermal_show_bill_qr': False,
        }
        save_template_config(self.business, 'thermal_80', config_t80)

        config_t58 = {
            'thermal_show_logo': False,
            'thermal_show_qty': False,
            'thermal_show_rate': True,
            'thermal_show_total': True,
            'thermal_show_upi_qr': False,
            'thermal_show_bill_qr': True,
        }
        save_template_config(self.business, 'thermal_58', config_t58)

        resolved_t80 = resolve_invoice_template_settings(self.invoice, 'thermal_80')
        resolved_t58 = resolve_invoice_template_settings(self.invoice, 'thermal_58')

        self.assertTrue(to_bool(resolved_t80.get('thermal_show_qty')))
        self.assertFalse(to_bool(resolved_t58.get('thermal_show_qty')))
        self.assertFalse(to_bool(resolved_t80.get('thermal_show_rate')))
        self.assertTrue(to_bool(resolved_t58.get('thermal_show_rate')))
        self.assertTrue(to_bool(resolved_t80.get('thermal_show_upi_qr')))
        self.assertFalse(to_bool(resolved_t58.get('thermal_show_upi_qr')))
        self.assertFalse(to_bool(resolved_t80.get('thermal_show_bill_qr')))
        self.assertTrue(to_bool(resolved_t58.get('thermal_show_bill_qr')))

    def test_pdf_generation_matrix(self):
        """Generates valid PDFs for A4, Stylish, Half-A4, Thermal 80, Thermal 58."""
        for tpl in ('gst_a4', 'stylish', 'half_a4'):
            buf = generate_invoice_pdf(self.invoice, template=tpl)
            pdf_bytes = buf.getvalue() if hasattr(buf, 'getvalue') else buf
            self.assertTrue(pdf_bytes.startswith(b'%PDF'), f"Failed to generate valid PDF for {tpl}")

        for tpl in ('thermal_80', 'thermal_58'):
            buf = generate_thermal_invoice_pdf(self.invoice, template=tpl)
            pdf_bytes = buf.getvalue() if hasattr(buf, 'getvalue') else buf
            self.assertTrue(pdf_bytes.startswith(b'%PDF'), f"Failed to generate valid thermal PDF for {tpl}")

    def test_financial_calculations_preserved(self):
        """Display toggles do not alter invoice financial amounts or line totals."""
        config = {
            'show_qty_col': False,
            'show_rate_col': False,
            'show_discount_col': False,
            'show_tax_cols': False,
        }
        save_template_config(self.business, 'gst_a4', config)
        generate_invoice_pdf(self.invoice, template='gst_a4')

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.grand_total, Decimal('1130.00'))
        self.assertEqual(self.invoice.subtotal, Decimal('1000.00'))
        self.assertEqual(self.invoice.tax_amount, Decimal('180.00'))
        self.assertEqual(self.item.gst_amount, Decimal('180.00'))
        self.assertEqual(self.item.total, Decimal('1130.00'))

