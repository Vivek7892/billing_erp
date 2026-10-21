from datetime import timedelta
from unittest.mock import patch
from django.conf import settings
from django.test import TestCase, override_settings
from django.utils import timezone
from api.models import User, OTPRecord


class OTPFlowOptimizationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            username='testuser',
            email='user@test.com',
            first_name='Test',
            last_name='User',
            phone='9876543210',
            role='owner',
            is_active=True,
            is_verified=False
        )
        self.user.set_password('Password123!')
        self.user.save()

    # =========================================================================
    # 1. REGISTRATION TESTS
    # =========================================================================

    @override_settings(REQUIRE_OTP_VERIFICATION=True, REQUIRE_EMAIL_VERIFICATION=True)
    @patch('api.emails.enqueue_email_task')
    def test_registration_creates_otp_and_queues_email_asynchronously(self, mock_enqueue):
        """Registration should create user, create OTPRecord, queue email asynchronously, and return 201."""
        res = self.client.post('/api/auth/register/', {
            'full_name': 'New Merchant',
            'email': 'merchant@test.com',
            'username': 'merchant',
            'password': 'Password123!',
            'confirm_password': 'Password123!',
            'phone': '9876543211',
            'terms_accepted': True
        })

        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data.get('require_verification'))
        self.assertEqual(res.data.get('identifier'), 'merchant@test.com')

        # Check OTPRecord created in DB
        otp_rec = OTPRecord.objects.filter(identifier='merchant@test.com', purpose='signup', is_used=False).first()
        self.assertIsNotNone(otp_rec)
        # Verify OTP is stored as a 64-char hex SHA-256 hash, not plaintext
        self.assertEqual(len(otp_rec.otp_hash), 64)
        self.assertFalse(otp_rec.is_verified)
        self.assertFalse(otp_rec.is_used)

        # Verify email was enqueued asynchronously
        self.assertTrue(mock_enqueue.called)

    def test_invalid_registration_validation(self):
        """Invalid registration should return 400 and create no user or OTP."""
        res = self.client.post('/api/auth/register/', {
            'full_name': '',
            'email': 'invalid-email',
            'username': 'ab',  # too short
            'password': '123',
            'confirm_password': '456',
            'terms_accepted': False
        })
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(username='ab').exists())

    # =========================================================================
    # 2. VERIFICATION TESTS
    # =========================================================================

    def test_correct_otp_verification(self):
        """Correct OTP marks record verified/used, sets user.is_verified=True, returns JWT tokens."""
        otp = '123456'
        now = timezone.now()
        OTPRecord.objects.create(
            identifier=self.user.email,
            purpose='signup',
            otp_hash=OTPRecord.hash_otp(otp),
            expires_at=now + timedelta(minutes=10)
        )

        res = self.client.post('/api/auth/verify-otp/', {
            'identifier': self.user.email,
            'otp': otp,
            'purpose': 'signup'
        })

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get('status'), 'verified')
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)

        # Check DB state
        rec = OTPRecord.objects.filter(identifier=self.user.email, purpose='signup').first()
        self.assertTrue(rec.is_verified)
        self.assertTrue(rec.is_used)

        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)

    def test_incorrect_otp_increments_attempts(self):
        """Incorrect OTP increments attempt counter and returns remaining attempts."""
        otp = '123456'
        now = timezone.now()
        OTPRecord.objects.create(
            identifier=self.user.email,
            purpose='signup',
            otp_hash=OTPRecord.hash_otp(otp),
            expires_at=now + timedelta(minutes=10)
        )

        res = self.client.post('/api/auth/verify-otp/', {
            'identifier': self.user.email,
            'otp': '999999',
            'purpose': 'signup'
        })

        self.assertEqual(res.status_code, 400)
        self.assertIn('4 attempt(s) remaining', res.data.get('error', ''))

        rec = OTPRecord.objects.filter(identifier=self.user.email, purpose='signup').first()
        self.assertEqual(rec.attempts, 1)
        self.assertFalse(rec.is_verified)

    def test_max_failed_attempts_blocks_verification(self):
        """When attempts >= 5, OTP verification is rejected."""
        otp = '123456'
        now = timezone.now()
        OTPRecord.objects.create(
            identifier=self.user.email,
            purpose='signup',
            otp_hash=OTPRecord.hash_otp(otp),
            expires_at=now + timedelta(minutes=10),
            attempts=5
        )

        res = self.client.post('/api/auth/verify-otp/', {
            'identifier': self.user.email,
            'otp': otp,
            'purpose': 'signup'
        })

        self.assertEqual(res.status_code, 400)
        self.assertIn('Too many failed attempts', res.data.get('error', ''))

    def test_expired_otp_rejected(self):
        """Expired OTP is rejected."""
        otp = '123456'
        now = timezone.now()
        OTPRecord.objects.create(
            identifier=self.user.email,
            purpose='signup',
            otp_hash=OTPRecord.hash_otp(otp),
            expires_at=now - timedelta(seconds=1)
        )

        res = self.client.post('/api/auth/verify-otp/', {
            'identifier': self.user.email,
            'otp': otp,
            'purpose': 'signup'
        })

        self.assertEqual(res.status_code, 400)
        self.assertIn('expired', res.data.get('error', '').lower())

    def test_already_used_otp_cannot_be_reused(self):
        """An OTP already marked is_used=True cannot be used again."""
        otp = '123456'
        now = timezone.now()
        OTPRecord.objects.create(
            identifier=self.user.email,
            purpose='signup',
            otp_hash=OTPRecord.hash_otp(otp),
            expires_at=now + timedelta(minutes=10),
            is_used=True,
            is_verified=True
        )

        res = self.client.post('/api/auth/verify-otp/', {
            'identifier': self.user.email,
            'otp': otp,
            'purpose': 'signup'
        })

        self.assertEqual(res.status_code, 400)
        self.assertIn('expired or is invalid', res.data.get('error', '').lower())

    def test_invalid_purpose_rejected(self):
        """Invalid purpose string is rejected with 400."""
        res = self.client.post('/api/auth/verify-otp/', {
            'identifier': self.user.email,
            'otp': '123456',
            'purpose': 'admin_hack'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('invalid', res.data.get('error', '').lower())

    # =========================================================================
    # 3. RESEND TESTS
    # =========================================================================

    @patch('api.emails.enqueue_email_task')
    def test_resend_cooldown_enforced(self, mock_enqueue):
        """Resend requested within 60 seconds returns 429."""
        now = timezone.now()
        OTPRecord.objects.create(
            identifier=self.user.email,
            purpose='signup',
            otp_hash=OTPRecord.hash_otp('111111'),
            expires_at=now + timedelta(minutes=10),
            created_at=now - timedelta(seconds=20),
            last_resend_at=now - timedelta(seconds=20)
        )

        res = self.client.post('/api/auth/resend-verification/', {
            'identifier': self.user.email,
            'purpose': 'signup'
        })

        self.assertEqual(res.status_code, 429)
        self.assertIn('wait', res.data.get('error', '').lower())
        self.assertIn('wait_seconds', res.data)
        self.assertFalse(mock_enqueue.called)

    @patch('api.emails.enqueue_email_task')
    def test_resend_after_cooldown_invalidates_previous_otp(self, mock_enqueue):
        """Resend after 60 seconds generates new OTP, invalidates previous OTP, and queues email."""
        now = timezone.now()
        old_rec = OTPRecord.objects.create(
            identifier=self.user.email,
            purpose='signup',
            otp_hash=OTPRecord.hash_otp('111111'),
            expires_at=now + timedelta(minutes=10),
            created_at=now - timedelta(seconds=65),
            last_resend_at=now - timedelta(seconds=65)
        )

        res = self.client.post('/api/auth/resend-verification/', {
            'identifier': self.user.email,
            'purpose': 'signup'
        })

        self.assertEqual(res.status_code, 200)

        # Previous OTP is invalidated
        old_rec.refresh_from_db()
        self.assertTrue(old_rec.is_used)

        # New OTP is created
        new_rec = OTPRecord.objects.filter(identifier=self.user.email, purpose='signup', is_used=False).first()
        self.assertIsNotNone(new_rec)
        self.assertNotEqual(new_rec.id, old_rec.id)
        self.assertEqual(new_rec.resend_count, 1)

        # Email was queued
        self.assertTrue(mock_enqueue.called)

    # =========================================================================
    # 4. EMAIL FAILURE RESILIENCE
    # =========================================================================

    @override_settings(REQUIRE_OTP_VERIFICATION=True, REQUIRE_EMAIL_VERIFICATION=True)
    @patch('api.emails.EmailMultiAlternatives.send', side_effect=Exception('SMTP server unreachable'))
    def test_email_failure_does_not_break_registration_api(self, mock_send):
        """Even if email delivery worker encounters an exception, registration completes with 201."""
        res = self.client.post('/api/auth/register/', {
            'full_name': 'Resilient Merchant',
            'email': 'resilient@test.com',
            'username': 'resilient',
            'password': 'Password123!',
            'confirm_password': 'Password123!',
            'terms_accepted': True
        })

        # API still succeeds immediately!
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data.get('require_verification'))

        # User and OTP are safe in database
        self.assertTrue(User.objects.filter(email='resilient@test.com').exists())
        self.assertTrue(OTPRecord.objects.filter(identifier='resilient@test.com', purpose='signup').exists())

