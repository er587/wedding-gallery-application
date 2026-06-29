"""Custom DRF permissions for the image-labeling agent API."""
from rest_framework.permissions import BasePermission

from .models import AgentApiKey

AGENT_KEY_HEADER = 'X-Agent-Key'


class IsLabelingAgentOrStaff(BasePermission):
    """Allow staff (via the admin session) or a valid agent API key.

    Headless agents authenticate with a scoped key in the ``X-Agent-Key``
    header; interactive staff use their normal admin session. On a successful
    key match the resolved AgentApiKey is stashed on ``request.agent_key`` so
    views can record it as the suggestion source.
    """
    message = 'A valid X-Agent-Key header or staff session is required.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and user.is_staff:
            return True
        raw = request.headers.get(AGENT_KEY_HEADER, '')
        key = AgentApiKey.authenticate(raw)
        if key:
            request.agent_key = key
            return True
        return False
