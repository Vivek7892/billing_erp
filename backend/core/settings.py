from pathlib import Path
from datetime import timedelta

from decouple import config
import dj_database_url


# ============================================================
# BASE CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent


def origin_list(value):
    """
    Parse comma-separated CORS/CSRF origins
    in the format Django expects.
    """
    return [
        origin.strip().rstrip('/')
        for origin in value.split(',')
        if origin.strip()
    ]


SECRET_KEY = config('SECRET_KEY')

DEBUG = config(
    'DEBUG',
    default='1'
) in ('1', 'true', 'True', 'yes')


# ============================================================
# RENDER CONFIGURATION
# ============================================================

# Render sets RENDER_EXTERNAL_HOSTNAME automatically.
RENDER_EXTERNAL_HOSTNAME = config(
    'RENDER_EXTERNAL_HOSTNAME',
    default=''
).strip()


# ============================================================
# ALLOWED HOSTS
# ============================================================

ALLOWED_HOSTS = [
    host.strip()
    for host in config(
        'ALLOWED_HOSTS',
        default=(
            'localhost,'
            '127.0.0.1,'
            'billing-erp-7ga7.onrender.com'
        )
    ).split(',')
    if host.strip()
]


if (
    RENDER_EXTERNAL_HOSTNAME
    and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS
):
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)


# ============================================================
# INSTALLED APPS
# ============================================================

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',

    # Local apps
    'api',
]


# ============================================================
# MIDDLEWARE
# ============================================================

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',

    'django.middleware.security.SecurityMiddleware',

    'whitenoise.middleware.WhiteNoiseMiddleware',

    'django.contrib.sessions.middleware.SessionMiddleware',

    'django.middleware.common.CommonMiddleware',

    'django.middleware.csrf.CsrfViewMiddleware',

    'django.contrib.auth.middleware.AuthenticationMiddleware',

    'django.contrib.messages.middleware.MessageMiddleware',

    'django.middleware.clickjacking.XFrameOptionsMiddleware',

    'core.middleware.TenantMiddleware',
]


# ============================================================
# URL / WSGI
# ============================================================

ROOT_URLCONF = 'core.urls'

WSGI_APPLICATION = 'core.wsgi.application'


# ============================================================
# TEMPLATES
# ============================================================

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',

        'DIRS': [],

        'APP_DIRS': True,

        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',

                'django.template.context_processors.request',

                'django.contrib.auth.context_processors.auth',

                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


# ============================================================
# DATABASE
# ============================================================
#
# LOCAL DEVELOPMENT
# -----------------
# Set:
#
# USE_SQLITE=true
#
# Django will use:
#     db.sqlite3
#
#
# PRODUCTION / SUPABASE
# ---------------------
# Set:
#
# USE_SQLITE=false
#
# DATABASE_URL=postgresql://...
#
# Django will use Supabase PostgreSQL.
#
# IMPORTANT:
# DATABASE_URL should contain the connection string
# copied directly from:
#
# Supabase Dashboard
#     → Project
#     → Connect
#     → Session Pooler / PostgreSQL connection string
#
# ============================================================

USE_SQLITE = config(
    'USE_SQLITE',
    default=False,
    cast=bool
)


if USE_SQLITE:

    # --------------------------------------------------------
    # LOCAL SQLITE DATABASE
    # --------------------------------------------------------

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

else:

    # --------------------------------------------------------
    # SUPABASE POSTGRESQL DATABASE
    # --------------------------------------------------------

    DATABASE_URL = config(
        'DATABASE_URL',
        default=''
    ).strip()

    if not DATABASE_URL:
        raise RuntimeError(
            'DATABASE_URL is not configured. '
            'Set DATABASE_URL to your Supabase PostgreSQL '
            'connection string.'
        )

    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
            ssl_require=True,
        )
    }


# ============================================================
# CUSTOM USER MODEL
# ============================================================

AUTH_USER_MODEL = 'api.User'


# ============================================================
# PASSWORD VALIDATION
# ============================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': (
            'django.contrib.auth.password_validation.'
            'MinimumLengthValidator'
        ),
    },
]


# ============================================================
# INTERNATIONALIZATION
# ============================================================

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Kolkata'

USE_I18N = True

USE_TZ = True


# ============================================================
# STATIC FILES
# ============================================================

STATIC_URL = '/static/'

STATIC_ROOT = BASE_DIR / 'staticfiles'


STORAGES = {
    'staticfiles': {
        'BACKEND': (
            'whitenoise.storage.'
            'CompressedManifestStaticFilesStorage'
        ),
    },
}


# ============================================================
# MEDIA FILES
# ============================================================

MEDIA_URL = '/api/media/'

MEDIA_ROOT = BASE_DIR / 'media'


# ============================================================
# SUPABASE STORAGE
# ============================================================
#
# These variables are for Supabase Storage.
# They are separate from DATABASE_URL.
#
# DATABASE_URL
#     → Supabase PostgreSQL
#
# SUPABASE_URL
#     → Supabase project URL
#
# SUPABASE_SECRET_KEY
#     → Supabase server-side secret key
#
# SUPABASE_SHOP_LOGO_BUCKET
#     → Storage bucket for shop logos
#
# ============================================================

SUPABASE_URL = config(
    'SUPABASE_URL',
    default=''
)


SUPABASE_SECRET_KEY = config(
    'SUPABASE_SECRET_KEY',
    default=''
)


SUPABASE_SHOP_LOGO_BUCKET = config(
    'SUPABASE_SHOP_LOGO_BUCKET',
    default='billing_shop_logo'
)


# ============================================================
# DEFAULT PRIMARY KEY
# ============================================================

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ============================================================
# DJANGO REST FRAMEWORK
# ============================================================

REST_FRAMEWORK = {

    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),

    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),

    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',

        'rest_framework.filters.SearchFilter',

        'rest_framework.filters.OrderingFilter',
    ],

    'DEFAULT_PAGINATION_CLASS': (
        'rest_framework.pagination.PageNumberPagination'
    ),

    'PAGE_SIZE': 50,
}


# ============================================================
# JWT CONFIGURATION
# ============================================================

SIMPLE_JWT = {

    'ACCESS_TOKEN_LIFETIME': timedelta(
        hours=8
    ),

    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=7
    ),
}


# ============================================================
# CORS CONFIGURATION
# ============================================================

CORS_ALLOWED_ORIGINS = origin_list(
    config(
        'CORS_ALLOWED_ORIGINS',
        default=(
            'http://localhost:3000,'
            'http://127.0.0.1:3000,'
            'https://billing-erp-7ga7.onrender.com'
        )
    )
)


CORS_ALLOW_CREDENTIALS = True


# ============================================================
# CSRF CONFIGURATION
# ============================================================

CSRF_TRUSTED_ORIGINS = origin_list(
    config(
        'CSRF_TRUSTED_ORIGINS',
        default=(
            'https://billing-erp-7ga7.onrender.com'
        )
    )
)


# ============================================================
# RENDER URL
# ============================================================

RENDER_URL = 'https://billing-erp-7ga7.onrender.com'


# Add Render URL to CORS if not already present.
if RENDER_URL not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(RENDER_URL)


# Add Render URL to CSRF trusted origins if not already present.
if RENDER_URL not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(RENDER_URL)


# ============================================================
# HTTPS / SECURITY
# ============================================================

SECURE_PROXY_SSL_HEADER = (
    'HTTP_X_FORWARDED_PROTO',
    'https'
)


SECURE_SSL_REDIRECT = config(
    'SECURE_SSL_REDIRECT',
    default=not DEBUG,
    cast=bool
)


SESSION_COOKIE_SECURE = not DEBUG

CSRF_COOKIE_SECURE = not DEBUG


# ============================================================
# HSTS
# ============================================================

SECURE_HSTS_SECONDS = config(
    'SECURE_HSTS_SECONDS',
    default=0 if DEBUG else 31536000,
    cast=int
)


SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    SECURE_HSTS_SECONDS > 0
)


SECURE_HSTS_PRELOAD = False