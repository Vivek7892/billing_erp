from io import BytesIO
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..services.report_business_service import ReportBusinessService
from ..services.report_formatting_service import clean_pdf_text, esc_pdf, format_table_cell_for_pdf
from ..styles.pdf_styles import (
    COLOR_BLACK,
    COLOR_BORDER,
    COLOR_BORDER_LIGHT,
    COLOR_HEADER_BG,
    COLOR_MUTED,
    COLOR_ROW_ALT,
    COLOR_TEXT,
    FONT_B,
    FONT_R,
    PDF_STYLES,
)
from ..utils.column_resolver import (
    calculate_pdf_col_widths,
    resolve_column_alignment,
    resolve_page_layout,
)
from ..utils.totals_calculator import calculate_grand_totals


class TraditionalReportNumberedCanvas(rl_canvas.Canvas):
    """
    Two-pass canvas that renders exact 'Page No.: X of Y', who printed, and timestamp in the footer.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.saveState()
            
            page_w, page_h = self._pagesize
            margin_l = 10 * mm
            margin_r = 10 * mm
            
            # Thin divider rule above footer
            self.setStrokeColor(COLOR_BLACK)
            self.setLineWidth(0.4)
            self.line(margin_l, 9 * mm, page_w - margin_r, 9 * mm)

            # Left footer note: shop and who printed
            printed_by_str = getattr(self, '_report_printed_by', 'Administrator')
            shop_str = getattr(self, '_report_shop_name', 'Billing ERP')
            self.setFillColor(COLOR_MUTED)
            self.setFont(FONT_R, 6.5)
            left_text = f"{shop_str}  |  Printed by: {printed_by_str}"
            self.drawString(margin_l, 5.5 * mm, left_text)

            # Centered page number
            self.setFillColor(COLOR_BLACK)
            self.setFont(FONT_R, 7)
            page_str = f"Page No.: {self._pageNumber} of {num_pages}"
            self.drawCentredString(page_w / 2.0, 5.5 * mm, page_str)

            # Right footer note: print timestamp
            timestamp_str = getattr(self, '_report_timestamp', '')
            if timestamp_str:
                self.setFillColor(COLOR_MUTED)
                self.setFont(FONT_R, 6.5)
                self.drawRightString(page_w - margin_r, 5.5 * mm, timestamp_str)

            self.restoreState()
            rl_canvas.Canvas.showPage(self)
        rl_canvas.Canvas.save(self)


def generate_accounting_pdf(
    title,
    headers,
    rows,
    business_profile=None,
    summary_rows=None,
    period_label='',
    request_user=None,
    filter_label='',
    logo_bytes=None,
):
    """
    Generate traditional Indian accounting report PDF matching the specification:
    - Pure white background
    - Centered shop name, address, GSTIN (properly formatted without truncation)
    - Thin black horizontal divider
    - Two-column metadata block:
        Left: Report Title, Formatted Date Range / Period, Filter
        Right: Printed By (User + Role), Print Date & Time, Branch ID
    - Compact table with light-grey header and thin black borders (0.5pt)
    - Bold grand total row
    - Centered page number (Page No.: X of Y) and footer with who printed
    """
    if not business_profile:
        business_profile = ReportBusinessService.get_profile(request_user)

    raw_headers = list(headers or [])
    if not raw_headers:
        raw_headers = ['Item', 'Details']

    layout_name, page_size = resolve_page_layout(raw_headers, rows)
    page_w, page_h = page_size

    margin_l = 10 * mm
    margin_r = 10 * mm
    margin_t = 10 * mm
    margin_b = 14 * mm
    printable_w = page_w - margin_l - margin_r

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=margin_l,
        rightMargin=margin_r,
        topMargin=margin_t,
        bottomMargin=margin_b,
        title=clean_pdf_text(title),
        author=clean_pdf_text(business_profile.get('shop_name') or 'DreamWithTech Billing ERP'),
    )

    story = []

    # 1. Centered Business Header (Full view without truncation)
    shop_name = clean_pdf_text(business_profile.get('shop_name') or 'ShopEase POS').upper()
    shop_address = clean_pdf_text(business_profile.get('shop_address'))
    shop_phone = clean_pdf_text(business_profile.get('shop_phone'))
    shop_email = clean_pdf_text(business_profile.get('shop_email'))
    shop_gstin = clean_pdf_text(business_profile.get('shop_gstin'))

    # Store attributes for footer canvas
    now_str = timezone.localtime(timezone.now()).strftime('%d-%b-%Y, %I:%M:%S %p')
    printed_by = clean_pdf_text(business_profile.get('printed_by') or 'Administrator')
    branch_id = clean_pdf_text(business_profile.get('branch_id'))

    TraditionalReportNumberedCanvas._report_shop_name = shop_name
    TraditionalReportNumberedCanvas._report_printed_by = printed_by
    TraditionalReportNumberedCanvas._report_timestamp = now_str

    story.append(Paragraph(esc_pdf(shop_name), PDF_STYLES['business_name']))
    story.append(Spacer(1, 1.2 * mm))

    if shop_address:
        story.append(Paragraph(esc_pdf(shop_address), PDF_STYLES['business_meta']))
        story.append(Spacer(1, 0.8 * mm))

    contact_parts = []
    if shop_phone:
        contact_parts.append(f"Phone: {shop_phone}")
    if shop_email:
        contact_parts.append(f"Email: {shop_email}")
    if shop_gstin:
        contact_parts.append(f"GSTIN: {shop_gstin}")

    if contact_parts:
        story.append(Paragraph(esc_pdf("  |  ".join(contact_parts)), PDF_STYLES['business_meta']))
        story.append(Spacer(1, 2.5 * mm))
    else:
        story.append(Spacer(1, 1.5 * mm))

    # Thin black divider rule below header
    header_line = Table([['']], colWidths=[printable_w], rowHeights=[0.5 * mm])
    header_line.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_BLACK),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_line)
    story.append(Spacer(1, 2.5 * mm))

    # 2. Two-Column Metadata Block (Clean, un-truncated view)
    period_str = period_label or 'All Available Records'
    left_meta = [
        Paragraph(esc_pdf(title.upper()), PDF_STYLES['meta_report_title']),
        Spacer(1, 1 * mm),
        Paragraph(f"<b>Period:</b> {esc_pdf(period_str)}", PDF_STYLES['meta_left']),
    ]
    if filter_label:
        left_meta.append(Spacer(1, 0.5 * mm))
        left_meta.append(Paragraph(f"<b>Filter:</b> {esc_pdf(filter_label)}", PDF_STYLES['meta_left']))

    right_meta = [
        Paragraph(f"<b>Printed By:</b> {esc_pdf(printed_by)}", PDF_STYLES['meta_right']),
        Spacer(1, 1 * mm),
        Paragraph(f"<b>Print Date &amp; Time:</b> {esc_pdf(now_str)}", PDF_STYLES['meta_right']),
    ]
    if branch_id:
        right_meta.append(Spacer(1, 0.5 * mm))
        right_meta.append(Paragraph(f"<b>Shop / Branch ID:</b> {esc_pdf(branch_id)}", PDF_STYLES['meta_right']))

    meta_table = Table(
        [[left_meta, right_meta]],
        colWidths=[printable_w * 0.52, printable_w * 0.48],
        hAlign='LEFT',
    )
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 3.5 * mm))

    # 3. Optional Summary Metrics Table
    if summary_rows:
        valid_summary = [s for s in summary_rows if isinstance(s, (list, tuple)) and len(s) >= 2]
        if valid_summary:
            sum_data = []
            for lbl, val in valid_summary:
                lbl_str = esc_pdf(str(lbl))
                val_str = esc_pdf(format_table_cell_for_pdf(val, str(lbl)))
                sum_data.append([
                    Paragraph(lbl_str, PDF_STYLES['sum_key']),
                    Paragraph(val_str, PDF_STYLES['sum_val']),
                ])
            
            sum_table = Table(
                sum_data,
                colWidths=[printable_w * 0.65, printable_w * 0.35],
                hAlign='LEFT',
            )
            sum_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), COLOR_ROW_ALT),
                ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            story.append(sum_table)
            story.append(Spacer(1, 3.5 * mm))

    # 4. Main Data Table
    col_widths = calculate_pdf_col_widths(raw_headers, printable_w)
    table_data = []

    # Table Header Row
    th_cells = []
    for h in raw_headers:
        align = resolve_column_alignment(h)
        style_key = f"th_{align.lower()}"
        th_cells.append(Paragraph(esc_pdf(h), PDF_STYLES[style_key]))
    table_data.append(th_cells)

    # Table Data Rows
    norm_rows = list(rows or [])
    if norm_rows:
        for r_idx, row in enumerate(norm_rows):
            r_list = list(row or [])
            row_cells = []
            for c_idx, h in enumerate(raw_headers):
                raw_val = r_list[c_idx] if c_idx < len(r_list) else ''
                disp = format_table_cell_for_pdf(raw_val, h)
                align = resolve_column_alignment(h)
                style_key = f"td_{align.lower()}"
                row_cells.append(Paragraph(esc_pdf(disp), PDF_STYLES[style_key]))
            table_data.append(row_cells)

        # 5. Grand Total Row
        grand_total = calculate_grand_totals(raw_headers, norm_rows)
        if grand_total:
            total_cells = []
            for c_idx, h in enumerate(raw_headers):
                t_val = grand_total[c_idx]
                disp = format_table_cell_for_pdf(t_val, h) if t_val != '' else ''
                align = resolve_column_alignment(h)
                style_key = f"total_{align.lower()}"
                total_cells.append(Paragraph(esc_pdf(disp), PDF_STYLES[style_key]))
            table_data.append(total_cells)
    else:
        empty_cells = [''] * len(raw_headers)
        empty_cells[0] = Paragraph('No records found for the selected period.', PDF_STYLES['empty_message'])
        table_data.append(empty_cells)

    rpt_table = Table(
        table_data,
        colWidths=col_widths,
        repeatRows=1,
        splitByRow=1,
        hAlign='LEFT',
    )

    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_HEADER_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
    ]

    if norm_rows:
        for r_idx in range(1, len(norm_rows) + 1):
            if r_idx % 2 == 0:
                table_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), COLOR_ROW_ALT))
        
        if grand_total:
            tot_row_idx = len(table_data) - 1
            table_style.append(('BACKGROUND', (0, tot_row_idx), (-1, tot_row_idx), COLOR_ROW_ALT))
            table_style.append(('LINEABOVE', (0, tot_row_idx), (-1, tot_row_idx), 0.75, COLOR_BLACK))
            table_style.append(('LINEBELOW', (0, tot_row_idx), (-1, tot_row_idx), 1.0, COLOR_BLACK))
    else:
        table_style.append(('SPAN', (0, 1), (-1, 1)))
        table_style.append(('TOPPADDING', (0, 1), (-1, 1), 12))
        table_style.append(('BOTTOMPADDING', (0, 1), (-1, 1), 12))

    rpt_table.setStyle(TableStyle(table_style))
    story.append(rpt_table)

    doc.build(story, canvasmaker=TraditionalReportNumberedCanvas)
    buffer.seek(0)
    return buffer
