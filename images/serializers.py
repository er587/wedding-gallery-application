from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Image, Comment, Tag, Like, Person, FaceTag


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
    thumbnail_url = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    face_tags = serializers.SerializerMethodField()
    face_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Image
        fields = ['id', 'title', 'description', 'image_file', 'thumbnail_url', 'uploader', 
                 'uploaded_at', 'updated_at', 'comments', 'comment_count', 
                 'like_count', 'user_has_liked', 'tags', 'tag_names', 'face_tags', 'face_count']
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
        if obj.thumbnail:
            # Return relative URL for thumbnail
            return obj.thumbnail.url
        elif obj.image_file:
            # Fallback to full image if no thumbnail (shouldn't happen)
            return obj.image_file.url
        return None
    
    def get_face_tags(self, obj):
        # Only return approved face tags for regular users
        approved_tags = obj.face_tags.filter(status='approved')
        return FaceTagSerializer(approved_tags, many=True).data
    
    def get_face_count(self, obj):
        return obj.face_tags.filter(status='approved').count()


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


class PersonSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    face_tag_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Person
        fields = ['id', 'name', 'created_by', 'created_at', 'face_tag_count']
        read_only_fields = ['id', 'created_by', 'created_at']
    
    def get_face_tag_count(self, obj):
        return obj.face_tags.filter(status='approved').count()


class FaceTagSerializer(serializers.ModelSerializer):
    person = PersonSerializer(read_only=True)
    person_id = serializers.IntegerField(write_only=True, required=False)
    person_name = serializers.CharField(write_only=True, required=False)
    tagged_by = UserSerializer(read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    image_title = serializers.CharField(source='image.title', read_only=True)
    
    class Meta:
        model = FaceTag
        fields = [
            'id', 'image', 'person', 'person_id', 'person_name', 'tagged_by', 
            'face_x', 'face_y', 'face_width', 'face_height', 
            'status', 'confidence_score', 'is_auto_generated',
            'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
            'image_title'
        ]
        read_only_fields = [
            'id', 'tagged_by', 'reviewed_by', 'reviewed_at', 
            'created_at', 'updated_at', 'image_title'
        ]
    
    def create(self, validated_data):
        person_id = validated_data.pop('person_id', None)
        person_name = validated_data.pop('person_name', None)
        
        # Handle person creation/selection
        person = None
        if person_id:
            try:
                person = Person.objects.get(id=person_id)
            except Person.DoesNotExist:
                raise serializers.ValidationError("Person does not exist")
        elif person_name:
            # Create new person or get existing one
            person, created = Person.objects.get_or_create(
                name=person_name.strip(),
                created_by=self.context['request'].user,
                defaults={'created_by': self.context['request'].user}
            )
        
        if not person:
            raise serializers.ValidationError("Either person_id or person_name is required")
        
        validated_data['person'] = person
        return super().create(validated_data)


class FaceDetectionResultSerializer(serializers.Serializer):
    """Serializer for face detection results"""
    faces = serializers.ListField(
        child=serializers.DictField(), 
        help_text="List of detected faces with coordinates and encodings"
    )
    image_id = serializers.IntegerField(help_text="ID of the processed image")
    face_count = serializers.IntegerField(help_text="Number of faces detected")


class AutoTagSuggestionSerializer(serializers.Serializer):
    """Serializer for auto-tagging suggestions"""
    person_id = serializers.IntegerField()
    person_name = serializers.CharField()
    confidence_score = serializers.FloatField()
    similar_faces = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of similar face detections"
    )