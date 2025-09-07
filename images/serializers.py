from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Image, Comment


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


class ImageSerializer(serializers.ModelSerializer):
    uploader = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    comment_count = serializers.SerializerMethodField()
    image_file = serializers.SerializerMethodField()
    
    class Meta:
        model = Image
        fields = ['id', 'title', 'description', 'image_file', 'uploader', 
                 'uploaded_at', 'updated_at', 'comments', 'comment_count']
        read_only_fields = ['id', 'uploader', 'uploaded_at', 'updated_at']
    
    def get_comment_count(self, obj):
        return obj.comments.count()
    
    def get_image_file(self, obj):
        request = self.context.get('request')
        if obj.image_file and request:
            # Build the correct URL for Replit environment
            url = request.build_absolute_uri(obj.image_file.url)
            url = url.replace('http://', 'https://')
            # Make sure port 8000 is included for media files
            if ':8000' not in url:
                url = url.replace('replit.dev/', 'replit.dev:8000/')
            return url
        return obj.image_file.url if obj.image_file else None


class ImageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Image
        fields = ['title', 'description', 'image_file']