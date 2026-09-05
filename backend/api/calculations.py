from dataclasses import dataclass, replace
from decimal import Decimal, ROUND_HALF_UP


ZERO = Decimal('0.00')
MONEY = Decimal('0.01')


def money(value):
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class LineCalculation:
    quantity: Decimal
    unit_price: Decimal
    discount_percent: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    gst_percent: Decimal
    gst_amount: Decimal
    total: Decimal
    base_subtotal: Decimal


@dataclass(frozen=True)
class InvoiceCalculation:
    subtotal: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    tax_amount: Decimal
    round_off: Decimal
    grand_total: Decimal
    lines: tuple


def calculate_line(*, quantity, unit_price, discount_percent=0, gst_percent=0,
                   tax_inclusive=False):
    quantity = Decimal(str(quantity))
    unit_price = money(unit_price)
    discount_percent = Decimal(str(discount_percent or 0))
    gst_percent = Decimal(str(gst_percent or 0))

    if quantity <= 0:
        raise ValueError('Quantity must be greater than zero.')
    if unit_price < 0:
        raise ValueError('Unit price cannot be negative.')
    if not Decimal('0') <= discount_percent <= Decimal('100'):
        raise ValueError('Discount percent must be between 0 and 100.')
    if not Decimal('0') <= gst_percent <= Decimal('100'):
        raise ValueError('GST percent must be between 0 and 100.')

    if tax_inclusive and gst_percent:
        base_unit_price = unit_price / (Decimal('1') + gst_percent / Decimal('100'))
    else:
        base_unit_price = unit_price

    base_subtotal = money(base_unit_price * quantity)
    discount_amount = money(base_subtotal * discount_percent / Decimal('100'))
    taxable_amount = money(base_subtotal - discount_amount)
    gst_amount = money(taxable_amount * gst_percent / Decimal('100'))
    total = money(taxable_amount + gst_amount)

    return LineCalculation(
        quantity=quantity,
        unit_price=unit_price,
        discount_percent=discount_percent,
        discount_amount=discount_amount,
        taxable_amount=taxable_amount,
        gst_percent=gst_percent,
        gst_amount=gst_amount,
        total=total,
        base_subtotal=base_subtotal,
    )


def calculate_invoice(items, *, tax_inclusive=False, bill_discount=0,
                      round_total=True):
    lines = tuple(
        calculate_line(
            quantity=item['quantity'],
            unit_price=item['unit_price'],
            discount_percent=item.get('discount_percent', 0),
            gst_percent=item.get('gst_percent', 0),
            tax_inclusive=tax_inclusive,
        )
        for item in items
    )
    subtotal = money(sum((line.base_subtotal for line in lines), ZERO))
    item_discount = money(sum((line.discount_amount for line in lines), ZERO))
    bill_discount = money(bill_discount)
    discount_amount = money(item_discount + bill_discount)
    if bill_discount and subtotal:
        adjusted_lines = []
        allocated = ZERO
        for index, line in enumerate(lines):
            allocation = (bill_discount - allocated if index == len(lines) - 1
                          else money(bill_discount * line.base_subtotal / subtotal))
            allocated += allocation
            taxable = money(line.taxable_amount - allocation)
            gst_amount = money(taxable * line.gst_percent / Decimal('100'))
            adjusted_lines.append(replace(
                line,
                discount_amount=money(line.discount_amount + allocation),
                taxable_amount=taxable,
                gst_amount=gst_amount,
                total=money(taxable + gst_amount),
            ))
        lines = tuple(adjusted_lines)
    taxable_amount = money(sum((line.taxable_amount for line in lines), ZERO))
    tax_amount = money(sum((line.gst_amount for line in lines), ZERO))
    raw_total = money(taxable_amount + tax_amount)
    rounded_total = raw_total.quantize(Decimal('1'), rounding=ROUND_HALF_UP) if round_total else raw_total
    round_off = money(rounded_total - raw_total)

    return InvoiceCalculation(
        subtotal=subtotal,
        discount_amount=discount_amount,
        taxable_amount=taxable_amount,
        tax_amount=tax_amount,
        round_off=round_off,
        grand_total=money(raw_total + round_off),
        lines=lines,
    )