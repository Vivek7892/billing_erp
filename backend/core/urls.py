from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.http import JsonResponse
from decouple import config


def healthcheck(request):
    return JsonResponse({'status': 'ok'})

urlpatterns = [
    path('', RedirectView.as_view(url=config('FRONTEND_URL', default='http://localhost:3000/'), permanent=False)),
    path('health/', healthcheck, name='healthcheck'),
    path('admin/', admin.site.urls),
    # v1 — kept for backward compatibility
    path('api/', include('api.urls')),
    # v2 — same urls module; version header/prefix signals v2 to clients
    path('api/v2/', include(('api.urls', 'v2'))),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    from django.views.static import serve
    from django.urls import re_path
    urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT})]
