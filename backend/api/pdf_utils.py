from io import BytesIO
import os
from urllib.request import urlopen
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict
from urllib.parse import urlencode

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, portrait
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
)

from .models import Setting

# ── Fonts ──────────────────────────────────────────────────────────────────────
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

# ── Clean-minimal palette ────────────────────────────────────────────────────
# Grayscale only, no accent color: near-black for primary text/values, a muted
# gray for secondary/label text, and a hairline gray for dividers. Full boxes
# and heavy grids are avoided in favor of whitespace and thin rules.
INK = colors.HexColor("#1f1f1f")          # primary text / values
SUBTLE = colors.HexColor("#6f6f6f")       # labels, secondary text
FAINT = colors.HexColor("#a3a3a3")        # placeholders, least emphasis
LINE = colors.HexColor("#dfdfdf")         # standard hairline divider
LINE_STRONG = colors.HexColor("#bdbdbd")  # slightly stronger rule for section breaks
BLK = INK  # kept for readability in a few spots that want the darkest tone

PAGE_W = A4[0]
L_MAR = 11 * mm
R_MAR = 11 * mm
BODY_W = PAGE_W - L_MAR - R_MAR  # ~180 mm

# Slightly tighter than before — used only between clearly distinct sections.
SECTION_GAP = Spacer(1, 2.2 * mm)


def invoice_settings(invoice):
    """Settings belong to the invoice's business, never to another tenant."""
    return {item.key: item.value for item in Setting.objects.filter(business=invoice.business)}


def setting_value(settings, key, default=""):
    return settings.get(key, default)


def money(value):
    try:
        value = Decimal(str(value or 0))
    except Exception:
        value = Decimal("0")
    negative = value < 0
    formatted = f"{abs(value):,.2f}"
    return f"-{formatted}" if negative else formatted


def currency(value):
    return f"Rs.{money(value)}"


def _style(font=None, size=8, align=TA_LEFT, bold=False, leading=None, color=INK):
    return ParagraphStyle(
        "x",
        fontName=font or (FONT_B if bold else FONT_R),
        fontSize=size,
        leading=leading or size + 3,
        alignment=align,
        textColor=color,
    )


def para(text, **kwargs):
    return Paragraph(str(text), _style(**kwargs))


def _tbl(data, widths, style_cmds, repeat=0):
    table = Table(data, colWidths=widths, repeatRows=repeat, hAlign="LEFT")
    base_style = [
        ("FONTNAME", (0, 0), (-1, -1), FONT_R),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    table.setStyle(TableStyle(base_style + style_cmds))
    return table


def _rule(color=None, weight=0.6, gap_above=0, gap_below=0):
    """A thin full-width horizontal divider — the minimal-style stand-in for boxed sections."""
    color = color or LINE
    line = _tbl(
        [[""]],
        [BODY_W],
        [
            ("LINEBELOW", (0, 0), (-1, -1), weight, color),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )
    flow = []
    if gap_above:
        flow.append(Spacer(1, gap_above))
    flow.append(line)
    if gap_below:
        flow.append(Spacer(1, gap_below))
    return flow


def _label(text):
    """Small muted section heading, e.g. 'BILL TO' — used instead of a bordered title bar."""
    return para(text.upper(), size=7.2, bold=True, color=SUBTLE)


# ── Amount in words ────────────────────────────────────────────────────────────
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


# ── QR helper ──────────────────────────────────────────────────────────────────
def make_upi_qr(upi_id, shop_name, amount, size_mm=26, invoice_number=None):
    """Return a ReportLab Image for a UPI payment QR, or None if unavailable."""
    if not upi_id:
        return None
    try:
        import qrcode
        from reportlab.platypus import Image as RLImage

        params = {"pa": upi_id, "pn": shop_name, "am": money(amount), "cu": "INR"}
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


def _fmt_value(value, default="—"):
    if value is None:
        return default
    if isinstance(value, str):
        value = value.strip()
        return value if value else default
    text = str(value).strip()
    return text if text else default


def _date_text(value):
    if not value:
        return "—"
    try:
        return value.strftime("%d-%m-%Y")
    except AttributeError:
        return str(value)


def _get_logo_image(logo_w, logo_url=""):
    """Return a ReportLab Image for the shop logo, or None if unavailable."""
    try:
        from django.conf import settings as django_settings
        from reportlab.platypus import Image as RLImage
        import glob

        media_root = str(django_settings.MEDIA_ROOT)
        media_url = django_settings.MEDIA_URL  # e.g. '/media/'

        # shop_logo stores the media URL, e.g. /media/shop_logos/shop-logo.jpeg
        url_val = logo_url
        if url_val and url_val.startswith(media_url):
            rel = url_val[len(media_url):]  # strip /media/ prefix
            full = os.path.join(media_root, rel)
            if os.path.exists(full):
                return RLImage(full, width=logo_w, height=logo_w)

        # Supabase returns a public HTTPS URL.  Fetch it only for PDF output;
        # the uploaded object remains persistent even when Render redeploys.
        if url_val and url_val.startswith(('https://', 'http://')):
            with urlopen(url_val, timeout=5) as response:
                return RLImage(BytesIO(response.read()), width=logo_w, height=logo_w)

        # Fallback: first image found in shop_logos/
        matches = glob.glob(os.path.join(media_root, "shop_logos", "*"))
        if matches:
            return RLImage(matches[0], width=logo_w, height=logo_w)
    except Exception:
        pass
    return None


def build_header(shop_name, shop_address, shop_phone, shop_email, shop_gstin, shop_pan, upi_id, grand_total, logo_url="", document_title="Tax Invoice", registration_type="regular"):
    brand_name = _fmt_value(shop_name, "Dreamwithtech")

    logo_w = 16 * mm
    title_w = BODY_W * 0.32
    info_w = BODY_W - logo_w - title_w

    logo_img = _get_logo_image(logo_w, logo_url)
    logo_cell = logo_img if logo_img else para("LOGO", size=6.6, align=TA_CENTER, color=FAINT)
    logo_tbl = _tbl(
        [[logo_cell]],
        [logo_w],
        [
            ("BOX", (0, 0), (-1, -1), 0.4, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ],
    )

    info_rows = [
        [para(brand_name.upper(), bold=True, size=15.0, align=TA_LEFT, color=INK)],
        [para("GST Registered Business" if registration_type == "regular" else "Business Invoice", size=6.9, color=SUBTLE)],
    ]
    for line in (shop_address or "").split("\n"):
        line = line.strip()
        if line:
            info_rows.append([para(line, size=7.2, color=SUBTLE)])
    if shop_phone:
        info_rows.append([para(f"Phone&nbsp;&nbsp;{shop_phone}", size=7.2, color=SUBTLE)])
    if shop_email:
        info_rows.append([para(f"Email&nbsp;&nbsp;{shop_email}", size=7.2, color=SUBTLE)])
    if shop_gstin:
        info_rows.append([para(f"GSTIN&nbsp;&nbsp;{shop_gstin}", size=7.2, color=SUBTLE)])
    if shop_pan:
        info_rows.append([para(f"PAN&nbsp;&nbsp;{shop_pan}", size=7.2, color=SUBTLE)])

    info_tbl = _tbl(
        info_rows,
        [info_w],
        [
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1.3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.3),
        ],
    )

    title_tbl = _tbl(
        [
            [para(document_title, size=14.5, bold=True, align=TA_RIGHT, color=INK)],
            [para("Original for Recipient", size=7.0, align=TA_RIGHT, color=SUBTLE)],
        ],
        [title_w],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ],
    )

    header_row = _tbl(
        [[logo_tbl, info_tbl, title_tbl]],
        [logo_w, info_w, title_w],
        [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ],
    )

    return [header_row, *_rule(color=LINE_STRONG, weight=0.8, gap_above=2.2 * mm)]


def build_meta_and_customer(invoice):
    """Invoice details (left) and Bill To (right) rendered side-by-side on one row,
    instead of stacked on separate lines, to save vertical space."""
    order_no = getattr(invoice, "order_number", "") or getattr(invoice, "order_no", "")
    order_date = getattr(invoice, "order_date", None)
    vehicle_no = getattr(invoice, "vehicle_number", "") or getattr(invoice, "vehicle_no", "")
    route_name = getattr(invoice, "route_name", "") or getattr(invoice, "route", "")
    pay_mode = (invoice.payment_method or "cash").upper()
    pay_status = (invoice.payment_status or "paid").upper()
    inv_date = _date_text(getattr(invoice, "created_at", None) or getattr(invoice, "date", None))

    cust = invoice.customer
    cust_name = cust.name if cust else (invoice.customer_name or "Walk-in Customer")
    cust_addr = cust.address if cust else ""
    cust_phone = cust.mobile if cust else invoice.customer_phone
    cust_gstin = cust.gstin if cust else ""
    cust_code = getattr(cust, "code", "") if cust else ""
    cust_state = getattr(cust, "state", "") if cust else ""
    cust_state_code = getattr(cust, "state_code", "") if cust else ""
    is_walk_in = not cust

    def lbl(text):
        return para(text, size=6.7, color=SUBTLE)

    def val(text):
        return para(text, size=7.3, color=INK)

    col_gap = 6 * mm
    left_w = BODY_W * 0.50
    right_w = BODY_W - left_w - col_gap

    # ── Left: invoice details (2 label/value pairs per row) ──
    meta_ratios = [24, 76, 24, 76]
    meta_scale = left_w / sum(meta_ratios)
    meta_widths = [r * meta_scale for r in meta_ratios]
    meta_rows = [
        [lbl("Invoice No"), val(_fmt_value(invoice.invoice_number)), lbl("Order No"), val(_fmt_value(order_no))],
        [lbl("Invoice Date"), val(inv_date), lbl("Order Date"), val(_date_text(order_date))],
        [lbl("Payment Mode"), val(pay_mode), lbl("Vehicle No"), val(_fmt_value(vehicle_no))],
        [lbl("Payment Status"), val(pay_status), lbl("Route Name"), val(_fmt_value(route_name))],
    ]
    meta_tbl = _tbl(
        meta_rows,
        meta_widths,
        [
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 1.8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
    )
    meta_col = _tbl(
        [[_label("Invoice Details")], [Spacer(1, 1.1 * mm)], [meta_tbl]],
        [left_w],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ],
    )

    # ── Right: Bill To (single label/value column) ──
    if is_walk_in:
        cust_rows = [
            [lbl("Customer Name"), val(_fmt_value(cust_name))],
            [lbl("Phone"), val(_fmt_value(cust_phone))],
        ]
    else:
        cust_rows = [
            [lbl("Name"), val(_fmt_value(cust_name))],
            [lbl("Code"), val(_fmt_value(cust_code))],
            [lbl("Address"), val(_fmt_value((cust_addr or "").replace(chr(10), ", ")))],
            [lbl("Phone"), val(_fmt_value(cust_phone))],
            [lbl("GSTIN"), val(_fmt_value(cust_gstin))],
            [lbl("State"), val(f"{_fmt_value(cust_state)} ({_fmt_value(cust_state_code)})")],
        ]
    cust_widths = [right_w * 0.30, right_w * 0.70]
    cust_tbl = _tbl(
        cust_rows,
        cust_widths,
        [
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 1.8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
    )
    cust_col = _tbl(
        [[_label("Bill To")], [Spacer(1, 1.1 * mm)], [cust_tbl]],
        [right_w],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ],
    )

    row = _tbl(
        [[meta_col, cust_col]],
        [left_w, right_w],
        [
            ("LINEBEFORE", (1, 0), (1, -1), 0.4, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (1, 0), (1, -1), col_gap),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )
    return [row, *_rule(gap_above=2.0 * mm, gap_below=1.4 * mm)]


def build_items_table(invoice, show_hsn=True, show_discount=True):
    col_ratios = [7, 58, 15, 15, 15, 9, 18, 17, 13, 18]
    scale = BODY_W / (sum(col_ratios) * mm)
    col_widths = [c * mm * scale for c in col_ratios]

    header = [
        para("Sl No", size=6.9, bold=True, align=TA_CENTER, color=SUBTLE),
        para("Item Description", size=6.9, bold=True, align=TA_LEFT, color=SUBTLE),
        para("HSN Code", size=6.9, bold=True, align=TA_CENTER, color=SUBTLE),
        para("MRP/pc", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("Rate/pc", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("Qty", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("Basic Price", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("GST", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("Discount", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("Total", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
    ]

    rows = [header]
    for idx, item in enumerate(invoice.items.all(), start=1):
        qty = Decimal(str(item.quantity))
        rate = Decimal(str(item.unit_price))
        disc_pct = Decimal(str(item.discount_percent or 0))
        mrp = Decimal(str(item.mrp or rate))

        disc_amt = (rate * qty * disc_pct / 100).quantize(Decimal("0.01"))
        basic_price = (rate * qty - disc_amt).quantize(Decimal("0.01"))
        gst_amt = Decimal(str(item.gst_amount or 0))
        gst_pct = Decimal(str(item.gst_percent or 0))
        total = Decimal(str(item.total))
        qty_str = str(int(qty) if qty == qty.to_integral_value() else qty)

        rows.append([
            para(str(idx), size=7.3, align=TA_CENTER, color=SUBTLE),
            para(_fmt_value(item.product_name), size=7.4, color=INK),
            para(_fmt_value(item.hsn_code), size=7.2, align=TA_CENTER, color=SUBTLE),
            para(currency(mrp), size=7.2, align=TA_RIGHT, color=SUBTLE),
            para(currency(rate), size=7.4, align=TA_RIGHT, color=INK),
            para(qty_str, size=7.4, align=TA_RIGHT, color=INK),
            para(currency(basic_price), size=7.4, align=TA_RIGHT, color=INK),
            para(f"{currency(gst_amt)}<br/>({gst_pct}%)", size=6.7, align=TA_RIGHT, leading=8.2, color=SUBTLE),
            para(f"{disc_pct}%", size=6.7, align=TA_RIGHT, color=SUBTLE),
            para(currency(total), size=7.6, align=TA_RIGHT, color=INK),
        ])

    # The same column choices configured in Settings are honoured by the A4
    # printout.  Keep the POS receipt compact regardless of these choices.
    hidden_indexes = []
    if not show_hsn:
        hidden_indexes.append(2)
    if not show_discount:
        hidden_indexes.append(8)
    if hidden_indexes:
        for row in rows:
            for index in reversed(hidden_indexes):
                row.pop(index)
        col_widths = [width for index, width in enumerate(col_widths) if index not in hidden_indexes]

    last_row = len(rows) - 1
    return _tbl(
        rows,
        col_widths,
        [
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, LINE_STRONG),
            ("LINEBELOW", (0, 1), (-1, last_row), 0.4, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 2.4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4),
            ("LEFTPADDING", (0, 0), (-1, -1), 2.4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
        repeat=1,
    )


def build_gst_summary(invoice):
    gst_groups = defaultdict(lambda: {"taxable": Decimal("0"), "gst": Decimal("0")})
    for item in invoice.items.all():
        hsn = item.hsn_code or "—"
        gst_pct = Decimal(str(item.gst_percent or 0))
        gst_amt = Decimal(str(item.gst_amount or 0))
        disc_pct = Decimal(str(item.discount_percent or 0))
        rate = Decimal(str(item.unit_price))
        qty = Decimal(str(item.quantity))
        disc_amt = (rate * qty * disc_pct / 100).quantize(Decimal("0.01"))
        taxable = (rate * qty - disc_amt).quantize(Decimal("0.01"))
        key = (hsn, gst_pct)
        gst_groups[key]["taxable"] += taxable
        gst_groups[key]["gst"] += gst_amt

    rows = [[
        para("HSN Code", size=6.9, bold=True, align=TA_CENTER, color=SUBTLE),
        para("Taxable Amount", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("CGST %", size=6.9, bold=True, align=TA_CENTER, color=SUBTLE),
        para("CGST Amount", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("SGST %", size=6.9, bold=True, align=TA_CENTER, color=SUBTLE),
        para("SGST Amount", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("IGST %", size=6.9, bold=True, align=TA_CENTER, color=SUBTLE),
        para("IGST Amount", size=6.9, bold=True, align=TA_RIGHT, color=SUBTLE),
    ]]

    for (hsn, rate_pct), group in sorted(gst_groups.items(), key=lambda x: (x[0][0], x[0][1])):
        half_rate = (rate_pct / 2).quantize(Decimal("0.01"))
        cgst = (group["gst"] / 2).quantize(Decimal("0.01"))
        sgst = group["gst"] - cgst
        rows.append([
            para(_fmt_value(hsn), size=7.1, align=TA_CENTER, color=SUBTLE),
            para(currency(group["taxable"]), size=7.1, align=TA_RIGHT, color=INK),
            para(f"{half_rate}%", size=7.1, align=TA_CENTER, color=SUBTLE),
            para(currency(cgst), size=7.1, align=TA_RIGHT, color=INK),
            para(f"{half_rate}%", size=7.1, align=TA_CENTER, color=SUBTLE),
            para(currency(sgst), size=7.1, align=TA_RIGHT, color=INK),
            para("0.00%", size=7.1, align=TA_CENTER, color=SUBTLE),
            para(currency(0), size=7.1, align=TA_RIGHT, color=INK),
        ])

    col_ratios = [16, 26, 10, 18, 10, 18, 10, 18]
    scale = BODY_W / (sum(col_ratios) * mm)
    col_widths = [c * mm * scale for c in col_ratios]

    last_row = len(rows) - 1
    title = _label("GST / HSN Summary")
    table = _tbl(
        rows,
        col_widths,
        [
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, LINE_STRONG),
            ("LINEBELOW", (0, 1), (-1, last_row), 0.4, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 2.1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.1),
            ("LEFTPADDING", (0, 0), (-1, -1), 2.2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.2),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
        repeat=1,
    )
    return [title, Spacer(1, 1.2 * mm), table]


def build_totals(invoice):
    subtotal = Decimal(str(invoice.subtotal or 0))
    discount = Decimal(str(invoice.discount_amount or 0))
    taxable_amt = subtotal - discount
    tax_amt = Decimal(str(invoice.tax_amount or 0))
    total_cgst = (tax_amt / 2).quantize(Decimal("0.01"))
    total_sgst = tax_amt - total_cgst
    round_off = Decimal(str(invoice.round_off or 0))
    grand = Decimal(str(invoice.grand_total or 0))
    paid_amount = Decimal(str(invoice.paid_amount or 0))
    payment_status = _fmt_value((invoice.payment_status or "").upper())
    balance_due = max((grand - paid_amount).quantize(Decimal("0.01")), Decimal("0.00"))
    change_returned = max((paid_amount - grand).quantize(Decimal("0.01")), Decimal("0.00"))

    def lbl(text):
        return para(text, size=7.1, color=SUBTLE)

    def val(text, align=TA_RIGHT):
        return para(text, size=7.4, align=align, color=INK)

    payment_summary_tbl = _tbl(
        [
            [lbl("Payment Status"), val(payment_status, TA_LEFT)],
            [lbl("Paid Amount"), val(currency(paid_amount))],
            [lbl("Balance Due"), val(currency(balance_due))],
            [lbl("Change Returned"), val(currency(change_returned))],
        ],
        [34 * mm, 42 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 1.6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.2),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
    )

    left_content = _tbl(
        [
            [_label("Amount in Words")],
            [para(amount_in_words(grand), size=7.6, color=INK)],
            [Spacer(1, 1.8 * mm)],
            [_label("Payment Summary")],
            [Spacer(1, 1.0 * mm)],
            [payment_summary_tbl],
        ],
        [BODY_W * 0.46],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ],
    )

    right_rows = [
        [lbl("Sub Total"), val(currency(subtotal))],
        [lbl("Discount"), val(currency(discount))],
        [lbl("Taxable Amount"), val(currency(taxable_amt))],
        [lbl("CGST"), val(currency(total_cgst))],
        [lbl("SGST"), val(currency(total_sgst))],
        [lbl("IGST"), val(currency(0))],
        [lbl("Round Off"), val(currency(round_off))],
        [para("Grand Total", size=10.2, bold=True, color=INK), para(f"<b>{currency(grand)}</b>", size=10.2, align=TA_RIGHT, color=INK)],
    ]

    right_box = _tbl(
        right_rows,
        [40 * mm, 44 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, -3), 0.35, LINE),
            ("LINEABOVE", (0, 7), (-1, 7), 0.8, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 1.7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.7),
            ("TOPPADDING", (0, 7), (-1, 7), 2.8),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
    )

    return _tbl(
        [[left_content, right_box]],
        [BODY_W * 0.46, BODY_W * 0.54],
        [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )


def build_payment_section(shop_name, bank_name, bank_branch, bank_account, bank_ifsc, upi_id, grand, invoice_number=None, show_qr=True):
    bank_rows = []
    if bank_name:
        bank_rows.append([para("Bank Name", size=6.9, color=SUBTLE), para(bank_name, size=7.4, color=INK)])
    if bank_branch:
        bank_rows.append([para("Branch", size=6.9, color=SUBTLE), para(bank_branch, size=7.4, color=INK)])
    if bank_account:
        bank_rows.append([para("A/C No.", size=6.9, color=SUBTLE), para(bank_account, size=7.4, color=INK)])
    if bank_ifsc:
        bank_rows.append([para("IFSC", size=6.9, color=SUBTLE), para(bank_ifsc, size=7.4, color=INK)])
    if upi_id:
        bank_rows.append([para("UPI ID", size=6.9, color=SUBTLE), para(upi_id, size=7.4, bold=True, color=INK)])

    bank_body = _tbl(
        bank_rows,
        [30 * mm, BODY_W * 0.55 - 30 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 1.6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ],
    ) if bank_rows else para("—", size=7.4, color=FAINT)

    bank_col = _tbl(
        [[_label("Bank / Payment Details")], [Spacer(1, 1.2 * mm)], [bank_body]],
        [BODY_W * 0.55],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ],
    )

    qr_img = make_upi_qr(upi_id, shop_name, grand, size_mm=26, invoice_number=invoice_number) if show_qr else None

    qr_rows = [[_label("Scan to Pay")]]
    qr_rows.append([qr_img] if qr_img else [para("QR unavailable", size=7.2, align=TA_CENTER, color=FAINT)])
    qr_rows.append([para(_fmt_value(upi_id), size=7.0, align=TA_CENTER, color=SUBTLE)])
    qr_col = _tbl(
        qr_rows,
        [BODY_W * 0.45],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 1.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ],
    )

    return _tbl(
        [[bank_col, qr_col]],
        [BODY_W * 0.55, BODY_W * 0.45],
        [
            ("LINEBEFORE", (1, 0), (1, -1), 0.4, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )


def build_footer(terms="", footer_text="", document_title="Tax Invoice"):
    declaration = (
        "Declaration: I / We hereby certify that the particulars given above are true and correct and that the "
        "goods/services described above have been supplied as stated."
    )
    signature_row = _tbl(
        [[
            para("Customer Signature", size=7.3, align=TA_LEFT, color=SUBTLE),
            Spacer(1, 8 * mm),
            para("Authorized Signatory", size=7.3, align=TA_RIGHT, color=SUBTLE),
        ]],
        [BODY_W * 0.34, BODY_W * 0.32, BODY_W * 0.34],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ],
    )
    content = [
        *_rule(gap_below=1.8 * mm),
        para(terms or declaration, size=6.7, color=FAINT),
        signature_row,
        para(footer_text or f"This is a computer generated {document_title.lower()} and does not require a signature.", size=6.3, align=TA_CENTER, color=FAINT),
    ]
    return content


# ── Main: A4 ───────────────────────────────────────────────────────────────────
def generate_invoice_pdf(invoice):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
        leftMargin=L_MAR,
        rightMargin=R_MAR,
        title=f"Invoice {invoice.invoice_number}",
    )

    settings = invoice_settings(invoice)
    value = lambda key, default="": setting_value(settings, key, default)
    shop_name = value("shop_name", "YOUR COMPANY NAME")
    shop_address, shop_phone, shop_email = value("shop_address"), value("shop_phone"), value("shop_email")
    shop_gstin, shop_pan = value("shop_gstin"), value("shop_pan")
    bank_name, bank_branch = value("shop_bank_name"), value("shop_bank_branch")
    bank_account, bank_ifsc, upi_id = value("shop_bank_account"), value("shop_bank_ifsc"), value("shop_upi_id")
    template = value("invoice_template", "gst_a4")
    document_title = "Bill of Supply" if template == "supply_a4" else "Tax Invoice"

    grand = Decimal(str(invoice.grand_total or 0))

    story = [
        *build_header(shop_name, shop_address, shop_phone, shop_email, shop_gstin, shop_pan, upi_id, grand, value("shop_logo"), document_title, value("gst_reg_type", "regular")),
        SECTION_GAP,
        *build_meta_and_customer(invoice),
        build_items_table(
            invoice,
            show_hsn=value("show_hsn_col", "true") == "true",
            show_discount=value("show_discount_col", "true") == "true",
        ),
        SECTION_GAP,
        *(build_gst_summary(invoice) if value("hsn_summary_on_invoice", "true") == "true" else []),
        SECTION_GAP,
        build_totals(invoice),
        SECTION_GAP,
        build_payment_section(shop_name, bank_name, bank_branch, bank_account, bank_ifsc, upi_id, grand, invoice.invoice_number, value("show_upi_qr_on_invoice", "true") == "true" and value("upi_qr_enabled", "true") == "true"),
        *build_footer(value("invoice_terms"), value("invoice_footer"), document_title),
    ]

    doc.build(story)
    buffer.seek(0)
    return buffer


# ── Main: 80mm thermal ───────────────────────────────────────────────────────
def generate_thermal_invoice_pdf(invoice):
    buffer = BytesIO()
    # Thermal rolls do not have an A4-sized fixed page.  Estimate a generous
    # roll length from the number of line items so larger POS bills are not
    # truncated at the bottom.
    page_height = max(120 * mm, (105 + len(invoice.items.all()) * 9) * mm)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=portrait((80 * mm, page_height)),
        topMargin=3 * mm,
        bottomMargin=3 * mm,
        leftMargin=3 * mm,
        rightMargin=3 * mm,
        title=f"Invoice {invoice.invoice_number}",
    )
    story = []
    content_w = 80 * mm - 6 * mm

    settings = invoice_settings(invoice)
    value = lambda key, default="": setting_value(settings, key, default)
    shop_name = value("shop_name", "YOUR COMPANY NAME")
    shop_address, shop_phone, shop_email = value("shop_address"), value("shop_phone"), value("shop_email")
    shop_gstin, upi_id = value("shop_gstin"), value("shop_upi_id")
    template = value("invoice_template", "gst_a4")
    document_title = "Bill of Supply" if template == "supply_a4" else "Tax Invoice"

    inv_date = _date_text(getattr(invoice, "created_at", None) or getattr(invoice, "date", None))
    cust = invoice.customer
    cust_name = cust.name if cust else (invoice.customer_name or "Walk-in Customer")
    cust_phone = cust.mobile if cust else invoice.customer_phone
    grand = Decimal(str(invoice.grand_total or 0))
    paid_amount = Decimal(str(invoice.paid_amount or 0))
    balance_due = max(Decimal("0.00"), grand - paid_amount)
    change_returned = max(Decimal("0.00"), paid_amount - grand)

    def rule(**kw):
        story.extend(_rule(**kw))

    story.append(para(f"<b>{shop_name.upper()}</b>", size=10.5, align=TA_CENTER, color=INK))
    story.append(para("GST Registered Business" if value("gst_reg_type", "regular") == "regular" else "Business Invoice", size=6.4, align=TA_CENTER, color=SUBTLE))
    for line in (shop_address or "").split("\n"):
        if line.strip():
            story.append(para(line.strip(), size=6.3, align=TA_CENTER, color=SUBTLE))
    if shop_phone:
        story.append(para(f"Phone: {shop_phone}", size=6.3, align=TA_CENTER, color=SUBTLE))
    if shop_email:
        story.append(para(f"Email: {shop_email}", size=6.3, align=TA_CENTER, color=SUBTLE))
    if shop_gstin:
        story.append(para(f"GSTIN: {shop_gstin}", size=6.3, align=TA_CENTER, color=SUBTLE))
    rule(gap_above=1.4 * mm, gap_below=1.2 * mm)

    story.append(para(document_title, size=11.0, bold=True, align=TA_CENTER, color=INK))
    story.append(para("Original for Recipient", size=6.1, align=TA_CENTER, color=SUBTLE))
    story.append(Spacer(1, 1.2 * mm))

    # Invoice No / Payment Mode kept on the same row so nothing wraps to its own line.
    meta_tbl = _tbl(
        [
            [para("Invoice No", size=6.3, color=SUBTLE), para(_fmt_value(invoice.invoice_number), size=6.3, color=INK),
             para("Mode", size=6.3, color=SUBTLE), para((invoice.payment_method or "cash").upper(), size=6.3, color=INK)],
            [para("Invoice Date", size=6.3, color=SUBTLE), para(inv_date, size=6.3, color=INK),
             para("Status", size=6.3, color=SUBTLE), para((invoice.payment_status or "paid").upper(), size=6.3, color=INK)],
        ],
        [15 * mm, 18 * mm, 12 * mm, 15 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, -2), 0.3, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 1.3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.3),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1.5),
        ],
    )
    story.append(meta_tbl)
    rule(gap_above=1.2 * mm, gap_below=1.2 * mm)

    story.append(para("Bill To", size=7.2, bold=True, color=SUBTLE))
    story.append(para(_fmt_value(cust_name), size=6.7, color=INK))
    story.append(para(f"Phone: {_fmt_value(cust_phone)}", size=6.3, color=SUBTLE))
    rule(gap_above=1.2 * mm, gap_below=1.2 * mm)

    item_rows = [[
        para("Item", size=6.1, bold=True, color=SUBTLE),
        para("Qty", size=6.1, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("Rate", size=6.1, bold=True, align=TA_RIGHT, color=SUBTLE),
        para("Total", size=6.1, bold=True, align=TA_RIGHT, color=SUBTLE),
    ]]
    for item in invoice.items.all():
        item_rows.append([
            para(_fmt_value(item.product_name), size=6.1, color=INK),
            para(_fmt_value(item.quantity), size=6.1, align=TA_RIGHT, color=INK),
            para(currency(item.unit_price), size=6.1, align=TA_RIGHT, color=INK),
            para(currency(item.total), size=6.1, align=TA_RIGHT, color=INK),
        ])
    last_row = len(item_rows) - 1
    item_tbl = _tbl(
        item_rows,
        [32 * mm, 10 * mm, 16 * mm, 16 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, LINE_STRONG),
            ("LINEBELOW", (0, 1), (-1, last_row), 0.3, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 1.4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.4),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1.2),
        ],
        repeat=1,
    )
    story.append(item_tbl)
    rule(gap_above=1.2 * mm, gap_below=1.2 * mm)

    totals_rows = [
        [para("Sub Total", size=6.5, color=SUBTLE), para(currency(invoice.subtotal), size=6.5, align=TA_RIGHT, color=INK)],
        [para("Discount", size=6.5, color=SUBTLE), para(currency(invoice.discount_amount), size=6.5, align=TA_RIGHT, color=INK)],
        [para("Tax", size=6.5, color=SUBTLE), para(currency(invoice.tax_amount), size=6.5, align=TA_RIGHT, color=INK)],
        [para("Round Off", size=6.5, color=SUBTLE), para(currency(invoice.round_off), size=6.5, align=TA_RIGHT, color=INK)],
        [para("Grand Total", size=8.4, bold=True, color=INK), para(f"<b>{currency(grand)}</b>", size=8.4, align=TA_RIGHT, color=INK)],
    ]
    totals_tbl = _tbl(
        totals_rows,
        [35 * mm, 39 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, -3), 0.3, LINE),
            ("LINEABOVE", (0, 4), (-1, 4), 0.7, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 1.3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.3),
            ("TOPPADDING", (0, 4), (-1, 4), 2.2),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )
    story.append(totals_tbl)
    rule(gap_above=1.2 * mm, gap_below=1.2 * mm)

    story.append(para(f"Amount in Words: {amount_in_words(grand)}", size=6.2, color=SUBTLE))
    story.append(Spacer(1, 0.8 * mm))
    story.append(para(f"Payment Status: {(invoice.payment_status or 'paid').upper()}", size=6.2, color=SUBTLE))
    story.append(para(f"Paid Amount: {currency(paid_amount)}", size=6.2, color=SUBTLE))
    story.append(para(f"Balance Due: {currency(balance_due)}", size=6.2, color=SUBTLE))
    story.append(para(f"Change Returned: {currency(change_returned)}", size=6.2, color=SUBTLE))

    show_qr = value("show_upi_qr_on_thermal", "true") == "true" and value("upi_qr_enabled", "true") == "true"
    qr_img = make_upi_qr(upi_id, shop_name, grand, size_mm=18, invoice_number=invoice.invoice_number) if show_qr else None
    if qr_img:
        rule(gap_above=1.2 * mm, gap_below=1.2 * mm)
        qr_tbl = _tbl(
            [
                [para("Scan to Pay", size=6.4, bold=True, align=TA_CENTER, color=SUBTLE)],
                [qr_img],
                [para(_fmt_value(upi_id), size=6.0, align=TA_CENTER, color=SUBTLE)],
            ],
            [content_w],
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 1.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ],
        )
        story.append(qr_tbl)

    rule(gap_above=1.4 * mm, gap_below=1.6 * mm)
    story.append(para(value("invoice_terms") or "Declaration: I / We hereby certify that the particulars given above are true and correct and that the goods/services described above have been supplied as stated.", size=5.7, color=FAINT))
    story.append(Spacer(1, 2.4 * mm))
    story.append(_tbl(
        [[para("Customer Signature", size=6.0, color=SUBTLE), para("Authorized Signatory", size=6.0, align=TA_RIGHT, color=SUBTLE)]],
        [content_w / 2, content_w / 2],
        [
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    ))
    story.append(Spacer(1, 1.6 * mm))
    story.append(para(value("receipt_footer") or value("invoice_footer") or f"This is a computer generated {document_title.lower()} and does not require a signature.", size=5.7, align=TA_CENTER, color=FAINT))

    doc.build(story)
    buffer.seek(0)
    return buffer
