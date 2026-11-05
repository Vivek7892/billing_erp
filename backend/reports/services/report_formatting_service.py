from xml.sax.saxutils import escape as xml_escape
from ..utils.currency_formatter import format_inr, to_decimal, to_float
from ..utils.date_formatter import format_date, format_datetime
from ..utils.column_resolver import is_money_column, is_count_column, is_numeric_column


def clean_pdf_text(val):
    if val is None:
        return ''
    s = str(val)
    replacements = {
        '₹': 'Rs.', '₨': 'Rs.', '•': '-', '·': '-', '–': '-',
        '—': '-', '−': '-', '“': '"', '”': '"', '‘': "'",
        '’': "'", '…': '...', '\u00a0': ' ', '\t': ' ',
    }
    for old, new in replacements.items():
        s = s.replace(old, new)
    return s.encode('latin-1', errors='replace').decode('latin-1').strip()


def esc_pdf(val):
    return xml_escape(clean_pdf_text(val))


def format_table_cell_for_pdf(val, header):
    if val is None or val == '':
        return '—'
    if is_money_column(header):
        return format_inr(val, with_symbol=True)
    if is_count_column(header):
        try:
            return f"{int(float(str(val).replace(',', ''))):,}"
        except Exception:
            return str(val)
    return clean_pdf_text(val)


def format_table_cell_for_excel(val, header):
    """
    Returns (native_value, number_format) for openpyxl cell.
    """
    if val is None or val == '':
        return '', None
    if is_money_column(header):
        return to_float(val), '#,##0.00'
    if is_count_column(header):
        try:
            return int(float(str(val).replace(',', ''))), '#,##0'
        except Exception:
            return str(val), None
    return str(val), None

