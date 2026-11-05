from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle

FONT_R = 'Helvetica'
FONT_B = 'Helvetica-Bold'

# Color Palette: Minimal Monochrome Accounting Format
COLOR_WHITE = colors.HexColor('#FFFFFF')
COLOR_BLACK = colors.HexColor('#000000')
COLOR_TEXT = colors.HexColor('#111827')
COLOR_MUTED = colors.HexColor('#4B5563')
COLOR_HEADER_BG = colors.HexColor('#F1F3F5')
COLOR_BORDER = colors.HexColor('#000000')
COLOR_BORDER_LIGHT = colors.HexColor('#D1D5DB')
COLOR_ROW_ALT = colors.HexColor('#FAFAFA')

PDF_STYLES = {
    # Business Header (Centered)
    'business_name': ParagraphStyle(
        'DocBusinessName',
        fontName=FONT_B,
        fontSize=14,
        leading=17,
        textColor=COLOR_BLACK,
        alignment=TA_CENTER,
    ),
    'business_meta': ParagraphStyle(
        'DocBusinessMeta',
        fontName=FONT_R,
        fontSize=8,
        leading=11,
        textColor=COLOR_MUTED,
        alignment=TA_CENTER,
    ),
    # Report Metadata (Two-column: Left)
    'meta_report_title': ParagraphStyle(
        'DocReportTitle',
        fontName=FONT_B,
        fontSize=11,
        leading=14,
        textColor=COLOR_BLACK,
        alignment=TA_LEFT,
    ),
    'meta_left': ParagraphStyle(
        'DocMetaLeft',
        fontName=FONT_R,
        fontSize=8,
        leading=11,
        textColor=COLOR_TEXT,
        alignment=TA_LEFT,
    ),
    # Report Metadata (Two-column: Right)
    'meta_right': ParagraphStyle(
        'DocMetaRight',
        fontName=FONT_R,
        fontSize=8,
        leading=11,
        textColor=COLOR_TEXT,
        alignment=TA_RIGHT,
    ),
    # Table Headers
    'th_left': ParagraphStyle(
        'DocThL',
        fontName=FONT_B,
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_BLACK,
        alignment=TA_LEFT,
    ),
    'th_center': ParagraphStyle(
        'DocThC',
        fontName=FONT_B,
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_BLACK,
        alignment=TA_CENTER,
    ),
    'th_right': ParagraphStyle(
        'DocThR',
        fontName=FONT_B,
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_BLACK,
        alignment=TA_RIGHT,
    ),
    # Table Cells
    'td_left': ParagraphStyle(
        'DocTdL',
        fontName=FONT_R,
        fontSize=7,
        leading=9,
        textColor=COLOR_TEXT,
        alignment=TA_LEFT,
    ),
    'td_center': ParagraphStyle(
        'DocTdC',
        fontName=FONT_R,
        fontSize=7,
        leading=9,
        textColor=COLOR_TEXT,
        alignment=TA_CENTER,
    ),
    'td_right': ParagraphStyle(
        'DocTdR',
        fontName=FONT_R,
        fontSize=7,
        leading=9,
        textColor=COLOR_TEXT,
        alignment=TA_RIGHT,
    ),
    # Table Grand Total Cells
    'total_left': ParagraphStyle(
        'DocTotL',
        fontName=FONT_B,
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_BLACK,
        alignment=TA_LEFT,
    ),
    'total_center': ParagraphStyle(
        'DocTotC',
        fontName=FONT_B,
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_BLACK,
        alignment=TA_CENTER,
    ),
    'total_right': ParagraphStyle(
        'DocTotR',
        fontName=FONT_B,
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_BLACK,
        alignment=TA_RIGHT,
    ),
    # Summary Table Cells
    'sum_key': ParagraphStyle(
        'DocSumK',
        fontName=FONT_R,
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_TEXT,
        alignment=TA_LEFT,
    ),
    'sum_val': ParagraphStyle(
        'DocSumV',
        fontName=FONT_B,
        fontSize=8,
        leading=10,
        textColor=COLOR_BLACK,
        alignment=TA_RIGHT,
    ),
    # Empty State
    'empty_message': ParagraphStyle(
        'DocEmpty',
        fontName=FONT_R,
        fontSize=8.5,
        leading=11,
        textColor=COLOR_MUTED,
        alignment=TA_CENTER,
    ),
}

