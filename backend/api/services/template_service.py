"""
Invoice Template Service — Billing ERP

Manages independent settings, defaults, active format selections, and
runtime settings resolution for all invoice templates (A4, Half-A4, Thermal).
"""

from copy import deepcopy
from typing import Dict, Any, Optional
from ..models import Setting, InvoiceTemplateSetting, Business

# Supported templates catalog: Exactly 3 A4/sheet templates + 2 thermal receipt templates
TEMPLATES_CATALOG = [
    {
        'id': 'gst_a4',
        'name': 'Vertical A4 (Standard GST)',
        'format': 'a4',
        'size': '210 × 297 mm',
        'desc': 'Full-page official GST tax invoice with detailed tax breakups, SAC/HSN codes & bank data.',
        'badge': 'Vertical A4',
        'badgeClass': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    },
    {
        'id': 'half_a4',
        'name': 'Half-A4 Bill (A5)',
        'format': 'half_a4',
        'size': '148 × 210 mm',
        'desc': 'Compact A5 portrait bill with clean white background, minimal borders & grocery retail layout.',
        'badge': 'Half-A4 (A5)',
        'badgeClass': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    },
    {
        'id': 'stylish',
        'name': 'Stylish A4 (Corporate Accent)',
        'format': 'a4',
        'size': '210 × 297 mm',
        'desc': 'Modern corporate vertical design with clean header brand accents and balanced layout.',
        'badge': 'Stylish A4',
        'badgeClass': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
    },
    {
        'id': 'thermal_80',
        'name': 'Thermal POS Receipt (80mm)',
        'format': 'thermal',
        'size': '80mm Roll (3-inch)',
        'desc': 'High-speed roll receipt formatted for standard 80mm thermal POS receipt printers.',
        'badge': '80mm Roll',
        'badgeClass': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    },
    {
        'id': 'thermal_58',
        'name': 'Thermal Receipt (58mm)',
        'format': 'thermal',
        'size': '58mm Roll (2-inch)',
        'desc': 'Ultra-compact slip formatted for 58mm (2-inch) mini POS thermal printers.',
        'badge': '58mm Roll',
        'badgeClass': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    },
]

# Legacy template aliases mapped to streamlined templates
LEGACY_TEMPLATE_ALIASES = {
    'advanced_gst_a5': 'half_a4',
    'luxury': 'gst_a4',
}

# Base defaults common to all templates
_BASE_DEFAULTS: Dict[str, Any] = {
    # Business Info
    'show_business_logo': 'true',
    'show_business_name': 'true',
    'show_business_address': 'true',
    'show_business_phone': 'true',
    'show_business_email': 'true',
    'show_business_gstin': 'true',
    'show_business_pan': 'true',
    'invoice_header_layout': 'logo_left',
    'header_alignment': 'left',

    # Invoice Fields
    'show_customer_name': 'true',
    'show_customer_phone': 'true',
    'show_customer_address': 'true',
    'show_customer_gstin': 'true',
    'show_place_of_supply': 'true',
    'show_payment_mode': 'true',
    'show_sku_col': 'false',
    'show_hsn_col': 'true',
    'show_unit_col': 'false',
    'show_rate_col': 'true',
    'show_discount_col': 'true',
    'show_tax_cols': 'true',
    'show_batch_col': 'false',
    'show_expiry_col': 'false',
    'hsn_summary_on_invoice': 'false',

    # Layout & Typography
    'invoice_font': 'default',
    'font_size': 'normal',
    'line_spacing': 'normal',
    'margin_size': 'normal',
    'show_separator_lines': 'true',

    # Tax & Totals
    'show_subtotal': 'true',
    'show_discount_total': 'true',
    'show_tax_breakdown': 'true',
    'show_round_off': 'true',
    'show_amount_in_words': 'true',

    # Payment & Footer
    'show_upi_qr_on_invoice': 'true',
    'show_upi_qr_on_thermal': 'true',
    'show_bank_details': 'true',
    'show_payment_summary': 'true',
    'show_balance_due': 'true',
    'show_signature_area': 'false',
    'show_terms': 'true',
    'show_footer': 'true',
    'enable_invoice_qr': 'true',
    'invoice_footer_layout': 'text_center',

    # Page settings
    'page_size': 'a4',
    'page_orientation': 'portrait',
    'copies_per_bill': '1',
}

# Template-specific customizations over base defaults
_TEMPLATE_SPECIFIC_OVERRIDES: Dict[str, Dict[str, Any]] = {
    'gst_a4': {
        'page_size': 'a4',
        'page_orientation': 'portrait',
        'margin_size': 'normal',
        'show_signature_area': 'true',
        'show_bank_details': 'true',
        'hsn_summary_on_invoice': 'true',
    },
    'half_a4': {
        'page_size': 'a5',
        'page_orientation': 'portrait',
        'margin_size': 'compact',
        'font_size': 'compact',
        'line_spacing': 'compact',
        'invoice_header_layout': 'split',
        'show_signature_area': 'false',
        'show_bank_details': 'false',
        'show_business_email': 'false',
        'show_business_pan': 'false',
        'hsn_summary_on_invoice': 'false',
    },
    'thermal_80': {
        'page_size': '80mm',
        'paper_width': '80',
        'margin_size': 'minimal',
        'font_size': 'compact',
        'invoice_font': 'courier',
        'invoice_header_layout': 'center',
        'header_alignment': 'center',
        'show_customer_address': 'false',
        'show_customer_gstin': 'false',
        'show_place_of_supply': 'false',
        'show_hsn_col': 'false',
        'show_tax_cols': 'false',
        'show_tax_breakdown': 'false',
        'show_bank_details': 'false',
        'show_signature_area': 'false',
        'show_terms': 'false',
        'show_amount_in_words': 'false',
        'hsn_summary_on_invoice': 'false',
    },
    'thermal_58': {
        'page_size': '58mm',
        'paper_width': '58',
        'margin_size': 'tight',
        'font_size': 'small',
        'invoice_font': 'courier',
        'invoice_header_layout': 'center',
        'header_alignment': 'center',
        'show_business_logo': 'false',
        'show_business_email': 'false',
        'show_business_pan': 'false',
        'show_customer_address': 'false',
        'show_customer_gstin': 'false',
        'show_place_of_supply': 'false',
        'show_hsn_col': 'false',
        'show_discount_col': 'false',
        'show_tax_cols': 'false',
        'show_tax_breakdown': 'false',
        'show_bank_details': 'false',
        'show_signature_area': 'false',
        'show_terms': 'false',
        'show_amount_in_words': 'false',
        'show_balance_due': 'false',
        'hsn_summary_on_invoice': 'false',
    },
    'advanced_gst_a5': {
        'page_size': 'a5',
        'page_orientation': 'portrait',
        'margin_size': 'compact',
        'invoice_header_layout': 'split',
        'show_sku_col': 'true',
        'show_hsn_col': 'true',
        'show_unit_col': 'true',
        'show_signature_area': 'true',
        'show_bank_details': 'true',
        'hsn_summary_on_invoice': 'true',
    },
    'luxury': {
        'page_size': 'a4',
        'page_orientation': 'portrait',
        'margin_size': 'wide',
        'invoice_font': 'dejavu',
        'show_signature_area': 'true',
    },
    'stylish': {
        'page_size': 'a4',
        'page_orientation': 'portrait',
        'invoice_header_layout': 'corporate_bar',
        'show_signature_area': 'true',
    },
}


def _to_bool(val: Any) -> bool:
    if val is None:
        return True
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ('true', '1', 'yes', 'on')


def _build_structured_sections(flat_cfg: Dict[str, Any], template_id: str) -> Dict[str, Any]:
    b_info = deepcopy(flat_cfg.get('business_info') or {})
    flds = deepcopy(flat_cfg.get('fields') or {})
    lay = deepcopy(flat_cfg.get('layout') or {})
    tx = deepcopy(flat_cfg.get('tax') or {})
    pay = deepcopy(flat_cfg.get('payment') or {})
    pg = deepcopy(flat_cfg.get('page') or {})

    if 'show_logo' not in b_info: b_info['show_logo'] = _to_bool(flat_cfg.get('show_business_logo', True))
    if 'show_address' not in b_info: b_info['show_address'] = _to_bool(flat_cfg.get('show_business_address', True))
    if 'show_phone' not in b_info: b_info['show_phone'] = _to_bool(flat_cfg.get('show_business_phone', True))
    if 'show_email' not in b_info: b_info['show_email'] = _to_bool(flat_cfg.get('show_business_email', True))
    if 'show_gstin' not in b_info: b_info['show_gstin'] = _to_bool(flat_cfg.get('show_business_gstin', True))
    if 'show_pan' not in b_info: b_info['show_pan'] = _to_bool(flat_cfg.get('show_business_pan', True))
    if 'header_layout' not in b_info: b_info['header_layout'] = flat_cfg.get('invoice_header_layout', 'logo_left')
    if 'store_name_override' not in b_info: b_info['store_name_override'] = flat_cfg.get('store_name_override', '')
    if 'address_override' not in b_info: b_info['address_override'] = flat_cfg.get('address_override', '')
    if 'phone_override' not in b_info: b_info['phone_override'] = flat_cfg.get('phone_override', '')
    if 'email_override' not in b_info: b_info['email_override'] = flat_cfg.get('email_override', '')
    if 'gstin_override' not in b_info: b_info['gstin_override'] = flat_cfg.get('gstin_override', '')

    if 'show_customer_name' not in flds: flds['show_customer_name'] = _to_bool(flat_cfg.get('show_customer_name', True))
    if 'show_customer_phone' not in flds: flds['show_customer_phone'] = _to_bool(flat_cfg.get('show_customer_phone', True))
    if 'show_customer_address' not in flds: flds['show_customer_address'] = _to_bool(flat_cfg.get('show_customer_address', True))
    if 'show_customer_gstin' not in flds: flds['show_customer_gstin'] = _to_bool(flat_cfg.get('show_customer_gstin', True))
    if 'show_hsn' not in flds: flds['show_hsn'] = _to_bool(flat_cfg.get('show_hsn_col', True))
    if 'show_sku' not in flds: flds['show_sku'] = _to_bool(flat_cfg.get('show_sku_col', False))
    if 'show_unit' not in flds: flds['show_unit'] = _to_bool(flat_cfg.get('show_unit_col', False))
    if 'show_rate' not in flds: flds['show_rate'] = _to_bool(flat_cfg.get('show_rate_col', True))
    if 'show_discount' not in flds: flds['show_discount'] = _to_bool(flat_cfg.get('show_discount_col', True))
    if 'show_tax_breakup' not in flds: flds['show_tax_breakup'] = _to_bool(flat_cfg.get('show_tax_cols', True))
    if 'show_batch' not in flds: flds['show_batch'] = _to_bool(flat_cfg.get('show_batch_col', False))
    if 'show_expiry' not in flds: flds['show_expiry'] = _to_bool(flat_cfg.get('show_expiry_col', False))
    if 'show_payment_mode' not in flds: flds['show_payment_mode'] = _to_bool(flat_cfg.get('show_payment_mode', True))
    if 'show_place_of_supply' not in flds: flds['show_place_of_supply'] = _to_bool(flat_cfg.get('show_place_of_supply', True))
    if 'show_notes' not in flds: flds['show_notes'] = _to_bool(flat_cfg.get('show_notes', True))

    if 'font_family' not in lay: lay['font_family'] = flat_cfg.get('invoice_font', 'inter')
    if 'font_size_scale' not in lay: lay['font_size_scale'] = 0.9 if flat_cfg.get('font_size') == 'compact' else 1.0
    if 'header_alignment' not in lay: lay['header_alignment'] = flat_cfg.get('header_alignment', 'left')
    if 'compact_mode' not in lay: lay['compact_mode'] = flat_cfg.get('font_size') == 'compact' or template_id in ('half_a4', 'thermal_80', 'thermal_58')
    if 'show_separator_lines' not in lay: lay['show_separator_lines'] = _to_bool(flat_cfg.get('show_separator_lines', True))
    if 'margin_top_mm' not in lay: lay['margin_top_mm'] = 5 if flat_cfg.get('margin_size') == 'compact' else (4 if flat_cfg.get('margin_size') == 'minimal' else 8)
    if 'margin_bottom_mm' not in lay: lay['margin_bottom_mm'] = 5 if flat_cfg.get('margin_size') == 'compact' else (4 if flat_cfg.get('margin_size') == 'minimal' else 8)
    if 'margin_left_mm' not in lay: lay['margin_left_mm'] = 5 if flat_cfg.get('margin_size') == 'compact' else (4 if flat_cfg.get('margin_size') == 'minimal' else 8)
    if 'margin_right_mm' not in lay: lay['margin_right_mm'] = 5 if flat_cfg.get('margin_size') == 'compact' else (4 if flat_cfg.get('margin_size') == 'minimal' else 8)

    if 'show_subtotal' not in tx: tx['show_subtotal'] = _to_bool(flat_cfg.get('show_subtotal', True))
    if 'show_discount_total' not in tx: tx['show_discount_total'] = _to_bool(flat_cfg.get('show_discount_total', True))
    if 'show_tax_summary' not in tx: tx['show_tax_summary'] = _to_bool(flat_cfg.get('show_tax_breakdown', True))
    if 'show_round_off' not in tx: tx['show_round_off'] = _to_bool(flat_cfg.get('show_round_off', True))
    if 'show_amount_in_words' not in tx: tx['show_amount_in_words'] = _to_bool(flat_cfg.get('show_amount_in_words', True))

    if 'show_upi_qr' not in pay: pay['show_upi_qr'] = _to_bool(flat_cfg.get('show_upi_qr_on_invoice', True) or flat_cfg.get('show_upi_qr_on_thermal', True))
    if 'show_bank_details' not in pay: pay['show_bank_details'] = _to_bool(flat_cfg.get('show_bank_details', True))
    if 'show_payment_summary' not in pay: pay['show_payment_summary'] = _to_bool(flat_cfg.get('show_payment_summary', True))
    if 'show_balance_due' not in pay: pay['show_balance_due'] = _to_bool(flat_cfg.get('show_balance_due', True))
    if 'show_terms' not in pay: pay['show_terms'] = _to_bool(flat_cfg.get('show_terms', True))
    if 'show_signature' not in pay: pay['show_signature'] = _to_bool(flat_cfg.get('show_signature_area', False))
    if 'show_footer' not in pay: pay['show_footer'] = _to_bool(flat_cfg.get('show_footer', True))
    if 'show_digital_bill_qr' not in pay: pay['show_digital_bill_qr'] = _to_bool(flat_cfg.get('enable_invoice_qr', True))
    if 'footer_text_override' not in pay: pay['footer_text_override'] = flat_cfg.get('footer_text_override', '')
    if 'terms_override' not in pay: pay['terms_override'] = flat_cfg.get('terms_override', '')

    if 'page_size' not in pg: pg['page_size'] = flat_cfg.get('page_size', 'a4')
    if 'orientation' not in pg: pg['orientation'] = flat_cfg.get('page_orientation', 'portrait')
    if 'thermal_roll_width' not in pg: pg['thermal_roll_width'] = str(flat_cfg.get('paper_width', '80')) + 'mm' if str(flat_cfg.get('paper_width', '')) in ('58', '80') else '80mm'
    if 'fit_one_page' not in pg: pg['fit_one_page'] = True

    return {
        'template_id': template_id,
        'business_info': b_info,
        'fields': flds,
        'layout': lay,
        'tax': tx,
        'payment': pay,
        'page': pg,
    }


def get_default_config(template_id: str) -> Dict[str, Any]:
    """Return sensible default settings dictionary for a specific template."""
    template_id = LEGACY_TEMPLATE_ALIASES.get(template_id, template_id)
    config = deepcopy(_BASE_DEFAULTS)
    overrides = _TEMPLATE_SPECIFIC_OVERRIDES.get(template_id, {})
    config.update(overrides)
    config['invoice_template'] = template_id
    config['template_id'] = template_id
    config.update(_build_structured_sections(config, template_id))
    return config


def get_template_config(business: Optional[Business], template_id: str) -> Dict[str, Any]:
    """Retrieve saved template configuration for a business, with fallback to template defaults."""
    template_id = LEGACY_TEMPLATE_ALIASES.get(template_id, template_id)
    default_cfg = get_default_config(template_id)
    if not business:
        return default_cfg

    tpl_setting = InvoiceTemplateSetting.objects.filter(
        business=business, template_id=template_id
    ).first()

    if tpl_setting and tpl_setting.config:
        # Layer saved overrides onto default config
        merged = deepcopy(default_cfg)
        merged.update(tpl_setting.config)
        merged['invoice_template'] = template_id
        merged['template_id'] = template_id
        merged.update(_build_structured_sections(merged, template_id))
        return merged

    return default_cfg


def save_template_config(business: Business, template_id: str, new_config: Dict[str, Any]) -> Dict[str, Any]:
    """Save or update template configuration for a business."""
    template_id = LEGACY_TEMPLATE_ALIASES.get(template_id, template_id)
    valid_template_ids = {t['id'] for t in TEMPLATES_CATALOG}
    if template_id not in valid_template_ids:
        raise ValueError(f"Unknown template: '{template_id}'")

    clean_config = {}
    default_cfg = get_default_config(template_id)

    # 1. Preserve structured sections if present
    for sec in ('business_info', 'fields', 'layout', 'tax', 'payment', 'page'):
        if sec in new_config and isinstance(new_config[sec], dict):
            clean_config[sec] = deepcopy(new_config[sec])

    # 2. Translate structured sections to flat keys for ReportLab/pdf_utils
    b_info = clean_config.get('business_info') or new_config.get('business_info') or {}
    if 'show_logo' in b_info: clean_config['show_business_logo'] = 'true' if b_info['show_logo'] else 'false'
    if 'show_address' in b_info: clean_config['show_business_address'] = 'true' if b_info['show_address'] else 'false'
    if 'show_phone' in b_info: clean_config['show_business_phone'] = 'true' if b_info['show_phone'] else 'false'
    if 'show_email' in b_info: clean_config['show_business_email'] = 'true' if b_info['show_email'] else 'false'
    if 'show_gstin' in b_info: clean_config['show_business_gstin'] = 'true' if b_info['show_gstin'] else 'false'
    if 'show_pan' in b_info: clean_config['show_business_pan'] = 'true' if b_info['show_pan'] else 'false'
    if 'header_layout' in b_info: clean_config['invoice_header_layout'] = str(b_info['header_layout'])
    if 'store_name_override' in b_info: clean_config['store_name_override'] = str(b_info['store_name_override'])
    if 'address_override' in b_info: clean_config['address_override'] = str(b_info['address_override'])

    flds = clean_config.get('fields') or new_config.get('fields') or {}
    if 'show_customer_name' in flds: clean_config['show_customer_name'] = 'true' if flds['show_customer_name'] else 'false'
    if 'show_customer_phone' in flds: clean_config['show_customer_phone'] = 'true' if flds['show_customer_phone'] else 'false'
    if 'show_customer_address' in flds: clean_config['show_customer_address'] = 'true' if flds['show_customer_address'] else 'false'
    if 'show_customer_gstin' in flds: clean_config['show_customer_gstin'] = 'true' if flds['show_customer_gstin'] else 'false'
    if 'show_hsn' in flds: clean_config['show_hsn_col'] = 'true' if flds['show_hsn'] else 'false'
    if 'show_sku' in flds: clean_config['show_sku_col'] = 'true' if flds['show_sku'] else 'false'
    if 'show_unit' in flds: clean_config['show_unit_col'] = 'true' if flds['show_unit'] else 'false'
    if 'show_rate' in flds: clean_config['show_rate_col'] = 'true' if flds['show_rate'] else 'false'
    if 'show_discount' in flds: clean_config['show_discount_col'] = 'true' if flds['show_discount'] else 'false'
    if 'show_tax_breakup' in flds: clean_config['show_tax_cols'] = 'true' if flds['show_tax_breakup'] else 'false'
    if 'show_payment_mode' in flds: clean_config['show_payment_mode'] = 'true' if flds['show_payment_mode'] else 'false'
    if 'show_place_of_supply' in flds: clean_config['show_place_of_supply'] = 'true' if flds['show_place_of_supply'] else 'false'
    if 'show_notes' in flds: clean_config['show_notes'] = 'true' if flds['show_notes'] else 'false'

    lay = clean_config.get('layout') or new_config.get('layout') or {}
    if 'font_family' in lay: clean_config['invoice_font'] = str(lay['font_family'])
    if 'compact_mode' in lay: clean_config['font_size'] = 'compact' if lay['compact_mode'] else 'normal'
    if 'show_separator_lines' in lay: clean_config['show_separator_lines'] = 'true' if lay['show_separator_lines'] else 'false'
    if 'header_alignment' in lay: clean_config['header_alignment'] = str(lay['header_alignment'])

    tx = clean_config.get('tax') or new_config.get('tax') or {}
    if 'show_subtotal' in tx: clean_config['show_subtotal'] = 'true' if tx['show_subtotal'] else 'false'
    if 'show_discount_total' in tx: clean_config['show_discount_total'] = 'true' if tx['show_discount_total'] else 'false'
    if 'show_tax_summary' in tx: clean_config['show_tax_breakdown'] = 'true' if tx['show_tax_summary'] else 'false'
    if 'show_round_off' in tx: clean_config['show_round_off'] = 'true' if tx['show_round_off'] else 'false'
    if 'show_amount_in_words' in tx: clean_config['show_amount_in_words'] = 'true' if tx['show_amount_in_words'] else 'false'

    pay = clean_config.get('payment') or new_config.get('payment') or {}
    if 'show_upi_qr' in pay:
        val = 'true' if pay['show_upi_qr'] else 'false'
        clean_config['show_upi_qr_on_invoice'] = val
        clean_config['show_upi_qr_on_thermal'] = val
    if 'show_bank_details' in pay: clean_config['show_bank_details'] = 'true' if pay['show_bank_details'] else 'false'
    if 'show_payment_summary' in pay: clean_config['show_payment_summary'] = 'true' if pay['show_payment_summary'] else 'false'
    if 'show_balance_due' in pay: clean_config['show_balance_due'] = 'true' if pay['show_balance_due'] else 'false'
    if 'show_terms' in pay: clean_config['show_terms'] = 'true' if pay['show_terms'] else 'false'
    if 'show_signature' in pay: clean_config['show_signature_area'] = 'true' if pay['show_signature'] else 'false'
    if 'show_footer' in pay: clean_config['show_footer'] = 'true' if pay['show_footer'] else 'false'
    if 'show_digital_bill_qr' in pay: clean_config['enable_invoice_qr'] = 'true' if pay['show_digital_bill_qr'] else 'false'
    if 'footer_text_override' in pay: clean_config['footer_text_override'] = str(pay['footer_text_override'])
    if 'terms_override' in pay: clean_config['terms_override'] = str(pay['terms_override'])

    pg = clean_config.get('page') or new_config.get('page') or {}
    if 'page_size' in pg: clean_config['page_size'] = str(pg['page_size'])
    if 'orientation' in pg: clean_config['page_orientation'] = str(pg['orientation'])
    if 'thermal_roll_width' in pg: clean_config['paper_width'] = '58' if '58' in str(pg['thermal_roll_width']) else '80'

    # 3. Also allow any flat keys passed directly
    for k, v in new_config.items():
        if k not in ('business_info', 'fields', 'layout', 'tax', 'payment', 'page'):
            if k in default_cfg or k.startswith('show_') or k.startswith('invoice_') or k in (
                'page_size', 'page_orientation', 'font_size', 'line_spacing', 'margin_size', 'header_alignment', 'auto_cut'
            ):
                clean_config[k] = str(v) if not isinstance(v, (dict, list)) else v

    record, _ = InvoiceTemplateSetting.objects.update_or_create(
        business=business,
        template_id=template_id,
        defaults={'config': clean_config},
    )

    full_cfg = deepcopy(default_cfg)
    full_cfg.update(record.config)
    full_cfg['invoice_template'] = template_id
    full_cfg['template_id'] = template_id
    full_cfg.update(_build_structured_sections(full_cfg, template_id))
    return full_cfg


def reset_template_config(business: Business, template_id: str) -> Dict[str, Any]:
    """Reset a template configuration back to its factory defaults."""
    template_id = LEGACY_TEMPLATE_ALIASES.get(template_id, template_id)
    InvoiceTemplateSetting.objects.filter(
        business=business, template_id=template_id
    ).delete()
    return get_default_config(template_id)


def get_active_templates(business: Optional[Business]) -> Dict[str, str]:
    """Return active template IDs for each output format."""
    default_active = {
        'default': 'gst_a4',
        'a4': 'gst_a4',
        'half_a4': 'half_a4',
        'thermal': 'thermal_80',
    }

    if not business:
        return default_active

    saved_settings = {
        s.key: s.value
        for s in Setting.objects.filter(
            business=business,
            key__in=['invoice_template', 'active_template_a4', 'active_template_half_a4', 'active_template_thermal'],
        )
    }

    raw_default = saved_settings.get('invoice_template') or default_active['default']
    raw_a4 = saved_settings.get('active_template_a4') or default_active['a4']
    raw_half_a4 = saved_settings.get('active_template_half_a4') or default_active['half_a4']
    raw_thermal = saved_settings.get('active_template_thermal') or default_active['thermal']

    default_val = LEGACY_TEMPLATE_ALIASES.get(raw_default, raw_default)
    a4_val = LEGACY_TEMPLATE_ALIASES.get(raw_a4, raw_a4)
    half_a4_val = LEGACY_TEMPLATE_ALIASES.get(raw_half_a4, raw_half_a4)
    thermal_val = LEGACY_TEMPLATE_ALIASES.get(raw_thermal, raw_thermal)

    return {
        'default': default_val,
        'a4': a4_val,
        'half_a4': half_a4_val,
        'thermal': thermal_val,
        'invoice_template': default_val,
        'active_template_a4': a4_val,
        'active_template_half_a4': half_a4_val,
        'active_template_thermal': thermal_val,
    }


def set_active_template(business: Business, format_name: str, template_id: str) -> Dict[str, str]:
    """Select the active template for a format ('default', 'a4', 'half_a4', 'thermal')."""
    template_id = LEGACY_TEMPLATE_ALIASES.get(template_id, template_id)
    valid_template_ids = {t['id'] for t in TEMPLATES_CATALOG}
    if template_id not in valid_template_ids:
        raise ValueError(f"Unknown template: '{template_id}'")

    key_map = {
        'default': 'invoice_template',
        'a4': 'active_template_a4',
        'half_a4': 'active_template_half_a4',
        'thermal': 'active_template_thermal',
    }

    setting_key = key_map.get(format_name)
    if not setting_key:
        raise ValueError(f"Invalid format: '{format_name}'. Expected one of {list(key_map.keys())}")

    Setting.objects.update_or_create(
        business=business,
        key=setting_key,
        defaults={'value': template_id},
    )

    # If setting the default template, also update the format-specific active template
    target_format = next((t['format'] for t in TEMPLATES_CATALOG if t['id'] == template_id), None)
    if format_name == 'default' and target_format:
        format_key = key_map.get(target_format)
        if format_key:
            Setting.objects.update_or_create(
                business=business,
                key=format_key,
                defaults={'value': template_id},
            )

    return get_active_templates(business)


def get_all_templates_summary(business: Optional[Business]) -> Dict[str, Any]:
    """Return all templates metadata, their saved configurations, and active selections."""
    active_map = get_active_templates(business)
    templates_list = []

    for t in TEMPLATES_CATALOG:
        t_id = t['id']
        cfg = get_template_config(business, t_id)
        templates_list.append({
            **t,
            'is_default': active_map['default'] == t_id,
            'is_format_active': (
                (t['format'] == 'a4' and active_map['a4'] == t_id)
                or (t['format'] == 'half_a4' and active_map['half_a4'] == t_id)
                or (t['format'] == 'thermal' and active_map['thermal'] == t_id)
            ),
            'config': cfg,
        })

    return {
        'active': active_map,
        'templates': templates_list,
    }


def resolve_invoice_template_settings(
    invoice: Any,
    template_id: Optional[str] = None,
    printer: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Given an invoice and optional requested template/printer format,
    resolves the effective configuration by combining:
    1. Base business profile settings from Setting table
    2. Active template for the requested format
    3. Template-specific settings overrides
    """
    business = getattr(invoice, 'business', None)
    base_settings = {s.key: s.value for s in Setting.objects.filter(business=business)} if business else {}
    active_map = get_active_templates(business)

    # 1. Determine effective template_id
    effective_tpl = template_id
    if not effective_tpl:
        req_p = (printer or '').lower()
        if req_p in ('thermal', 'thermal_80', 'receipt'):
            effective_tpl = active_map.get('thermal', 'thermal_80')
        elif req_p in ('thermal_58', '58mm'):
            effective_tpl = 'thermal_58'
        elif req_p in ('half_a4', 'a5'):
            effective_tpl = active_map.get('half_a4', 'half_a4')
        elif req_p in ('a4', 'pdf', 'standard'):
            effective_tpl = active_map.get('a4', 'gst_a4')
        else:
            effective_tpl = active_map.get('default', 'gst_a4')

    # 2. Load template-specific configuration
    tpl_cfg = get_template_config(business, effective_tpl)

    # 3. Merge: base profile settings (identity, bank, UPI, GST) as foundations,
    # overlaying template-specific display, layout, typography and column settings.
    merged = deepcopy(base_settings)
    merged.update(tpl_cfg)
    merged['invoice_template'] = effective_tpl
    return merged
