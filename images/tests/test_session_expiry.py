"""Pins the response the frontend keys on to detect an expired session.

frontend/src/services/api.js treats a 403 with this exact detail string as
"session gone" (DRF SessionAuthentication never sends 401). If this test
fails, update the string there too.
"""
import pytest
from django.test import override_settings


@pytest.mark.django_db
@override_settings(ALLOWED_HOSTS=['*'], SECURE_SSL_REDIRECT=False)
def test_unauthenticated_api_call_shape(api_client):
    resp = api_client.get('/api/images/')
    assert resp.status_code == 403
    assert resp.data == {'detail': 'Authentication credentials were not provided.'}
