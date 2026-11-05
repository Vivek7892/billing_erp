from decimal import Decimal
from .currency_formatter import to_decimal
from .column_resolver import is_money_column, is_count_column


def calculate_grand_totals(headers, rows):
    """
    Given table headers and row list, compute column-wise sums for numeric columns.
    Returns:
      grand_total_row (list of str/float/Decimal or None if no numeric columns)
    """
    if not headers or not rows:
        return None

    num_cols = len(headers)
    totals = [Decimal('0.00')] * num_cols
    has_sum = [False] * num_cols

    for c_idx, h in enumerate(headers):
        if is_money_column(h) or is_count_column(h):
            has_sum[c_idx] = True

    if not any(has_sum):
        return None

    for row in rows:
        r_list = list(row or [])
        for c_idx in range(min(num_cols, len(r_list))):
            if has_sum[c_idx]:
                val = r_list[c_idx]
                if val is not None and val != '' and val != '—':
                    try:
                        totals[c_idx] += to_decimal(val)
                    except Exception:
                        pass

    # Build grand total row
    result = [''] * num_cols
    # Place 'Grand Total' or 'Total' in the first non-numeric column (usually col 0 or 1)
    label_placed = False
    for c_idx in range(num_cols):
        if not has_sum[c_idx] and not label_placed:
            result[c_idx] = 'Grand Total'
            label_placed = True
        elif has_sum[c_idx]:
            if is_count_column(headers[c_idx]):
                result[c_idx] = int(totals[c_idx])
            else:
                result[c_idx] = float(totals[c_idx])

    if not label_placed:
        result[0] = 'Grand Total'

    return result

