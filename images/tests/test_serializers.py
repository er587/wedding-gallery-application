"""Tests for DRF serializers: validation, output shape, and nested data."""
import os
import pytest
from io import BytesIO
from PIL import Image as PILImage

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIRequestFactory

from images.serializers import (
    CommentSerializer,
    ImageCreateSerializer,
    ImageSerializer,
    TagSerializer,
    UserSerializer,
)


def _create_test_image_file(name="test.jpg", size=(100, 100), fmt="JPEG"):
    """Helper to create an in-memory image file for upload tests."""
    img = PILImage.new("RGB", size, color="red")
    buf = BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type=f"image/{fmt.lower()}")


class TestImageCreateSerializer:
    """Validation tests for ImageCreateSerializer."""

    def test_rejects_missing_media(self):
        serializer = ImageCreateSerializer(data={"title": "No media"})
        assert not serializer.is_valid()

    def test_accepts_vimeo_url(self):
        serializer = ImageCreateSerializer(
            data={
                "title": "Dance Video",
                "vimeo_url": "https://player.vimeo.com/video/123456",
            }
        )
        assert serializer.is_valid(), serializer.errors

    def test_accepts_image_file(self):
        img_file = _create_test_image_file()
        serializer = ImageCreateSerializer(
            data={"title": "Photo", "image_file": img_file}
        )
        assert serializer.is_valid(), serializer.errors

    def test_rejects_disallowed_extension(self):
        bad_file = SimpleUploadedFile("hack.exe", b"notanimage", content_type="application/octet-stream")
        serializer = ImageCreateSerializer(
            data={"title": "Bad", "image_file": bad_file}
        )
        assert not serializer.is_valid()
        assert "image_file" in serializer.errors

    def test_rejects_oversized_file(self):
        # Create a file that reports > 26MB
        img_file = _create_test_image_file()
        img_file.size = 27 * 1024 * 1024  # fake 27MB
        serializer = ImageCreateSerializer(
            data={"title": "Huge", "image_file": img_file}
        )
        assert not serializer.is_valid()
        assert "image_file" in serializer.errors


class TestCommentSerializer:
    """Tests for CommentSerializer output shape."""

    def test_output_fields(self, comment_factory, full_user, sample_image):
        comment = comment_factory(author=full_user, image=sample_image)
        serializer = CommentSerializer(comment)
        data = serializer.data
        assert "id" in data
        assert "content" in data
        assert "author" in data
        assert "replies" in data
        assert data["content"] == "Great photo!"

    def test_nested_replies(self, comment_factory, full_user, memory_user, sample_image):
        parent = comment_factory(author=full_user, image=sample_image, content="Parent")
        comment_factory(author=memory_user, image=sample_image, content="Reply", parent=parent)
        serializer = CommentSerializer(parent)
        data = serializer.data
        assert len(data["replies"]) == 1
        assert data["replies"][0]["content"] == "Reply"


class TestUserSerializer:
    """Tests for UserSerializer output."""

    def test_includes_role_info(self, full_user):
        serializer = UserSerializer(full_user)
        data = serializer.data
        assert data["role"] == "full"
        assert data["can_upload_images"] is True
        assert data["can_comment"] is True
        assert "id" in data
        assert "email" in data


class TestTagSerializer:
    """Tests for TagSerializer."""

    def test_output_fields(self, tag_factory):
        tag = tag_factory("flowers")
        serializer = TagSerializer(tag)
        assert serializer.data["name"] == "flowers"
        assert "id" in serializer.data
