"""
Diagnostic: test verify_signature with the actual .env keys.
Run from: d:\Billing_pos\billing_erp\backend\
"""
import os, sys, hmac, hashlib

# Load .env manually
env_path = os.path.join(os.path.dirname(__file__), '.env')
env_vars = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, _, v = line.partition('=')
            env_vars[k.strip()] = v.strip()

key_id     = env_vars.get('RAZORPAY_KEY_ID', '')
key_secret = env_vars.get('RAZORPAY_KEY_SECRET', '')
webhook_secret = env_vars.get('RAZORPAY_WEBHOOK_SECRET', '')

print(f"KEY_ID      : '{key_id}'")
print(f"KEY_SECRET  : '{key_secret}'")
print(f"WEBHOOK_SEC : '{webhook_secret}'")
print(f"KEY_ID len  : {len(key_id)}")
print(f"KEY_SECRET len: {len(key_secret)}")
print()

# Simulate a valid signature
order_id   = 'order_TESTONLY123'
payment_id = 'pay_TESTONLY456'
message    = f'{order_id}|{payment_id}'
sig = hmac.new(key_secret.encode(), message.encode(), hashlib.sha256).hexdigest()
print(f"Simulated signature: {sig}")

# Now test verify_signature
os.environ['RAZORPAY_KEY_ID']     = key_id
os.environ['RAZORPAY_KEY_SECRET'] = key_secret

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

from api.services.razorpay_service import verify_signature
result = verify_signature(order_id, payment_id, sig)
print(f"verify_signature result: {result}  (expected: True)")

result_bad = verify_signature(order_id, payment_id, 'badsig')
print(f"verify_signature bad sig: {result_bad}  (expected: False)")

# Check if key_secret has any hidden chars
print(f"\nKey secret bytes: {key_secret.encode()!r}")
