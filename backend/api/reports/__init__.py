from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class ReportData:
    title: str
    filename: str
    payload: dict | list
    headers: list
    rows: list
    summary_rows: list | None = None


def number(value):
    if isinstance(value, Decimal):
        return float(value)
    return value
