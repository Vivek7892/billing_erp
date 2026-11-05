from io import BytesIO
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.utils import get_column_letter

from ..services.report_business_service import ReportBusinessService
from ..services.report_formatting_service import format_table_cell_for_excel
from ..styles.excel_styles import (
    ALIGN_CENTER,
    ALIGN_HEADER_CENTER,
    ALIGN_LEFT,
    ALIGN_RIGHT,
    FILL_HEADER,
    FILL_TOTAL,
    FONT_META,
    FONT_REPORT_TITLE,
    FONT_SHOP_META,
    FONT_SHOP_NAME,
    FONT_TD,
    FONT_TH,
    FONT_TOTAL,
    NF_COUNT,
    NF_CURRENCY,
    NF_PERCENT,
    THIN_BORDER,
    TOTAL_BORDER,
)
from ..utils.column_resolver import (
    is_center_column,
    is_count_column,
    is_money_column,
    is_numeric_column,
    resolve_column_alignment,
)
from ..utils.totals_calculator import calculate_grand_totals


def generate_accounting_excel(
    title,
    headers,
    rows,
    business_profile=None,
    summary_rows=None,
    period_label='',
    request_user=None,
    filter_label='',
):
    """
    Generate traditional Indian accounting report Excel workbook matching the specification:
    - Pure white background, no arbitrary styling
    - Centered business header without truncation (rows 1, 2, 3)
    - Two-column metadata block:
        Left: Report Title, Formatted Date Range / Period, Filters
        Right: Printed By (User + Role), Print Date & Time, Branch ID
    - Native numeric values with explicit number formats (#,##0.00 / #,##0)
    - Auto-filter and freeze panes enabled
    - Thin black borders
    - Bold grand total row with double bottom border
    - A4 print configuration with repeating header rows
    """
    if not business_profile:
        business_profile = ReportBusinessService.get_profile(request_user)

    raw_headers = list(headers or [])
    if not raw_headers:
        raw_headers = ['Item', 'Details']

    num_cols = len(raw_headers)
    merge_max = max(num_cols, 4)
    norm_rows = list(rows or [])

    workbook = Workbook()
    sheet = workbook.active
    clean_title = (title or 'Report')[:31].replace('/', '-').replace('\\', '-').replace('*', '').replace(':', '')
    sheet.title = clean_title

    # 1. Centered Business Header (Multi-line without truncation)
    shop_name = (business_profile.get('shop_name') or 'ShopEase POS').upper()
    c_name = sheet.cell(row=1, column=1, value=shop_name)
    c_name.font = FONT_SHOP_NAME
    c_name.alignment = ALIGN_CENTER
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=merge_max)
    sheet.row_dimensions[1].height = 24

    shop_address = business_profile.get('shop_address') or ''
    if shop_address:
        c_addr = sheet.cell(row=2, column=1, value=shop_address)
        c_addr.font = FONT_SHOP_META
        c_addr.alignment = ALIGN_CENTER
        sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=merge_max)
        sheet.row_dimensions[2].height = 18
    else:
        sheet.row_dimensions[2].height = 5

    contact_parts = []
    if business_profile.get('shop_phone'):
        contact_parts.append(f"Phone: {business_profile['shop_phone']}")
    if business_profile.get('shop_email'):
        contact_parts.append(f"Email: {business_profile['shop_email']}")
    if business_profile.get('shop_gstin'):
        contact_parts.append(f"GSTIN: {business_profile['shop_gstin']}")

    contact_str = '  |  '.join(contact_parts)
    if contact_str:
        c_contact = sheet.cell(row=3, column=1, value=contact_str)
        c_contact.font = FONT_SHOP_META
        c_contact.alignment = ALIGN_CENTER
        sheet.merge_cells(start_row=3, start_column=1, end_row=3, end_column=merge_max)
        sheet.row_dimensions[3].height = 18
    else:
        sheet.row_dimensions[3].height = 5

    # Row 4 is spacer
    sheet.row_dimensions[4].height = 8

    # 2. Metadata Block (Rows 5-6)
    # Left: Report Title & Period
    c_title = sheet.cell(row=5, column=1, value=title.upper())
    c_title.font = FONT_REPORT_TITLE
    c_title.alignment = ALIGN_LEFT
    if num_cols >= 4:
        sheet.merge_cells(start_row=5, start_column=1, end_row=5, end_column=2)

    period_str = f"Period: {period_label or 'All Available Records'}"
    c_period = sheet.cell(row=6, column=1, value=period_str)
    c_period.font = FONT_META
    c_period.alignment = ALIGN_LEFT
    if num_cols >= 4:
        sheet.merge_cells(start_row=6, start_column=1, end_row=6, end_column=2)

    # Right: Printed by & Print Date & Time
    now_str = timezone.localtime(timezone.now()).strftime('%d-%b-%Y, %I:%M:%S %p')
    printed_by = business_profile.get('printed_by') or 'Administrator'
    branch_id = business_profile.get('branch_id')

    right_col = merge_max
    right_start_col = right_col - 1 if num_cols >= 4 else right_col

    c_pby = sheet.cell(row=5, column=right_start_col, value=f"Printed By: {printed_by}")
    c_pby.font = FONT_META
    c_pby.alignment = ALIGN_RIGHT
    if num_cols >= 4:
        sheet.merge_cells(start_row=5, start_column=right_start_col, end_row=5, end_column=right_col)

    c_pdate = sheet.cell(row=6, column=right_start_col, value=f"Print Date & Time: {now_str}")
    c_pdate.font = FONT_META
    c_pdate.alignment = ALIGN_RIGHT
    if num_cols >= 4:
        sheet.merge_cells(start_row=6, start_column=right_start_col, end_row=6, end_column=right_col)

    current_row = 7
    if filter_label or branch_id:
        if filter_label:
            c_flt = sheet.cell(row=current_row, column=1, value=f"Filter: {filter_label}")
            c_flt.font = FONT_META
            c_flt.alignment = ALIGN_LEFT
            if num_cols >= 4:
                sheet.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=2)
        if branch_id:
            c_br = sheet.cell(row=current_row, column=right_start_col, value=f"Branch ID: {branch_id}")
            c_br.font = FONT_META
            c_br.alignment = ALIGN_RIGHT
            if num_cols >= 4:
                sheet.merge_cells(start_row=current_row, start_column=right_start_col, end_row=current_row, end_column=right_col)
        current_row += 1

    current_row += 1  # spacer before table

    # 3. Optional Summary Block
    if summary_rows:
        valid_summary = [s for s in summary_rows if isinstance(s, (list, tuple)) and len(s) >= 2]
        if valid_summary:
            s_head1 = sheet.cell(row=current_row, column=1, value="SUMMARY METRIC")
            s_head2 = sheet.cell(row=current_row, column=2, value="VALUE")
            for cell in (s_head1, s_head2):
                cell.font = FONT_TH
                cell.fill = FILL_HEADER
                cell.border = THIN_BORDER
                cell.alignment = ALIGN_LEFT
            current_row += 1

            for label, value in valid_summary:
                lbl_cell = sheet.cell(row=current_row, column=1, value=str(label))
                lbl_cell.font = FONT_TD
                lbl_cell.border = THIN_BORDER
                lbl_cell.alignment = ALIGN_LEFT

                val_cell = sheet.cell(row=current_row, column=2)
                val_cell.font = FONT_TOTAL
                val_cell.border = THIN_BORDER

                val, n_fmt = format_table_cell_for_excel(value, str(label))
                val_cell.value = val
                if n_fmt:
                    val_cell.number_format = n_fmt
                    val_cell.alignment = ALIGN_RIGHT
                else:
                    val_cell.alignment = ALIGN_LEFT
                current_row += 1
            current_row += 1

    # 4. Main Data Table
    header_row_idx = current_row
    for c_idx, h in enumerate(raw_headers, start=1):
        cell = sheet.cell(row=header_row_idx, column=c_idx, value=str(h).upper())
        cell.font = FONT_TH
        cell.fill = FILL_HEADER
        cell.border = THIN_BORDER
        align = resolve_column_alignment(h)
        if align == 'RIGHT':
            cell.alignment = ALIGN_RIGHT
        elif align == 'CENTER':
            cell.alignment = ALIGN_CENTER
        else:
            cell.alignment = ALIGN_LEFT

    sheet.row_dimensions[header_row_idx].height = 22
    current_row += 1

    if norm_rows:
        for row in norm_rows:
            r_list = list(row or [])
            sheet.row_dimensions[current_row].height = 18
            for c_idx, h in enumerate(raw_headers, start=1):
                raw_val = r_list[c_idx - 1] if c_idx - 1 < len(r_list) else ''
                cell = sheet.cell(row=current_row, column=c_idx)
                cell.font = FONT_TD
                cell.border = THIN_BORDER

                val, n_fmt = format_table_cell_for_excel(raw_val, h)
                cell.value = val
                align = resolve_column_alignment(h)
                if n_fmt:
                    cell.number_format = n_fmt
                    cell.alignment = ALIGN_RIGHT
                elif align == 'CENTER':
                    cell.alignment = ALIGN_CENTER
                elif align == 'RIGHT':
                    cell.alignment = ALIGN_RIGHT
                else:
                    cell.alignment = ALIGN_LEFT
            current_row += 1

        # 5. Grand Total Row
        grand_total = calculate_grand_totals(raw_headers, norm_rows)
        if grand_total:
            sheet.row_dimensions[current_row].height = 20
            for c_idx, h in enumerate(raw_headers, start=1):
                t_val = grand_total[c_idx - 1]
                cell = sheet.cell(row=current_row, column=c_idx)
                cell.font = FONT_TOTAL
                cell.fill = FILL_TOTAL
                cell.border = TOTAL_BORDER

                if t_val != '':
                    val, n_fmt = format_table_cell_for_excel(t_val, h)
                    cell.value = val
                    if n_fmt:
                        cell.number_format = n_fmt
                        cell.alignment = ALIGN_RIGHT
                    else:
                        cell.alignment = ALIGN_LEFT
                else:
                    cell.value = ''
            current_row += 1
    else:
        empty_cell = sheet.cell(row=current_row, column=1, value='No records found for the selected period.')
        empty_cell.font = FONT_META
        empty_cell.alignment = ALIGN_CENTER
        sheet.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=num_cols)
        for c in range(1, num_cols + 1):
            sheet.cell(row=current_row, column=c).border = THIN_BORDER
        sheet.row_dimensions[current_row].height = 25
        current_row += 1

    # Auto-filter and freeze panes
    last_col_letter = get_column_letter(num_cols)
    sheet.auto_filter.ref = f"A{header_row_idx}:{last_col_letter}{current_row - 1}"
    sheet.freeze_panes = sheet.cell(row=header_row_idx + 1, column=1)

    # Column width auto-sizing without truncating
    for col_idx in range(1, num_cols + 1):
        col_letter = get_column_letter(col_idx)
        h_text = str(raw_headers[col_idx - 1]) if col_idx - 1 < len(raw_headers) else ''
        max_len = len(h_text)
        for r in range(header_row_idx, current_row):
            v = sheet.cell(row=r, column=col_idx).value
            if v is not None:
                max_len = max(max_len, len(str(v)))
        sheet.column_dimensions[col_letter].width = min(max(max_len + 5, 12), 48)

    # Page setup for printing
    sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
    sheet.page_setup.orientation = sheet.ORIENTATION_LANDSCAPE if num_cols >= 6 else sheet.ORIENTATION_PORTRAIT
    sheet.page_setup.fitToPage = True
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.print_title_rows = f'{header_row_idx}:{header_row_idx}'
    sheet.oddFooter.left.text = f"{shop_name}  |  Printed by: {printed_by}"
    sheet.oddFooter.center.text = "Page &[Page] of &[Pages]"
    sheet.oddFooter.right.text = f"Printed: {now_str}"

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer
