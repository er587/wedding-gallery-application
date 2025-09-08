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
from .models import Image, Comment, Tag
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
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return Response({
                'error': 'Username and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Authenticate user
        user = authenticate(username=username, password=password)
        if user is not None and user.is_active:
            # Log the user into Django session
            login(request, user)
            
            # Get user profile and role information
            profile = getattr(user, 'profile', None)
            if not profile:
                from .models import UserProfile
                profile = UserProfile.objects.create(user=user)
            
            # Build response data
            user_data = {
                'id': user.id,
                'username': user.username,
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
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
            
    except json.JSONDecodeError:
        return Response({
            'error': 'Invalid JSON data'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'error': f'Login failed: {str(e)}'
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