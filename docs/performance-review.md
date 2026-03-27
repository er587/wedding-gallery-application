# Performance Review

**Date**: March 2026
**Scope**: Full application stack (Django backend + React frontend)

---

## Summary

| Severity | Issue | Impact |
|----------|-------|--------|
| High | Comment N+1 queries | Slow image detail responses |
| High | Aggressive cache invalidation | Unnecessary DB load |
| Medium | OpenCV dependency size | ~100MB, slow installs/deploys |
| Medium | LocMemCache single-process | Cache misses in multi-worker |
| Low | No WebP thumbnail conversion | 25-35% larger image payloads |
| Low | Synchronous Vimeo thumbnail fetch | Potential request blocking |

---

## Issues

### 1. Comment N+1 Query Problem

**Location**: `images/serializers.py:28-31`
**Severity**: High

The `CommentSerializer.get_replies()` method triggers a separate query for each comment's replies:

```python
def get_replies(self, obj):
    if obj.replies.exists():  # Query 1: EXISTS check
        return CommentSerializer(obj.replies.all(), many=True).data  # Query 2: Fetch replies
    return []
```

For an image with 20 comments, this generates 20-40 additional queries. Each reply also serializes its `author` via `UserSerializer`, adding more queries.

**Current mitigation**: The image queryset uses `prefetch_related('comments')` but does **not** prefetch `comments__replies` or `comments__replies__author`.

**Fix**: Add deeper prefetch in the view querysets:
```python
# In ImageListCreateView.get_queryset() and ImageDetailView.queryset:
Image.objects.select_related('uploader').prefetch_related(
    'tags',
    'likes',
    Prefetch('comments', queryset=Comment.objects.select_related('author__profile').prefetch_related(
        Prefetch('replies', queryset=Comment.objects.select_related('author__profile'))
    ))
)
```

---

### 2. Aggressive Cache Invalidation

**Location**: `images/views.py:112` and `views.py:137`
**Severity**: High

Every image create or delete calls `cache.clear()`, which wipes the **entire** application cache:

```python
def perform_create(self, serializer):
    serializer.save(uploader=self.request.user)
    cache.clear()  # Nukes everything
```

In a gallery with active users uploading frequently, this effectively disables caching. The 120-second `@cache_page` on the image list becomes useless if any user uploads during that window.

**Fix options**:
1. **Cache versioning**: Increment a version key instead of clearing:
   ```python
   cache.incr('image_list_version')
   ```
2. **Cache key prefix**: Use Django's `cache_page` with a key prefix and only invalidate that prefix
3. **Skip invalidation**: Accept 2-minute staleness - gallery updates will appear within 2 minutes naturally

---

### 3. OpenCV Dependency (~100MB)

**Location**: `requirements.txt:15` (`opencv-python==4.9.0.80`)
**Severity**: Medium

OpenCV is used only for:
1. Face detection during image upload (`models.py:139-176`)
2. Smart thumbnail cropping (`models.py:178-263`)

The library adds ~100MB to the deployment package and slows down `pip install` and container builds significantly.

**Mitigations already in place**:
- OpenCV is imported lazily inside methods (`import cv2` inside functions)
- Fallback to basic PIL thumbnail if OpenCV is unavailable (`_create_basic_thumbnail`)

**Fix options**:
1. **Replace with lighter alternative**: Use `mediapipe` or `dlib` for face detection (much smaller)
2. **Use a cloud service**: Offload face detection to AWS Rekognition or similar
3. **Make truly optional**: Move to `requirements-optional.txt` since the fallback already works
4. **Pre-build face coordinates**: Run detection as a one-time migration task, not on every upload

---

### 4. LocMemCache Not Multi-Process Safe

**Location**: `django_project/settings.py:167-175`
**Severity**: Medium

```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'wedding-gallery-cache',
    }
}
```

With Gunicorn running multiple workers (standard for production), each worker maintains its own independent cache. This means:
- A cache write by Worker 1 is invisible to Workers 2-N
- Cache hit rate ≈ 1/N (where N = worker count)
- `cache.clear()` only clears the current worker's cache

**Fix**: Use Redis for production:
```python
if not DEBUG:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/1'),
        }
    }
```

---

### 5. No WebP Thumbnail Conversion

**Location**: `django_project/settings.py:285-319` (THUMBNAIL_ALIASES)
**Severity**: Low

All thumbnails are generated as JPEG. WebP format typically provides 25-35% smaller file sizes at equivalent quality, which would reduce bandwidth for a photo-heavy gallery.

**Current thumbnail config** generates 6 sizes (3 square, 3 width-based) but only 3 are returned to the frontend (square_320, square_640, width_1440).

**Fix**: Add WebP conversion to the thumbnail pipeline. `easy-thumbnails` supports custom processors:
```python
THUMBNAIL_ALIASES = {
    '': {
        'square_320': {'size': (320, 320), 'crop': True, 'quality': 80, 'format': 'WEBP'},
        ...
    }
}
```

Note: Requires Pillow 9+ (already met with Pillow 10.2.0).

---

### 6. Synchronous Vimeo Thumbnail Fetch

**Location**: `images/models.py:289-348`
**Severity**: Low (already mitigated)

The Vimeo oEmbed API call uses `requests.get()` with a 10-second timeout. Two HTTP requests are made:
1. oEmbed API to get thumbnail URL (up to 10s)
2. Download thumbnail image (up to 10s)

**Mitigation**: This already runs in a background `threading.Thread(daemon=True)` (line 104-107), so it doesn't block the HTTP response. However, if the thread fails silently, no retry mechanism exists.

**Improvement**: Add logging and optional retry:
```python
def _async_fetch_vimeo_thumbnail(self):
    try:
        self.fetch_vimeo_thumbnail()
    except Exception as e:
        logger.warning(f"Failed to fetch Vimeo thumbnail for image {self.id}: {e}")
        # Could add to a retry queue here
```

---

## Positive Performance Findings

These optimizations are correctly implemented:

| Area | Implementation | Location |
|------|---------------|----------|
| **Query Optimization** | `select_related('uploader')` and `prefetch_related('tags', 'comments', 'likes')` | `views.py:47-51` |
| **Response Caching** | Image list cached for 120 seconds via `@cache_page` | `views.py:41` |
| **Media Caching** | 1-year cache headers with ETag on media files | `middleware.py` (MediaCacheMiddleware) |
| **Lazy Loading** | `loading="lazy"` and `decoding="async"` on gallery images | ImageGallery component |
| **Infinite Scroll** | Intersection Observer for incremental page loading | ImageGallery component |
| **Staggered Decode** | Images decoded with delay to prevent CPU spikes | ImageGallery component |
| **Responsive Thumbnails** | `srcSet` with 320px, 640px, 1440px variants | ImageSerializer |
| **Payload Reduction** | Only 3 thumbnail sizes returned (70% reduction from original 6) | `serializers.py:49-52` |
| **Background Processing** | Face detection and thumbnail generation in daemon threads | `models.py:104-123` |
| **Async Thumbnail Gen** | `super().save(update_fields=[...])` avoids full model re-save | `models.py:170, 254` |
| **Static File Serving** | WhiteNoise middleware for efficient static file serving | `settings.py` |
| **Asset Hashing** | Vite production build adds content hashes for cache busting | `vite.config.js` |
| **Pagination** | 6 images per page with configurable page_size (max 50) | `views.py:24-27` |
| **Distinct Queries** | `.distinct()` on filtered querysets prevents duplicates | `views.py:77` |
