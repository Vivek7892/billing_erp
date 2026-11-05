from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

FONT_FAMILY = 'Calibri'

# Colors
C_BLACK = '000000'
C_TEXT = '111827'
C_MUTED = '4B5563'
C_HEADER_BG = 'F1F3F5'
C_TOTAL_BG = 'F9FAFB'
C_BORDER = '000000'
C_BORDER_LIGHT = 'D1D5DB'

# Fonts
FONT_SHOP_NAME = Font(name=FONT_FAMILY, size=14, bold=True, color=C_BLACK)
FONT_SHOP_META = Font(name=FONT_FAMILY, size=9, bold=False, color=C_MUTED)
FONT_REPORT_TITLE = Font(name=FONT_FAMILY, size=11, bold=True, color=C_BLACK)
FONT_META = Font(name=FONT_FAMILY, size=9, bold=False, color=C_TEXT)
FONT_TH = Font(name=FONT_FAMILY, size=9, bold=True, color=C_BLACK)
FONT_TD = Font(name=FONT_FAMILY, size=9, bold=False, color=C_TEXT)
FONT_TOTAL = Font(name=FONT_FAMILY, size=9, bold=True, color=C_BLACK)

# Fills
FILL_HEADER = PatternFill('solid', fgColor=C_HEADER_BG)
FILL_TOTAL = PatternFill('solid', fgColor=C_TOTAL_BG)
FILL_WHITE = PatternFill('solid', fgColor='FFFFFF')

# Borders
THIN_SIDE = Side(style='thin', color=C_BORDER)
THIN_BORDER = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=THIN_SIDE)

DOUBLE_BOTTOM_SIDE = Side(style='double', color=C_BORDER)
TOTAL_BORDER = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=DOUBLE_BOTTOM_SIDE)

# Alignments
ALIGN_LEFT = Alignment(horizontal='left', vertical='center', wrap_text=True)
ALIGN_CENTER = Alignment(horizontal='center', vertical='center')
ALIGN_RIGHT = Alignment(horizontal='right', vertical='center')
ALIGN_HEADER_CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)

# Number Formats
NF_CURRENCY = '#,##0.00'
NF_COUNT = '#,##0'
NF_PERCENT = '0.0%'
NF_DATE = 'DD-MM-YYYY'

