"""
Tenant middleware — resolves the current Business from:
  1. X-Business-ID request header  (preferred for API clients)
  2. Subdomain: shop1.yourapp.com  (for subdomain-based routing)

Sets request.tenant_business so views can use it.
"""
from api.models import Business


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant_business = None

        # 1. Explicit header (used by frontend after login)
        business_id = request.headers.get('X-Business-ID')
        if business_id:
            try:
                request.tenant_business = Business.objects.get(pk=business_id)
            except (Business.DoesNotExist, Exception):
                pass

        return self.get_response(request)
