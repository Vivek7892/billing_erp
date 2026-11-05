from api.models import Setting


class ReportBusinessService:
    @staticmethod
    def get_setting(business, key, default=''):
        try:
            if business:
                setting = Setting.objects.filter(business=business, key=key).first()
            else:
                setting = Setting.objects.filter(key=key).first()
            return setting.value if setting and setting.value else default
        except Exception:
            return default

    @classmethod
    def get_profile(cls, request_user=None, business=None):
        if not business and request_user:
            business = getattr(request_user, 'business', None)

        shop_name = cls.get_setting(business, 'shop_name', getattr(business, 'name', '') or 'ShopEase POS')
        shop_address = cls.get_setting(business, 'shop_address', getattr(business, 'address', '') or '')
        shop_phone = cls.get_setting(business, 'shop_phone', getattr(business, 'mobile', '') or '')
        shop_email = cls.get_setting(business, 'shop_email', getattr(business, 'email', '') or '')
        shop_gstin = cls.get_setting(business, 'shop_gstin', getattr(business, 'gstin', '') or '')
        shop_logo = cls.get_setting(business, 'shop_logo', '')
        branch_id = getattr(business, 'shop_id', '') or (str(getattr(business, 'id', '')) if business else '')

        full_name = ''
        user_role = ''
        if request_user:
            full_name = getattr(request_user, 'get_full_name', lambda: '')() or getattr(request_user, 'username', '')
            user_role = getattr(request_user, 'role', '') or getattr(request_user, 'role_name', '')
        if full_name and user_role:
            printed_by = f"{full_name} ({user_role.title()})"
        elif full_name:
            printed_by = full_name
        else:
            printed_by = 'Administrator'

        return {
            'shop_name': (shop_name or 'ShopEase POS').strip(),
            'shop_address': (shop_address or '').strip(),
            'shop_phone': (shop_phone or '').strip(),
            'shop_email': (shop_email or '').strip(),
            'shop_gstin': (shop_gstin or '').strip(),
            'shop_logo': shop_logo,
            'branch_id': branch_id,
            'printed_by': printed_by,
            'user_role': user_role.title() if user_role else '',
        }
