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
from .services.inventory_service import InventoryService
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

def _report_period_label(params):
    start = params.get('start_date')
    end = params.get('end_date')
    if not start or not end:
        return 'All available records'
    try:
        from datetime import datetime
        start_date = datetime.strptime(str(start), '%Y-%m-%d')
        end_date = datetime.strptime(str(end), '%Y-%m-%d')
        return f'{start_date:%d/%b/%Y} - {end_date:%d/%b/%Y}'
    except (TypeError, ValueError):
        return f'{start} - {end}'

def _format_report_summary_value(label, value):
    label_text = str(label or '').lower()
    if any(token in label_text for token in ('count', 'qty', 'quantity', '%', 'margin')):
        return _report_value(value)
    return _format_report_money(value)


def _export_report_xlsx(
    title,
    headers,
    rows,
    filename,
    summary_rows=None,
    request_user=None,
    period_label='',
):
    """
    Clean, professional, unmerged Excel report exporter with native number formatting.
    """
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = (title or 'Report')[:31]

    profile = _get_report_business_profile(request_user)
    logo_bytes = _download_report_logo(profile.get('shop_logo'))

    FONT_FAMILY = 'Calibri'
    C_TEXT = '111827'
    C_MUTED = '4B5563'
    C_HEADER_BG = 'F3F4F6'
    C_ROW_ALT = 'F9FAFB'
    C_BORDER = 'D1D5DB'
    C_BORDER_LIGHT = 'E5E7EB'

    thin_border = Border(
        left=Side(style='thin', color=C_BORDER),
        right=Side(style='thin', color=C_BORDER),
        top=Side(style='thin', color=C_BORDER),
        bottom=Side(style='thin', color=C_BORDER),
    )
    data_border = Border(
        bottom=Side(style='hair', color=C_BORDER_LIGHT),
    )

    # 1. Business Header Block
    shop_name = (profile.get('shop_name') or 'ShopEase POS').upper()
    c1 = sheet.cell(row=1, column=1, value=shop_name)
    c1.font = Font(name=FONT_FAMILY, bold=True, size=14, color=C_TEXT)

    contact_parts = [
        profile.get('shop_address'),
        f"Phone: {profile['shop_phone']}" if profile.get('shop_phone') else '',
        f"Email: {profile['shop_email']}" if profile.get('shop_email') else '',
        f"GSTIN: {profile['shop_gstin']}" if profile.get('shop_gstin') else '',
    ]
    contact_str = ' | '.join(p for p in contact_parts if p)
    c2 = sheet.cell(row=2, column=1, value=contact_str or shop_name)
    c2.font = Font(name=FONT_FAMILY, size=9, color=C_MUTED)

    if logo_bytes:
        try:
            report_logo = XLImage(BytesIO(logo_bytes))
            report_logo.width = 42
            report_logo.height = 42
            report_logo.anchor = 'A1'
            sheet.add_image(report_logo)
            c1 = sheet.cell(row=1, column=2, value=shop_name)
            c1.font = Font(name=FONT_FAMILY, bold=True, size=14, color=C_TEXT)
            c2 = sheet.cell(row=2, column=2, value=contact_str or shop_name)
            c2.font = Font(name=FONT_FAMILY, size=9, color=C_MUTED)
            sheet.cell(row=1, column=1).value = None
            sheet.cell(row=2, column=1).value = None
            sheet.row_dimensions[1].height = 25
            sheet.row_dimensions[2].height = 25
        except Exception:
            pass

    # 2. Report Title & Metadata
    c3 = sheet.cell(row=4, column=1, value=title.upper())
    c3.font = Font(name=FONT_FAMILY, bold=True, size=12, color=C_TEXT)

    gen_time = timezone.localtime(timezone.now()).strftime('%d/%b/%Y %I:%M %p')
    period_str = f"Period: {period_label} | " if period_label else ""
    c4 = sheet.cell(row=5, column=1, value=f"{period_str}Generated: {gen_time}")
    c4.font = Font(name=FONT_FAMILY, italic=True, size=9, color=C_MUTED)

    sheet.oddHeader.left.text = f'&B{shop_name}'
    sheet.oddHeader.right.text = title
    sheet.oddFooter.left.text = f'Confidential | Generated {gen_time}'
    sheet.oddFooter.right.text = 'Page &[Page] of &[Pages]'

    current_row = 7

    def _is_money_header(header):
        name = str(header or '').lower()
        if any(token in name for token in ('count', 'qty', 'quantity', 'transactions', 'entries', 'share', '%', 'slab')):
            return False
        return any(token in name for token in (
            'amount', 'revenue', 'cost', 'profit', 'total', 'sales', 'discount',
            'tax', 'gst', 'outstanding', 'credit', 'expense', 'payment', 'price',
            'value', 'collection', 'returns', 'net', 'balance', 'paid', 'due', 'limit', 'cogs'
        ))

    def _is_numeric_header(header):
        name = str(header or '').lower()
        return any(token in name for token in (
            'amount', 'revenue', 'cost', 'profit', 'total', 'sales', 'discount',
            'tax', 'gst', 'outstanding', 'credit', 'expense', 'payment', 'price',
            'value', 'collection', 'returns', 'net', 'balance', 'paid', 'due', 'limit',
            'cogs', 'qty', 'quantity', 'count', 'rate', 'share', '%', 'transactions', 'entries'
        ))

    # 3. Clean 2-column key-value summary table
    if summary_rows:
        valid_summary = [s for s in summary_rows if isinstance(s, (list, tuple)) and len(s) >= 2]
        if valid_summary:
            s_head1 = sheet.cell(row=current_row, column=1, value="SUMMARY METRIC")
            s_head2 = sheet.cell(row=current_row, column=2, value="VALUE")
            for cell in (s_head1, s_head2):
                cell.font = Font(name=FONT_FAMILY, bold=True, size=9, color=C_TEXT)
                cell.fill = PatternFill('solid', fgColor=C_HEADER_BG)
                cell.border = thin_border
            current_row += 1

            for label, value in valid_summary:
                lbl_cell = sheet.cell(row=current_row, column=1, value=str(label))
                lbl_cell.font = Font(name=FONT_FAMILY, size=9, color=C_TEXT)
                lbl_cell.border = thin_border

                val_cell = sheet.cell(row=current_row, column=2)
                val_cell.font = Font(name=FONT_FAMILY, bold=True, size=9, color=C_TEXT)
                val_cell.border = thin_border

                val_str = str(value or '').strip()
                label_lower = str(label or '').lower()

                if any(tok in label_lower for tok in ('count', 'qty', 'quantity', 'entries', 'invoices', 'customers', 'transactions')):
                    try:
                        val_cell.value = int(float(val_str.replace(',', '')))
                        val_cell.number_format = '#,##0'
                    except Exception:
                        val_cell.value = val_str
                elif '%' in label_lower or '%' in val_str:
                    try:
                        num = float(val_str.replace('%', '').strip()) / 100.0
                        val_cell.value = num
                        val_cell.number_format = '0.0%'
                    except Exception:
                        val_cell.value = val_str
                else:
                    try:
                        num = float(val_str.replace(',', '').replace('Rs.', '').replace('₹', '').strip())
                        val_cell.value = num
                        val_cell.number_format = '#,##0.00'
                    except Exception:
                        val_cell.value = val_str

                current_row += 1

            current_row += 1  # Blank row after summary

    # 4. Report Table Header
    header_row = current_row
    for col_idx, header in enumerate(headers or [], 1):
        cell = sheet.cell(row=header_row, column=col_idx, value=header)
        cell.font = Font(name=FONT_FAMILY, bold=True, size=10, color=C_TEXT)
        cell.fill = PatternFill('solid', fgColor=C_HEADER_BG)
        cell.alignment = Alignment(
            horizontal='right' if _is_numeric_header(header) else 'left',
            vertical='center',
            wrap_text=True,
        )
        cell.border = thin_border
    sheet.row_dimensions[header_row].height = 24
    current_row += 1

    # 5. Report Table Rows
    data_rows = list(rows or [])
    for row_idx, row in enumerate(data_rows):
        is_alt = (row_idx % 2 == 1)
        r_list = list(row or [])
        for col_idx, header in enumerate(headers or [], 1):
            val = r_list[col_idx - 1] if col_idx - 1 < len(r_list) else ''
            cell = sheet.cell(row=current_row, column=col_idx)
            cell.font = Font(name=FONT_FAMILY, size=9.5, color=C_TEXT)
            cell.border = data_border
            if is_alt:
                cell.fill = PatternFill('solid', fgColor=C_ROW_ALT)

            val_str = str(val or '').strip()
            if _is_money_header(header):
                try:
                    num = float(val_str.replace(',', '').replace('Rs.', '').replace('₹', '').strip())
                    cell.value = num
                    cell.number_format = '#,##0.00'
                    cell.alignment = Alignment(horizontal='right', vertical='center')
                except Exception:
                    cell.value = val_str
                    cell.alignment = Alignment(horizontal='right', vertical='center')
            elif any(tok in str(header).lower() for tok in ('count', 'qty', 'quantity', 'transactions', 'entries', 'invoices')):
                try:
                    cell.value = int(float(val_str.replace(',', '')))
                    cell.number_format = '#,##0'
                    cell.alignment = Alignment(horizontal='right', vertical='center')
                except Exception:
                    cell.value = val_str
                    cell.alignment = Alignment(horizontal='right', vertical='center')
            elif '%' in str(header) or '%' in val_str:
                try:
                    num = float(val_str.replace('%', '').strip()) / 100.0
                    cell.value = num
                    cell.number_format = '0.0%'
                    cell.alignment = Alignment(horizontal='right', vertical='center')
                except Exception:
                    cell.value = val_str
                    cell.alignment = Alignment(horizontal='right', vertical='center')
            else:
                cell.value = val_str
                cell.alignment = Alignment(
                    horizontal='right' if _is_numeric_header(header) else 'left',
                    vertical='center',
                )
        sheet.row_dimensions[current_row].height = 20
        current_row += 1

    if not data_rows:
        empty_cell = sheet.cell(row=current_row, column=1, value='No records found for this report period.')
        empty_cell.font = Font(name=FONT_FAMILY, italic=True, size=9.5, color=C_MUTED)
        sheet.row_dimensions[current_row].height = 22
        current_row += 1

    # Freeze panes and auto-filter
    sheet.freeze_panes = f'A{header_row + 1}'
    if headers:
        sheet.auto_filter.ref = (
            f"A{header_row}:{get_column_letter(len(headers))}{max(header_row, current_row - 1)}"
        )

    sheet.sheet_view.showGridLines = True
    sheet.page_setup.orientation = 'landscape' if len(headers or []) >= 5 else 'portrait'
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_margins.left = 0.3
    sheet.page_margins.right = 0.3
    sheet.page_margins.top = 0.5
    sheet.page_margins.bottom = 0.5
    sheet.print_title_rows = f'{header_row}:{header_row}'

    # Auto-size columns
    for col_idx in range(1, max(len(headers or []), 2) + 1):
        col_letter = get_column_letter(col_idx)
        max_len = 12
        for r in range(header_row, current_row):
            cv = sheet.cell(row=r, column=col_idx).value
            if cv is not None:
                max_len = max(max_len, len(str(cv)))
        sheet.column_dimensions[col_letter].width = min(max(max_len + 4, 12), 36)

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
    period_label='',
):
    """Monochrome, professional business report PDF with clean table layout."""
    from .pdf_utils import generate_report_pdf

    profile = _get_report_business_profile(request_user)
    logo_bytes = _download_report_logo(profile.get('shop_logo'))
    buffer = generate_report_pdf(
        title=title,
        headers=headers,
        rows=rows,
        business_profile=profile,
        summary_rows=summary_rows,
        period_label=period_label,
        logo_bytes=logo_bytes,
    )
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
    permission_classes = [IsManagerOrAdmin]
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

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        new_role = request.data.get('role')

        if new_role and new_role != instance.role:
            from .services.approval_service import ApprovalService
            req_appr, rule_desc = ApprovalService.should_require_approval(
                instance.business,
                request.user,
                'user_role_change',
                old_role=instance.role,
                new_role=new_role,
            )
            if req_appr:
                current_data = {
                    'user_id': instance.id,
                    'username': instance.username,
                    'current_role': instance.role,
                    'email': instance.email,
                }
                proposed_data = {
                    'user_id': instance.id,
                    'proposed_role': new_role,
                    'reason': request.data.get('reason', ''),
                }
                appr_req = ApprovalService.create_approval_request(
                    business=instance.business,
                    requested_by=request.user,
                    request_type='user_role_change',
                    entity_type='User',
                    entity_id=instance.id,
                    entity_name=f"{instance.username} ({instance.role} -> {new_role})",
                    current_data=current_data,
                    proposed_data=proposed_data,
                    threshold_rule=rule_desc,
                    reason=request.data.get('reason', ''),
                    request=request,
                )
                return Response({
                    'requires_approval': True,
                    'approval_request': ApprovalRequestSerializer(appr_req).data,
                    'message': f"Role change requires admin approval ({rule_desc}). Request submitted for review.",
                }, status=status.HTTP_202_ACCEPTED)

        return super().update(request, *args, partial=partial, **kwargs)

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

    def perform_destroy(self, instance):
        entity_id = instance.id
        entity_name = instance.name
        before = {'name': instance.name, 'phone': instance.phone, 'gstin': instance.gstin}
        instance.delete()
        audit_event(
            self.request,
            'SUPPLIER_DELETED',
            'Supplier',
            entity_id,
            entity_name=entity_name,
            before=before,
            reason=self.request.data.get('reason', 'Supplier record deleted'),
        )

    @action(detail=False, methods=['get'], url_path='import-template')
    def import_template(self, request):
        """Generate a downloadable, professionally formatted Excel template for bulk supplier import."""
        wb = Workbook()
        ws = wb.active
        ws.title = "Suppliers"

        headers = [
            ("Company / Supplier Name *", 32),
            ("Phone / Mobile", 20),
            ("Email Address", 28),
            ("Business Address", 38),
            ("GSTIN", 22),
        ]

        header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left_align = Alignment(horizontal="left", vertical="center")
        thin_border = Border(
            left=Side(style='thin', color='D7DEE7'),
            right=Side(style='thin', color='D7DEE7'),
            top=Side(style='thin', color='D7DEE7'),
            bottom=Side(style='thin', color='D7DEE7')
        )

        ws.row_dimensions[1].height = 28
        for col_idx, (col_name, width) in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=col_name)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align
            cell.border = thin_border
            ws.column_dimensions[get_column_letter(col_idx)].width = width

        sample_rows = [
            ("Balaji Traders Pvt Ltd", "9876543210", "sales@balajitraders.com", "123 MG Road, Bangalore, Karnataka - 560001", "29ABCDE1234F1Z5"),
            ("Sri Krishna Enterprises", "9123456789", "contact@srikrishna.in", "45 Market Yard, Pune, Maharashtra - 411037", "27AABCS1429B1ZB"),
            ("Ambika Agencies", "8012345678", "info@ambikaagencies.com", "Plot 12, Industrial Area, Chennai, TN - 600001", ""),
        ]

        sample_font = Font(name="Calibri", size=10, color="172033")
        for row_idx, sample in enumerate(sample_rows, start=2):
            ws.row_dimensions[row_idx].height = 20
            for col_idx, val in enumerate(sample, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.font = sample_font
                cell.alignment = left_align
                cell.border = thin_border

        note_row_idx = len(sample_rows) + 3
        ws.cell(row=note_row_idx, column=1, value="Instructions & Guidelines:").font = Font(name="Calibri", size=10, bold=True, color="1E3A5F")
        notes = [
            "1. Columns marked with (*) are required. 'Company / Supplier Name' cannot be blank.",
            "2. If GSTIN is provided, it must be exactly 15 alphanumeric characters.",
            "3. Phone numbers should be 10-15 digits. Landline or mobile accepted.",
            "4. Delete or replace the sample rows above with your actual supplier data.",
            "5. Save the file as .xlsx, .xls, or .csv and upload it in the Suppliers page."
        ]
        for idx, note in enumerate(notes, start=note_row_idx + 1):
            ws.cell(row=idx, column=1, value=note).font = Font(name="Calibri", size=9, italic=True, color="64748B")

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response['Content-Disposition'] = 'attachment; filename="Supplier_Import_Template.xlsx"'
        return response

    def _parse_supplier_file(self, upload):
        suffix = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
        if suffix == 'csv':
            try:
                decoded = upload.read().decode('utf-8-sig')
            except UnicodeDecodeError:
                upload.seek(0)
                decoded = upload.read().decode('latin-1')
            reader = list(csv.DictReader(decoded.splitlines()))
            return reader, None
        elif suffix in ('xlsx', 'xlsm', 'xls'):
            try:
                workbook = load_workbook(upload, read_only=True, data_only=True)
                sheet = workbook.active
                values = list(sheet.iter_rows(values_only=True))
                if not values:
                    return [], None
                header_row_idx = 0
                for idx, r in enumerate(values):
                    if any(r and any(k in str(v).lower() for k in ['name', 'supplier', 'company', 'phone', 'mobile']) for v in r if v is not None):
                        header_row_idx = idx
                        break
                headers = [str(value).strip() if value is not None else '' for value in values[header_row_idx]]
                rows = []
                for values_row in values[header_row_idx + 1:]:
                    first_val = str(values_row[0] or '').strip().lower() if values_row else ''
                    if first_val.startswith('instructions') or first_val.startswith('1.') or first_val.startswith('note'):
                        continue
                    if any(value is not None and str(value).strip() for value in values_row):
                        rows.append(dict(zip(headers, values_row)))
                return rows, None
            except Exception as exc:
                return None, f"Could not read spreadsheet: {str(exc)}"
        else:
            return None, "Unsupported file format. Please upload a .xlsx, .xls, or .csv file."

    def _normalize_row(self, raw_row):
        normalized = {}
        for key, val in raw_row.items():
            if key is None:
                continue
            clean_key = str(key).strip().lower().replace('*', '').replace('-', ' ').replace('_', ' ').strip()
            clean_val = val
            if isinstance(clean_val, float) and clean_val.is_integer():
                clean_val = str(int(clean_val))
            elif clean_val is not None:
                clean_val = str(clean_val).strip()
            else:
                clean_val = ''

            if any(w in clean_key for w in ['supplier name', 'company name', 'vendor name', 'company', 'supplier', 'name']) and 'name' not in normalized:
                normalized['name'] = clean_val
            elif any(w in clean_key for w in ['phone', 'mobile', 'contact', 'cell']) and 'phone' not in normalized:
                normalized['phone'] = clean_val
            elif any(w in clean_key for w in ['email', 'mail']) and 'email' not in normalized:
                normalized['email'] = clean_val
            elif any(w in clean_key for w in ['address', 'location', 'addr', 'city']) and 'address' not in normalized:
                normalized['address'] = clean_val
            elif any(w in clean_key for w in ['gstin', 'gst', 'tax no']) and 'gstin' not in normalized:
                normalized['gstin'] = clean_val.upper()

        return {
            'name': normalized.get('name', ''),
            'phone': normalized.get('phone', ''),
            'email': normalized.get('email', ''),
            'address': normalized.get('address', ''),
            'gstin': normalized.get('gstin', ''),
        }

    @action(detail=False, methods=['post'], url_path='validate-import')
    def validate_import(self, request):
        import re
        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'Choose a CSV or Excel file to upload.'}, status=400)
        if upload.size > 5 * 1024 * 1024:
            return Response({'detail': 'The import file must be smaller than 5 MB.'}, status=400)

        raw_rows, parse_err = self._parse_supplier_file(upload)
        if parse_err:
            return Response({'detail': parse_err}, status=400)
        if not raw_rows:
            return Response({'detail': 'The file contains no data rows.'}, status=400)
        if len(raw_rows) > 500:
            return Response({'detail': 'Import up to 500 suppliers at a time.'}, status=400)

        existing = Supplier.objects.filter(business=request.user.business)
        existing_by_name = {s.name.strip().lower(): s.id for s in existing}
        existing_by_gstin = {s.gstin.strip().upper(): s.id for s in existing if s.gstin}

        email_regex = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

        validated_rows = []
        seen_names_in_file = {}
        valid_count = 0
        error_count = 0
        create_count = 0
        update_count = 0

        for idx, raw in enumerate(raw_rows, start=2):
            data = self._normalize_row(raw)
            name = data['name'].strip()
            phone = data['phone'].strip()
            email = data['email'].strip()
            address = data['address'].strip()
            gstin = data['gstin'].strip().upper()

            errors = []

            if not name:
                errors.append("Supplier name is required")
            elif len(name) > 200:
                errors.append("Supplier name exceeds 200 characters")

            if phone:
                clean_phone = re.sub(r'[\s\-+()]', '', phone)
                if len(phone) > 15:
                    errors.append("Phone number exceeds 15 characters")
                elif not clean_phone.isdigit():
                    errors.append("Phone number contains invalid characters")

            if email:
                if len(email) > 254:
                    errors.append("Email address exceeds maximum length")
                elif not email_regex.match(email):
                    errors.append("Invalid email address format")

            if gstin:
                if len(gstin) != 15:
                    errors.append("GSTIN must be exactly 15 characters")
                elif not gstin.isalnum():
                    errors.append("GSTIN must contain alphanumeric characters only")

            name_lower = name.lower()
            if name_lower and name_lower in seen_names_in_file:
                errors.append(f"Duplicate in file: already in row {seen_names_in_file[name_lower]}")
            elif name_lower:
                seen_names_in_file[name_lower] = idx

            is_valid = len(errors) == 0
            action_type = 'create'
            matched_id = None

            if gstin and gstin in existing_by_gstin:
                action_type = 'update'
                matched_id = existing_by_gstin[gstin]
            elif name_lower and name_lower in existing_by_name:
                action_type = 'update'
                matched_id = existing_by_name[name_lower]

            if is_valid:
                valid_count += 1
                if action_type == 'update':
                    update_count += 1
                else:
                    create_count += 1
            else:
                error_count += 1

            validated_rows.append({
                'row_number': idx,
                'name': name,
                'phone': phone,
                'email': email,
                'address': address,
                'gstin': gstin,
                'is_valid': is_valid,
                'errors': errors,
                'action': action_type,
                'existing_id': matched_id,
            })

        return Response({
            'total_rows': len(validated_rows),
            'valid_rows_count': valid_count,
            'error_rows_count': error_count,
            'create_count': create_count,
            'update_count': update_count,
            'rows': validated_rows,
        })

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        from django.db import transaction as db_transaction

        update_existing = request.data.get('update_existing', True)
        if isinstance(update_existing, str):
            update_existing = update_existing.lower() in ('true', '1', 'yes')

        rows_to_import = []

        if 'rows' in request.data:
            rows_data = request.data.get('rows', [])
            if not isinstance(rows_data, list) or not rows_data:
                return Response({'detail': 'No supplier rows provided for import.'}, status=400)
            rows_to_import = rows_data
        elif 'file' in request.FILES:
            validation_res = self.validate_import(request)
            if validation_res.status_code != 200:
                return validation_res
            rows_to_import = [r for r in validation_res.data.get('rows', []) if r.get('is_valid')]
        else:
            return Response({'detail': 'Provide validated supplier rows or an import file.'}, status=400)

        created_count = 0
        updated_count = 0
        failed_count = 0
        successful_rows = []
        failed_rows = []

        business = request.user.business

        for row in rows_to_import:
            row_num = row.get('row_number', '?')
            name = (row.get('name') or '').strip()
            phone = (row.get('phone') or '').strip()
            email = (row.get('email') or '').strip()
            address = (row.get('address') or '').strip()
            gstin = (row.get('gstin') or '').strip().upper()

            if not name:
                failed_count += 1
                failed_rows.append({'row_number': row_num, 'name': name, 'error': 'Supplier name is required'})
                continue

            try:
                with db_transaction.atomic():
                    existing_supplier = None
                    if gstin:
                        existing_supplier = Supplier.objects.filter(business=business, gstin=gstin).first()
                    if not existing_supplier and name:
                        existing_supplier = Supplier.objects.filter(business=business, name__iexact=name).first()

                    if existing_supplier and update_existing:
                        existing_supplier.name = name
                        if phone:
                            existing_supplier.phone = phone
                        if email:
                            existing_supplier.email = email
                        if address:
                            existing_supplier.address = address
                        if gstin:
                            existing_supplier.gstin = gstin
                        existing_supplier.save()
                        updated_count += 1
                        successful_rows.append({'row_number': row_num, 'name': name, 'action': 'updated'})
                    elif existing_supplier and not update_existing:
                        failed_count += 1
                        failed_rows.append({'row_number': row_num, 'name': name, 'error': 'Supplier already exists and updating was disabled'})
                    else:
                        Supplier.objects.create(
                            business=business,
                            name=name,
                            phone=phone,
                            email=email,
                            address=address,
                            gstin=gstin,
                        )
                        created_count += 1
                        successful_rows.append({'row_number': row_num, 'name': name, 'action': 'created'})
            except Exception as exc:
                failed_count += 1
                failed_rows.append({'row_number': row_num, 'name': name, 'error': str(exc)})

        audit_event(
            request,
            'SUPPLIER_BULK_IMPORTED',
            'Supplier',
            None,
            after={'created': created_count, 'updated': updated_count, 'failed': failed_count},
            reason=f'Bulk imported {created_count + updated_count} suppliers',
        )

        return Response({
            'status': 'completed',
            'total_processed': len(rows_to_import),
            'created_count': created_count,
            'updated_count': updated_count,
            'failed_count': failed_count,
            'successful_rows': successful_rows,
            'failed_rows': failed_rows,
        })


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

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Check if price change requires admin approval
        new_price = request.data.get('selling_price')
        if new_price is not None:
            try:
                new_dec = Decimal(str(new_price))
                old_dec = instance.selling_price
                from .services.approval_service import ApprovalService
                req_appr, rule_desc = ApprovalService.should_require_approval(
                    instance.business,
                    request.user,
                    'price_change',
                    old_price=old_dec,
                    new_price=new_dec,
                )
                if req_appr:
                    current_data = {
                        'product_id': instance.id,
                        'name': instance.name,
                        'sku': instance.sku,
                        'selling_price': float(instance.selling_price),
                        'mrp': float(instance.mrp or 0),
                        'purchase_price': float(instance.purchase_price or 0),
                    }
                    proposed_data = {
                        'selling_price': float(new_dec),
                        'mrp': float(request.data.get('mrp', instance.mrp or 0)) if request.data.get('mrp') is not None else float(instance.mrp or 0),
                        'purchase_price': float(request.data.get('purchase_price', instance.purchase_price or 0)) if request.data.get('purchase_price') is not None else float(instance.purchase_price or 0),
                        'other_fields': {k: v for k, v in request.data.items() if k not in ('selling_price', 'mrp', 'purchase_price', 'reason')},
                    }
                    appr_req = ApprovalService.create_approval_request(
                        business=instance.business,
                        requested_by=request.user,
                        request_type='price_change',
                        entity_type='Product',
                        entity_id=instance.id,
                        entity_name=instance.name,
                        current_data=current_data,
                        proposed_data=proposed_data,
                        threshold_rule=rule_desc,
                        reason=request.data.get('reason', ''),
                        request=request,
                    )
                    return Response({
                        'requires_approval': True,
                        'approval_request': ApprovalRequestSerializer(appr_req).data,
                        'message': f"Price change requires admin approval: {rule_desc}. Request submitted for review.",
                    }, status=status.HTTP_202_ACCEPTED)
            except (ValueError, TypeError):
                pass

        return super().update(request, *args, partial=partial, **kwargs)

    def perform_update(self, serializer):
        old_inst = serializer.instance
        before_dict = {
            'name': old_inst.name,
            'purchase_price': float(old_inst.purchase_price or 0),
            'selling_price': float(old_inst.selling_price or 0),
            'mrp': float(old_inst.mrp or 0),
            'gst_percent': float(old_inst.gst_percent or 0),
            'current_stock': float(old_inst.current_stock or 0),
        }
        product = serializer.save(business=self.request.user.business)
        after_dict = {
            'name': product.name,
            'purchase_price': float(product.purchase_price or 0),
            'selling_price': float(product.selling_price or 0),
            'mrp': float(product.mrp or 0),
            'gst_percent': float(product.gst_percent or 0),
            'current_stock': float(product.current_stock or 0),
        }

        reason = self.request.data.get('reason', '').strip()
        if (before_dict['selling_price'] != after_dict['selling_price'] or
                before_dict['purchase_price'] != after_dict['purchase_price'] or
                before_dict['mrp'] != after_dict['mrp']):
            audit_event(
                self.request,
                'PRICE_CHANGED',
                'Product',
                product.id,
                entity_name=product.name,
                before={
                    'purchase_price': before_dict['purchase_price'],
                    'selling_price': before_dict['selling_price'],
                    'mrp': before_dict['mrp'],
                },
                after={
                    'purchase_price': after_dict['purchase_price'],
                    'selling_price': after_dict['selling_price'],
                    'mrp': after_dict['mrp'],
                },
                reason=reason or 'Product price changed',
            )

        audit_event(
            self.request,
            'PRODUCT_UPDATED',
            'Product',
            product.id,
            entity_name=product.name,
            before=before_dict,
            after=after_dict,
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


class ProductBatchViewSet(viewsets.ModelViewSet):
    serializer_class = ProductBatchSerializer
    permission_classes = [IsManagerOrReadOnly]
    pagination_class = NoPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['product', 'active']
    search_fields = ['batch_number', 'product__name', 'product__sku']

    def get_queryset(self):
        return ProductBatch.objects.select_related('product').filter(business=self.request.user.business)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quantity = Decimal(str(self.request.data.get('quantity', 0)))
        if quantity < 0:
            raise serializers.ValidationError({'quantity': 'Quantity cannot be negative.'})
        batch = serializer.save(business=self.request.user.business, quantity=0)
        approval_payload = None
        if quantity:
            from .services.approval_service import ApprovalService
            required, rule = ApprovalService.should_require_approval(
                batch.business, request.user, 'stock_adjustment', quantity=quantity,
            )
            if required:
                approval_payload = ApprovalService.create_approval_request(
                    business=batch.business, requested_by=request.user, request_type='stock_adjustment',
                    entity_type='ProductBatch', entity_id=batch.pk, entity_name=f'{batch.product.name} / {batch.batch_number}',
                    current_data={'quantity': '0'},
                    proposed_data={'product_id': batch.product_id, 'batch_id': batch.pk, 'quantity': str(quantity), 'transaction_type': 'stock_in'},
                    threshold_rule=rule, reason=request.data.get('reason', ''), request=request,
                )
        if quantity and not approval_payload:
            InventoryService.move_stock(
                product_id=batch.product_id, batch_id=batch.pk, quantity=quantity,
                transaction_type='stock_in', business=self.request.user.business,
                user=self.request.user, reference=f'BATCH:{batch.batch_number}',
                notes='Opening batch stock', unit_cost=batch.purchase_rate,
            )
        audit_event(self.request, 'BATCH_CREATED', 'ProductBatch', batch.pk,
                    entity_name=batch.batch_number, after={'product_id': batch.product_id, 'quantity': str(quantity)})
        data = ProductBatchSerializer(batch).data
        if approval_payload:
            data = {**data, 'requires_approval': True, 'approval_request_id': approval_payload.pk}
        return Response(data, status=status.HTTP_202_ACCEPTED if approval_payload else status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        batch = self.get_object()
        requested_qty = self.request.data.get('quantity')
        updated = serializer.save(quantity=batch.quantity)
        if requested_qty is not None:
            delta = Decimal(str(requested_qty)) - batch.quantity
            if delta:
                from .services.approval_service import ApprovalService
                required, rule = ApprovalService.should_require_approval(
                    batch.business, self.request.user, 'stock_adjustment', quantity=delta,
                )
                if required:
                    self._approval_payload = ApprovalService.create_approval_request(
                        business=batch.business, requested_by=self.request.user, request_type='stock_adjustment',
                        entity_type='ProductBatch', entity_id=batch.pk, entity_name=f'{batch.product.name} / {batch.batch_number}',
                        current_data={'quantity': str(batch.quantity)},
                        proposed_data={'product_id': batch.product_id, 'batch_id': batch.pk, 'quantity': str(delta), 'transaction_type': 'adjustment'},
                        threshold_rule=rule, reason=self.request.data.get('reason', ''), request=self.request,
                    )
                else:
                    InventoryService.move_stock(
                        product_id=batch.product_id, batch_id=batch.pk, quantity=delta,
                        transaction_type='adjustment', business=self.request.user.business,
                        user=self.request.user, reference=f'BATCH:{batch.batch_number}',
                        notes='Batch stock adjustment', unit_cost=batch.purchase_rate,
                    )
        audit_event(self.request, 'BATCH_UPDATED', 'ProductBatch', updated.pk,
                    entity_name=updated.batch_number, after=ProductBatchSerializer(updated).data)

    def update(self, request, *args, **kwargs):
        self._approval_payload = None
        response = super().update(request, *args, **kwargs)
        if self._approval_payload:
            response.data = {**response.data, 'requires_approval': True, 'approval_request_id': self._approval_payload.pk}
            response.status_code = status.HTTP_202_ACCEPTED
        return response


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

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        raw_limit = request.data.get('credit_limit')

        if raw_limit is not None:
            try:
                new_limit = Decimal(str(raw_limit))
                old_limit = instance.credit_limit or Decimal('0')
                if new_limit > old_limit:
                    from .services.approval_service import ApprovalService
                    req_appr, rule_desc = ApprovalService.should_require_approval(
                        instance.business,
                        request.user,
                        'credit_limit_increase',
                        old_limit=old_limit,
                        new_limit=new_limit,
                    )
                    if req_appr:
                        current_data = {
                            'customer_id': instance.id,
                            'name': instance.name,
                            'mobile': instance.mobile,
                            'current_credit_limit': float(old_limit),
                        }
                        proposed_data = {
                            'customer_id': instance.id,
                            'proposed_credit_limit': float(new_limit),
                            'increase': float(new_limit - old_limit),
                            'reason': request.data.get('reason', ''),
                        }
                        appr_req = ApprovalService.create_approval_request(
                            business=instance.business,
                            requested_by=request.user,
                            request_type='credit_limit_increase',
                            entity_type='Customer',
                            entity_id=instance.id,
                            entity_name=f"{instance.name} (INR {old_limit:,.2f} -> INR {new_limit:,.2f})",
                            current_data=current_data,
                            proposed_data=proposed_data,
                            threshold_rule=rule_desc,
                            reason=request.data.get('reason', ''),
                            request=request,
                        )
                        return Response({
                            'requires_approval': True,
                            'approval_request': ApprovalRequestSerializer(appr_req).data,
                            'message': f"Credit limit increase requires admin approval ({rule_desc}). Request submitted for review.",
                        }, status=status.HTTP_202_ACCEPTED)
            except (ValueError, TypeError):
                pass

        return super().update(request, *args, partial=partial, **kwargs)

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

    def perform_destroy(self, instance):
        entity_id = instance.id
        entity_name = instance.name
        before = {'name': instance.name, 'mobile': instance.mobile, 'credit_limit': float(instance.credit_limit or 0), 'outstanding_amount': float(instance.outstanding_amount or 0)}
        instance.delete()
        audit_event(
            self.request,
            'CUSTOMER_DELETED',
            'Customer',
            entity_id,
            entity_name=entity_name,
            before=before,
            reason=self.request.data.get('reason', 'Customer record deleted'),
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

    @action(detail=True, methods=['get', 'post'], url_path='payments')
    def payments(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            payments = CustomerPayment.objects.filter(
                customer=customer,
                business=request.user.business,
            ).order_by('-created_at')
            return Response(CustomerPaymentSerializer(payments, many=True).data)

        # POST
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data['customer'] = customer.pk
        serializer = CustomerPaymentSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        from .services.payment_service import PaymentService
        try:
            payment = PaymentService.record_customer_payment(
                attributes=serializer.validated_data,
                business=request.user.business,
                created_by=request.user,
                request=request,
            )
            return Response(CustomerPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
        except ValueError as exc:
            return Response({'detail': str(exc), 'error': 'invalid_payment'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='transactions')
    def transactions(self, request, pk=None):
        customer = self.get_object()
        entries = CustomerLedger.objects.filter(
            customer=customer,
            business=request.user.business,
        ).order_by('-created_at')[:50]
        data = [
            {
                'id': entry.id,
                'entry_type': entry.entry_type,
                'debit': str(entry.debit),
                'credit': str(entry.credit),
                'reference_type': entry.reference_type,
                'reference_id': entry.reference_id,
                'description': entry.description,
                'created_at': entry.created_at,
            }
            for entry in entries
        ]
        return Response(data)


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

    @action(detail=False, methods=['get'], url_path='import-template')
    def import_template(self, request):
        """Generate a downloadable, professionally formatted Excel template for bulk purchase orders."""
        wb = Workbook()
        ws = wb.active
        ws.title = "Purchase Orders"

        headers = [
            ("Supplier Name *", 28),
            ("Invoice Number *", 20),
            ("Purchase Date (YYYY-MM-DD) *", 25),
            ("Product SKU or Name *", 32),
            ("Quantity *", 14),
            ("Purchase Price *", 16),
            ("GST %", 12),
            ("Paid Amount", 16),
            ("Notes", 26),
        ]

        header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left_align = Alignment(horizontal="left", vertical="center")
        right_align = Alignment(horizontal="right", vertical="center")
        thin_border = Border(
            left=Side(style='thin', color='D7DEE7'),
            right=Side(style='thin', color='D7DEE7'),
            top=Side(style='thin', color='D7DEE7'),
            bottom=Side(style='thin', color='D7DEE7')
        )

        ws.row_dimensions[1].height = 28
        for col_idx, (col_name, width) in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=col_name)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align
            cell.border = thin_border
            ws.column_dimensions[get_column_letter(col_idx)].width = width

        active_prods = list(Product.objects.filter(business=request.user.business, status='active')[:2])
        p1_sku = active_prods[0].sku if active_prods else "CLEAN-001"
        p1_price = float(active_prods[0].purchase_price) if active_prods else 165.00
        p1_gst = float(active_prods[0].gst_percent) if active_prods else 18.0

        p2_sku = active_prods[1].sku if len(active_prods) > 1 else "CLEAN-002"
        p2_price = float(active_prods[1].purchase_price) if len(active_prods) > 1 else 85.00
        p2_gst = float(active_prods[1].gst_percent) if len(active_prods) > 1 else 18.0

        today_str = timezone.now().strftime('%Y-%m-%d')

        sample_rows = [
            ("Balaji Traders Pvt Ltd", "INV-8001", today_str, p1_sku, 10, p1_price, p1_gst, round(10 * p1_price * (1 + p1_gst / 100), 2), "Monthly stock replenishment"),
            ("Balaji Traders Pvt Ltd", "INV-8001", today_str, p2_sku, 5, p2_price, p2_gst, round(10 * p1_price * (1 + p1_gst / 100) + 5 * p2_price * (1 + p2_gst / 100), 2), "Monthly stock replenishment"),
            ("Sri Krishna Enterprises", "PO-9002", today_str, p1_sku, 20, p1_price, p1_gst, 0, "Credit purchase - Net 30"),
        ]

        sample_font = Font(name="Calibri", size=10, color="172033")
        for row_idx, sample in enumerate(sample_rows, start=2):
            ws.row_dimensions[row_idx].height = 20
            for col_idx, val in enumerate(sample, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.font = sample_font
                cell.alignment = right_align if col_idx in (5, 6, 7, 8) else left_align
                cell.border = thin_border

        note_row_idx = len(sample_rows) + 3
        ws.cell(row=note_row_idx, column=1, value="Instructions & Guidelines:").font = Font(name="Calibri", size=10, bold=True, color="1E3A5F")
        notes = [
            "1. Columns marked with (*) are required.",
            "2. Group multiple items under the same purchase order by using the same 'Supplier Name' and 'Invoice Number'.",
            "3. 'Product SKU or Name' must match an active product in your inventory (matching SKU is recommended).",
            "4. 'Quantity' and 'Purchase Price' must be numbers greater than zero.",
            "5. If Paid Amount is 0 or empty, payment status is Pending. If equal to grand total, it is marked as Paid.",
            "6. Save the file as .xlsx, .xls, or .csv and upload it in the Purchases page."
        ]
        for idx, note in enumerate(notes, start=note_row_idx + 1):
            ws.cell(row=idx, column=1, value=note).font = Font(name="Calibri", size=9, italic=True, color="64748B")

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response['Content-Disposition'] = 'attachment; filename="Purchase_Import_Template.xlsx"'
        return response

    def _parse_purchase_file(self, upload):
        suffix = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
        if suffix == 'csv':
            try:
                decoded = upload.read().decode('utf-8-sig')
            except UnicodeDecodeError:
                upload.seek(0)
                decoded = upload.read().decode('latin-1')
            reader = list(csv.DictReader(decoded.splitlines()))
            return reader, None
        elif suffix in ('xlsx', 'xlsm', 'xls'):
            try:
                workbook = load_workbook(upload, read_only=True, data_only=True)
                sheet = workbook.active
                values = list(sheet.iter_rows(values_only=True))
                if not values:
                    return [], None
                header_row_idx = 0
                for idx, r in enumerate(values):
                    if any(r and any(k in str(v).lower() for k in ['supplier', 'invoice', 'product', 'sku', 'qty', 'quantity']) for v in r if v is not None):
                        header_row_idx = idx
                        break
                headers = [str(value).strip() if value is not None else '' for value in values[header_row_idx]]
                rows = []
                for values_row in values[header_row_idx + 1:]:
                    first_val = str(values_row[0] or '').strip().lower() if values_row else ''
                    if first_val.startswith('instructions') or first_val.startswith('1.') or first_val.startswith('note'):
                        continue
                    if any(value is not None and str(value).strip() for value in values_row):
                        rows.append(dict(zip(headers, values_row)))
                return rows, None
            except Exception as exc:
                return None, f"Could not read spreadsheet: {str(exc)}"
        else:
            return None, "Unsupported file format. Please upload a .xlsx, .xls, or .csv file."

    def _normalize_purchase_row(self, raw_row):
        normalized = {}
        for key, val in raw_row.items():
            if key is None:
                continue
            clean_key = str(key).strip().lower().replace('*', '').replace('-', ' ').replace('_', ' ').strip()
            clean_val = val
            if isinstance(clean_val, float) and clean_val.is_integer():
                clean_val = str(int(clean_val))
            elif clean_val is not None:
                clean_val = str(clean_val).strip()
            else:
                clean_val = ''

            if any(w in clean_key for w in ['supplier name', 'supplier', 'vendor name', 'vendor']) and 'supplier' not in normalized:
                normalized['supplier'] = clean_val
            elif any(w in clean_key for w in ['invoice number', 'invoice no', 'bill no', 'po number', 'invoice']) and 'invoice_number' not in normalized:
                normalized['invoice_number'] = clean_val
            elif any(w in clean_key for w in ['purchase date', 'date', 'bill date', 'po date']) and 'purchase_date' not in normalized:
                normalized['purchase_date'] = clean_val
            elif any(w in clean_key for w in ['product sku or name', 'product sku', 'product name', 'sku', 'product', 'item']) and 'product' not in normalized:
                normalized['product'] = clean_val
            elif any(w in clean_key for w in ['quantity', 'qty', 'units']) and 'quantity' not in normalized:
                normalized['quantity'] = clean_val
            elif any(w in clean_key for w in ['purchase price', 'price', 'unit price', 'rate', 'cost']) and 'purchase_price' not in normalized:
                normalized['purchase_price'] = clean_val
            elif any(w in clean_key for w in ['gst %', 'gst percent', 'gst', 'tax %', 'tax']) and 'gst_percent' not in normalized:
                normalized['gst_percent'] = clean_val
            elif any(w in clean_key for w in ['paid amount', 'paid', 'amount paid']) and 'paid_amount' not in normalized:
                normalized['paid_amount'] = clean_val
            elif any(w in clean_key for w in ['notes', 'note', 'remark', 'remarks']) and 'notes' not in normalized:
                normalized['notes'] = clean_val

        return normalized

    @action(detail=False, methods=['post'], url_path='validate-import')
    def validate_import(self, request):
        from datetime import datetime, date

        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'Choose a CSV or Excel file to upload.'}, status=400)
        if upload.size > 5 * 1024 * 1024:
            return Response({'detail': 'The import file must be smaller than 5 MB.'}, status=400)

        raw_rows, parse_err = self._parse_purchase_file(upload)
        if parse_err:
            return Response({'detail': parse_err}, status=400)
        if not raw_rows:
            return Response({'detail': 'The file contains no purchase order rows.'}, status=400)
        if len(raw_rows) > 500:
            return Response({'detail': 'Import up to 500 purchase rows at a time.'}, status=400)

        business = request.user.business
        suppliers = Supplier.objects.filter(business=business)
        suppliers_by_name = {s.name.strip().lower(): s for s in suppliers}

        products = Product.objects.filter(business=business, status='active')
        products_by_sku = {p.sku.strip().lower(): p for p in products if p.sku}
        products_by_name = {p.name.strip().lower(): p for p in products if p.name}

        def parse_date_val(val):
            if isinstance(val, (date, datetime)):
                return val.strftime('%Y-%m-%d')
            s = str(val or '').strip()
            if not s:
                return None
            for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d', '%m/%d/%Y'):
                try:
                    return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
                except ValueError:
                    pass
            return None

        grouped_orders = {}

        for row_idx, raw in enumerate(raw_rows, start=2):
            data = self._normalize_purchase_row(raw)
            supplier_name = data.get('supplier', '').strip()
            invoice_num = data.get('invoice_number', '').strip()
            if not invoice_num:
                invoice_num = f"PO-IMP-{row_idx}"

            date_parsed = parse_date_val(data.get('purchase_date')) or timezone.now().strftime('%Y-%m-%d')
            group_key = (supplier_name.lower(), invoice_num.lower(), date_parsed)

            if group_key not in grouped_orders:
                grouped_orders[group_key] = {
                    'row_numbers': [row_idx],
                    'supplier_name': supplier_name,
                    'invoice_number': invoice_num,
                    'purchase_date': date_parsed,
                    'paid_amount_raw': data.get('paid_amount', ''),
                    'notes': data.get('notes', ''),
                    'items_raw': [],
                }
            else:
                grouped_orders[group_key]['row_numbers'].append(row_idx)

            grouped_orders[group_key]['items_raw'].append({
                'row_number': row_idx,
                'product_identifier': data.get('product', '').strip(),
                'quantity_raw': data.get('quantity', ''),
                'price_raw': data.get('purchase_price', ''),
                'gst_raw': data.get('gst_percent', ''),
            })

        validated_orders = []
        valid_orders_count = 0
        error_orders_count = 0

        for order_key, ord_data in grouped_orders.items():
            order_errors = []
            supplier_name = ord_data['supplier_name']
            invoice_number = ord_data['invoice_number']
            purchase_date = ord_data['purchase_date']

            supplier_obj = None
            if not supplier_name:
                order_errors.append("Supplier name is required")
            else:
                supplier_obj = suppliers_by_name.get(supplier_name.lower())

            validated_items = []
            order_subtotal = Decimal('0')
            order_tax = Decimal('0')
            order_total = Decimal('0')

            for item_raw in ord_data['items_raw']:
                row_num = item_raw['row_number']
                prod_ident = item_raw['product_identifier']
                item_errors = []

                prod_obj = None
                if not prod_ident:
                    item_errors.append(f"Row {row_num}: Product SKU or Name is required")
                else:
                    prod_obj = products_by_sku.get(prod_ident.lower()) or products_by_name.get(prod_ident.lower())
                    if not prod_obj:
                        item_errors.append(f"Row {row_num}: Product '{prod_ident}' not found in inventory")

                try:
                    qty = Decimal(str(item_raw['quantity_raw'] or 0))
                    if qty <= 0:
                        item_errors.append(f"Row {row_num}: Quantity must be greater than 0")
                except Exception:
                    qty = Decimal('0')
                    item_errors.append(f"Row {row_num}: Quantity must be a valid number")

                try:
                    raw_price = item_raw['price_raw']
                    if raw_price in (None, '') and prod_obj:
                        price = prod_obj.purchase_price
                    else:
                        price = Decimal(str(raw_price))
                    if price < 0:
                        item_errors.append(f"Row {row_num}: Purchase price cannot be negative")
                except Exception:
                    price = Decimal('0')
                    item_errors.append(f"Row {row_num}: Purchase price must be a valid number")

                try:
                    raw_gst = item_raw['gst_raw']
                    if raw_gst in (None, '') and prod_obj:
                        gst = prod_obj.gst_percent
                    elif raw_gst in (None, ''):
                        gst = Decimal('0')
                    else:
                        gst = Decimal(str(raw_gst))
                    if not (0 <= gst <= 100):
                        item_errors.append(f"Row {row_num}: GST % must be between 0 and 100")
                except Exception:
                    gst = Decimal('0')
                    item_errors.append(f"Row {row_num}: GST % must be a valid number")

                line_taxable = (qty * price).quantize(Decimal('0.01'))
                line_tax = (line_taxable * gst / Decimal('100')).quantize(Decimal('0.01'))
                line_total = line_taxable + line_tax

                order_subtotal += line_taxable
                order_tax += line_tax
                order_total += line_total

                if item_errors:
                    order_errors.extend(item_errors)

                validated_items.append({
                    'row_number': row_num,
                    'product_id': prod_obj.id if prod_obj else None,
                    'product_name': prod_obj.name if prod_obj else prod_ident,
                    'product_sku': prod_obj.sku if prod_obj else '',
                    'quantity': float(qty),
                    'purchase_price': float(price),
                    'gst_percent': float(gst),
                    'line_total': float(line_total),
                    'is_valid': len(item_errors) == 0,
                    'errors': item_errors,
                })

            paid_amount_val = Decimal('0')
            try:
                raw_paid = ord_data['paid_amount_raw']
                if raw_paid not in (None, ''):
                    paid_amount_val = Decimal(str(raw_paid))
                    if paid_amount_val < 0:
                        order_errors.append("Paid amount cannot be negative")
                    elif paid_amount_val > order_total:
                        order_errors.append("Paid amount cannot exceed total amount")
                else:
                    paid_amount_val = order_total
            except Exception:
                order_errors.append("Paid amount must be a number")

            payment_status = (
                'paid' if paid_amount_val == order_total and order_total > 0
                else 'partial' if paid_amount_val > 0
                else 'pending'
            )

            is_valid = len(order_errors) == 0
            if is_valid:
                valid_orders_count += 1
            else:
                error_orders_count += 1

            validated_orders.append({
                'row_numbers': ord_data['row_numbers'],
                'supplier_name': supplier_name,
                'supplier_id': supplier_obj.id if supplier_obj else None,
                'supplier_exists': supplier_obj is not None,
                'invoice_number': invoice_number,
                'purchase_date': purchase_date,
                'items_count': len(validated_items),
                'items': validated_items,
                'subtotal': float(order_subtotal),
                'tax_amount': float(order_tax),
                'total_amount': float(order_total),
                'paid_amount': float(paid_amount_val),
                'payment_status': payment_status,
                'notes': ord_data['notes'],
                'is_valid': is_valid,
                'errors': order_errors,
            })

        return Response({
            'total_rows': len(raw_rows),
            'total_orders': len(validated_orders),
            'valid_orders_count': valid_orders_count,
            'error_orders_count': error_orders_count,
            'orders': validated_orders,
        })

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        from .services.purchase_service import PurchaseService

        orders_to_import = []
        if 'orders' in request.data:
            orders_to_import = request.data.get('orders', [])
            if not isinstance(orders_to_import, list) or not orders_to_import:
                return Response({'detail': 'No purchase order data provided for import.'}, status=400)
        elif 'file' in request.FILES:
            val_res = self.validate_import(request)
            if val_res.status_code != 200:
                return val_res
            orders_to_import = [o for o in val_res.data.get('orders', []) if o.get('is_valid')]
        else:
            return Response({'detail': 'Provide validated purchase orders or an import file.'}, status=400)

        create_missing_suppliers = request.data.get('create_missing_suppliers', True)
        business = request.user.business

        successful_orders = []
        failed_orders = []
        created_count = 0
        failed_count = 0

        for ord_data in orders_to_import:
            inv_num = ord_data.get('invoice_number', 'PO-IMP')
            sup_name = ord_data.get('supplier_name', '').strip()
            items_list = ord_data.get('items', [])

            if not items_list:
                failed_count += 1
                failed_orders.append({'invoice_number': inv_num, 'supplier_name': sup_name, 'error': 'Order has no items'})
                continue

            try:
                supplier = None
                if sup_name:
                    supplier = Supplier.objects.filter(business=business, name__iexact=sup_name).first()
                    if not supplier and create_missing_suppliers:
                        supplier = Supplier.objects.create(business=business, name=sup_name)

                items_payload = []
                for it in items_list:
                    items_payload.append({
                        'product_id': it['product_id'],
                        'quantity': it['quantity'],
                        'purchase_price': it['purchase_price'],
                        'gst_percent': it.get('gst_percent', 0),
                    })

                purchase = PurchaseService.create_purchase(
                    attributes={
                        'supplier': supplier,
                        'invoice_number': inv_num,
                        'purchase_date': ord_data.get('purchase_date') or timezone.localdate(),
                        'paid_amount': Decimal(str(ord_data.get('paid_amount', 0))),
                        'notes': ord_data.get('notes', ''),
                    },
                    items_data=items_payload,
                    business=business,
                    created_by=request.user,
                )

                created_count += 1
                successful_orders.append({
                    'id': purchase.id,
                    'invoice_number': purchase.invoice_number,
                    'supplier_name': supplier.name if supplier else '—',
                    'total_amount': float(purchase.total_amount),
                    'items_count': len(items_payload),
                })
            except Exception as exc:
                failed_count += 1
                failed_orders.append({
                    'invoice_number': inv_num,
                    'supplier_name': sup_name,
                    'error': str(exc),
                })

        audit_event(
            request,
            'PURCHASE_BULK_IMPORTED',
            'Purchase',
            None,
            after={'created_orders': created_count, 'failed_orders': failed_count},
            reason=f'Bulk imported {created_count} purchase orders',
        )

        return Response({
            'status': 'completed',
            'total_processed': len(orders_to_import),
            'created_count': created_count,
            'failed_count': failed_count,
            'successful_orders': successful_orders,
            'failed_orders': failed_orders,
        })


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

    @action(detail=True, methods=['post'], url_path='collect-payment')
    def collect_payment(self, request, pk=None):
        return self._do_collect_payment(request)

    @action(detail=True, methods=['get', 'post'], url_path='payments')
    def payments(self, request, pk=None):
        invoice = self.get_object()
        if request.method == 'GET':
            from .models import Payment
            payments = Payment.objects.filter(invoice=invoice).order_by('-created_at')
            return Response(PaymentSerializer(payments, many=True).data)
        return self._do_collect_payment(request)

    def _do_collect_payment(self, request):
        from .services.invoice_service import InvoiceService
        invoice = self.get_object()
        raw_amount = request.data.get('amount')
        if raw_amount is None or raw_amount == '':
            return Response({'amount': 'Payment amount is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount = Decimal(str(raw_amount))
        except (ValueError, TypeError):
            return Response({'amount': 'Invalid payment amount.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'amount': 'Payment amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        method = request.data.get('method', 'cash')
        reference = request.data.get('reference', '')
        notes = request.data.get('notes', '')

        try:
            updated_invoice = InvoiceService.collect_payment(
                invoice_id=invoice.pk,
                amount=amount,
                method=method,
                business=request.user.business,
                user=request.user,
                reference=reference,
                notes=notes,
                request=request,
            )
            return Response(
                InvoiceSerializer(updated_invoice, context=self.get_serializer_context()).data,
                status=status.HTTP_200_OK,
            )
        except ValueError as exc:
            return Response({'detail': str(exc), 'error': 'invalid_payment'}, status=status.HTTP_400_BAD_REQUEST)
        except LookupError as exc:
            return Response({'detail': str(exc), 'error': 'not_found'}, status=status.HTTP_404_NOT_FOUND)

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
        today = timezone.localdate()
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
        # Keep the legacy key/value API compatible while preventing arbitrary keys
        # from being created by stale or malformed clients.
        known_keys = set(self.all(request).data.keys())
        known_keys.difference_update({'active_templates', 'template_settings'})
        from .services.approval_service import ApprovalService
        known_keys.update(ApprovalService.DEFAULT_SETTINGS)
        incoming_keys = set(request.data.keys()) - {'reason', '_reason'}
        unknown_keys = incoming_keys - known_keys
        if unknown_keys:
            return Response({'detail': 'Unknown setting keys.', 'keys': sorted(unknown_keys)}, status=400)

        bool_keys = {
            key for key in incoming_keys
            if (key.startswith(('show_', 'enable_', 'allow_', 'approval_')) or key.startswith('thermal_show_'))
            and key.endswith((
                '_enabled', '_area', '_col', '_cols', '_qr', '_details', '_logo',
                '_address', '_phone', '_email', '_gstin', '_pan', '_summary',
                '_words', '_status', '_mode', '_due', '_terms', '_footer',
                '_business_name', '_customer_address', '_place_of_supply',
                '_stock', '_expiry', '_charge'
            ))
        }
        bool_keys.update({
            'prevent_expired_batch_sale', 'barcode_bold', 'round_off', 'reverse_charge',
            'hsn_summary_on_invoice', 'cess_enabled', 'upi_qr_enabled', 'advance_payment_enabled',
            'open_cash_drawer', 'print_duplicate', 'einvoice_enabled', 'approval_admin_bypass', 'custom_theme_enabled',
            'approval_refund_enabled', 'approval_stock_adjustment_enabled', 'approval_price_change_enabled',
        } & incoming_keys)
        bool_keys.update(key for key in incoming_keys if key.startswith(('thermal_show_', 'barcode_show_', 'enable_')))
        non_bool_keys = {
            'thermal_terms', 'thermal_footer', 'thermal_title', 'thermal_paper_width',
            'printer_paper_width', 'upi_qr_size_a4', 'upi_qr_size_thermal', 'invoice_terms',
            'invoice_footer', 'receipt_footer', 'footer_text_override', 'terms_override',
        }
        bool_keys.difference_update(non_bool_keys)
        for key in bool_keys:
            if key in request.data and str(request.data[key]).lower() not in ('true', 'false', '1', '0', 'yes', 'no'):
                return Response({'detail': f'{key} must be a boolean.'}, status=400)
        numeric_rules = {
            'invoice_start_number': (1, None), 'invoice_due_days': (0, 3650),
            'default_gst_rate': (0, 100), 'approval_price_change_pct': (0, 100),
            'approval_refund_threshold': (0, None), 'approval_stock_adjustment_qty': (0, None),
            'copies_per_bill': (1, 10), 'low_stock_threshold': (0, None), 'reminder_due_days': (0, 3650),
            'barcode_height': (10, 200), 'barcode_width': (1, 4),
        }
        for key, (minimum, maximum) in numeric_rules.items():
            if key in request.data:
                try:
                    number = Decimal(str(request.data[key]))
                    if not number.is_finite() or number < minimum or (maximum is not None and number > maximum):
                        raise ValueError
                    if key in ('invoice_start_number', 'invoice_due_days', 'copies_per_bill', 'reminder_due_days', 'barcode_width', 'barcode_height') and number != number.to_integral_value():
                        raise ValueError
                except Exception:
                    return Response({'detail': f'{key} has an invalid numeric value.'}, status=400)
        enum_rules = {
            'gst_reg_type': {'regular', 'composition', 'unregistered'},
            'tax_on_price': {'inclusive', 'exclusive'},
            'invoice_border_style': {'solid', 'dashed', 'double'},
            'invoice_header_layout': {'logo_left', 'split', 'center', 'corporate_bar', 'name_only'},
            'invoice_table_style': {'clean', 'striped', 'bold'},
            'invoice_layout': {'standard', 'compact', 'thermal'},
            'thermal_paper_width': {'58', '80', '2', '3', '58mm', '80mm'},
        }
        for key, choices in enum_rules.items():
            if key in request.data and str(request.data[key]).lower() not in choices:
                return Response({'detail': f'{key} must be one of: {", ".join(sorted(choices))}.'}, status=400)

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
                'owner_name': 'owner_name',
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

        # Auto-compose shop_bank_details from individual bank fields for pdf_utils
        bank_fields = ['shop_bank_name', 'shop_bank_account', 'shop_bank_ifsc', 'shop_bank_branch']
        if any(k in request.data for k in bank_fields):
            existing_bank = {s.key: s.value for s in Setting.objects.filter(
                business=request.user.business, key__in=bank_fields
            )}
            merged_bank = {**existing_bank, **{k: str(request.data[k] or '') for k in bank_fields if k in request.data}}
            parts = []
            if merged_bank.get('shop_bank_name'):
                parts.append(f"Bank: {merged_bank['shop_bank_name']}")
            if merged_bank.get('shop_bank_account'):
                parts.append(f"A/C: {merged_bank['shop_bank_account']}")
            if merged_bank.get('shop_bank_ifsc'):
                parts.append(f"IFSC: {merged_bank['shop_bank_ifsc']}")
            if merged_bank.get('shop_bank_branch'):
                parts.append(f"Branch: {merged_bank['shop_bank_branch']}")
            composed = ' | '.join(parts)
            Setting.objects.update_or_create(
                business=request.user.business,
                key='shop_bank_details',
                defaults={'value': composed},
            )

        # Update Setting table key-values
        for key, value in request.data.items():
            if key in ('reason', '_reason'):
                continue
            clean_value = str(value)
            if key in bool_keys:
                clean_value = 'true' if str(value).lower() in ('true', '1', 'yes') else 'false'
            elif key == 'thermal_paper_width':
                val_str = str(value).lower().strip()
                clean_value = '58' if val_str in ('58', '2', '58mm') else '80'

            Setting.objects.update_or_create(
                business=request.user.business,
                key=key,
                defaults={'value': clean_value},
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
            'owner_name': biz.owner_name if biz else '',
            'shop_logo': '',
            'shop_state': '',
            'shop_city': '', 'shop_pincode': '', 'shop_country': 'India', 'shop_website': '',
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
            'show_mrp_col': 'false',
            'show_barcode_col': 'false',
            'show_tax_cols': 'true', 'show_signature_area': 'false',
            'show_fssai_on_invoice': 'false', 'show_cin_on_invoice': 'false',
            'invoice_notes': '', 'invoice_footer': '',
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
            'default_payment_method': 'cash', 'round_off': 'true',
            'credit_limit_alert': '', 'shop_upi_id': '',
            'shop_bank_details': '',
            # Legacy bank fields (kept for pdf_utils fallback)
            'shop_bank_name': '', 'shop_bank_branch': '',
            'shop_bank_account': '', 'shop_bank_ifsc': '',
            'show_upi_qr_on_invoice': 'true', 'show_upi_qr_on_thermal': 'true',
            'upi_qr_enabled': 'true', 'advance_payment_enabled': 'false',
            'upi_merchant_name': '',
            # Printer
            'printer_type': 'a4', 'default_printer': '', 'copies_per_bill': '1',
            'auto_print': 'no', 'receipt_footer': 'Thank you for shopping with us!',
            'open_cash_drawer': 'false', 'print_duplicate': 'false',
            # System
            'currency': biz.currency if biz else '₹',
            'allow_negative_stock': 'false',
            'expiry_tracking_enabled': 'true',
            'prevent_expired_batch_sale': 'false',
            # Policies & Legal
            'terms_url': '', 'privacy_url': '', 'refund_url': '',
            'return_url': '', 'shipping_url': '',
        }
        from .services.approval_service import ApprovalService
        defaults.update(ApprovalService.DEFAULT_SETTINGS)
        # Keep every key exposed by the current Settings UI in the server schema,
        # including legacy renderer and print options that have no dedicated model column.
        defaults.update({
            'invoice_title': 'TAX INVOICE', 'invoice_theme_secondary': '#64748B',
            'custom_theme_enabled': 'false',
            'invoice_border_style': 'solid', 'invoice_layout': 'standard',
            'invoice_table_style': 'clean', 'invoice_theme_color': '#1e3a5f',
            'show_rate_col': 'true', 'show_total_col': 'true',
            'thermal_paper_width': '80', 'thermal_title': 'TAX INVOICE',
            'thermal_terms': 'Goods once sold can be exchanged within 7 days with bill.',
            'thermal_show_logo': 'true', 'thermal_show_invoice_no': 'true', 'thermal_show_date': 'true',
            'thermal_show_time': 'true', 'thermal_show_cashier': 'false', 'thermal_show_payment_mode': 'true',
            'thermal_show_place_of_supply': 'false', 'thermal_show_customer_name': 'true',
            'thermal_show_customer_phone': 'false', 'thermal_show_customer_gstin': 'false',
            'thermal_show_sku': 'false', 'thermal_show_qty': 'true', 'thermal_show_rate': 'true',
            'thermal_show_total': 'true',
            'thermal_show_discount': 'false', 'thermal_show_tax': 'false', 'thermal_show_party_balance': 'false',
            'thermal_show_upi_qr': 'true',
            'thermal_show_bill_qr': 'false',
            'thermal_show_item_desc': 'false', 'thermal_show_batch': 'false',
            'thermal_show_expiry': 'false', 'thermal_show_mrp': 'false',
            'thermal_show_barcode': 'false', 'thermal_show_terms': 'false',
            'thermal_show_customer_address': 'false',
            'barcode_align': 'center', 'barcode_bold': 'true', 'barcode_font_size': 'medium',
            'barcode_height': '36', 'barcode_width': '2', 'barcode_label_size': '50x25',
            'barcode_printer_type': 'thermal', 'barcode_show_business_name': 'true',
            'barcode_show_code': 'true', 'barcode_show_mrp': 'true', 'barcode_show_product_name': 'true',
            'barcode_show_selling_price': 'true', 'barcode_show_sku': 'true',
            'default_payment_terms': '', 'enable_low_stock_notification': 'true',
            'enable_whatsapp_reminders': 'false', 'low_stock_threshold': '5', 'reminder_due_days': '7',
            'show_alternate_unit': 'false', 'show_business_name': 'true', 'show_free_qty': 'false',
            'show_customer_name': 'true', 'show_item_description': 'true', 'show_item_name': 'true',
            'show_invoice_time': 'true', 'show_mfg_date': 'false', 'show_price_history': 'false',
            'show_qty_col': 'true', 'show_sr_no': 'true', 'show_shop_name': 'true',
        })
        saved = {s.key: s.value for s in self.get_queryset()}
        merged = {**defaults, **saved}
        if merged.get('place_of_supply') and not merged.get('shop_state'):
            merged['shop_state'] = merged['place_of_supply']
        elif merged.get('shop_state') and not merged.get('place_of_supply'):
            merged['place_of_supply'] = merged['shop_state']

        # Include templates catalog and active selections
        from .services.template_service import get_all_templates_summary, get_active_templates
        merged['active_templates'] = get_active_templates(biz)
        merged['template_settings'] = get_all_templates_summary(biz)
        return Response(merged)

    @action(detail=False, methods=['get'], url_path='templates', permission_classes=[IsCashierOrAdmin])
    def templates_list(self, request):
        from .services.template_service import get_all_templates_summary
        data = get_all_templates_summary(getattr(request.user, 'business', None))
        return Response(data)

    @action(detail=False, methods=['post'], url_path='templates/select-active', permission_classes=[IsManagerOrAbove])
    def template_select_active(self, request):
        from .services.template_service import set_active_template
        biz = getattr(request.user, 'business', None)
        format_name = request.data.get('format', 'default')
        template_id = request.data.get('template_id')
        if not template_id:
            return Response({'error': 'template_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            active_map = set_active_template(biz, format_name, template_id)
            audit_event(
                request,
                'SETTINGS_CHANGED',
                'Setting',
                request.user.business_id,
                entity_name='Active Invoice Template',
                after=active_map,
                reason=f'Selected active template {template_id} for format {format_name}',
            )
            return Response(active_map)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get', 'post'], url_path=r'templates/(?P<template_id>[^/.]+)', permission_classes=[IsManagerOrAbove])
    def template_detail(self, request, template_id=None):
        if template_id == 'select-active':
            return self.template_select_active(request)
        from .services.template_service import get_template_config, save_template_config
        biz = getattr(request.user, 'business', None)
        if request.method == 'GET':
            try:
                cfg = get_template_config(biz, template_id)
                return Response(cfg)
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # POST - update template configuration
        try:
            saved = save_template_config(biz, template_id, request.data)
            audit_event(
                request,
                'SETTINGS_CHANGED',
                'InvoiceTemplateSetting',
                request.user.business_id,
                entity_name=f'Template Config: {template_id}',
                after=saved,
                reason=f'Updated configuration for template {template_id}',
            )
            return Response(saved)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path=r'templates/(?P<template_id>[^/.]+)/reset', permission_classes=[IsManagerOrAbove])
    def template_reset(self, request, template_id=None):
        from .services.template_service import reset_template_config
        biz = getattr(request.user, 'business', None)
        try:
            reset_cfg = reset_template_config(biz, template_id)
            audit_event(
                request,
                'SETTINGS_CHANGED',
                'InvoiceTemplateSetting',
                request.user.business_id,
                entity_name=f'Template Config: {template_id}',
                after=reset_cfg,
                reason=f'Reset configuration for template {template_id} to default',
            )
            return Response(reset_cfg)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DashboardView(APIView):
    permission_classes = [IsCashierOrAdmin]
    def get(self, request):
        biz = request.user.business
        today = timezone.localdate()
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
        pay_today_inv = Payment.objects.filter(invoice__business=biz, invoice__status='completed', customer_payment__isnull=True, created_at__date=today).aggregate(s=Sum('amount'))['s'] or 0
        pay_today_cust = CustomerPayment.objects.filter(business=biz, created_at__date=today).aggregate(s=Sum('amount'))['s'] or 0
        today_payments_total = float(pay_today_inv + pay_today_cust)

        pay_month_inv = Payment.objects.filter(invoice__business=biz, invoice__status='completed', customer_payment__isnull=True, created_at__date__gte=month_start).aggregate(s=Sum('amount'))['s'] or 0
        pay_month_cust = CustomerPayment.objects.filter(business=biz, created_at__date__gte=month_start).aggregate(s=Sum('amount'))['s'] or 0
        month_payments_total = float(pay_month_inv + pay_month_cust)

        pay_last_month_inv = Payment.objects.filter(invoice__business=biz, invoice__status='completed', customer_payment__isnull=True, created_at__date__gte=last_month_start, created_at__date__lte=last_month_end).aggregate(s=Sum('amount'))['s'] or 0
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
            customer_payment__isnull=True,
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
    period_label = _report_period_label(request.query_params)
    report_format = request.query_params.get('export', '').lower()
    if report_format in ('pdf', 'xlsx'):
        audit_event(
            request,
            'REPORT_EXPORTED',
            'Report',
            report_name,
            entity_name=f'{report.title} ({report_format.upper()})',
            after={'format': report_format, 'records': len(report.rows)},
            reason=f'Exported {report.title} as {report_format.upper()}',
        )
    if report_format == 'pdf':
        return _export_report_pdf(
            report.title, report.headers, report.rows,
            f'{report.filename}.pdf', summary_rows=report.summary_rows,
            request_user=request.user,
            period_label=period_label,
        )
    if report_format == 'xlsx':
        return _export_report_xlsx(
            report.title, report.headers, report.rows,
            f'{report.filename}.xlsx',
            summary_rows=report.summary_rows,
            request_user=request.user,
            period_label=period_label,
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
        audit_event(
            self.request,
            'EXPENSE_CREATED',
            'Expense',
            expense.id,
            entity_name=expense.description[:50] if expense.description else f'Expense #{expense.id}',
            after={'amount': float(expense.amount or 0), 'description': expense.description, 'payment_method': expense.payment_method},
            reason=self.request.data.get('reason', 'Expense recorded'),
        )

    def perform_update(self, serializer):
        old_inst = serializer.instance
        before = {'amount': float(old_inst.amount or 0), 'description': old_inst.description, 'payment_method': old_inst.payment_method}
        expense = serializer.save(business=self.request.user.business)
        after = {'amount': float(expense.amount or 0), 'description': expense.description, 'payment_method': expense.payment_method}
        audit_event(
            self.request,
            'EXPENSE_UPDATED',
            'Expense',
            expense.id,
            entity_name=expense.description[:50] if expense.description else f'Expense #{expense.id}',
            before=before,
            after=after,
            reason=self.request.data.get('reason', 'Expense updated'),
        )

    def perform_destroy(self, instance):
        entity_id = instance.id
        entity_name = instance.description[:50] if instance.description else f'Expense #{instance.id}'
        before = {'amount': float(instance.amount or 0), 'description': instance.description}
        instance.delete()
        audit_event(
            self.request,
            'EXPENSE_DELETED',
            'Expense',
            entity_id,
            entity_name=entity_name,
            before=before,
            reason=self.request.data.get('reason', 'Expense deleted'),
        )


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
        from .services.approval_service import ApprovalService
        invoice_id = request.data.get('invoice')
        reason = request.data.get('reason', '')
        refund_method = request.data.get('refund_method', 'cash')
        items_data = request.data.get('items', [])

        try:
            invoice = Invoice.objects.get(pk=invoice_id, business=request.user.business)
            refund_total = Decimal('0')
            for row in items_data:
                inv_item = InvoiceItem.objects.get(pk=row.get('invoice_item_id'), invoice=invoice)
                ret_qty = Decimal(str(row.get('quantity', inv_item.quantity)))
                line_total = (inv_item.total / inv_item.quantity * ret_qty).quantize(Decimal('0.01'))
                refund_total += line_total

            req_appr, rule_desc = ApprovalService.should_require_approval(
                request.user.business,
                request.user,
                'refund',
                refund_amount=refund_total,
            )
            if req_appr:
                current_data = {
                    'invoice_id': invoice.id,
                    'invoice_number': invoice.invoice_number,
                    'customer_name': invoice.customer_name or (invoice.customer.name if invoice.customer else ''),
                    'grand_total': float(invoice.grand_total),
                    'payment_status': invoice.payment_status,
                }
                proposed_data = {
                    'invoice_id': invoice.id,
                    'refund_amount': float(refund_total),
                    'refund_method': refund_method,
                    'reason': reason,
                    'items': items_data,
                }
                appr_req = ApprovalService.create_approval_request(
                    business=request.user.business,
                    requested_by=request.user,
                    request_type='refund',
                    entity_type='SalesReturn',
                    entity_id=invoice.id,
                    entity_name=f"Return #{invoice.invoice_number} (INR {refund_total:,.2f})",
                    current_data=current_data,
                    proposed_data=proposed_data,
                    threshold_rule=rule_desc,
                    reason=reason,
                    request=request,
                )
                return Response({
                    'requires_approval': True,
                    'approval_request': ApprovalRequestSerializer(appr_req).data,
                    'message': f"Refund requires admin approval: {rule_desc}. Request submitted for review.",
                }, status=status.HTTP_202_ACCEPTED)
        except (Invoice.DoesNotExist, InvoiceItem.DoesNotExist, KeyError):
            pass

        try:
            return_obj = SalesReturnService.create_sales_return(
                invoice_id=invoice_id,
                reason=reason,
                refund_method=refund_method,
                items_data=items_data,
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
            template=request.query_params.get('template'),
        )


def _invoice_pdf_response(invoice, printer=None, download=False, template=None):
    """Generate an A4/A5/thermal invoice PDF with an explicit browser disposition."""
    from .pdf_utils import generate_invoice_pdf, generate_thermal_invoice_pdf
    from .services.template_service import get_active_templates

    active_templates = get_active_templates(invoice.business)
    business_settings = {
        setting.key: setting.value
        for setting in Setting.objects.filter(
            business=invoice.business, key__in=['printer_type', 'invoice_template', 'invoice_paper_size']
        )
    }
    printer_setting = business_settings.get('printer_type', 'a4').lower()
    global_template = business_settings.get('invoice_template', active_templates.get('invoice_template', 'gst_a4')).lower()
    requested_printer = (printer or '').lower().strip()
    requested_template = (template or '').lower().strip()

    resolved_template = requested_template
    if not resolved_template:
        if requested_printer in ('half_a4', 'a5'):
            resolved_template = active_templates.get('active_template_half_a4', 'half_a4')
        elif requested_printer in ('thermal_58', '58mm'):
            resolved_template = 'thermal_58'
        elif requested_printer in ('thermal', 'thermal_80', '80mm'):
            resolved_template = active_templates.get('active_template_thermal', 'thermal_80')
        elif requested_printer == 'a4':
            resolved_template = active_templates.get('active_template_a4', 'gst_a4')
        else:
            resolved_template = global_template

    use_thermal = (
        resolved_template.startswith('thermal')
        or requested_printer in ('thermal', 'thermal_80', 'thermal_58', '58mm', '80mm')
        or (
            not requested_printer
            and not requested_template
            and (
                printer_setting in ('thermal', 'thermal_80', 'thermal_58', '58mm', '80mm')
                or global_template.startswith('thermal')
            )
        )
    )
    is_a5 = resolved_template in ('half_a4', 'advanced_gst_a5') or requested_printer in ('half_a4', 'a5')
    req_paper = 'a5' if is_a5 else ('a4' if (requested_printer == 'a4' or resolved_template in ('gst_a4', 'luxury', 'stylish')) else None)

    # An explicit A4/A5 request must work even when the business default is thermal.
    buffer = (
        generate_thermal_invoice_pdf(invoice, template=resolved_template)
        if use_thermal
        else generate_invoice_pdf(invoice, force_a4=True, paper_size=req_paper, template=resolved_template)
    )
    response = HttpResponse(buffer, content_type='application/pdf')
    suffix = 'thermal-58' if (resolved_template == 'thermal_58' or requested_printer in ('thermal_58', '58mm')) else ('thermal' if use_thermal else ('a5' if is_a5 else 'a4'))
    disposition = 'attachment' if download else 'inline'
    response['Content-Disposition'] = (
        f'{disposition}; filename="invoice-{invoice.invoice_number}-{suffix}.pdf"'
    )
    return response


class InvoiceShortLinkView(APIView):
    """Create or return the current canonical public bill link for an invoice."""
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
            'short_url': short_url,
            'expires_at': link.expires_at,
        })


class PublicInvoiceShortLinkView(APIView):
    """Redirect a valid short link to the customer-facing digital bill."""
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

        from django.http import HttpResponseRedirect
        from decouple import config as env
        frontend_url = env('FRONTEND_URL', default='http://localhost:3000').rstrip('/')
        return HttpResponseRedirect(f"{frontend_url}/bill/{link.invoice.public_token}")


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
            'logo': business_settings.get('shop_logo', '') or (
                request.build_absolute_uri(business.logo.url)
                if (business and business.logo) else ''
            ),
        }

        invoice_data = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'public_token': invoice.public_token,
            'short_url': invoice.get_short_url(request=request),
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
            'shop_website': business_settings.get('shop_website', ''),
            'shop_gstin': business_data['gstin'],
            'shop_pan': business_data['pan'],
            'shop_upi_id': business_settings.get('shop_upi_id', ''),
            'shop_bank_details': business_settings.get('shop_bank_details', ''),
            'shop_bank_name': business_settings.get('shop_bank_name', ''),
            'shop_bank_branch': business_settings.get('shop_bank_branch', ''),
            'shop_bank_account': business_settings.get('shop_bank_account', ''),
            'shop_bank_ifsc': business_settings.get('shop_bank_ifsc', ''),
            'currency': business_settings.get('currency', '₹'),
            'invoice_terms': business_settings.get('invoice_terms', ''),
            'invoice_notes': business_settings.get('invoice_notes', ''),
            'invoice_footer': business_settings.get('invoice_footer', 'Thank you for shopping with us! Visit again.'),
            'invoice_template': business_settings.get('invoice_template', 'gst_a4'),
            'printer_type': business_settings.get('printer_type', 'a4'),
            'enable_invoice_qr': business_settings.get('enable_invoice_qr', 'true'),
            'shop_logo': business_settings.get('shop_logo', ''),
            'show_business_logo': business_settings.get('show_business_logo', 'true'),
            'show_business_address': business_settings.get('show_business_address', 'true'),
            'show_business_phone': business_settings.get('show_business_phone', 'true'),
            'show_business_email': business_settings.get('show_business_email', 'true'),
            'show_business_gstin': business_settings.get('show_business_gstin', 'true'),
            'show_business_pan': business_settings.get('show_business_pan', 'true'),
            'show_customer_address': business_settings.get('show_customer_address', 'true'),
            'show_customer_phone': business_settings.get('show_customer_phone', 'true'),
            'show_customer_gstin': business_settings.get('show_customer_gstin', 'true'),
            'show_notes': business_settings.get('show_notes', 'true'),
            'show_terms': business_settings.get('show_terms', 'true'),
            'show_bank_details': business_settings.get('show_bank_details', 'true'),
            'show_upi_qr_on_invoice': business_settings.get('show_upi_qr_on_invoice', 'true'),
            'show_upi_qr_on_thermal': business_settings.get('show_upi_qr_on_thermal', 'true'),
            'show_payment_summary': business_settings.get('show_payment_summary', 'true'),
            'show_balance_due': business_settings.get('show_balance_due', 'true'),
            'invoice_paper_size': business_settings.get('invoice_paper_size', 'a4'),
            'invoice_header_layout': business_settings.get('invoice_header_layout', 'logo_left'),
        }

        return Response({
            'invoice': invoice_data,
            'business': business_data,
            'settings': public_settings,
        })


class PublicBillDocumentView(APIView):
    """Render the configured A4 or thermal document for the public bill page."""
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
            template=request.query_params.get('template'),
        )


class CancelInvoiceView(APIView):
    permission_classes = [IsCashierOrAdmin]

    def post(self, request, pk):
        from .services.invoice_service import InvoiceService
        from .services.approval_service import ApprovalService
        reason = request.data.get('reason', '').strip() or 'Customer requested cancellation'
        try:
            invoice = Invoice.objects.get(pk=pk, business=request.user.business)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=404)

        if invoice.status in ('cancelled', 'refunded'):
            return Response({'error': f'Invoice is already {invoice.status}.'}, status=400)

        req_appr, rule_desc = ApprovalService.should_require_approval(
            request.user.business,
            request.user,
            'invoice_cancellation',
        )
        if req_appr:
            current_data = {
                'invoice_id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'customer_name': invoice.customer_name or (invoice.customer.name if invoice.customer else ''),
                'grand_total': float(invoice.grand_total),
                'payment_status': invoice.payment_status,
                'status': invoice.status,
            }
            proposed_data = {
                'invoice_id': invoice.id,
                'proposed_status': 'cancelled',
                'reason': reason,
            }
            appr_req = ApprovalService.create_approval_request(
                business=request.user.business,
                requested_by=request.user,
                request_type='invoice_cancellation',
                entity_type='Invoice',
                entity_id=invoice.id,
                entity_name=f"Invoice #{invoice.invoice_number}",
                current_data=current_data,
                proposed_data=proposed_data,
                threshold_rule=rule_desc,
                reason=reason,
                request=request,
            )
            return Response({
                'requires_approval': True,
                'approval_request': ApprovalRequestSerializer(appr_req).data,
                'message': f"Invoice cancellation requires admin approval. Request submitted for review.",
            }, status=status.HTTP_202_ACCEPTED)

        try:
            invoice = InvoiceService.cancel_invoice(
                invoice_id=pk,
                business=request.user.business,
                performed_by=request.user,
                reason=reason,
                request=request,
            )
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
    permission_classes = [IsCashierOrAdmin]

    def post(self, request):
        from .services.inventory_service import InventoryService
        from .services.approval_service import ApprovalService
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
            product = Product.objects.get(pk=product_id, business=request.user.business)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=404)

        req_appr, rule_desc = ApprovalService.should_require_approval(
            request.user.business,
            request.user,
            'stock_adjustment',
            quantity=quantity,
        )
        if req_appr:
            current_data = {
                'product_id': product.id,
                'product_name': product.name,
                'sku': product.sku,
                'current_stock': float(product.current_stock),
            }
            proposed_data = {
                'product_id': product.id,
                'quantity': float(quantity),
                'transaction_type': transaction_type,
                'notes': notes,
                'expected_stock': float(product.current_stock + quantity if transaction_type != 'stock_out' else product.current_stock - abs(quantity)),
            }
            appr_req = ApprovalService.create_approval_request(
                business=request.user.business,
                requested_by=request.user,
                request_type='stock_adjustment',
                entity_type='Product',
                entity_id=product.id,
                entity_name=f"{product.name} ({'+' if quantity > 0 else ''}{quantity})",
                current_data=current_data,
                proposed_data=proposed_data,
                threshold_rule=rule_desc,
                reason=notes,
                request=request,
            )
            return Response({
                'requires_approval': True,
                'approval_request': ApprovalRequestSerializer(appr_req).data,
                'message': f"Stock adjustment requires admin approval: {rule_desc}. Request submitted for review.",
            }, status=status.HTTP_202_ACCEPTED)

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
            return Response({'error': str(exc)}, status=400)

        audit_event(
            request,
            'STOCK_ADJUSTED',
            'Product',
            product.id,
            entity_name=product.name,
            before={'current_stock': float(product.current_stock - quantity)},
            after={'current_stock': float(product.current_stock), 'adjustment': float(quantity), 'transaction_type': transaction_type},
            reason=notes or f'Stock adjusted ({transaction_type})',
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
    filterset_fields = ['module', 'action', 'result', 'entity']
    search_fields = ['id', 'action', 'entity', 'entity_id', 'entity_name', 'reason', 'user__username', 'user__email', 'ip_address']
    ordering = ['-created_at']

    HIGH_IMPACT_ACTIONS = [
        'USER_PERMISSIONS_CHANGED', 'SETTINGS_CHANGED', 'INVOICE_CANCELLED',
        'INVOICE_REFUNDED', 'PRODUCT_ARCHIVED', 'PRICE_CHANGED',
        'FINANCIAL_RESTORE_BLOCKED', 'LOGIN_FAILED', 'CUSTOMER_DELETED',
        'SUPPLIER_DELETED', 'EXPENSE_DELETED', 'PRODUCT_DELETED',
        'PAYMENT_FAILED',
    ]

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user').filter(
            business=self.request.user.business
        ).exclude(action__in=['create', 'update', 'cancel', 'refund', 'adjust', 'archive'])

        high_impact = self.request.query_params.get('high_impact')
        if high_impact in ('true', '1', 'yes', True):
            qs = qs.filter(action__in=self.HIGH_IMPACT_ACTIONS)

        module = self.request.query_params.get('module')
        if module and module != 'ALL':
            qs = qs.filter(module__iexact=module)

        action_param = self.request.query_params.get('action')
        if action_param and action_param != 'ALL':
            qs = qs.filter(action=action_param)

        result_param = self.request.query_params.get('result')
        if result_param and result_param != 'ALL':
            qs = qs.filter(result=result_param)

        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            from datetime import datetime, time
            from django.utils.dateparse import parse_datetime, parse_date
            parsed = parse_datetime(date_from)
            if parsed:
                if timezone.is_naive(parsed):
                    parsed = timezone.make_aware(parsed)
                qs = qs.filter(created_at__gte=parsed)
            else:
                parsed_date = parse_date(date_from)
                if parsed_date:
                    qs = qs.filter(created_at__gte=timezone.make_aware(datetime.combine(parsed_date, time.min)))
        if date_to:
            from datetime import datetime, time, timedelta
            from django.utils.dateparse import parse_datetime, parse_date
            parsed = parse_datetime(date_to)
            if parsed:
                if timezone.is_naive(parsed):
                    parsed = timezone.make_aware(parsed)
                qs = qs.filter(created_at__lte=parsed)
            else:
                parsed_date = parse_date(date_to)
                if parsed_date:
                    qs = qs.filter(created_at__lt=timezone.make_aware(datetime.combine(parsed_date + timedelta(days=1), time.min)))
        operator = self.request.query_params.get('operator')
        if operator:
            qs = qs.filter(user_id=operator)
        entity_type = self.request.query_params.get('entity_type') or self.request.query_params.get('entity')
        if entity_type and entity_type != 'ALL':
            qs = qs.filter(entity__iexact=entity_type)
        return qs

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.filter_queryset(self.get_queryset())
        unfiltered_qs = AuditLog.objects.filter(
            business=request.user.business
        ).exclude(action__in=['create', 'update', 'cancel', 'refund', 'adjust', 'archive'])

        total_overall = unfiltered_qs.count()
        total_matching = qs.count()
        successful_count = qs.filter(result='success').count()
        failed_count = qs.filter(result='failure').count()
        unique_operators = qs.exclude(user__isnull=True).values('user').distinct().count()
        high_impact_count = qs.filter(action__in=self.HIGH_IMPACT_ACTIONS).count()

        from django.db.models import Count
        by_module = list(qs.values('module').annotate(count=Count('id')).order_by('-count')[:10])
        by_action = list(qs.values('action').annotate(count=Count('id')).order_by('-count')[:10])
        by_operator = list(qs.exclude(user__isnull=True).values('user__username').annotate(count=Count('id')).order_by('-count')[:10])

        return Response({
            'total_overall': total_overall,
            'total_matching': total_matching,
            'successful_count': successful_count,
            'failed_count': failed_count,
            'unique_operators': unique_operators,
            'high_impact_count': high_impact_count,
            'by_module': by_module,
            'by_action': by_action,
            'by_operator': by_operator,
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        import csv
        from django.http import HttpResponse

        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        response['Content-Disposition'] = f'attachment; filename="audit_trail_{timestamp}.csv"'

        def sanitize_cell(val):
            if val is None:
                return ''
            s = str(val).strip()
            if s and s[0] in ('=', '+', '-', '@', '\t', '\r'):
                return "'" + s
            return s

        writer = csv.writer(response)
        writer.writerow([
            'Timestamp', 'Operator', 'Email', 'Role',
            'Action', 'Module', 'Entity', 'Entity ID', 'Entity Name',
            'Outcome', 'Reason', 'Previous Value', 'New Value',
            'IP Address', 'User Agent'
        ])

        for log in qs[:5000]:
            writer.writerow([
                sanitize_cell(log.created_at.isoformat() if log.created_at else ''),
                sanitize_cell(log.user.username if log.user else 'System'),
                sanitize_cell(log.user.email if log.user else ''),
                sanitize_cell(getattr(log.user, 'role', '') if log.user else ''),
                sanitize_cell(log.action),
                sanitize_cell(log.module),
                sanitize_cell(log.entity),
                sanitize_cell(log.entity_id),
                sanitize_cell(log.entity_name),
                sanitize_cell(log.result),
                sanitize_cell(log.failure_reason if log.result == 'failure' else log.reason),
                sanitize_cell(log.previous_value),
                sanitize_cell(log.new_value),
                sanitize_cell(log.ip_address),
                sanitize_cell(log.user_agent),
            ])

        audit_event(
            request,
            'AUDIT_EXPORTED',
            'AuditLog',
            after={'count': qs.count()},
            reason='Audit trail exported to CSV',
        )
        return response


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
            audit_event(
                request,
                'FINANCIAL_RESTORE_BLOCKED',
                entity_type.capitalize(),
                pk,
                entity_name=f'{entity_type.capitalize()} #{pk}',
                result='failure',
                reason='Statutory audit violation: Financial transactions cannot be restored or un-cancelled',
            )
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
            'shop_name': request.query_params.get('shop_name', '').strip(),
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


def _get_registered_label_fonts():
    """Register and return (regular_font_name, bold_font_name) supporting Unicode currency symbol ₹."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import os

    reg_name = 'LabelSans'
    bold_name = 'LabelSans-Bold'
    if reg_name in pdfmetrics.getRegisteredFontNames() and bold_name in pdfmetrics.getRegisteredFontNames():
        return reg_name, bold_name

    candidates = [
        ('C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/arialbd.ttf'),
        ('C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/segoeuib.ttf'),
        ('C:/Windows/Fonts/calibri.ttf', 'C:/Windows/Fonts/calibrib.ttf'),
        ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
        ('/usr/share/fonts/TTF/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf'),
        ('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'),
        ('/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'),
        ('/Library/Fonts/Arial.ttf', '/Library/Fonts/Arial Bold.ttf'),
    ]

    try:
        import matplotlib
        mpl_ttf = os.path.join(os.path.dirname(matplotlib.__file__), 'mpl-data', 'fonts', 'ttf')
        candidates.insert(0, (os.path.join(mpl_ttf, 'DejaVuSans.ttf'), os.path.join(mpl_ttf, 'DejaVuSans-Bold.ttf')))
    except Exception:
        pass

    for reg_path, bold_path in candidates:
        if os.path.exists(reg_path) and os.path.exists(bold_path):
            try:
                if reg_name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont(reg_name, reg_path))
                if bold_name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont(bold_name, bold_path))
                return reg_name, bold_name
            except Exception:
                continue

    return 'Helvetica', 'Helvetica-Bold'


def _wrap_label_text(text, max_lines, max_width, font_name, font_size):
    """Splits text across up to max_lines, clipping gracefully with ellipsis if needed."""
    from reportlab.pdfbase import pdfmetrics
    words = str(text or '').strip().split()
    if not words:
        return []
    lines = []
    current = []
    for i, word in enumerate(words):
        test_line = ' '.join(current + [word])
        if pdfmetrics.stringWidth(test_line, font_name, font_size) <= max_width:
            current.append(word)
        else:
            if not current:
                w = word
                while w and pdfmetrics.stringWidth(w + '...', font_name, font_size) > max_width:
                    w = w[:-1]
                lines.append(w + '...')
            else:
                lines.append(' '.join(current))
                current = [word]
            if len(lines) >= max_lines - 1:
                last_text = ' '.join(current + words[i + 1:])
                while last_text and pdfmetrics.stringWidth(last_text + '...', font_name, font_size) > max_width:
                    last_text = last_text[:-1]
                lines.append(last_text.rstrip() + ('...' if len(lines) < max_lines and last_text != ' '.join(words) else ''))
                return lines[:max_lines]
    if current and len(lines) < max_lines:
        lines.append(' '.join(current))
    return lines[:max_lines]


def _format_label_price(val):
    if val is None or val == '':
        return '₹0.00'
    try:
        f_val = float(val)
        return f'₹{f_val:,.2f}'
    except (ValueError, TypeError):
        return f'₹{val}'


def _generate_barcode_label_pdf(product, copies, options=None):
    """Generates clean, print-ready, strictly black-and-white barcode label sheets (A4 3x5, A4 4x8, 58mm, 80mm).
    Features:
    - Pure black and white (#000000 on #FFFFFF)
    - Vector Code 128 machine-readable barcode
    - Pre-cut sheet whitespace alignment without decorative borders
    - Proper typography hierarchy: Store Name, Product Name, Unit, Barcode, Barcode No, Selling Price (dominant), MRP, SKU
    - Strikethrough for MRP when selling price < MRP
    - Print at 100% / Actual size margin notice
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib import colors as rl_colors
    from reportlab.graphics.barcode import createBarcodeDrawing
    from reportlab.pdfbase import pdfmetrics

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

    font_reg, font_bold = _get_registered_label_fonts()

    # Geometry per label format
    if size_type == 'a4_4x8':
        PAGE_W, PAGE_H = A4
        COLS, ROWS = 4, 8
        LABEL_W = 48.0 * mm
        LABEL_H = 34.0 * mm
        GAP_X = 2.0 * mm
        GAP_Y = 2.0 * mm
        MARGIN_X = (PAGE_W - (COLS * LABEL_W + (COLS - 1) * GAP_X)) / 2.0
        MARGIN_Y = (PAGE_H - (ROWS * LABEL_H + (ROWS - 1) * GAP_Y)) / 2.0
        is_compact = True
    elif size_type == 'thermal_58':
        PAGE_W, PAGE_H = 58.0 * mm, 40.0 * mm
        COLS, ROWS = 1, 1
        LABEL_W = 54.0 * mm
        LABEL_H = 36.0 * mm
        MARGIN_X = 2.0 * mm
        MARGIN_Y = 2.0 * mm
        GAP_X = 0.0
        GAP_Y = 0.0
        is_compact = True
    elif size_type == 'thermal_80':
        PAGE_W, PAGE_H = 80.0 * mm, 50.0 * mm
        COLS, ROWS = 1, 1
        LABEL_W = 74.0 * mm
        LABEL_H = 44.0 * mm
        MARGIN_X = 3.0 * mm
        MARGIN_Y = 3.0 * mm
        GAP_X = 0.0
        GAP_Y = 0.0
        is_compact = False
    elif size_type == 'custom':
        PAGE_W, PAGE_H = A4
        COLS, ROWS = custom_cols, custom_rows
        MARGIN_X, MARGIN_Y = 6.0 * mm, 6.5 * mm
        GAP_X, GAP_Y = 2.5 * mm, 2.5 * mm
        LABEL_W = (PAGE_W - (2 * MARGIN_X) - ((COLS - 1) * GAP_X)) / COLS
        LABEL_H = (PAGE_H - (2 * MARGIN_Y) - ((ROWS - 1) * GAP_Y)) / ROWS
        is_compact = (ROWS > 6 or COLS > 3)
    else:  # a4_3x5 (Standard 15-label sheet, approx 64x54mm)
        PAGE_W, PAGE_H = A4
        COLS, ROWS = 3, 5
        LABEL_W = 64.0 * mm
        LABEL_H = 54.0 * mm
        GAP_X = 3.0 * mm
        GAP_Y = 3.5 * mm
        MARGIN_X = (PAGE_W - (COLS * LABEL_W + (COLS - 1) * GAP_X)) / 2.0
        MARGIN_Y = (PAGE_H - (ROWS * LABEL_H + (ROWS - 1) * GAP_Y)) / 2.0
        is_compact = False

    barcode_value = (product.barcode or product.sku or str(product.id)).strip()

    shop_name = options.get('shop_name', '').strip()
    if show_store and not shop_name:
        try:
            s = Setting.objects.filter(business=product.business, key='shop_name').first()
            if s and s.value:
                shop_name = s.value.strip()
        except Exception:
            pass
    if show_store and not shop_name and getattr(product, 'business', None):
        shop_name = getattr(product.business, 'name', '').strip()
    if show_store and not shop_name:
        shop_name = 'STORE'

    product_name = (product.name or 'Product').strip()
    product_unit = (product.unit or '').strip()

    try:
        selling_float = float(product.selling_price or 0)
    except (ValueError, TypeError):
        selling_float = 0.0

    try:
        mrp_float = float(product.mrp or 0) if product.mrp is not None else 0.0
    except (ValueError, TypeError):
        mrp_float = 0.0

    has_mrp = bool(show_mrp and product.mrp is not None and str(product.mrp).strip() != '' and mrp_float > 0)
    strike_mrp = bool(has_mrp and mrp_float > selling_float)
    mrp_str = f'MRP {_format_label_price(mrp_float)}' if has_mrp else ''

    has_sku = bool(show_sku and product.sku)
    sku_str = f'SKU: {product.sku}' if has_sku else ''

    price_str = _format_label_price(selling_float)

    labels_per_page = COLS * ROWS
    buffer = BytesIO()
    c = rl_canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    def draw_margin_notice():
        if not size_type.startswith('thermal'):
            c.setFont(font_reg, 6.5)
            c.setFillColor(rl_colors.black)
            c.drawCentredString(PAGE_W / 2.0, 3.2 * mm, 'Print at 100% / Actual Size. Disable "Fit to Page".')

    for i in range(copies):
        col = i % COLS
        row = (i // COLS) % ROWS
        page_index = i % labels_per_page

        # New page trigger
        if i > 0 and page_index == 0:
            draw_margin_notice()
            c.showPage()

        x = MARGIN_X + col * (LABEL_W + GAP_X)
        y = PAGE_H - MARGIN_Y - (row + 1) * LABEL_H - row * GAP_Y

        # Strictly pure black and white without any border, box, card outline, or gray shading
        c.setFillColor(rl_colors.black)
        c.setStrokeColor(rl_colors.black)

        center_x = x + (LABEL_W / 2.0)
        side_pad = (3.5 if is_compact else 4.5) * mm
        max_text_w = LABEL_W - (2 * side_pad)

        # Top section (top down)
        curr_y = y + LABEL_H - (1.6 if is_compact else 2.2) * mm

        # Store Name
        if show_store and shop_name:
            store_size = 5.8 if is_compact else 7.5
            curr_y -= store_size
            c.setFont(font_bold, store_size)
            store_txt = shop_name.upper()
            while store_txt and pdfmetrics.stringWidth(store_txt, font_bold, store_size) > max_text_w:
                store_txt = store_txt[:-1]
            c.drawCentredString(center_x, curr_y, store_txt)
            curr_y -= (1.2 if is_compact else 1.8) * mm

        # Product Name
        if show_name and product_name:
            name_size = 7.5 if is_compact else 9.5
            name_lines = _wrap_label_text(product_name, 1 if is_compact else 2, max_text_w, font_bold, name_size)
            for line in name_lines:
                curr_y -= name_size
                c.setFont(font_bold, name_size)
                c.drawCentredString(center_x, curr_y, line)
                curr_y -= (1.0 if is_compact else 1.4) * mm

        # Unit
        if show_unit and product_unit:
            unit_size = 5.2 if is_compact else 6.5
            curr_y -= unit_size
            c.setFont(font_reg, unit_size)
            c.drawCentredString(center_x, curr_y, product_unit)
            curr_y -= (1.0 if is_compact else 1.4) * mm

        top_content_bottom = curr_y

        # Bottom section (bottom up)
        bottom_y = y + (1.6 if is_compact else 2.2) * mm

        # Footer: MRP & SKU
        footer_size = 5.5 if is_compact else 7.0
        c.setFont(font_reg, footer_size)

        if has_mrp and has_sku:
            mrp_w = pdfmetrics.stringWidth(mrp_str, font_reg, footer_size)
            sku_w = pdfmetrics.stringWidth(sku_str, font_reg, footer_size)
            gap = 3.0 * mm
            if (mrp_w + gap + sku_w) <= max_text_w:
                start_x = center_x - ((mrp_w + gap + sku_w) / 2.0)
                c.drawString(start_x, bottom_y, mrp_str)
                if strike_mrp:
                    sy = bottom_y + (footer_size * 0.35)
                    c.setLineWidth(0.7)
                    c.line(start_x, sy, start_x + mrp_w, sy)
                c.drawString(start_x + mrp_w + gap, bottom_y, sku_str)
                bottom_y += footer_size + (1.4 if is_compact else 1.8) * mm
            else:
                c.drawCentredString(center_x, bottom_y, sku_str)
                bottom_y += footer_size + (1.0 if is_compact else 1.3) * mm
                c.drawCentredString(center_x, bottom_y, mrp_str)
                if strike_mrp:
                    sy = bottom_y + (footer_size * 0.35)
                    c.setLineWidth(0.7)
                    c.line(center_x - (mrp_w / 2.0), sy, center_x + (mrp_w / 2.0), sy)
                bottom_y += footer_size + (1.4 if is_compact else 1.8) * mm
        elif has_mrp:
            mrp_w = pdfmetrics.stringWidth(mrp_str, font_reg, footer_size)
            c.drawCentredString(center_x, bottom_y, mrp_str)
            if strike_mrp:
                sy = bottom_y + (footer_size * 0.35)
                c.setLineWidth(0.7)
                c.line(center_x - (mrp_w / 2.0), sy, center_x + (mrp_w / 2.0), sy)
            bottom_y += footer_size + (1.4 if is_compact else 1.8) * mm
        elif has_sku:
            c.drawCentredString(center_x, bottom_y, sku_str)
            bottom_y += footer_size + (1.4 if is_compact else 1.8) * mm

        # Selling Price (bold, largest text on label)
        if show_price:
            price_size = 9.5 if is_compact else 13.5
            c.setFont(font_bold, price_size)
            c.drawCentredString(center_x, bottom_y, price_str)
            bottom_y += price_size + (1.4 if is_compact else 1.8) * mm

        # Barcode Number
        if show_number and barcode_value:
            num_size = 5.5 if is_compact else 7.0
            c.setFont(font_reg, num_size)
            c.drawCentredString(center_x, bottom_y, barcode_value)
            bottom_y += num_size + (1.0 if is_compact else 1.4) * mm

        bottom_content_top = bottom_y

        # Middle section: Machine-readable Code 128 barcode
        if show_barcode and barcode_value:
            avail_h = top_content_bottom - bottom_content_top
            bc_h = max(5 * mm, min(14 * mm, avail_h - (2 * mm))) if not is_compact else max(4 * mm, min(9 * mm, avail_h - (1 * mm)))
            max_bc_w = LABEL_W - (2 * side_pad)
            try:
                ref_bc = createBarcodeDrawing('Code128', value=barcode_value, barWidth=1.0, barHeight=bc_h, humanReadable=False)
                bw = max(0.4, min(1.15 if not is_compact else 0.85, max_bc_w / max(1.0, ref_bc.width)))
                bc_d = createBarcodeDrawing('Code128', value=barcode_value, barWidth=bw, barHeight=bc_h, humanReadable=False)
                bc_x = center_x - (bc_d.width / 2.0)
                bc_y = bottom_content_top + ((avail_h - bc_h) / 2.0)
                bc_d.drawOn(c, bc_x, bc_y)
            except Exception:
                c.setFont(font_bold, 8)
                c.drawCentredString(center_x, bottom_content_top + (avail_h / 2.0), barcode_value)

    draw_margin_notice()
    c.save()
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
        amount_input = request.data.get('amount')

        invoice = None
        if invoice_id:
            try:
                invoice = Invoice.objects.get(pk=invoice_id, business=request.user.business)
            except Invoice.DoesNotExist:
                return Response({'error': 'Invoice not found'}, status=404)

            if invoice.payment_status == 'paid':
                return Response({'error': 'Invoice is already paid'}, status=400)

            amount_rupees = invoice.grand_total
        elif amount_input is not None:
            try:
                from decimal import Decimal
                amount_rupees = Decimal(str(amount_input))
            except Exception:
                return Response({'error': 'Invalid amount'}, status=400)
        else:
            return Response({'error': 'invoice_id or amount is required'}, status=400)

        amount_paise = int(amount_rupees * 100)
        if amount_paise <= 0:
            return Response({'error': 'Amount must be greater than zero'}, status=400)

        cutoff = timezone.now() - timedelta(minutes=30)
        if invoice:
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

        receipt = generate_receipt(invoice.invoice_number if invoice else 'POS')
        result = create_order(
            amount_paise=amount_paise,
            receipt=receipt,
            notes={
                'invoice_number': invoice.invoice_number if invoice else '',
                'invoice_id': str(invoice.pk) if invoice else '',
                'business_id': str(request.user.business_id or ''),
            },
        )

        RazorpayTransaction.objects.create(
            business=request.user.business,
            invoice=invoice,
            razorpay_order_id=result['order_id'] if result['success'] else f'FAILED-{receipt}',
            merchant_transaction_id=receipt,
            amount=amount_rupees,
            status='created' if result['success'] else 'failed',
            failure_reason=str(result.get('error', '')) if not result['success'] else '',
            response_data=str(result.get('error', '')),
        )

        if not result['success']:
            logger.warning('Razorpay order creation failed: %s', result.get('error'))
            return Response({'error': result.get('error', 'Razorpay order creation failed')}, status=502)

        logger.info('Razorpay: created order %s amount=%s', result['order_id'], amount_rupees)
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
            audit_event(
                request,
                'PAYMENT_FAILED',
                'Payment',
                txn.id,
                entity_name=f'Order {order_id}',
                result='failure',
                reason='Payment signature verification failed',
                after={'order_id': order_id, 'payment_id': payment_id, 'amount': float(txn.amount)},
            )
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
                audit_event(
                    request,
                    'PAYMENT_FAILED',
                    'Payment',
                    txn.id,
                    entity_name=f'Order {order_id}',
                    result='failure',
                    reason=f'AMOUNT_MISMATCH expected={expected_paise} got={razorpay_amount}',
                    after={'order_id': order_id, 'payment_id': payment_id, 'amount': float(txn.amount)},
                )
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

            audit_event(
                request,
                'PAYMENT_RECONCILED',
                'Payment',
                txn.id,
                entity_name=f'Order {order_id}',
                after={'order_id': order_id, 'payment_id': payment_id, 'amount': float(txn.amount), 'invoice_id': txn.invoice_id},
                reason='Online payment verified and reconciled via Razorpay',
            )

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
        business = request.user.business
        if not business:
            return Response([])

        qs = RazorpayTransaction.objects.select_related('invoice').filter(
            Q(business=business) | Q(invoice__business=business)
        ).distinct().order_by('-created_at')

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

        transaction_date = request.query_params.get('date')
        if transaction_date:
            from django.utils.dateparse import parse_date
            parsed_date = parse_date(transaction_date)
            if parsed_date:
                qs = qs.filter(created_at__date=parsed_date)

        try:
            page_size = min(max(int(request.query_params.get('page_size', 50)), 1), 200)
        except (TypeError, ValueError):
            page_size = 50
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

        # Role-based notification filtering
        user_role = getattr(request.user, 'role', 'admin') or 'admin'
        role_filter = request.query_params.get('role_filter') or request.query_params.get('scope')
        is_admin_or_owner = user_role in ['admin', 'owner'] or getattr(request.user, 'is_superuser', False)

        is_role_scoped = role_filter == 'my_role' or (role_filter is None and not is_admin_or_owner)
        if is_role_scoped:
            if user_role == 'cashier':
                # Cashiers see counter payments, immediate low stock, and approval requests initiated by themselves
                cashier_types = ['payment_received', 'low_stock', 'quotation_expiring']
                qs = qs.filter(
                    Q(notification_type__in=cashier_types) |
                    Q(notification_type='approval_required', data__requested_by=request.user.username)
                )
            elif user_role == 'accountant':
                accountant_types = [
                    'invoice_overdue', 'payment_received', 'gst_submission_failed',
                    'einvoice_failed', 'eway_bill_expiring', 'approval_required'
                ]
                qs = qs.filter(notification_type__in=accountant_types)
            elif user_role == 'manager':
                manager_types = [
                    'low_stock', 'batch_expiring', 'purchase_order_pending',
                    'quotation_expiring', 'invoice_overdue', 'approval_required'
                ]
                qs = qs.filter(notification_type__in=manager_types)

        limit = min(int(request.query_params.get('limit', 100)), 200)

        unread_count = qs.filter(is_read=False).count()
        critical_count = qs.filter(
            is_read=False, severity__in=['danger', 'warning']
        ).count()
        pending_approval_count = qs.filter(
            requires_approval=True, status='active'
        ).count()

        counts_by_type = {}
        for row in qs.filter(is_read=False).values('notification_type').annotate(cnt=Count('id')):
            counts_by_type[row['notification_type']] = row['cnt']

        return Response({
            'notifications': NotificationSerializer(qs[:limit], many=True).data,
            'unread_count': unread_count,
            'critical_count': critical_count,
            'pending_approval_count': pending_approval_count,
            'counts_by_type': counts_by_type,
            'user_role': user_role,
            'is_role_scoped': is_role_scoped,
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

            if not notif.requires_approval:
                return Response({'error': 'This notification does not require approval.'}, status=status.HTTP_400_BAD_REQUEST)
            if notif.status != 'active':
                return Response({'error': 'This approval request has already been resolved.'}, status=status.HTTP_409_CONFLICT)

            if action_type not in ('approve', 'reject'):
                return Response(
                    {'error': 'Action must be "approve" or "reject"'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            appr_id = (notif.data or {}).get('approval_request_id')
            if appr_id:
                from .services.approval_service import ApprovalService
                try:
                    if action_type == 'approve':
                        ApprovalService.approve_request(
                            approval_request_id=appr_id,
                            admin_user=request.user,
                            review_notes=notes,
                            request=request,
                        )
                    else:
                        ApprovalService.reject_request(
                            approval_request_id=appr_id,
                            admin_user=request.user,
                            review_notes=notes,
                            request=request,
                        )
                    notif.refresh_from_db()
                except Exception as exc:
                    return Response({'error': str(exc)}, status=400)
            else:
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
                'actioned_at': notif.actioned_at,
                'action_notes': notif.action_notes,
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
        f'{shop_name} - Bill {invoice.invoice_number}',
        f'Customer: {customer_name}',
        f'Date: {inv_date}',
        f'Amount: Rs.{invoice.grand_total:,.2f}',
        f'Payment: {status}',
    ]
    if short_url:
        lines += ['', 'View your bill:', short_url]
    lines += ['', 'Thank you for shopping with us.']
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
        f'{shop_name}: Statement of Account',
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


class ApprovalRequestViewSet(viewsets.ModelViewSet):
    """Maker-checker approval management viewset for multi-threshold business workflows."""
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsCashierOrAdmin]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'request_type']
    search_fields = ['entity_name', 'threshold_rule', 'reason', 'requested_by__username']
    ordering_fields = ['created_at', 'status', 'request_type']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        biz = getattr(user, 'business', None)
        qs = ApprovalRequest.objects.select_related('requested_by', 'reviewed_by', 'notification').filter(business=biz)
        if getattr(user, 'role', '') not in ('owner', 'admin', 'manager') and not user.is_superuser:
            qs = qs.filter(requested_by=user)
        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def approve(self, request, pk=None):
        from .services.approval_service import ApprovalService
        notes = request.data.get('notes', '').strip()
        try:
            req = ApprovalService.approve_request(
                approval_request_id=pk,
                admin_user=request.user,
                review_notes=notes,
                request=request,
            )
            return Response(ApprovalRequestSerializer(req).data)
        except (ValueError, PermissionError) as exc:
            return Response({'error': str(exc)}, status=400)
        except Exception as exc:
            return Response({'error': f"Execution failed: {str(exc)}"}, status=500)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def reject(self, request, pk=None):
        from .services.approval_service import ApprovalService
        notes = request.data.get('notes', '').strip()
        try:
            req = ApprovalService.reject_request(
                approval_request_id=pk,
                admin_user=request.user,
                review_notes=notes,
                request=request,
            )
            return Response(ApprovalRequestSerializer(req).data)
        except (ValueError, PermissionError) as exc:
            return Response({'error': str(exc)}, status=400)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        from .services.approval_service import ApprovalService
        reason = request.data.get('reason', '').strip()
        try:
            req = ApprovalService.cancel_request(
                approval_request_id=pk,
                user=request.user,
                reason=reason,
                request=request,
            )
            return Response(ApprovalRequestSerializer(req).data)
        except (ValueError, PermissionError) as exc:
            return Response({'error': str(exc)}, status=400)

    @action(detail=False, methods=['get', 'post'], url_path='settings', permission_classes=[IsManagerOrAdmin])
    def approval_settings(self, request):
        from .services.approval_service import ApprovalService
        biz = request.user.business
        if request.method == 'GET':
            return Response(ApprovalService.get_approval_settings(biz))

        allowed_keys = list(ApprovalService.DEFAULT_SETTINGS.keys())
        for k, v in request.data.items():
            if k in allowed_keys:
                Setting.objects.update_or_create(
                    business=biz,
                    key=k,
                    defaults={'value': str(v)},
                )
        return Response(ApprovalService.get_approval_settings(biz))
