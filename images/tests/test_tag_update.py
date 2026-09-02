"""Non-owners may add tags to a photo but never remove them."""
import pytest
from django.test import override_settings

from images.models import Tag


@pytest.fixture
def tagged_image(image_factory, user_factory):
    owner = user_factory(email='owner@example.com')
    img = image_factory(uploader=owner)
    img.tags.add(Tag.objects.create(name='cake'))
    return owner, img


@pytest.mark.django_db
@override_settings(ALLOWED_HOSTS=['*'], SECURE_SSL_REDIRECT=False)
def test_non_owner_cannot_wipe_tags(api_client, tagged_image, user_factory):
    owner, img = tagged_image
    Tag.objects.create(name='dancing')
    other = user_factory(email='other@example.com')
    api_client.force_login(other)

    resp = api_client.patch(f'/api/images/{img.id}/', {'tag_names': []}, format='json')
    assert resp.status_code == 200
    assert set(img.tags.values_list('name', flat=True)) == {'cake'}

    resp = api_client.patch(f'/api/images/{img.id}/', {'tag_names': ['dancing']}, format='json')
    assert resp.status_code == 200
    assert set(img.tags.values_list('name', flat=True)) == {'cake', 'dancing'}


@pytest.mark.django_db
@override_settings(ALLOWED_HOSTS=['*'], SECURE_SSL_REDIRECT=False)
def test_owner_can_replace_tags(api_client, tagged_image):
    owner, img = tagged_image
    api_client.force_login(owner)
    resp = api_client.patch(f'/api/images/{img.id}/', {'tag_names': []}, format='json')
    assert resp.status_code == 200
    assert img.tags.count() == 0
