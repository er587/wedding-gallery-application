# Backend Models & API Reference

## Overview

The wedding website backend is built with Django 5.0.2 and Django REST Framework 3.14.0. It provides a photo/video gallery with invitation-based registration, role-based permissions, face-aware thumbnails, comments, likes, and tagging.

**Database**: SQLite3 (development) / PostgreSQL (production via `DATABASE_URL`)

---

## Data Models

All models are defined in `images/models.py`.

### 1. UserProfile

Extends Django's built-in `User` model via a OneToOne relationship. Controls what actions a user can perform in the gallery.

| Field | Type | Description |
|-------|------|-------------|
| `user` | OneToOneField(User) | Link to Django User. `related_name='profile'` |
| `role` | CharField(10) | `'full'` or `'memory'`. Default: `'full'` |
| `created_at` | DateTimeField | Auto-set on creation |

**Role Permissions:**

| Permission | Full User | Memory User |
|------------|-----------|-------------|
| `can_upload_images` | Yes | No |
| `can_delete_images` | Yes | No |
| `can_comment` | Yes | Yes |

**Auto-creation**: A `post_save` signal on `User` automatically creates a `UserProfile` for every new user (see signals at `models.py:436-452`).

---

### 2. Image

Core gallery model supporting both uploaded photos and embedded Vimeo videos.

| Field | Type | Description |
|-------|------|-------------|
| `title` | CharField(200) | Required title |
| `description` | TextField | Optional description (blank allowed) |
| `image_file` | ImageField | Photo upload. Path: `images/<username>/<timestamp>_<filename>` |
| `thumbnail` | ImageField | Auto-generated thumbnail. Path: `images/<username>/thumbnails/<timestamp>_<filename>` |
| `cover_image` | ImageField | Optional manual cover for videos (overrides Vimeo thumbnail) |
| `vimeo_url` | URLField | Vimeo embed URL for domain-restricted videos |
| `face_x` | FloatField | Face center X coordinate, normalized 0-1 |
| `face_y` | FloatField | Face center Y coordinate, normalized 0-1 |
| `face_width` | FloatField | Face bounding box width, normalized 0-1 |
| `face_height` | FloatField | Face bounding box height, normalized 0-1 |
| `uploader` | ForeignKey(User) | User who uploaded. `related_name='uploaded_images'` |
| `tags` | ManyToManyField(Tag) | Associated tags. `related_name='images'` |
| `uploaded_at` | DateTimeField | Auto-set on creation |
| `updated_at` | DateTimeField | Auto-updated on save |

**Ordering**: `-uploaded_at` (newest first)

**Properties**:
- `is_video` - Returns `True` if `vimeo_url` is set

**Save Behavior** (`models.py:97-123`):
On first save (new image), three background threads may launch:
1. **Vimeo thumbnail fetch** - If `vimeo_url` is set and no thumbnail exists, fetches via Vimeo oEmbed API with domain Referer header
2. **Face detection** - If `image_file` is set and no face coordinates exist, runs OpenCV Haar cascade detection, stores normalized coordinates
3. **Legacy thumbnail generation** - If `image_file` exists but no thumbnail, creates a 300x300 smart-cropped JPEG (face-centered or center-cropped)

All three use `threading.Thread(daemon=True)` to prevent blocking the HTTP response.

**Thumbnail Pipeline**:
- **easy-thumbnails** generates responsive sizes at serialization time (configured in `settings.py`)
- Face coordinates are passed to the `face_aware_crop` processor for smart cropping
- Three sizes served to frontend: `square_320`, `square_640`, `width_1440`

---

### 3. Comment

Threaded comment system supporting one level of nesting (comments and replies).

| Field | Type | Description |
|-------|------|-------------|
| `image` | ForeignKey(Image) | Parent image. `related_name='comments'` |
| `author` | ForeignKey(User) | Comment author. `related_name='comments'` |
| `content` | TextField | Comment text |
| `parent` | ForeignKey(self, null) | Parent comment for replies. `related_name='replies'` |
| `created_at` | DateTimeField | Auto-set on creation |
| `updated_at` | DateTimeField | Auto-updated on save |

**Ordering**: `created_at` (oldest first)

**Properties**:
- `is_reply` - Returns `True` if `parent` is not None

---

### 4. Tag

Simple categorization model for organizing gallery content.

| Field | Type | Description |
|-------|------|-------------|
| `name` | CharField(50, unique) | Tag name |
| `created_at` | DateTimeField | Auto-set on creation |

**Ordering**: `name` (alphabetical)

**Admin Features**: Supports CSV import/export for bulk tag management.

**Note**: Tags can only be created by admins. When users tag images, they select from existing tags only (non-existent tags are silently skipped).

---

### 5. Like

User favorites/likes system with uniqueness constraint.

| Field | Type | Description |
|-------|------|-------------|
| `user` | ForeignKey(User) | User who liked. `related_name='likes'` |
| `image` | ForeignKey(Image) | Liked image. `related_name='likes'` |
| `created_at` | DateTimeField | Auto-set on creation |

**Constraints**: `unique_together = ['user', 'image']` - prevents duplicate likes

**Ordering**: `-created_at` (newest first)

---

### 6. InvitationCode

Controls user registration via admin-generated invitation codes. Each code assigns a role to the registering user.

| Field | Type | Description |
|-------|------|-------------|
| `code` | CharField(20, unique) | 8-character alphanumeric code (uppercase + digits) |
| `role` | CharField(10) | `'full'` or `'memory'`. Assigned to user on registration |
| `is_active` | BooleanField | Whether code can be used. Default: `True` |
| `usage_count` | IntegerField | Number of times used. Default: `0` |
| `created_by` | ForeignKey(User) | Admin who created the code |
| `created_at` | DateTimeField | Auto-set on creation |
| `last_used_at` | DateTimeField(null) | Last usage timestamp |
| `notes` | TextField | Admin notes (blank allowed) |

**Ordering**: `-created_at` (newest first)

**Code Generation** (`generate_code()`): Generates unique 8-character codes using `secrets.choice(string.ascii_uppercase + string.digits)`.

**Note**: Codes are reusable (multi-use) - `is_active` controls availability, `usage_count` tracks usage.

---

### 7. EmailVerificationToken

Handles email verification for the password recovery flow.

| Field | Type | Description |
|-------|------|-------------|
| `user` | ForeignKey(User) | Token owner. `related_name='email_verification_tokens'` |
| `token_hash` | CharField(128, unique) | Hashed token (via `make_password()`) |
| `created_at` | DateTimeField | Auto-set on creation |
| `expires_at` | DateTimeField | Expiry: 24 hours from creation |
| `is_used` | BooleanField | Whether token has been consumed |

**Token Flow**:
1. `generate_token(user)` creates a `secrets.token_urlsafe(48)` token, stores its hash, returns raw token
2. Raw token is sent to user via email
3. `verify_token(raw_token)` iterates all unexpired/unused tokens, calls `check_password()` against each hash
4. On match, returns the token object for consumption

---

### 8. PasswordResetToken

Handles password reset with short-lived tokens.

| Field | Type | Description |
|-------|------|-------------|
| `user` | ForeignKey(User) | Token owner. `related_name='password_reset_tokens'` |
| `token_hash` | CharField(128, unique) | Hashed token |
| `created_at` | DateTimeField | Auto-set on creation |
| `expires_at` | DateTimeField | Expiry: 1 hour from creation |
| `is_used` | BooleanField | Whether token has been consumed |

**Token Flow**:
1. `generate_token(user)` invalidates all previous unused tokens for the user first, then creates new token
2. Raw token sent via email with reset link
3. `verify_token(raw_token)` uses same O(n) hash-checking pattern as EmailVerificationToken

---

## Entity Relationship Diagram

```
User (Django built-in)
 |-- 1:1 --> UserProfile (role, permissions)
 |-- 1:N --> Image (uploader)
 |-- 1:N --> Comment (author)
 |-- 1:N --> Like (user)
 |-- 1:N --> InvitationCode (created_by)
 |-- 1:N --> EmailVerificationToken (user)
 |-- 1:N --> PasswordResetToken (user)

Image
 |-- N:M --> Tag (via images_image_tags)
 |-- 1:N --> Comment (image)
 |-- 1:N --> Like (image)

Comment
 |-- 1:N --> Comment (parent -> replies, one level deep)
```

---

## Serializers

Defined in `images/serializers.py`.

### UserSerializer
Serializes User + profile data: `id`, `username`, `email`, `first_name`, `last_name`, `role`, `can_upload_images`, `can_delete_images`, `can_comment`.

### CommentSerializer
Includes nested `replies` via `SerializerMethodField`. Author serialized with `UserSerializer`.

### TagSerializer
Simple: `id`, `name`.

### ImageSerializer (read)
Full image representation including:
- Uploader (nested UserSerializer)
- All comments (nested CommentSerializer)
- `comment_count`, `like_count` (computed)
- `user_has_liked` (per-request)
- `thumbnail_square_320`, `thumbnail_square_640`, `thumbnail_width_1440` (generated via easy-thumbnails with face data)
- `is_video` flag
- Tags (nested TagSerializer)

### ImageCreateSerializer (write)
Accepts: `title`, `description`, `image_file`, `vimeo_url`, `cover_image`, `tag_names` (list of strings).
Validation: Either `image_file` or `vimeo_url` must be provided.

---

## API Endpoints

All endpoints defined in `images/urls.py`.

### Image Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/images/` | Public | List images with pagination (6/page). Supports `?search=`, `?tags=`, `?media_type=` filters. Cached 2 min. |
| POST | `/api/images/` | Required (full role) | Create image. Multipart form data with `image_file` or `vimeo_url`. |
| GET | `/api/images/<id>/` | Public | Image detail with comments, likes, thumbnails |
| PUT/PATCH | `/api/images/<id>/` | Required | Update image. Owner only, except tag-only updates allowed for any full user. |
| DELETE | `/api/images/<id>/` | Required | Delete image. Owner only. Deletes physical files. |
| GET | `/api/images/count/` | Public | Total image count |

### Comment Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/images/<id>/comments/` | Public | List comments for image |
| POST | `/api/images/<id>/comments/` | Required | Create comment on image |
| POST | `/api/comments/<id>/reply/` | Required | Reply to a comment |

### Like Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/images/<id>/like/` | Required | Toggle like on image (like/unlike) |
| GET | `/api/auth/liked-images/` | Required | Get current user's liked images |

### Tag Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/tags/` | Public | List all tags |

### Authentication Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/auth/csrf/` | Public | Get CSRF token (sets cookie) |
| POST | `/api/auth/login/` | Public | Login with email + password. Returns user data. |
| POST | `/api/auth/register/` | Public | Register with email, password, first/last name, invitation code |
| POST | `/api/auth/logout/` | Required | Logout (clears session) |
| GET | `/api/auth/profile/` | Required | Get current user profile |
| PUT | `/api/auth/profile/update/` | Required | Update first name, last name, email |
| POST | `/api/auth/change-password/` | Required | Change password (requires current password) |
| GET | `/api/auth/upload-count/` | Required | Get current user's upload count |

### Email & Password Reset Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/auth/send-verification/` | Public | Send email verification link |
| POST | `/api/auth/verify-email/` | Public | Verify email with token |
| POST | `/api/auth/request-password-reset/` | Public | Request password reset email |
| POST | `/api/auth/reset-password/` | Public | Reset password with token + new password |

### Cloud Storage Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/cloud/upload-url/` | Required | Get presigned upload URL |
| POST | `/api/cloud/set-acl/` | Required | Set file ACL policy |
| GET | `/api/cloud/files/` | Required | List user's uploaded files |
| GET | `/api/files/<path>` | Public | Serve protected files |

### Frontend

| Method | URL | Description |
|--------|-----|-------------|
| GET | `^(?!(api/\|media/\|admin/)).*$` | Catch-all: serves React frontend (`index.html`) |

---

## Pagination

- **Default page size**: 6 images per page
- **Query parameter**: `?page_size=N` (max 50)
- **Page selection**: `?page=N`
- **Response format**: `{ count, next, previous, results[] }`

---

## Caching

- **Image list**: Cached for 120 seconds via `@cache_page(120)`
- **Cache backend**: `LocMemCache` (in-memory, per-process)
- **Invalidation**: `cache.clear()` called on image create and delete
- **Media files**: 1-year cache via `MediaCacheMiddleware` with ETag support
