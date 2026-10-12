"""Soft-deleted photos must not be served: original or easy_thumbnails derivative."""
import os

import pytest
from django.test import override_settings

ORIGINAL = 'images/u/x.jpg'
DERIVATIVE = 'thumbnails/images/u/x.jpg.320x320_q75_crop.webp'


@pytest.fixture
def media(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    settings.DEBUG = True  # FileResponse path, no nginx
    for rel in (ORIGINAL, DERIVATIVE):
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b'x')
    return tmp_path


@override_settings(ALLOWED_HOSTS=['*'], SECURE_SSL_REDIRECT=False, THUMBNAIL_BASEDIR='thumbnails')
def test_soft_deleted_photo_and_derivative_are_404(media, api_client, image_factory, full_user):
    img = image_factory(uploader=full_user, image_file=ORIGINAL)
    api_client.force_login(full_user)

    assert api_client.get('/media/' + ORIGINAL).status_code == 200
    assert api_client.get('/media/' + DERIVATIVE).status_code == 200

    img.is_deleted = True
    from django.db import models as django_models
    django_models.Model.save(img)

    assert api_client.get('/media/' + ORIGINAL).status_code == 404
    assert api_client.get('/media/' + DERIVATIVE).status_code == 404
