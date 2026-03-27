"""Tests for API views: images, comments, likes, auth, and permissions."""
import pytest
from django.contrib.auth.models import User

from images.models import Comment, Image, InvitationCode, Like, Tag


# ---------------------------------------------------------------------------
# Image CRUD
# ---------------------------------------------------------------------------


class TestImageList:
    """GET /api/images/"""

    def test_unauthenticated_can_list(self, api_client, sample_image):
        resp = api_client.get("/api/images/")
        assert resp.status_code == 200
        assert resp.data["count"] >= 1

    def test_search_by_title(self, api_client, image_factory, full_user):
        image_factory(uploader=full_user, title="Beach Sunset")
        image_factory(uploader=full_user, title="Mountain View")
        resp = api_client.get("/api/images/", {"search": "Beach"})
        assert resp.status_code == 200
        titles = [img["title"] for img in resp.data["results"]]
        assert "Beach Sunset" in titles
        assert "Mountain View" not in titles

    def test_filter_by_media_type_video(self, api_client, image_factory, full_user):
        image_factory(uploader=full_user, title="Photo")
        image_factory(
            uploader=full_user,
            title="Video",
            vimeo_url="https://player.vimeo.com/video/123",
        )
        resp = api_client.get("/api/images/", {"media_type": "video"})
        assert resp.status_code == 200
        assert all(r["is_video"] for r in resp.data["results"])

    def test_pagination_default_page_size(self, api_client, image_factory, full_user):
        for i in range(8):
            image_factory(uploader=full_user, title=f"Image {i}")
        resp = api_client.get("/api/images/")
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 6  # default page_size
        assert resp.data["count"] == 8


class TestImageCreate:
    """POST /api/images/"""

    def test_unauthenticated_cannot_create(self, api_client):
        resp = api_client.post("/api/images/", {"title": "New"})
        assert resp.status_code == 401

    def test_memory_user_cannot_upload(self, memory_client):
        resp = memory_client.post("/api/images/", {"title": "New"})
        assert resp.status_code == 403

    def test_requires_image_or_vimeo(self, authenticated_client):
        resp = authenticated_client.post(
            "/api/images/",
            {"title": "No media"},
            format="json",
        )
        assert resp.status_code == 400


class TestImageDelete:
    """DELETE /api/images/<pk>/"""

    def test_owner_can_delete(self, authenticated_client, sample_image):
        resp = authenticated_client.delete(f"/api/images/{sample_image.pk}/")
        assert resp.status_code == 204
        assert not Image.objects.filter(pk=sample_image.pk).exists()

    def test_non_owner_cannot_delete(self, memory_client, sample_image):
        resp = memory_client.delete(f"/api/images/{sample_image.pk}/")
        assert resp.status_code == 403
        assert Image.objects.filter(pk=sample_image.pk).exists()


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------


class TestComments:
    """Comment endpoints."""

    def test_list_comments(self, api_client, comment_factory, full_user, sample_image):
        comment_factory(author=full_user, image=sample_image, content="Nice!")
        resp = api_client.get(f"/api/images/{sample_image.pk}/comments/")
        assert resp.status_code == 200
        assert len(resp.data) >= 1

    def test_create_comment_authenticated(self, authenticated_client, sample_image):
        resp = authenticated_client.post(
            f"/api/images/{sample_image.pk}/comments/",
            {"content": "Beautiful!"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["content"] == "Beautiful!"

    def test_create_comment_unauthenticated(self, api_client, sample_image):
        resp = api_client.post(
            f"/api/images/{sample_image.pk}/comments/",
            {"content": "Nope"},
            format="json",
        )
        assert resp.status_code == 403

    def test_create_reply(self, authenticated_client, comment_factory, full_user, sample_image):
        parent = comment_factory(author=full_user, image=sample_image)
        resp = authenticated_client.post(
            f"/api/comments/{parent.pk}/reply/",
            {"content": "Thanks!"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["parent"] == parent.pk


# ---------------------------------------------------------------------------
# Likes
# ---------------------------------------------------------------------------


class TestLikes:
    """Like toggle endpoint."""

    def test_toggle_like_on(self, authenticated_client, sample_image):
        resp = authenticated_client.post(f"/api/images/{sample_image.pk}/like/")
        assert resp.status_code == 200
        assert resp.data["liked"] is True

    def test_toggle_like_off(self, authenticated_client, full_user, sample_image):
        Like.objects.create(user=full_user, image=sample_image)
        resp = authenticated_client.post(f"/api/images/{sample_image.pk}/like/")
        assert resp.status_code == 200
        assert resp.data["liked"] is False

    def test_unauthenticated_cannot_like(self, api_client, sample_image):
        resp = api_client.post(f"/api/images/{sample_image.pk}/like/")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


class TestAuth:
    """Auth endpoints: login, register, logout."""

    def test_login_success(self, api_client, full_user):
        resp = api_client.post(
            "/api/auth/login/",
            {"username": full_user.email, "password": "testpass123"},
            format="json",
        )
        assert resp.status_code == 200
        assert "user" in resp.data

    def test_login_wrong_password(self, api_client, full_user):
        resp = api_client.post(
            "/api/auth/login/",
            {"username": full_user.email, "password": "wrong"},
            format="json",
        )
        assert resp.status_code == 401

    def test_login_missing_fields(self, api_client):
        resp = api_client.post("/api/auth/login/", {}, format="json")
        assert resp.status_code == 400

    def test_register_with_valid_invitation(self, api_client, invitation_code):
        resp = api_client.post(
            "/api/auth/register/",
            {
                "email": "newguest@example.com",
                "password": "securepass123!",
                "invitation_code": invitation_code.code,
                "first_name": "New",
                "last_name": "Guest",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert User.objects.filter(email="newguest@example.com").exists()

    def test_register_without_invitation_fails(self, api_client):
        resp = api_client.post(
            "/api/auth/register/",
            {
                "email": "bad@example.com",
                "password": "securepass123!",
                "invitation_code": "INVALID",
                "first_name": "Bad",
                "last_name": "Actor",
            },
            format="json",
        )
        assert resp.status_code == 400

    def test_register_assigns_role_from_code(self, api_client, memory_invitation_code):
        resp = api_client.post(
            "/api/auth/register/",
            {
                "email": "memguest@example.com",
                "password": "securepass123!",
                "invitation_code": memory_invitation_code.code,
                "first_name": "Mem",
                "last_name": "Guest",
            },
            format="json",
        )
        assert resp.status_code == 201
        user = User.objects.get(email="memguest@example.com")
        assert user.profile.role == "memory"

    def test_logout(self, authenticated_client):
        resp = authenticated_client.post("/api/auth/logout/")
        assert resp.status_code == 200

    def test_get_profile(self, authenticated_client, full_user):
        resp = authenticated_client.get("/api/auth/profile/")
        assert resp.status_code == 200
        assert resp.data["email"] == full_user.email

    def test_csrf_endpoint(self, api_client):
        resp = api_client.get("/api/auth/csrf/")
        assert resp.status_code == 200
        assert "csrfToken" in resp.data


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------


class TestTags:
    """Tag list endpoint."""

    def test_list_tags(self, api_client, sample_tags):
        resp = api_client.get("/api/tags/")
        assert resp.status_code == 200
        assert len(resp.data) == 3
