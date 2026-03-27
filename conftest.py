"""Shared pytest fixtures for the wedding gallery application."""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from images.models import (
    Comment,
    Image,
    InvitationCode,
    Like,
    Tag,
    UserProfile,
)


@pytest.fixture
def api_client():
    """Unauthenticated DRF API client."""
    return APIClient()


@pytest.fixture
def user_factory(db):
    """Factory function to create users with profiles."""
    created = []

    def _create(
        email="test@example.com",
        password="testpass123",
        first_name="Test",
        last_name="User",
        role="full",
    ):
        username = email.split("@")[0]
        # Ensure unique username
        base = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base}{counter}"
            counter += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        # Profile auto-created by signal; update role if needed
        user.profile.role = role
        user.profile.save()
        created.append(user)
        return user

    return _create


@pytest.fixture
def full_user(user_factory):
    """A standard full-role user."""
    return user_factory(email="fulluser@example.com", role="full")


@pytest.fixture
def memory_user(user_factory):
    """A memory-only user (can comment but not upload)."""
    return user_factory(email="memoryuser@example.com", role="memory")


@pytest.fixture
def admin_user(db):
    """A Django superuser for admin operations."""
    user = User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="adminpass123",
    )
    return user


@pytest.fixture
def authenticated_client(api_client, full_user):
    """API client authenticated as a full user."""
    api_client.force_authenticate(user=full_user)
    return api_client


@pytest.fixture
def memory_client(api_client, memory_user):
    """API client authenticated as a memory-only user."""
    api_client.force_authenticate(user=memory_user)
    return api_client


@pytest.fixture
def invitation_code(admin_user):
    """A reusable full-role invitation code."""
    return InvitationCode.objects.create(
        code="TESTCODE",
        role="full",
        is_active=True,
        created_by=admin_user,
    )


@pytest.fixture
def memory_invitation_code(admin_user):
    """A memory-role invitation code."""
    return InvitationCode.objects.create(
        code="MEMCODE1",
        role="memory",
        is_active=True,
        created_by=admin_user,
    )


@pytest.fixture
def tag_factory(db):
    """Factory to create tags."""
    def _create(name="wedding"):
        tag, _ = Tag.objects.get_or_create(name=name)
        return tag
    return _create


@pytest.fixture
def sample_tags(tag_factory):
    """A set of common tags."""
    return [tag_factory(name) for name in ["wedding", "reception", "ceremony"]]


@pytest.fixture
def image_factory(db):
    """Factory to create Image objects without triggering background threads."""
    def _create(uploader, title="Test Image", description="", vimeo_url=None, **kwargs):
        # Use Image.objects.create with update_fields to skip the save() override
        # that triggers background threads
        image = Image(
            title=title,
            description=description,
            uploader=uploader,
            vimeo_url=vimeo_url or "",
            **kwargs,
        )
        # Call models.Model.save directly to skip our custom save()
        # that spawns background threads
        from django.db import models as django_models
        django_models.Model.save(image)
        return image
    return _create


@pytest.fixture
def sample_image(image_factory, full_user):
    """A single test image owned by full_user."""
    return image_factory(uploader=full_user, title="Wedding Photo")


@pytest.fixture
def comment_factory(db):
    """Factory to create comments."""
    def _create(author, image, content="Great photo!", parent=None):
        return Comment.objects.create(
            author=author,
            image=image,
            content=content,
            parent=parent,
        )
    return _create
