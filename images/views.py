from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
from django.utils import timezone
from .models import Image, Comment, Tag, UserProfile, InvitationCode, Like
from .serializers import ImageSerializer, ImageCreateSerializer, CommentSerializer, UserSerializer, TagSerializer


class ImagePagination(PageNumberPagination):
    page_size = 6
    page_size_query_param = 'page_size'
    max_page_size = 50


class ImageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.AllowAny]  # Temporarily allow uploads for testing
    pagination_class = ImagePagination
    
    def get_queryset(self):
        queryset = Image.objects.all()
        search = self.request.query_params.get('search', None)
        tags = self.request.query_params.get('tags', None)
        
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | 
                Q(description__icontains=search) |
                Q(uploader__username__icontains=search)
            )
        
        if tags:
            tag_list = [tag.strip() for tag in str(tags).split(',') if tag.strip()]
            for tag in tag_list:
                queryset = queryset.filter(tags__name__icontains=tag)
        
        return queryset.distinct()
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ImageCreateSerializer
        return ImageSerializer
    
    def create(self, request, *args, **kwargs):
        # Check if user has upload permissions
        from django.contrib.auth.models import User
        from .models import UserProfile
        user = request.user if request.user.is_authenticated else User.objects.get(username='testuser')
        
        # Ensure user has a profile
        if not hasattr(user, 'profile'):
            UserProfile.objects.create(user=user)
        
        if not user.profile.can_upload_images:
            return Response(
                {"error": "You don't have permission to upload images. You can only add memories to existing images."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().create(request, *args, **kwargs)
    
    def perform_create(self, serializer):
        # Use the test user if no user is authenticated
        from django.contrib.auth.models import User
        user = self.request.user if self.request.user.is_authenticated else User.objects.get(username='testuser')
        serializer.save(uploader=user)


class ImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Image.objects.all()
    serializer_class = ImageSerializer
    permission_classes = [permissions.AllowAny]  # Allow for testing
    
    def destroy(self, request, *args, **kwargs):
        # Check if user has delete permissions
        from django.contrib.auth.models import User
        from .models import UserProfile
        user = request.user if request.user.is_authenticated else User.objects.get(username='testuser')
        
        # Ensure user has a profile
        if not hasattr(user, 'profile'):
            UserProfile.objects.create(user=user)
        
        if not user.profile.can_delete_images:
            return Response(
                {"error": "You don't have permission to delete images. You can only add memories to existing images."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)
    
    def perform_destroy(self, instance):
        # Delete the physical file when deleting the database record
        if instance.image_file:
            try:
                instance.image_file.delete(save=False)
            except Exception as e:
                print(f"Error deleting file: {e}")
        super().perform_destroy(instance)


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.AllowAny]  # Temporarily allow comments for testing
    
    def get_queryset(self):
        image_id = self.kwargs.get('image_id')
        return Comment.objects.filter(image_id=image_id, parent=None)
    
    def perform_create(self, serializer):
        image_id = self.kwargs.get('image_id')
        image = Image.objects.get(id=image_id)
        
        if self.request.user.is_authenticated:
            user = self.request.user
        else:
            # If no user is authenticated, require login
            from rest_framework.exceptions import NotAuthenticated
            raise NotAuthenticated("You must be logged in to post comments.")
            
        serializer.save(author=user, image=image)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # Temporarily allow replies for testing
def create_reply(request, comment_id):
    try:
        parent_comment = Comment.objects.get(id=comment_id)
        serializer = CommentSerializer(data=request.data)
        if serializer.is_valid():
            if request.user.is_authenticated:
                user = request.user
            else:
                return Response({
                    'error': 'You must be logged in to post replies.'
                }, status=status.HTTP_401_UNAUTHORIZED)
            serializer.save(
                author=user,
                image=parent_comment.image,
                parent=parent_comment
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Comment.DoesNotExist:
        return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)


# Authentication Views
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_csrf_token(request):
    """Get CSRF token for frontend"""
    from django.middleware.csrf import get_token
    token = get_token(request)
    return Response({
        'csrfToken': token
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """Handle user login"""
    try:
        # Use email as username for authentication
        email = request.data.get('username')  # Frontend still sends as 'username' key
        password = request.data.get('password')
        
        if not email or not password:
            return Response({
                'error': 'Please enter your email and password'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Try to authenticate with email as username
        user = authenticate(username=email, password=password)
        
        # If that fails, try to find user by email and authenticate with their username
        if user is None:
            try:
                from django.contrib.auth.models import User
                user_obj = User.objects.get(email=email)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None
        
        if user is not None and user.is_active:
            # Log the user into Django session
            login(request, user)
            
            # Get user profile and role information
            profile = getattr(user, 'profile', None)
            if not profile:
                from .models import UserProfile
                profile = UserProfile.objects.create(user=user)
            
            # Build response data - use email as display username
            user_data = {
                'id': user.id,
                'username': user.email or user.username,  # Use email as display username
                'email': user.email,
                'role': profile.role,
                'role_display': profile.get_role_display(),
                'can_upload_images': profile.can_upload_images,
                'can_delete_images': profile.can_delete_images,
                'can_comment': profile.can_comment,
                'groups': [group.name for group in user.groups.all()]
            }
            
            return Response({
                'message': 'Login successful',
                'user': user_data
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': 'Invalid email or password'
            }, status=status.HTTP_401_UNAUTHORIZED)
            
    except Exception as e:
        return Response({
            'error': 'Login failed. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """Handle user registration with invitation code"""
    try:
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email')
        invitation_code = request.data.get('invitation_code')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        
        # Validate required fields
        if not all([password, email, invitation_code]):
            return Response({
                'error': 'All fields are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if email already exists (using email as username)
        if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
            return Response({
                'error': 'This email is already registered'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate invitation code
        try:
            invitation = InvitationCode.objects.get(code=invitation_code, is_active=True)
        except InvitationCode.DoesNotExist:
            return Response({
                'error': 'Invalid or expired invitation code'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create user - use email as username
        user = User.objects.create_user(
            username=email,  # Use email as username
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name
        )
        
        # Update invitation code usage
        invitation.usage_count += 1
        invitation.last_used_at = timezone.now()
        invitation.save()
        
        # Get or create user profile with role from invitation
        profile = getattr(user, 'profile', None)
        if not profile:
            profile = UserProfile.objects.create(user=user, role=invitation.role)
        else:
            # Update role based on invitation
            profile.role = invitation.role
            profile.save()
        
        # Build response data - use email as display username
        user_data = {
            'id': user.id,
            'username': user.email or user.username,  # Use email as display username
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': profile.role,
            'role_display': profile.get_role_display(),
            'can_upload_images': profile.can_upload_images,
            'can_delete_images': profile.can_delete_images,
            'can_comment': profile.can_comment,
            'groups': [group.name for group in user.groups.all()]
        }
        
        return Response({
            'message': 'Registration successful',
            'user': user_data
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        # Log the actual error for debugging but don't expose it
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Registration failed for email {email}: {str(e)}')
        
        return Response({
            'error': 'Registration failed. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    """Handle user logout"""
    logout(request)
    return Response({
        'message': 'Logout successful'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def user_profile_view(request):
    """Get current user profile"""
    if request.user.is_authenticated:
        profile = getattr(request.user, 'profile', None)
        if not profile:
            from .models import UserProfile
            profile = UserProfile.objects.create(user=request.user)
        
        user_data = {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'role': profile.role,
            'role_display': profile.get_role_display(),
            'can_upload_images': profile.can_upload_images,
            'can_delete_images': profile.can_delete_images,
            'can_comment': profile.can_comment,
            'groups': [group.name for group in request.user.groups.all()]
        }
        return Response({'user': user_data}, status=status.HTTP_200_OK)
    else:
        return Response({
            'error': 'Not authenticated'
        }, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_like(request, image_id):
    """Toggle like status for an image"""
    try:
        image = Image.objects.get(id=image_id)
    except Image.DoesNotExist:
        return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)
    
    like, created = Like.objects.get_or_create(
        user=request.user,
        image=image
    )
    
    if not created:
        # Like exists, so remove it (unlike)
        like.delete()
        action = 'unliked'
        liked = False
        
        # Also remove the love comment if it exists
        Comment.objects.filter(
            image=image,
            author=request.user,
            content=f"{request.user.username} loves this image"
        ).delete()
    else:
        # Like was created
        action = 'liked'
        liked = True
        
        # Create a comment saying user loves this image
        Comment.objects.create(
            image=image,
            author=request.user,
            content=f"{request.user.username} loves this image"
        )
    
    # Get updated like count
    like_count = image.likes.count()
    
    return Response({
        'action': action,
        'liked': liked,
        'like_count': like_count
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_liked_images(request):
    """Get list of images the user has liked"""
    liked_images = Image.objects.filter(
        likes__user=request.user
    ).order_by('-likes__created_at')
    
    paginator = ImagePagination()
    page = paginator.paginate_queryset(liked_images, request)
    
    if page is not None:
        serializer = ImageSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)
    
    serializer = ImageSerializer(liked_images, many=True, context={'request': request})
    return Response(serializer.data)