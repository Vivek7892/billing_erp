from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.http import HttpResponse, Http404
from django.db import IntegrityError
from django.urls import reverse
from django.db.models import Sum, Count, Q, F
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from io import BytesIO
import csv
import urllib.request
from openpyxl import Workbook, load_workbook
from openpyxl.utils import get_column_letter
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.drawing.image import Image as XLImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage

from .models import *
from .serializers import *
from .permissions import (
    IsAdmin, IsAdminOrReadOnly, IsCashierOrAdmin, IsFinanceStaff,
    IsManagerOrAdmin, IsManagerOrReadOnly, IsManagerOrAbove,
)
from .supabase_storage import SupabaseStorageError, upload_shop_logo
from .pagination import NoPagination, StandardPagination
from .utils import audit_event
from .services.report_service import ReportService
from django_filters.rest_framework import DjangoFilterBackend
from PIL import Image as PILImage


class LoginRateThrottle(AnonRateThrottle):
    rate = '10/min'
    scope = 'login'


def _report_value(value):
    if value is None:
        return ''
    if isinstance(value, float):
        return f'{value:.2f}'
    if isinstance(value, Decimal):
        return f'{value:.2f}'
    return str(value)


def _rupee(value):
    """Prefix a numeric string with Rs. (safe for Helvetica fallback font)."""
    s = str(value).strip()
    if not s or s in ('', '0.00', '0'):
        return s
    # Only prefix if it looks like a number
    try:
        float(s.replace(',', ''))
        return f'Rs.{s}'
    except ValueError:
        return s


def _report_response(filename, content, content_type):
    response = HttpResponse(content, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response



def _report_setting(request_user, key, default=''):
    """Read a business-scoped setting safely."""
    try:
        business = getattr(request_user, 'business', None)
        if business is not None:
            setting = Setting.objects.filter(business=business, key=key).first()
        else:
            setting = Setting.objects.filter(key=key).first()
        return setting.value if setting else default
    except Exception:
        return default


def _get_report_business_profile(request_user=None):
    """Return report identity/settings used by both PDF and Excel exports."""
    business = getattr(request_user, 'business', None)
    return {
        'shop_name': _report_setting(request_user, 'shop_name', getattr(business, 'name', '') or 'ShopEase POS'),
        'shop_address': _report_setting(request_user, 'shop_address', getattr(business, 'address', '') or ''),
        'shop_phone': _report_setting(request_user, 'shop_phone', getattr(business, 'mobile', '') or ''),
        'shop_email': _report_setting(request_user, 'shop_email', getattr(business, 'email', '') or ''),
        'shop_gstin': _report_setting(request_user, 'shop_gstin', getattr(business, 'gstin', '') or ''),
        'shop_logo': _report_setting(request_user, 'shop_logo', ''),
    }


def _download_report_logo(url):
    """
    Download the configured public shop logo and normalize it to PNG.
    Returns PNG bytes or None. Report generation never fails because a logo
    cannot be downloaded.
    """
    if not url:
        return None
    try:
        request = urllib.request.Request(
            str(url),
            headers={'User-Agent': 'ShopEase-ERP/1.0'},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            raw = response.read(3 * 1024 * 1024)
        image = PILImage.open(BytesIO(raw)).convert('RGBA')
        output = BytesIO()
        image.save(output, format='PNG', optimize=True)
        return output.getvalue()
    except Exception:
        return None


def _format_report_money(value):
    """Consistent Indian-style report currency without relying on the ₹ glyph."""
    if value in (None, ''):
        return ''
    try:
        amount = Decimal(str(value).replace(',', '').replace('Rs.', '').strip())
        return f'Rs.{amount:,.2f}'
    except Exception:
        return str(value)


def _export_report_xlsx(
    title,
    headers,
    rows,
    filename,
    summary_rows=None,
    request_user=None,
):
    """
    Branded Excel report exporter.

    - Uses the business shop logo from the `shop_logo` setting.
    - Uses the same Indigo/Teal visual identity as PDF reports.
    - Keeps report data/API behavior unchanged.
    """
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = title[:31]

    # Business identity
    profile = _get_report_business_profile(request_user)
    logo_bytes = _download_report_logo(profile['shop_logo'])

    # Theme
    INDIGO = '1E3A8A'
    INDIGO_2 = '2563EB'
    TEAL = '0F766E'
    LIGHT_INDIGO = 'EEF4FF'
    LIGHT_TEAL = 'ECFDF5'
    BORDER = 'CBD5E1'
    TEXT = '1F2937'
    MUTED = '64748B'
    WHITE = 'FFFFFF'
    ALT = 'F8FAFC'

    max_cols = max(len(headers or []), 4)
    last_col = max_cols

    # Business header
    sheet.merge_cells(start_row=1, start_column=2, end_row=1, end_column=last_col)
    title_cell = sheet.cell(row=1, column=2, value=profile['shop_name'].upper())
    title_cell.font = Font(name='Calibri', bold=True, size=18, color=WHITE)
    title_cell.fill = PatternFill('solid', fgColor=INDIGO)
    title_cell.alignment = Alignment(horizontal='left', vertical='center')

    if logo_bytes:
        try:
            logo = XLImage(BytesIO(logo_bytes))
            max_w, max_h = 58, 42
            ratio = min(max_w / logo.width, max_h / logo.height)
            logo.width = max(1, int(logo.width * ratio))
            logo.height = max(1, int(logo.height * ratio))
            sheet.add_image(logo, 'A1')
        except Exception:
            pass

    sheet.row_dimensions[1].height = 45

    # Business contact line
    contact = ' | '.join(
        part for part in [
            profile['shop_address'],
            f"Phone: {profile['shop_phone']}" if profile['shop_phone'] else '',
            f"Email: {profile['shop_email']}" if profile['shop_email'] else '',
            f"GSTIN: {profile['shop_gstin']}" if profile['shop_gstin'] else '',
        ] if part
    )
    sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=last_col)
    meta = sheet.cell(row=2, column=1, value=contact or profile['shop_name'])
    meta.font = Font(name='Calibri', size=9, color=MUTED)
    meta.fill = PatternFill('solid', fgColor=LIGHT_INDIGO)
    meta.alignment = Alignment(horizontal='left', vertical='center')
    sheet.row_dimensions[2].height = 21

    # Report title + generated time
    sheet.merge_cells(start_row=3, start_column=1, end_row=3, end_column=last_col)
    report_title = sheet.cell(row=3, column=1, value=title.upper())
    report_title.font = Font(name='Calibri', bold=True, size=14, color=INDIGO)
    report_title.alignment = Alignment(horizontal='left', vertical='center')

    sheet.merge_cells(start_row=4, start_column=1, end_row=4, end_column=last_col)
    generated_cell = sheet.cell(
        row=4,
        column=1,
        value=f"Generated: {timezone.localtime(timezone.now()).strftime('%d-%m-%Y %I:%M %p')}",
    )
    generated_cell.font = Font(name='Calibri', italic=True, size=9, color=MUTED)
    generated_cell.alignment = Alignment(horizontal='left', vertical='center')
    sheet.row_dimensions[4].height = 19

    row_index = 6

    # KPI / summary block
    if summary_rows:
        summary_count = len(summary_rows)
        cards_per_row = min(4, max(1, last_col))
        for offset in range(0, summary_count, cards_per_row):
            group = summary_rows[offset:offset + cards_per_row]
            group_width = max(1, last_col // len(group))
            for i, (label, value) in enumerate(group):
                col = 1 + i * group_width
                end_col = last_col if i == len(group) - 1 else min(last_col, col + group_width - 1)

                sheet.merge_cells(
                    start_row=row_index,
                    start_column=col,
                    end_row=row_index,
                    end_column=end_col,
                )
                label_cell = sheet.cell(row=row_index, column=col, value=str(label).upper())
                label_cell.font = Font(bold=True, size=8, color=MUTED)
                label_cell.fill = PatternFill('solid', fgColor=LIGHT_INDIGO)
                label_cell.alignment = Alignment(horizontal='left', vertical='center')

                sheet.merge_cells(
                    start_row=row_index + 1,
                    start_column=col,
                    end_row=row_index + 1,
                    end_column=end_col,
                )
                value_cell = sheet.cell(
                    row=row_index + 1,
                    column=col,
                    value=_format_report_money(value),
                )
                value_cell.font = Font(bold=True, size=12, color=INDIGO)
                value_cell.fill = PatternFill('solid', fgColor=WHITE)
                value_cell.alignment = Alignment(horizontal='left', vertical='center')

                for rr in (row_index, row_index + 1):
                    for cc in range(col, end_col + 1):
                        sheet.cell(row=rr, column=cc).border = Border(
                            left=Side(style='thin', color=BORDER),
                            right=Side(style='thin', color=BORDER),
                            top=Side(style='thin', color=BORDER),
                            bottom=Side(style='thin', color=BORDER),
                        )
            row_index += 3

    # Report table
    header_row = row_index
    for col_index, header in enumerate(headers or [], 1):
        cell = sheet.cell(row=header_row, column=col_index, value=header)
        cell.font = Font(bold=True, size=10, color=WHITE)
        cell.fill = PatternFill('solid', fgColor=INDIGO)
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = Border(
            left=Side(style='thin', color=WHITE),
            right=Side(style='thin', color=WHITE),
            top=Side(style='thin', color=WHITE),
            bottom=Side(style='thin', color=WHITE),
        )
    sheet.row_dimensions[header_row].height = 25
    row_index += 1

    currency_keywords = (
        'amount', 'revenue', 'cost', 'profit', 'total', 'sales', 'discount',
        'tax', 'gst', 'outstanding', 'credit', 'expense', 'payment', 'price',
        'value', 'collection', 'returns', 'net', 'balance', 'paid', 'due',
    )

    for data_index, row in enumerate(rows or []):
        for col_index, value in enumerate(row, 1):
            header_name = str(headers[col_index - 1]).lower() if col_index <= len(headers) else ''
            display = (
                _format_report_money(value)
                if any(keyword in header_name for keyword in currency_keywords)
                else _report_value(value)
            )
            cell = sheet.cell(row=row_index, column=col_index, value=display)
            cell.font = Font(name='Calibri', size=10, color=TEXT)
            cell.alignment = Alignment(
                horizontal='left' if col_index == 1 else 'right',
                vertical='center',
                wrap_text=True,
            )
            if data_index % 2 == 1:
                cell.fill = PatternFill('solid', fgColor=ALT)
            cell.border = Border(bottom=Side(style='hair', color=BORDER))
        sheet.row_dimensions[row_index].height = 21
        row_index += 1

    # Empty state
    if not rows:
        sheet.cell(row=row_index, column=1, value='No records found for this report.')
        sheet.cell(row=row_index, column=1).font = Font(italic=True, color=MUTED)
        row_index += 1

    sheet.freeze_panes = f'A{header_row + 1}'
    if headers:
        sheet.auto_filter.ref = (
            f"A{header_row}:{sheet.cell(row=max(header_row, row_index - 1), column=last_col).coordinate}"
        )

    sheet.sheet_view.showGridLines = False
    sheet.page_setup.orientation = 'landscape' if len(headers or []) >= 5 else 'portrait'
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.print_title_rows = f'{header_row}:{header_row}'
    sheet.page_margins.left = 0.3
    sheet.page_margins.right = 0.3
    sheet.page_margins.top = 0.4
    sheet.page_margins.bottom = 0.5

    for col_index in range(1, last_col + 1):
        values = [
            _report_value(sheet.cell(row=r, column=col_index).value)
            for r in range(header_row, row_index)
        ]
        width = max([len(v) for v in values if v] + [12])
        width = min(max(width + 3, 12), 34 if col_index == 1 else 24)
        sheet.column_dimensions[get_column_letter(col_index)].width = width

    buffer = BytesIO()
    workbook.save(buffer)
    return _report_response(
        filename,
        buffer.getvalue(),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )



def _export_report_pdf(
    title,
    headers,
    rows,
    filename,
    summary_rows=None,
    request_user=None,
):
    """Simple business report PDF with optional shop logo and clean table layout."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors as rl_colors
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
    from xml.sax.saxutils import escape as xml_escape

    profile = _get_report_business_profile(request_user)

    def plain_text(value):
        if value is None:
            return ''
        text = str(value)
        replacements = {
            '₹': 'Rs.', '₨': 'Rs.', '•': '-', '·': '-', '–': '-',
            '—': '-', '−': '-', '“': '"', '”': '"', '‘': "'",
            '’': "'", '…': '...', '\u00a0': ' ', '\n': ' ', '\r': ' ', '\t': ' ',
        }
        for old, new in replacements.items():
            text = text.replace(old, new)
        return text.encode('latin-1', errors='replace').decode('latin-1')

    def safe_text(value):
        return xml_escape(plain_text(value))

    def money_text(value):
        return plain_text(_format_report_money(value))

    def is_money_header(header):
        name = str(header or '').lower()
        keywords = (
            'amount', 'revenue', 'cost', 'profit', 'total', 'sales', 'discount',
            'tax', 'gst', 'outstanding', 'credit', 'expense', 'payment', 'price',
            'value', 'collection', 'returns', 'return', 'net', 'balance', 'paid', 'due',
            'purchase', 'mrp', 'subtotal', 'round off',
        )
        return any(k in name for k in keywords)

    title_plain = plain_text(title) or 'Report'
    shop_name = plain_text(profile.get('shop_name') or 'ShopEase POS')
    generated_at = timezone.localtime(timezone.now()).strftime('%d %b %Y, %I:%M %p')

    headers = list(headers or [])
    normalized_rows = []
    for row in rows or []:
        row = list(row or [])
        if len(row) < len(headers):
            row.extend([''] * (len(headers) - len(row)))
        normalized_rows.append(row[:len(headers)])

    if not headers:
        headers = ['Message']
        normalized_rows = [['No report data available.']]

    column_count = len(headers)
    landscape_report = column_count >= 6
    page_size = landscape(A4) if landscape_report else A4
    page_width, page_height = page_size

    left_margin = 12 * mm
    right_margin = 12 * mm
    top_margin = 10 * mm
    bottom_margin = 17 * mm
    body_width = page_width - left_margin - right_margin

    INDIGO = rl_colors.HexColor('#1E3A8A')
    TEAL = rl_colors.HexColor('#0F766E')
    DARK = rl_colors.HexColor('#1F2937')
    MUTED = rl_colors.HexColor('#64748B')
    BORDER = rl_colors.HexColor('#CBD5E1')
    LIGHT = rl_colors.HexColor('#EEF4FF')
    ALT = rl_colors.HexColor('#F8FAFC')
    WHITE = rl_colors.white

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=left_margin,
        rightMargin=right_margin,
        topMargin=top_margin,
        bottomMargin=bottom_margin,
        title=title_plain,
        author=shop_name,
    )

    styles = {
        'shop': ParagraphStyle('simple_shop', fontName='Helvetica-Bold', fontSize=14, leading=16, textColor=INDIGO, alignment=TA_LEFT),
        'meta': ParagraphStyle('simple_meta', fontName='Helvetica', fontSize=7.5, leading=9, textColor=MUTED, alignment=TA_LEFT),
        'title': ParagraphStyle('simple_title', fontName='Helvetica-Bold', fontSize=15, leading=17, textColor=INDIGO, alignment=TA_RIGHT),
        'date': ParagraphStyle('simple_date', fontName='Helvetica', fontSize=7, leading=9, textColor=MUTED, alignment=TA_RIGHT),
        'header': ParagraphStyle('simple_header', fontName='Helvetica-Bold', fontSize=7, leading=8.5, textColor=WHITE, alignment=TA_LEFT),
        'left': ParagraphStyle('simple_left', fontName='Helvetica', fontSize=7.2, leading=8.8, textColor=DARK, alignment=TA_LEFT),
        'right': ParagraphStyle('simple_right', fontName='Helvetica', fontSize=7.2, leading=8.8, textColor=DARK, alignment=TA_RIGHT),
        'kpi_label': ParagraphStyle('simple_kpi_label', fontName='Helvetica-Bold', fontSize=6.5, leading=7.5, textColor=MUTED, alignment=TA_LEFT),
        'kpi_value': ParagraphStyle('simple_kpi_value', fontName='Helvetica-Bold', fontSize=10, leading=12, textColor=INDIGO, alignment=TA_LEFT),
        'empty': ParagraphStyle('simple_empty', fontName='Helvetica', fontSize=8, leading=10, textColor=MUTED, alignment=TA_CENTER),
    }

    story = []

    # ---------------------------------------------------------
    # Simple header: LOGO | BUSINESS | REPORT TITLE
    # ---------------------------------------------------------
    logo_cell = ''
    logo_bytes = _download_report_logo(profile.get('shop_logo'))
    if logo_bytes:
        try:
            logo_stream = BytesIO(logo_bytes)
            logo = RLImage(logo_stream)
            max_logo_w = 22 * mm
            max_logo_h = 18 * mm
            scale = min(max_logo_w / float(logo.imageWidth), max_logo_h / float(logo.imageHeight), 1)
            logo.drawWidth = logo.imageWidth * scale
            logo.drawHeight = logo.imageHeight * scale
            logo_cell = logo
        except Exception:
            logo_cell = ''

    contact = []
    if profile.get('shop_address'):
        contact.append(plain_text(profile['shop_address']))
    if profile.get('shop_phone'):
        contact.append(f"Phone: {plain_text(profile['shop_phone'])}")
    if profile.get('shop_email'):
        contact.append(f"Email: {plain_text(profile['shop_email'])}")
    if profile.get('shop_gstin'):
        contact.append(f"GSTIN: {plain_text(profile['shop_gstin'])}")

    business_block = [Paragraph(safe_text(shop_name), styles['shop'])]
    if contact:
        business_block.append(Paragraph(safe_text(' | '.join(contact)), styles['meta']))

    report_block = [
        Paragraph(safe_text(title_plain.upper()), styles['title']),
        Spacer(1, 1 * mm),
        Paragraph(safe_text(generated_at), styles['date']),
    ]

    header = Table(
        [[logo_cell, business_block, report_block]],
        colWidths=[24 * mm, body_width * 0.53, body_width * 0.47 - 24 * mm],
        hAlign='LEFT',
    )
    header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header)
    story.append(Spacer(1, 2.5 * mm))

    accent = Table([['']], colWidths=[body_width], rowHeights=[1.2 * mm])
    accent.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), INDIGO),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(accent)
    story.append(Spacer(1, 3 * mm))

    # ---------------------------------------------------------
    # Small summary line instead of large modern cards
    # ---------------------------------------------------------
    if summary_rows:
        summary = []
        for item in summary_rows:
            try:
                label, value = item
                summary.append(f"{plain_text(label)}: {money_text(value)}")
            except Exception:
                continue
        if summary:
            summary_table = Table(
                [[Paragraph(safe_text('  |  '.join(summary)), styles['meta'])]],
                colWidths=[body_width],
            )
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), LIGHT),
                ('BOX', (0, 0), (-1, -1), 0.4, BORDER),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(summary_table)
            story.append(Spacer(1, 3 * mm))

    # ---------------------------------------------------------
    # Main report table
    # ---------------------------------------------------------
    table_data = [[Paragraph(safe_text(h), styles['header']) for h in headers]]
    for row in normalized_rows:
        rendered = []
        for i, value in enumerate(row):
            display = money_text(value) if is_money_header(headers[i]) else plain_text(value)
            rendered.append(Paragraph(safe_text(display), styles['right'] if i > 0 and is_money_header(headers[i]) else styles['left']))
        table_data.append(rendered)

    if not normalized_rows:
        empty = [Paragraph('', styles['left']) for _ in headers]
        empty[0] = Paragraph('No records found for this report.', styles['empty'])
        table_data.append(empty)

    count = len(headers)
    if count == 1:
        widths = [body_width]
    elif count == 2:
        widths = [body_width * .58, body_width * .42]
    elif count == 3:
        widths = [body_width * .40, body_width * .30, body_width * .30]
    elif count == 4:
        widths = [body_width * .30, body_width * .23, body_width * .23, body_width * .24]
    elif count == 5:
        widths = [body_width * .26, body_width * .18, body_width * .18, body_width * .19, body_width * .19]
    else:
        first = body_width * .22
        rest = (body_width - first) / (count - 1)
        widths = [first] + [rest] * (count - 1)

    report_table = Table(table_data, colWidths=widths, repeatRows=1, splitByRow=1, hAlign='LEFT')
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), INDIGO),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('BOX', (0, 0), (-1, -1), .45, BORDER),
        ('LINEBELOW', (0, 0), (-1, 0), .7, INDIGO),
        ('LINEBELOW', (0, 1), (-1, -1), .25, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    for r in range(1, len(table_data)):
        if r % 2 == 0:
            table_style.append(('BACKGROUND', (0, r), (-1, r), ALT))
    report_table.setStyle(TableStyle(table_style))
    story.append(report_table)

    # ---------------------------------------------------------
    # Footer
    # ---------------------------------------------------------
    footer_shop = shop_name[:120]
    footer_phone = plain_text(profile.get('shop_phone')) if profile.get('shop_phone') else ''

    def draw_footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(.45)
        canvas.line(left_margin, 10 * mm, page_width - right_margin, 10 * mm)
        footer = footer_shop
        if footer_phone:
            footer += f' | {footer_phone}'
        canvas.setFillColor(MUTED)
        canvas.setFont('Helvetica', 6.5)
        canvas.drawString(left_margin, 6.2 * mm, footer[:170])
        canvas.setFillColor(INDIGO)
        canvas.setFont('Helvetica-Bold', 6.5)
        canvas.drawRightString(page_width - right_margin, 6.2 * mm, f'Page {document.page}')
        canvas.restoreState()

    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    buffer.seek(0)
    return _report_response(filename, buffer.getvalue(), 'application/pdf')


class LoginView(APIView):
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if not user or not user.is_active:
            audit_event(
                request,
                'LOGIN_FAILED',
                'User',
                entity_name=str(username or 'anonymous'),
                after={'attempted_username': username},
                reason='Invalid credentials or inactive account',
                result='failure',
            )
            return Response({'error': 'Invalid username or password.', 'code': 'invalid_credentials'}, status=401)
        refresh = RefreshToken.for_user(user)
        audit_event(
            request,
            'USER_LOGIN',
            'User',
            entity_id=user.id,
            entity_name=user.username,
            after={'role': user.role, 'email': user.email},
            reason='Successful user authentication',
            result='success',
            user=user,
            business=getattr(user, 'business', None),
        )
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class SuperAdminLoginView(APIView):
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if not user or not user.is_active or not user.is_superuser:
            return Response({'error': 'Invalid super admin credentials'}, status=400)
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {'id': user.id, 'username': user.username, 'is_superuser': True},
        })


class SuperAdminDashboardView(APIView):
    def get(self, request):
        if not request.user.is_superuser:
            return Response({'error': 'Forbidden'}, status=403)
        businesses = Business.objects.annotate(
            user_count=Count('members', distinct=True),
            invoice_count=Count('invoice', distinct=True),
            total_revenue=Sum('invoice__grand_total'),
        ).values(
            'id', 'name', 'owner_name', 'mobile', 'email',
            'business_type', 'created_at', 'user_count', 'invoice_count', 'total_revenue'
        ).order_by('-created_at')
        return Response({
            'total_businesses': Business.objects.count(),
            'total_users': User.objects.count(),
            'total_invoices': Invoice.objects.count(),
            'total_revenue': Invoice.objects.aggregate(t=Sum('grand_total'))['t'] or 0,
            'businesses': list(businesses),
        })


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        profile_data = request.data.copy()
        for field in ('role', 'is_active', 'business', 'is_verified'):
            profile_data.pop(field, None)
        serializer = UserSerializer(request.user, data=profile_data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    def post(self, request):
        current = request.data.get('current_password', '')
        new_pwd = request.data.get('new_password', '')
        if not request.user.check_password(current):
            return Response({'detail': 'Current password is incorrect.'}, status=400)
        if len(new_pwd) < 6:
            return Response({'detail': 'Password must be at least 6 characters.'}, status=400)
        request.user.set_password(new_pwd)
        request.user.save()
        return Response({'status': 'changed'})


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']

    def get_queryset(self):
        return User.objects.filter(business=self.request.user.business)

    def perform_create(self, serializer):
        user = serializer.save(business=self.request.user.business)
        audit_event(
            self.request,
            'USER_CREATED',
            'User',
            user.id,
            entity_name=user.username,
            after={'username': user.username, 'role': user.role, 'email': user.email},
            reason=self.request.data.get('reason', 'User created by administrator'),
        )

    def perform_update(self, serializer):
        old_inst = serializer.instance
        old_role = old_inst.role
        old_active = old_inst.is_active
        user = serializer.save(business=self.request.user.business)
        reason = self.request.data.get('reason', 'User account updated')
        if old_role != user.role or old_active != user.is_active:
            audit_event(
                self.request,
                'USER_PERMISSIONS_CHANGED',
                'User',
                user.id,
                entity_name=user.username,
                before={'role': old_role, 'is_active': old_active},
                after={'role': user.role, 'is_active': user.is_active},
                reason=reason or 'User role or active status changed by admin',
            )
        else:
            audit_event(
                self.request,
                'USER_UPDATED',
                'User',
                user.id,
                entity_name=user.username,
                after={'username': user.username, 'role': user.role, 'email': user.email},
                reason=reason,
            )


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsManagerOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def get_queryset(self):
        return Category.objects.filter(business=self.request.user.business)

    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business)


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsManagerOrReadOnly]
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'phone', 'email']

    def get_queryset(self):
        return Supplier.objects.filter(business=self.request.user.business)

    def perform_create(self, serializer):
        supplier = serializer.save(business=self.request.user.business)
        audit_event(
            self.request,
            'SUPPLIER_CREATED',
            'Supplier',
            supplier.id,
            entity_name=supplier.name,
            after={'name': supplier.name, 'phone': supplier.phone, 'gstin': supplier.gstin},
            reason=self.request.data.get('reason', 'Supplier created'),
        )

    def perform_update(self, serializer):
        old_inst = serializer.instance
        before = {'name': old_inst.name, 'phone': old_inst.phone, 'gstin': old_inst.gstin}
        supplier = serializer.save(business=self.request.user.business)
        after = {'name': supplier.name, 'phone': supplier.phone, 'gstin': supplier.gstin}
        reason = self.request.data.get('reason', 'Supplier details updated')
        audit_event(
            self.request,
            'SUPPLIER_UPDATED',
            'Supplier',
            supplier.id,
            entity_name=supplier.name,
            before=before,
            after=after,
            reason=reason,
        )


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsManagerOrReadOnly]
    pagination_class = NoPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'status', 'supplier']
    search_fields = ['name', 'sku', 'barcode', 'brand']
    ordering_fields = ['name', 'selling_price', 'current_stock', 'created_at']

    def get_queryset(self):
        return Product.objects.select_related('category', 'supplier').filter(
            business=self.request.user.business
        )

    def perform_create(self, serializer):
        product = serializer.save(business=self.request.user.business)
        audit_event(
            self.request,
            'PRODUCT_CREATED',
            'Product',
            product.id,
            entity_name=product.name,
            after={'name': product.name, 'sku': product.sku, 'selling_price': float(product.selling_price)},
            reason=self.request.data.get('reason', 'New product created'),
        )

    def perform_update(self, serializer):
        old_inst = serializer.instance
        before_price = {
            'purchase_price': float(old_inst.purchase_price or 0),
            'selling_price': float(old_inst.selling_price or 0),
            'mrp': float(old_inst.mrp or 0),
        }
        previous = f'{old_inst.purchase_price}|{old_inst.selling_price}|{old_inst.gst_percent}'
        product = serializer.save(business=self.request.user.business)
        current = f'{product.purchase_price}|{product.selling_price}|{product.gst_percent}'
        after_price = {
            'purchase_price': float(product.purchase_price or 0),
            'selling_price': float(product.selling_price or 0),
            'mrp': float(product.mrp or 0),
        }

        reason = self.request.data.get('reason', '').strip()
        if (before_price['selling_price'] != after_price['selling_price'] or
                before_price['purchase_price'] != after_price['purchase_price'] or
                before_price['mrp'] != after_price['mrp']):
            audit_event(
                self.request,
                'PRICE_CHANGED',
                'Product',
                product.id,
                entity_name=product.name,
                before=before_price,
                after=after_price,
                reason=reason or 'Product price changed',
            )

        audit_event(
            self.request,
            'PRODUCT_UPDATED',
            'Product',
            product.id,
            entity_name=product.name,
            before=previous,
            after=current,
            reason=reason or 'Product updated',
        )

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ('owner', 'admin', 'manager'):
            return Response({'error': 'Permission denied'}, status=403)
        product = self.get_object()
        previous = product.status
        product.status = 'inactive'
        product.save(update_fields=['status', 'updated_at'])
        reason = request.data.get('reason', 'Product moved to recycle bin / archived')
        audit_event(
            self.request,
            'PRODUCT_ARCHIVED',
            'Product',
            product.id,
            entity_name=product.name,
            before={'status': previous},
            after={'status': product.status},
            reason=reason,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsCashierOrAdmin]
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'mobile', 'email']

    def get_queryset(self):
        return Customer.objects.filter(business=self.request.user.business)

    def perform_create(self, serializer):
        customer = serializer.save(business=self.request.user.business)
        audit_event(
            self.request,
            'CUSTOMER_CREATED',
            'Customer',
            customer.id,
            entity_name=customer.name,
            after={'name': customer.name, 'mobile': customer.mobile, 'credit_limit': float(customer.credit_limit or 0)},
            reason=self.request.data.get('reason', 'Customer record created'),
        )

    def perform_update(self, serializer):
        old_inst = serializer.instance
        before = {
            'name': old_inst.name,
            'mobile': old_inst.mobile,
            'credit_limit': float(old_inst.credit_limit or 0),
        }
        customer = serializer.save(business=self.request.user.business)
        after = {
            'name': customer.name,
            'mobile': customer.mobile,
            'credit_limit': float(customer.credit_limit or 0),
        }
        reason = self.request.data.get('reason', 'Customer details updated')
        audit_event(
            self.request,
            'CUSTOMER_UPDATED',
            'Customer',
            customer.id,
            entity_name=customer.name,
            before=before,
            after=after,
            reason=reason,
        )

    @action(detail=True, methods=['get'])
    def bills(self, request, pk=None):
        customer = self.get_object()
        invoices = Invoice.objects.filter(customer=customer).order_by('-created_at')[:20]
        return Response(InvoiceSerializer(invoices, many=True).data)

    @action(detail=True, methods=['post'], url_path='send-reminder')
    def send_reminder(self, request, pk=None):
        customer = self.get_object()
        channel = request.data.get('channel', 'sms')  # sms | whatsapp
        if not customer.mobile:
            return Response({'error': 'Customer has no mobile number'}, status=400)

        from decouple import config as env
        sid = env('TWILIO_ACCOUNT_SID', default='')
        token = env('TWILIO_AUTH_TOKEN', default='')
        if not sid or not token:
            return Response({'error': 'Twilio credentials not configured in .env'}, status=503)

        shop_name = (Setting.objects.filter(key='shop_name').first() or type('', (), {'value': 'ShopEase POS'})()).value
        amount = float(customer.outstanding_amount)
        body = (
            f"Dear {customer.name}, you have an outstanding balance of "
            f"\u20b9{amount:,.2f} at {shop_name}. "
            f"Please clear your dues at your earliest convenience. Thank you!"
        )

        to_number = customer.mobile if customer.mobile.startswith('+') else f'+91{customer.mobile}'
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            if channel == 'whatsapp':
                from_num = env('TWILIO_WHATSAPP_FROM', default='whatsapp:+14155238886')
                msg = client.messages.create(body=body, from_=from_num, to=f'whatsapp:{to_number}')
            else:
                from_num = env('TWILIO_FROM_NUMBER', default='')
                msg = client.messages.create(body=body, from_=from_num, to=to_number)
            return Response({'status': 'sent', 'sid': msg.sid, 'channel': channel})
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class PurchaseViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseSerializer
    permission_classes = [IsManagerOrReadOnly]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['supplier', 'payment_status']
    search_fields = ['invoice_number']

    def get_queryset(self):
        return Purchase.objects.select_related('supplier').prefetch_related('items').filter(
            business=self.request.user.business
        )

    def perform_create(self, serializer):
        purchase = serializer.save(created_by=self.request.user, business=self.request.user.business)
        audit_event(self.request, 'PURCHASE_CREATED', 'Purchase', purchase.id, after={'total_amount': purchase.total_amount})

    def update(self, request, *args, **kwargs):
        return Response({'detail': 'Purchases are immutable after creation.'}, status=405)

    def destroy(self, request, *args, **kwargs):
        return Response({
            'detail': 'Financial transactions cannot be permanently deleted. Use a purchase return for reversal.',
            'error': 'financial_document_deletion_forbidden',
        }, status=405)


class InvoiceViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['payment_status', 'status', 'payment_method']
    search_fields = ['invoice_number', 'customer_name', 'customer__name']
    ordering_fields = ['created_at', 'grand_total']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return InvoiceCreateSerializer
        return InvoiceSerializer

    def get_permissions(self):
        if self.action in ['destroy']:
            return [IsAdmin()]
        return [IsCashierOrAdmin()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, business=self.request.user.business)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        response_serializer = InvoiceSerializer(serializer.instance, context=self.get_serializer_context())
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if request.user.role not in ('owner', 'admin', 'manager'):
            return Response({'detail': 'Only managers or admins can edit invoices.', 'error': 'permission_denied'}, status=403)
        invoice = self.get_object()
        if invoice.status in ('cancelled', 'refunded'):
            return Response({'detail': 'Cancelled or refunded invoices cannot be modified.', 'error': 'invoice_immutable'}, status=400)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({
                'detail': 'A reason is required to edit an invoice for statutory audit compliance.',
                'error': 'reason_required',
            }, status=400)

        before = {
            'discount_amount': float(invoice.discount_amount),
            'grand_total': float(invoice.grand_total),
            'notes': invoice.notes or '',
            'place_of_supply': invoice.place_of_supply or '',
        }

        fields_to_update = []
        if 'discount_amount' in request.data:
            try:
                new_discount = Decimal(str(request.data['discount_amount']))
                if new_discount < 0:
                    return Response({'detail': 'Discount cannot be negative.'}, status=400)
                old_total = invoice.grand_total
                invoice.discount_amount = new_discount
                invoice.grand_total = max(Decimal('0'), invoice.subtotal - invoice.discount_amount + invoice.tax_amount)
                diff = invoice.grand_total - old_total
                invoice.balance_due = max(Decimal('0'), invoice.balance_due + diff)
                if invoice.balance_due <= 0:
                    invoice.payment_status = 'paid'
                elif invoice.balance_due < invoice.grand_total:
                    invoice.payment_status = 'partial'
                else:
                    invoice.payment_status = 'pending'
                fields_to_update.extend(['discount_amount', 'grand_total', 'balance_due', 'payment_status'])
            except (ValueError, TypeError):
                return Response({'detail': 'Invalid discount value.'}, status=400)

        if 'notes' in request.data:
            invoice.notes = str(request.data['notes'])
            fields_to_update.append('notes')

        if 'place_of_supply' in request.data:
            invoice.place_of_supply = str(request.data['place_of_supply'])
            fields_to_update.append('place_of_supply')

        if fields_to_update:
            invoice.save(update_fields=list(set(fields_to_update)))
        else:
            invoice.save()

        after = {
            'discount_amount': float(invoice.discount_amount),
            'grand_total': float(invoice.grand_total),
            'notes': invoice.notes or '',
            'place_of_supply': invoice.place_of_supply,
        }

        audit_event(
            request,
            'INVOICE_EDITED',
            'Invoice',
            invoice.id,
            entity_name=invoice.invoice_number,
            before=before,
            after=after,
            reason=reason,
        )

        return Response(InvoiceSerializer(invoice, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        return Response({
            'detail': 'Financial transactions cannot be permanently deleted. Use cancel or refund for invoice reversal.',
            'error': 'financial_document_deletion_forbidden',
        }, status=405)

    def get_queryset(self):
        qs = Invoice.objects.select_related('customer', 'created_by').prefetch_related(
            'items', 'payments'
        ).filter(business=self.request.user.business)
        user = self.request.user
        if user.role == 'cashier':
            qs = qs.filter(created_by=user)
        date_filter = self.request.query_params.get('date_filter')
        today = timezone.now().date()
        if date_filter == 'today':
            qs = qs.filter(created_at__date=today)
        elif date_filter == 'yesterday':
            qs = qs.filter(created_at__date=today - timedelta(days=1))
        elif date_filter == 'this_week':
            qs = qs.filter(created_at__date__gte=today - timedelta(days=7))
        elif date_filter == 'this_month':
            qs = qs.filter(created_at__year=today.year, created_at__month=today.month)
        start = self.request.query_params.get('start_date')
        end = self.request.query_params.get('end_date')
        if start:
            qs = qs.filter(created_at__date__gte=start)
        if end:
            qs = qs.filter(created_at__date__lte=end)
        return qs


class InventoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventoryTransactionSerializer
    permission_classes = [IsCashierOrAdmin]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['product', 'transaction_type']
    search_fields = ['product__name', 'reference']

    def get_queryset(self):
        return InventoryTransaction.objects.select_related('product', 'created_by').filter(
            business=self.request.user.business
        ).order_by('-created_at')


class SettingViewSet(viewsets.ModelViewSet):
    queryset = Setting.objects.all()
    serializer_class = SettingSerializer
    permission_classes = [IsManagerOrAbove]

    def get_queryset(self):
        return Setting.objects.filter(business=self.request.user.business)

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        previous = {
            setting.key: setting.value
            for setting in self.get_queryset().filter(key__in=request.data.keys())
        }

        # Synchronize core business profile fields to Business model
        biz = getattr(request.user, 'business', None)
        if biz:
            biz_map = {
                'shop_name': 'name',
                'shop_phone': 'mobile',
                'shop_email': 'email',
                'shop_address': 'address',
                'shop_gstin': 'gstin',
                'shop_pan': 'pan',
                'business_type': 'business_type',
                'currency': 'currency',
                'invoice_prefix': 'invoice_prefix',
            }
            changed_fields = []
            for s_key, b_field in biz_map.items():
                if s_key in request.data:
                    val = str(request.data[s_key] or '')
                    if getattr(biz, b_field, '') != val:
                        setattr(biz, b_field, val)
                        changed_fields.append(b_field)
            if 'invoice_start_number' in request.data:
                try:
                    start_num = int(request.data['invoice_start_number'])
                    if biz.invoice_start_number != start_num:
                        biz.invoice_start_number = start_num
                        changed_fields.append('invoice_start_number')
                except (ValueError, TypeError):
                    pass
            if changed_fields:
                biz.save()

        # Update Setting table key-values
        for key, value in request.data.items():
            if key in ('reason', '_reason'):
                continue
            Setting.objects.update_or_create(
                business=request.user.business,
                key=key,
                defaults={'value': str(value)},
            )

        # Synchronize place_of_supply and shop_state if either is updated
        pos_val = request.data.get('place_of_supply') or request.data.get('shop_state')
        if pos_val:
            Setting.objects.update_or_create(
                business=request.user.business,
                key='place_of_supply',
                defaults={'value': str(pos_val)},
            )
            Setting.objects.update_or_create(
                business=request.user.business,
                key='shop_state',
                defaults={'value': str(pos_val)},
            )

        reason = request.data.get('reason') or request.data.get('_reason') or 'Settings updated via settings panel'
        audit_event(
            request,
            'SETTINGS_CHANGED',
            'Setting',
            request.user.business_id,
            entity_name='Shop Settings',
            before=previous,
            after=request.data,
            reason=reason,
        )
        return Response({'status': 'updated'})

    @action(detail=False, methods=['post'], url_path='upload-logo')
    def upload_logo(self, request):
        """Store the shop logo in Supabase Storage and return its public URL."""
        logo = request.FILES.get('logo')
        if not logo:
            return Response({'detail': 'Choose a logo image first.'}, status=status.HTTP_400_BAD_REQUEST)
        if logo.size > 2 * 1024 * 1024:
            return Response({'detail': 'Logo must be smaller than 2 MB.'}, status=status.HTTP_400_BAD_REQUEST)
        if logo.content_type not in ('image/png', 'image/jpeg', 'image/webp'):
            return Response({'detail': 'Use a PNG, JPG, or WEBP logo image.'}, status=status.HTTP_400_BAD_REQUEST)
        biz_id = str(request.user.business_id or 'default')
        try:
            url = upload_shop_logo(logo, biz_id)
        except SupabaseStorageError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        Setting.objects.update_or_create(business=request.user.business, key='shop_logo', defaults={'value': url})
        audit_event(request, 'SETTINGS_CHANGED', 'Setting', request.user.business_id, entity_name='Shop Logo', after={'shop_logo': url}, reason='Shop logo uploaded')
        return Response({'url': url})

    @action(detail=False, methods=['post'], url_path='remove-logo')
    def remove_logo(self, request):
        Setting.objects.update_or_create(
            business=request.user.business,
            key='shop_logo',
            defaults={'value': ''},
        )
        audit_event(request, 'SETTINGS_CHANGED', 'Setting', request.user.business_id, entity_name='Shop Logo', after={'shop_logo': ''}, reason='Shop logo removed')
        return Response({'url': ''})

    @action(detail=False, methods=['get'], permission_classes=[IsCashierOrAdmin])
    def all(self, request):
        biz = getattr(request.user, 'business', None)
        defaults = {
            # Business
            'shop_name': biz.name if biz else '',
            'shop_address': biz.address if biz else '',
            'shop_phone': biz.mobile if biz else '',
            'shop_email': biz.email if biz else '',
            'shop_gstin': biz.gstin if biz else '',
            'shop_pan': biz.pan if biz else '',
            'shop_logo': '',
            'shop_state': '',
            'business_type': (biz.business_type if biz and biz.business_type else 'retail_wholesale'),
            'cin': '', 'fssai_licence': '',
            'fy_start': 'april',
            # Invoice
            'invoice_prefix': biz.invoice_prefix if biz else 'INV',
            'invoice_start_number': str(biz.invoice_start_number) if biz else '1001',
            'invoice_template': 'gst_a4', 'invoice_due_days': '15',
            'invoice_terms': '', 'invoice_footer': '',
            'show_discount_col': 'true', 'show_hsn_col': 'true',
            'show_sku_col': 'false', 'show_unit_col': 'false',
            'show_batch_col': 'false', 'show_expiry_col': 'false',
            'show_tax_cols': 'true', 'show_signature_area': 'false',
            'show_fssai_on_invoice': 'false', 'show_cin_on_invoice': 'false',
            'invoice_notes': '',
            'enable_invoice_qr': 'true',
            # Invoice display toggles
            'show_business_logo': 'true', 'show_business_address': 'true',
            'show_business_phone': 'true', 'show_business_email': 'true',
            'show_business_gstin': 'true', 'show_business_pan': 'true',
            'show_customer_phone': 'true', 'show_customer_address': 'true',
            'show_customer_gstin': 'true', 'show_place_of_supply': 'true',
            'show_amount_in_words': 'true', 'show_payment_summary': 'true',
            'show_payment_status': 'true', 'show_payment_mode': 'true',
            'show_balance_due': 'true', 'show_bank_details': 'true',
            'show_notes': 'true', 'show_terms': 'true', 'show_footer': 'true',
            # Invoice appearance
            'invoice_font': 'default', 'invoice_header_layout': 'logo_left',
            'invoice_footer_layout': 'text_center', 'invoice_paper_size': 'a4',
            'upi_qr_size_a4': 'medium', 'upi_qr_size_thermal': 'medium',
            # GST
            'gst_reg_type': 'regular', 'default_gst_rate': '18',
            'place_of_supply': '', 'tax_on_price': 'exclusive',
            'einvoice_enabled': 'false', 'hsn_summary_on_invoice': 'true',
            'reverse_charge': 'false', 'cess_enabled': 'false',
            # Payment
            'default_payment_method': 'cash', 'round_off': 'nearest',
            'credit_limit_alert': '', 'shop_upi_id': '',
            'shop_bank_details': '',
            # Legacy bank fields (kept for pdf_utils fallback)
            'shop_bank_name': '', 'shop_bank_branch': '',
            'shop_bank_account': '', 'shop_bank_ifsc': '',
            'show_upi_qr_on_invoice': 'true', 'show_upi_qr_on_thermal': 'true',
            'upi_qr_enabled': 'true', 'advance_payment_enabled': 'false',
            # Printer
            'printer_type': 'a4', 'default_printer': '', 'copies_per_bill': '1',
            'auto_print': 'no', 'receipt_footer': 'Thank you for shopping with us!',
            'open_cash_drawer': 'false', 'print_duplicate': 'false',
            # System
            'currency': biz.currency if biz else '₹',
            'allow_negative_stock': 'false',
            # Policies & Legal
            'terms_url': '', 'privacy_url': '', 'refund_url': '',
            'return_url': '', 'shipping_url': '',
        }
        saved = {s.key: s.value for s in self.get_queryset()}
        return Response({**defaults, **saved})
        merged = {**defaults, **saved}
        if merged.get('place_of_supply') and not merged.get('shop_state'):
            merged['shop_state'] = merged['place_of_supply']
        elif merged.get('shop_state') and not merged.get('place_of_supply'):
            merged['place_of_supply'] = merged['shop_state']
        return Response(merged)


class DashboardView(APIView):
    permission_classes = [IsCashierOrAdmin]
    def get(self, request):
        biz = request.user.business
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        month_start = today.replace(day=1)
        last_month_start = (month_start - timedelta(days=1)).replace(day=1)
        last_month_end = month_start - timedelta(days=1)
        week_start = today - timedelta(days=6)

        # --- Single aggregated query for today / yesterday / month / last-month ---
        inv_agg = Invoice.objects.filter(
            business=biz, status='completed'
        ).aggregate(
            today_sales=Sum('grand_total', filter=Q(created_at__date=today)),
            today_bills=Count('id', filter=Q(created_at__date=today)),
            today_discount=Sum('discount_amount', filter=Q(created_at__date=today)),
            today_tax=Sum('tax_amount', filter=Q(created_at__date=today)),
            yest_sales=Sum('grand_total', filter=Q(created_at__date=yesterday)),
            yest_bills=Count('id', filter=Q(created_at__date=yesterday)),
            month_sales=Sum('grand_total', filter=Q(created_at__date__gte=month_start)),
            month_bills=Count('id', filter=Q(created_at__date__gte=month_start)),
            month_discount=Sum('discount_amount', filter=Q(created_at__date__gte=month_start)),
            month_tax=Sum('tax_amount', filter=Q(created_at__date__gte=month_start)),
            last_month_sales=Sum('grand_total', filter=Q(
                created_at__date__gte=last_month_start,
                created_at__date__lte=last_month_end,
            )),
        )

        today_sales = inv_agg['today_sales'] or 0
        today_bills = inv_agg['today_bills'] or 0
        today_discount = inv_agg['today_discount'] or 0
        today_tax = inv_agg['today_tax'] or 0
        yesterday_sales = inv_agg['yest_sales'] or 0
        yesterday_bills = inv_agg['yest_bills'] or 0
        month_sales = inv_agg['month_sales'] or 0
        month_bills = inv_agg['month_bills'] or 0
        month_discount = inv_agg['month_discount'] or 0
        month_tax = inv_agg['month_tax'] or 0
        last_month_sales = inv_agg['last_month_sales'] or 0

        # --- Profit via DB (revenue excludes GST, minus COGS) ---
        def _profit_qs(date_filter):
            return InvoiceItem.objects.filter(
                invoice__business=biz, invoice__status='completed', **date_filter
            ).annotate(
                line_profit=(F('total') - F('gst_amount')) - F('quantity') * F('cost_price')
            ).aggregate(total=Sum('line_profit'))['total'] or 0

        today_profit = float(_profit_qs({'invoice__created_at__date': today}))
        yesterday_profit = float(_profit_qs({'invoice__created_at__date': yesterday}))
        month_profit = float(_profit_qs({'invoice__created_at__date__gte': month_start}))
        last_month_profit = float(_profit_qs({
            'invoice__created_at__date__gte': last_month_start,
            'invoice__created_at__date__lte': last_month_end,
        }))

        # --- Purchases today / month / last month ---
        purch_agg = Purchase.objects.filter(business=biz).aggregate(
            today_purchases=Sum('total_amount', filter=Q(purchase_date=today)),
            month_purchases=Sum('total_amount', filter=Q(purchase_date__gte=month_start)),
            last_month_purchases=Sum('total_amount', filter=Q(
                purchase_date__gte=last_month_start,
                purchase_date__lte=last_month_end,
            )),
        )
        today_purchases = float(purch_agg['today_purchases'] or 0)
        month_purchases = float(purch_agg['month_purchases'] or 0)
        last_month_purchases = float(purch_agg['last_month_purchases'] or 0)

        # --- Expenses today / month / last month ---
        exp_agg = Expense.objects.filter(business=biz).aggregate(
            today_expenses=Sum('amount', filter=Q(expense_date=today)),
            month_expenses=Sum('amount', filter=Q(expense_date__gte=month_start)),
            last_month_expenses=Sum('amount', filter=Q(
                expense_date__gte=last_month_start,
                expense_date__lte=last_month_end,
            )),
        )
        today_expenses = float(exp_agg['today_expenses'] or 0)
        month_expenses = float(exp_agg['month_expenses'] or 0)
        last_month_expenses = float(exp_agg['last_month_expenses'] or 0)

        # --- Payments / Collections today / month / last month ---
        pay_today_inv = Payment.objects.filter(invoice__business=biz, invoice__status='completed', created_at__date=today).aggregate(s=Sum('amount'))['s'] or 0
        pay_today_cust = CustomerPayment.objects.filter(business=biz, created_at__date=today).aggregate(s=Sum('amount'))['s'] or 0
        today_payments_total = float(pay_today_inv + pay_today_cust)

        pay_month_inv = Payment.objects.filter(invoice__business=biz, invoice__status='completed', created_at__date__gte=month_start).aggregate(s=Sum('amount'))['s'] or 0
        pay_month_cust = CustomerPayment.objects.filter(business=biz, created_at__date__gte=month_start).aggregate(s=Sum('amount'))['s'] or 0
        month_payments_total = float(pay_month_inv + pay_month_cust)

        pay_last_month_inv = Payment.objects.filter(invoice__business=biz, invoice__status='completed', created_at__date__gte=last_month_start, created_at__date__lte=last_month_end).aggregate(s=Sum('amount'))['s'] or 0
        pay_last_month_cust = CustomerPayment.objects.filter(business=biz, created_at__date__gte=last_month_start, created_at__date__lte=last_month_end).aggregate(s=Sum('amount'))['s'] or 0
        last_month_payments_total = float(pay_last_month_inv + pay_last_month_cust)

        # --- Inventory / customer counts (single queries) ---
        product_agg = Product.objects.filter(business=biz, status='active').aggregate(
            total=Count('id'),
            out_of_stock=Count('id', filter=Q(current_stock__lte=0)),
            low_stock=Count('id', filter=Q(current_stock__gt=0, current_stock__lte=F('minimum_stock'))),
        )
        total_products = product_agg['total'] or 0
        out_of_stock = product_agg['out_of_stock'] or 0
        low_stock_count = product_agg['low_stock'] or 0

        customer_agg = Customer.objects.filter(business=biz).aggregate(
            total=Count('id'),
            new_today=Count('id', filter=Q(created_at__date=today)),
            pending_credit=Sum('outstanding_amount'),
        )
        total_customers = customer_agg['total'] or 0
        new_customers_today = customer_agg['new_today'] or 0
        pending_credit = customer_agg['pending_credit'] or 0

        total_suppliers = Supplier.objects.filter(business=biz).count()
        pending_purchases = Purchase.objects.filter(business=biz, payment_status='pending').aggregate(
            total=Sum('total_amount'))['total'] or 0

        # --- 7-day sales + profit (2 queries instead of 14) ---
        daily_inv = (
            Invoice.objects.filter(business=biz, status='completed', created_at__date__gte=week_start)
            .values('created_at__date')
            .annotate(sales=Sum('grand_total'), bills=Count('id'))
        )
        daily_inv_map = {row['created_at__date']: row for row in daily_inv}

        daily_profit_qs = (
            InvoiceItem.objects.filter(
                invoice__business=biz, invoice__status='completed',
                invoice__created_at__date__gte=week_start,
            )
            .annotate(line_profit=(F('total') - F('gst_amount')) - F('quantity') * F('cost_price'))
            .values('invoice__created_at__date')
            .annotate(profit=Sum('line_profit'))
        )
        daily_profit_map = {row['invoice__created_at__date']: float(row['profit'] or 0) for row in daily_profit_qs}

        sales_7days = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            row = daily_inv_map.get(d, {})
            sales_7days.append({
                'date': str(d),
                'sales': float(row.get('sales') or 0),
                'profit': daily_profit_map.get(d, 0),
            })

        # --- Monthly sales (1 query instead of 12) ---
        six_months_ago = (month_start - timedelta(days=150)).replace(day=1)
        monthly_raw = (
            Invoice.objects.filter(business=biz, status='completed', created_at__date__gte=six_months_ago)
            .values('created_at__year', 'created_at__month')
            .annotate(total=Sum('grand_total'), bills=Count('id'))
            .order_by('created_at__year', 'created_at__month')
        )
        monthly_map = {(r['created_at__year'], r['created_at__month']): r for r in monthly_raw}
        monthly_sales = []
        for i in range(5, -1, -1):
            m = (month_start - timedelta(days=i * 30)).replace(day=1)
            row = monthly_map.get((m.year, m.month), {})
            monthly_sales.append({
                'month': m.strftime('%b %Y'),
                'total': float(row.get('total') or 0),
                'bills': row.get('bills') or 0,
            })

        top_products = list(InvoiceItem.objects.filter(
            invoice__business=biz, invoice__status='completed'
        ).values('product_name').annotate(
            total_qty=Sum('quantity'), total_revenue=Sum('total')
        ).order_by('-total_revenue')[:8])

        category_sales = list(InvoiceItem.objects.filter(
            invoice__business=biz,
            invoice__created_at__date__gte=month_start,
            invoice__status='completed',
            product__category__isnull=False
        ).values('product__category__name').annotate(
            total_revenue=Sum('total'), total_qty=Sum('quantity')
        ).order_by('-total_revenue')[:6])

        today_payments = Payment.objects.filter(
            invoice__business=biz,
            invoice__status='completed',
            created_at__date=today,
        ).values('method').annotate(total=Sum('amount'), count=Count('id'))
        today_customer_payments = CustomerPayment.objects.filter(
            business=biz,
            created_at__date=today,
        ).values('method').annotate(total=Sum('amount'), count=Count('id'))
        payment_totals = {}
        for row in list(today_payments) + list(today_customer_payments):
            entry = payment_totals.setdefault(row['method'], {'method': row['method'], 'total': Decimal('0'), 'count': 0})
            entry['total'] += row['total'] or Decimal('0')
            entry['count'] += row['count'] or 0
        payment_dist = list(payment_totals.values())
        today_collection = sum((row['total'] for row in payment_dist), Decimal('0'))

        top_customers = list(Invoice.objects.filter(
            business=biz,
            status='completed',
            customer__isnull=False,
        ).values('customer_id', 'customer__name').annotate(
            total=Sum('grand_total'), bills=Count('id')
        ).order_by('-total')[:5])
        unpaid_invoices = Invoice.objects.filter(
            business=biz,
            status='completed',
            payment_status__in=('pending', 'partial', 'credit'),
        ).count()
        pending_purchase_count = Purchase.objects.filter(
            business=biz,
            payment_status__in=('pending', 'partial'),
        ).count()
        credit_customer_count = Customer.objects.filter(
            business=biz,
            outstanding_amount__gt=0,
        ).count()
        action_required = [
            {
                'key': 'stock',
                'count': out_of_stock + low_stock_count,
                'label': 'products need restocking',
                'route': '/inventory/stock',
            },
            {
                'key': 'credit',
                'count': credit_customer_count,
                'label': 'customers have pending credit',
                'route': '/parties/customers?credit_due=1',
            },
            {
                'key': 'purchases',
                'count': pending_purchase_count,
                'label': 'purchases pending',
                'route': '/inventory/purchases',
            },
            {
                'key': 'invoices',
                'count': unpaid_invoices,
                'label': 'invoices unpaid',
                'route': '/sales/invoices?payment_status=credit',
            },
        ]

        # --- Hourly sales (1 query instead of 12) ---
        hourly_raw = (
            Invoice.objects.filter(business=biz, created_at__date=today, status='completed')
            .values('created_at__hour')
            .annotate(total=Sum('grand_total'))
        )
        hourly_map = {row['created_at__hour']: float(row['total'] or 0) for row in hourly_raw}
        hourly_sales = [
            {'hour': f'{h:02d}:00', 'total': hourly_map.get(h, 0) + hourly_map.get(h + 1, 0)}
            for h in range(0, 24, 2)
        ]

        low_stock_products = list(Product.objects.filter(
            business=biz, current_stock__lte=F('minimum_stock'), status='active'
        ).values('id', 'name', 'current_stock', 'minimum_stock', 'sku').order_by('current_stock')[:10])

        recent_bills = Invoice.objects.filter(business=biz, status='completed').order_by('-created_at')[:10]

        avg_bill_today = float(today_sales) / today_bills if today_bills else 0
        avg_bill_month = float(month_sales) / month_bills if month_bills else 0
        sales_growth = round(((float(month_sales) - float(last_month_sales)) / float(last_month_sales) * 100), 1) if last_month_sales else 0
        profit_margin = round((today_profit / float(today_sales) * 100), 1) if today_sales else 0

        return Response({
            'today_sales': float(today_sales),
            'today_bills': today_bills,
            'today_profit': today_profit,
            'today_collection': float(today_collection),
            'today_discount': float(today_discount),
            'today_tax': float(today_tax),
            'yesterday_sales': float(yesterday_sales),
            'yesterday_bills': yesterday_bills,
            'yesterday_profit': yesterday_profit,
            'month_sales': float(month_sales),
            'month_bills': month_bills,
            'month_profit': month_profit,
            'month_discount': float(month_discount),
            'month_tax': float(month_tax),
            'last_month_sales': float(last_month_sales),
            'last_month_profit': last_month_profit,
            'today_purchases': today_purchases,
            'month_purchases': month_purchases,
            'last_month_purchases': last_month_purchases,
            'today_expenses': today_expenses,
            'month_expenses': month_expenses,
            'last_month_expenses': last_month_expenses,
            'today_payments_total': today_payments_total,
            'month_payments_total': month_payments_total,
            'last_month_payments_total': last_month_payments_total,
            'total_products': total_products,
            'out_of_stock': out_of_stock,
            'low_stock_count': low_stock_count,
            'total_suppliers': total_suppliers,
            'pending_purchases': float(pending_purchases),
            'total_customers': total_customers,
            'new_customers_today': new_customers_today,
            'pending_credit': float(pending_credit),
            'avg_bill_today': avg_bill_today,
            'avg_bill_month': avg_bill_month,
            'sales_growth': sales_growth,
            'profit_margin': profit_margin,
            'sales_7days': sales_7days,
            'monthly_sales': monthly_sales,
            'hourly_sales': hourly_sales,
            'top_products': top_products,
            'category_sales': category_sales,
            'payment_distribution': payment_dist,
            'top_customers': top_customers,
            'action_required': action_required,
            'low_stock_products': low_stock_products,
            'recent_bills': InvoiceSerializer(recent_bills, many=True).data,
        })


class GlobalSearchView(APIView):
    permission_classes = [IsCashierOrAdmin]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response({'results': []})

        business = request.user.business
        contains = query[:100]
        results = []
        for product in Product.objects.filter(
            business=business,
            status='active',
        ).filter(
            Q(name__icontains=contains) | Q(sku__icontains=contains) | Q(barcode__icontains=contains)
        ).order_by('name')[:8]:
            results.append({
                'type': 'product',
                'id': product.id,
                'label': product.name,
                'subtitle': f'SKU {product.sku} · Stock {product.current_stock}',
                'route': f'/inventory/products?search={product.sku}',
            })

        for invoice in Invoice.objects.filter(
            business=business,
        ).filter(
            Q(invoice_number__icontains=contains) | Q(customer_name__icontains=contains)
        ).order_by('-created_at')[:8]:
            results.append({
                'type': 'invoice',
                'id': invoice.id,
                'label': invoice.invoice_number,
                'subtitle': f'{invoice.customer_name} · Rs.{invoice.grand_total}',
                'route': f'/sales/invoices?search={invoice.invoice_number}',
            })

        for customer in Customer.objects.filter(
            business=business,
        ).filter(
            Q(name__icontains=contains) | Q(mobile__icontains=contains) | Q(email__icontains=contains)
        ).order_by('name')[:8]:
            results.append({
                'type': 'customer',
                'id': customer.id,
                'label': customer.name,
                'subtitle': customer.mobile or customer.email or 'Customer',
                'route': f'/parties/customers?search={customer.name}',
            })

        for supplier in Supplier.objects.filter(
            business=business,
        ).filter(
            Q(name__icontains=contains) | Q(phone__icontains=contains) | Q(email__icontains=contains)
        ).order_by('name')[:8]:
            results.append({
                'type': 'supplier',
                'id': supplier.id,
                'label': supplier.name,
                'subtitle': supplier.phone or supplier.email or 'Supplier',
                'route': f'/parties/suppliers?search={supplier.name}',
            })

        return Response({'results': results[:20]})


def _serve_report(request, report_name):
    report = ReportService.build(report_name, request.user.business, request.query_params)
    report_format = request.query_params.get('export', '').lower()
    if report_format == 'pdf':
        return _export_report_pdf(
            report.title, report.headers, report.rows,
            f'{report.filename}.pdf', summary_rows=report.summary_rows,
            request_user=request.user,
        )
    if report_format == 'xlsx':
        return _export_report_xlsx(
            report.title, report.headers, report.rows,
            f'{report.filename}.xlsx',
            summary_rows=report.summary_rows,
            request_user=request.user,
        )
    return Response(report.payload)


class SalesReportView(APIView):
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        return _serve_report(request, 'sales')


class ProductReportView(APIView):
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        return _serve_report(request, 'products')


class ProfitReportView(APIView):
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        return _serve_report(request, 'profit')


class GSTReportView(APIView):
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        return _serve_report(request, 'gst')


class CustomerCreditReportView(APIView):
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        return _serve_report(request, 'customers')


class PaymentReportView(APIView):
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        return _serve_report(request, 'payments')


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsCashierOrAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def get_queryset(self):
        return ExpenseCategory.objects.filter(business=self.request.user.business)

    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business)


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsCashierOrAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['payment_method', 'category']
    search_fields = ['description', 'notes']
    ordering_fields = ['expense_date', 'amount', 'created_at']
    ordering = ['-expense_date']

    def get_queryset(self):
        return Expense.objects.select_related('category', 'created_by').filter(
            business=self.request.user.business
        )

    def perform_create(self, serializer):
        expense = serializer.save(business=self.request.user.business, created_by=self.request.user)
        audit_event(self.request, 'EXPENSE_CREATED', 'Expense', expense.id, after={'amount': expense.amount})

    def perform_update(self, serializer):
        serializer.save(business=self.request.user.business)


class SupplierPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierPaymentSerializer
    permission_classes = [IsCashierOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['supplier', 'method']

    def get_queryset(self):
        return SupplierPayment.objects.select_related('supplier').filter(
            business=self.request.user.business
        )

    def perform_create(self, serializer):
        from .services.payment_service import PaymentService
        payment = PaymentService.record_supplier_payment(
            attributes=serializer.validated_data,
            business=self.request.user.business,
            created_by=self.request.user,
        )
        serializer.instance = payment
        audit_event(self.request, 'PAYMENT_RECEIVED', 'SupplierPayment', payment.id, after={'amount': payment.amount})

    def update(self, request, *args, **kwargs):
        return Response({'detail': 'Payment records are immutable after creation.'}, status=405)

    def destroy(self, request, *args, **kwargs):
        return Response({
            'detail': 'Financial transactions cannot be permanently deleted.',
            'error': 'financial_document_deletion_forbidden',
        }, status=405)


class ExpenseReportView(APIView):
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        return _serve_report(request, 'expenses')


class SalesReturnViewSet(viewsets.ModelViewSet):
    serializer_class = SalesReturnSerializer
    permission_classes = [IsCashierOrAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['invoice', 'refund_method']
    search_fields = ['return_number', 'invoice__invoice_number', 'reason']
    ordering = ['-created_at']

    def get_queryset(self):
        return SalesReturn.objects.select_related('invoice', 'created_by').prefetch_related('items').filter(
            business=self.request.user.business
        )

    def update(self, request, *args, **kwargs):
        return Response({'detail': 'Sales returns are immutable after creation.'}, status=405)

    def destroy(self, request, *args, **kwargs):
        return Response({
            'detail': 'Financial transactions cannot be permanently deleted.',
            'error': 'financial_document_deletion_forbidden',
        }, status=405)

    def create(self, request, *args, **kwargs):
        from .services.sales_return_service import SalesReturnService
        try:
            return_obj = SalesReturnService.create_sales_return(
                invoice_id=request.data.get('invoice'),
                reason=request.data.get('reason', ''),
                refund_method=request.data.get('refund_method', 'cash'),
                items_data=request.data.get('items', []),
                business=request.user.business,
                created_by=request.user,
            )
        except LookupError as exc:
            return Response({'detail': str(exc)}, status=404)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        audit_event(request, 'SALES_RETURN_CREATED', 'SalesReturn', return_obj.id, after={'refund_amount': return_obj.refund_amount})
        return Response(SalesReturnSerializer(return_obj).data, status=201)


class BillsListView(APIView):
    """Alias: GET /bills/ returns invoices list (used by Returns page)."""
    permission_classes = [IsCashierOrAdmin]

    def get(self, request):
        qs = Invoice.objects.select_related('customer', 'created_by').prefetch_related('items', 'payments').filter(
            business=request.user.business
        )
        if request.user.role == 'cashier':
            qs = qs.filter(created_by=request.user)
        status_filter = request.query_params.get('status')
        payment_status = request.query_params.get('payment_status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if payment_status:
            qs = qs.filter(payment_status=payment_status)
        qs = qs.order_by('-created_at')[:200]
        return Response(InvoiceSerializer(qs, many=True).data)


class InvoicePDFView(APIView):
    permission_classes = []

    def get(self, request, pk):
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth import get_user_model

        # Allow token via query param for browser window.open() calls
        token = request.query_params.get('token')
        if token:
            try:
                validated = AccessToken(token)
                User = get_user_model()
                request.user = User.objects.get(id=validated['user_id'])
            except Exception:
                return HttpResponse('Invalid token', status=401)
        elif not request.user.is_authenticated:
            return HttpResponse('Unauthorized', status=401)

        try:
            invoice = Invoice.objects.prefetch_related('items', 'payments').select_related('customer').get(
                pk=pk, business=request.user.business
            )
        except Invoice.DoesNotExist:
            return HttpResponse('Not found', status=404)
        return _invoice_pdf_response(
            invoice,
            request.query_params.get('printer'),
            request.query_params.get('download') == '1',
        )


def _invoice_pdf_response(invoice, printer=None, download=False):
    """Generate an A4/thermal invoice PDF with an explicit browser disposition."""
    from .pdf_utils import generate_invoice_pdf, generate_thermal_invoice_pdf

    business_settings = {
        setting.key: setting.value
        for setting in Setting.objects.filter(
            business=invoice.business, key__in=['printer_type', 'invoice_template']
        )
    }
    printer_setting = business_settings.get('printer_type', 'a4').lower()
    template_setting = business_settings.get('invoice_template', 'gst_a4').lower()
    requested_printer = (printer or '').lower()
    use_thermal = requested_printer == 'thermal' or (
        not requested_printer and (
            printer_setting in ('thermal', 'thermal_80', 'thermal_58')
            or template_setting.startswith('thermal')
        )
    )
    # An explicit A4 request must work even when the business default is thermal.
    buffer = generate_thermal_invoice_pdf(invoice) if use_thermal else generate_invoice_pdf(invoice, force_a4=True)
    response = HttpResponse(buffer, content_type='application/pdf')
    suffix = 'thermal' if use_thermal else 'a4'
    disposition = 'attachment' if download else 'inline'
    response['Content-Disposition'] = (
        f'{disposition}; filename="invoice-{invoice.invoice_number}-{suffix}.pdf"'
    )
    return response


class InvoiceShortLinkView(APIView):
    """Create or return the current public, expiring PDF link for an invoice."""
    permission_classes = [IsCashierOrAdmin]

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.get(pk=pk, business=request.user.business)
        except Invoice.DoesNotExist:
            raise Http404

        link = invoice.short_links.filter(expires_at__gt=timezone.now()).first()
        if link is None:
            # A uniqueness constraint is the final collision guard; retries make
            # the 6-character public code safe even at high volume.
            for _ in range(5):
                try:
                    link = ShortLink.objects.create(invoice=invoice)
                    break
                except IntegrityError:
                    link = None
            if link is None:
                return Response({'detail': 'Could not create a short link. Please retry.'}, status=503)

        short_url = request.build_absolute_uri(reverse('invoice-short-link', kwargs={'code': link.code}))
        return Response({
            'code': link.code,
            'url': short_url,
            'expires_at': link.expires_at,
        })


class PublicInvoiceShortLinkView(APIView):
    """Serve a PDF without authentication only when its public link is valid."""
    authentication_classes = []
    permission_classes = []
    throttle_classes = [AnonRateThrottle]

    def get(self, request, code):
        try:
            link = ShortLink.objects.select_related('invoice__customer', 'invoice__business').prefetch_related(
                'invoice__items', 'invoice__payments'
            ).get(code=code, expires_at__gt=timezone.now())
        except ShortLink.DoesNotExist:
            # Use one response for missing and expired codes to avoid revealing
            # whether an invoice link once existed.
            raise Http404('This invoice link is invalid or has expired.')

        # If accessed from browser or with view=web/html, redirect to digital bill
        accept = request.META.get('HTTP_ACCEPT', '')
        if request.query_params.get('download') != '1' and (
            request.query_params.get('view') == 'web' or 'text/html' in accept
        ):
            from django.http import HttpResponseRedirect
            from decouple import config as env
            frontend_url = env('FRONTEND_URL', default='http://localhost:3000').rstrip('/')
            return HttpResponseRedirect(f"{frontend_url}/bill/{link.invoice.public_token}")

        return _invoice_pdf_response(
            link.invoice,
            request.query_params.get('printer'),
            request.query_params.get('download') == '1',
        )


class PublicBillDetailView(APIView):
    """Serve full invoice details for the public 'Scan to View Bill' page without authentication."""
    authentication_classes = []
    permission_classes = []
    throttle_classes = [AnonRateThrottle]

    def get(self, request, token):
        try:
            invoice = Invoice.objects.select_related('customer', 'business', 'created_by').prefetch_related(
                'items__product', 'payments'
            ).get(public_token=token)
        except Invoice.DoesNotExist:
            raise Http404('This digital bill was not found or the link is invalid.')

        # Fetch business public settings
        business_settings = {
            s.key: s.value
            for s in Setting.objects.filter(business=invoice.business)
        } if invoice.business else {}

        items_data = [
            {
                'id': it.id,
                'product_name': it.product_name,
                'hsn_code': it.hsn_code,
                'sku': it.sku,
                'mrp': float(it.mrp),
                'quantity': float(it.quantity),
                'unit_price': float(it.unit_price),
                'discount_percent': float(it.discount_percent),
                'discount_amount': float(it.discount_amount),
                'gst_percent': float(it.gst_percent),
                'gst_amount': float(it.gst_amount),
                'total': float(it.total),
            }
            for it in invoice.items.all()
        ]

        payments_data = [
            {
                'id': p.id,
                'created_at': p.created_at,
                'amount': float(p.amount),
                'method': p.method,
                'reference': getattr(p, 'reference', ''),
            }
            for p in invoice.payments.all()
        ]

        business = invoice.business
        business_data = {
            'name': (business.name if business else None) or business_settings.get('shop_name', 'Sri Balaji Store'),
            'owner_name': business.owner_name if business else '',
            'mobile': (business.mobile if business else None) or business_settings.get('shop_phone', ''),
            'email': (business.email if business else None) or business_settings.get('shop_email', ''),
            'address': (business.address if business else None) or business_settings.get('shop_address', ''),
            'gstin': (business.gstin if business else None) or business_settings.get('shop_gstin', ''),
            'pan': (business.pan if business else None) or business_settings.get('shop_pan', ''),
            'currency': business.currency if business else '₹',
            'logo': business.logo.url if (business and business.logo) else business_settings.get('shop_logo', ''),
        }

        invoice_data = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'public_token': invoice.public_token,
            'created_at': invoice.created_at,
            'customer_name': invoice.customer.name if invoice.customer else invoice.customer_name,
            'customer_phone': invoice.customer.mobile if invoice.customer else invoice.customer_phone,
            'customer_address': invoice.customer.address if invoice.customer else '',
            'customer_gstin': invoice.customer.gstin if invoice.customer else '',
            'subtotal': float(invoice.subtotal),
            'discount_amount': float(invoice.discount_amount),
            'tax_amount': float(invoice.tax_amount),
            'round_off': float(invoice.round_off),
            'grand_total': float(invoice.grand_total),
            'paid_amount': float(invoice.paid_amount),
            'balance_due': float(invoice.balance_due),
            'payment_method': invoice.payment_method,
            'payment_status': invoice.payment_status,
            'status': invoice.status,
            'notes': invoice.notes,
            'items': items_data,
            'payments': payments_data,
        }

        public_settings = {
            'shop_name': business_data['name'],
            'shop_address': business_data['address'],
            'shop_phone': business_data['mobile'],
            'shop_email': business_data['email'],
            'shop_gstin': business_data['gstin'],
            'shop_pan': business_data['pan'],
            'shop_upi_id': business_settings.get('shop_upi_id', ''),
            'currency': business_settings.get('currency', '₹'),
            'invoice_terms': business_settings.get('invoice_terms', ''),
            'invoice_footer': business_settings.get('invoice_footer', 'Thank you for shopping with us! Visit again.'),
            'invoice_template': business_settings.get('invoice_template', 'gst_a4'),
            'enable_invoice_qr': business_settings.get('enable_invoice_qr', 'true'),
        }

        return Response({
            'invoice': invoice_data,
            'business': business_data,
            'settings': public_settings,
        })


class PublicBillPDFView(APIView):
    """Public endpoint to download/stream the PDF for a bill token without auth."""
    authentication_classes = []
    permission_classes = []
    throttle_classes = [AnonRateThrottle]

    def get(self, request, token):
        try:
            invoice = Invoice.objects.select_related('customer', 'business').prefetch_related(
                'items', 'payments'
            ).get(public_token=token)
        except Invoice.DoesNotExist:
            raise Http404('This digital bill was not found or the link is invalid.')

        return _invoice_pdf_response(
            invoice,
            request.query_params.get('printer'),
            request.query_params.get('download') == '1',
        )


class CancelInvoiceView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from .services.invoice_service import InvoiceService
        reason = request.data.get('reason', '').strip() or 'Customer requested cancellation'
        try:
            invoice = InvoiceService.cancel_invoice(
                invoice_id=pk,
                business=request.user.business,
                performed_by=request.user,
                reason=reason,
                request=request,
            )
        except LookupError as exc:
            return Response({'error': str(exc)}, status=404)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response({
            'status': 'cancelled',
            'invoice_number': invoice.invoice_number,
            'cancelled_by': request.user.get_full_name() or request.user.username,
            'cancelled_at': invoice.cancelled_at,
            'cancel_reason': invoice.cancel_reason,
        })


class RefundInvoiceView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from .services.invoice_service import InvoiceService
        reason = request.data.get('reason', '').strip()
        try:
            invoice = InvoiceService.refund_invoice(
                invoice_id=pk,
                business=request.user.business,
                performed_by=request.user,
                reason=reason,
                request=request,
            )
        except LookupError as exc:
            return Response({'error': str(exc)}, status=404)
        except ValueError:
            return Response({'error': 'Cannot refund'}, status=400)
        return Response({'status': 'refunded'})


class StockAdjustView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        from .services.inventory_service import InventoryService
        product_id = request.data.get('product_id')
        try:
            quantity = Decimal(str(request.data.get('quantity', 0)))
        except (ValueError, TypeError):
            return Response({'error': 'Quantity must be a number.'}, status=400)
        if quantity == 0:
            return Response({'error': 'Quantity cannot be zero.'}, status=400)
        transaction_type = request.data.get('transaction_type', 'adjustment')
        notes = request.data.get('notes', '')
        try:
            product = InventoryService.adjust_stock(
                product_id=product_id,
                quantity=quantity,
                transaction_type=transaction_type,
                notes=notes,
                business=request.user.business,
                created_by=request.user,
            )
        except ValueError as exc:
            status_code = 404 if str(exc) == 'Product not found' else 400
            return Response({'error': str(exc)}, status=status_code)
        audit_event(
            request, 'STOCK_ADJUSTED', 'Product', product.id,
            after={'quantity': quantity, 'transaction_type': transaction_type},
        )
        return Response(ProductSerializer(product).data)


class BulkStockAdjustView(APIView):
    """Apply several stock-in/out changes in one auditable transaction."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from .services.inventory_service import InventoryService
        try:
            imported = InventoryService.bulk_adjust_stock(
                items=request.data.get('items', []),
                notes=request.data.get('notes', ''),
                business=request.user.business,
                created_by=request.user,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        audit_event(request, 'STOCK_ADJUSTED', 'Business', request.user.business_id, after={'items': imported})
        return Response({'status': 'updated', 'updated': imported})


class StockImportView(APIView):
    """Import stock changes from a CSV or modern Excel workbook.

    TODO(background-jobs): Move to a background task when imports exceed
    ~1 000 rows or p95 latency exceeds 5 s. See BACKGROUND_JOBS.md.
    """
    permission_classes = [IsAdmin]

    MAX_IMPORT_ROWS = 1000

    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'Choose a CSV or Excel file first.'}, status=400)
        if upload.size > 5 * 1024 * 1024:
            return Response({'detail': 'The import file must be smaller than 5 MB.'}, status=400)

        suffix = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
        try:
            if suffix == 'csv':
                decoded = upload.read().decode('utf-8-sig')
                rows = list(csv.DictReader(decoded.splitlines()))
            elif suffix in ('xlsx', 'xlsm'):
                workbook = load_workbook(upload, read_only=True, data_only=True)
                sheet = workbook.active
                values = list(sheet.iter_rows(values_only=True))
                if not values:
                    rows = []
                else:
                    headers = [str(value).strip() if value is not None else '' for value in values[0]]
                    rows = [dict(zip(headers, values_row)) for values_row in values[1:] if any(value is not None and str(value).strip() for value in values_row)]
            else:
                return Response({'detail': 'Use a .csv, .xlsx, or .xlsm file.'}, status=400)
        except (UnicodeDecodeError, ValueError, OSError, TypeError) as exc:
            return Response({'detail': f'Could not read this file: {exc}'}, status=400)

        if not rows:
            return Response({'detail': 'The file has no stock rows.'}, status=400)
        if len(rows) > self.MAX_IMPORT_ROWS:
            return Response({'detail': f'Import up to {self.MAX_IMPORT_ROWS} rows at a time.'}, status=400)

        def normalise(row):
            return {str(key).strip().lower().replace(' ', '_').replace('-', '_'): value for key, value in row.items() if key is not None}

        prepared = []
        errors = []
        for row_number, raw_row in enumerate(rows, start=2):
            row = normalise(raw_row)
            sku = str(row.get('sku') or row.get('product_sku') or '').strip()
            product_name = str(row.get('product_name') or row.get('product') or row.get('name') or '').strip()
            raw_change = row.get('quantity', row.get('qty', row.get('stock_change', row.get('adjustment'))))
            raw_stock = row.get('current_stock', row.get('stock'))
            if not sku and not product_name:
                errors.append(f'Row {row_number}: enter a SKU or product name.')
                continue
            if raw_change in (None, '') and raw_stock in (None, ''):
                errors.append(f'Row {row_number}: enter Quantity to add/remove or Current Stock.')
                continue
            try:
                change = Decimal(str(raw_change)) if raw_change not in (None, '') else None
                stock = Decimal(str(raw_stock)) if raw_stock not in (None, '') else None
            except Exception:
                errors.append(f'Row {row_number}: stock values must be numbers.')
                continue
            if stock is not None and stock < 0:
                errors.append(f'Row {row_number}: Current Stock cannot be negative.')
                continue
            prepared.append((row_number, sku, product_name, change, stock))

        if errors:
            return Response({'detail': 'Fix the import file and try again.', 'errors': errors[:20]}, status=400)

        resolved_rows = []
        for row_number, sku, product_name, change, stock in prepared:
            products = Product.objects.filter(business=request.user.business)
            product = products.filter(sku__iexact=sku).first() if sku else products.filter(name__iexact=product_name).first()
            if not product:
                lookup = f'SKU "{sku}"' if sku else f'product "{product_name}"'
                return Response({'detail': f'Row {row_number}: no product found for {lookup}.'}, status=400)
            resolved_rows.append((row_number, product, change, stock))

        planned_rows = []
        running_stock = {}
        for row_number, product, change, stock in resolved_rows:
            before = running_stock.get(product.pk, product.current_stock)
            quantity = stock - before if stock is not None else change
            after = before + quantity
            if after < 0:
                return Response({'detail': f'Row {row_number}: {product.name} would have negative stock.'}, status=400)
            running_stock[product.pk] = after
            planned_rows.append((row_number, product, quantity, before, after))

        from .services.inventory_service import InventoryService
        try:
            imported = InventoryService.import_stock(
                planned_rows=planned_rows,
                business=request.user.business,
                created_by=request.user,
                source_name=upload.name,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        audit_event(request, 'STOCK_ADJUSTED', 'Business', request.user.business_id, after={'imported': imported, 'rows': len(prepared)})
        return Response({'status': 'updated', 'imported': imported, 'rows': len(prepared)})


class CustomerPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerPaymentSerializer
    permission_classes = [IsCashierOrAdmin]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['customer', 'method']
    ordering = ['-created_at']

    def get_queryset(self):
        return CustomerPayment.objects.select_related('customer').filter(
            business=self.request.user.business
        )

    def perform_create(self, serializer):
        from .services.payment_service import PaymentService
        payment = PaymentService.record_customer_payment(
            attributes=serializer.validated_data,
            business=self.request.user.business,
            created_by=self.request.user,
        )
        serializer.instance = payment
        audit_event(self.request, 'PAYMENT_RECEIVED', 'CustomerPayment', payment.id, after={'amount': payment.amount})

    def update(self, request, *args, **kwargs):
        return Response({'detail': 'Payment records are immutable after creation.'}, status=405)

    def destroy(self, request, *args, **kwargs):
        return Response({
            'detail': 'Financial transactions cannot be permanently deleted.',
            'error': 'financial_document_deletion_forbidden',
        }, status=405)


class PurchaseReturnViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseReturnSerializer
    permission_classes = [IsCashierOrAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['purchase']
    search_fields = ['return_number', 'reason']
    ordering = ['-created_at']

    def get_queryset(self):
        return PurchaseReturn.objects.select_related('purchase').prefetch_related('items').filter(
            business=self.request.user.business
        )

    def update(self, request, *args, **kwargs):
        return Response({'detail': 'Purchase returns are immutable after creation.'}, status=405)

    def destroy(self, request, *args, **kwargs):
        return Response({
            'detail': 'Financial transactions cannot be permanently deleted.',
            'error': 'financial_document_deletion_forbidden',
        }, status=405)

    def create(self, request, *args, **kwargs):
        from .services.purchase_return_service import PurchaseReturnService
        try:
            return_obj = PurchaseReturnService.create_purchase_return(
                purchase_id=request.data.get('purchase'),
                reason=request.data.get('reason', ''),
                items_data=request.data.get('items', []),
                business=request.user.business,
                created_by=request.user,
            )
        except LookupError as exc:
            return Response({'detail': str(exc)}, status=404)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        audit_event(request, 'PURCHASE_RETURN_CREATED', 'PurchaseReturn', return_obj.id, after={'debit_amount': return_obj.debit_amount})
        return Response(PurchaseReturnSerializer(return_obj).data, status=201)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsManagerOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['module', 'action', 'result']
    search_fields = ['action', 'entity', 'entity_id', 'entity_name', 'reason', 'user__username', 'user__email', 'ip_address']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user').filter(
            business=self.request.user.business
        ).exclude(action__in=['create', 'update', 'cancel', 'refund', 'adjust', 'archive'])
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs


class RecycleBinView(APIView):
    """
    Statutory Recycle Bin & Reversal Register:
    Under GST/ERP statutory standards, financial transactions (invoices, payments, purchases)
    can NEVER be permanently deleted. They are preserved in this register for auditing.
    Master entities (such as archived products) can be restored.
    """
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        biz = request.user.business

        # Cancelled or refunded invoices
        cancelled_invoices = list(Invoice.objects.filter(
            business=biz,
            status__in=['cancelled', 'refunded'],
        ).select_related('customer', 'cancelled_by').order_by('-cancelled_at', '-created_at')[:100].values(
            'id', 'invoice_number', 'status', 'payment_status', 'grand_total',
            'customer__name', 'cancelled_by__username', 'cancelled_at', 'cancel_reason', 'created_at'
        ))

        # Inactive / archived products
        archived_products = list(Product.objects.filter(
            business=biz,
            status='inactive',
        ).order_by('-updated_at')[:100].values(
            'id', 'name', 'sku', 'barcode', 'selling_price', 'current_stock', 'updated_at'
        ))

        # Cancelled purchases
        cancelled_purchases = list(Purchase.objects.filter(
            business=biz,
            payment_status='cancelled',
        ).select_related('supplier').order_by('-created_at')[:100].values(
            'id', 'invoice_number', 'supplier__name', 'total_amount', 'payment_status', 'created_at', 'notes'
        ))

        return Response({
            'cancelled_invoices': cancelled_invoices,
            'archived_products': archived_products,
            'cancelled_purchases': cancelled_purchases,
            'statutory_notice': (
                'Under statutory GST and ERP audit regulations, cancelled invoices and financial transactions '
                'are permanently retained in this register for compliance. They cannot be permanently deleted '
                'or restored. Master records (such as inactive products) can be restored.'
            ),
        })


class RecycleBinRestoreView(APIView):
    """
    Restore restorable master items from the Recycle Bin.
    Financial transactions strictly reject un-cancellation with HTTP 400.
    """
    permission_classes = [IsManagerOrAbove]

    def post(self, request, entity_type, pk):
        biz = request.user.business
        reason = request.data.get('reason', '').strip() or 'Restored from Recycle Bin'

        if entity_type == 'product':
            product = Product.objects.filter(business=biz, pk=pk, status='inactive').first()
            if not product:
                return Response({'error': 'Product not found in recycle bin.'}, status=404)
            product.status = 'active'
            product.save(update_fields=['status', 'updated_at'])
            audit_event(
                request,
                'PRODUCT_RESTORED',
                'Product',
                product.id,
                entity_name=product.name,
                before={'status': 'inactive'},
                after={'status': 'active'},
                reason=reason,
            )
            return Response({'status': 'restored', 'message': f'Product "{product.name}" restored successfully.'})

        if entity_type in ('invoice', 'purchase', 'payment'):
            return Response({
                'detail': (
                    'Statutory audit violation: Financial transactions cannot be restored or un-cancelled. '
                    'To correct a billing transaction, issue a new invoice or credit/debit adjustment.'
                ),
                'error': 'financial_restoration_forbidden',
            }, status=400)

        return Response({'error': f'Unsupported entity type: {entity_type}'}, status=400)


# ─────────────────────────────────────────────────────────────
# Razorpay Payment Gateway
# ─────────────────────────────────────────────────────────────

class RazorpayWebhookView(APIView):
    """S2S webhook from Razorpay — idempotent, signature-verified."""
    authentication_classes = []
    permission_classes = []
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        import hmac as _hmac
        import hashlib
        import json
        import logging
        from django.db import transaction as db_transaction
        from decouple import config as env

        logger = logging.getLogger('razorpay')

        webhook_secret = env('RAZORPAY_WEBHOOK_SECRET', default='').strip()
        signature = request.headers.get('X-Razorpay-Signature', '')

        if webhook_secret and signature:
            body = request.body
            expected = _hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
            if not _hmac.compare_digest(expected, signature):
                logger.warning('Razorpay webhook: signature mismatch')
                return Response({'error': 'Invalid signature'}, status=400)

        try:
            payload = json.loads(request.body)
        except Exception:
            return Response({'error': 'Invalid payload'}, status=400)

        event = payload.get('event', '')
        payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
        order_id = payment_entity.get('order_id', '')
        payment_id = payment_entity.get('id', '')
        razorpay_amount = payment_entity.get('amount', 0)

        if not order_id:
            return Response({'error': 'Missing order_id'}, status=400)

        try:
            txn = RazorpayTransaction.objects.select_related('invoice').get(razorpay_order_id=order_id)
        except RazorpayTransaction.DoesNotExist:
            logger.warning('Razorpay webhook: unknown order %s', order_id)
            return Response({'error': 'Transaction not found'}, status=404)

        if txn.status == 'success':
            return Response({'status': 'already_processed'})

        new_status = 'success' if event == 'payment.captured' else 'failed'

        with db_transaction.atomic():
            txn = RazorpayTransaction.objects.select_for_update().get(razorpay_order_id=order_id)
            if txn.status == 'success':
                return Response({'status': 'already_processed'})

            txn.status = new_status
            txn.razorpay_payment_id = payment_id
            txn.provider_reference = payment_id
            txn.response_code = event
            if new_status == 'failed':
                txn.failure_reason = payment_entity.get('error_description', event)
            txn.response_data = str(payload)
            txn.save(update_fields=[
                'status', 'razorpay_payment_id', 'provider_reference',
                'response_code', 'failure_reason', 'response_data', 'updated_at',
            ])

            if new_status == 'success' and txn.invoice_id:
                invoice = Invoice.objects.get(pk=txn.invoice_id)
                expected_paise = int(txn.amount * 100)
                if razorpay_amount and razorpay_amount != expected_paise:
                    logger.error(
                        'Razorpay webhook amount mismatch order %s: expected %s got %s',
                        order_id, expected_paise, razorpay_amount,
                    )
                    txn.status = 'failed'
                    txn.failure_reason = f'AMOUNT_MISMATCH expected={expected_paise} got={razorpay_amount}'
                    txn.response_data = txn.failure_reason
                    txn.save(update_fields=['status', 'failure_reason', 'response_data', 'updated_at'])
                    return Response({'status': 'amount_mismatch'}, status=400)

                if invoice.payment_status != 'paid':
                    invoice.payment_status = 'paid'
                    invoice.paid_amount = invoice.grand_total
                    invoice.balance_due = Decimal('0')
                    invoice.payment_method = 'razorpay'
                    invoice.save(update_fields=['payment_status', 'paid_amount', 'balance_due', 'payment_method'])
                    Payment.objects.get_or_create(
                        invoice=invoice,
                        method='razorpay',
                        defaults={'amount': txn.amount, 'reference': payment_id},
                    )
                    logger.info('Razorpay webhook: invoice %s marked PAID via order %s', invoice.invoice_number, order_id)

        return Response({'status': 'processed'})


class BarcodeLabelView(APIView):
    """GET /products/<pk>/barcode-label/?copies=N&size=...&show_store=...&token=<jwt>
    Returns a PDF sheet of barcode labels for the product with custom sizing and field toggles.
    Supports token-in-query-param so the browser can open/print it directly.
    """
    permission_classes = []

    def get(self, request, pk):
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth import get_user_model

        token = request.query_params.get('token')
        if token:
            try:
                validated = AccessToken(token)
                User = get_user_model()
                request.user = User.objects.get(id=validated['user_id'])
            except Exception:
                return HttpResponse('Invalid token', status=401)
        elif not request.user.is_authenticated:
            return HttpResponse('Unauthorized', status=401)

        try:
            product = Product.objects.get(pk=pk, business=request.user.business)
        except Product.DoesNotExist:
            return HttpResponse('Not found', status=404)

        try:
            copies = max(1, min(int(request.query_params.get('copies', 1)), 500))
        except (ValueError, TypeError):
            copies = 1

        size = request.query_params.get('size', 'a4_3x5')
        try:
            custom_cols = int(request.query_params.get('custom_cols', 3))
            custom_rows = int(request.query_params.get('custom_rows', 5))
        except (ValueError, TypeError):
            custom_cols, custom_rows = 3, 5

        def parse_bool(val, default=True):
            if val is None:
                return default
            return str(val).lower() in ('1', 'true', 'yes')

        options = {
            'size': size,
            'custom_cols': custom_cols,
            'custom_rows': custom_rows,
            'show_store': parse_bool(request.query_params.get('show_store'), True),
            'show_name': parse_bool(request.query_params.get('show_name'), True),
            'show_barcode': parse_bool(request.query_params.get('show_barcode'), True),
            'show_number': parse_bool(request.query_params.get('show_number'), True),
            'show_sku': parse_bool(request.query_params.get('show_sku'), True),
            'show_price': parse_bool(request.query_params.get('show_price'), True),
            'show_mrp': parse_bool(request.query_params.get('show_mrp'), True),
            'show_unit': parse_bool(request.query_params.get('show_unit'), True),
        }

        download = parse_bool(request.query_params.get('download'), False)
        buffer = _generate_barcode_label_pdf(product, copies, options)
        response = HttpResponse(buffer, content_type='application/pdf')
        disp = 'attachment' if download else 'inline'
        response['Content-Disposition'] = f'{disp}; filename="barcode-{product.sku or product.id}.pdf"'
        return response


def _generate_barcode_label_pdf(product, copies, options=None):
    """Generates barcode labels supporting A4 3x5, A4 4x8, 58mm Thermal, 80mm Thermal, and Custom with customizable fields."""
    import barcode as pybarcode
    from barcode.writer import ImageWriter
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib import colors as rl_colors
    import tempfile, os

    options = options or {}
    size_type = options.get('size', 'a4_3x5')
    custom_cols = max(1, min(10, int(options.get('custom_cols', 3))))
    custom_rows = max(1, min(20, int(options.get('custom_rows', 5))))

    show_store = options.get('show_store', True)
    show_name = options.get('show_name', True)
    show_barcode = options.get('show_barcode', True)
    show_number = options.get('show_number', True)
    show_sku = options.get('show_sku', True)
    show_price = options.get('show_price', True)
    show_mrp = options.get('show_mrp', True)
    show_unit = options.get('show_unit', True)

    if size_type == 'a4_4x8':
        PAGE_W, PAGE_H = A4
        COLS, ROWS = 4, 8
        MARGIN_X, MARGIN_Y = 5 * mm, 6 * mm
        GAP_X, GAP_Y = 2 * mm, 2 * mm
        is_compact = True
    elif size_type == 'thermal_58':
        PAGE_W, PAGE_H = 58 * mm, 40 * mm
        COLS, ROWS = 1, 1
        MARGIN_X, MARGIN_Y = 2 * mm, 2 * mm
        GAP_X, GAP_Y = 0, 0
        is_compact = True
    elif size_type == 'thermal_80':
        PAGE_W, PAGE_H = 80 * mm, 50 * mm
        COLS, ROWS = 1, 1
        MARGIN_X, MARGIN_Y = 3 * mm, 3 * mm
        GAP_X, GAP_Y = 0, 0
        is_compact = False
    elif size_type == 'custom':
        PAGE_W, PAGE_H = A4
        COLS, ROWS = custom_cols, custom_rows
        MARGIN_X, MARGIN_Y = 5 * mm, 6 * mm
        GAP_X, GAP_Y = 2 * mm, 2 * mm
        is_compact = (ROWS > 6 or COLS > 3)
    else:  # a4_3x5
        PAGE_W, PAGE_H = A4
        COLS, ROWS = 3, 5
        MARGIN_X, MARGIN_Y = 6 * mm, 8 * mm
        GAP_X, GAP_Y = 2.5 * mm, 2.5 * mm
        is_compact = False

    LABEL_W = (PAGE_W - (2 * MARGIN_X) - ((COLS - 1) * GAP_X)) / COLS
    LABEL_H = (PAGE_H - (2 * MARGIN_Y) - ((ROWS - 1) * GAP_Y)) / ROWS

    barcode_value = (product.barcode or product.sku or str(product.id)).strip()

    tmp_dir = tempfile.mkdtemp()
    tmp_path = os.path.join(tmp_dir, 'bc')
    bc_img_path = None
    if show_barcode:
        try:
            bc_class = pybarcode.get_barcode_class('code128')
            bc = bc_class(barcode_value, writer=ImageWriter())
            saved = bc.save(tmp_path, options={
                'write_text': False,
                'quiet_zone': 1.5,
                'module_height': 10 if is_compact else 14,
                'dpi': 300,
            })
            bc_img_path = saved
        except Exception:
            bc_img_path = None

    buffer = BytesIO()
    c = rl_canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    shop_name = ''
    if show_store:
        try:
            s = Setting.objects.filter(business=product.business, key='shop_name').first()
            if s and s.value:
                shop_name = s.value.strip()
        except Exception:
            pass
        if not shop_name:
            shop_name = 'RETAIL STORE'

    try:
        sp_num = float(product.selling_price or 0)
        price_text = f'Rs. {sp_num:,.2f}' if sp_num > 0 else 'Rs. 0.00'
    except (ValueError, TypeError):
        price_text = f'Rs. {product.selling_price}'

    label_text = (product.name or 'Product')[:(22 if is_compact else 28)]
    sku_text = f'SKU: {product.sku[:12]}' if (show_sku and product.sku) else ''

    for i in range(copies):
        col = i % COLS
        row = (i // COLS) % ROWS
        if i > 0 and col == 0 and row == 0:
            c.showPage()

        x = MARGIN_X + col * (LABEL_W + GAP_X)
        y = PAGE_H - MARGIN_Y - (row + 1) * LABEL_H - row * GAP_Y

        # Label outline with rounded corners
        c.setStrokeColor(rl_colors.HexColor('#CBD5E1'))
        c.setLineWidth(0.5)
        c.roundRect(x, y, LABEL_W, LABEL_H, radius=1.5 * mm, stroke=1, fill=0)

        curr_top = y + LABEL_H

        # 1. Store Name
        if show_store and shop_name:
            c.setFont('Helvetica-Bold', 6 if is_compact else 7)
            c.setFillColor(rl_colors.HexColor('#312E81'))
            curr_top -= (4 * mm if is_compact else 5 * mm)
            c.drawCentredString(x + LABEL_W / 2, curr_top, shop_name[:26].upper())

        # 2. Product Name
        if show_name:
            c.setFont('Helvetica-Bold', 7 if is_compact else 8.5)
            c.setFillColor(rl_colors.HexColor('#0F172A'))
            curr_top -= (3.5 * mm if is_compact else 4.5 * mm)
            c.drawCentredString(x + LABEL_W / 2, curr_top, label_text)

        # 3. Barcode graphic & number
        if show_barcode and bc_img_path and os.path.exists(bc_img_path):
            bc_h = 10 * mm if is_compact else 15 * mm
            bc_w = LABEL_W - (6 * mm if is_compact else 8 * mm)
            bc_x = x + (LABEL_W - bc_w) / 2
            curr_top -= (bc_h + 1 * mm)
            c.drawImage(bc_img_path, bc_x, curr_top, width=bc_w, height=bc_h, preserveAspectRatio=False, mask='auto')

            if show_number:
                curr_top -= 3 * mm
                c.setFont('Courier-Bold', 6 if is_compact else 7)
                c.setFillColor(rl_colors.HexColor('#475569'))
                c.drawCentredString(x + LABEL_W / 2, curr_top, barcode_value)
        elif show_barcode:
            # Fallback text
            curr_top -= 5 * mm
            c.setFont('Courier-Bold', 8 if is_compact else 9)
            c.setFillColor(rl_colors.HexColor('#0F172A'))
            c.drawCentredString(x + LABEL_W / 2, curr_top, barcode_value)
        elif show_number:
            curr_top -= 4 * mm
            c.setFont('Courier-Bold', 7 if is_compact else 8)
            c.setFillColor(rl_colors.HexColor('#475569'))
            c.drawCentredString(x + LABEL_W / 2, curr_top, barcode_value)

        # 4. Bottom details line: SKU, Unit, MRP, Price
        has_bottom_info = show_sku or show_unit or show_mrp or show_price
        if has_bottom_info:
            sep_y = y + (7 * mm if is_compact else 9.5 * mm)
            c.setStrokeColor(rl_colors.HexColor('#E2E8F0'))
            c.setLineWidth(0.4)
            c.line(x + 2.5 * mm, sep_y, x + LABEL_W - 2.5 * mm, sep_y)

            bottom_y = y + (2 * mm if is_compact else 3.5 * mm)

            # Left items: SKU, MRP, Unit
            c.setFont('Helvetica', 5.5 if is_compact else 6.5)
            c.setFillColor(rl_colors.HexColor('#64748B'))
            left_strs = []
            if sku_text:
                left_strs.append(sku_text)
            if show_unit and product.unit:
                left_strs.append(f'Unit: {product.unit}')
            if show_mrp and product.mrp and float(product.mrp or 0) > 0:
                left_strs.append(f'MRP: Rs.{product.mrp}')

            if left_strs:
                c.drawString(x + 3 * mm, bottom_y, ' · '.join(left_strs)[:28])

            # Right item: Selling Price
            if show_price:
                c.setFont('Helvetica-Bold', 7.5 if is_compact else 9.5)
                c.setFillColor(rl_colors.HexColor('#0F172A'))
                c.drawRightString(x + LABEL_W - 3 * mm, bottom_y, price_text)

    c.save()

    try:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
    except Exception:
        pass

    buffer.seek(0)
    return buffer


class PublicDocView(APIView):
    """Serve a static document (e.g. T&C PDF) publicly without authentication."""
    authentication_classes = []
    permission_classes = []

    ALLOWED_DOCS = {'terms': 'docs/terms.pdf'}

    def get(self, request, doc):
        import os
        from django.conf import settings as django_settings
        rel = self.ALLOWED_DOCS.get(doc)
        if not rel:
            raise Http404
        path = os.path.join(django_settings.MEDIA_ROOT, rel)
        if not os.path.exists(path):
            raise Http404('Document not found. Please upload the PDF to backend/media/docs/terms.pdf')
        with open(path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{doc}.pdf"'
        response['Cache-Control'] = 'public, max-age=86400'
        return response


class RazorpayCreateOrderView(APIView):
    """Create a Razorpay order for an invoice.

    - Amount always taken from saved invoice, never from frontend.
    - Idempotent: reuses existing created/initiated/pending order within 30 min.
    """
    permission_classes = [IsCashierOrAdmin]

    def post(self, request):
        import logging
        from .services.razorpay_service import create_order, generate_receipt
        from decouple import config as env

        logger = logging.getLogger('razorpay')

        invoice_id = request.data.get('invoice_id')
        if not invoice_id:
            return Response({'error': 'invoice_id is required'}, status=400)

        try:
            invoice = Invoice.objects.get(pk=invoice_id, business=request.user.business)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=404)

        if invoice.payment_status == 'paid':
            return Response({'error': 'Invoice is already paid'}, status=400)

        amount_rupees = invoice.grand_total
        amount_paise = int(amount_rupees * 100)
        if amount_paise <= 0:
            return Response({'error': 'Invoice amount must be greater than zero'}, status=400)

        cutoff = timezone.now() - timedelta(minutes=30)
        existing = RazorpayTransaction.objects.filter(
            invoice=invoice,
            status__in=['created', 'initiated', 'pending'],
            created_at__gte=cutoff,
        ).order_by('-created_at').first()
        if existing:
            logger.info('Razorpay: reusing order %s for invoice %s', existing.razorpay_order_id, invoice.invoice_number)
            return Response({
                'order_id': existing.razorpay_order_id,
                'amount': amount_paise,
                'currency': 'INR',
                'key_id': env('RAZORPAY_KEY_ID', default='').strip(),
            })

        receipt = generate_receipt(invoice.invoice_number)
        result = create_order(
            amount_paise=amount_paise,
            receipt=receipt,
            notes={'invoice_number': invoice.invoice_number, 'invoice_id': str(invoice.pk)},
        )

        RazorpayTransaction.objects.create(
            invoice=invoice,
            razorpay_order_id=result['order_id'] if result['success'] else f'FAILED-{receipt}',
            merchant_transaction_id=receipt,
            amount=amount_rupees,
            status='created' if result['success'] else 'failed',
            failure_reason=str(result.get('error', '')) if not result['success'] else '',
            response_data=str(result.get('error', '')),
        )

        if not result['success']:
            logger.warning('Razorpay order creation failed for invoice %s: %s', invoice.invoice_number, result.get('error'))
            return Response({'error': result.get('error', 'Razorpay order creation failed')}, status=502)

        logger.info('Razorpay: created order %s for invoice %s amount=%s', result['order_id'], invoice.invoice_number, amount_rupees)
        return Response({
            'order_id': result['order_id'],
            'amount': amount_paise,
            'currency': 'INR',
            'key_id': env('RAZORPAY_KEY_ID', default='').strip(),
        })


class RazorpayVerifyView(APIView):
    """Verify Razorpay payment after JS SDK callback.

    - HMAC-SHA256 signature verification.
    - Amount cross-check against Razorpay API.
    - Idempotent: already-success transactions return immediately.
    - Invoice marked PAID only after confirmed verification.
    """
    permission_classes = [IsCashierOrAdmin]

    def post(self, request):
        import logging
        from django.db import transaction as db_transaction
        from .services.razorpay_service import verify_signature, fetch_payment

        logger = logging.getLogger('razorpay')

        order_id = request.data.get('razorpay_order_id')
        checkout_order_id = request.data.get('razorpay_checkout_order_id')
        payment_id = request.data.get('razorpay_payment_id')
        signature = request.data.get('razorpay_signature')

        if not all([order_id, payment_id, signature]):
            return Response({'error': 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required'}, status=400)

        try:
            txn = RazorpayTransaction.objects.select_related('invoice').get(razorpay_order_id=order_id)
        except RazorpayTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=404)

        if txn.invoice and txn.invoice.business_id != request.user.business_id:
            return Response({'error': 'Transaction not found'}, status=404)

        if checkout_order_id and checkout_order_id != order_id:
            logger.warning('Razorpay checkout order mismatch for order %s', order_id)
            return Response({'error': 'Payment order does not match this invoice', 'success': False}, status=400)

        if txn.status == 'success':
            return Response({
                'status': 'success', 'success': True,
                'razorpay_payment_id': txn.razorpay_payment_id,
                'razorpay_order_id': order_id,
                'amount': str(txn.amount),
                'invoice_id': txn.invoice_id,
            })

        if not verify_signature(txn.razorpay_order_id, payment_id, signature):
            logger.warning('Razorpay signature verification failed for order %s', order_id)
            txn.status = 'failed'
            txn.failure_reason = 'SIGNATURE_MISMATCH'
            txn.response_data = 'SIGNATURE_MISMATCH'
            txn.save(update_fields=['status', 'failure_reason', 'response_data', 'updated_at'])
            return Response({'error': 'Payment signature verification failed', 'success': False}, status=400)

        payment_result = fetch_payment(payment_id)
        razorpay_amount = None
        if payment_result['success']:
            razorpay_amount = payment_result['payment'].get('amount')

        with db_transaction.atomic():
            txn = RazorpayTransaction.objects.select_for_update().get(razorpay_order_id=order_id)
            if txn.status == 'success':
                return Response({
                    'status': 'success', 'success': True,
                    'razorpay_payment_id': txn.razorpay_payment_id,
                    'razorpay_order_id': order_id,
                    'amount': str(txn.amount),
                    'invoice_id': txn.invoice_id,
                })

            expected_paise = int(txn.amount * 100)
            if razorpay_amount is not None and razorpay_amount != expected_paise:
                logger.error('Razorpay amount mismatch for order %s: expected %s got %s', order_id, expected_paise, razorpay_amount)
                txn.status = 'failed'
                txn.failure_reason = f'AMOUNT_MISMATCH expected={expected_paise} got={razorpay_amount}'
                txn.response_data = txn.failure_reason
                txn.save(update_fields=['status', 'failure_reason', 'response_data', 'updated_at'])
                return Response({'error': 'Payment amount mismatch. Contact support.', 'success': False}, status=400)

            payment_data = payment_result.get('payment', {})
            txn.status = 'success'
            txn.razorpay_payment_id = payment_id
            txn.razorpay_signature = signature
            txn.provider_reference = payment_id
            txn.response_code = str(payment_data.get('status', '') if isinstance(payment_data, dict) else '')
            txn.response_data = str(payment_data)
            txn.save(update_fields=[
                'status', 'razorpay_payment_id', 'razorpay_signature',
                'provider_reference', 'response_code', 'response_data', 'updated_at',
            ])

            if txn.invoice_id:
                invoice = Invoice.objects.get(pk=txn.invoice_id)
                if invoice.payment_status != 'paid':
                    invoice.payment_status = 'paid'
                    invoice.paid_amount = invoice.grand_total
                    invoice.balance_due = Decimal('0')
                    invoice.payment_method = 'razorpay'
                    invoice.save(update_fields=['payment_status', 'paid_amount', 'balance_due', 'payment_method'])
                    Payment.objects.get_or_create(
                        invoice=invoice,
                        method='razorpay',
                        defaults={'amount': txn.amount, 'reference': payment_id},
                    )
                    logger.info('Razorpay: invoice %s marked PAID via order %s', invoice.invoice_number, order_id)

        return Response({
            'status': 'success', 'success': True,
            'razorpay_payment_id': payment_id,
            'razorpay_order_id': order_id,
            'amount': str(txn.amount),
            'invoice_id': txn.invoice_id,
        })


class PaymentReconciliationView(APIView):
    """Admin-only payment reconciliation listing all Razorpay transactions."""
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = RazorpayTransaction.objects.select_related('invoice').filter(
            invoice__business=request.user.business
        ).order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(razorpay_order_id__icontains=search) |
                Q(razorpay_payment_id__icontains=search) |
                Q(invoice__invoice_number__icontains=search)
            )

        page_size = min(int(request.query_params.get('page_size', 50)), 200)
        return Response(RazorpayTransactionSerializer(qs[:page_size], many=True).data)


from .services.notification_engine import NotificationEngine


class NotificationListView(APIView):
    """
    List notifications with filters and aggregated counts.
    Triggers notification engine checks automatically.
    """
    permission_classes = [IsCashierOrAdmin]

    def get(self, request):
        biz = request.user.business
        if not biz:
            return Response({
                'notifications': [],
                'unread_count': 0,
                'critical_count': 0,
                'pending_approval_count': 0,
                'counts_by_type': {},
            })

        # Automatically execute active alert scanners
        NotificationEngine.run_all_checks(biz)

        qs = Notification.objects.filter(business=biz)

        is_read = request.query_params.get('is_read')
        if is_read is not None:
            if is_read.lower() == 'true':
                qs = qs.filter(is_read=True)
            elif is_read.lower() == 'false':
                qs = qs.filter(is_read=False)

        type_filter = request.query_params.get('type')
        if type_filter:
            qs = qs.filter(notification_type=type_filter)

        severity = request.query_params.get('severity')
        if severity:
            qs = qs.filter(severity=severity)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(message__icontains=search))

        limit = min(int(request.query_params.get('limit', 100)), 200)

        unread_count = Notification.objects.filter(business=biz, is_read=False).count()
        critical_count = Notification.objects.filter(
            business=biz, is_read=False, severity__in=['danger', 'warning']
        ).count()
        pending_approval_count = Notification.objects.filter(
            business=biz, requires_approval=True, status='active'
        ).count()

        counts_by_type = {}
        for row in Notification.objects.filter(business=biz, is_read=False).values('notification_type').annotate(cnt=Count('id')):
            counts_by_type[row['notification_type']] = row['cnt']

        return Response({
            'notifications': NotificationSerializer(qs[:limit], many=True).data,
            'unread_count': unread_count,
            'critical_count': critical_count,
            'pending_approval_count': pending_approval_count,
            'counts_by_type': counts_by_type,
        })


class NotificationMarkReadView(APIView):
    """Mark a single notification as read."""
    permission_classes = [IsCashierOrAdmin]

    def post(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, business=request.user.business)
            notif.is_read = True
            notif.read_at = timezone.now()
            notif.read_by = request.user
            notif.save(update_fields=['is_read', 'read_at', 'read_by', 'updated_at'])
            return Response({'status': 'ok', 'is_read': True})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)


class NotificationMarkAllReadView(APIView):
    """Mark all unread notifications as read for current business."""
    permission_classes = [IsCashierOrAdmin]

    def post(self, request):
        biz = request.user.business
        now = timezone.now()
        updated = Notification.objects.filter(business=biz, is_read=False).update(
            is_read=True, read_at=now, read_by=request.user
        )
        return Response({'status': 'ok', 'updated_count': updated})


class NotificationActionView(APIView):
    """Approve or reject a user action requiring approval."""
    permission_classes = [IsManagerOrAdmin]

    def post(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, business=request.user.business)
            action_type = request.data.get('action')  # 'approve' | 'reject'
            notes = request.data.get('notes', '').strip()

            if action_type not in ('approve', 'reject'):
                return Response(
                    {'error': 'Action must be "approve" or "reject"'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            notif.status = 'approved' if action_type == 'approve' else 'rejected'
            notif.actioned_by = request.user
            notif.actioned_at = timezone.now()
            notif.action_notes = notes
            notif.is_read = True
            notif.save()

            audit_event(request, 'update', 'Notification', notif.id, {
                'action': action_type,
                'notes': notes,
                'type': notif.notification_type,
            })

            return Response({
                'status': 'ok',
                'notification_status': notif.status,
                'actioned_by': request.user.username,
            })
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)


class NotificationTriggerCheckView(APIView):
    """Manually force execution of all 10 alert engines."""
    permission_classes = [IsCashierOrAdmin]

    def post(self, request):
        biz = request.user.business
        if biz:
            NotificationEngine.run_all_checks(biz)
        unread = Notification.objects.filter(business=biz, is_read=False).count()
        return Response({
            'status': 'ok',
            'message': 'Notification checks executed successfully',
            'unread_count': unread,
        })


# ─────────────────────────────────────────────────────────────
# WhatsApp & SMS Communication Actions & History
# ─────────────────────────────────────────────────────────────

from urllib.parse import quote


def _clean_phone(raw_phone):
    """Normalize Indian and international phone numbers for WhatsApp wa.me links."""
    p = str(raw_phone or '').strip()
    digits = ''.join(c for c in p if c.isdigit())
    if not digits:
        return ''
    if len(digits) == 10:
        return f"91{digits}"
    if len(digits) > 10 and digits.startswith('0'):
        return f"91{digits[1:]}"
    return digits



def _communication_profile(request_user):
    """Business identity for all customer/supplier messages."""
    business = getattr(request_user, 'business', None)
    shop_name = _report_setting(
        request_user,
        'shop_name',
        getattr(business, 'name', '') or 'Our Store',
    )
    return str(shop_name).strip() or 'Our Store'


def _message_phone(raw_phone):
    """Normalize Indian numbers for WhatsApp/SMS providers."""
    p = str(raw_phone or '').strip()
    digits = ''.join(c for c in p if c.isdigit())
    if not digits:
        return ''
    if len(digits) == 10:
        return f'91{digits}'
    if len(digits) > 10 and digits.startswith('0'):
        return f'91{digits[1:]}'
    return digits


def _invoice_message_body(shop_name, customer_name, invoice, short_url):
    status = str(invoice.payment_status or 'pending').replace('_', ' ').title()
    inv_date = invoice.created_at.strftime('%d %b %Y') if invoice.created_at else ''
    lines = [
        f'{shop_name}: Invoice {invoice.invoice_number}',
        f'Customer: {customer_name}',
        f'Date: {inv_date}',
        f'Amount: Rs.{invoice.grand_total:,.2f}',
        f'Payment: {status}',
    ]
    if short_url:
        lines += [f'View bill: {short_url}']
    lines += ['Thank you for shopping with us.']
    return '\n'.join(lines)


def _payment_reminder_body(shop_name, customer_name, amount, short_url=''):
    lines = [
        f'{shop_name}: Payment reminder',
        f'Dear {customer_name},',
        f'Balance due: Rs.{amount:,.2f}.',
    ]
    if short_url:
        lines.append(f'View pending bill: {short_url}')
    lines.append('Please clear the pending balance at your convenience. Thank you.')
    return '\n'.join(lines)


def _statement_message_body(shop_name, customer_name, total_invoiced, total_paid, outstanding, short_url=''):
    lines = [
        f'{shop_name}: Account statement',
        f'Dear {customer_name},',
        f'Total billed: Rs.{total_invoiced:,.2f}',
        f'Total paid: Rs.{total_paid:,.2f}',
        f'Balance due: Rs.{outstanding:,.2f}',
    ]
    if short_url:
        lines.append(f'View recent bill: {short_url}')
    lines.append('Thank you for your business.')
    return '\n'.join(lines)


def _purchase_message_body(shop_name, supplier_name, purchase, items_count):
    po_date = purchase.created_at.strftime('%d %b %Y') if purchase.created_at else ''
    return '\n'.join([
        f'{shop_name}: Purchase order {purchase.invoice_number}',
        f'Supplier: {supplier_name}',
        f'Date: {po_date}',
        f'Items: {items_count}',
        f'Total: Rs.{purchase.total_amount:,.2f}',
        'Please confirm receipt and expected delivery date.',
    ])


class InvoiceSendWhatsAppView(APIView):
    """
    Generate official WhatsApp message for an invoice with canonical 6-character short link
    and record communication history.
    """
    permission_classes = [IsCashierOrAdmin]

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.select_related('customer', 'business').prefetch_related('items').get(
                pk=pk, business=request.user.business
            )
        except Invoice.DoesNotExist:
            raise Http404('Invoice not found')

        phone = request.data.get('phone') or invoice.customer_phone or (invoice.customer.mobile if invoice.customer else '')
        clean_phone = _clean_phone(phone)
        customer_name = (invoice.customer.name if invoice.customer else invoice.customer_name) or 'Valued Customer'
        shop_name = (
            Setting.objects.filter(business=request.user.business, key='shop_name').first()
            or getattr(request.user.business, 'name', '')
            or 'Our Store'
        )
        if hasattr(shop_name, 'value'):
            shop_name = shop_name.value

        # Canonical existing 6-character short link (e.g. https://billing-erp-7ga7.onrender.com/s/x3gIro/)
        short_url = invoice.get_short_url(request=request)
        inv_date = invoice.created_at.strftime('%d %b %Y') if invoice.created_at else ''

        body = _invoice_message_body(
            shop_name,
            customer_name,
            invoice,
            short_url,
        )

        whatsapp_url = (
            f"https://wa.me/{clean_phone}?text={quote(body)}"
            if clean_phone
            else f"https://wa.me/?text={quote(body)}"
        )

        log = CommunicationLog.objects.create(
            business=request.user.business,
            channel='whatsapp',
            message_type='invoice',
            recipient_name=customer_name,
            recipient_phone=clean_phone or phone,
            reference_type='invoice',
            reference_id=str(invoice.pk),
            short_url=short_url,
            content=body,
            status='sent',
            sent_by=request.user,
        )

        audit_event(
            request,
            'COMMUNICATION_SENT',
            'Invoice',
            invoice.id,
            entity_name=invoice.invoice_number,
            after={'channel': 'whatsapp', 'recipient': clean_phone, 'short_url': short_url},
            reason=f'Invoice sent to {customer_name} via WhatsApp',
        )

        return Response({
            'status': 'sent',
            'short_url': short_url,
            'whatsapp_url': whatsapp_url,
            'message': body,
            'log': CommunicationLogSerializer(log).data,
        })


class CustomerSendReminderView(APIView):
    """
    Send payment reminder to customer with outstanding balance and short bill link.
    """
    permission_classes = [IsCashierOrAdmin]

    def post(self, request, pk):
        try:
            customer = Customer.objects.get(pk=pk, business=request.user.business)
        except Customer.DoesNotExist:
            raise Http404('Customer not found')

        phone = request.data.get('phone') or customer.mobile
        clean_phone = _clean_phone(phone)
        channel = request.data.get('channel', 'whatsapp').lower()

        shop_name = (
            Setting.objects.filter(business=request.user.business, key='shop_name').first()
            or getattr(request.user.business, 'name', '')
            or 'Our Store'
        )
        if hasattr(shop_name, 'value'):
            shop_name = shop_name.value

        latest_inv = Invoice.objects.filter(
            business=request.user.business,
            customer=customer,
            status='completed',
            balance_due__gt=0,
        ).order_by('-created_at').first()

        short_url = latest_inv.get_short_url(request=request) if latest_inv else ''

        amount = float(customer.outstanding_amount)
        bill_clause = f"\nView Pending Bill:\n{short_url}\n" if short_url else ""

        body = _payment_reminder_body(
            shop_name,
            customer.name,
            amount,
            short_url,
        )

        whatsapp_url = (
            f"https://wa.me/{clean_phone}?text={quote(body)}"
            if clean_phone
            else f"https://wa.me/?text={quote(body)}"
        )

        log = CommunicationLog.objects.create(
            business=request.user.business,
            channel=channel,
            message_type='payment_reminder',
            recipient_name=customer.name,
            recipient_phone=clean_phone or phone,
            reference_type='customer',
            reference_id=str(customer.pk),
            short_url=short_url,
            content=body,
            status='sent',
            sent_by=request.user,
        )

        audit_event(
            request,
            'COMMUNICATION_SENT',
            'Customer',
            customer.id,
            entity_name=customer.name,
            after={'channel': channel, 'type': 'payment_reminder', 'amount': amount},
            reason=f'Payment reminder sent to {customer.name}',
        )

        return Response({
            'status': 'sent',
            'short_url': short_url,
            'whatsapp_url': whatsapp_url,
            'message': body,
            'log': CommunicationLogSerializer(log).data,
        })


class CustomerSendStatementView(APIView):
    """
    Send account statement summary to customer via WhatsApp or SMS.
    """
    permission_classes = [IsCashierOrAdmin]

    def post(self, request, pk):
        try:
            customer = Customer.objects.get(pk=pk, business=request.user.business)
        except Customer.DoesNotExist:
            raise Http404('Customer not found')

        phone = request.data.get('phone') or customer.mobile
        clean_phone = _clean_phone(phone)
        channel = request.data.get('channel', 'whatsapp').lower()

        shop_name = (
            Setting.objects.filter(business=request.user.business, key='shop_name').first()
            or getattr(request.user.business, 'name', '')
            or 'Our Store'
        )
        if hasattr(shop_name, 'value'):
            shop_name = shop_name.value

        total_invoiced = Decimal(str(
            Invoice.objects.filter(customer=customer, business=request.user.business, status='completed')
            .aggregate(Sum('grand_total'))['grand_total__sum'] or '0'
        ))
        total_paid = Decimal(str(
            CustomerPayment.objects.filter(customer=customer, business=request.user.business)
            .aggregate(Sum('amount'))['amount__sum'] or '0'
        ))

        recent_inv = Invoice.objects.filter(
            business=request.user.business,
            customer=customer,
            status='completed',
        ).order_by('-created_at').first()
        short_url = recent_inv.get_short_url(request=request) if recent_inv else ''

        bill_clause = f"\nView Recent Bill:\n{short_url}\n" if short_url else ""

        body = _statement_message_body(
            shop_name,
            customer.name,
            total_invoiced,
            total_paid,
            customer.outstanding_amount,
            short_url,
        )

        whatsapp_url = (
            f"https://wa.me/{clean_phone}?text={quote(body)}"
            if clean_phone
            else f"https://wa.me/?text={quote(body)}"
        )

        log = CommunicationLog.objects.create(
            business=request.user.business,
            channel=channel,
            message_type='statement',
            recipient_name=customer.name,
            recipient_phone=clean_phone or phone,
            reference_type='customer',
            reference_id=str(customer.pk),
            short_url=short_url,
            content=body,
            status='sent',
            sent_by=request.user,
        )

        audit_event(
            request,
            'COMMUNICATION_SENT',
            'Customer',
            customer.id,
            entity_name=customer.name,
            after={'channel': channel, 'type': 'statement', 'outstanding': float(customer.outstanding_amount)},
            reason=f'Account statement sent to {customer.name}',
        )

        return Response({
            'status': 'sent',
            'short_url': short_url,
            'whatsapp_url': whatsapp_url,
            'message': body,
            'log': CommunicationLogSerializer(log).data,
        })


class PurchaseSendConfirmationView(APIView):
    """
    Send purchase order confirmation to supplier.
    """
    permission_classes = [IsManagerOrAbove]

    def post(self, request, pk):
        try:
            purchase = Purchase.objects.select_related('supplier', 'business').prefetch_related('items').get(
                pk=pk, business=request.user.business
            )
        except Purchase.DoesNotExist:
            raise Http404('Purchase order not found')

        supplier = purchase.supplier
        phone = request.data.get('phone') or (supplier.phone if supplier else '')
        clean_phone = _clean_phone(phone)
        channel = request.data.get('channel', 'whatsapp').lower()
        supplier_name = supplier.name if supplier else 'Supplier'

        shop_name = (
            Setting.objects.filter(business=request.user.business, key='shop_name').first()
            or getattr(request.user.business, 'name', '')
            or 'Our Store'
        )
        if hasattr(shop_name, 'value'):
            shop_name = shop_name.value

        items_count = purchase.items.count()
        po_date = purchase.created_at.strftime('%d %b %Y') if purchase.created_at else ''

        body = _purchase_message_body(
            shop_name,
            supplier_name,
            purchase,
            items_count,
        )

        whatsapp_url = (
            f"https://wa.me/{clean_phone}?text={quote(body)}"
            if clean_phone
            else f"https://wa.me/?text={quote(body)}"
        )

        log = CommunicationLog.objects.create(
            business=request.user.business,
            channel=channel,
            message_type='purchase_confirmation',
            recipient_name=supplier_name,
            recipient_phone=clean_phone or phone,
            reference_type='purchase',
            reference_id=str(purchase.pk),
            content=body,
            status='sent',
            sent_by=request.user,
        )

        audit_event(
            request,
            'COMMUNICATION_SENT',
            'Purchase',
            purchase.id,
            entity_name=purchase.invoice_number,
            after={'channel': channel, 'type': 'purchase_confirmation', 'total': float(purchase.total_amount)},
            reason=f'Purchase confirmation sent to {supplier_name}',
        )

        return Response({
            'status': 'sent',
            'whatsapp_url': whatsapp_url,
            'message': body,
            'log': CommunicationLogSerializer(log).data,
        })


class CommunicationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for communication history."""
    serializer_class = CommunicationLogSerializer
    permission_classes = [IsCashierOrAdmin]

    def get_queryset(self):
        qs = CommunicationLog.objects.select_related('sent_by').filter(business=self.request.user.business)
        ref_type = self.request.query_params.get('reference_type')
        ref_id = self.request.query_params.get('reference_id')
        msg_type = self.request.query_params.get('message_type')
        channel = self.request.query_params.get('channel')

        if ref_type:
            qs = qs.filter(reference_type=ref_type)
        if ref_id:
            qs = qs.filter(reference_id=str(ref_id))
        if msg_type:
            qs = qs.filter(message_type=msg_type)
        if channel:
            qs = qs.filter(channel=channel)
        return qs

