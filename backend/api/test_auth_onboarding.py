import uuid
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.test import APIClient
from api.models import Business, Product, Setting, OTPRecord

User = get_user_model()


@override_settings(REQUIRE_EMAIL_VERIFICATION=False, REQUIRE_OTP_VERIFICATION=False)
class RegistrationAndAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_successful_registration(self):
        payload = {
            'full_name': 'Ramesh Kumar',
            'username': 'ramesh_store',
            'email': 'ramesh@example.com',
            'phone': '9876543210',
            'password': 'SecurePassword123',
            'confirm_password': 'SecurePassword123',
            'terms_accepted': True
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data['require_verification'])
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'ramesh_store')
        self.assertEqual(response.data['user']['role'], 'owner')
        self.assertEqual(response.data['user']['first_name'], 'Ramesh')
        self.assertEqual(response.data['user']['last_name'], 'Kumar')
        self.assertFalse(response.data['user']['onboarding_completed'])

        # Verify password is encrypted and not stored in plaintext
        user = User.objects.get(username='ramesh_store')
        self.assertTrue(user.check_password('SecurePassword123'))
        self.assertNotEqual(user.password, 'SecurePassword123')
        self.assertEqual(user.role, 'owner')

    @override_settings(REQUIRE_EMAIL_VERIFICATION=True)
    def test_registration_with_verification_required(self):
        payload = {
            'full_name': 'Verify User',
            'username': 'verify_user',
            'email': 'verify@example.com',
            'password': 'Password123',
            'confirm_password': 'Password123',
            'terms_accepted': True
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['require_verification'])
        self.assertEqual(response.data['identifier'], 'verify@example.com')
        self.assertIn('code sent', response.data['message'])

    def test_forbidden_role_manipulation_on_registration(self):
        payload = {
            'full_name': 'Attacker',
            'username': 'attacker',
            'email': 'attacker@example.com',
            'phone': '9876543211',
            'password': 'Password123',
            'confirm_password': 'Password123',
            'terms_accepted': True,
            'role': 'admin',
            'is_superuser': True,
            'is_staff': True,
            'is_verified': True
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username='attacker')
        self.assertEqual(user.role, 'owner')
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_duplicate_username_and_email(self):
        User.objects.create_user(
            username='existinguser',
            email='existing@example.com',
            password='Password123'
        )

        # Duplicate username
        res1 = self.client.post('/api/auth/register/', {
            'username': 'existinguser',
            'email': 'unique@example.com',
            'password': 'Password123',
            'confirm_password': 'Password123',
            'terms_accepted': True
        }, format='json')
        self.assertEqual(res1.status_code, 400)
        self.assertIn('username', res1.data)

        # Duplicate email
        res2 = self.client.post('/api/auth/register/', {
            'username': 'newuser123',
            'email': 'EXISTING@example.com',  # case-insensitive check
            'password': 'Password123',
            'confirm_password': 'Password123',
            'terms_accepted': True
        }, format='json')
        self.assertEqual(res2.status_code, 400)
        self.assertIn('email', res2.data)

    def test_password_mismatch_and_weak_password(self):
        res1 = self.client.post('/api/auth/register/', {
            'username': 'weakpass',
            'email': 'weak@example.com',
            'password': 'password',  # no numbers
            'confirm_password': 'password',
            'terms_accepted': True
        }, format='json')
        self.assertEqual(res1.status_code, 400)

        res2 = self.client.post('/api/auth/register/', {
            'username': 'mismatch',
            'email': 'mismatch@example.com',
            'password': 'Password123',
            'confirm_password': 'Different123',
            'terms_accepted': True
        }, format='json')
        self.assertEqual(res2.status_code, 400)
        self.assertIn('confirm_password', res2.data)

    def test_login_with_email_and_username(self):
        user = User.objects.create_user(
            username='shopkeeper',
            email='shop@retail.in',
            password='MyPassword123'
        )

        # Login with username
        r1 = self.client.post('/api/auth/login/', {'username': 'shopkeeper', 'password': 'MyPassword123'})
        self.assertEqual(r1.status_code, 200)
        self.assertIn('access', r1.data)

        # Login with email
        r2 = self.client.post('/api/auth/login/', {'username': 'shop@retail.in', 'password': 'MyPassword123'})
        self.assertEqual(r2.status_code, 200)
        self.assertIn('access', r2.data)


class OTPVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='otpuser',
            email='otp@example.com',
            password='Password123',
            is_verified=False
        )

    def test_otp_verification_success(self):
        otp = '654321'
        OTPRecord.objects.create(
            identifier='otp@example.com',
            purpose='signup',
            otp_hash=OTPRecord.hash_otp(otp),
            expires_at=timezone.now() + timedelta(minutes=10)
        )

        response = self.client.post('/api/auth/verify-otp/', {
            'identifier': 'otp@example.com',
            'otp': '654321',
            'purpose': 'signup'
        })
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)
        self.assertIn('access', response.data)

    def test_otp_attempt_limits_and_expiry(self):
        otp = '123456'
        record = OTPRecord.objects.create(
            identifier='otp@example.com',
            purpose='signup',
            otp_hash=OTPRecord.hash_otp(otp),
            expires_at=timezone.now() + timedelta(minutes=10)
        )

        # 5 wrong attempts
        for _ in range(5):
            res = self.client.post('/api/auth/verify-otp/', {
                'identifier': 'otp@example.com',
                'otp': '000000',
                'purpose': 'signup'
            })
            self.assertEqual(res.status_code, 400)

        # 6th attempt even with correct OTP fails due to max attempts reached
        res = self.client.post('/api/auth/verify-otp/', {
            'identifier': 'otp@example.com',
            'otp': '123456',
            'purpose': 'signup'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('Too many failed attempts', res.data['error'])


class OnboardingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='newowner',
            email='owner@market.com',
            password='Password123',
            role='owner'
        )
        self.client.force_authenticate(user=self.user)

    def test_initial_onboarding_status(self):
        response = self.client.get('/api/auth/onboarding-status/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['onboarding_completed'])
        self.assertEqual(response.data['current_step'], 'business')
        self.assertIsNone(response.data['business'])
        self.assertFalse(response.data['checklist']['profile_completed'])

    def test_step1_business_creation(self):
        step1_data = {
            'step': 'business',
            'name': 'Krishna Super Store',
            'business_type': 'Supermarket',
            'owner_name': 'Krishna Prasad',
            'email': 'store@krishna.com',
            'mobile': '9876543210',
            'address': 'Main Market Road',
            'state': 'Karnataka',
            'city': 'Bengaluru',
            'pincode': '560001'
        }
        res = self.client.patch('/api/auth/onboarding-progress/', step1_data, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['current_step'], 'preferences')

        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.business)
        self.assertEqual(self.user.business.name, 'Krishna Super Store')
        self.assertEqual(self.user.business.business_type, 'Supermarket')
        self.assertEqual(self.user.business.city, 'Bengaluru')

    def test_step2_preferences_and_gst_validation(self):
        # Setup step 1 first
        biz = Business.objects.create(name='Test Shop', business_type='Retail')
        self.user.business = biz
        self.user.save()

        # Invalid GSTIN when gst_registered=True
        invalid_gst = {
            'step': 'preferences',
            'gst_registered': True,
            'gstin': 'INVALID_GSTIN_123',
            'tax_enabled': True,
            'invoice_prefix': 'KSS'
        }
        r_err = self.client.patch('/api/auth/onboarding-progress/', invalid_gst, format='json')
        self.assertEqual(r_err.status_code, 400)
        self.assertIn('gstin', r_err.data)

        # Valid GSTIN
        valid_gst = {
            'step': 'preferences',
            'gst_registered': True,
            'gstin': '29ABCDE1234F1Z5',
            'tax_enabled': True,
            'currency': '₹',
            'invoice_prefix': 'KSS',
            'invoice_start_number': 1001,
            'invoice_format': 'thermal-80mm'
        }
        r_ok = self.client.patch('/api/auth/onboarding-progress/', valid_gst, format='json')
        self.assertEqual(r_ok.status_code, 200)
        self.assertEqual(r_ok.data['current_step'], 'choices')

        biz.refresh_from_db()
        self.assertEqual(biz.gstin, '29ABCDE1234F1Z5')
        self.assertEqual(biz.invoice_format, 'thermal-80mm')

    def test_step3_optional_product_addition(self):
        biz = Business.objects.create(name='Test Shop', business_type='Retail')
        self.user.business = biz
        self.user.save()

        step3_data = {
            'step': 'choices',
            'first_product': {
                'name': 'Basmati Rice 5kg',
                'selling_price': '450.00',
                'purchase_price': '380.00',
                'mrp': '499.00',
                'unit': 'pack',
                'current_stock': '25',
                'category_name': 'Grains'
            }
        }
        res = self.client.patch('/api/auth/onboarding-progress/', step3_data, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['current_step'], 'review')

        prod = Product.objects.filter(business=biz, name='Basmati Rice 5kg').first()
        self.assertIsNotNone(prod)
        self.assertEqual(prod.selling_price, 450)
        self.assertEqual(prod.category.name, 'Grains')

    def test_onboarding_completion(self):
        biz = Business.objects.create(name='Final Shop', business_type='Pharmacy')
        self.user.business = biz
        self.user.save()

        res = self.client.post('/api/auth/onboarding/complete/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'completed')

        self.user.refresh_from_db()
        biz.refresh_from_db()
        self.assertTrue(self.user.onboarding_completed)
        self.assertTrue(biz.onboarding_completed)
        self.assertEqual(biz.onboarding_step, 'completed')

        # Status endpoint now reflects completed
        status_res = self.client.get('/api/auth/onboarding-status/')
        self.assertTrue(status_res.data['onboarding_completed'])
        self.assertEqual(status_res.data['current_step'], 'completed')

    def test_business_data_isolation_between_owners(self):
        # Owner 1
        biz1 = Business.objects.create(name='Owner 1 Shop', business_type='Retail')
        self.user.business = biz1
        self.user.save()

        # Owner 2
        user2 = User.objects.create_user(
            username='owner2',
            email='owner2@store.com',
            password='Password123',
            role='owner'
        )
        biz2 = Business.objects.create(name='Owner 2 Shop', business_type='Clothing')
        user2.business = biz2
        user2.save()

        client2 = APIClient()
        client2.force_authenticate(user=user2)

        # Owner 2 updating onboarding progress only updates biz2, not biz1
        client2.patch('/api/auth/onboarding-progress/', {
            'step': 'business',
            'name': 'Owner 2 Renamed',
            'business_type': 'Textiles'
        }, format='json')

        biz1.refresh_from_db()
        biz2.refresh_from_db()
        self.assertEqual(biz1.name, 'Owner 1 Shop')  # Untouched
        self.assertEqual(biz2.name, 'Owner 2 Renamed')


class PasswordResetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='resetuser',
            email='reset@company.com',
            password='OldPassword123'
        )

    def test_password_reset_request_and_confirm(self):
        # Request reset
        res_req = self.client.post('/api/auth/password-reset/', {'email': 'reset@company.com'})
        self.assertEqual(res_req.status_code, 200)

        # Generate token directly as the view does
        token = default_token_generator.make_token(self.user)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        # Confirm reset with valid token
        res_conf = self.client.post('/api/auth/password-reset-confirm/', {
            'uid': uid,
            'token': token,
            'new_password': 'BrandNewPassword456',
            'confirm_password': 'BrandNewPassword456'
        })
        self.assertEqual(res_conf.status_code, 200)

        # Verify old password no longer works and new password works
        self.user.refresh_from_db()
        self.assertFalse(self.user.check_password('OldPassword123'))
        self.assertTrue(self.user.check_password('BrandNewPassword456'))

        # Token is single use: using the same token again fails
        res_reuse = self.client.post('/api/auth/password-reset-confirm/', {
            'uid': uid,
            'token': token,
            'new_password': 'AnotherPassword789',
            'confirm_password': 'AnotherPassword789'
        })
        self.assertEqual(res_reuse.status_code, 400)

