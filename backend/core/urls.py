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
    path('api/', include('api.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    from django.views.static import serve
    from django.urls import re_path
    urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT})]
