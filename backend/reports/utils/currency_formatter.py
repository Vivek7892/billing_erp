from decimal import Decimal, InvalidOperation


def to_decimal(val, default='0.00'):
    if val is None or val == '':
        return Decimal(str(default))
    if isinstance(val, Decimal):
        return val
    try:
        clean = str(val).replace(',', '').replace('₹', '').replace('Rs.', '').replace('Rs', '').strip()
        return Decimal(clean)
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(str(default))


def to_float(val, default=0.0):
    try:
        return float(to_decimal(val, default=default))
    except Exception:
        return float(default)


def format_inr(val, with_symbol=True, decimals=2):
    """
    Format numeric value in Indian number formatting:
    e.g. 12,34,567.89 or Rs. 12,34,567.89
    """
    if val is None or val == '':
        return 'Rs. 0.00' if with_symbol else '0.00'
    try:
        dec = to_decimal(val)
        is_neg = dec < 0
        dec = abs(dec)
        fmt_str = f"{{:.{decimals}f}}".format(dec)
        integer_part, decimal_part = fmt_str.split('.')
        
        # Indian comma grouping: last 3 digits, then every 2 digits
        if len(integer_part) > 3:
            last_three = integer_part[-3:]
            remaining = integer_part[:-3]
            groups = []
            while len(remaining) > 2:
                groups.insert(0, remaining[-2:])
                remaining = remaining[:-2]
            if remaining:
                groups.insert(0, remaining)
            groups.append(last_three)
            formatted_int = ','.join(groups)
        else:
            formatted_int = integer_part
            
        result = f"{formatted_int}.{decimal_part}" if decimals > 0 else formatted_int
        if is_neg:
            result = f"-{result}"
        return f"Rs. {result}" if with_symbol else result
    except Exception:
        return f"Rs. {val}" if with_symbol else str(val)

