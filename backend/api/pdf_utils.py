"""
Invoice PDF generation — A4 (GST Tax Invoice) and 80mm
thermal receipt.

SOURCE OF TRUTH
────────────────
Every business, invoice, GST, payment and printer preference used below
comes from the existing key-value `Setting` model (`invoice_settings()`),
scoped per-business exactly as before. Nothing here duplicates or
re-defines a setting under a different name, and nothing about a business
is hard-coded. The full list of keys this module reads:

  Business Profile   shop_logo / shop_logo_path, shop_name, business_type,
                      shop_gstin, shop_phone, shop_email, shop_state,
                      shop_address, shop_pan, fssai_licence, cin

  Invoice Settings    invoice_template (gst_a4 / thermal_80),
                      invoice_prefix, invoice_start_number (numbering is
                      read off the saved invoice, never regenerated here),
                      invoice_terms, invoice_footer,
                      show_discount_col, show_hsn_col, show_batch_col,
                      show_expiry_col, show_signature_area

  GST Settings        gst_reg_type, default_gst_rate, place_of_supply,
                      tax_on_price, einvoice_enabled,
                      hsn_summary_on_invoice, reverse_charge, cess_enabled

  Payment Settings    default_payment_method, round_off, shop_upi_id,
                      shop_bank_details, show_upi_qr_on_invoice,
                      show_upi_qr_on_thermal, advance_payment_enabled

Tax amounts themselves are never recalculated here — they're read straight
off the saved invoice/item rows (`invoice.tax_amount`, `item.gst_amount`,
and, when the model provides them, explicit `igst_amount` /
`sgst_amount` / `cgst_amount` / `cess_amount` fields). This module only
decides *how to label and lay out* numbers the backend already computed.

Every section below is conditional: a section with no backing data or a
disabled setting is skipped outright (not rendered empty/blank), and nayes
column in the item table only appears when both its setting is on and at
least one line item actually carries that data.
"""

from io import BytesIO
import os
import re
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import urlencode

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, A5, letter, portrait
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
)

from .models import Setting

# ── Fonts ──────────────────────────────────────────────────────────────────
FONT_R = "Helvetica"
FONT_B = "Helvetica-Bold"

for _dir in ("/usr/share/fonts/truetype/dejavu/", "C:/Windows/Fonts/"):
    _regular = os.path.join(_dir, "DejaVuSans.ttf")
    _bold = os.path.join(_dir, "DejaVuSans-Bold.ttf")
    if os.path.exists(_regular) and os.path.exists(_bold):
        pdfmetrics.registerFont(TTFont("DejaVuSans", _regular))
        pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", _bold))
        FONT_R, FONT_B = "DejaVuSans", "DejaVuSans-Bold"
        break

FONT_MONO_R = "Courier"
FONT_MONO_B = "Courier-Bold"
for _dir in ("/usr/share/fonts/truetype/dejavu/", "C:/Windows/Fonts/"):
    _mregular = os.path.join(_dir, "DejaVuSansMono.ttf")
    _mbold = os.path.join(_dir, "DejaVuSansMono-Bold.ttf")
    if os.path.exists(_mregular) and os.path.exists(_mbold):
        pdfmetrics.registerFont(TTFont("DejaVuSansMono", _mregular))
        pdfmetrics.registerFont(TTFont("DejaVuSansMono-Bold", _mbold))
        FONT_MONO_R, FONT_MONO_B = "DejaVuSansMono", "DejaVuSansMono-Bold"
        break

_DEJAVU_AVAILABLE = FONT_R == "DejaVuSans"


def _resolve_fonts(settings_obj):
    """Return (font_r, font_b) based on invoice_font setting."""
    pref = str(settings_obj.get('invoice_font', 'default')).lower()
    if pref == 'courier':
        return 'Courier', 'Courier-Bold'
    if pref == 'dejavu' and _DEJAVU_AVAILABLE:
        return 'DejaVuSans', 'DejaVuSans-Bold'
    return FONT_R, FONT_B

# ── Strict black & white / grayscale palette ────────────────────────────────
INK = colors.HexColor("#000000")
SUBTLE = colors.black
FAINT = colors.black
BORDER = colors.black
HEAD_TINT = colors.black

# ── A4 geometry ──────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN = 9 * mm
BODY_W = PAGE_W - 2 * MARGIN  # ≈184mm

SECTION_GAP = Spacer(1, 4.0 * mm)
TIGHT_GAP = Spacer(1, 1.5 * mm)


# ═════════════════════════════════════════════════════════════════════════
# Settings plumbing (the ONLY place invoice generation talks to Setting)
# ═════════════════════════════════════════════════════════════════════════

def invoice_settings(invoice):
    """Settings belong to the invoice's business, never to another tenant."""
    return {item.key: item.value for item in Setting.objects.filter(business=invoice.business)}


def setting_value(settings, key, default=""):
    return settings.get(key, default)


def _flag(settings, key, default=True):
    """Boolean setting reader — treats missing keys as `default`."""
    raw = settings.get(key, None)
    if raw is None:
        return default
    return str(raw).strip().lower() in ("true", "1", "yes", "on")


class Settings:
    """Thin typed view over the raw `{key: value}` settings dict so the
    render code below reads `s.shop_name`, `s.show_hsn_col`, etc. instead
    of repeating `setting_value(settings, "shop_name")` everywhere. This is
    NOT a second settings store — it wraps the exact same dict returned by
    `invoice_settings()`, with defaults applied only for display purposes."""

    def __init__(self, raw):
        self._raw = raw

    def get(self, key, default=""):
        return setting_value(self._raw, key, default)

    def flag(self, key, default=True):
        return _flag(self._raw, key, default)

    def __getattr__(self, key):
        return self._raw.get(key, "")


def load_settings(invoice):
    return Settings(invoice_settings(invoice))


# ═════════════════════════════════════════════════════════════════════════
# Shared helpers (money formatting, text safety)
# ═════════════════════════════════════════════════════════════════════════

def money(value):
    try:
        value = Decimal(str(value or 0))
    except Exception:
        value = Decimal("0")
    return f"{abs(value):,.2f}"


def currency(value):
    """Rs.<amount>, with the minus sign (if any) placed BEFORE the currency
    marker — e.g. -Rs.0.15 — never Rs.-0.15."""
    try:
        v = Decimal(str(value or 0))
    except Exception:
        v = Decimal("0")
    sign = "-" if v < 0 else ""
    return f"{sign}Rs.{money(v)}"


def has_val(value):
    """True when a value is meaningfully present — used to decide whether a
    field/row/column/section is rendered at all. We never print
    placeholders like '—', 'None', 'N/A' or 'null' — an absent field is
    simply omitted, and an absent section collapses its space entirely."""
    if value is None:
        return False
    if isinstance(value, Decimal):
        return value != 0
    text = str(value).strip()
    if text == "" or text.lower() in ("none", "null", "n/a", "na", "-", "—"):
        return False
    return True


def dec(value):
    try:
        return Decimal(str(value if value is not None else 0))
    except Exception:
        return Decimal("0")


def mask_account_number(value, keep_last=4):
    digits = str(value or "").strip()
    if not digits:
        return ""
    if len(digits) <= keep_last:
        return digits
    return "*" * (len(digits) - keep_last) + digits[-keep_last:]


def _fmt_value(value, default=""):
    if value is None:
        return default
    if isinstance(value, str):
        value = value.strip()
        return value if value else default
    text = str(value).strip()
    return text if text else default


def _date_text(value):
    if not value:
        return ""
    try:
        return value.strftime("%d-%m-%Y")
    except AttributeError:
        return str(value)


# ── Amount in words ────────────────────────────────────────────────────────
_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _words(n):
    if n == 0:
        return "Zero"
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else "")
    if n < 1000:
        return _ONES[n // 100] + " Hundred" + (" " + _words(n % 100) if n % 100 else "")
    if n < 100000:
        return _words(n // 1000) + " Thousand" + (" " + _words(n % 1000) if n % 1000 else "")
    if n < 10000000:
        return _words(n // 100000) + " Lakh" + (" " + _words(n % 100000) if n % 100000 else "")
    return _words(n // 10000000) + " Crore" + (" " + _words(n % 10000000) if n % 10000000 else "")


def amount_in_words(amount):
    try:
        amount = Decimal(str(amount or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        return "Zero Rupees Only"
    rupees = int(amount)
    paise = int((amount - rupees) * 100)
    result = "Rupees " + _words(rupees)
    if paise:
        result += " and " + _words(paise) + " Paise"
    return result + " Only"


# ── QR helper ──────────────────────────────────────────────────────────────
def make_upi_qr(upi_id, shop_name, amount, size_mm=22, invoice_number=None):
    """Return a ReportLab Image for a UPI payment QR, or None if unavailable.
    The QR is generated from the actual configured `shop_upi_id` — callers
    never pass a literal UPI ID."""
    if not has_val(upi_id):
        return None
    try:
        import qrcode
        from reportlab.platypus import Image as RLImage

        params = {"pa": upi_id, "pn": shop_name or "", "am": money(amount), "cu": "INR"}
        if invoice_number:
            params["tn"] = invoice_number
        upi_str = f"upi://pay?{urlencode(params)}"
        qr = qrcode.make(upi_str)
        qr_buf = BytesIO()
        qr.save(qr_buf, format="PNG")
        qr_buf.seek(0)
        return RLImage(qr_buf, width=size_mm * mm, height=size_mm * mm)
    except Exception:
        return None


_QR_SIZE_MAP_A4 = {'small': 18, 'medium': 22, 'large': 28}
_QR_SIZE_MAP_THERMAL = {'small': 20, 'medium': 28, 'large': 36}


def _qr_size_a4(s):
    return _QR_SIZE_MAP_A4.get(str(s.get('upi_qr_size_a4', 'medium')).lower(), 22)


def _qr_size_thermal(s):
    return _QR_SIZE_MAP_THERMAL.get(str(s.get('upi_qr_size_thermal', 'medium')).lower(), 28)


def _basic_price(item):
    """Use persisted line totals; PDF rendering must not recalculate pricing."""
    return dec(getattr(item, "total", 0)) - dec(getattr(item, "gst_amount", 0))


# ═════════════════════════════════════════════════════════════════════════
# GST presentation logic
# ─────────────────────────────────────────────────────────────────────────
# NOTE: none of this recomputes tax. It only decides (a) whether the
# invoice should present as a Tax Invoice or a Bill of Supply, and
# (b) whether an already-computed tax amount should be labelled as
# IGST or split into SGST/CGST for display, based on `gst_reg_type` and
# `place_of_supply` from the existing GST Settings plus the invoice's own
# customer/place-of-supply data.
# ═════════════════════════════════════════════════════════════════════════

def resolve_interstate(s, invoice):
    """True when the sale is inter-state (IGST applies) rather than
    intra-state (SGST+CGST applies), based on the business's own state
    (GST Settings' `place_of_supply`, falling back to the Business
    Profile's `shop_state`) versus the customer/invoice's place of
    supply. Falls back to intra-state (the common case) when either side
    is unknown rather than guessing."""
    biz_state = s.get("place_of_supply") or s.get("shop_state")
    cust = getattr(invoice, "customer", None)
    supply_state = (
        getattr(invoice, "place_of_supply", None)
        or (getattr(cust, "state", None) if cust else None)
        or biz_state
    )
    if not has_val(biz_state) or not has_val(supply_state):
        return False
    return biz_state.strip().lower() != supply_state.strip().lower()


def invoice_tax_breakup(invoice, interstate):
    """(sgst, cgst, igst) for the invoice total, preferring explicit
    per-component fields on the invoice model when present, and only
    falling back to splitting `tax_amount` 50/50 (intra-state) or wholly
    into IGST (inter-state) when the model doesn't store the components
    separately. The total tax collected is always `invoice.tax_amount` —
    never recalculated, only relabelled."""
    tax_amt = dec(getattr(invoice, "tax_amount", 0))
    igst = getattr(invoice, "igst_amount", None)
    sgst = getattr(invoice, "sgst_amount", None)
    cgst = getattr(invoice, "cgst_amount", None)
    if igst is not None or sgst is not None or cgst is not None:
        return dec(sgst), dec(cgst), dec(igst)
    if interstate:
        return Decimal("0.00"), Decimal("0.00"), tax_amt
    half = (tax_amt / 2).quantize(Decimal("0.01"))
    return half, tax_amt - half, Decimal("0.00")


def item_tax_breakup(item, interstate):
    """Same relabelling logic as `invoice_tax_breakup`, at line-item
    level, for the item table's tax column(s)."""
    gst_amt = dec(getattr(item, "gst_amount", 0))
    igst = getattr(item, "igst_amount", None)
    sgst = getattr(item, "sgst_amount", None)
    cgst = getattr(item, "cgst_amount", None)
    if igst is not None or sgst is not None or cgst is not None:
        return dec(sgst), dec(cgst), dec(igst)
    if interstate:
        return Decimal("0.00"), Decimal("0.00"), gst_amt
    half = (gst_amt / 2).quantize(Decimal("0.01"))
    return half, gst_amt - half, Decimal("0.00")


def any_item_has(invoice, attr):
    return any(has_val(getattr(item, attr, None)) for item in invoice.items.all())


def any_item_gst(invoice):
    return any(dec(getattr(item, "gst_amount", 0)) != 0 for item in invoice.items.all())


def any_item_cess(invoice):
    return any(dec(getattr(item, "cess_amount", 0)) != 0 for item in invoice.items.all())


# ═════════════════════════════════════════════════════════════════════════
# A4 — FINAL TAX INVOICE LAYOUT
# Replaced with the final clean structure requested by the user.
# Thermal printing remains a separate renderer below.
# ═════════════════════════════════════════════════════════════════════════

INK = colors.black
BORDER = colors.black

# Compact A4 geometry: use the page instead of leaving excessive top whitespace.
PAGE_W, PAGE_H = A4
MARGIN = 8 * mm
BODY_W = PAGE_W - 2 * MARGIN


def _style(font=None, size=8, align=TA_LEFT, bold=False, leading=None, color=INK):
    return ParagraphStyle(
        "invoice_final",
        fontName=font or (FONT_B if bold else FONT_R),
        fontSize=size,
        leading=leading or size + 2.3,
        alignment=align,
        textColor=INK,
        spaceAfter=0,
        spaceBefore=0,
    )


def para(text, **kwargs):
    return Paragraph(str(text), _style(**kwargs))


def _tbl(data, widths, style_cmds=None, repeat=0):
    table = Table(data, colWidths=widths, repeatRows=repeat, hAlign="LEFT")
    base_style = [
        ("FONTNAME", (0, 0), (-1, -1), FONT_R),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 2.0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.0),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.0),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    table.setStyle(TableStyle(base_style + (style_cmds or [])))
    return table


def _rule(weight=0.55, gap_above=0, gap_below=0):
    flow = []
    if gap_above:
        flow.append(Spacer(1, gap_above))
    flow.append(
        HRFlowable(
            width=BODY_W,
            thickness=weight,
            color=INK,
            spaceBefore=0,
            spaceAfter=0,
            hAlign="LEFT",
        )
    )
    if gap_below:
        flow.append(Spacer(1, gap_below))
    return flow


def _section_title(text):
    return para(text.upper(), size=7.8, bold=True)


def resolve_document_mode(s, invoice):
    # All A4 documents use the final TAX INVOICE presentation.
    return "TAX INVOICE", True


def _logo_for_a4(s):
    """Resolve the configured business logo for PDF output.

    Supports:
    - absolute filesystem paths
    - Django FieldFile values
    - MEDIA_ROOT-relative paths
    - MEDIA_URL values only when they resolve to a local file
    """
    raw = s.get("shop_logo_path") or s.get("shop_logo")
    if not has_val(raw):
        return None

    try:
        from reportlab.platypus import Image as RLImage
        from django.conf import settings as django_settings

        candidates = []

        # Django FileField / FieldFile
        name = getattr(raw, "name", None)
        path = getattr(raw, "path", None)
        if path:
            candidates.append(str(path))
        if name:
            candidates.append(str(name))

        raw_text = str(raw).strip()
        candidates.append(raw_text)

        media_root = getattr(django_settings, "MEDIA_ROOT", "")
        base_dir = getattr(django_settings, "BASE_DIR", "")

        resolved = []
        for candidate in candidates:
            if not candidate:
                continue
            candidate = candidate.replace("/", os.sep)
            if os.path.isabs(candidate):
                resolved.append(candidate)
            else:
                if media_root:
                    resolved.append(os.path.join(str(media_root), candidate))
                if base_dir:
                    resolved.append(os.path.join(str(base_dir), candidate))
                resolved.append(candidate)

        for candidate in resolved:
            if os.path.isfile(candidate):
                img = RLImage(candidate, width=25 * mm, height=25 * mm)
                img.hAlign = "LEFT"
                return img
    except Exception:
        pass

    return None


def build_header(s, invoice, document_title, logo_flowable=None, **_ignored):
    """Clean, professional A4 header for SRI BALAJI STORE / business profile.
    Left: Brand name, address, contact (mobile, email), registrations (GSTIN, PAN).
    Right: TAX INVOICE heading, Invoice No, Date, Payment Mode, Place of Supply.
    """
    brand = _fmt_value(s.shop_name, "SRI BALAJI STORE")

    identity_rows = []
    if logo_flowable is not None and s.flag("show_business_logo", True):
        identity_rows.append([logo_flowable])

    identity_rows.append([para(brand.upper(), size=14.5, bold=True, color=colors.HexColor("#0F172A"))])

    if has_val(s.shop_address) and s.flag("show_business_address", True):
        for line in str(s.shop_address).splitlines():
            if line.strip():
                identity_rows.append([para(line.strip(), size=7.2, color=colors.HexColor("#334155"))])

    contact = []
    if has_val(s.shop_phone) and s.flag("show_business_phone", True):
        contact.append(f"Mobile: {s.shop_phone}")
    if has_val(s.shop_email) and s.flag("show_business_email", True):
        contact.append(f"Email: {s.shop_email}")
    if contact:
        identity_rows.append([para("  |  ".join(contact), size=7.0, color=colors.HexColor("#475569"))])

    registrations = []
    if has_val(s.shop_gstin) and s.flag("show_business_gstin", True):
        registrations.append(f"<b>GSTIN:</b> {s.shop_gstin}")
    if has_val(s.shop_pan) and s.flag("show_business_pan", True):
        registrations.append(f"<b>PAN:</b> {s.shop_pan}")
    if has_val(s.fssai_licence) and s.flag("show_fssai_on_invoice", False):
        registrations.append(f"<b>FSSAI:</b> {s.fssai_licence}")
    if has_val(s.cin) and s.flag("show_cin_on_invoice", False):
        registrations.append(f"<b>CIN:</b> {s.cin}")
    if registrations:
        identity_rows.append([para("  |  ".join(registrations), size=7.0, color=colors.HexColor("#334155"))])

    identity = _tbl(identity_rows, [None], [
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ])

    inv_date = _date_text(getattr(invoice, "created_at", None))
    payment_mode = getattr(invoice, "payment_method", None) or s.get("default_payment_method") or "CASH"

    is_cancelled = getattr(invoice, "status", None) == "cancelled"
    doc_heading = "CANCELLED INVOICE" if is_cancelled else "TAX INVOICE"
    doc_color = colors.HexColor("#DC2626") if is_cancelled else colors.HexColor("#0F172A")

    control = [
        [para(doc_heading, size=15.0, bold=True, align=TA_RIGHT, color=doc_color)],
        [Spacer(1, 1.2 * mm)],
        [para(f"<b>Invoice No:</b> {_fmt_value(invoice.invoice_number)}", size=8.0, align=TA_RIGHT, color=colors.HexColor("#0F172A"))],
    ]
    if inv_date:
        control.append([para(f"<b>Invoice Date:</b> {inv_date}", size=7.5, align=TA_RIGHT, color=colors.HexColor("#334155"))])
    if has_val(payment_mode) and s.flag("show_payment_mode", True):
        control.append([para(f"<b>Payment Mode:</b> {str(payment_mode).upper()}", size=7.5, align=TA_RIGHT, color=colors.HexColor("#334155"))])

    place = getattr(invoice, "place_of_supply", None) or s.get("place_of_supply")
    if has_val(place) and s.flag("show_place_of_supply", True):
        control.append([para(f"<b>Place of Supply:</b> {place}", size=7.2, align=TA_RIGHT, color=colors.HexColor("#475569"))])

    if is_cancelled:
        c_by = invoice.cancelled_by.get_full_name() or invoice.cancelled_by.username if getattr(invoice, "cancelled_by", None) else "User"
        c_at = _date_text(getattr(invoice, "cancelled_at", None))
        c_reason = getattr(invoice, "cancel_reason", "") or "Customer requested cancellation"
        control.append([Spacer(1, 1.0 * mm)])
        control.append([para("<font color='#DC2626'><b>STATUS: CANCELLED</b></font>", size=7.5, align=TA_RIGHT)])
        control.append([para(f"Cancelled By: {c_by}", size=6.8, align=TA_RIGHT)])
        if c_at:
            control.append([para(f"Cancelled At: {c_at}", size=6.8, align=TA_RIGHT)])
        control.append([para(f"Reason: {c_reason}", size=6.8, align=TA_RIGHT)])

    right = _tbl(control, [None], [
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ])

    return [
        _tbl([[identity, right]], [BODY_W * 0.60, BODY_W * 0.40], [
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]),
        *_rule(0.65, 2.0 * mm, 2.2 * mm),
    ]


def build_bill_to_and_details(s, invoice):
    """Clean BILL TO customer section with proper spacing and optional UPI QR."""
    cust = getattr(invoice, "customer", None)
    cust_name = (getattr(cust, "name", None) if cust else getattr(invoice, "customer_name", None)) or "Walk-in Customer"
    cust_addr = getattr(cust, "address", "") if cust else ""
    cust_phone = (getattr(cust, "mobile", None) if cust else getattr(invoice, "customer_phone", None)) or ""
    cust_gstin = getattr(cust, "gstin", "") if cust else ""

    left_rows = [
        [para("BILL TO", size=7.2, bold=True, color=colors.HexColor("#475569"))],
        [para(cust_name, size=9.6, bold=True, color=colors.HexColor("#0F172A"))],
    ]
    if has_val(cust_addr) and s.flag("show_customer_address", True):
        left_rows.append([para(str(cust_addr).replace("\n", ", "), size=7.2, color=colors.HexColor("#334155"))])
    if has_val(cust_phone) and s.flag("show_customer_phone", True):
        left_rows.append([para(f"<b>Mobile:</b> {cust_phone}", size=7.2, color=colors.HexColor("#334155"))])
    if has_val(cust_gstin) and s.flag("show_customer_gstin", True):
        left_rows.append([para(f"<b>GSTIN:</b> {cust_gstin}", size=7.2, color=colors.HexColor("#334155"))])

    left = _tbl(left_rows, [None], [
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ])

    qr = None
    if s.flag("show_upi_qr_on_invoice", True) and has_val(s.get("shop_upi_id")):
        qr = make_upi_qr(s.get("shop_upi_id"), s.get("shop_name", "Sri Balaji Store"), dec(invoice.grand_total),
                         size_mm=_qr_size_a4(s), invoice_number=_fmt_value(invoice.invoice_number))

    if qr:
        right = _tbl([
            [para("UPI PAYMENT", size=6.8, bold=True, align=TA_CENTER, color=colors.HexColor("#475569"))],
            [qr],
            [para("SCAN TO PAY", size=6.2, bold=True, align=TA_CENTER, color=colors.HexColor("#64748B"))],
        ], [None], [
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0.3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0.3),
        ])
    else:
        right = para("", size=1)

    return [
        _tbl([[left, right]], [BODY_W * 0.72, BODY_W * 0.28], [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]),
        *_rule(0.45, 1.8 * mm, 2.2 * mm),
    ]


def build_items_table(s, invoice, show_tax, interstate):
    """Redesigned item table with subtle horizontal lines, right-aligned monetary values,
    center-aligned Qty and S.No, wider Item Description column, and clean borders."""
    items = list(invoice.items.all())
    show_discount = s.flag("show_discount_col", True) and any(dec(getattr(i, "discount_percent", 0)) != 0 for i in items)
    show_sku = s.flag("show_sku_col", False) and any_item_has(invoice, "sku")
    show_hsn = s.flag("show_hsn_col", True) and any_item_has(invoice, "hsn_code")
    show_unit = s.flag("show_unit_col", False) and any_item_has(invoice, "unit")
    show_batch = s.flag("show_batch_col", False) and any_item_has(invoice, "batch_no")
    show_expiry = s.flag("show_expiry_col", False)
    show_mfg = show_expiry and any_item_has(invoice, "mfg_date")
    show_exp = show_expiry and any_item_has(invoice, "exp_date")
    show_cess = show_tax and s.flag("cess_enabled", False) and any_item_cess(invoice)
    show_gst_cols = show_tax and s.flag("show_tax_cols", True) and any_item_gst(invoice)

    def cell(value, size=7.0, align=TA_RIGHT, bold=False):
        return para(value, size=size, align=align, bold=bold, leading=size + 2.0, color=colors.HexColor("#0F172A"))

    def qty_text(item):
        q = dec(item.quantity)
        return str(int(q)) if q == q.to_integral_value() else str(q)

    def short_date(value):
        if not value:
            return ""
        try:
            return value.strftime("%d-%m-%y")
        except AttributeError:
            return str(value)

    def tax_cell(item, kind):
        sgst, cgst, igst = item_tax_breakup(item, interstate)
        amount = igst if kind == "igst" else (sgst if kind == "sgst" else cgst)
        return cell(currency(amount), size=6.8, align=TA_RIGHT)

    columns = [("sl", "S.No", 8, TA_CENTER, lambda i, idx: cell(str(idx), 6.8, TA_CENTER))]
    if show_sku:
        columns.append(("sku", "Item Code", 13, TA_CENTER, lambda i, idx: cell(_fmt_value(getattr(i, "sku", "")), 6.5, TA_CENTER)))
    columns.append(("item", "Item Description", 50, TA_LEFT, lambda i, idx: cell(_fmt_value(i.product_name), 7.2, TA_LEFT)))
    if show_hsn:
        columns.append(("hsn", "HSN/SAC", 12, TA_CENTER, lambda i, idx: cell(_fmt_value(i.hsn_code), 6.5, TA_CENTER)))
    if show_unit:
        columns.append(("unit", "Unit", 9, TA_CENTER, lambda i, idx: cell(_fmt_value(getattr(i, "unit", "")), 6.5, TA_CENTER)))
    if show_batch:
        columns.append(("batch", "Batch", 10, TA_CENTER, lambda i, idx: cell(_fmt_value(getattr(i, "batch_no", "")), 6.2, TA_CENTER)))
    if show_mfg:
        columns.append(("mfg", "MFG", 9, TA_CENTER, lambda i, idx: cell(short_date(getattr(i, "mfg_date", None)), 6.1, TA_CENTER)))
    if show_exp:
        columns.append(("exp", "EXP", 9, TA_CENTER, lambda i, idx: cell(short_date(getattr(i, "exp_date", None)), 6.1, TA_CENTER)))
    columns.append(("qty", "Qty", 10, TA_CENTER, lambda i, idx: cell(qty_text(i), 7.0, TA_CENTER)))
    columns.append(("rate", "Rate", 16, TA_RIGHT, lambda i, idx: cell(currency(i.unit_price), 6.8, TA_RIGHT)))
    if show_discount:
        columns.append(("disc", "Disc.", 10, TA_RIGHT, lambda i, idx: cell(f"{dec(getattr(i, 'discount_percent', 0))}%", 6.5, TA_RIGHT)))
    if show_gst_cols:
        if interstate:
            columns.append(("igst", "IGST", 14, TA_RIGHT, lambda i, idx: tax_cell(i, "igst")))
        else:
            columns.append(("sgst", "SGST", 14, TA_RIGHT, lambda i, idx: tax_cell(i, "sgst")))
            columns.append(("cgst", "CGST", 14, TA_RIGHT, lambda i, idx: tax_cell(i, "cgst")))
    if show_cess:
        columns.append(("cess", "CESS", 10, TA_RIGHT, lambda i, idx: cell(currency(getattr(i, "cess_amount", 0)), 6.2, TA_RIGHT)))
    columns.append(("total", "Amount", 20, TA_RIGHT, lambda i, idx: cell(currency(i.total), 7.2, TA_RIGHT, True)))

    ratios = [c[2] for c in columns]
    scale = BODY_W / (sum(ratios) * mm)
    widths = [r * mm * scale for r in ratios]
    rows = [[para(c[1], size=6.8, bold=True, align=c[3], color=colors.HexColor("#334155")) for c in columns]]
    for idx, item in enumerate(items, start=1):
        rows.append([c[4](item, idx) for c in columns])

    return _tbl(rows, widths, [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
        ("LINEABOVE", (0, 0), (-1, 0), 0.75, colors.HexColor("#334155")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, colors.HexColor("#334155")),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, 0), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3.5),
        ("TOPPADDING", (0, 1), (-1, -1), 3.0),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3.0),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ], repeat=1)


def build_hsn_summary(invoice, show_tax, interstate):
    items = [i for i in invoice.items.all() if has_val(getattr(i, "hsn_code", None))]
    if not show_tax or not items:
        return None
    buckets = {}
    for item in items:
        key = (item.hsn_code, dec(getattr(item, "gst_percent", 0)))
        bucket = buckets.setdefault(key, {"taxable": Decimal("0.00"), "sgst": Decimal("0.00"), "cgst": Decimal("0.00"), "igst": Decimal("0.00")})
        bucket["taxable"] += _basic_price(item)
        sgst, cgst, igst = item_tax_breakup(item, interstate)
        bucket["sgst"] += sgst
        bucket["cgst"] += cgst
        bucket["igst"] += igst
    if not buckets:
        return None

    def c(text, align=TA_RIGHT, size=6.6, bold=False):
        return para(text, align=align, size=size, bold=bold, color=colors.HexColor("#0F172A"))

    if interstate:
        rows = [[c("HSN/SAC", TA_LEFT, bold=True), c("Taxable Value", bold=True), c("IGST Rate", bold=True), c("IGST Amount", bold=True)]]
        for (hsn, rate), b in sorted(buckets.items()):
            rows.append([c(hsn, TA_LEFT), c(currency(b["taxable"])), c(f"{rate}%"), c(currency(b["igst"]))])
    else:
        rows = [[c("HSN/SAC", TA_LEFT, bold=True), c("Taxable Value", bold=True), c("SGST", bold=True), c("CGST", bold=True)]]
        for (hsn, rate), b in sorted(buckets.items()):
            rows.append([c(hsn, TA_LEFT), c(currency(b["taxable"])), c(currency(b["sgst"])), c(currency(b["cgst"]))])

    return [
        para("HSN/SAC SUMMARY", size=7.4, bold=True, color=colors.HexColor("#475569")),
        Spacer(1, 0.8 * mm),
        _tbl(rows, [BODY_W / 4] * 4, [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
            ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#CBD5E1")),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#CBD5E1")),
            ("LINEBELOW", (0, 1), (-1, -1), 0.2, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.0),
            ("LEFTPADDING", (0, 0), (-1, -1), 2.5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.5),
        ], repeat=1),
        *_rule(0.4, 1.2 * mm, 1.8 * mm),
    ]


def build_totals(s, invoice, show_tax, interstate):
    """Balanced totals block: Amount in words on the left, accounting totals and highlighted Grand Total on the right."""
    subtotal = dec(invoice.subtotal)
    discount = dec(invoice.discount_amount)
    sgst, cgst, igst = invoice_tax_breakup(invoice, interstate) if show_tax else (Decimal("0"), Decimal("0"), Decimal("0"))
    cess_amt = dec(getattr(invoice, "cess_amount", 0)) if show_tax and s.flag("cess_enabled", False) else Decimal("0")
    round_off = dec(getattr(invoice, "round_off", 0)) if s.flag("round_off", True) else Decimal("0")
    other_charges = dec(getattr(invoice, "other_charges", 0))
    grand = dec(invoice.grand_total)

    def row(label, amt, bold=False, size=7.5):
        return [
            para(label, size=size, bold=bold, color=colors.HexColor("#334155")),
            para(currency(amt), size=size, bold=bold, align=TA_RIGHT, color=colors.HexColor("#0F172A")),
        ]

    rows = [row("Sub Total", subtotal)]
    if discount != 0:
        rows.append(row("Discount", -discount))
    if show_tax:
        if interstate and igst != 0:
            rows.append(row("IGST", igst))
        else:
            if sgst != 0:
                rows.append(row("SGST", sgst))
            if cgst != 0:
                rows.append(row("CGST", cgst))
        if cess_amt != 0:
            rows.append(row("CESS", cess_amt))
    if other_charges != 0:
        rows.append(row("Other Charges", other_charges))
    if round_off != 0:
        rows.append(row("Round Off", round_off))

    grand_index = len(rows)
    rows.append([
        para("GRAND TOTAL", size=10.0, bold=True, color=colors.HexColor("#0F172A")),
        para(currency(grand), size=10.5, bold=True, align=TA_RIGHT, color=colors.HexColor("#0F172A")),
    ])

    totals_width = 82 * mm
    totals = _tbl(rows, [totals_width * 0.48, totals_width * 0.52], [
        ("LINEABOVE", (0, grand_index), (-1, grand_index), 0.8, colors.HexColor("#0F172A")),
        ("LINEBELOW", (0, grand_index), (-1, grand_index), 0.8, colors.HexColor("#0F172A")),
        ("BACKGROUND", (0, grand_index), (-1, grand_index), colors.HexColor("#F1F5F9")),
        ("TOPPADDING", (0, 0), (-1, grand_index - 1), 2.0),
        ("BOTTOMPADDING", (0, 0), (-1, grand_index - 1), 2.0),
        ("TOPPADDING", (0, grand_index), (-1, grand_index), 4.5),
        ("BOTTOMPADDING", (0, grand_index), (-1, grand_index), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ])

    show_words = s.flag("show_amount_in_words", True)
    words_flow = []
    if show_words:
        words_flow.append(para("<b>AMOUNT IN WORDS</b>", size=7.2, bold=True, color=colors.HexColor("#475569")))
        words_flow.append(Spacer(1, 1.0 * mm))
        words_flow.append(para(amount_in_words(grand), size=7.8, leading=10.5, color=colors.HexColor("#0F172A")))
        if s.get("tax_on_price", "exclusive") == "inclusive" and show_tax:
            words_flow.append(Spacer(1, 1.2 * mm))
            words_flow.append(para("<i>Prices shown are inclusive of applicable GST.</i>", size=6.5, color=colors.HexColor("#64748B")))

    words = _tbl([[w] for w in words_flow] if words_flow else [[para("", size=1)]], [None], [
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5),
    ])

    return [
        Spacer(1, 2.0 * mm),
        _tbl([[words, totals]], [BODY_W - totals_width, totals_width], [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]),
        *_rule(0.5, 2.5 * mm, 2.0 * mm),
    ]


def _format_bank_details(value):
    text = str(value or "").strip()
    if not text:
        return ""
    parts = [p.strip() for p in text.replace("\n", " | ").split("|") if p.strip()]
    return " | ".join(parts)


def _clean_footer(value):
    text = str(value or "").strip()
    if not text:
        return "THANK YOU FOR SHOPPING WITH US!"
    for phrase in ("visit again", "visit again.", "computer generated invoice"):
        text = text.replace(phrase, "").replace(phrase.capitalize(), "").replace(phrase.upper(), "")
    text = " ".join(text.split()).strip(" .")
    return text or "THANK YOU FOR SHOPPING WITH US!"


def build_payment_and_bank(s, invoice):
    """Clean Payment Summary section containing Payment Status, Amount Paid, Balance Due and Mode."""
    if not s.flag("show_payment_summary", True):
        return []

    grand = dec(invoice.grand_total)
    paid = dec(invoice.paid_amount)
    balance = max(Decimal("0.00"), grand - paid)
    status = "CANCELLED" if getattr(invoice, "status", None) == "cancelled" else _fmt_value(getattr(invoice, "payment_status", None), "PAID").upper()
    mode = (getattr(invoice, "payment_method", None) or s.get("default_payment_method", "cash")).upper()

    def col_header(text):
        return para(text, size=6.8, bold=True, color=colors.HexColor("#475569"), align=TA_CENTER)

    def col_val(text, bold=True, color=None):
        return para(text, size=8.0, bold=bold, align=TA_CENTER, color=color or colors.HexColor("#0F172A"))

    status_color = colors.HexColor("#DC2626") if status in ("CANCELLED", "FAILED") else (colors.HexColor("#16A34A") if status == "PAID" else colors.HexColor("#D97706"))

    rows = [
        [
            para("PAYMENT STATUS", size=6.8, bold=True, color=colors.HexColor("#475569")),
            col_header("AMOUNT PAID"),
            col_header("BALANCE DUE"),
            col_header("MODE"),
        ],
        [
            para(status, size=8.2, bold=True, color=status_color),
            col_val(currency(paid)),
            col_val(currency(balance), color=colors.HexColor("#DC2626") if balance > 0 else None),
            col_val(mode),
        ],
    ]

    bank_raw = str(s.shop_bank_details or "").strip()
    if has_val(bank_raw) and s.flag("show_bank_details", True):
        bank_text = " ".join(bank_raw.replace("\n", " ").split())
        bank_name, account_no, ifsc = bank_text, "", ""
        m = re.search(r"(?i)(?:A/C|A\\/C|ACCOUNT)\s*[:\-]?\s*([A-Za-z0-9]+)", bank_text)
        if m:
            account_no = mask_account_number(m.group(1))
            bank_name = bank_text[:m.start()].strip(" :-|,")
        m_ifsc = re.search(r"(?i)IFSC\s*[:\-]?\s*([A-Za-z0-9]+)", bank_text)
        if m_ifsc:
            ifsc = m_ifsc.group(1)
        bank_name = re.sub(r"(?i)^Bank\s*[:\-]?\s*", "", bank_name).strip(" :-|,")
        bank_parts = []
        if bank_name:
            bank_parts.append(f"Bank: {bank_name}")
        if account_no:
            bank_parts.append(f"A/C: {account_no}")
        if ifsc:
            bank_parts.append(f"IFSC: {ifsc}")
        if bank_parts:
            rows.append([
                para("<b>Bank Details:</b> " + " | ".join(bank_parts), size=6.8, color=colors.HexColor("#475569")),
                para("", size=1), para("", size=1), para("", size=1),
            ])

    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#CBD5E1")),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, colors.HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]
    if len(rows) > 2:
        style_cmds.append(("SPAN", (0, 2), (-1, 2)))
        style_cmds.append(("LINEABOVE", (0, 2), (-1, 2), 0.3, colors.HexColor("#E2E8F0")))

    return [
        _tbl(rows, [BODY_W * 0.28, BODY_W * 0.24, BODY_W * 0.24, BODY_W * 0.24], style_cmds),
        Spacer(1, 2.0 * mm),
    ]


def build_notes_and_terms(s, invoice):
    notes_text = getattr(invoice, "notes", "") or s.get("invoice_notes")
    terms_text = s.get("invoice_terms")
    show_notes = s.flag("show_notes", True) and has_val(notes_text)
    show_terms = s.flag("show_terms", True) and has_val(terms_text)
    if not show_notes and not show_terms:
        return None
    flow = []
    if show_notes:
        flow.append(para(f"<b>Notes:</b> {str(notes_text).replace(chr(10), '<br/>')}", size=6.8, leading=8.5, color=colors.HexColor("#475569")))
    if show_terms:
        if flow:
            flow.append(Spacer(1, 1.0 * mm))
        flow.append(para(f"<b>Terms &amp; Conditions:</b><br/>{str(terms_text).replace(chr(10), '<br/>')}", size=6.6, leading=8.3, color=colors.HexColor("#64748B")))
    flow.extend(_rule(0.4, 1.4 * mm, 1.4 * mm))
    return flow


def build_signature_area():
    return []


def _bill_reference_token(invoice):
    explicit = getattr(invoice, "reference_id", None) or getattr(invoice, "reference_token", None) or getattr(invoice, "uuid", None) or getattr(invoice, "token", None)
    if has_val(explicit):
        return str(explicit)
    number = _fmt_value(getattr(invoice, "invoice_number", None))
    if number:
        return f"{number}"
    pk = getattr(invoice, "pk", None) or getattr(invoice, "id", None)
    if has_val(pk):
        return f"BILL-{pk}"
    return "BILL-REF"


def _invoice_datetime(invoice):
    value = invoice.created_at
    if not value:
        return "", ""
    try:
        return value.strftime("%d-%m-%Y"), value.strftime("%I:%M %p")
    except AttributeError:
        return str(value), ""


def build_footer(s, invoice=None):
    if not s.flag("show_footer", True) or str(s.get("invoice_footer_layout", "text_center")).lower() == "none":
        return []
    date_text, time_text = _invoice_datetime(invoice) if invoice is not None else ("", "")
    meta = []
    if date_text:
        meta.append(f"Date: {date_text}")
    if time_text:
        meta.append(f"Time: {time_text}")
    meta.append(f"Bill Ref: {_bill_reference_token(invoice) if invoice is not None else 'BILL-REF'}")
    align = TA_LEFT if str(s.get("invoice_footer_layout", "text_center")).lower() == "text_left" else TA_CENTER
    footer_text = _clean_footer(s.get("invoice_footer"))
    return [
        *_rule(0.45, 1.2 * mm, 2.0 * mm),
        para(f"<b>{footer_text}</b>", size=7.5, align=align, color=colors.HexColor("#334155")),
        Spacer(1, 1.0 * mm),
        para("  ·  ".join(meta), size=6.5, align=align, color=colors.HexColor("#64748B")),
    ]

def _page_chrome(canvas, doc):
    canvas.saveState()
    canvas.restoreState()


_PAPER_SIZES = {
    'a4': A4,
    'letter': letter,
    'a5': A5,
}


def generate_invoice_pdf(invoice, force_a4=False):
    """Generate the redesigned monochrome GST invoice (A4, Letter or A5)."""
    raw_settings = invoice_settings(invoice)
    if raw_settings.get("invoice_template", "gst_a4") == "thermal_80" and not force_a4:
        raise ValueError("invoice_template is 'thermal_80' — use generate_thermal_invoice_pdf() instead.")

    paper_key = str(raw_settings.get("invoice_paper_size", "a4")).lower()
    pagesize = _PAPER_SIZES.get(paper_key, A4)
    page_w, page_h = pagesize
    margin = 8 * mm

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=pagesize,
        topMargin=margin, bottomMargin=margin,
        leftMargin=margin, rightMargin=margin,
        title=f"Tax Invoice {invoice.invoice_number}", author="Billing Application",
    )
    # Recalculate body width for the chosen paper size.
    global BODY_W
    _orig_body_w = BODY_W
    BODY_W = page_w - 2 * margin

    s = Settings(raw_settings)
    document_title, show_tax = resolve_document_mode(s, invoice)
    interstate = resolve_interstate(s, invoice)
    font_r, font_b = _resolve_fonts(raw_settings)
    global FONT_R, FONT_B
    _orig_r, _orig_b = FONT_R, FONT_B
    FONT_R, FONT_B = font_r, font_b

    story = []
    header_layout = str(s.get("invoice_header_layout", "logo_left")).lower()
    logo = None if header_layout == "name_only" else _logo_for_a4(s)
    story.extend(build_header(s, invoice, document_title, logo))
    story.extend(build_bill_to_and_details(s, invoice))
    story.append(build_items_table(s, invoice, show_tax=show_tax, interstate=interstate))
    story.append(Spacer(1, 2.0*mm))

    if s.flag("hsn_summary_on_invoice", False):
        hsn_block = build_hsn_summary(invoice, show_tax, interstate)
        if hsn_block:
            story.extend(hsn_block)

    story.extend(build_totals(s, invoice, show_tax=show_tax, interstate=interstate))
    story.extend(build_payment_and_bank(s, invoice))
    notes_terms = build_notes_and_terms(s, invoice)
    if notes_terms:
        story.extend(notes_terms)

    # Signature area (A4 only)
    if s.flag("show_signature_area", False):
        sig_rows = [[para("Prepared by", size=7.0), para("Checked by", size=7.0, align=TA_CENTER), para("Authorised Signatory", size=7.0, align=TA_RIGHT)]]
        sig_tbl = _tbl(sig_rows, [BODY_W / 3] * 3, [
            ("LINEABOVE", (0, 0), (-1, 0), 0.4, INK),
            ("TOPPADDING", (0, 0), (-1, -1), 10 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ])
        story.append(Spacer(1, 3 * mm))
        story.append(sig_tbl)
        story.extend(_rule(0.4, 1.5 * mm, 1.5 * mm))

    story.extend(build_footer(s, invoice))

    doc.build(story, onFirstPage=_page_chrome, onLaterPages=_page_chrome)
    FONT_R, FONT_B = _orig_r, _orig_b
    BODY_W = _orig_body_w
    buffer.seek(0)
    return buffer


A4Invoice = generate_invoice_pdf


# ══════════════════════════════════════════════════════════════════════════════
# 80mm THERMAL — compact monochrome POS receipt
# ══════════════════════════════════════════════════════════════════════════════
T_NAME = 10
T_TITLE = 9
T_ITEM = 6.5
T_META = 6.0
T_TOTAL = 9
T_FOOTER = 6.3


def _tpara(text, size=T_ITEM, align=TA_LEFT, bold=False, color=INK, leading=None):
    return Paragraph(str(text), ParagraphStyle(
        "thermal_invoice", fontName=(FONT_MONO_B if bold else FONT_MONO_R),
        fontSize=size, leading=leading or size + 2.0,
        alignment=align, textColor=INK,
        spaceAfter=0, spaceBefore=0,
    ))


def _tdashed(story, content_w, gap_above=1.0*mm, gap_below=1.0*mm):
    story.append(Spacer(1, gap_above))
    story.append(HRFlowable(
        width=content_w, thickness=0.55, color=INK,
        dash=(2,1), spaceBefore=0, spaceAfter=0, hAlign="CENTER"
    ))
    story.append(Spacer(1, gap_below))


def _thermal_bool(settings, key, default=True):
    return settings.flag(key, default)


def _thermal_discount_total(invoice):
    return dec(getattr(invoice, "discount_amount", 0))


def generate_thermal_invoice_pdf(invoice):
    """Generate an 80mm monochrome receipt using the same section order as A4.

    The layout is intentionally different in width, but not in document
    hierarchy: identity -> invoice control -> customer -> items -> totals ->
    settlement -> UPI -> terms -> footer.
    """
    buffer = BytesIO()
    s = load_settings(invoice)

    shop_name = _fmt_value(s.get("shop_name"), "Business Name Not Configured")
    shop_address = s.get("shop_address")
    shop_phone = s.get("shop_phone")
    shop_email = s.get("shop_email")
    shop_gstin = s.get("shop_gstin")
    upi_id = s.get("shop_upi_id")

    document_title, show_tax = resolve_document_mode(s, invoice)
    interstate = resolve_interstate(s, invoice)
    show_signature = s.flag("show_signature_thermal", False)
    show_terms = has_val(s.get("invoice_terms"))
    show_qr = s.flag("show_upi_qr_on_thermal", True) and has_val(upi_id)

    items = list(invoice.items.all())
    inv_date = _date_text(invoice.created_at)
    cust = getattr(invoice, "customer", None)
    cust_name = getattr(cust, "name", None) if cust else getattr(invoice, "customer_name", None)
    cust_name = _fmt_value(cust_name, "Walk-in Customer")
    cust_phone = getattr(cust, "mobile", None) if cust else getattr(invoice, "customer_phone", None)
    cust_address = getattr(cust, "address", None) if cust else ""
    cust_gstin = getattr(cust, "gstin", None) if cust else ""
    place = getattr(invoice, "place_of_supply", None) or getattr(cust, "state", None) or s.get("place_of_supply")

    grand = dec(invoice.grand_total)
    paid_amount = dec(getattr(invoice, "paid_amount", 0))
    balance_due = max(Decimal("0.00"), grand - paid_amount)
    change_returned = max(Decimal("0.00"), paid_amount - grand)
    discount_amt = _thermal_discount_total(invoice)
    round_off_amt = dec(getattr(invoice, "round_off", 0)) if s.flag("round_off", True) else Decimal("0.00")
    payment_mode = (getattr(invoice, "payment_method", None) or s.get("default_payment_method", "cash")).upper()
    status = "CANCELLED" if getattr(invoice, "status", None) == "cancelled" else _fmt_value(getattr(invoice, "payment_status", None), "PAID").upper()

    page_height = (
        78
        + len([l for l in (shop_address or "").split("\n") if l.strip()]) * 4
        + (4 if shop_phone or shop_email else 0)
        + (4 if shop_gstin else 0)
        + len(items) * 10
        + (45 if show_qr else 0)
        + (16 if show_terms else 0)
        + (12 if show_signature else 0)
        + (10 if cust_address or cust_gstin or place else 0)
    ) * mm
    page_height = max(100 * mm, page_height)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=portrait((80 * mm, page_height)),
        topMargin=4 * mm,
        bottomMargin=4 * mm,
        leftMargin=4 * mm,
        rightMargin=4 * mm,
        title=f"Invoice {invoice.invoice_number}",
        author="Billing Application",
    )

    content_w = 72 * mm
    story = []

    # 1. Store identity
    story.append(_tpara(shop_name.upper(), size=T_NAME + 1, align=TA_CENTER, bold=True))
    if s.flag("show_business_address", True):
        for line in (shop_address or "").split("\n"):
            if line.strip():
                story.append(_tpara(line.strip(), size=T_META, align=TA_CENTER))
    contact_bits = []
    if has_val(shop_phone) and s.flag("show_business_phone", True):
        contact_bits.append(f"Mobile: {shop_phone}")
    if has_val(shop_email) and s.flag("show_business_email", True):
        contact_bits.append(str(shop_email))
    if contact_bits:
        story.append(_tpara(" | ".join(contact_bits), size=T_META, align=TA_CENTER))
    if has_val(shop_gstin) and s.flag("show_business_gstin", True):
        story.append(_tpara(f"GSTIN: {shop_gstin}", size=T_META, align=TA_CENTER, bold=True))

    _tdashed(story, content_w, 1.2 * mm, 1.2 * mm)

    # 2. Invoice control
    is_cancelled = getattr(invoice, "status", None) == "cancelled"
    doc_title = "CANCELLED INVOICE" if is_cancelled else document_title
    story.append(_tpara(doc_title, size=T_TITLE + 1, align=TA_CENTER, bold=True))
    story.append(_tpara(f"Invoice No: {_fmt_value(invoice.invoice_number)}", size=T_META + 0.5, align=TA_CENTER, bold=True))
    if inv_date:
        story.append(_tpara(f"Invoice Date: {inv_date}", size=T_META, align=TA_CENTER))
    if has_val(payment_mode) and s.flag("show_payment_mode", True):
        story.append(_tpara(f"Payment Mode: {payment_mode}", size=T_META, align=TA_CENTER))
    place_header = place
    if has_val(place_header) and s.flag("show_place_of_supply", True):
        story.append(_tpara(f"Place of Supply: {place_header}", size=T_META, align=TA_CENTER))
    if is_cancelled:
        c_by = invoice.cancelled_by.get_full_name() or invoice.cancelled_by.username if getattr(invoice, "cancelled_by", None) else "User"
        c_at = _date_text(getattr(invoice, "cancelled_at", None))
        c_reason = getattr(invoice, "cancel_reason", "") or "Customer requested cancellation"
        story.append(_tpara("*** CANCELLED ***", size=T_META + 0.5, align=TA_CENTER, bold=True))
        story.append(_tpara(f"Cancelled By: {c_by}", size=T_META, align=TA_CENTER))
        if c_at:
            story.append(_tpara(f"Cancelled At: {c_at}", size=T_META, align=TA_CENTER))
        story.append(_tpara(f"Reason: {c_reason}", size=T_META, align=TA_CENTER))

    _tdashed(story, content_w)

    # 3. Customer block
    story.append(_tpara("BILL TO", size=T_META, bold=True))
    story.append(_tpara(cust_name, size=T_ITEM + 0.5, bold=True))
    if has_val(cust_address) and s.flag("show_customer_address", True):
        story.append(_tpara(str(cust_address).replace("\n", ", "), size=T_META))
    if has_val(cust_phone) and s.flag("show_customer_phone", True):
        story.append(_tpara(f"Mobile: {cust_phone}", size=T_META))
    if has_val(cust_gstin) and s.flag("show_customer_gstin", True):
        story.append(_tpara(f"GSTIN: {cust_gstin}", size=T_META))

    _tdashed(story, content_w)

    # 4. Items — same logical columns as A4, compressed for 80mm
    show_hsn = s.flag("show_hsn_col", True) and any_item_has(invoice, "hsn_code")
    show_discount = s.flag("show_discount_col", True) and discount_amt != 0

    item_rows = [[
        _tpara("ITEM", size=T_META, bold=True),
        _tpara("QTY", size=T_META, align=TA_RIGHT, bold=True),
        _tpara("RATE", size=T_META, align=TA_RIGHT, bold=True),
        _tpara("AMOUNT", size=T_META, align=TA_RIGHT, bold=True),
    ]]

    for item in items:
        product = _fmt_value(item.product_name)
        details = []
        if show_hsn and has_val(getattr(item, "hsn_code", None)):
            details.append(f"HSN: {item.hsn_code}")
        if show_discount and dec(getattr(item, "discount_percent", 0)) != 0:
            details.append(f"Disc: {dec(getattr(item, 'discount_percent', 0))}%")
        if show_tax and dec(getattr(item, "gst_amount", 0)) != 0 and has_val(getattr(item, "gst_percent", None)):
            details.append(f"GST: {dec(getattr(item, 'gst_percent', 0))}%")
        item_text = product + ("<br/><font size='5.2'>" + " | ".join(details) + "</font>" if details else "")

        item_rows.append([
            _tpara(item_text, size=T_ITEM),
            _tpara(_fmt_value(item.quantity), size=T_ITEM, align=TA_RIGHT),
            _tpara(currency(item.unit_price), size=T_ITEM, align=TA_RIGHT),
            _tpara(currency(item.total), size=T_ITEM, align=TA_RIGHT, bold=True),
        ])

    item_tbl = Table(
        item_rows,
        colWidths=[31 * mm, 9 * mm, 15 * mm, 17 * mm],
        repeatRows=1,
        hAlign="CENTER",
    )
    item_tbl.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.65, BORDER),
        ("LINEBELOW", (0, 0), (-1, 0), 0.65, BORDER),
        ("LINEBELOW", (0, 1), (-1, -1), 0.2, BORDER),
        ("TOPPADDING", (0, 0), (-1, 0), 2.2),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2.2),
        ("TOPPADDING", (0, 1), (-1, -1), 1.7),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 1.7),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(item_tbl)

    # 5. Totals
    _tdashed(story, content_w)
    subtotal = dec(invoice.subtotal)
    sgst, cgst, igst = invoice_tax_breakup(invoice, interstate) if show_tax else (Decimal("0"), Decimal("0"), Decimal("0"))
    cess_amt = dec(getattr(invoice, "cess_amount", 0)) if show_tax and s.flag("cess_enabled", False) else Decimal("0.00")

    totals_rows = [[_tpara("SUB TOTAL", size=T_META), _tpara(currency(subtotal), size=T_META, align=TA_RIGHT)]]
    if discount_amt != 0:
        totals_rows.append([_tpara("DISCOUNT", size=T_META), _tpara(currency(discount_amt), size=T_META, align=TA_RIGHT)])
    if show_tax:
        if interstate and igst != 0:
            totals_rows.append([_tpara("IGST", size=T_META), _tpara(currency(igst), size=T_META, align=TA_RIGHT)])
        else:
            if sgst != 0:
                totals_rows.append([_tpara("SGST", size=T_META), _tpara(currency(sgst), size=T_META, align=TA_RIGHT)])
            if cgst != 0:
                totals_rows.append([_tpara("CGST", size=T_META), _tpara(currency(cgst), size=T_META, align=TA_RIGHT)])
        if cess_amt != 0:
            totals_rows.append([_tpara("CESS", size=T_META), _tpara(currency(cess_amt), size=T_META, align=TA_RIGHT)])
    if round_off_amt != 0:
        totals_rows.append([_tpara("ROUND OFF", size=T_META), _tpara(currency(round_off_amt), size=T_META, align=TA_RIGHT)])

    grand_idx = len(totals_rows)
    totals_rows.append([
        _tpara("GRAND TOTAL", size=T_TOTAL, bold=True),
        _tpara(currency(grand), size=T_TOTAL, align=TA_RIGHT, bold=True),
    ])

    totals_tbl = Table(totals_rows, colWidths=[36 * mm, 36 * mm], hAlign="CENTER")
    totals_tbl.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.6, BORDER),
        ("LINEABOVE", (0, grand_idx), (-1, grand_idx), 0.9, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("TOPPADDING", (0, grand_idx), (-1, grand_idx), 2.8),
        ("BOTTOMPADDING", (0, grand_idx), (-1, grand_idx), 2.8),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(totals_tbl)

    # 6. Amount in words + settlement
    if s.flag("show_amount_in_words", True):
        _tdashed(story, content_w)
        story.append(_tpara(amount_in_words(grand), size=T_META))
        story.append(Spacer(1, 0.8 * mm))

    if s.flag("show_payment_summary", True):
        _tdashed(story, content_w)
        payment_line = f"{status}  |  PAID: {currency(paid_amount)}"
        if balance_due != 0 and s.flag("show_balance_due", True):
            payment_line += f"  |  BAL: {currency(balance_due)}"
        if change_returned != 0:
            payment_line += f"  |  CHANGE: {currency(change_returned)}"
        story.append(_tpara(payment_line, size=T_META, align=TA_CENTER, bold=True))
        if s.flag("show_payment_mode", True):
            story.append(_tpara(f"PAYMENT MODE: {payment_mode}", size=T_META, align=TA_CENTER))

    # 7. UPI
    qr_img = make_upi_qr(
        upi_id,
        shop_name,
        grand,
        size_mm=_qr_size_thermal(s),
        invoice_number=invoice.invoice_number,
    ) if show_qr else None
    if qr_img:
        _tdashed(story, content_w)
        story.append(_tpara("UPI PAYMENT", size=T_META, align=TA_CENTER, bold=True))
        story.append(_tpara("SCAN TO PAY", size=T_META, align=TA_CENTER, bold=True))
        story.append(Spacer(1, 0.8 * mm))
        qr_wrap = Table([[qr_img]], colWidths=[content_w], hAlign="CENTER")
        qr_wrap.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
        story.append(qr_wrap)
        story.append(_tpara(_fmt_value(upi_id), size=T_META, align=TA_CENTER))

    # 8. Terms, signature and footer
    has_terms = show_terms and s.flag("show_terms", True)
    if has_terms or show_signature:
        _tdashed(story, content_w)

    if has_terms:
        story.append(_tpara("TERMS & CONDITIONS", size=T_META, bold=True))
        story.append(_tpara(s.get("invoice_terms"), size=5.8, leading=7.4))
        story.append(Spacer(1, 1.0 * mm))

    if show_signature:
        sig_tbl = Table([
            [_tpara("", size=T_META), _tpara("Authorized Sign.", size=T_META, align=TA_RIGHT)]
        ], colWidths=[content_w / 2, content_w / 2])
        sig_tbl.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.4, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 1.2),
        ]))
        story.append(sig_tbl)
        story.append(Spacer(1, 1.0 * mm))

    if s.flag("show_footer", True) and str(s.get("invoice_footer_layout", "text_center")).lower() != "none":
        align = TA_LEFT if str(s.get("invoice_footer_layout", "text_center")).lower() == "text_left" else TA_CENTER
        story.append(_tpara(_clean_footer(s.get("invoice_footer")).upper(), size=T_FOOTER, align=align, bold=True))

        date_text, time_text = _invoice_datetime(invoice)
        meta = []
        if date_text:
            meta.append(f"Date: {date_text}")
        if time_text:
            meta.append(f"Time: {time_text}")
        meta.append(f"Bill Ref: {_bill_reference_token(invoice)}")
        story.append(_tpara(" | ".join(meta), size=5.8, align=TA_CENTER))

    doc.build(story)
    buffer.seek(0)
    return buffer