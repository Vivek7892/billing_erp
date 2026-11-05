import time
import pyotp
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from api.models import Business, User


class TOTPAuthenticationSecurityTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.client = APIClient()
        self.business_a = Business.objects.create(
            name='Shop Alpha',
            shop_id='DWAA2601',
            owner_name='Alice Alpha',
            mobile='+919876540001',
        )
        self.business_b = Business.objects.create(
            name='Shop Beta',
            shop_id='DWBB2602',
            owner_name='Bob Beta',
            mobile='+919876540002',
        )

        # Alice: Owner with 2FA disabled initially
        self.alice = User.objects.create(
            username='alice',
            phone='+919876540001',
            email='alice@alpha.com',
            role='owner',
            business=self.business_a,
            is_active=True,
            is_verified=True,
            onboarding_completed=True,
        )
        self.alice.set_password('Pass@1234')
        self.alice.save()

        # Charlie: Cashier
        self.charlie = User.objects.create(
            username='charlie',
            phone='+919876540003',
            email='charlie@alpha.com',
            role='cashier',
            business=self.business_a,
            is_active=True,
            is_verified=True,
            onboarding_completed=True,
        )
        self.charlie.set_password('Cashier@1234')
        self.charlie.save()

    def test_login_without_2fa_returns_jwt_tokens_immediately(self):
        res = self.client.post(reverse('login'), {
            'mobile': '9876540001',
            'password': 'Pass@1234',
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertFalse(res.data.get('totp_required', False))

    def test_totp_setup_and_confirmation_flow(self):
        self.client.force_authenticate(user=self.alice)
        
        # 1. Setup endpoint
        setup_res = self.client.post(reverse('2fa-setup'))
        self.assertEqual(setup_res.status_code, 200)
        self.assertIn('secret', setup_res.data)
        self.assertIn('qr_code', setup_res.data)
        self.assertTrue(setup_res.data['qr_code'].startswith('data:image/png;base64,'))
        secret = setup_res.data['secret']

        # Verify secret is encrypted in database
        self.alice.refresh_from_db()
        self.assertNotEqual(self.alice.totp_secret, secret)
        self.assertEqual(self.alice.get_totp_secret(), secret)
        self.assertFalse(self.alice.totp_enabled)

        # 2. Confirm with valid 6-digit TOTP code
        totp = pyotp.TOTP(secret)
        code = totp.now()
        confirm_res = self.client.post(reverse('2fa-confirm'), {'code': code})
        self.assertEqual(confirm_res.status_code, 200)
        self.assertTrue(confirm_res.data['success'])
        self.assertEqual(len(confirm_res.data['recovery_codes']), 10)

        self.alice.refresh_from_db()
        self.assertTrue(self.alice.totp_enabled)
        self.assertIsNotNone(self.alice.totp_confirmed_at)
        self.assertEqual(len(self.alice.totp_recovery_codes), 10)

    def test_login_with_2fa_enabled_challenges_user(self):
        # Enable 2FA on Alice
        secret = pyotp.random_base32()
        self.alice.set_totp_secret(secret)
        self.alice.totp_enabled = True
        self.alice.generate_recovery_codes()
        self.alice.save()

        # Step 1: Login with credentials
        login_res = self.client.post(reverse('login'), {
            'mobile': '+919876540001',
            'password': 'Pass@1234',
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertTrue(login_res.data.get('totp_required'))
        self.assertIn('temp_token', login_res.data)
        self.assertNotIn('access', login_res.data)
        temp_token = login_res.data['temp_token']

        # Step 2: Verify with bad TOTP code -> rejected
        bad_res = self.client.post(reverse('verify-2fa'), {
            'temp_token': temp_token,
            'code': '000000',
        })
        self.assertEqual(bad_res.status_code, 400)
        self.assertEqual(bad_res.data.get('code'), 'invalid_code')

        # Step 3: Verify with valid TOTP code -> success!
        valid_code = pyotp.TOTP(secret).now()
        good_res = self.client.post(reverse('verify-2fa'), {
            'temp_token': temp_token,
            'code': valid_code,
        })
        self.assertEqual(good_res.status_code, 200)
        self.assertIn('access', good_res.data)
        self.assertIn('refresh', good_res.data)
        self.assertEqual(good_res.data['user']['role'], 'owner')

    def test_totp_replay_attack_prevented(self):
        secret = pyotp.random_base32()
        self.alice.set_totp_secret(secret)
        self.alice.totp_enabled = True
        self.alice.save()

        code = pyotp.TOTP(secret).now()
        # First verification succeeds
        self.assertTrue(self.alice.verify_totp(code))

        # Immediate replay of the identical code within the same timestep is rejected
        self.assertFalse(self.alice.verify_totp(code))

    def test_single_use_recovery_code_authentication_and_consumption(self):
        secret = pyotp.random_base32()
        self.alice.set_totp_secret(secret)
        self.alice.totp_enabled = True
        plain_recovery_codes = self.alice.generate_recovery_codes()
        self.alice.save()

        first_recovery_code = plain_recovery_codes[0]

        login_res = self.client.post(reverse('login'), {
            'mobile': '+919876540001',
            'password': 'Pass@1234',
        })
        temp_token = login_res.data['temp_token']

        # Use the recovery code to authenticate
        verify_res = self.client.post(reverse('verify-2fa'), {
            'temp_token': temp_token,
            'recovery_code': first_recovery_code,
        })
        self.assertEqual(verify_res.status_code, 200)
        self.assertIn('access', verify_res.data)
        self.assertEqual(verify_res.data['recovery_codes_remaining'], 9)

        # Recovery code is burned: second attempt with the same code must fail
        login_res2 = self.client.post(reverse('login'), {
            'mobile': '+919876540001',
            'password': 'Pass@1234',
        })
        temp_token2 = login_res2.data['temp_token']
        reuse_res = self.client.post(reverse('verify-2fa'), {
            'temp_token': temp_token2,
            'recovery_code': first_recovery_code,
        })
        self.assertEqual(reuse_res.status_code, 400)

    def test_cashier_role_can_enable_and_use_totp(self):
        self.client.force_authenticate(user=self.charlie)
        setup_res = self.client.post(reverse('2fa-setup'))
        self.assertEqual(setup_res.status_code, 200)
        secret = setup_res.data['secret']

        code = pyotp.TOTP(secret).now()
        confirm_res = self.client.post(reverse('2fa-confirm'), {'code': code})
        self.assertEqual(confirm_res.status_code, 200)

        self.charlie.refresh_from_db()
        self.assertTrue(self.charlie.totp_enabled)

        # Unauthenticate and log in as cashier with 2FA
        self.client.force_authenticate(user=None)
        login_res = self.client.post(reverse('login'), {
            'mobile': '+919876540003',
            'password': 'Cashier@1234',
        })
        self.assertTrue(login_res.data.get('totp_required'))
        temp_token = login_res.data['temp_token']

        cashier_code = pyotp.TOTP(secret).now()
        verify_res = self.client.post(reverse('verify-2fa'), {
            'temp_token': temp_token,
            'code': cashier_code,
        })
        self.assertEqual(verify_res.status_code, 200)
        self.assertEqual(verify_res.data['user']['role'], 'cashier')

    def test_disable_totp_requires_valid_password_and_code(self):
        secret = pyotp.random_base32()
        self.alice.set_totp_secret(secret)
        self.alice.totp_enabled = True
        self.alice.generate_recovery_codes()
        self.alice.save()

        self.client.force_authenticate(user=self.alice)

        # Wrong password fails
        bad_pwd_res = self.client.post(reverse('2fa-disable'), {
            'password': 'WrongPassword!',
            'code': pyotp.TOTP(secret).now(),
        })
        self.assertEqual(bad_pwd_res.status_code, 400)
        self.alice.refresh_from_db()
        self.assertTrue(self.alice.totp_enabled)

        # Correct password & code disables 2FA
        code = pyotp.TOTP(secret).now()
        good_res = self.client.post(reverse('2fa-disable'), {
            'password': 'Pass@1234',
            'code': code,
        })
        self.assertEqual(good_res.status_code, 200)
        self.alice.refresh_from_db()
        self.assertFalse(self.alice.totp_enabled)
        self.assertEqual(self.alice.totp_secret, '')
        self.assertEqual(self.alice.totp_recovery_codes, [])

    def test_regenerate_recovery_codes(self):
        secret = pyotp.random_base32()
        self.alice.set_totp_secret(secret)
        self.alice.totp_enabled = True
        initial_codes = self.alice.generate_recovery_codes()
        self.alice.save()

        self.client.force_authenticate(user=self.alice)
        code = pyotp.TOTP(secret).now()
        regen_res = self.client.post(reverse('2fa-regenerate-recovery-codes'), {
            'password': 'Pass@1234',
            'code': code,
        })
        self.assertEqual(regen_res.status_code, 200)
        new_codes = regen_res.data['recovery_codes']
        self.assertEqual(len(new_codes), 10)
        # Codes must be brand new
        self.assertNotEqual(set(initial_codes), set(new_codes))


    def test_password_reset_directly_via_totp_without_email(self):
        secret = pyotp.random_base32()
        self.alice.set_totp_secret(secret)
        self.alice.totp_enabled = True
        self.alice.save()

        code = pyotp.TOTP(secret).now()
        res = self.client.post('/api/auth/password-reset-totp/', {
            'identifier': '9876540001',
            'code': code,
            'new_password': 'NewPassword@2026',
        })
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get('success'))

        # Verify Alice can now sign in with her new password
        self.alice.refresh_from_db()
        self.assertTrue(self.alice.check_password('NewPassword@2026'))

    def test_password_reset_totp_rejects_invalid_code(self):
        secret = pyotp.random_base32()
        self.alice.set_totp_secret(secret)
        self.alice.totp_enabled = True
        self.alice.save()

        res = self.client.post('/api/auth/password-reset-totp/', {
            'identifier': '9876540001',
            'code': '000000',
            'new_password': 'NewPassword@2026',
        })
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('code'), 'invalid_code')

    def test_password_reset_totp_rejects_when_2fa_not_enabled(self):
        # Charlie has 2FA disabled
        res = self.client.post('/api/auth/password-reset-totp/', {
            'identifier': '9876540003',
            'code': '123456',
            'new_password': 'NewPassword@2026',
        })
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('code'), 'totp_not_enabled')
