from unittest.mock import MagicMock, patch
from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase, override_settings

from api.email_backends import (
    PermanentEmailError,
    TransientEmailError,
    TransactionalEmailBackend,
    mask_email,
    mask_secret,
    extract_email_content,
)
from api.emails import _run_email_task


class TransactionalEmailBackendTests(SimpleTestCase):
    def setUp(self):
        self.backend = TransactionalEmailBackend()

    # =========================================================================
    # 1. PROVIDER RESOLUTION TESTS
    # =========================================================================

    @override_settings(EMAIL_PROVIDER='resend', RESEND_API_KEY='re_test_key')
    def test_explicit_resend_provider_resolution(self):
        self.assertEqual(self.backend.resolve_provider(), 'resend')

    @override_settings(EMAIL_PROVIDER='brevo', BREVO_API_KEY='xkeysib-test')
    def test_explicit_brevo_provider_resolution(self):
        self.assertEqual(self.backend.resolve_provider(), 'brevo')

    @override_settings(EMAIL_PROVIDER='sendgrid', SENDGRID_API_KEY='SG.test')
    def test_explicit_sendgrid_provider_resolution(self):
        self.assertEqual(self.backend.resolve_provider(), 'sendgrid')

    @override_settings(EMAIL_PROVIDER='smtp', EMAIL_HOST='smtp.gmail.com')
    def test_explicit_smtp_provider_resolution(self):
        self.assertEqual(self.backend.resolve_provider(), 'smtp')

    @override_settings(EMAIL_PROVIDER='auto', RESEND_API_KEY='re_123456789')
    def test_auto_detect_resend(self):
        self.assertEqual(self.backend.resolve_provider(), 'resend')

    @override_settings(EMAIL_PROVIDER='auto', RESEND_API_KEY='', BREVO_API_KEY='xkeysib-123456789')
    def test_auto_detect_brevo(self):
        self.assertEqual(self.backend.resolve_provider(), 'brevo')

    @override_settings(EMAIL_PROVIDER='auto', RESEND_API_KEY='', BREVO_API_KEY='', SENDGRID_API_KEY='SG.123456789')
    def test_auto_detect_sendgrid(self):
        self.assertEqual(self.backend.resolve_provider(), 'sendgrid')

    @override_settings(
        EMAIL_PROVIDER='auto',
        RESEND_API_KEY='',
        BREVO_API_KEY='',
        SENDGRID_API_KEY='',
        EMAIL_API_KEY='',
        EMAIL_HOST='smtp.gmail.com'
    )
    def test_auto_detect_smtp_when_no_api_keys(self):
        """In local development with only EMAIL_HOST set, resolves to smtp."""
        self.assertEqual(self.backend.resolve_provider(), 'smtp')

    # =========================================================================
    # 2. RESEND DELIVERY TESTS
    # =========================================================================

    @override_settings(
        EMAIL_PROVIDER='resend',
        RESEND_API_KEY='re_test_123',
        DEFAULT_FROM_EMAIL='Dreamwithtech <notifications@dreamwithtech.dev>'
    )
    @patch('api.email_backends._http_post')
    def test_resend_successful_delivery(self, mock_http_post):
        mock_http_post.return_value = (200, {'id': 'resend-msg-123'})

        msg = EmailMultiAlternatives(
            subject='Your OTP Code',
            body='Your code is 654321',
            from_email='Dreamwithtech <notifications@dreamwithtech.dev>',
            to=['user@test.com']
        )
        msg.attach_alternative('<p>Your code is 654321</p>', 'text/html')

        sent_count = self.backend.send_messages([msg])
        self.assertEqual(sent_count, 1)

        mock_http_post.assert_called_once()
        url, headers, payload = mock_http_post.call_args[0][:3]
        self.assertEqual(url, 'https://api.resend.com/emails')
        self.assertEqual(headers['Authorization'], 'Bearer re_test_123')
        self.assertEqual(payload['to'], ['user@test.com'])
        self.assertEqual(payload['subject'], 'Your OTP Code')
        self.assertEqual(payload['text'], 'Your code is 654321')
        self.assertEqual(payload['html'], '<p>Your code is 654321</p>')

    @override_settings(
        EMAIL_PROVIDER='resend',
        RESEND_API_KEY='re_test_invalid',
    )
    @patch('api.email_backends._http_post')
    def test_resend_authentication_error_raises_permanent_error(self, mock_http_post):
        mock_http_post.return_value = (401, {'message': 'Invalid API Key'})

        msg = EmailMultiAlternatives(
            subject='Test',
            body='Hello',
            from_email='test@example.com',
            to=['user@test.com']
        )

        with self.assertRaises(PermanentEmailError) as ctx:
            self.backend.send_messages([msg])
        self.assertIn('HTTP 401', str(ctx.exception))

    @override_settings(
        EMAIL_PROVIDER='resend',
        RESEND_API_KEY='re_test_123',
    )
    @patch('api.email_backends._http_post')
    def test_resend_rate_limit_raises_transient_error(self, mock_http_post):
        mock_http_post.return_value = (429, {'message': 'Too many requests'})

        msg = EmailMultiAlternatives(
            subject='Test',
            body='Hello',
            from_email='test@example.com',
            to=['user@test.com']
        )

        with self.assertRaises(TransientEmailError) as ctx:
            self.backend.send_messages([msg])
        self.assertIn('HTTP 429', str(ctx.exception))

    # =========================================================================
    # 3. BREVO DELIVERY TESTS
    # =========================================================================

    @override_settings(
        EMAIL_PROVIDER='brevo',
        BREVO_API_KEY='xkeysib-test-123',
        DEFAULT_FROM_EMAIL='Dreamwithtech <dreamwithtech.dev@gmail.com>'
    )
    @patch('api.email_backends._http_post')
    def test_brevo_successful_delivery(self, mock_http_post):
        mock_http_post.return_value = (201, {'messageId': '<brevo-msg-456>'})

        msg = EmailMultiAlternatives(
            subject='Reset password',
            body='Click here to reset',
            from_email='Dreamwithtech <dreamwithtech.dev@gmail.com>',
            to=['customer@test.com']
        )
        msg.attach_alternative('<p>Click here to reset</p>', 'text/html')

        sent_count = self.backend.send_messages([msg])
        self.assertEqual(sent_count, 1)

        mock_http_post.assert_called_once()
        url, headers, payload = mock_http_post.call_args[0][:3]
        self.assertEqual(url, 'https://api.brevo.com/v3/smtp/email')
        self.assertEqual(headers['api-key'], 'xkeysib-test-123')
        self.assertEqual(payload['sender']['email'], 'dreamwithtech.dev@gmail.com')
        self.assertEqual(payload['sender']['name'], 'Dreamwithtech')
        self.assertEqual(payload['to'], [{'email': 'customer@test.com'}])
        self.assertEqual(payload['htmlContent'], '<p>Click here to reset</p>')

    # =========================================================================
    # 4. SENDGRID DELIVERY TESTS
    # =========================================================================

    @override_settings(
        EMAIL_PROVIDER='sendgrid',
        SENDGRID_API_KEY='SG.test-123',
        DEFAULT_FROM_EMAIL='Dreamwithtech <info@test.com>'
    )
    @patch('api.email_backends._http_post')
    def test_sendgrid_successful_delivery(self, mock_http_post):
        mock_http_post.return_value = (202, {})

        msg = EmailMultiAlternatives(
            subject='Welcome',
            body='Welcome aboard',
            from_email='Dreamwithtech <info@test.com>',
            to=['client@test.com']
        )

        sent_count = self.backend.send_messages([msg])
        self.assertEqual(sent_count, 1)

        mock_http_post.assert_called_once()
        url, headers, payload = mock_http_post.call_args[0][:3]
        self.assertEqual(url, 'https://api.sendgrid.com/v3/mail/send')
        self.assertEqual(headers['Authorization'], 'Bearer SG.test-123')
        self.assertEqual(payload['personalizations'][0]['to'], [{'email': 'client@test.com'}])

    # =========================================================================
    # 5. SMTP HOST NETWORK RESTRICTION (ERRNO 101) DETECTION
    # =========================================================================

    @override_settings(
        EMAIL_PROVIDER='smtp',
        EMAIL_HOST='smtp.gmail.com',
        EMAIL_PORT=587,
    )
    @patch('django.core.mail.backends.smtp.EmailBackend.send_messages')
    def test_smtp_network_unreachable_raises_permanent_error(self, mock_smtp_send):
        """When host OS returns Errno 101 (Network is unreachable), converts to PermanentEmailError."""
        err = OSError(101, 'Network is unreachable')
        mock_smtp_send.side_effect = err

        msg = EmailMultiAlternatives(
            subject='OTP',
            body='123456',
            from_email='sender@test.com',
            to=['dest@test.com']
        )

        with self.assertRaises(PermanentEmailError) as ctx:
            self.backend.send_messages([msg])
        self.assertIn('Network is unreachable', str(ctx.exception))
        self.assertIn('outbound smtp traffic is blocked by the host platform environment', str(ctx.exception).lower())

    # =========================================================================
    # 6. WORKER RETRY & ERROR HANDLING
    # =========================================================================

    def test_worker_aborts_immediately_on_permanent_error(self):
        """Worker does NOT retry when PermanentEmailError occurs."""
        mock_func = MagicMock(side_effect=PermanentEmailError("Invalid credentials"))
        _run_email_task(mock_func)
        self.assertEqual(mock_func.call_count, 1)

    def test_worker_aborts_immediately_on_errno_101(self):
        """Worker does NOT retry when OSError [Errno 101] occurs."""
        mock_func = MagicMock(side_effect=OSError(101, "Network is unreachable"))
        _run_email_task(mock_func)
        self.assertEqual(mock_func.call_count, 1)

    @patch('time.sleep')
    def test_worker_retries_transient_error_up_to_max(self, mock_sleep):
        """Worker retries transient errors up to 3 times with backoff."""
        mock_func = MagicMock(side_effect=TransientEmailError("Rate limited HTTP 429"))
        _run_email_task(mock_func)
        self.assertEqual(mock_func.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)

    # =========================================================================
    # 7. UTILITIES & MASKING
    # =========================================================================

    def test_masking_helpers(self):
        self.assertEqual(mask_email('user@example.com'), 'u**r@example.com')
        self.assertEqual(mask_email('a@b.com'), 'a*@b.com')
        self.assertEqual(mask_secret('re_1234567890abcdef'), 're_...cdef')
        self.assertNotIn('1234567890', mask_secret('re_1234567890abcdef'))
