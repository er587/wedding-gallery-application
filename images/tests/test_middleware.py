from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings

from images.middleware import MediaCacheMiddleware


@override_settings(MEDIA_URL='/media/')
class MediaCacheMiddlewareTests(SimpleTestCase):
    def _get(self, path, body=b''):
        mw = MediaCacheMiddleware(lambda r: HttpResponse(body))
        return mw(RequestFactory().get(path, HTTP_IF_NONE_MATCH='"d41d8cd98f00b204e9800998ecf8427e"'))

    def test_media_is_private_and_has_no_etag(self):
        resp = self._get('/media/thumbnails/images/a.jpg')
        cc = resp['Cache-Control']
        self.assertIn('private', cc)
        self.assertNotIn('public', cc)
        self.assertIn('max-age=31536000', cc)
        self.assertFalse(resp.has_header('ETag'))
        # Empty-body X-Accel response must not turn into a 304 for a stale ETag.
        self.assertEqual(resp.status_code, 200)

    def test_non_media_untouched(self):
        resp = self._get('/api/images/')
        self.assertFalse(resp.has_header('Cache-Control'))
