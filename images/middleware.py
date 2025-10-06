"""
Middleware for media file caching and performance optimization
"""
from django.utils.cache import patch_cache_control
from django.conf import settings
import re


class MediaCacheMiddleware:
    """
    Add caching headers to media and thumbnail files for better performance.
    
    This middleware sets appropriate cache-control headers for:
    - Original media files: 1 year cache (immutable)
    - Thumbnail files: 1 year cache (immutable)
    - Other requests: No caching
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.media_url = settings.MEDIA_URL.rstrip('/')
        
    def __call__(self, request):
        response = self.get_response(request)
        
        # Only process successful responses
        if response.status_code != 200:
            return response
        
        # Check if this is a media file request
        if request.path.startswith(self.media_url):
            # Determine if this is a thumbnail or original image
            if '/thumbnails/' in request.path or '.thumbnail.' in request.path:
                # Thumbnails: Aggressive caching (1 year, immutable)
                patch_cache_control(
                    response,
                    public=True,
                    max_age=31536000,  # 1 year
                    immutable=True
                )
            elif re.search(r'\.(jpg|jpeg|png|gif|webp)$', request.path, re.IGNORECASE):
                # Original images: Long-term caching (1 year)
                patch_cache_control(
                    response,
                    public=True,
                    max_age=31536000,  # 1 year
                    immutable=True
                )
            
            # Add ETag support for conditional requests
            if not response.has_header('ETag') and hasattr(response, 'content'):
                from hashlib import md5
                etag = md5(response.content).hexdigest()
                response['ETag'] = f'"{etag}"'
                
                # Handle If-None-Match for 304 responses
                if request.META.get('HTTP_IF_NONE_MATCH') == response['ETag']:
                    response.status_code = 304
                    response.content = b''
        
        return response
