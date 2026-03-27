"""Tests for the Image, Comment, Like, Tag, InvitationCode, and UserProfile models."""
import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError

from images.models import (
    Comment,
    EmailVerificationToken,
    Image,
    InvitationCode,
    Like,
    PasswordResetToken,
    Tag,
    UserProfile,
)


class TestUserProfile:
    """Tests for the UserProfile model and auto-creation signal."""

    def test_profile_auto_created_on_user_creation(self, db):
        user = User.objects.create_user(username="newuser", password="pass1234")
        assert hasattr(user, "profile")
        assert user.profile.role == "full"  # default role

    def test_full_user_permissions(self, full_user):
        assert full_user.profile.can_upload_images is True
        assert full_user.profile.can_delete_images is True
        assert full_user.profile.can_comment is True

    def test_memory_user_permissions(self, memory_user):
        assert memory_user.profile.can_upload_images is False
        assert memory_user.profile.can_delete_images is False
        assert memory_user.profile.can_comment is True

    def test_str_representation(self, full_user):
        assert "Full User" in str(full_user.profile)


class TestImage:
    """Tests for the Image model."""

    def test_create_image(self, image_factory, full_user):
        image = image_factory(uploader=full_user, title="Beach Photo")
        assert image.pk is not None
        assert image.title == "Beach Photo"
        assert image.uploader == full_user

    def test_is_video_property(self, image_factory, full_user):
        photo = image_factory(uploader=full_user, title="Photo")
        video = image_factory(
            uploader=full_user,
            title="Video",
            vimeo_url="https://player.vimeo.com/video/123456",
        )
        assert photo.is_video is False
        assert video.is_video is True

    def test_ordering_newest_first(self, image_factory, full_user):
        img1 = image_factory(uploader=full_user, title="First")
        img2 = image_factory(uploader=full_user, title="Second")
        images = list(Image.objects.all())
        assert images[0] == img2  # newest first
        assert images[1] == img1

    def test_str_representation(self, sample_image):
        assert str(sample_image) == "Wedding Photo"


class TestComment:
    """Tests for the Comment model including threading."""

    def test_create_comment(self, comment_factory, full_user, sample_image):
        comment = comment_factory(author=full_user, image=sample_image)
        assert comment.pk is not None
        assert comment.is_reply is False

    def test_create_reply(self, comment_factory, full_user, memory_user, sample_image):
        parent = comment_factory(author=full_user, image=sample_image, content="Parent")
        reply = comment_factory(
            author=memory_user,
            image=sample_image,
            content="Reply",
            parent=parent,
        )
        assert reply.is_reply is True
        assert reply.parent == parent
        assert parent.replies.count() == 1

    def test_ordering_oldest_first(self, comment_factory, full_user, sample_image):
        c1 = comment_factory(author=full_user, image=sample_image, content="First")
        c2 = comment_factory(author=full_user, image=sample_image, content="Second")
        comments = list(Comment.objects.filter(image=sample_image))
        assert comments[0] == c1
        assert comments[1] == c2


class TestLike:
    """Tests for the Like model."""

    def test_create_like(self, full_user, sample_image):
        like = Like.objects.create(user=full_user, image=sample_image)
        assert like.pk is not None

    def test_unique_constraint(self, full_user, sample_image):
        Like.objects.create(user=full_user, image=sample_image)
        with pytest.raises(IntegrityError):
            Like.objects.create(user=full_user, image=sample_image)

    def test_different_users_can_like_same_image(self, full_user, memory_user, sample_image):
        Like.objects.create(user=full_user, image=sample_image)
        Like.objects.create(user=memory_user, image=sample_image)
        assert sample_image.likes.count() == 2


class TestTag:
    """Tests for the Tag model."""

    def test_create_tag(self, tag_factory):
        tag = tag_factory("flowers")
        assert tag.name == "flowers"

    def test_unique_name(self, tag_factory):
        tag1 = tag_factory("sunset")
        tag2 = tag_factory("sunset")  # get_or_create returns same
        assert tag1.pk == tag2.pk

    def test_ordering_alphabetical(self, sample_tags):
        tags = list(Tag.objects.all())
        names = [t.name for t in tags]
        assert names == sorted(names)


class TestInvitationCode:
    """Tests for the InvitationCode model."""

    def test_generate_code_uniqueness(self):
        code1 = InvitationCode.generate_code()
        code2 = InvitationCode.generate_code()
        assert code1 != code2
        assert len(code1) == 8
        assert code1.isalnum()

    def test_code_creation(self, invitation_code):
        assert invitation_code.is_active is True
        assert invitation_code.role == "full"
        assert invitation_code.usage_count == 0


class TestTokenModels:
    """Tests for EmailVerificationToken and PasswordResetToken."""

    def test_email_token_generation(self, full_user):
        token_obj = EmailVerificationToken.generate_token(full_user)
        assert token_obj.pk is not None
        assert hasattr(token_obj, "raw_token")
        assert token_obj.token_prefix == token_obj.raw_token[:16]
        assert token_obj.is_used is False

    def test_email_token_verification(self, full_user):
        token_obj = EmailVerificationToken.generate_token(full_user)
        raw = token_obj.raw_token
        verified = EmailVerificationToken.verify_token(raw)
        assert verified is not None
        assert verified.pk == token_obj.pk

    def test_email_token_invalid(self, full_user):
        EmailVerificationToken.generate_token(full_user)
        assert EmailVerificationToken.verify_token("bogus-token") is None

    def test_password_reset_token_generation(self, full_user):
        token_obj = PasswordResetToken.generate_token(full_user)
        assert token_obj.pk is not None
        assert token_obj.token_prefix == token_obj.raw_token[:16]

    def test_password_reset_invalidates_previous(self, full_user):
        t1 = PasswordResetToken.generate_token(full_user)
        t2 = PasswordResetToken.generate_token(full_user)
        t1.refresh_from_db()
        assert t1.is_used is True  # invalidated by t2
        assert t2.is_used is False

    def test_password_reset_token_verification(self, full_user):
        token_obj = PasswordResetToken.generate_token(full_user)
        verified = PasswordResetToken.verify_token(token_obj.raw_token)
        assert verified is not None
        assert verified.pk == token_obj.pk
