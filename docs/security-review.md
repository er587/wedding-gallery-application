# Security Review

**Date**: March 2026
**Scope**: Full application stack (Django backend + React frontend)
**Codebase**: Django 5.0.2, DRF 3.14.0, React 19.1.1, Vite 7.1.2

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 3 | Action required before production |
| High | 3 | Should fix before going live |
| Medium | 2 | Fix in next sprint |
| Low | 2 | Monitor / nice-to-have |

---

## Critical Issues

### 1. Email Verification is Broken

**Location**: `images/views.py:931`
**Severity**: Critical (feature completely non-functional)

The `verify_email` view attempts to look up a token by the raw value:

```python
token_obj = EmailVerificationToken.objects.get(token=token)  # Line 931
```

But the `EmailVerificationToken` model has no `token` field - it stores `token_hash` (a bcrypt hash of the raw token). This query will raise a `FieldError` or `DoesNotExist` every time.

The password reset flow correctly uses `PasswordResetToken.verify_token(raw_token)` which iterates tokens and calls `check_password()`. The email verification view should do the same.

**Fix**:
```python
# Replace line 931 with:
token_obj = EmailVerificationToken.verify_token(token)
if token_obj is None:
    return Response({'error': 'Invalid verification token'}, status=400)
```

---

### 2. Rate Limiting Not Implemented

**Location**: All views in `images/views.py`
**Severity**: Critical (brute force attacks possible)

`django-ratelimit==4.1.0` is installed in `requirements.txt` but **never applied** to any view. No `@ratelimit()` decorators exist anywhere in the codebase.

**Vulnerable endpoints**:
- `POST /api/auth/login/` - Password brute force
- `POST /api/auth/register/` - Registration spam
- `POST /api/auth/request-password-reset/` - Email enumeration / email spam
- `POST /api/auth/verify-email/` - Token brute force
- `POST /api/auth/reset-password/` - Token brute force

**Fix**: Add `@ratelimit` decorators to authentication endpoints:
```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key='ip', rate='5/m', method='POST', block=True)
@api_view(['POST'])
def login_view(request):
    ...

@ratelimit(key='ip', rate='3/m', method='POST', block=True)
@api_view(['POST'])
def request_password_reset(request):
    ...
```

---

### 3. No Backend File Upload Validation

**Location**: `images/serializers.py:173-204` (ImageCreateSerializer)
**Severity**: Critical (arbitrary file upload)

The backend has no server-side validation of uploaded file types. The only validation is on the frontend (`file.type.startsWith('image/')`), which can be trivially bypassed.

An attacker could upload:
- Executable files disguised as images
- HTML files that could be served back for XSS
- Excessively large files (no per-file size check beyond Django's global `FILE_UPLOAD_MAX_MEMORY_SIZE`)

**Fix**: Add validation in `ImageCreateSerializer`:
```python
import os
from django.conf import settings

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif'}

def validate_image_file(self, value):
    ext = os.path.splitext(value.name)[1].lower().lstrip('.')
    if ext not in ALLOWED_EXTENSIONS:
        raise serializers.ValidationError(f"File type '.{ext}' not allowed.")
    if value.size > 26 * 1024 * 1024:  # 26MB
        raise serializers.ValidationError("File too large (max 26MB).")
    return value
```

---

## High Issues

### 4. Token Verification O(n) Complexity

**Location**: `images/models.py:561-566` (EmailVerificationToken) and `models.py:612-615` (PasswordResetToken)
**Severity**: High (performance degradation + timing attack vector)

Both `verify_token()` methods iterate **all** unexpired/unused tokens and call `check_password()` (bcrypt) on each one:

```python
for token_obj in cls.objects.filter(is_used=False, expires_at__gt=timezone.now()):
    if check_password(raw_token, token_obj.token_hash):
        return token_obj
```

Each `check_password()` call takes ~100-300ms (bcrypt is intentionally slow). With 100 outstanding tokens, verification could take 10-30 seconds.

**Fix**: Store a token prefix (first 8 characters, unhashed) alongside the hash for quick lookup:
```python
# In generate_token:
token_prefix = raw_token[:8]
token_obj = cls.objects.create(user=user, token_prefix=token_prefix, token_hash=token_hash, ...)

# In verify_token:
candidates = cls.objects.filter(token_prefix=raw_token[:8], is_used=False, expires_at__gt=timezone.now())
for token_obj in candidates:
    if check_password(raw_token, token_obj.token_hash):
        return token_obj
```

---

### 5. Error Messages Leak System Information

**Location**: `images/views.py:906` and `views.py:1089`
**Severity**: High (information disclosure)

Two error handlers expose internal details:

1. **Line 906** - Email sending failure:
   ```python
   f'Failed to send email: {str(email_error)}'
   ```
   Leaks SMTP server details, connection errors, authentication failures.

2. **Line 1089** - Frontend serving error:
   ```python
   f"Error serving frontend: {str(e)}"
   ```
   Leaks file system paths and server configuration.

**Fix**: Return generic error messages to the client. Log details server-side:
```python
import logging
logger = logging.getLogger(__name__)

# Line 906:
logger.error(f'Failed to send email: {email_error}')
return Response({'error': 'Failed to send email. Please try again later.'}, status=500)

# Line 1089:
logger.error(f'Error serving frontend: {e}')
return HttpResponse('Server error', status=500)
```

---

### 6. Aggressive Cache Invalidation

**Location**: `images/views.py:112` and `views.py:137`
**Severity**: High (performance / availability)

Every image create or delete calls `cache.clear()`, which wipes the **entire** cache (not just image-related entries). In a multi-feature application, this unnecessarily invalidates unrelated cached data.

**Fix**: Use targeted cache invalidation:
```python
from django.core.cache import cache

def invalidate_image_cache():
    # Delete only image list cache keys
    # With LocMemCache, use cache key versioning or a cache prefix approach
    cache.delete_many([key for key in cache._cache if 'image' in key])
```

Or better: switch to Redis and use cache key patterns.

---

## Medium Issues

### 7. Weak Password Enforcement on Backend

**Location**: `images/views.py:632-635`
**Severity**: Medium (weak passwords accepted)

The `change_password` view only checks `len(new_password) >= 8`:

```python
if len(new_password) < 8:
    return Response({'error': 'Password must be at least 8 characters'}, ...)
```

Django's password validators are configured in `settings.py` (UserAttributeSimilarityValidator, MinimumLengthValidator, CommonPasswordValidator, NumericPasswordValidator) but are **not applied** in this view.

**Fix**:
```python
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

try:
    validate_password(new_password, user=request.user)
except ValidationError as e:
    return Response({'error': e.messages}, status=400)
```

---

### 8. LocMemCache Not Suitable for Production

**Location**: `django_project/settings.py:167-175`
**Severity**: Medium (cache ineffectiveness in production)

The application uses `django.core.cache.backends.locmem.LocMemCache`. In a Gunicorn multi-worker deployment, each worker has its own cache - cache writes in one worker are invisible to others. This means:
- Cache hit rate drops proportionally to worker count
- `cache.clear()` only clears one worker's cache

**Fix**: Use Redis or Memcached for production:
```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/1'),
    }
}
```

---

## Low Issues

### 9. Missing Explicit Database Indexes

**Location**: `images/models.py` (all models)
**Severity**: Low (Django auto-creates FK indexes)

Django automatically creates indexes on ForeignKey fields, but the application could benefit from additional indexes for common query patterns:
- `Image.uploaded_at` (used for ordering)
- `Comment.created_at` (used for ordering)
- `InvitationCode.code` (already unique, so indexed)
- Composite index on `Like(user, image)` (already covered by `unique_together`)

---

### 10. CORS Allows All Origins in Debug Mode

**Location**: `django_project/settings.py:238`
**Severity**: Low (development only, but risky if misconfigured)

```python
CORS_ALLOW_ALL_ORIGINS = env.bool('CORS_ALLOW_ALL_ORIGINS') if 'CORS_ALLOW_ALL_ORIGINS' in os.environ else DEBUG
```

When `DEBUG=True`, CORS allows all origins. If DEBUG is accidentally left on in production, any origin could make authenticated requests.

**Mitigation**: The existing production safety check at `settings.py:280-281` catches insecure SECRET_KEY in production, but doesn't validate DEBUG status.

---

## Positive Security Findings

These security measures are correctly implemented:

| Area | Implementation | Location |
|------|---------------|----------|
| **CSRF Protection** | Middleware enabled, frontend sends X-CSRFToken header from cookie | `settings.py:115`, `api.js:66-71` |
| **Password Hashing** | Django's PBKDF2 (default, strong) | Built-in |
| **Token Storage** | Tokens hashed with `make_password()`, never stored as plaintext | `models.py:548, 595` |
| **Production HTTPS** | `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS=31536000` | `settings.py:268-273` |
| **Secure Cookies** | `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True` in production | `settings.py:274-276` |
| **Clickjacking Protection** | `X_FRAME_OPTIONS = 'DENY'` in production | `settings.py:277` |
| **XSS Headers** | `SECURE_BROWSER_XSS_FILTER=True`, `SECURE_CONTENT_TYPE_NOSNIFF=True` | `settings.py:269-270` |
| **SQL Injection** | ORM-only queries, no raw SQL | All views |
| **XSS in React** | JSX auto-escapes `{variable}` output, no `dangerouslySetInnerHTML` | All components |
| **SECRET_KEY Validation** | Production check prevents insecure default key | `settings.py:280-281` |
| **No Hardcoded Secrets** | All sensitive config via environment variables | `settings.py`, `.env.example` |
| **Owner-Only Deletion** | Images can only be deleted by their uploader | `views.py:130` |
| **Invitation-Only Registration** | Requires valid invitation code to register | `views.py` register view |
| **Previous Token Invalidation** | Password reset invalidates old tokens before creating new one | `models.py:598` |
