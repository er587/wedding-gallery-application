from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Image, Comment


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
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
            # Force HTTPS for Replit environment
            url = request.build_absolute_uri(obj.image_file.url)
            return url.replace('http://', 'https://')
        return None


class ImageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Image
        fields = ['title', 'description', 'image_file']