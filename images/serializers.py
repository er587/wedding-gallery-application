from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Image, Comment, Tag


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
    image_file = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    
    class Meta:
        model = Image
        fields = ['id', 'title', 'description', 'image_file', 'uploader', 
                 'uploaded_at', 'updated_at', 'comments', 'comment_count', 'tags', 'tag_names']
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