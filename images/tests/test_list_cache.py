"""The cached image list must not leak one user's like state to another."""
import pytest
from django.core.cache import cache
from django.test import override_settings

from images.models import Like


@pytest.mark.django_db
@override_settings(ALLOWED_HOSTS=['*'], SECURE_SSL_REDIRECT=False)
def test_list_cache_is_per_user(api_client, image_factory, user_factory):
    cache.clear()
    alice = user_factory(email='alice@example.com')
    bob = user_factory(email='bob@example.com')
    img = image_factory(uploader=alice)
    Like.objects.create(user=alice, image=img)

    api_client.force_login(alice)
    assert api_client.get('/api/images/').data['results'][0]['user_has_liked'] is True

    api_client.force_login(bob)
    assert api_client.get('/api/images/').data['results'][0]['user_has_liked'] is False
