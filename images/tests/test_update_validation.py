"""Invalid update payloads must return 400, not 500."""
import pytest
from django.test import override_settings


@pytest.mark.django_db
@override_settings(ALLOWED_HOSTS=['*'], SECURE_SSL_REDIRECT=False)
def test_invalid_patch_is_400(api_client, sample_image, full_user):
    api_client.force_login(full_user)
    resp = api_client.patch(
        f'/api/images/{sample_image.id}/',
        {'title': 'x' * 201, 'vimeo_url': 'not-a-url'},
        format='json',
    )
    assert resp.status_code == 400
    assert 'title' in resp.data
