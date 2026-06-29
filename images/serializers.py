import os

from rest_framework import serializers
from django.contrib.auth.models import User
from easy_thumbnails.files import get_thumbnailer
from .models import Image, Comment, Tag, Like, GuestBookEntry, SiteConfiguration, ImageLabelSuggestion


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='profile.role', read_only=True)
    can_upload_images = serializers.BooleanField(source='profile.can_upload_images', read_only=True)
    can_delete_images = serializers.BooleanField(source='profile.can_delete_images', read_only=True)
    can_comment = serializers.BooleanField(source='profile.can_comment', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'role', 'can_upload_images', 'can_delete_images', 'can_comment']
        read_only_fields = ['id', 'is_staff']


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    is_hidden = serializers.BooleanField(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'content', 'author', 'parent', 'created_at', 'updated_at', 'replies', 'is_hidden']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at', 'is_hidden']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Mask content of hidden (moderated) comments
        if instance.is_hidden:
            data['content'] = '[This comment has been hidden by moderators]'
            data['author'] = None
        return data

    def get_replies(self, obj):
        # Use .all() directly — hits prefetch cache, avoids extra EXISTS query
        replies = obj.replies.all()
        if replies:
            return CommentSerializer(replies, many=True).data
        return []


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name']


class ImageListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for gallery list — no comments, smaller payload."""
    uploader = UserSerializer(read_only=True)
    comment_count = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    user_has_liked = serializers.SerializerMethodField()
    image_file = serializers.SerializerMethodField()
    is_video = serializers.BooleanField(read_only=True)
    thumbnail_square_320 = serializers.SerializerMethodField()
    thumbnail_square_640 = serializers.SerializerMethodField()
    thumbnail_width_1440 = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = Image
        fields = ['id', 'title', 'description', 'image_file', 'vimeo_url', 'is_video',
                 'thumbnail_square_320', 'thumbnail_square_640', 'thumbnail_width_1440',
                 'image_width', 'image_height',
                 'uploader', 'uploaded_at', 'updated_at',
                 'comment_count', 'like_count', 'user_has_liked', 'tags', 'tag_names']
        read_only_fields = ['id', 'uploader', 'uploaded_at', 'updated_at']

    def get_comment_count(self, obj):
        return getattr(obj, 'comment_count_val', obj.comments.count())

    def get_like_count(self, obj):
        return getattr(obj, 'like_count_val', obj.likes.count())

    def get_user_has_liked(self, obj):
        val = getattr(obj, 'user_has_liked_val', None)
        if val is not None:
            return val
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_image_file(self, obj):
        if obj.image_file:
            return obj.image_file.url
        return None

    def _get_thumbnail_with_face_data(self, obj, alias):
        """Helper method to get thumbnail URL with face detection data"""
        if obj.is_video:
            if obj.cover_image:
                try:
                    from django.conf import settings as django_settings
                    thumbnailer = get_thumbnailer(obj.cover_image)
                    alias_options = django_settings.THUMBNAIL_ALIASES.get('', {}).get(alias, {})
                    thumbnail = thumbnailer.get_thumbnail(alias_options)
                    return thumbnail.url
                except Exception:
                    return obj.cover_image.url
            if obj.thumbnail:
                try:
                    from django.conf import settings as django_settings
                    thumbnailer = get_thumbnailer(obj.thumbnail)
                    alias_options = django_settings.THUMBNAIL_ALIASES.get('', {}).get(alias, {})
                    thumbnail = thumbnailer.get_thumbnail(alias_options)
                    return thumbnail.url
                except Exception:
                    return obj.thumbnail.url
        if obj.image_file:
            try:
                from django.conf import settings as django_settings
                thumbnailer = get_thumbnailer(obj.image_file)
                alias_options = django_settings.THUMBNAIL_ALIASES.get('', {}).get(alias, {})
                options = alias_options.copy()
                if obj.face_x is not None:
                    options.update({
                        'face_x': obj.face_x, 'face_y': obj.face_y,
                        'face_width': obj.face_width, 'face_height': obj.face_height,
                    })
                thumbnail = thumbnailer.get_thumbnail(options)
                return thumbnail.url
            except Exception:
                return obj.image_file.url
        return None

    def get_thumbnail_square_320(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'square_320')

    def get_thumbnail_square_640(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'square_640')

    def get_thumbnail_width_1440(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'width_1440')

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tag_names', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tag_names is not None:
            # Staff may create brand-new tags inline; everyone else can only
            # apply tags that already exist (unknown names are ignored).
            request = self.context.get('request')
            can_create = bool(request and request.user and request.user.is_staff)
            instance.tags.clear()
            for tag_name in tag_names:
                tag_name = tag_name.strip().lower()[:50]
                if not tag_name:
                    continue
                tag = Tag.objects.filter(name=tag_name).first()
                if tag is None and can_create:
                    tag = Tag.objects.create(name=tag_name)
                if tag is not None:
                    instance.tags.add(tag)
        return instance


class ImageSerializer(ImageListSerializer):
    """Full serializer for detail view — includes comments."""
    comments = CommentSerializer(many=True, read_only=True)

    class Meta(ImageListSerializer.Meta):
        fields = ImageListSerializer.Meta.fields + ['comments']


class ImageCreateSerializer(serializers.ModelSerializer):
    ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'}
    MAX_FILE_SIZE = 26 * 1024 * 1024  # 26MB

    tag_names = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    image_file = serializers.ImageField(required=False, allow_null=True)
    vimeo_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    cover_image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Image
        fields = ['title', 'description', 'image_file', 'vimeo_url', 'cover_image', 'tag_names']

    def _validate_image(self, value):
        """Validate image file extension and size"""
        if value is None:
            return value
        ext = os.path.splitext(value.name)[1].lower().lstrip('.')
        if ext not in self.ALLOWED_IMAGE_EXTENSIONS:
            raise serializers.ValidationError(
                f"File type '.{ext}' is not allowed. "
                f"Allowed types: {', '.join(sorted(self.ALLOWED_IMAGE_EXTENSIONS))}"
            )
        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError("File size exceeds 26MB limit.")
        return value

    def validate_image_file(self, value):
        return self._validate_image(value)

    def validate_cover_image(self, value):
        return self._validate_image(value)

    def validate(self, data):
        """Ensure either image_file or vimeo_url is provided"""
        if not data.get('image_file') and not data.get('vimeo_url'):
            raise serializers.ValidationError("Either image_file or vimeo_url must be provided")
        return data
    
    def create(self, validated_data):
        tag_names = validated_data.pop('tag_names', [])
        image = Image.objects.create(**validated_data)
        
        # Only add existing tags to image
        for tag_name in tag_names:
            tag_name = tag_name.strip().lower()
            if tag_name:
                try:
                    tag = Tag.objects.get(name=tag_name)
                    image.tags.add(tag)
                except Tag.DoesNotExist:
                    # Skip non-existent tags silently
                    pass
        
        return image

class GuestBookEntrySerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = GuestBookEntry
        fields = ['id', 'author', 'message', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class FeaturedImageSerializer(ImageListSerializer):
    """Minimal image payload for the masthead hero — reuses thumbnail logic."""
    class Meta(ImageListSerializer.Meta):
        fields = ['id', 'title', 'is_video', 'image_file',
                  'thumbnail_square_640', 'thumbnail_width_1440',
                  'image_width', 'image_height']
        read_only_fields = fields


class SiteConfigurationSerializer(serializers.ModelSerializer):
    """Public, read-only view of the wedding's display content."""
    couple_display = serializers.CharField(read_only=True)
    featured_image = FeaturedImageSerializer(read_only=True)

    class Meta:
        model = SiteConfiguration
        fields = [
            'partner_one_name', 'partner_two_name', 'couple_display',
            'wedding_date', 'venue_name', 'venue_url', 'location', 'intro_text',
            'featured_image', 'featured_title', 'featured_subtitle',
            'site_domain', 'footer_message',
        ]


class LabelingImageSerializer(ImageListSerializer):
    """Image payload for the agent labeling queue — viewable URLs + current label."""
    class Meta(ImageListSerializer.Meta):
        fields = ['id', 'title', 'description', 'tags', 'is_video', 'image_file',
                  'thumbnail_square_640', 'thumbnail_width_1440',
                  'image_width', 'image_height', 'uploaded_at']
        read_only_fields = fields


class LabelSuggestionInputSerializer(serializers.Serializer):
    """Validates a suggestion submitted by an agent for one image."""
    suggested_title = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    suggested_description = serializers.CharField(required=False, allow_blank=True, default='', trim_whitespace=False)
    suggested_tags = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False, default=list,
        max_length=ImageLabelSuggestion.MAX_TAGS,
    )
    confidence = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=1)
    rationale = serializers.CharField(required=False, allow_blank=True, default='')
    source = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')

    def validate_suggested_tags(self, value):
        cleaned, seen = [], set()
        for raw in value:
            name = raw.strip().lower()
            if name and name not in seen:
                seen.add(name)
                cleaned.append(name)
        return cleaned

    def validate(self, attrs):
        if not (attrs.get('suggested_title') or attrs.get('suggested_description') or attrs.get('suggested_tags')):
            raise serializers.ValidationError(
                'Provide at least one of suggested_title, suggested_description, or suggested_tags.'
            )
        return attrs


class ImageLabelSuggestionSerializer(serializers.ModelSerializer):
    """Read serializer for reviewing suggestions."""
    image_title = serializers.CharField(source='image.title', read_only=True)
    reviewed_by = serializers.CharField(source='reviewed_by.username', read_only=True, default=None)

    class Meta:
        model = ImageLabelSuggestion
        fields = [
            'id', 'image', 'image_title', 'suggested_title', 'suggested_description',
            'suggested_tags', 'source', 'confidence', 'rationale', 'status',
            'created_at', 'reviewed_by', 'reviewed_at',
        ]
        read_only_fields = fields
