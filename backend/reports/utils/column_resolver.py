from reportlab.lib.pagesizes import A4, landscape

MONEY_KEYWORDS = (
    'amount', 'revenue', 'cost', 'profit', 'total', 'sales', 'discount',
    'tax', 'gst', 'cgst', 'sgst', 'igst', 'cess', 'outstanding', 'credit',
    'debit', 'expense', 'payment', 'price', 'value', 'collection', 'returns',
    'net', 'balance', 'paid', 'due', 'limit', 'cogs', 'taxable', 'subtotal',
    'refund', 'opening', 'closing'
)

COUNT_KEYWORDS = (
    'count', 'qty', 'quantity', 'transactions', 'entries', 'invoices',
    'bills', 'items', 'pieces', 'boxes', 'nos'
)

CENTER_KEYWORDS = (
    's.no', 'sr.no', 'sl', 'sl.', 'date', 'code', 'hsn', 'sac', 'status',
    'voucher', 'bill no', 'inv no', 'invoice no', 'ref', 'reference',
    'type', 'method', 'mode', 'pan', 'gstin'
)


def is_money_column(header):
    name = str(header or '').lower().strip()
    if any(tok in name for tok in ('count', 'qty', 'quantity', 'transactions', 'entries', '%', 'share', 'slab')):
        return False
    return any(tok in name for tok in MONEY_KEYWORDS)


def is_count_column(header):
    name = str(header or '').lower().strip()
    return any(tok in name for tok in COUNT_KEYWORDS)


def is_numeric_column(header):
    name = str(header or '').lower().strip()
    return is_money_column(header) or is_count_column(header) or '%' in name or 'rate' in name or 'margin' in name


def is_center_column(header):
    name = str(header or '').lower().strip()
    if is_numeric_column(header):
        return False
    return any(name == tok or name.startswith(tok) or name.endswith(tok) for tok in CENTER_KEYWORDS)


def resolve_column_alignment(header):
    """
    Returns 'LEFT', 'CENTER', or 'RIGHT'.
    """
    if is_numeric_column(header):
        return 'RIGHT'
    if is_center_column(header):
        return 'CENTER'
    return 'LEFT'


def resolve_page_layout(headers, rows=None):
    """
    Determine if the report should be Landscape or Portrait.
    Usually <= 5 columns -> Portrait, >= 6 columns -> Landscape.
    """
    num_cols = len(headers or [])
    if num_cols >= 6:
        return 'LANDSCAPE', landscape(A4)
    return 'PORTRAIT', A4


def calculate_pdf_col_widths(headers, printable_width):
    """
    Calculate proportional column widths for the ReportLab Table.
    """
    col_count = len(headers or [])
    if col_count == 0:
        return [printable_width]
    if col_count == 1:
        return [printable_width]
    if col_count == 2:
        return [printable_width * 0.65, printable_width * 0.35]
    if col_count == 3:
        return [printable_width * 0.46, printable_width * 0.27, printable_width * 0.27]
    if col_count == 4:
        return [printable_width * 0.37, printable_width * 0.21, printable_width * 0.21, printable_width * 0.21]
    if col_count == 5:
        return [printable_width * 0.28, printable_width * 0.18, printable_width * 0.18, printable_width * 0.18, printable_width * 0.18]
    
    # For 6+ columns, give smaller width to s.no, date, code, and larger to particulars/name
    weights = []
    for h in headers:
        name = str(h or '').lower().strip()
        if any(tok in name for tok in ('s.no', 'sl', 'sl.')):
            weights.append(0.6)
        elif any(tok in name for tok in ('date', 'status', 'method', 'type')):
            weights.append(1.0)
        elif any(tok in name for tok in ('no', 'inv', 'ref', 'code', 'hsn')):
            weights.append(1.1)
        elif any(tok in name for tok in ('particulars', 'description', 'customer', 'supplier', 'item', 'product', 'name')):
            weights.append(2.0)
        elif is_numeric_column(h):
            weights.append(1.2)
        else:
            weights.append(1.2)
            
    total_weight = sum(weights)
    return [(w / total_weight) * printable_width for w in weights]

