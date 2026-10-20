import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from decimal import Decimal
from api.models import Business, Invoice, InvoiceItem, InvoiceTemplateSetting, Setting, Customer
from api.services.template_service import (
    save_template_config,
    get_template_config,
    resolve_invoice_template_settings,
    reset_template_config,
    to_bool
)
from api.pdf_utils import generate_invoice_pdf, generate_thermal_invoice_pdf

def run_matrix_validation():
    print("=" * 60)
    print("STARTING INVOICE SETTINGS CONFIGURATION MATRIX VALIDATION")
    print("=" * 60)

    # 1. Get or create a test business
    business, _ = Business.objects.get_or_create(
        id=99999,
        defaults={
            'name': 'Test Matrix Mart',
            'email': 'matrix@test.com',
            'mobile': '9876543210',
            'address': '123 Test Plaza, MG Road',
            'city': 'Bengaluru',
            'state': 'Karnataka',
            'pincode': '560001',
            'gstin': '29ABCDE1234F1Z5',
        }
    )

    customer, _ = Customer.objects.get_or_create(
        business=business,
        mobile='9123456780',
        defaults={
            'name': 'Rahul Sharma',
            'address': 'Flat 402, Sunshine Apts',
            'gstin': '29XYZAB5678C1Z2',
        }
    )

    # Clean existing invoice if any
    Invoice.objects.filter(business=business, invoice_number='INV-TEST-001').delete()

    invoice = Invoice.objects.create(
        business=business,
        customer=customer,
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

    InvoiceItem.objects.create(
        invoice=invoice,
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

    print("Created test business, customer, and invoice INV-TEST-001")

    # Store baseline values for verification
    original_grand_total = invoice.grand_total
    original_subtotal = invoice.subtotal
    original_tax_total = invoice.tax_amount

    # =========================================================================
    # TEST 1: TEMPLATE INDEPENDENCE (Isolation Test)
    # =========================================================================
    print("\n--- Test 1: Template Independence ---")
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
    save_template_config(business, 'gst_a4', config_a)

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
    save_template_config(business, 'stylish', config_b)

    resolved_a = resolve_invoice_template_settings(invoice, 'gst_a4')
    resolved_b = resolve_invoice_template_settings(invoice, 'stylish')

    assert resolved_a.get('invoice_title') == 'CUSTOM A4 INVOICE', f"Expected CUSTOM A4 INVOICE, got {resolved_a.get('invoice_title')}"
    assert resolved_b.get('invoice_title') == 'STYLISH CORPORATE BILL', f"Expected STYLISH CORPORATE BILL, got {resolved_b.get('invoice_title')}"
    assert to_bool(resolved_a.get('show_business_logo')) is True
    assert to_bool(resolved_b.get('show_business_logo')) is False
    assert to_bool(resolved_a.get('show_discount_col')) is False
    assert to_bool(resolved_b.get('show_discount_col')) is True
    assert to_bool(resolved_a.get('show_upi_qr_on_invoice')) is True
    assert to_bool(resolved_b.get('show_upi_qr_on_invoice')) is False

    print(" PASS: Template A and Template B have independent, non-interfering configurations.")

    # =========================================================================
    # TEST 2: PRECEDENCE HIERARCHY TEST
    # =========================================================================
    print("\n--- Test 2: Precedence Hierarchy Test ---")
    # Set a global setting: show_item_description = True
    Setting.objects.update_or_create(
        business=business,
        key='show_item_description',
        defaults={'value': 'true'}
    )
    # Template C does not explicitly set show_item_description, so it should inherit from global
    config_c = {
        'invoice_title': 'HALF A4 COMPACT BILL',
        'show_qty_col': True,
    }
    save_template_config(business, 'half_a4', config_c)
    resolved_c = resolve_invoice_template_settings(invoice, 'half_a4')
    assert to_bool(resolved_c.get('show_item_description')) is True, "Expected global inheritance for show_item_description"
    assert resolved_c.get('invoice_title') == 'HALF A4 COMPACT BILL', "Expected template override for invoice_title"

    # Now override show_item_description in Template C to False
    config_c['show_item_description'] = False
    save_template_config(business, 'half_a4', config_c)
    resolved_c_overridden = resolve_invoice_template_settings(invoice, 'half_a4')
    assert to_bool(resolved_c_overridden.get('show_item_description')) is False, "Template override must win over global"

    print(" PASS: Precedence hierarchy verified: Template-specific > Global > Defaults.")

    # =========================================================================
    # TEST 3: BOOLEAN VALUES PRESERVED (No boolean fallthrough bug)
    # =========================================================================
    print("\n--- Test 3: Boolean Fallthrough Prevention ---")
    # Verify that explicit False values are NOT overwritten by default True
    assert to_bool(resolved_b.get('show_business_logo')) is False
    assert to_bool(resolved_b.get('show_customer_phone')) is False
    assert to_bool(resolved_a.get('show_discount_col')) is False
    assert to_bool(resolved_a.get('show_tax_cols')) is False
    assert to_bool(resolved_a.get('enable_invoice_qr')) is False
    print(" PASS: Explicit False booleans are strictly preserved and never fall through to default True.")

    # =========================================================================
    # TEST 4: THERMAL INDEPENDENCE (58mm vs 80mm)
    # =========================================================================
    print("\n--- Test 4: Thermal 58mm & 80mm Independence ---")
    config_t80 = {
        'thermal_show_logo': False,
        'thermal_show_qty': True,
        'thermal_show_rate': False,
        'thermal_show_total': True,
        'thermal_show_upi_qr': True,
        'thermal_show_bill_qr': False,
    }
    save_template_config(business, 'thermal_80', config_t80)

    config_t58 = {
        'thermal_show_logo': False,
        'thermal_show_qty': False,
        'thermal_show_rate': True,
        'thermal_show_total': True,
        'thermal_show_upi_qr': False,
        'thermal_show_bill_qr': True,
    }
    save_template_config(business, 'thermal_58', config_t58)

    resolved_t80 = resolve_invoice_template_settings(invoice, 'thermal_80')
    resolved_t58 = resolve_invoice_template_settings(invoice, 'thermal_58')

    assert to_bool(resolved_t80.get('thermal_show_qty')) is True
    assert to_bool(resolved_t58.get('thermal_show_qty')) is False
    assert to_bool(resolved_t80.get('thermal_show_rate')) is False
    assert to_bool(resolved_t58.get('thermal_show_rate')) is True
    assert to_bool(resolved_t80.get('thermal_show_upi_qr')) is True
    assert to_bool(resolved_t58.get('thermal_show_upi_qr')) is False
    assert to_bool(resolved_t80.get('thermal_show_bill_qr')) is False
    assert to_bool(resolved_t58.get('thermal_show_bill_qr')) is True
    print(" PASS: Thermal 58mm and 80mm have independent settings.")

    # =========================================================================
    # TEST 5: PDF GENERATION TEST MATRIX
    # =========================================================================
    print("\n--- Test 5: PDF Generation Across Formats ---")

    # 1. Vertical A4 Standard
    buf_a4 = generate_invoice_pdf(invoice, template='gst_a4')
    pdf_a4 = buf_a4.getvalue() if hasattr(buf_a4, 'getvalue') else buf_a4
    assert pdf_a4.startswith(b'%PDF'), "A4 Standard PDF generation failed"
    print(f" PASS: Vertical A4 Standard PDF generated successfully ({len(pdf_a4)} bytes)")

    # 2. Stylish A4
    buf_stylish = generate_invoice_pdf(invoice, template='stylish')
    pdf_stylish = buf_stylish.getvalue() if hasattr(buf_stylish, 'getvalue') else buf_stylish
    assert pdf_stylish.startswith(b'%PDF'), "Stylish A4 PDF generation failed"
    print(f" PASS: Stylish A4 PDF generated successfully ({len(pdf_stylish)} bytes)")

    # 3. Half-A4 (A5)
    buf_half = generate_invoice_pdf(invoice, template='half_a4')
    pdf_half = buf_half.getvalue() if hasattr(buf_half, 'getvalue') else buf_half
    assert pdf_half.startswith(b'%PDF'), "Half-A4 PDF generation failed"
    print(f" PASS: Half-A4 (A5) PDF generated successfully ({len(pdf_half)} bytes)")

    # 4. Thermal 80mm
    buf_t80 = generate_thermal_invoice_pdf(invoice, template='thermal_80')
    pdf_t80 = buf_t80.getvalue() if hasattr(buf_t80, 'getvalue') else buf_t80
    assert pdf_t80.startswith(b'%PDF'), "Thermal 80mm PDF generation failed"
    print(f" PASS: Thermal 80mm PDF generated successfully ({len(pdf_t80)} bytes)")

    # 5. Thermal 58mm
    buf_t58 = generate_thermal_invoice_pdf(invoice, template='thermal_58')
    pdf_t58 = buf_t58.getvalue() if hasattr(buf_t58, 'getvalue') else buf_t58
    assert pdf_t58.startswith(b'%PDF'), "Thermal 58mm PDF generation failed"
    print(f" PASS: Thermal 58mm PDF generated successfully ({len(pdf_t58)} bytes)")

    # =========================================================================
    # TEST 6: MATHEMATICAL CALCULATION INTEGRITY
    # =========================================================================
    print("\n--- Test 6: Financial Math & Calculation Integrity ---")
    invoice.refresh_from_db()
    assert invoice.grand_total == original_grand_total, "Grand total was mutated!"
    assert invoice.subtotal == original_subtotal, "Subtotal was mutated!"
    assert invoice.tax_amount == original_tax_total, "Tax total was mutated!"

    item = invoice.items.first()
    assert item.gst_amount == Decimal('180.00'), "GST amount was altered!"
    assert item.total == Decimal('1130.00'), "Line total price was altered!"
    print(" PASS: Display toggles omitted columns without altering financial/tax math.")

    # =========================================================================
    # TEST 7: TEMPLATE RESET TEST
    # =========================================================================
    print("\n--- Test 7: Template Reset to Factory Defaults ---")
    reset_res = reset_template_config(business, 'gst_a4')
    resolved_a_reset = resolve_invoice_template_settings(invoice, 'gst_a4')
    # After reset, the custom title should revert to factory default ('TAX INVOICE')
    assert resolved_a_reset.get('invoice_title') == 'TAX INVOICE', f"Expected TAX INVOICE after reset, got {resolved_a_reset.get('invoice_title')}"
    print(" PASS: Template reset restored factory defaults successfully.")

    # =========================================================================
    # CLEANUP TEST RECORDS
    # =========================================================================
    print("\n--- Cleanup ---")
    invoice.items.all().delete()
    invoice.delete()
    customer.delete()
    InvoiceTemplateSetting.objects.filter(business=business).delete()
    Setting.objects.filter(business=business).delete()
    business.delete()
    print("Cleaned up test invoice, customer, settings, and business records.")

    print("\n" + "=" * 60)
    print("ALL 7 TEST SUITES PASSED PERFECTLY!")
    print("=" * 60)

if __name__ == '__main__':
    run_matrix_validation()
