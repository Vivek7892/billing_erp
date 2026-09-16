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
from openpyxl import Workbook, load_workbook
from openpyxl.utils import get_column_letter
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from .models import *
from .serializers import *
from .permissions import (
    IsAdmin, IsAdminOrReadOnly, IsCashierOrAdmin, IsFinanceStaff,
    IsManagerOrAdmin, IsManagerOrReadOnly,
)
from .supabase_storage import SupabaseStorageError, upload_shop_logo
from .pagination import NoPagination, StandardPagination
from .utils import audit_event
from .services.report_service import ReportService
from django_filters.rest_framework import DjangoFilterBackend


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


def _export_report_xlsx(title, headers, rows, filename, summary_rows=None):
    """
    Professional spreadsheet export used by every report.
    Keeps a consistent ShopEase-style hierarchy across Sales, Product,
    Profit, GST, Customer Credit, Payment and Expense reports.
    """
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = title[:31]

    # Palette
    NAVY = '1E3A8A'
    BLUE = '2563EB'
    LIGHT_BLUE = 'EFF6FF'
    SLATE = '475569'
    BORDER = 'CBD5E1'
    WHITE = 'FFFFFF'
    ALT = 'F8FAFC'

    max_cols = max(len(headers), 2)
    last_col = max_cols

    # Title bar
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=last_col)
    title_cell = sheet.cell(row=1, column=1, value=title.upper())
    title_cell.font = Font(name='Calibri', bold=True, size=18, color=WHITE)
    title_cell.fill = PatternFill('solid', fgColor=NAVY)
    title_cell.alignment = Alignment(horizontal='left', vertical='center')
    sheet.row_dimensions[1].height = 30

    # Generated timestamp
    sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=last_col)
    generated_cell = sheet.cell(
        row=2,
        column=1,
        value=f"Generated: {timezone.localtime(timezone.now()).strftime('%d-%m-%Y %I:%M %p')}"
    )
    generated_cell.font = Font(name='Calibri', italic=True, size=9, color=SLATE)
    generated_cell.fill = PatternFill('solid', fgColor=LIGHT_BLUE)
    generated_cell.alignment = Alignment(horizontal='left', vertical='center')
    sheet.row_dimensions[2].height = 20

    row_index = 4

    # KPI / summary block
    if summary_rows:
        summary_count = len(summary_rows)
        compact = summary_count <= last_col
        summary_width = max(1, last_col // summary_count) if compact else last_col
        for i, (label, value) in enumerate(summary_rows):
            if compact:
                col = 1 + i * summary_width
                end_col = min(last_col, col + summary_width - 1)
            else:
                col = 1
                end_col = last_col

            sheet.merge_cells(
                start_row=row_index,
                start_column=col,
                end_row=row_index,
                end_column=end_col,
            )
            label_cell = sheet.cell(row=row_index, column=col, value=str(label).upper())
            label_cell.font = Font(bold=True, size=9, color=SLATE)
            label_cell.fill = PatternFill('solid', fgColor=LIGHT_BLUE)
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
                value=_report_value(value),
            )
            value_cell.font = Font(bold=True, size=13, color=NAVY)
            value_cell.fill = PatternFill('solid', fgColor='FFFFFF')
            value_cell.alignment = Alignment(horizontal='left', vertical='center')

            for r in (row_index, row_index + 1):
                for c in range(col, end_col + 1):
                    sheet.cell(row=r, column=c).border = Border(
                        left=Side(style='thin', color=BORDER),
                        right=Side(style='thin', color=BORDER),
                        top=Side(style='thin', color=BORDER),
                        bottom=Side(style='thin', color=BORDER),
                    )

            if not compact:
                row_index += 2

        if compact:
            sheet.row_dimensions[row_index].height = 20
            sheet.row_dimensions[row_index + 1].height = 25
            row_index += 4
        else:
            row_index += 2

    # Report table header
    for col_index, header in enumerate(headers, 1):
        cell = sheet.cell(row=row_index, column=col_index, value=header)
        cell.font = Font(bold=True, size=10, color=WHITE)
        cell.fill = PatternFill('solid', fgColor=BLUE)
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = Border(
            left=Side(style='thin', color=WHITE),
            right=Side(style='thin', color=WHITE),
            top=Side(style='thin', color=WHITE),
            bottom=Side(style='thin', color=WHITE),
        )
    sheet.row_dimensions[row_index].height = 24
    header_row = row_index
    row_index += 1

    # Data rows
    for data_index, row in enumerate(rows):
        for col_index, value in enumerate(row, 1):
            cell = sheet.cell(row=row_index, column=col_index, value=_report_value(value))
            cell.font = Font(name='Calibri', size=10, color='1E293B')
            cell.alignment = Alignment(
                horizontal='left' if col_index == 1 else 'right',
                vertical='center',
                wrap_text=True,
            )
            if data_index % 2 == 1:
                cell.fill = PatternFill('solid', fgColor=ALT)
            cell.border = Border(
                bottom=Side(style='hair', color=BORDER),
            )
        sheet.row_dimensions[row_index].height = 21
        row_index += 1

    # Total/footer row emphasis when summary exists.
    if rows and summary_rows:
        for col in range(1, last_col + 1):
            cell = sheet.cell(row=row_index - 1, column=col)
            cell.border = Border(
                bottom=Side(style='thin', color=BORDER),
            )

    # Freeze table header and enable filters.
    sheet.freeze_panes = f'A{header_row + 1}'
    sheet.auto_filter.ref = f"A{header_row}:{sheet.cell(row=max(header_row, row_index - 1), column=last_col).coordinate}"

    # Print / page setup.
    sheet.sheet_view.showGridLines = False
    sheet.page_setup.orientation = 'landscape' if len(headers) >= 5 else 'portrait'
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.print_title_rows = f'{header_row}:{header_row}'
    sheet.page_margins.left = 0.3
    sheet.page_margins.right = 0.3
    sheet.page_margins.top = 0.5
    sheet.page_margins.bottom = 0.5

    # Sensible widths.
    for col_index in range(1, last_col + 1):
        values = [
            _report_value(sheet.cell(row=r, column=col_index).value)
            for r in range(header_row, row_index)
        ]
        width = max([len(v) for v in values if v] + [12])
        if col_index == 1:
            width = min(max(width + 3, 18), 34)
        else:
            width = min(max(width + 3, 12), 24)
        sheet.column_dimensions[get_column_letter(col_index)].width = width

    buffer = BytesIO()
    workbook.save(buffer)
    return _report_response(
        filename,
        buffer.getvalue(),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )


def _export_report_pdf(title, headers, rows, filename, summary_rows=None, request_user=None):
    """
    Professional A4 report PDF:
      - Branded two-column header
      - Report title and generated timestamp
      - Compact KPI summary cards
      - Clean table with alternating rows
      - Minimal footer with page number and shop contact
    """
    from .models import Setting
    import os
    import glob
    from reportlab.platypus import Image as RLImage

    def get_setting(key, default=''):
        if request_user is not None and getattr(request_user, 'business', None):
            setting = Setting.objects.filter(
                business=request_user.business,
                key=key,
            ).first()
        else:
            setting = Setting.objects.filter(key=key).first()
        return setting.value if setting else default

    shop_name = get_setting('shop_name', 'ShopEase POS')
    shop_address = get_setting('shop_address', '')
    shop_phone = get_setting('shop_phone', '')
    shop_email = get_setting('shop_email', '')
    shop_gstin = get_setting('shop_gstin', '')
    shop_logo_url = get_setting('shop_logo', '')

    now = timezone.localtime(timezone.now())
    generated_at = now.strftime('%d-%m-%Y %I:%M %p')

    # Consistent report palette.
    NAVY = colors.HexColor('#1E3A8A')
    BLUE = colors.HexColor('#2563EB')
    LIGHT_BLUE = colors.HexColor('#EFF6FF')
    ROW_ALT = colors.HexColor('#F8FAFC')
    BORDER = colors.HexColor('#CBD5E1')
    TEXT = colors.HexColor('#1E293B')
    SUBTLE = colors.HexColor('#64748B')
    WHITE = colors.white

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=10 * mm,
        bottomMargin=17 * mm,
        title=title,
        author=shop_name,
        subject=f'{title} generated by {shop_name}',
    )

    story = []
    body_w = A4[0] - 24 * mm

    # Logo
    logo_img = None
    try:
        from django.conf import settings as django_settings
        media_root = str(django_settings.MEDIA_ROOT)
        media_url = django_settings.MEDIA_URL

        if shop_logo_url and shop_logo_url.startswith(media_url):
            rel = shop_logo_url[len(media_url):]
            full = os.path.join(media_root, rel)
            if os.path.exists(full):
                logo_img = RLImage(full, width=16 * mm, height=16 * mm)

        if not logo_img:
            matches = glob.glob(os.path.join(media_root, 'shop_logos', '*'))
            if matches:
                logo_img = RLImage(matches[0], width=16 * mm, height=16 * mm)
    except Exception:
        logo_img = None

    # Styles
    shop_style = ParagraphStyle(
        'report_shop_name_v2',
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=17,
        alignment=TA_LEFT,
        textColor=NAVY,
    )
    shop_sub = ParagraphStyle(
        'report_shop_sub_v2',
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        alignment=TA_LEFT,
        textColor=SUBTLE,
    )
    report_title = ParagraphStyle(
        'report_title_v2',
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=17,
        alignment=TA_RIGHT,
        textColor=TEXT,
    )
    report_meta = ParagraphStyle(
        'report_meta_v2',
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        alignment=TA_RIGHT,
        textColor=SUBTLE,
    )

    shop_lines = [Paragraph(shop_name or 'ShopEase POS', shop_style)]
    if shop_address:
        shop_lines.append(Paragraph(shop_address.replace('\n', ', '), shop_sub))

    contact_parts = []
    if shop_phone:
        contact_parts.append(f'Phone: {shop_phone}')
    if shop_email:
        contact_parts.append(f'Email: {shop_email}')
    if shop_gstin:
        contact_parts.append(f'GSTIN: {shop_gstin}')
    if contact_parts:
        shop_lines.append(Paragraph(' | '.join(contact_parts), shop_sub))

    right_lines = [
        Paragraph(title.upper(), report_title),
        Spacer(1, 1 * mm),
        Paragraph(f'Generated: {generated_at}', report_meta),
    ]

    if logo_img:
        header_tbl = Table(
            [[logo_img, shop_lines, right_lines]],
            colWidths=[18 * mm, body_w * 0.56, body_w * 0.44 - 18 * mm],
        )
        header_style = [
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (0, 0), 4),
        ]
    else:
        header_tbl = Table(
            [[shop_lines, right_lines]],
            colWidths=[body_w * 0.58, body_w * 0.42],
        )
        header_style = [
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]

    header_tbl.setStyle(TableStyle(header_style))
    story.append(header_tbl)
    story.append(Spacer(1, 3 * mm))

    # Full-width branded divider.
    rule = Table([['']], colWidths=[body_w])
    rule.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 1.1, BLUE),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(rule)
    story.append(Spacer(1, 4 * mm))

    # Summary cards.
    if summary_rows:
        count = len(summary_rows)
        gap = 3 * mm
        card_w = (body_w - gap * (count - 1)) / count

        card_data = []
        for label, value in summary_rows:
            card_data.append([
                Paragraph(
                    str(label).upper(),
                    ParagraphStyle(
                        f'summary_label_{len(card_data)}',
                        fontName='Helvetica-Bold',
                        fontSize=6.8,
                        leading=8,
                        textColor=SUBTLE,
                        alignment=TA_LEFT,
                    ),
                ),
                Paragraph(
                    _rupee(_report_value(value)),
                    ParagraphStyle(
                        f'summary_value_{len(card_data)}',
                        fontName='Helvetica-Bold',
                        fontSize=10,
                        leading=12,
                        textColor=NAVY,
                        alignment=TA_LEFT,
                    ),
                ),
            ])

        cards = []
        for i, card in enumerate(card_data):
            card_tbl = Table(
                [[card[0]], [card[1]]],
                colWidths=[card_w],
                rowHeights=[7 * mm, 8 * mm],
            )
            card_tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BLUE),
                ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            cards.append(card_tbl)

        summary_tbl = Table(
            [cards],
            colWidths=[card_w] * count,
            hAlign='LEFT',
        )
        summary_tbl.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), gap),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        # Remove gap after final card.
        summary_tbl.setStyle(TableStyle([
            ('RIGHTPADDING', (-1, 0), (-1, 0), 0),
        ]))

        story.append(summary_tbl)
        story.append(Spacer(1, 5 * mm))

    # Table styles.
    h_style = ParagraphStyle(
        'report_table_header_v2',
        fontName='Helvetica-Bold',
        fontSize=7.2,
        leading=8.5,
        alignment=TA_CENTER,
        textColor=WHITE,
    )
    c_style = ParagraphStyle(
        'report_table_cell_v2',
        fontName='Helvetica',
        fontSize=7.2,
        leading=8.5,
        alignment=TA_LEFT,
        textColor=TEXT,
    )
    c_right = ParagraphStyle(
        'report_table_cell_right_v2',
        fontName='Helvetica',
        fontSize=7.2,
        leading=8.5,
        alignment=TA_RIGHT,
        textColor=TEXT,
    )

    header_row = [Paragraph(str(h), h_style) for h in headers]
    currency_keywords = (
        'amount', 'revenue', 'cost', 'profit', 'total',
        'sales', 'discount', 'tax', 'gst', 'outstanding',
        'credit', 'expense', 'payment', 'price', 'value',
    )

    data_rows = []
    for row in rows:
        formatted = []
        for j, value in enumerate(row):
            header_name = str(headers[j]).lower() if j < len(headers) else ''
            is_currency = any(keyword in header_name for keyword in currency_keywords)
            display = _rupee(_report_value(value)) if is_currency else _report_value(value)
            formatted.append(
                Paragraph(display, c_right if j > 0 else c_style)
            )
        data_rows.append(formatted)

    if headers:
        # Give the first column slightly more room for product/customer descriptions.
        n = len(headers)
        if n == 3:
            widths = [body_w * 0.28, body_w * 0.22, body_w * 0.50]
        elif n == 4:
            widths = [body_w * 0.28, body_w * 0.20, body_w * 0.26, body_w * 0.26]
        elif n == 5:
            widths = [body_w * 0.25, body_w * 0.15, body_w * 0.20, body_w * 0.20, body_w * 0.20]
        else:
            widths = [body_w / n] * n

        table = Table(
            [header_row] + data_rows,
            colWidths=widths,
            repeatRows=1,
            repeatCols=0,
            splitByRow=1,
            hAlign='LEFT',
        )

        style = [
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
            ('LINEBELOW', (0, 0), (-1, 0), 0.6, NAVY),
            ('LINEBELOW', (0, 1), (-1, -1), 0.25, BORDER),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 3.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]

        for i in range(1, len(data_rows) + 1):
            if i % 2 == 0:
                style.append(('BACKGROUND', (0, i), (-1, i), ROW_ALT))

        table.setStyle(TableStyle(style))
        story.append(table)
    else:
        story.append(Paragraph('No report data available.', c_style))

    # Footer.
    def draw_page_footer(canvas, doc):
        canvas.saveState()
        page_width, _ = A4

        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(12 * mm, 9 * mm, page_width - 12 * mm, 9 * mm)

        footer_style = ParagraphStyle(
            'report_footer_v2',
            fontName='Helvetica',
            fontSize=6.5,
            leading=8,
            alignment=TA_LEFT,
            textColor=SUBTLE,
        )

        contact = []
        if shop_name:
            contact.append(shop_name)
        if shop_phone:
            contact.append(f'Phone: {shop_phone}')
        if shop_email:
            contact.append(f'Email: {shop_email}')

        footer_contact = Paragraph(' | '.join(contact), footer_style)
        footer_contact.wrapOn(canvas, body_w - 20 * mm, 5 * mm)
        footer_contact.drawOn(canvas, 12 * mm, 5 * mm)

        page_style = ParagraphStyle(
            'report_page_number_v2',
            fontName='Helvetica-Bold',
            fontSize=6.5,
            leading=8,
            alignment=TA_RIGHT,
            textColor=SUBTLE,
        )
        page_text = Paragraph(f'Page {doc.page}', page_style)
        page_text.wrapOn(canvas, 20 * mm, 5 * mm)
        page_text.drawOn(canvas, page_width - 32 * mm, 5 * mm)

        canvas.restoreState()

    doc.build(
        story,
        onFirstPage=draw_page_footer,
        onLaterPages=draw_page_footer,
    )

    buffer.seek(0)
    return _report_response(
        filename,
        buffer.getvalue(),
        'application/pdf',
    )


class LoginView(APIView):
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if not user or not user.is_active:
            return Response({'error': 'Invalid username or password.', 'code': 'invalid_credentials'}, status=401)
        refresh = RefreshToken.for_user(user)
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
        audit_event(self.request, 'USER_CREATED', 'User', user.id, after={'username': user.username, 'role': user.role})


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
        serializer.save(business=self.request.user.business)


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
        audit_event(self.request, 'PRODUCT_CREATED', 'Product', product.id, after={'name': product.name})

    def perform_update(self, serializer):
        previous = f'{serializer.instance.purchase_price}|{serializer.instance.selling_price}|{serializer.instance.gst_percent}'
        product = serializer.save(business=self.request.user.business)
        current = f'{product.purchase_price}|{product.selling_price}|{product.gst_percent}'
        audit_event(self.request, 'PRODUCT_UPDATED', 'Product', product.id, before=previous, after=current)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ('owner', 'admin', 'manager'):
            return Response({'error': 'Permission denied'}, status=403)
        product = self.get_object()
        previous = product.status
        product.status = 'inactive'
        product.save(update_fields=['status', 'updated_at'])
        audit_event(self.request, 'PRODUCT_ARCHIVED', 'Product', product.id, before=previous, after=product.status)
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
        serializer.save(business=self.request.user.business)

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
        return Response({'detail': 'Use a purchase return for reversal.'}, status=405)


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
        return Response({'detail': 'Invoices are immutable after creation.'}, status=405)

    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Use cancel or refund for invoice reversal.'}, status=405)

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
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return Setting.objects.filter(business=self.request.user.business)

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        previous = {
            setting.key: setting.value
            for setting in self.get_queryset().filter(key__in=request.data.keys())
        }
        for key, value in request.data.items():
            Setting.objects.update_or_create(business=request.user.business, key=key, defaults={'value': str(value)})
        audit_event(request, 'SETTINGS_CHANGED', 'Setting', request.user.business_id, before=previous, after=request.data)
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
        audit_event(request, 'SETTINGS_CHANGED', 'Setting', request.user.business_id, after={'shop_logo': url})
        return Response({'url': url})

    @action(detail=False, methods=['post'], url_path='remove-logo')
    def remove_logo(self, request):
        Setting.objects.update_or_create(
            business=request.user.business,
            key='shop_logo',
            defaults={'value': ''},
        )
        audit_event(request, 'SETTINGS_CHANGED', 'Setting', request.user.business_id, after={'shop_logo': ''})
        return Response({'url': ''})

    @action(detail=False, methods=['get'], permission_classes=[IsCashierOrAdmin])
    def all(self, request):
        defaults = {
            # Business
            'shop_name': '', 'shop_address': '', 'shop_phone': '', 'shop_email': '',
            'shop_gstin': '', 'shop_pan': '', 'shop_logo': '', 'shop_state': '',
            'business_type': 'retail_wholesale', 'cin': '', 'fssai_licence': '',
            'fy_start': 'april',
            # Invoice
            'invoice_prefix': 'INV', 'invoice_start_number': '1001',
            'invoice_template': 'gst_a4', 'invoice_due_days': '15',
            'invoice_terms': '', 'invoice_footer': '',
            'show_discount_col': 'true', 'show_hsn_col': 'true',
            'show_batch_col': 'false', 'show_expiry_col': 'false',
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
            'currency': '₹', 'allow_negative_stock': 'false',
            # Policies & Legal
            'terms_url': '', 'privacy_url': '', 'refund_url': '',
            'return_url': '', 'shipping_url': '',
        }
        saved = {s.key: s.value for s in self.get_queryset()}
        return Response({**defaults, **saved})


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
            f'{report.filename}.xlsx', summary_rows=report.summary_rows,
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
        return _invoice_pdf_response(invoice, request.query_params.get('printer'))


def _invoice_pdf_response(invoice, printer=None):
    """Generate an inline invoice PDF for both staff and public short links."""
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
    response['Content-Disposition'] = f'inline; filename="invoice-{invoice.invoice_number}-{suffix}.pdf"'
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
        return _invoice_pdf_response(link.invoice, request.query_params.get('printer'))


class CancelInvoiceView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from .services.invoice_service import InvoiceService
        try:
            invoice = InvoiceService.cancel_invoice(
                invoice_id=pk,
                business=request.user.business,
                performed_by=request.user,
                request=request,
            )
        except LookupError as exc:
            return Response({'error': str(exc)}, status=404)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response({'status': 'cancelled'})


class RefundInvoiceView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from .services.invoice_service import InvoiceService
        try:
            invoice = InvoiceService.refund_invoice(
                invoice_id=pk,
                business=request.user.business,
                performed_by=request.user,
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
    permission_classes = [IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['module', 'action', 'result']
    search_fields = ['action', 'entity', 'entity_id']
    ordering = ['-created_at']

    def get_queryset(self):
        return AuditLog.objects.select_related('user').filter(
            business=self.request.user.business
        )


# ─────────────────────────────────────────────────────────────
# Razorpay Payment Gateway
# ─────────────────────────────────────────────────────────────

class RazorpayWebhookView(APIView):
    """S2S webhook from Razorpay — verifies the X-Razorpay-Signature and marks
    the invoice paid without any frontend involvement.

    Register this URL in the Razorpay Dashboard under Webhooks.
    """
    authentication_classes = []
    permission_classes = []
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        import hmac
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
            expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, signature):
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
            # `invoice` is nullable. PostgreSQL cannot apply FOR UPDATE to the
            # nullable side of select_related's OUTER JOIN, so lock only the
            # transaction row and load its invoice separately when needed.
            txn = RazorpayTransaction.objects.select_for_update().get(
                razorpay_order_id=order_id
            )
            if txn.status == 'success':
                return Response({'status': 'already_processed'})

            txn.status = new_status
            txn.razorpay_payment_id = payment_id
            txn.response_data = str(payload)
            txn.save(update_fields=['status', 'razorpay_payment_id', 'response_data', 'updated_at'])

            if new_status == 'success' and txn.invoice_id:
                invoice = txn.invoice
                expected_paise = int(txn.amount * 100)
                if razorpay_amount and razorpay_amount != expected_paise:
                    logger.error('Razorpay webhook amount mismatch order %s: expected %s got %s', order_id, expected_paise, razorpay_amount)
                    txn.status = 'failed'
                    txn.response_data = f'AMOUNT_MISMATCH expected={expected_paise} got={razorpay_amount}'
                    txn.save(update_fields=['status', 'response_data', 'updated_at'])
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

    Security rules:
    - Amount is always taken from the saved invoice grand_total, never from the frontend.
    - Idempotent: returns existing initiated/pending order if created within last 30 minutes.
    - Returns the order_id and key_id needed by the Razorpay JS SDK on the frontend.
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

        # Idempotency: reuse existing initiated/pending order within last 30 minutes
        cutoff = timezone.now() - timedelta(minutes=30)
        existing = RazorpayTransaction.objects.filter(
            invoice=invoice,
            status__in=['initiated', 'pending'],
            created_at__gte=cutoff,
        ).order_by('-created_at').first()
        if existing:
            logger.info('Razorpay: reusing existing order %s for invoice %s', existing.razorpay_order_id, invoice.invoice_number)
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
            amount=amount_rupees,
            status='initiated' if result['success'] else 'failed',
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
    """Verify Razorpay payment after the JS SDK callback.

    Security rules:
    - Verifies the Razorpay signature using HMAC-SHA256.
    - Checks amount from Razorpay API matches the transaction record.
    - Idempotent: already-success transactions return immediately.
    - Only marks invoice PAID after confirmed signature verification.
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

        # Checkout should echo the server-created order ID. Treat a mismatch
        # as invalid rather than calculating a signature with attacker input.
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

        # Razorpay's required HMAC is calculated using the order ID stored on
        # our server and the checkout payment ID. Do not use the checkout
        # order field as the HMAC source.
        if not verify_signature(txn.razorpay_order_id, payment_id, signature):
            logger.warning('Razorpay signature verification failed for order %s', order_id)
            txn.status = 'failed'
            txn.response_data = 'SIGNATURE_MISMATCH'
            txn.save(update_fields=['status', 'response_data', 'updated_at'])
            return Response({'error': 'Payment signature verification failed', 'success': False}, status=400)

        # Fetch authoritative payment details from Razorpay
        payment_result = fetch_payment(payment_id)
        razorpay_amount = None
        if payment_result['success']:
            razorpay_amount = payment_result['payment'].get('amount')

        with db_transaction.atomic():
            # Do not combine select_for_update() with select_related('invoice'):
            # Invoice is nullable and PostgreSQL rejects that OUTER JOIN lock.
            txn = RazorpayTransaction.objects.select_for_update().get(
                razorpay_order_id=order_id
            )
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
                txn.response_data = f'AMOUNT_MISMATCH expected={expected_paise} got={razorpay_amount}'
                txn.save(update_fields=['status', 'response_data', 'updated_at'])
                return Response({'error': 'Payment amount mismatch. Contact support.', 'success': False}, status=400)

            txn.status = 'success'
            txn.razorpay_payment_id = payment_id
            txn.razorpay_signature = signature
            txn.response_data = str(payment_result.get('payment', ''))
            txn.save(update_fields=['status', 'razorpay_payment_id', 'razorpay_signature', 'response_data', 'updated_at'])

            if txn.invoice_id:
                invoice = txn.invoice
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


