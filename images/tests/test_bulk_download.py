"""Bad image_ids must be a 400, not a 500."""
import pytest
from django.test import override_settings


@pytest.mark.django_db
@override_settings(ALLOWED_HOSTS=['*'], SECURE_SSL_REDIRECT=False, RATELIMIT_ENABLE=False)
@pytest.mark.parametrize('payload', [
    {'image_ids': ['abc']},
    {'image_ids': 'abc'},
    {'image_ids': 5},
    {'image_ids': []},
    {'image_ids': list(range(1, 102))},
    {},
])
def test_bad_image_ids_are_400(api_client, full_user, payload):
    api_client.force_login(full_user)
    resp = api_client.post('/api/images/download/', payload, format='json')
    assert resp.status_code == 400
