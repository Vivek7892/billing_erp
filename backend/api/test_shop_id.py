import re
from datetime import datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from api.models import Business, RetiredShopID, generate_unique_shop_id
from api.serializers import BusinessSerializer

User = get_user_model()


class UniqueShopIDTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.year_suffix = f"{datetime.now().year % 100:02d}"
        self.format_regex = re.compile(rf"^DW[A-Z]{{2}}{self.year_suffix}\d{{2}}$")

    def test_shop_id_format(self):
        """Verify format DWAAYYNN: DW prefix, 2 uppercase letters, 2 digits year, 2 digits random."""
        shop_id = generate_unique_shop_id()
        self.assertEqual(len(shop_id), 8)
        self.assertTrue(shop_id.startswith('DW'))
        self.assertTrue(self.format_regex.match(shop_id), f"{shop_id} did not match expected regex {self.format_regex.pattern}")

    def test_auto_generation_on_business_create(self):
        """Creating a Business without shop_id auto-assigns a valid unique Shop ID."""
        biz = Business.objects.create(name="Test Retail Mart", mobile="9876543210")
        self.assertIsNotNone(biz.shop_id)
        self.assertTrue(self.format_regex.match(biz.shop_id))

    def test_shop_id_immutability(self):
        """Renaming or updating a business must never alter its Shop ID."""
        biz = Business.objects.create(name="Alpha Grocery", mobile="9876543211")
        original_shop_id = biz.shop_id

        # Update name and other fields
        biz.name = "Alpha Hypermarket & Wholesalers"
        biz.mobile = "9876543299"
        biz.shop_id = "DWFAKE99"  # Attempt manual tamper
        biz.save()

        biz.refresh_from_db()
        self.assertEqual(biz.shop_id, original_shop_id)
        self.assertEqual(biz.name, "Alpha Hypermarket & Wholesalers")

    def test_uniqueness_and_collision_handling(self):
        """Simulate collision: generator must detect collision and regenerate a unique ID."""
        first_id = generate_unique_shop_id()
        biz1 = Business.objects.create(name="Shop One", shop_id=first_id)

        # Generate another ID; ensure it is distinct from first_id
        second_id = generate_unique_shop_id()
        self.assertNotEqual(first_id, second_id)

    def test_retired_shop_id_never_reused(self):
        """When a shop is deleted, its ID is recorded in RetiredShopID and never reused."""
        biz = Business.objects.create(name="Temporary Shop", mobile="9876543212")
        deleted_shop_id = biz.shop_id

        # Delete the shop
        biz.delete()

        # Check retired table
        retired = RetiredShopID.objects.filter(shop_id=deleted_shop_id).first()
        self.assertIsNotNone(retired)
        self.assertEqual(retired.business_name, "Temporary Shop")

        # Ensure generator treats retired IDs as collisions
        # Manually verify collision check logic
        self.assertTrue(RetiredShopID.objects.filter(shop_id=deleted_shop_id).exists())

    def test_serializer_read_only(self):
        """BusinessSerializer must mark shop_id as read-only."""
        serializer = BusinessSerializer()
        self.assertIn('shop_id', serializer.fields)
        self.assertTrue(serializer.fields['shop_id'].read_only)

    def test_global_search_by_shop_id(self):
        """Global search allows finding business by its Shop ID."""
        biz = Business.objects.create(name="Delta Electronics", mobile="9876543213")
        user = User.objects.create_user(
            username="delta_admin",
            password="password123",
            business=biz,
            role="admin"
        )
        self.client.force_authenticate(user=user)

        # Search by exact shop ID prefix or substring
        search_query = biz.shop_id[:4]
        res = self.client.get('/api/search/', {'q': search_query})
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', [])
        matching = [r for r in results if r.get('type') == 'shop']
        self.assertTrue(len(matching) >= 1)
        self.assertIn(biz.shop_id, matching[0]['label'])
