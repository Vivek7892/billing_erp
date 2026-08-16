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

# ── Pure black & white palette ───────────────────────────────────────────────
INK = colors.HexColor("#000000")          # primary text / values — true black
SUBTLE = colors.HexColor("#333333")       # labels, secondary text, footer notes (darkened for legibility)
FAINT = colors.HexColor("#6e6e6e")        # least emphasis (placeholders only)
LINE = colors.HexColor("#d9d9d9")         # hairline divider
LINE_STRONG = colors.HexColor("#000000")  # section-defining rule
HEAD_TINT = colors.HexColor("#f0f0f0")    # table header band (very light — prints fine in pure B/W)
BLK = INK

PAGE_W, PAGE_H = A4
L_MAR = 12 * mm
R_MAR = 12 * mm
BODY_W = PAGE_W - L_MAR - R_MAR  # ~186 mm

SECTION_GAP = Spacer(1, 2.0 * mm)
TIGHT_GAP = Spacer(1, 1.1 * mm)


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


def mask_account_number(value, keep_last=4):
    """Show only the last N digits of a bank account number on customer-facing
    bills — the rest is masked with asterisks."""
    digits = str(value or "").strip()
    if not digits:
        return "—"
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


# ── Page chrome: light corner rule + page numbers (no full frame/box) ──────
def _page_chrome(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT_R, 6.6)
    canvas.setFillColor(FAINT)
    canvas.drawRightString(PAGE_W - R_MAR, 7.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_header(shop_name, shop_address, shop_phone, shop_email, shop_gstin, shop_pan,
                  upi_id, grand_total, document_title="Tax Invoice",
                  registration_type="regular", invoice_number="", invoice_date="—"):
    """Text-only masthead — no logo. The shop name carries the visual weight
    on its own, set large and bold; everything else is quiet supporting text."""
    brand_name = _fmt_value(shop_name, "YOUR KIRANA STORE")

    title_w = BODY_W * 0.32
    info_w = BODY_W - title_w

    info_rows = [
        [para(brand_name.upper(), bold=True, size=17, align=TA_LEFT, color=INK)],
        [para(
            "GST Registered Business" if registration_type == "regular" else "General / Kirana Store",
            size=7.0, color=SUBTLE,
        )],
    ]
    for line in (shop_address or "").split("\n"):
        line = line.strip()
        if line:
            info_rows.append([para(line, size=7.3, color=SUBTLE)])
    contact_bits = []
    if shop_phone:
        contact_bits.append(f"Ph: {shop_phone}")
    if shop_email:
        contact_bits.append(shop_email)
    if contact_bits:
        info_rows.append([para(" &nbsp;|&nbsp; ".join(contact_bits), size=7.3, color=SUBTLE)])
    gst_bits = []
    if shop_gstin:
        gst_bits.append(f"GSTIN: {shop_gstin}")
    if shop_pan:
        gst_bits.append(f"PAN: {shop_pan}")
    if gst_bits:
        info_rows.append([para(" &nbsp;|&nbsp; ".join(gst_bits), size=7.3, bold=True, color=INK)])

    info_tbl = _tbl(
        info_rows,
        [info_w],
        [
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1.3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.3),
        ],
    )

    title_tbl = _tbl(
        [
            [para(document_title.upper(), size=13.5, bold=True, align=TA_RIGHT, color=INK)],
            [para("Original for Recipient", size=6.9, align=TA_RIGHT, color=SUBTLE)],
            [Spacer(1, 1.4 * mm)],
            [para(f"<b>No.</b> {_fmt_value(invoice_number)}", size=8.2, align=TA_RIGHT, color=INK)],
            [para(f"<b>Date</b> {invoice_date}", size=8.2, align=TA_RIGHT, color=INK)],
        ],
        [title_w],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 1.3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.3),
        ],
    )

    header_row = _tbl(
        [[info_tbl, title_tbl]],
        [info_w, title_w],
        [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ],
    )

    return [header_row, *_rule(color=LINE_STRONG, weight=1.1, gap_above=2.4 * mm)]


def build_meta_and_customer(invoice):
    """Invoice details (left) and Bill To (right), side by side. No outer
    boxes — each panel is set off by its own underlined label and a single
    vertical hairline between the two columns."""
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

    def lbl(text):
        return para(text, size=6.8, color=SUBTLE)

    def val(text):
        return para(text, size=7.5, color=INK)

    col_gap = 6 * mm
    left_w = BODY_W * 0.50
    right_w = BODY_W - left_w - col_gap

    # Payment Status is intentionally NOT repeated here — it lives once,
    # alongside Paid/Balance/Change, in the Payment Summary near the totals.
    meta_ratios = [26, 74, 26, 74]
    meta_scale = left_w / sum(meta_ratios)
    meta_widths = [r * meta_scale for r in meta_ratios]
    meta_rows = [
        [lbl("Invoice No"), val(_fmt_value(invoice.invoice_number)), lbl("Order No"), val(_fmt_value(order_no))],
        [lbl("Invoice Date"), val(inv_date), lbl("Order Date"), val(_date_text(order_date))],
        [lbl("Payment Mode"), val(pay_mode), lbl("Vehicle No"), val(_fmt_value(vehicle_no))],
    ]
    if _fmt_value(route_name) != "—":
        meta_rows.append([lbl("Route Name"), val(_fmt_value(route_name)), para(""), para("")])
    meta_tbl = _tbl(
        meta_rows,
        meta_widths,
        [
            ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 1.7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.7),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
    )
    meta_col = _tbl(
        [[_label_block("Invoice Details", left_w)], [meta_tbl]],
        [left_w],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ],
    )

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
    cust_widths = [right_w * 0.28, right_w * 0.72]
    cust_tbl = _tbl(
        cust_rows,
        cust_widths,
        [
            ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 1.7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.7),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ],
    )
    cust_col = _tbl(
        [[_label_block("Bill To", right_w)], [cust_tbl]],
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
    return [row, *_rule(gap_above=2.2 * mm, gap_below=1.6 * mm)]


def build_items_table(invoice, show_hsn=True, show_discount=False, show_mrp=False, show_basic=False):
    """Item lines. Default column set is the lean, recommended one:
    Sl | Item Description | HSN | Qty | Rate | GST | Amount.
    MRP, pre-tax Basic Price, and Discount are opt-in extras controlled by
    Settings — most kirana bills don't need them and they just add clutter."""
    items = list(invoice.items.all())

    # (key, header, ratio, align, cell_fn) — cell_fn(item) -> Paragraph
    def cell(text, size=7.5, align=TA_RIGHT, color=INK, bold=False, leading=None):
        return para(text, size=size, align=align, color=color, bold=bold, leading=leading)

    columns = [("sl", "Sl", 6, TA_CENTER,
                lambda i, idx: cell(str(idx), size=7.4, align=TA_CENTER, color=SUBTLE))]
    columns.append(("item", "Item Description", 58, TA_LEFT,
                     lambda i, idx: cell(_fmt_value(i.product_name), align=TA_LEFT)))
    if show_hsn:
        columns.append(("hsn", "HSN", 13, TA_CENTER,
                         lambda i, idx: cell(_fmt_value(i.hsn_code), size=7.3, align=TA_CENTER, color=SUBTLE)))
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
    columns.append(("gst", "GST", 18, TA_RIGHT,
                     lambda i, idx: cell(f"{currency(i.gst_amount or 0)}<br/>({Decimal(str(i.gst_percent or 0))}%)",
                                          size=6.8, leading=8.3, color=SUBTLE)))
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


def any_item_has_hsn(invoice):
    return any(_fmt_value(item.hsn_code) != "—" for item in invoice.items.all())


def build_gst_summary(invoice):
    """A simplified per-HSN GST breakup: HSN, taxable amount, combined GST
    rate, CGST, SGST, and the total tax for that group. IGST is dropped —
    this template targets local, intrastate kirana billing where IGST is
    always zero and only added clutter."""
    gst_groups = defaultdict(lambda: {"taxable": Decimal("0"), "gst": Decimal("0")})
    for item in invoice.items.all():
        hsn = item.hsn_code or "—"
        gst_pct = Decimal(str(item.gst_percent or 0))
        gst_amt = Decimal(str(item.gst_amount or 0))
        taxable = _basic_price(item)
        key = (hsn, gst_pct)
        gst_groups[key]["taxable"] += taxable
        gst_groups[key]["gst"] += gst_amt

    rows = [[
        para("HSN Code", size=7.0, bold=True, align=TA_CENTER, color=INK),
        para("Taxable Amt", size=7.0, bold=True, align=TA_RIGHT, color=INK),
        para("GST Rate", size=7.0, bold=True, align=TA_CENTER, color=INK),
        para("CGST", size=7.0, bold=True, align=TA_RIGHT, color=INK),
        para("SGST", size=7.0, bold=True, align=TA_RIGHT, color=INK),
        para("Total Tax", size=7.0, bold=True, align=TA_RIGHT, color=INK),
    ]]

    total_taxable = total_cgst = total_sgst = total_tax = Decimal("0")
    for (hsn, rate_pct), group in sorted(gst_groups.items(), key=lambda x: (x[0][0], x[0][1])):
        cgst = (group["gst"] / 2).quantize(Decimal("0.01"))
        sgst = group["gst"] - cgst
        total_taxable += group["taxable"]
        total_cgst += cgst
        total_sgst += sgst
        total_tax += group["gst"]
        rows.append([
            para(_fmt_value(hsn), size=7.2, align=TA_CENTER, color=SUBTLE),
            para(currency(group["taxable"]), size=7.2, align=TA_RIGHT, color=INK),
            para(f"{rate_pct}%", size=7.2, align=TA_CENTER, color=SUBTLE),
            para(currency(cgst), size=7.2, align=TA_RIGHT, color=INK),
            para(currency(sgst), size=7.2, align=TA_RIGHT, color=INK),
            para(currency(group["gst"]), size=7.2, align=TA_RIGHT, bold=True, color=INK),
        ])

    if len(rows) > 2:
        rows.append([
            para("Total", size=7.3, bold=True, align=TA_CENTER, color=INK),
            para(currency(total_taxable), size=7.3, bold=True, align=TA_RIGHT, color=INK),
            para("", size=7.3),
            para(currency(total_cgst), size=7.3, bold=True, align=TA_RIGHT, color=INK),
            para(currency(total_sgst), size=7.3, bold=True, align=TA_RIGHT, color=INK),
            para(currency(total_tax), size=7.3, bold=True, align=TA_RIGHT, color=INK),
        ])

    col_ratios = [20, 30, 16, 22, 22, 24]
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
    # IGST no longer earn a line on the bill — each optional row is only
    # added when it's actually non-zero (or explicitly enabled).
    right_rows = [[lbl("Sub Total"), val(currency(subtotal))]]
    if show_discount and discount != 0:
        right_rows.append([lbl("Discount"), val(currency(discount))])
    right_rows.append([lbl("Taxable Amount"), val(currency(taxable_amt))])
    right_rows.append([lbl("CGST"), val(currency(total_cgst))])
    right_rows.append([lbl("SGST"), val(currency(total_sgst))])
    if show_round_off and round_off != 0:
        right_rows.append([lbl("Round Off"), val(currency(round_off))])
    grand_row_index = len(right_rows)
    right_rows.append([
        para("GRAND TOTAL", size=12.5, bold=True, color=INK),
        para(f"<b>{currency(grand)}</b>", size=12.5, align=TA_RIGHT, color=INK),
    ])

    # Grand Total is set off purely with typography and one strong rule
    # above it — no shaded box, per the clean-minimal direction.
    right_box = _tbl(
        right_rows,
        [40 * mm, 44 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, grand_row_index - 1), 0.35, LINE),
            ("LINEABOVE", (0, grand_row_index), (-1, grand_row_index), 1.3, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 1.8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8),
            ("TOPPADDING", (0, grand_row_index), (-1, grand_row_index), 3.2),
            ("BOTTOMPADDING", (0, grand_row_index), (-1, grand_row_index), 1.0),
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
    masked (only the last 4 digits shown) since this is a customer-facing
    document."""
    bank_rows = []
    if show_bank:
        if bank_name:
            bank_rows.append([para("Bank Name", size=7.0, color=SUBTLE), para(bank_name, size=7.5, color=INK)])
        if bank_branch:
            bank_rows.append([para("Branch", size=7.0, color=SUBTLE), para(bank_branch, size=7.5, color=INK)])
        if bank_account:
            bank_rows.append([para("A/C No.", size=7.0, color=SUBTLE),
                               para(mask_account_number(bank_account), size=7.5, color=INK)])
        if bank_ifsc:
            bank_rows.append([para("IFSC", size=7.0, color=SUBTLE), para(bank_ifsc, size=7.5, color=INK)])
    if upi_id:
        bank_rows.append([para("UPI ID", size=7.0, color=SUBTLE), para(upi_id, size=7.5, bold=True, color=INK)])

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
    ) if bank_rows else para("No bank details on record.", size=7.5, color=FAINT)

    bank_col = _tbl(
        [[_label_block("Bank / Payment Details", BODY_W * 0.55)], [bank_body]],
        [BODY_W * 0.55],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ],
    )

    qr_img = make_upi_qr(upi_id, shop_name, grand, size_mm=24, invoice_number=invoice_number) if show_qr else None

    qr_rows = [[_label("Scan to Pay")]]
    qr_rows.append([qr_img] if qr_img else [para("QR unavailable", size=7.3, align=TA_CENTER, color=FAINT)])
    qr_rows.append([para(_fmt_value(upi_id), size=7.1, align=TA_CENTER, color=SUBTLE)])
    qr_col = _tbl(
        qr_rows,
        [BODY_W * 0.45],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 1.3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.3),
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


def build_footer(terms="", footer_text="", document_title="Tax Invoice", show_declaration=True):
    declaration = (
        "Declaration: I / We hereby certify that the particulars given above are true and correct and that the "
        "goods/services described above have been supplied as stated."
    )
    signature_row = _tbl(
        [[
            para("Customer Signature", size=7.4, align=TA_LEFT, color=SUBTLE),
            Spacer(1, 5 * mm),
            para("Authorized Signatory", size=7.4, align=TA_RIGHT, color=SUBTLE),
        ]],
        [BODY_W * 0.34, BODY_W * 0.32, BODY_W * 0.34],
        [
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ],
    )
    content = [*_rule(color=LINE_STRONG, weight=0.9, gap_below=1.6 * mm)]
    if show_declaration:
        content.append(para(terms or declaration, size=6.9, color=SUBTLE))
    content.append(signature_row)
    content.extend(_rule(gap_above=1.2 * mm, gap_below=1.2 * mm))
    content.append(para(
        footer_text or f"This is a computer generated {document_title.lower()} and does not require a signature. "
        "Thank you for shopping with us!",
        size=7.2, align=TA_CENTER, color=SUBTLE,
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

    # HSN summary only earns its place on the page when items actually carry
    # an HSN code — otherwise it is a table of "—" rows and pure clutter.
    show_hsn_summary = value("hsn_summary_on_invoice", "true") == "true" and any_item_has_hsn(invoice)

    story = [
        *build_header(
            shop_name, shop_address, shop_phone, shop_email, shop_gstin, shop_pan, upi_id, grand,
            document_title, value("gst_reg_type", "regular"),
            invoice_number=invoice.invoice_number, invoice_date=inv_date,
        ),
        SECTION_GAP,
        *build_meta_and_customer(invoice),
        build_items_table(
            invoice,
            show_hsn=value("show_hsn_col", "true") == "true",
            show_discount=value("show_discount_col", "false") == "true",
            show_mrp=value("show_mrp_col", "false") == "true",
            show_basic=value("show_basic_price_col", "false") == "true",
        ),
        SECTION_GAP,
        *(build_gst_summary(invoice) + [SECTION_GAP] if show_hsn_summary else []),
        build_totals(
            invoice,
            show_discount=value("show_discount_total", "true") == "true",
            show_round_off=value("show_round_off", "true") == "true",
        ),
        SECTION_GAP,
        build_payment_section(
            shop_name, bank_name, bank_branch, bank_account, bank_ifsc, upi_id, grand,
            invoice.invoice_number,
            value("show_upi_qr_on_invoice", "true") == "true" and value("upi_qr_enabled", "true") == "true",
            value("show_bank_details", "true") == "true",
        ),
        *build_footer(
            value("invoice_terms"), value("invoice_footer"), document_title,
            show_declaration=value("show_declaration", "true") == "true",
        ),
    ]

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
    show_declaration = value("show_declaration_thermal", "false") == "true"
    show_signature = value("show_signature_thermal", "false") == "true"

    show_qr = value("show_upi_qr_on_thermal", "true") == "true" and value("upi_qr_enabled", "true") == "true" and bool(upi_id)
    address_lines = len([l for l in (shop_address or "").split("\n") if l.strip()])
    page_height = (128 + address_lines * 4 + len(invoice.items.all()) * 10 + (40 if show_qr else 0)
                   + (8 if show_declaration else 0) + (7 if show_signature else 0)) * mm
    page_height = max(120 * mm, page_height)
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

    # ── Masthead — text only, no logo ──
    story.append(para(f"<b>{shop_name.upper()}</b>", size=11.5, align=TA_CENTER, color=INK))
    story.append(para(
        "GST Registered Business" if value("gst_reg_type", "regular") == "regular" else "General / Kirana Store",
        size=6.5, align=TA_CENTER, color=SUBTLE,
    ))
    for line in (shop_address or "").split("\n"):
        if line.strip():
            story.append(para(line.strip(), size=6.4, align=TA_CENTER, color=SUBTLE))
    contact_bits = []
    if shop_phone:
        contact_bits.append(f"Ph: {shop_phone}")
    if shop_email:
        contact_bits.append(shop_email)
    if contact_bits:
        story.append(para(" | ".join(contact_bits), size=6.4, align=TA_CENTER, color=SUBTLE))
    if shop_gstin:
        story.append(para(f"GSTIN: {shop_gstin}", size=6.4, align=TA_CENTER, color=INK))
    dashed_rule(gap_above=1.2 * mm)

    story.append(para(document_title.upper(), size=10.5, bold=True, align=TA_CENTER, color=INK))
    story.append(Spacer(1, 0.8 * mm))

    meta_tbl = _tbl(
        [
            [para("Invoice No", size=6.3, color=SUBTLE), para(_fmt_value(invoice.invoice_number), size=6.3, bold=True, color=INK)],
            [para("Date", size=6.3, color=SUBTLE), para(inv_date, size=6.3, color=INK)],
            [para("Mode", size=6.3, color=SUBTLE), para((invoice.payment_method or "cash").upper(), size=6.3, color=INK)],
        ],
        [17 * mm, content_w - 17 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, -2), 0.3, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 1.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1.5),
        ],
    )
    story.append(meta_tbl)
    story.append(para(
        f"Customer: {_fmt_value(cust_name)}" + (f"  |  {_fmt_value(cust_phone)}" if cust_phone else ""),
        size=6.4, color=SUBTLE,
    ))
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
    totals_rows.append([para("GST", size=6.6, color=SUBTLE), para(currency(invoice.tax_amount), size=6.6, align=TA_RIGHT, color=INK)])
    if round_off_amt != 0:
        totals_rows.append([para("Round Off", size=6.6, color=SUBTLE), para(currency(round_off_amt), size=6.6, align=TA_RIGHT, color=INK)])
    grand_row_index = len(totals_rows)
    totals_rows.append([para("GRAND TOTAL", size=10.5, bold=True, color=INK), para(f"<b>{currency(grand)}</b>", size=10.5, align=TA_RIGHT, color=INK)])

    # Same box-free treatment as the A4 template: one heavy rule sets the
    # Grand Total apart, typography does the rest.
    totals_tbl = _tbl(
        totals_rows,
        [35 * mm, 39 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, grand_row_index - 1), 0.3, LINE),
            ("LINEABOVE", (0, grand_row_index), (-1, grand_row_index), 1.1, LINE_STRONG),
            ("TOPPADDING", (0, 0), (-1, -1), 1.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
            ("TOPPADDING", (0, grand_row_index), (-1, grand_row_index), 2.4),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ],
    )
    story.append(totals_tbl)
    dashed_rule()

    story.append(para(f"<i>{amount_in_words(grand)}</i>", size=6.2, color=SUBTLE))
    story.append(Spacer(1, 0.8 * mm))

    # Payment status compressed into a single line rather than a full block —
    # skip Balance Due / Change entirely when both are zero.
    pay_bits = [f"Paid: {currency(paid_amount)}"]
    if balance_due != 0:
        pay_bits.append(f"Balance: {currency(balance_due)}")
    if change_returned != 0:
        pay_bits.append(f"Change: {currency(change_returned)}")
    story.append(para(
        f"<b>{(invoice.payment_status or 'PAID').upper()}</b> &nbsp;·&nbsp; " + " &nbsp;|&nbsp; ".join(pay_bits),
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
            value("invoice_terms") or
            "Declaration: I / We certify that the particulars given above are true and correct.",
            size=6.0, color=SUBTLE,
        ))
        story.append(Spacer(1, 1.2 * mm))
    if show_signature:
        story.append(_tbl(
            [[para("Customer Sign.", size=6.1, color=SUBTLE), para("Authorized Sign.", size=6.1, align=TA_RIGHT, color=SUBTLE)]],
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
        value("receipt_footer") or value("invoice_footer") or "Thank you, visit again!",
        size=6.6, align=TA_CENTER, color=SUBTLE,
    ))
    story.append(para("Computer generated invoice.", size=5.6, align=TA_CENTER, color=FAINT))

    doc.build(story)
    buffer.seek(0)
    return buffer