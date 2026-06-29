"""
Django settings for django_project project.

Wedding Gallery production deployment.
"""

import os
import dj_database_url
from pathlib import Path
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

env = environ.Env(
    DEBUG=(bool, False),
    SECRET_KEY=(str, ''),
    ALLOWED_HOSTS=(list, ['localhost', '127.0.0.1']),
    CSRF_TRUSTED_ORIGINS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
    CORS_ALLOW_ALL_ORIGINS=(bool, False),
    CORS_ALLOW_CREDENTIALS=(bool, True),
    DATABASE_URL=(str, ''),
    REDIS_URL=(str, ''),
    EMAIL_BACKEND=(str, 'django.core.mail.backends.console.EmailBackend'),
    EMAIL_HOST=(str, 'localhost'),
    EMAIL_PORT=(int, 587),
    EMAIL_USE_TLS=(bool, True),
    EMAIL_HOST_USER=(str, ''),
    EMAIL_HOST_PASSWORD=(str, ''),
    DEFAULT_FROM_EMAIL=(str, ''),
    SERVER_EMAIL=(str, 'admin@localhost'),
    FRONTEND_URL=(str, 'http://localhost:5173'),
    STATIC_ROOT=(str, str(BASE_DIR / 'staticfiles')),
    MEDIA_ROOT=(str, str(BASE_DIR / 'media')),
)

env.read_env(BASE_DIR / '.env')

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

DEBUG = env('DEBUG')

SECRET_KEY = env('SECRET_KEY')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'django-insecure-dev-only-do-not-use-in-prod'
    else:
        raise Exception("Production deployment requires SECRET_KEY in environment.")

ALLOWED_HOSTS = env('ALLOWED_HOSTS')
CSRF_TRUSTED_ORIGINS = env('CSRF_TRUSTED_ORIGINS')

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
    'rest_framework',
    'corsheaders',
    'easy_thumbnails',
    'django_q',
    'images',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'images.middleware.MediaCacheMiddleware',
]

ROOT_URLCONF = 'django_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
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

WSGI_APPLICATION = 'django_project.wsgi.application'

# ---------------------------------------------------------------------------
# Database
# DATABASE_URL takes precedence; falls back to local SQLite if unset.
# ---------------------------------------------------------------------------

database_url = env('DATABASE_URL')
if database_url:
    DATABASES = {
        'default': dj_database_url.parse(database_url, conn_max_age=600)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ---------------------------------------------------------------------------
# Cache
# Redis if REDIS_URL is set, otherwise local memory.
# ---------------------------------------------------------------------------

if env('REDIS_URL'):
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': env('REDIS_URL'),
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
            'OPTIONS': {'MAX_ENTRIES': 1000},
        }
    }

# ---------------------------------------------------------------------------
# Django-Q2 background task queue
# Uses the database as broker; run with: python manage.py qcluster
# ---------------------------------------------------------------------------

Q_CLUSTER = {
    'name': 'wedding-gallery',
    'workers': 2,
    'timeout': 300,
    'retry': 600,
    'orm': 'default',
    'catch_up': False,
}

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & media
# ---------------------------------------------------------------------------

STATIC_URL = '/static/'
STATIC_ROOT = env('STATIC_ROOT')
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'frontend', 'dist')]
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = env('MEDIA_ROOT')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.SessionAuthentication'],
}

# ---------------------------------------------------------------------------
# Rate limiting
# Uses X-Real-IP set by nginx (REMOTE_ADDR is empty over Unix sockets).
# ---------------------------------------------------------------------------

RATELIMIT_VIEW = 'images.views.ratelimited_view'


def _client_ip(request):
    """Resolve the client IP for rate limiting.

    Production runs behind nginx over a unix socket, where REMOTE_ADDR is empty
    and the real client IP arrives in X-Real-IP. Fall back to REMOTE_ADDR for
    test/local/direct requests so rate limiting never raises ImproperlyConfigured.
    """
    return (request.META.get('HTTP_X_REAL_IP')
            or request.META.get('REMOTE_ADDR')
            or '0.0.0.0')


RATELIMIT_IP_META_KEY = _client_ip

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

CORS_ALLOW_ALL_ORIGINS = env('CORS_ALLOW_ALL_ORIGINS')
if not DEBUG and CORS_ALLOW_ALL_ORIGINS:
    import warnings
    warnings.warn("CORS_ALLOW_ALL_ORIGINS=True with DEBUG=False is insecure. Overriding to False.")
    CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOWED_ORIGINS = env('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_CREDENTIALS = env('CORS_ALLOW_CREDENTIALS')

# ---------------------------------------------------------------------------
# TLS / production hardening
# nginx terminates TLS; trust X-Forwarded-Proto.
# ---------------------------------------------------------------------------

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    X_FRAME_OPTIONS = 'DENY'

# ---------------------------------------------------------------------------
# Easy-thumbnails
# ---------------------------------------------------------------------------

THUMBNAIL_ALIASES = {
    '': {
        'square_160':  {'size': (160, 160),  'crop': True,  'quality': 75},
        'square_320':  {'size': (320, 320),  'crop': True,  'quality': 75},
        'square_640':  {'size': (640, 640),  'crop': True,  'quality': 78},
        'width_480':   {'size': (480, 0),    'crop': False, 'quality': 78},
        'width_960':   {'size': (960, 0),    'crop': False, 'quality': 78},
        'width_1440':  {'size': (1440, 0),   'crop': False, 'quality': 80},
    },
}

THUMBNAIL_DEFAULT_OPTIONS = {'subsampling': 2}
THUMBNAIL_PRESERVE_EXTENSIONS = False
THUMBNAIL_PRESERVE_FORMAT = True
THUMBNAIL_HIGH_RESOLUTION = True
THUMBNAIL_BASEDIR = 'thumbnails'
THUMBNAIL_EXTENSION = 'webp'

THUMBNAIL_PROCESSORS = [
    'easy_thumbnails.processors.colorspace',
    'easy_thumbnails.processors.autocrop',
    'images.thumbnail_processors.smart_crop.face_aware_crop',
    'easy_thumbnails.processors.scale_and_crop',
    'easy_thumbnails.processors.filters',
]

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------

EMAIL_BACKEND = env('EMAIL_BACKEND')
EMAIL_HOST = env('EMAIL_HOST')
EMAIL_PORT = env('EMAIL_PORT')
EMAIL_USE_TLS = env('EMAIL_USE_TLS')
EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL') or EMAIL_HOST_USER
SERVER_EMAIL = env('SERVER_EMAIL')

FRONTEND_URL = env('FRONTEND_URL')

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

# LOG_DIR defaults to the production path but is overridable; if it isn't
# writable (local dev, CI, OSS installs), fall back to console logging instead
# of crashing at import time.
LOG_DIR = env('LOG_DIR', default='/var/log/wedding-gallery')
try:
    os.makedirs(LOG_DIR, exist_ok=True)
    _log_to_file = os.access(LOG_DIR, os.W_OK)
except OSError:
    _log_to_file = False

_LOG_FORMATTERS = {
    'verbose': {
        'format': '{asctime} [{levelname}] {name}: {message}',
        'style': '{',
    },
}

if _log_to_file:
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': _LOG_FORMATTERS,
        'handlers': {
            'django_file': {
                'level': 'INFO',
                'class': 'logging.handlers.RotatingFileHandler',
                'filename': os.path.join(LOG_DIR, 'django.log'),
                'maxBytes': 10 * 1024 * 1024,
                'backupCount': 5,
                'formatter': 'verbose',
            },
            'request_file': {
                'level': 'WARNING',
                'class': 'logging.handlers.RotatingFileHandler',
                'filename': os.path.join(LOG_DIR, 'django-requests.log'),
                'maxBytes': 10 * 1024 * 1024,
                'backupCount': 5,
                'formatter': 'verbose',
            },
        },
        'loggers': {
            'django': {'handlers': ['django_file'], 'level': 'INFO', 'propagate': False},
            'django.request': {'handlers': ['request_file'], 'level': 'WARNING', 'propagate': False},
            'django.security': {'handlers': ['django_file'], 'level': 'WARNING', 'propagate': False},
        },
    }
else:
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': _LOG_FORMATTERS,
        'handlers': {
            'console': {'level': 'INFO', 'class': 'logging.StreamHandler', 'formatter': 'verbose'},
        },
        'loggers': {
            'django': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
            'django.request': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
            'django.security': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        },
    }
