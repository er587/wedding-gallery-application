"""
Cache headers for media files.

The gallery is invitation-only, so media must never be marked ``public``:
a shared proxy or CDN would store and re-serve private photos to anyone.
``private`` keeps the browser cache benefit and nothing else.

No ETag is set here. In production the Django response body is empty
(nginx serves the bytes via X-Accel-Redirect), so hashing it produced one
constant ETag for every file and browsers rendered the wrong photo on a
304. nginx emits a correct ETag from the file itself.
"""
from django.utils.cache import patch_cache_control
from django.conf import settings


class MediaCacheMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.media_url = settings.MEDIA_URL.rstrip('/') + '/'

    def __call__(self, request):
        response = self.get_response(request)
        if response.status_code == 200 and request.path.startswith(self.media_url):
            patch_cache_control(response, private=True, max_age=31536000, immutable=True)
        return response
