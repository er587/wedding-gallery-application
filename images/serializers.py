from rest_framework import serializers
from django.contrib.auth.models import User
from easy_thumbnails.files import get_thumbnailer
from .models import Image, Comment, Tag, Like


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='profile.role', read_only=True)
    can_upload_images = serializers.BooleanField(source='profile.can_upload_images', read_only=True)
    can_delete_images = serializers.BooleanField(source='profile.can_delete_images', read_only=True)
    can_comment = serializers.BooleanField(source='profile.can_comment', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'can_upload_images', 'can_delete_images', 'can_comment']
        read_only_fields = ['id']


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = ['id', 'content', 'author', 'parent', 'created_at', 'updated_at', 'replies']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
    
    def get_replies(self, obj):
        if obj.replies.exists():
            return CommentSerializer(obj.replies.all(), many=True).data
        return []


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name']


class ImageSerializer(serializers.ModelSerializer):
    uploader = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    comment_count = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    user_has_liked = serializers.SerializerMethodField()
    image_file = serializers.SerializerMethodField()
    
    # Responsive thumbnail URLs for different sizes and platforms
    thumbnail_square_160 = serializers.SerializerMethodField()
    thumbnail_square_320 = serializers.SerializerMethodField()
    thumbnail_square_640 = serializers.SerializerMethodField()
    thumbnail_width_480 = serializers.SerializerMethodField()
    thumbnail_width_960 = serializers.SerializerMethodField()
    thumbnail_width_1440 = serializers.SerializerMethodField()
    
    # Legacy thumbnail fields for backward compatibility
    thumbnail_url = serializers.SerializerMethodField()
    thumbnail_small = serializers.SerializerMethodField()
    thumbnail_medium = serializers.SerializerMethodField()
    thumbnail_large = serializers.SerializerMethodField()
    
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    
    class Meta:
        model = Image
        fields = ['id', 'title', 'description', 'image_file', 
                 'thumbnail_square_160', 'thumbnail_square_320', 'thumbnail_square_640',
                 'thumbnail_width_480', 'thumbnail_width_960', 'thumbnail_width_1440',
                 'thumbnail_url', 'thumbnail_small', 'thumbnail_medium', 'thumbnail_large',
                 'uploader', 'uploaded_at', 'updated_at', 
                 'comments', 'comment_count', 'like_count', 'user_has_liked', 'tags', 'tag_names']
        read_only_fields = ['id', 'uploader', 'uploaded_at', 'updated_at']
    
    def get_comment_count(self, obj):
        return obj.comments.count()
    
    def get_like_count(self, obj):
        return obj.likes.count()
    
    def get_user_has_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False
    
    def get_image_file(self, obj):
        if obj.image_file:
            # Return relative URL so it goes through Vite proxy
            return obj.image_file.url
        return None
    
    def get_thumbnail_url(self, obj):
        # Legacy method - use medium thumbnail for backward compatibility
        return self.get_thumbnail_medium(obj)
    
    def _get_thumbnail_with_face_data(self, obj, alias):
        """Helper method to get thumbnail URL with face detection data"""
        if obj.image_file:
            try:
                thumbnailer = get_thumbnailer(obj.image_file)
                options = {'alias': alias}
                
                # Pass face coordinates to the processor if available
                if obj.face_x is not None:
                    options.update({
                        'face_x': obj.face_x,
                        'face_y': obj.face_y,
                        'face_width': obj.face_width,
                        'face_height': obj.face_height,
                    })
                
                thumbnail = thumbnailer.get_thumbnail(options)
                return thumbnail.url
            except Exception as e:
                print(f"Thumbnail generation error for {alias}: {e}")
                return obj.image_file.url
        return None
    
    # Responsive square thumbnails (face-aware cropping)
    def get_thumbnail_square_160(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'square_160')
    
    def get_thumbnail_square_320(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'square_320')
    
    def get_thumbnail_square_640(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'square_640')
    
    # Width-constrained thumbnails (maintain aspect ratio)
    def get_thumbnail_width_480(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'width_480')
    
    def get_thumbnail_width_960(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'width_960')
    
    def get_thumbnail_width_1440(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'width_1440')
    
    # Legacy thumbnail methods for backward compatibility
    def get_thumbnail_small(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'small')
    
    def get_thumbnail_medium(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'medium')
    
    def get_thumbnail_large(self, obj):
        return self._get_thumbnail_with_face_data(obj, 'large')


class ImageCreateSerializer(serializers.ModelSerializer):
    tag_names = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    
    class Meta:
        model = Image
        fields = ['title', 'description', 'image_file', 'tag_names']
    
    def create(self, validated_data):
        tag_names = validated_data.pop('tag_names', [])
        image = Image.objects.create(**validated_data)
        
        # Create or get tags and add to image
        for tag_name in tag_names:
            tag_name = tag_name.strip().lower()
            if tag_name:
                tag, created = Tag.objects.get_or_create(name=tag_name)
                image.tags.add(tag)
        
        return image