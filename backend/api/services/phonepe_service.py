"""
PhonePe Business Payment Gateway service.
Credentials are read from environment variables — never exposed to the frontend.

UAT base URL  : https://api-preprod.phonepe.com/apis/pg-sandbox
PROD base URL : https://api.phonepe.com/apis/hermes
"""
import base64
import hashlib
import json
import uuid

import requests
from decouple import config

PHONEPE_ENV = config('PHONEPE_ENV', default='UAT').upper()
MERCHANT_ID = config('PHONEPE_MERCHANT_ID', default='PGTESTPAYUAT')
SALT_KEY = config('PHONEPE_SALT_KEY', default='099eb0cd-02cf-4dc2-a4c3-df3f7d11b3b4')
SALT_INDEX = config('PHONEPE_SALT_INDEX', default='1')

if PHONEPE_ENV == 'PRODUCTION':
    BASE_URL = 'https://api.phonepe.com/apis/hermes'
else:
    BASE_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox'

PAY_ENDPOINT = '/pg/v1/pay'
STATUS_ENDPOINT = '/pg/v1/status'


def _checksum(payload_b64: str, endpoint: str) -> str:
    raw = payload_b64 + endpoint + SALT_KEY
    sha256 = hashlib.sha256(raw.encode()).hexdigest()
    return f'{sha256}###{SALT_INDEX}'


def initiate_payment(amount_paise: int, merchant_txn_id: str, redirect_url: str, mobile: str = '') -> dict:
    """
    Initiate a PhonePe payment.
    Returns {'success': bool, 'payment_url': str, 'merchant_transaction_id': str, 'error': str}
    """
    payload = {
        'merchantId': MERCHANT_ID,
        'merchantTransactionId': merchant_txn_id,
        'amount': amount_paise,
        'redirectUrl': redirect_url,
        'redirectMode': 'REDIRECT',
        'paymentInstrument': {'type': 'PAY_PAGE'},
    }
    if mobile:
        payload['mobileNumber'] = mobile

    payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
    checksum = _checksum(payload_b64, PAY_ENDPOINT)

    try:
        resp = requests.post(
            f'{BASE_URL}{PAY_ENDPOINT}',
            json={'request': payload_b64},
            headers={
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
            },
            timeout=30,
        )
        data = resp.json()
    except Exception as exc:
        return {'success': False, 'error': str(exc), 'payment_url': '', 'merchant_transaction_id': merchant_txn_id}

    if data.get('success') and data.get('data', {}).get('instrumentResponse', {}).get('redirectInfo', {}).get('url'):
        return {
            'success': True,
            'payment_url': data['data']['instrumentResponse']['redirectInfo']['url'],
            'merchant_transaction_id': merchant_txn_id,
            'error': '',
        }
    return {
        'success': False,
        'error': data.get('message', 'PhonePe initiation failed'),
        'payment_url': '',
        'merchant_transaction_id': merchant_txn_id,
        'raw': data,
    }


def check_status(merchant_txn_id: str) -> dict:
    """
    Check payment status for a merchant transaction ID.
    Returns {'success': bool, 'status': str, 'phonepe_transaction_id': str, 'error': str}
    """
    endpoint = f'{STATUS_ENDPOINT}/{MERCHANT_ID}/{merchant_txn_id}'
    checksum = _checksum('', endpoint)

    try:
        resp = requests.get(
            f'{BASE_URL}{endpoint}',
            headers={
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': MERCHANT_ID,
            },
            timeout=30,
        )
        data = resp.json()
    except Exception as exc:
        return {'success': False, 'status': 'failed', 'phonepe_transaction_id': '', 'error': str(exc)}

    if data.get('success'):
        txn_data = data.get('data', {})
        state = txn_data.get('state', 'PENDING')
        status_map = {
            'COMPLETED': 'success',
            'FAILED': 'failed',
            'PENDING': 'pending',
        }
        return {
            'success': state == 'COMPLETED',
            'status': status_map.get(state, 'pending'),
            'phonepe_transaction_id': txn_data.get('transactionId', ''),
            'error': '',
            'raw': data,
        }
    return {
        'success': False,
        'status': 'failed',
        'phonepe_transaction_id': '',
        'error': data.get('message', 'Status check failed'),
        'raw': data,
    }


def generate_merchant_txn_id(invoice_number: str = '') -> str:
    suffix = uuid.uuid4().hex[:8].upper()
    prefix = (invoice_number or 'TXN').replace('/', '-').replace(' ', '')[:20]
    return f'{prefix}-{suffix}'
