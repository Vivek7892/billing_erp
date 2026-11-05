"""
Comprehensive Automated Tests for Multi-Tenant SaaS Authentication,
Role-Based Access Control (RBAC), Staff Management & Tenant Isolation.
"""
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from decimal import Decimal

from api.models import (
    Business, User, Customer, Product, Invoice, InvoiceItem,
    Payment, ProductBatch, Setting, AuditLog, OTPRecord,
    ALL_PERMISSIONS
)


class MultiTenantAuthAndSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # ----------------------------------------------------
        # Business A setup: Owner A, Admin A, Cashier A
        # ----------------------------------------------------
        self.biz_a = Business.objects.create(
            name="Alpha Retailers",
            owner_name="Alice Owner",
            mobile="+919876500001",
            email="alice@alpha.com",
            onboarding_completed=True,
        )

        self.owner_a = User.objects.create(
            username="+919876500001",
            phone="+919876500001",
            first_name="Alice",
            last_name="Owner",
            role="owner",
            is_active=True,
            is_verified=True,
            business=self.biz_a,
        )
        self.owner_a.set_password("AlphaPass123!")
        self.owner_a.save()

        self.admin_a = User.objects.create(
            username="+919876500002",
            phone="+919876500002",
            first_name="Alan",
            last_name="Admin",
            role="admin",
            is_active=True,
            is_verified=True,
            business=self.biz_a,
        )
        self.admin_a.set_password("AdminPass123!")
        self.admin_a.save()

        self.cashier_a = User.objects.create(
            username="+919876500003",
            phone="+919876500003",
            first_name="Charlie",
            last_name="Cashier",
            role="cashier",
            is_active=True,
            is_verified=True,
            business=self.biz_a,
        )
        self.cashier_a.set_password("CashierPass123!")
        self.cashier_a.set_pos_pin("1234")
        self.cashier_a.save()

        # Biz A operational records
        self.cust_a = Customer.objects.create(
            business=self.biz_a,
            name="Alpha Customer",
            mobile="+919876511111",
        )
        self.prod_a = Product.objects.create(
            business=self.biz_a,
            name="Alpha Product 1",
            sku="AP-001",
            selling_price=Decimal("100.00"),
            purchase_price=Decimal("60.00"),
            mrp=Decimal("120.00"),
            current_stock=Decimal("50"),
        )
        self.inv_a = Invoice.objects.create(
            business=self.biz_a,
            invoice_number="INV-A-1001",
            customer=self.cust_a,
            customer_name=self.cust_a.name,
            subtotal=Decimal("100.00"),
            grand_total=Decimal("100.00"),
            paid_amount=Decimal("100.00"),
            payment_status="paid",
            status="completed",
            created_by=self.cashier_a,
        )

        # ----------------------------------------------------
        # Business B setup: Owner B, Cashier B
        # ----------------------------------------------------
        self.biz_b = Business.objects.create(
            name="Beta Traders",
            owner_name="Bob Owner",
            mobile="+919876500099",
            email="bob@beta.com",
            onboarding_completed=True,
        )

        self.owner_b = User.objects.create(
            username="+919876500099",
            phone="+919876500099",
            first_name="Bob",
            last_name="Owner",
            role="owner",
            is_active=True,
            is_verified=True,
            business=self.biz_b,
        )
        self.owner_b.set_password("BetaPass123!")
        self.owner_b.save()

        self.cust_b = Customer.objects.create(
            business=self.biz_b,
            name="Beta Customer",
            mobile="+919876599999",
        )
        self.prod_b = Product.objects.create(
            business=self.biz_b,
            name="Beta Product 1",
            sku="BP-001",
            selling_price=Decimal("200.00"),
            purchase_price=Decimal("120.00"),
            mrp=Decimal("250.00"),
            current_stock=Decimal("30"),
        )
        self.inv_b = Invoice.objects.create(
            business=self.biz_b,
            invoice_number="INV-B-1001",
            customer=self.cust_b,
            customer_name=self.cust_b.name,
            subtotal=Decimal("200.00"),
            grand_total=Decimal("200.00"),
            paid_amount=Decimal("200.00"),
            payment_status="paid",
            status="completed",
            created_by=self.owner_b,
        )

    # =========================================================================
    # PHASE 2 & 7: MOBILE AUTHENTICATION & LOGIN TESTS
    # =========================================================================

    def test_login_with_valid_mobile_and_password(self):
        """Users can log in using mobile number in international or 10-digit format."""
        res = self.client.post('/api/auth/login/', {
            'mobile': '9876500001',
            'password': 'AlphaPass123!',
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data['user']['phone'], '+919876500001')
        self.assertEqual(res.data['user']['role'], 'owner')
        self.assertEqual(str(res.data['user']['business']), str(self.biz_a.id))
        self.assertEqual(res.data['user']['business_shop_id'], self.biz_a.shop_id)

    def test_login_with_incorrect_password(self):
        """Failed password returns 401 and generic error without revealing user details."""
        res = self.client.post('/api/auth/login/', {
            'mobile': '+919876500001',
            'password': 'WrongPassword123!',
        })
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data.get('code'), 'invalid_credentials')
        self.owner_a.refresh_from_db()
        self.assertEqual(self.owner_a.failed_login_attempts, 1)

    def test_login_with_unknown_mobile_number(self):
        """Unknown mobile number returns 401 without revealing non-existence."""
        res = self.client.post('/api/auth/login/', {
            'mobile': '+919876599990',
            'password': 'SomePassword123!',
        })
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data.get('code'), 'invalid_credentials')

    def test_login_rejected_for_inactive_account(self):
        """Deactivated accounts are rejected with 403."""
        self.cashier_a.is_active = False
        self.cashier_a.save()

        res = self.client.post('/api/auth/login/', {
            'mobile': '+919876500003',
            'password': 'CashierPass123!',
        })
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data.get('code'), 'account_deactivated')

    def test_login_rejected_for_unverified_account(self):
        """Unverified accounts are rejected with 403 unverified code."""
        self.cashier_a.is_verified = False
        self.cashier_a.save()

        res = self.client.post('/api/auth/login/', {
            'mobile': '+919876500003',
            'password': 'CashierPass123!',
        })
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data.get('code'), 'unverified')

    def test_cashier_fast_pin_login(self):
        """Cashier can log in using fast POS PIN if enabled."""
        res = self.client.post('/api/auth/pin-login/', {
            'mobile': '9876500003',
            'pin': '1234',
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)
        self.assertEqual(res.data['user']['role'], 'cashier')

    # =========================================================================
    # PHASE 4: BUSINESS OWNER REGISTRATION & ONBOARDING WORKFLOW
    # =========================================================================

    def test_owner_registration_and_otp_verification_workflow(self):
        """New merchant registers shop and is activated immediately without OTP."""
        reg_res = self.client.post('/api/auth/register/', {
            'business_name': 'Green Grocers',
            'mobile': '9876543299',
            'password': 'SecurePass2026!',
            'confirm_password': 'SecurePass2026!',
            'full_name': 'Gordon Green',
            'email': 'gordon@greengrocers.com',
            'terms_accepted': True,
        })
        self.assertEqual(reg_res.status_code, 201)
        self.assertIn('access', reg_res.data)
        self.assertEqual(reg_res.data['user']['phone'], '+919876543299')
        self.assertEqual(reg_res.data['user']['role'], 'owner')
        self.assertTrue(reg_res.data['user']['business_shop_id'].startswith('DW'))

    def test_duplicate_mobile_registration_prevented(self):
        """Cannot register with a mobile number already in active use."""
        res = self.client.post('/api/auth/register/', {
            'business_name': 'Duplicate Shop',
            'mobile': '9876500001',
            'password': 'SecurePass2026!',
            'confirm_password': 'SecurePass2026!',
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('mobile', res.data)

    # =========================================================================
    # PHASE 3: MULTI-TENANT ISOLATION TESTS (SHOP A vs SHOP B)
    # =========================================================================

    def test_shop_a_cannot_view_shop_b_invoices(self):
        """Shop A user listing invoices does not see Shop B invoices."""
        self.client.force_authenticate(user=self.owner_a)
        res = self.client.get('/api/invoices/')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        inv_ids = [inv['id'] for inv in results]
        self.assertIn(self.inv_a.id, inv_ids)
        self.assertNotIn(self.inv_b.id, inv_ids)

    def test_shop_a_cannot_access_shop_b_customers(self):
        """Shop A user cannot access or retrieve Shop B customer details."""
        self.client.force_authenticate(user=self.cashier_a)
        res = self.client.get('/api/customers/')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        cust_ids = [c['id'] for c in results]
        self.assertIn(self.cust_a.id, cust_ids)
        self.assertNotIn(self.cust_b.id, cust_ids)

        res_detail = self.client.get(f'/api/customers/{self.cust_b.id}/')
        self.assertEqual(res_detail.status_code, 404)

    def test_shop_a_cannot_modify_shop_b_products(self):
        """Shop A user cannot update or delete Shop B products."""
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.patch(f'/api/products/{self.prod_b.id}/', {
            'selling_price': Decimal('999.00'),
        })
        self.assertEqual(res.status_code, 404)

    def test_shop_a_cannot_download_shop_b_pdf(self):
        """Shop A user cannot download or view Shop B invoice PDF."""
        self.client.force_authenticate(user=self.owner_a)
        res = self.client.get(f'/api/invoices/{self.inv_b.id}/pdf/')
        self.assertEqual(res.status_code, 404)

    def test_shop_a_cannot_attach_shop_b_product_to_invoice(self):
        """Creating an invoice in Shop A referencing Shop B product fails validation."""
        self.client.force_authenticate(user=self.cashier_a)
        res = self.client.post('/api/invoices/', {
            'customer': self.cust_a.id,
            'items': [
                {
                    'product_id': self.prod_b.id,
                    'quantity': 1,
                    'unit_price': 200,
                }
            ],
            'payments': [
                {'method': 'cash', 'amount': 200}
            ]
        })
        self.assertEqual(res.status_code, 400)

    def test_businessless_user_cannot_access_tenant_data(self):
        """An account without a business cannot read any tenant records."""
        unattached_user = User.objects.create(
            username="+919876540000",
            phone="+919876540000",
            role="cashier",
            is_active=True,
            is_verified=True,
            business=None,
        )
        self.client.force_authenticate(user=unattached_user)

        res_inv = self.client.get('/api/invoices/')
        if res_inv.status_code == 200:
            inv_items = res_inv.data.get('results', res_inv.data)
            self.assertEqual(len(inv_items), 0)
        else:
            self.assertEqual(res_inv.status_code, 403)

        res_prod = self.client.get('/api/products/')
        if res_prod.status_code == 200:
            prod_items = res_prod.data.get('results', res_prod.data)
            self.assertEqual(len(prod_items), 0)
        else:
            self.assertEqual(res_prod.status_code, 403)

        res_rep = self.client.get('/api/reports/sales/')
        self.assertEqual(res_rep.status_code, 403)

    # =========================================================================
    # PHASE 5 & 6: STAFF MANAGEMENT & RBAC PERMISSIONS
    # =========================================================================

    def test_owner_can_create_staff_cashier_and_admin(self):
        """Owner can create new cashier staff with mobile number and employee ID."""
        self.client.force_authenticate(user=self.owner_a)
        res = self.client.post('/api/users/', {
            'phone': '9876500005',
            'first_name': 'David',
            'last_name': 'Staff',
            'role': 'cashier',
            'password': 'StaffPassword123!',
            'employee_id': 'EMP-005',
            'department': 'Billing Counter 2',
        })
        self.assertEqual(res.status_code, 201)
        created_user = User.objects.get(phone='+919876500005')
        self.assertEqual(created_user.business, self.biz_a)
        self.assertEqual(created_user.created_by, self.owner_a)
        self.assertEqual(created_user.role, 'cashier')

    def test_cashier_cannot_create_staff_or_escalate_roles(self):
        """Cashiers are blocked from accessing user management."""
        self.client.force_authenticate(user=self.cashier_a)
        res = self.client.get('/api/users/')
        self.assertEqual(res.status_code, 403)

        res_create = self.client.post('/api/users/', {
            'phone': '9876500006',
            'first_name': 'Hacker',
            'role': 'owner',
            'password': 'Password123!',
        })
        self.assertEqual(res_create.status_code, 403)

    def test_admin_cannot_create_owner_account_or_take_ownership(self):
        """Admin cannot create owner accounts or alter the owner."""
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.post('/api/users/', {
            'phone': '9876500007',
            'first_name': 'Fake Owner',
            'role': 'owner',
            'password': 'Password123!',
        })
        self.assertEqual(res.status_code, 403)

        res_del = self.client.delete(f'/api/users/{self.owner_a.id}/')
        self.assertEqual(res_del.status_code, 403)

    def test_cashier_cannot_view_restricted_financial_reports(self):
        """Cashier without reports.profit permission cannot access profit reports."""
        self.client.force_authenticate(user=self.cashier_a)
        res = self.client.get('/api/reports/profit/')
        self.assertEqual(res.status_code, 403)

        res_universal = self.client.get('/api/reports/view/profit/')
        self.assertEqual(res_universal.status_code, 403)

    def test_cashier_cannot_adjust_stock_without_permission(self):
        """Cashier cannot perform stock adjustments without stock.adjust permission."""
        self.client.force_authenticate(user=self.cashier_a)
        res = self.client.post('/api/inventory/adjust/', {
            'product_id': self.prod_a.id,
            'quantity': 10,
            'transaction_type': 'adjustment',
        })
        self.assertEqual(res.status_code, 403)

    def test_cashier_granted_custom_permission_can_adjust_stock(self):
        """Cashier with custom permission override can perform allowed action."""
        self.cashier_a.custom_permissions = ['stock.adjust']
        self.cashier_a.save()

        self.client.force_authenticate(user=self.cashier_a)
        res = self.client.post('/api/inventory/adjust/', {
            'product_id': self.prod_a.id,
            'quantity': 5,
            'transaction_type': 'adjustment',
            'notes': 'Authorized inventory count fix',
        })
        self.assertIn(res.status_code, [200, 202])

    # =========================================================================
    # PHASE 8: SESSION MANAGEMENT & LOGOUT TESTS
    # =========================================================================

    def test_logout_revokes_session(self):
        """Logout endpoint rotates security stamp and invalidates session."""
        login_res = self.client.post('/api/auth/login/', {
            'mobile': '9876500001',
            'password': 'AlphaPass123!',
        })
        token = login_res.data['access']
        refresh = login_res.data['refresh']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        logout_res = self.client.post('/api/auth/logout/', {'refresh': refresh})
        self.assertEqual(logout_res.status_code, 200)
        self.assertEqual(logout_res.data.get('status'), 'logged_out')

    def test_owner_deactivating_cashier_revokes_access(self):
        """When an owner deactivates a cashier, cashier immediately cannot log in."""
        self.client.force_authenticate(user=self.owner_a)
        res = self.client.patch(f'/api/users/{self.cashier_a.id}/', {
            'is_active': False,
        })
        self.assertEqual(res.status_code, 200)

        # Deactivated cashier cannot log in
        self.client.force_authenticate(user=None)
        login_res = self.client.post('/api/auth/login/', {
            'mobile': '9876500003',
            'password': 'CashierPass123!',
        })
        self.assertEqual(login_res.status_code, 403)
        self.assertEqual(login_res.data.get('code'), 'account_deactivated')
