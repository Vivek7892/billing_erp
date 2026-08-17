from io import BytesIO
import os
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
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
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

# ── Pure black & white palette (no other colors are used anywhere) ────────────
INK = colors.HexColor("#000000")          # primary text / values — true black
SUBTLE = colors.HexColor("#333333")       # labels, secondary text, footer notes
FAINT = colors.HexColor("#6e6e6e")        # least emphasis (page number only)
LINE = colors.HexColor("#d9d9d9")         # hairline divider
LINE_STRONG = colors.HexColor("#000000")  # section-defining rule
HEAD_TINT = colors.HexColor("#f0f0f0")    # table header band (light gray, B/W safe)
BLK = INK

PAGE_W, PAGE_H = A4
L_MAR = 12 * mm
R_MAR = 12 * mm
BODY_W = PAGE_W - L_MAR - R_MAR  # ~186 mm

SECTION_GAP = Spacer(1, 2.4 * mm)
TIGHT_GAP = Spacer(1, 1.1 * mm)


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
    return str(raw).strip().lower() == "true"


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
    field/row is printed at all. We never print placeholders like '—',
    'None', 'N/A' or 'null' — an absent field is simply omitted."""
    if value is None:
        return False
    if isinstance(value, Decimal):
        return value != 0
    text = str(value).strip()
    if text == "" or text.lower() in ("none", "null", "n/a", "na", "-", "—"):
        return False
    return True


def mask_account_number(value, keep_last=4):
    """Show only the last N digits of a bank account number on customer-facing
    bills — the rest is masked with asterisks."""
    digits = str(value or "").strip()
    if not digits:
        return ""
    if len(digits) <= keep_last:
        return digits
    return "*" * (len(digits) - keep_last) + digits[-keep_last:]


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
        ("TOPPADDING", (0, 0), (-1, -1), 2.3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    table.setStyle(TableStyle(base_style + style_cmds))
    return table


def _rule(color=None, weight=0.7, gap_above=0, gap_below=0):
    """Full-width horizontal divider — used instead of boxes to separate sections."""
    flow = []
    if gap_above:
        flow.append(Spacer(1, gap_above))
    flow.append(HRFlowable(width=BODY_W, thickness=weight, color=color or LINE,
                            spaceBefore=0, spaceAfter=0, hAlign="LEFT"))
    if gap_below:
        flow.append(Spacer(1, gap_below))
    return flow


def _label(text):
    """Small bold section heading, e.g. 'BILL TO' — no box, just weight + a rule below."""
    return para(text.upper(), size=7.4, bold=True, color=INK)


def _label_block(text, width):
    """A section label followed by a thin full-width rule — the box-free
    stand-in for a bordered panel header."""
    return _tbl(
        [[_label(text)]],
        [width],
        [
            ("LINEBELOW", (0, 0), (-1, -1), 0.8, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )


def _pair_block(title, pairs, width, label_w_ratio=0.30):
    """A titled block of (label, value) rows — only rows with real values are
    passed in by the caller, so nothing empty is ever rendered. Falls back to
    a single quiet line when there are no rows at all."""
    label_w = width * label_w_ratio
    value_w = width - label_w
    if not pairs:
        body = para("—", size=7.3, color=FAINT)  # never actually reached in practice
        rows = [[body]]
        widths = [width]
        line_cmds = []
    else:
        rows = []
        for label, value in pairs:
            rows.append([
                para(label, size=6.9, color=SUBTLE),
                para(str(value), size=7.5, color=INK),
            ])
        widths = [label_w, value_w]
        line_cmds = [("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE)]
    body_tbl = _tbl(
        rows,
        widths,
        line_cmds + [
            ("TOPPADDING", (0, 0), (-1, -1), 1.7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.7),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
    )
    return _tbl(
        [[_label_block(title, width)], [body_tbl]],
        [width],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ],
    )


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
def make_upi_qr(upi_id, shop_name, amount, size_mm=24, invoice_number=None):
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


# ── Page chrome: light corner rule + page numbers (no full frame/box) ──────
def _page_chrome(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT_R, 6.6)
    canvas.setFillColor(FAINT)
    canvas.drawRightString(PAGE_W - R_MAR, 7.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_header(shop_name, shop_address, shop_phone, shop_email, shop_gstin, shop_pan,
                  upi_id, grand_total, document_title="Tax Invoice",
                  registration_type="regular", invoice_number="", invoice_date="",
                  show_pan=True):
    """Centered, text-only masthead — no logo. The shop name carries the
    visual weight on its own, set large and bold and centered; everything
    else is quiet supporting text, also centered, beneath it."""
    brand_name = _fmt_value(shop_name, "YOUR KIRANA STORE")

    id_rows = [[para(brand_name.upper(), bold=True, size=18, align=TA_CENTER, color=INK)]]
    id_rows.append([para(
        "GST Registered Business" if registration_type == "regular" else "General / Kirana Store",
        size=7.2, align=TA_CENTER, color=SUBTLE,
    )])
    for line in (shop_address or "").split("\n"):
        line = line.strip()
        if line:
            id_rows.append([para(line, size=7.4, align=TA_CENTER, color=SUBTLE)])
    contact_bits = []
    if has_val(shop_phone):
        contact_bits.append(f"Ph: {shop_phone}")
    if has_val(shop_email):
        contact_bits.append(shop_email)
    if contact_bits:
        id_rows.append([para(" &nbsp;|&nbsp; ".join(contact_bits), size=7.4, align=TA_CENTER, color=SUBTLE)])
    gst_bits = []
    if has_val(shop_gstin):
        gst_bits.append(f"GSTIN: {shop_gstin}")
    if show_pan and has_val(shop_pan):
        gst_bits.append(f"PAN: {shop_pan}")
    if gst_bits:
        id_rows.append([para(" &nbsp;|&nbsp; ".join(gst_bits), size=7.4, bold=True, align=TA_CENTER, color=INK)])

    id_tbl = _tbl(
        id_rows,
        [BODY_W],
        [
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1.1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.1),
        ],
    )

    title_row = _tbl(
        [[
            para(document_title.upper(), size=12.5, bold=True, align=TA_LEFT, color=INK),
            para("Original for Recipient", size=7.0, align=TA_RIGHT, color=SUBTLE),
        ]],
        [BODY_W * 0.5, BODY_W * 0.5],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )

    meta_row = _tbl(
        [[
            para(f"<b>Invoice No:</b> {_fmt_value(invoice_number)}", size=8.2, align=TA_LEFT, color=INK),
            para(f"<b>Date:</b> {invoice_date}", size=8.2, align=TA_RIGHT, color=INK),
        ]],
        [BODY_W * 0.5, BODY_W * 0.5],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 1.6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )

    return [
        id_tbl,
        *_rule(gap_above=2.0 * mm, gap_below=1.6 * mm),
        title_row,
        meta_row,
        *_rule(color=LINE_STRONG, weight=1.1, gap_above=2.0 * mm),
    ]


def build_meta_and_customer(invoice):
    """Invoice details (left) and Bill To (right), side by side. Only fields
    that actually have a value are printed — empty fields are skipped
    entirely rather than shown as a dash or placeholder."""
    order_no = getattr(invoice, "order_number", "") or getattr(invoice, "order_no", "")
    order_date = getattr(invoice, "order_date", None)
    vehicle_no = getattr(invoice, "vehicle_number", "") or getattr(invoice, "vehicle_no", "")
    route_name = getattr(invoice, "route_name", "") or getattr(invoice, "route", "")
    pay_mode = (invoice.payment_method or "cash").upper()
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

    col_gap = 6 * mm
    left_w = BODY_W * 0.50
    right_w = BODY_W - left_w - col_gap

    # Payment Status is intentionally NOT repeated here — it lives once,
    # alongside Paid/Balance/Change, in the Payment Summary near the totals.
    meta_pairs = [("Invoice No", _fmt_value(invoice.invoice_number)), ("Invoice Date", inv_date),
                  ("Payment Mode", pay_mode)]
    if has_val(order_no):
        meta_pairs.append(("Order No", order_no))
    if order_date:
        meta_pairs.append(("Order Date", _date_text(order_date)))
    if has_val(vehicle_no):
        meta_pairs.append(("Vehicle No", vehicle_no))
    if has_val(route_name):
        meta_pairs.append(("Route Name", route_name))
    meta_col = _pair_block("Invoice Details", meta_pairs, left_w, label_w_ratio=0.34)

    if is_walk_in:
        cust_pairs = [("Customer", _fmt_value(cust_name, "Walk-in Customer"))]
        if has_val(cust_phone):
            cust_pairs.append(("Phone", cust_phone))
    else:
        cust_pairs = [("Name", _fmt_value(cust_name))]
        if has_val(cust_code):
            cust_pairs.append(("Code", cust_code))
        if has_val(cust_addr):
            cust_pairs.append(("Address", (cust_addr or "").replace("\n", ", ")))
        if has_val(cust_phone):
            cust_pairs.append(("Phone", cust_phone))
        if has_val(cust_gstin):
            cust_pairs.append(("GSTIN", cust_gstin))
        if has_val(cust_state):
            state_txt = f"{cust_state} ({cust_state_code})" if has_val(cust_state_code) else cust_state
            cust_pairs.append(("State", state_txt))
    cust_col = _pair_block("Bill To", cust_pairs, right_w, label_w_ratio=0.30)

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
    return [row, *_rule(gap_above=2.2 * mm, gap_below=1.6 * mm)]


def any_item_has_hsn(invoice):
    return any(has_val(item.hsn_code) for item in invoice.items.all())


def any_item_has_discount(invoice):
    return any(Decimal(str(item.discount_percent or 0)) != 0 for item in invoice.items.all())


def build_items_table(invoice, show_hsn=True, show_discount=False, show_mrp=False, show_basic=False):
    """Item lines. Default column set is the lean, recommended one:
    Sl | Item Description | Qty | Rate | GST | Amount.
    HSN, MRP, pre-tax Basic Price, and Discount are opt-in extras, and are
    only actually shown when the caller has already confirmed there is real
    data to display (e.g. HSN is only requested when at least one item
    carries an HSN code, discount only when at least one item has a
    non-zero discount)."""
    items = list(invoice.items.all())

    # (key, header, ratio, align, cell_fn) — cell_fn(item, idx) -> Paragraph
    def cell(text, size=7.5, align=TA_RIGHT, color=INK, bold=False, leading=None):
        return para(text, size=size, align=align, color=color, bold=bold, leading=leading)

    columns = [("sl", "Sl", 6, TA_CENTER,
                lambda i, idx: cell(str(idx), size=7.4, align=TA_CENTER, color=SUBTLE))]
    columns.append(("item", "Item Description", 58, TA_LEFT,
                     lambda i, idx: cell(_fmt_value(i.product_name), align=TA_LEFT)))
    if show_hsn:
        columns.append(("hsn", "HSN", 13, TA_CENTER,
                         lambda i, idx: cell(_fmt_value(i.hsn_code, ""), size=7.3, align=TA_CENTER, color=SUBTLE)))
    if show_mrp:
        columns.append(("mrp", "MRP/pc", 16, TA_RIGHT,
                         lambda i, idx: cell(currency(i.mrp or i.unit_price), size=7.3, color=SUBTLE)))
    columns.append(("qty", "Qty", 9, TA_RIGHT,
                     lambda i, idx: cell(str(int(i.quantity) if Decimal(str(i.quantity)) == Decimal(str(i.quantity)).to_integral_value() else i.quantity))))
    columns.append(("rate", "Rate/pc", 17, TA_RIGHT,
                     lambda i, idx: cell(currency(i.unit_price))))
    if show_discount:
        columns.append(("disc", "Disc.", 11, TA_RIGHT,
                         lambda i, idx: cell(f"{Decimal(str(i.discount_percent or 0))}%", size=6.8, color=SUBTLE)))
    if show_basic:
        columns.append(("basic", "Basic", 18, TA_RIGHT,
                         lambda i, idx: cell(currency(_basic_price(i)))))
    # GST column shows the RATE, not the amount — keeps rows compact and
    # readable (the rupee value is already reflected in the line Amount and
    # is broken out fully in the GST Summary below).
    columns.append(("gst", "GST", 13, TA_RIGHT,
                     lambda i, idx: cell(f"{Decimal(str(i.gst_percent or 0))}%", size=7.4, color=INK)))
    columns.append(("total", "Amount", 20, TA_RIGHT,
                     lambda i, idx: cell(currency(i.total), size=7.7, bold=True)))

    ratios = [c[2] for c in columns]
    scale = BODY_W / (sum(ratios) * mm)
    col_widths = [r * mm * scale for r in ratios]

    header = [para(c[1], size=7.0, bold=True, align=c[3], color=INK) for c in columns]
    rows = [header]
    zebra_cmds = []
    for idx, item in enumerate(items, start=1):
        rows.append([c[4](item, idx) for c in columns])
        if idx % 2 == 0:
            zebra_cmds.append(("BACKGROUND", (0, idx), (-1, idx), colors.HexColor("#f6f6f6")))

    last_row = len(rows) - 1
    return _tbl(
        rows,
        col_widths,
        [
            ("BACKGROUND", (0, 0), (-1, 0), HEAD_TINT),
            ("LINEBELOW", (0, 0), (-1, 0), 1.0, LINE_STRONG),
            ("LINEABOVE", (0, 0), (-1, 0), 1.0, LINE_STRONG),
            ("LINEBELOW", (0, 1), (-1, last_row), 0.35, LINE),
            ("LINEBELOW", (0, last_row), (-1, last_row), 1.0, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 2.4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4),
            ("LEFTPADDING", (0, 0), (-1, -1), 2.6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ] + zebra_cmds,
        repeat=1,
    )


def _basic_price(item):
    qty = Decimal(str(item.quantity))
    rate = Decimal(str(item.unit_price))
    disc_pct = Decimal(str(item.discount_percent or 0))
    disc_amt = (rate * qty * disc_pct / 100).quantize(Decimal("0.01"))
    return (rate * qty - disc_amt).quantize(Decimal("0.01"))


def build_gst_summary(invoice, show_hsn=False):
    """GST Summary grouped by GST rate (and by HSN too, only when the item
    table itself is already showing an HSN column with real data). Rows with
    no taxable value are never produced, and the table is entirely omitted
    by the caller when there is nothing meaningful to show."""
    gst_groups = defaultdict(lambda: {"taxable": Decimal("0"), "gst": Decimal("0")})
    for item in invoice.items.all():
        gst_pct = Decimal(str(item.gst_percent or 0))
        gst_amt = Decimal(str(item.gst_amount or 0))
        taxable = _basic_price(item)
        key = (item.hsn_code or "") if show_hsn else None
        key = (key, gst_pct)
        gst_groups[key]["taxable"] += taxable
        gst_groups[key]["gst"] += gst_amt

    header_cells = []
    if show_hsn:
        header_cells.append(para("HSN Code", size=7.0, bold=True, align=TA_CENTER, color=INK))
    header_cells += [
        para("GST Rate", size=7.0, bold=True, align=TA_CENTER, color=INK),
        para("Taxable Amt", size=7.0, bold=True, align=TA_RIGHT, color=INK),
        para("CGST", size=7.0, bold=True, align=TA_RIGHT, color=INK),
        para("SGST", size=7.0, bold=True, align=TA_RIGHT, color=INK),
        para("Total GST", size=7.0, bold=True, align=TA_RIGHT, color=INK),
    ]
    rows = [header_cells]

    total_taxable = total_cgst = total_sgst = total_tax = Decimal("0")
    for key, group in sorted(gst_groups.items(), key=lambda x: (x[0][0] or "", x[0][1])):
        hsn, rate_pct = key
        if group["gst"] == 0:
            # A 0%-GST line (or group) contributes nothing to CGST/SGST —
            # showing it here would just be a row of zeros, so skip it.
            # (Non-GST bills end up with no groups at all, so the whole
            # summary is omitted below.)
            continue
        cgst = (group["gst"] / 2).quantize(Decimal("0.01"))
        sgst = group["gst"] - cgst
        total_taxable += group["taxable"]
        total_cgst += cgst
        total_sgst += sgst
        total_tax += group["gst"]
        row = []
        if show_hsn:
            row.append(para(_fmt_value(hsn, ""), size=7.2, align=TA_CENTER, color=SUBTLE))
        row += [
            para(f"{rate_pct}%", size=7.2, align=TA_CENTER, color=SUBTLE),
            para(currency(group["taxable"]), size=7.2, align=TA_RIGHT, color=INK),
            para(currency(cgst), size=7.2, align=TA_RIGHT, color=INK),
            para(currency(sgst), size=7.2, align=TA_RIGHT, color=INK),
            para(currency(group["gst"]), size=7.2, align=TA_RIGHT, bold=True, color=INK),
        ]
        rows.append(row)

    if len(rows) <= 1:
        return None  # nothing meaningful to show

    if len(rows) > 2:
        total_row = []
        if show_hsn:
            total_row.append(para("", size=7.3))
        total_row += [
            para("Total", size=7.3, bold=True, align=TA_CENTER, color=INK),
            para(currency(total_taxable), size=7.3, bold=True, align=TA_RIGHT, color=INK),
            para(currency(total_cgst), size=7.3, bold=True, align=TA_RIGHT, color=INK),
            para(currency(total_sgst), size=7.3, bold=True, align=TA_RIGHT, color=INK),
            para(currency(total_tax), size=7.3, bold=True, align=TA_RIGHT, color=INK),
        ]
        rows.append(total_row)

    col_ratios = ([20] if show_hsn else []) + [16, 30, 22, 22, 24]
    scale = BODY_W / (sum(col_ratios) * mm)
    col_widths = [c * mm * scale for c in col_ratios]

    last_row = len(rows) - 1
    title = _label_block("GST Summary", BODY_W)
    table = _tbl(
        rows,
        col_widths,
        [
            ("BACKGROUND", (0, 0), (-1, 0), HEAD_TINT),
            ("LINEBELOW", (0, 0), (-1, 0), 0.9, LINE_STRONG),
            ("LINEABOVE", (0, 0), (-1, 0), 0.9, LINE_STRONG),
            ("LINEBELOW", (0, 1), (-1, last_row), 0.35, LINE),
            ("LINEBELOW", (0, last_row), (-1, last_row), 0.9, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 2.0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.0),
            ("LEFTPADDING", (0, 0), (-1, -1), 2.2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.2),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
        repeat=1,
    )
    return [title, table]


def build_totals(invoice, show_discount=True, show_round_off=True):
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
        return para(text, size=7.2, color=SUBTLE)

    def val(text, align=TA_RIGHT):
        return para(text, size=7.5, color=INK, align=align)

    # Payment Summary: Payment Status + Paid always shown; Balance Due and
    # Change Returned only appear when they are actually non-zero.
    pay_rows = []
    if has_val(payment_status):
        pay_rows.append([lbl("Payment Status"), val(payment_status, TA_LEFT)])
    pay_rows.append([lbl("Paid Amount"), val(currency(paid_amount))])
    if balance_due > 0:
        pay_rows.append([lbl("Balance Due"), val(currency(balance_due))])
    if change_returned > 0:
        pay_rows.append([lbl("Change Returned"), val(currency(change_returned))])

    payment_summary_tbl = _tbl(
        pay_rows,
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
            [para(amount_in_words(grand), size=7.8, color=INK)],
            [Spacer(1, 2.0 * mm)],
            [_label("Payment Summary")],
            [TIGHT_GAP],
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

    # Rows are conditional: a zero discount, zero round-off, or non-applicable
    # tax line no longer earns a line on the bill — each optional row is only
    # added when it's actually non-zero (or explicitly enabled).
    right_rows = [[lbl("Sub Total"), val(currency(subtotal))]]
    if show_discount and discount != 0:
        right_rows.append([lbl("Discount"), val(currency(discount))])
    right_rows.append([lbl("Taxable Amount"), val(currency(taxable_amt))])
    if total_cgst != 0:
        right_rows.append([lbl("CGST"), val(currency(total_cgst))])
    if total_sgst != 0:
        right_rows.append([lbl("SGST"), val(currency(total_sgst))])
    if show_round_off and round_off != 0:
        right_rows.append([lbl("Round Off"), val(currency(round_off))])
    grand_row_index = len(right_rows)
    right_rows.append([
        para("GRAND TOTAL", size=14, bold=True, color=INK),
        para(f"<b>{currency(grand)}</b>", size=14, align=TA_RIGHT, color=INK),
    ])

    # Grand Total is the single strongest element on the page — largest
    # type, boldest weight, and a heavy double rule above it. No shaded
    # box, per the clean black-and-white direction.
    right_box = _tbl(
        right_rows,
        [40 * mm, 44 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, grand_row_index - 1), 0.35, LINE),
            ("LINEABOVE", (0, grand_row_index), (-1, grand_row_index), 1.8, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 1.8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8),
            ("TOPPADDING", (0, grand_row_index), (-1, grand_row_index), 3.6),
            ("BOTTOMPADDING", (0, grand_row_index), (-1, grand_row_index), 1.4),
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


def build_payment_section(shop_name, bank_name, bank_branch, bank_account, bank_ifsc, upi_id,
                           grand, invoice_number=None, show_qr=True, show_bank=True):
    """Bank details on the left, QR on the right — separated by a single
    vertical hairline, no boxes around either block. The account number is
    masked (only the last 4 digits shown). Returns None when there is
    nothing to show (bank details disabled/absent AND no UPI/QR), so the
    caller can skip the section — and its heading and surrounding rule —
    entirely rather than print an empty panel."""
    bank_rows = []
    if show_bank:
        if has_val(bank_name):
            bank_rows.append([para("Bank Name", size=7.0, color=SUBTLE), para(bank_name, size=7.5, color=INK)])
        if has_val(bank_branch):
            bank_rows.append([para("Branch", size=7.0, color=SUBTLE), para(bank_branch, size=7.5, color=INK)])
        if has_val(bank_account):
            bank_rows.append([para("A/C No.", size=7.0, color=SUBTLE),
                               para(mask_account_number(bank_account), size=7.5, color=INK)])
        if has_val(bank_ifsc):
            bank_rows.append([para("IFSC", size=7.0, color=SUBTLE), para(bank_ifsc, size=7.5, color=INK)])
    if has_val(upi_id):
        bank_rows.append([para("UPI ID", size=7.0, color=SUBTLE), para(upi_id, size=7.5, bold=True, color=INK)])

    show_qr = show_qr and has_val(upi_id)
    if not bank_rows and not show_qr:
        return None

    has_bank_col = bool(bank_rows)
    qr_img = make_upi_qr(upi_id, shop_name, grand, size_mm=24, invoice_number=invoice_number) if show_qr else None

    if has_bank_col and qr_img:
        bank_w, qr_w = BODY_W * 0.55, BODY_W * 0.45
    elif has_bank_col:
        bank_w, qr_w = BODY_W, 0
    else:
        bank_w, qr_w = 0, BODY_W

    parts, widths, style_cmds = [], [], [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]

    if has_bank_col:
        bank_body = _tbl(
            bank_rows,
            [30 * mm, bank_w - 30 * mm],
            [
                ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 1.6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ],
        )
        bank_col = _tbl(
            [[_label_block("Payment Details", bank_w)], [bank_body]],
            [bank_w],
            [
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6 if qr_img else 0),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ],
        )
        parts.append(bank_col)
        widths.append(bank_w)

    if qr_img:
        qr_col = _tbl(
            [
                [_label("Scan to Pay")],
                [qr_img],
                [para(_fmt_value(upi_id), size=7.1, align=TA_CENTER, color=SUBTLE)],
            ],
            [qr_w],
            [
                ("TOPPADDING", (0, 0), (-1, -1), 1.3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6 if has_bank_col else 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ],
        )
        parts.append(qr_col)
        widths.append(qr_w)

    if len(parts) == 2:
        style_cmds.append(("LINEBEFORE", (1, 0), (1, -1), 0.4, LINE))

    return _tbl([parts], widths, style_cmds)


def build_footer(terms="", footer_text="", document_title="Tax Invoice", show_declaration=True):
    declaration = "Declaration: The above particulars are true and correct."
    signature_row = _tbl(
        [[
            para("", size=7.4),
            para("Authorized Signatory", size=7.4, align=TA_RIGHT, color=SUBTLE),
        ]],
        [BODY_W * 0.5, BODY_W * 0.5],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ],
    )
    content = [*_rule(color=LINE_STRONG, weight=0.9, gap_below=1.6 * mm)]
    if show_declaration and has_val(terms or declaration):
        content.append(para(terms or declaration, size=6.9, color=SUBTLE))
    content.append(signature_row)
    content.extend(_rule(gap_above=1.2 * mm, gap_below=1.2 * mm))
    content.append(para(
        footer_text or f"Thank you for shopping with us! Visit again.",
        size=7.2, align=TA_CENTER, color=SUBTLE,
    ))
    content.append(para(
        f"Computer generated {document_title.lower()}.", size=6.2, align=TA_CENTER, color=FAINT,
    ))
    return content


# ── Main: A4 ───────────────────────────────────────────────────────────────────
def generate_invoice_pdf(invoice):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=12 * mm,
        bottomMargin=11 * mm,
        leftMargin=L_MAR,
        rightMargin=R_MAR,
        title=f"Invoice {invoice.invoice_number}",
    )

    settings = invoice_settings(invoice)
    value = lambda key, default="": setting_value(settings, key, default)
    shop_name = value("shop_name", "YOUR KIRANA STORE")
    shop_address, shop_phone, shop_email = value("shop_address"), value("shop_phone"), value("shop_email")
    shop_gstin, shop_pan = value("shop_gstin"), value("shop_pan")
    bank_name, bank_branch = value("shop_bank_name"), value("shop_bank_branch")
    bank_account, bank_ifsc, upi_id = value("shop_bank_account"), value("shop_bank_ifsc"), value("shop_upi_id")
    template = value("invoice_template", "gst_a4")
    document_title = "Bill of Supply" if template == "supply_a4" else "Tax Invoice"

    grand = Decimal(str(invoice.grand_total or 0))
    inv_date = _date_text(getattr(invoice, "created_at", None) or getattr(invoice, "date", None))

    # Columns/sections only earn their place on the page when there is real
    # data behind them — settings enable a feature, but an empty result set
    # (no HSN codes, no discounts applied) still hides the column/section.
    show_hsn = _flag(settings, "show_hsn_col", True) and any_item_has_hsn(invoice)
    show_discount_col = _flag(settings, "show_discount_col", False) and any_item_has_discount(invoice)
    show_hsn_summary = _flag(settings, "hsn_summary_on_invoice", True)

    gst_summary_parts = build_gst_summary(invoice, show_hsn=show_hsn) if show_hsn_summary else None

    payment_section = build_payment_section(
        shop_name, bank_name, bank_branch, bank_account, bank_ifsc, upi_id, grand,
        invoice.invoice_number,
        _flag(settings, "show_upi_qr_on_invoice", True) and _flag(settings, "upi_qr_enabled", True),
        _flag(settings, "show_bank_details", True),
    )

    story = [
        *build_header(
            shop_name, shop_address, shop_phone, shop_email, shop_gstin, shop_pan, upi_id, grand,
            document_title, value("gst_reg_type", "regular"),
            invoice_number=invoice.invoice_number, invoice_date=inv_date,
            show_pan=_flag(settings, "show_pan", True),
        ),
        SECTION_GAP,
        *build_meta_and_customer(invoice),
        build_items_table(
            invoice,
            show_hsn=show_hsn,
            show_discount=show_discount_col,
            show_mrp=_flag(settings, "show_mrp_col", False),
            show_basic=_flag(settings, "show_basic_price_col", False),
        ),
        SECTION_GAP,
    ]
    if gst_summary_parts:
        story.extend(gst_summary_parts)
        story.append(SECTION_GAP)
    story.append(build_totals(
        invoice,
        show_discount=_flag(settings, "show_discount_total", True),
        show_round_off=_flag(settings, "show_round_off", True),
    ))
    if payment_section:
        story.append(SECTION_GAP)
        story.append(payment_section)
    story.extend(build_footer(
        value("invoice_terms"), value("invoice_footer"), document_title,
        show_declaration=_flag(settings, "show_declaration", True),
    ))

    doc.build(story, onFirstPage=_page_chrome, onLaterPages=_page_chrome)
    buffer.seek(0)
    return buffer


# ── Main: 80mm thermal ───────────────────────────────────────────────────────
def generate_thermal_invoice_pdf(invoice):
    buffer = BytesIO()

    settings = invoice_settings(invoice)
    value = lambda key, default="": setting_value(settings, key, default)
    shop_name = value("shop_name", "YOUR KIRANA STORE")
    shop_address, shop_phone, shop_email = value("shop_address"), value("shop_phone"), value("shop_email")
    shop_gstin, upi_id = value("shop_gstin"), value("shop_upi_id")
    template = value("invoice_template", "gst_a4")
    document_title = "Bill of Supply" if template == "supply_a4" else "Tax Invoice"
    show_declaration = _flag(settings, "show_declaration_thermal", False)
    show_signature = _flag(settings, "show_signature_thermal", False)

    show_qr = _flag(settings, "show_upi_qr_on_thermal", True) and _flag(settings, "upi_qr_enabled", True) and has_val(upi_id)
    # Height is calculated from the actual content that will be printed —
    # not a fixed A4-style page — so the receipt ends right after the
    # footer instead of leaving a large blank tail.
    address_lines = len([l for l in (shop_address or "").split("\n") if l.strip()])
    has_contact_line = bool(has_val(shop_phone) or has_val(shop_email))
    has_gstin_line = has_val(shop_gstin)
    page_height = (
        72
        + address_lines * 4
        + (4 if has_contact_line else 0)
        + (4 if has_gstin_line else 0)
        + len(invoice.items.all()) * 9
        + (42 if show_qr else 0)
        + (10 if show_declaration else 0)
        + (8 if show_signature else 0)
    ) * mm
    page_height = max(85 * mm, page_height)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=portrait((80 * mm, page_height)),
        topMargin=3.5 * mm,
        bottomMargin=3.5 * mm,
        leftMargin=3.5 * mm,
        rightMargin=3.5 * mm,
        title=f"Invoice {invoice.invoice_number}",
    )
    story = []
    content_w = 80 * mm - 7 * mm

    inv_date = _date_text(getattr(invoice, "created_at", None) or getattr(invoice, "date", None))
    cust = invoice.customer
    cust_name = cust.name if cust else (invoice.customer_name or "Walk-in Customer")
    cust_phone = cust.mobile if cust else invoice.customer_phone
    grand = Decimal(str(invoice.grand_total or 0))
    paid_amount = Decimal(str(invoice.paid_amount or 0))
    balance_due = max(Decimal("0.00"), grand - paid_amount)
    change_returned = max(Decimal("0.00"), paid_amount - grand)
    discount_amt = Decimal(str(invoice.discount_amount or 0))
    round_off_amt = Decimal(str(invoice.round_off or 0))

    def dashed_rule(gap_above=1.0 * mm, gap_below=1.0 * mm):
        story.append(Spacer(1, gap_above))
        story.append(HRFlowable(width=content_w, thickness=0.6, color=INK,
                                 dash=(2, 1.4), spaceBefore=0, spaceAfter=0, hAlign="CENTER"))
        story.append(Spacer(1, gap_below))

    # ── Masthead — text only, no logo, centered ──
    story.append(para(f"<b>{shop_name.upper()}</b>", size=11.5, align=TA_CENTER, color=INK))
    story.append(para(
        "GST Registered Business" if value("gst_reg_type", "regular") == "regular" else "General / Kirana Store",
        size=6.5, align=TA_CENTER, color=SUBTLE,
    ))
    for line in (shop_address or "").split("\n"):
        if line.strip():
            story.append(para(line.strip(), size=6.4, align=TA_CENTER, color=SUBTLE))
    contact_bits = []
    if has_val(shop_phone):
        contact_bits.append(f"Ph: {shop_phone}")
    if has_val(shop_email):
        contact_bits.append(shop_email)
    if contact_bits:
        story.append(para(" | ".join(contact_bits), size=6.4, align=TA_CENTER, color=SUBTLE))
    if has_val(shop_gstin):
        story.append(para(f"GSTIN: {shop_gstin}", size=6.4, align=TA_CENTER, color=INK))
    dashed_rule(gap_above=1.2 * mm)

    story.append(para(document_title.upper(), size=10.5, bold=True, align=TA_CENTER, color=INK))
    story.append(para(_fmt_value(invoice.invoice_number), size=7.2, bold=True, align=TA_CENTER, color=INK))
    story.append(para(f"Date: {inv_date}", size=6.6, align=TA_CENTER, color=SUBTLE))
    story.append(para(f"Payment: {(invoice.payment_method or 'cash').upper()}", size=6.6, align=TA_CENTER, color=SUBTLE))
    dashed_rule()

    cust_line = f"Customer: {_fmt_value(cust_name, 'Walk-in Customer')}"
    if has_val(cust_phone):
        cust_line += f"  |  {cust_phone}"
    story.append(para(cust_line, size=6.4, color=SUBTLE))
    dashed_rule()

    item_rows = [[
        para("Item", size=6.2, bold=True, color=INK),
        para("Qty", size=6.2, bold=True, align=TA_RIGHT, color=INK),
        para("Rate", size=6.2, bold=True, align=TA_RIGHT, color=INK),
        para("Amount", size=6.2, bold=True, align=TA_RIGHT, color=INK),
    ]]
    for item in invoice.items.all():
        item_rows.append([
            para(_fmt_value(item.product_name), size=6.3, color=INK),
            para(_fmt_value(item.quantity), size=6.3, align=TA_RIGHT, color=INK),
            para(currency(item.unit_price), size=6.3, align=TA_RIGHT, color=INK),
            para(currency(item.total), size=6.3, bold=True, align=TA_RIGHT, color=INK),
        ])
    last_row = len(item_rows) - 1
    item_tbl = _tbl(
        item_rows,
        [32 * mm, 10 * mm, 16 * mm, 16 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, 0), 0.7, LINE_STRONG),
            ("LINEABOVE", (0, 0), (-1, 0), 0.7, LINE_STRONG),
            ("LINEBELOW", (0, 1), (-1, last_row), 0.3, LINE),
            ("LINEBELOW", (0, last_row), (-1, last_row), 0.7, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 1.4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.4),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1.2),
        ],
        repeat=1,
    )
    story.append(item_tbl)
    story.append(Spacer(1, 1.0 * mm))

    totals_rows = [[para("Sub Total", size=6.6, color=SUBTLE), para(currency(invoice.subtotal), size=6.6, align=TA_RIGHT, color=INK)]]
    if discount_amt != 0:
        totals_rows.append([para("Discount", size=6.6, color=SUBTLE), para(currency(discount_amt), size=6.6, align=TA_RIGHT, color=INK)])
    if Decimal(str(invoice.tax_amount or 0)) != 0:
        totals_rows.append([para("GST", size=6.6, color=SUBTLE), para(currency(invoice.tax_amount), size=6.6, align=TA_RIGHT, color=INK)])
    if round_off_amt != 0:
        totals_rows.append([para("Round Off", size=6.6, color=SUBTLE), para(currency(round_off_amt), size=6.6, align=TA_RIGHT, color=INK)])
    grand_row_index = len(totals_rows)
    totals_rows.append([para("GRAND TOTAL", size=11, bold=True, color=INK), para(f"<b>{currency(grand)}</b>", size=11, align=TA_RIGHT, color=INK)])

    # Same box-free treatment as the A4 template: one heavy rule sets the
    # Grand Total apart, typography does the rest.
    totals_tbl = _tbl(
        totals_rows,
        [35 * mm, 39 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, grand_row_index - 1), 0.3, LINE),
            ("LINEABOVE", (0, grand_row_index), (-1, grand_row_index), 1.3, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 1.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
            ("TOPPADDING", (0, grand_row_index), (-1, grand_row_index), 2.6),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )
    story.append(totals_tbl)
    dashed_rule()

    story.append(para(f"<i>{amount_in_words(grand)}</i>", size=6.2, color=SUBTLE))
    story.append(Spacer(1, 0.8 * mm))

    # Payment status compressed into a single line — Balance Due / Change
    # only appear when they are actually non-zero.
    pay_bits = [f"Paid: {currency(paid_amount)}"]
    if balance_due != 0:
        pay_bits.append(f"Balance: {currency(balance_due)}")
    if change_returned != 0:
        pay_bits.append(f"Change: {currency(change_returned)}")
    story.append(para(
        f"<b>{(invoice.payment_status or 'PAID').upper()}</b> &nbsp;\u00b7&nbsp; " + " &nbsp;|&nbsp; ".join(pay_bits),
        size=6.3, align=TA_CENTER, color=INK,
    ))

    qr_img = make_upi_qr(upi_id, shop_name, grand, size_mm=20, invoice_number=invoice.invoice_number) if show_qr else None
    if qr_img:
        dashed_rule()
        qr_tbl = _tbl(
            [
                [para("SCAN TO PAY", size=6.6, bold=True, align=TA_CENTER, color=INK)],
                [qr_img],
                [para(_fmt_value(upi_id), size=6.1, align=TA_CENTER, color=SUBTLE)],
            ],
            [content_w],
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 1.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ],
        )
        story.append(qr_tbl)

    dashed_rule(gap_above=1.2 * mm, gap_below=1.0 * mm)
    if show_declaration:
        story.append(para(
            value("invoice_terms") or "Declaration: The above particulars are true and correct.",
            size=6.0, color=SUBTLE,
        ))
        story.append(Spacer(1, 1.2 * mm))
    if show_signature:
        story.append(_tbl(
            [[para("", size=6.1), para("Authorized Sign.", size=6.1, align=TA_RIGHT, color=SUBTLE)]],
            [content_w / 2, content_w / 2],
            [
                ("LINEABOVE", (0, 0), (-1, 0), 0.4, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 1.2),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ],
        ))
        story.append(Spacer(1, 1.0 * mm))
    story.append(para(
        value("receipt_footer") or value("invoice_footer") or "Thank you for shopping with us!",
        size=6.6, align=TA_CENTER, color=SUBTLE,
    ))
    story.append(para("Computer generated invoice.", size=5.6, align=TA_CENTER, color=FAINT))

    doc.build(story)
    buffer.seek(0)
    return buffer