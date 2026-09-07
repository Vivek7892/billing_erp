from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.http import JsonResponse
from decouple import config
from api.views import PublicInvoiceShortLinkView


def healthcheck(request):
    return JsonResponse({'status': 'ok'})

# API VERSIONING DECISION
# The API is served at /api/ with no version prefix.
# A /api/v2/ prefix will be introduced only when a breaking change requires it
# (e.g. a response shape change that cannot be made backward-compatible).
# Until that point, maintaining a duplicate prefix that routes to identical
# code is misleading and adds no value.
urlpatterns = [
    path('', RedirectView.as_view(url=config('FRONTEND_URL', default='http://localhost:3000/'), permanent=False)),
    path('health/', healthcheck, name='healthcheck'),
    path('admin/', admin.site.urls),
    path('s/<str:code>/', PublicInvoiceShortLinkView.as_view(), name='invoice-short-link'),
    path('api/', include('api.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    from django.views.static import serve
    from django.urls import re_path
    urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT})]
