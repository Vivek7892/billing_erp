"""
Razorpay Payment Gateway service.
Credentials are read from environment variables — never exposed to the frontend.

Docs: https://razorpay.com/docs/payments/payment-gateway/
"""
import hmac
import hashlib
import uuid

import razorpay
from decouple import config


def _key_id():
    return config('RAZORPAY_KEY_ID', default='').strip()


def _key_secret():
    return config('RAZORPAY_KEY_SECRET', default='').strip()


def _client():
    return razorpay.Client(auth=(_key_id(), _key_secret()))


def create_order(amount_paise: int, receipt: str, notes: dict = None) -> dict:
    """
    Create a Razorpay order.
    Returns {'success': bool, 'order_id': str, 'amount': int, 'currency': str, 'error': str}
    """
    try:
        order = _client().order.create({
            'amount': amount_paise,
            'currency': 'INR',
            'receipt': receipt[:40],
            'notes': notes or {},
        })
        return {
            'success': True,
            'order_id': order['id'],
            'amount': order['amount'],
            'currency': order['currency'],
            'error': '',
        }
    except Exception as exc:
        return {'success': False, 'order_id': '', 'amount': amount_paise, 'currency': 'INR', 'error': str(exc)}


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay payment callback signature using HMAC-SHA256."""
    secret = _key_secret()
    if not secret:
        return False
    message = f'{order_id}|{payment_id}'
    expected = hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def fetch_payment(payment_id: str) -> dict:
    """Fetch payment details from Razorpay."""
    try:
        payment = _client().payment.fetch(payment_id)
        return {'success': True, 'payment': payment, 'error': ''}
    except Exception as exc:
        return {'success': False, 'payment': {}, 'error': str(exc)}


def generate_receipt(invoice_number: str = '') -> str:
    suffix = uuid.uuid4().hex[:8].upper()
    prefix = (invoice_number or 'RCP').replace('/', '-').replace(' ', '')[:20]
    return f'{prefix}-{suffix}'
