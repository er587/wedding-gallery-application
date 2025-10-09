from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
from django.core.cache import cache
from django.http import JsonResponse, HttpResponse, Http404
from django.conf import settings
import json
import uuid
import requests
import os
from django.utils import timezone
from .models import Image, Comment, Tag, UserProfile, InvitationCode, Like, EmailVerificationToken, PasswordResetToken
from .serializers import ImageSerializer, ImageCreateSerializer, CommentSerializer, UserSerializer, TagSerializer
from .storage import ReplitAppStorage, FileAccessControl


class ImagePagination(PageNumberPagination):
    page_size = 6
    page_size_query_param = 'page_size'
    max_page_size = 50


class TagListView(generics.ListAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.AllowAny]


class ImageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = ImagePagination
    
    # Cache the list view for 2 minutes to reduce database load
    @method_decorator(cache_page(120))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
    
    def get_queryset(self):
        # Optimize queries with select_related and prefetch_related to reduce database hits
        queryset = Image.objects.select_related('uploader').prefetch_related(
            'tags', 
            'comments',
            'likes'
        )
        
        search = self.request.query_params.get('search', None)
        tags = self.request.query_params.get('tags', None)
        media_type = self.request.query_params.get('media_type', None)
        
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
        
        if media_type:
            if media_type.lower() == 'video':
                # Filter for videos only (entries with vimeo_url)
                queryset = queryset.filter(vimeo_url__isnull=False).exclude(vimeo_url='')
            elif media_type.lower() == 'image':
                # Filter for images only (entries without vimeo_url)
                queryset = queryset.filter(Q(vimeo_url__isnull=True) | Q(vimeo_url=''))
        
        return queryset.distinct()
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ImageCreateSerializer
        return ImageSerializer
    
    def create(self, request, *args, **kwargs):
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return Response(
                {"error": "You must be logged in to upload images."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user has upload permissions
        from .models import UserProfile
        user = request.user
        
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
        # Save the image with the authenticated user as uploader
        serializer.save(uploader=self.request.user)
        # Invalidate cache when new image is created
        cache.clear()


class ImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    # Optimize queries with select_related and prefetch_related
    queryset = Image.objects.select_related('uploader').prefetch_related(
        'tags', 
        'comments', 
        'likes'
    )
    serializer_class = ImageSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def destroy(self, request, *args, **kwargs):
        user = request.user
        image = self.get_object()
        
        # Only allow image owner to delete their own image
        if image.uploader != user:
            return Response(
                {"error": "You can only delete images you uploaded yourself."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Invalidate cache when image is deleted
        cache.clear()
        return super().destroy(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        user = request.user
        image = self.get_object()
        
        # Check if user has profile
        if not hasattr(user, 'profile'):
            from .models import UserProfile
            UserProfile.objects.create(user=user)
        
        # Allow tag updates for all full users
        is_tag_only_update = 'tag_names' in request.data and len(request.data) == 1
        if is_tag_only_update and user.profile.role == 'full':
            return super().update(request, *args, **kwargs)
        
        # For other updates, only allow image owner
        if image.uploader != user:
            return Response(
                {"error": "You can only update images you uploaded yourself."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        user = request.user
        image = self.get_object()
        
        # Check if user has profile
        if not hasattr(user, 'profile'):
            from .models import UserProfile
            UserProfile.objects.create(user=user)
        
        # Allow tag updates for all full users
        is_tag_only_update = 'tag_names' in request.data and len(request.data) == 1
        if is_tag_only_update and user.profile.role == 'full':
            return super().partial_update(request, *args, **kwargs)
        
        # For other updates, only allow image owner
        if image.uploader != user:
            return Response(
                {"error": "You can only update images you uploaded yourself."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().partial_update(request, *args, **kwargs)
    
    def perform_destroy(self, instance):
        # Delete the physical files when deleting the database record
        if instance.image_file:
            try:
                instance.image_file.delete(save=False)
            except Exception as e:
                print(f"Error deleting image file: {e}")
                
        if instance.thumbnail:
            try:
                instance.thumbnail.delete(save=False)
            except Exception as e:
                print(f"Error deleting thumbnail file: {e}")
                
        super().perform_destroy(instance)


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        image_id = self.kwargs.get('image_id')
        return Comment.objects.filter(image_id=image_id, parent=None)
    
    def perform_create(self, serializer):
        image_id = self.kwargs.get('image_id')
        image = Image.objects.get(id=image_id)
        serializer.save(author=self.request.user, image=image)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_reply(request, comment_id):
    try:
        parent_comment = Comment.objects.get(id=comment_id)
        serializer = CommentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                author=request.user,
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
        
        # Send notification email to admin about new user registration
        try:
            from django.core.mail import send_mail
            
            admin_subject = 'New User Registration'
            admin_message = f'''
A new user has registered on the Wedding Gallery:

Name: {user.first_name} {user.last_name}
Email: {user.email}
Role: {profile.get_role_display()}
Invitation Code Used: {invitation_code}
Registration Time: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}

You can manage this user in the admin panel at {settings.FRONTEND_URL}/admin/
            '''
            
            send_mail(
                admin_subject,
                admin_message,
                settings.DEFAULT_FROM_EMAIL,
                [settings.SERVER_EMAIL],
                fail_silently=True,  # Don't break registration if email fails
            )
        except Exception as email_error:
            # Log the error but don't fail the registration
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Failed to send admin notification email: {str(email_error)}')
        
        # Automatically log in the user after registration
        login(request, user)
        
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


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_image_count(request):
    """Get total count of all images in the database"""
    count = Image.objects.count()
    return Response({'count': count}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user_upload_count(request):
    """Get count of images uploaded by the authenticated user"""
    count = request.user.uploaded_images.count()
    return Response({'count': count}, status=status.HTTP_200_OK)


@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def update_profile(request):
    """Update user profile information"""
    try:
        user = request.user
        data = request.data
        
        # Update user fields
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            # Check if email already exists for another user
            if User.objects.filter(email=data['email']).exclude(id=user.id).exists():
                return Response({
                    'error': 'Email already in use by another account'
                }, status=status.HTTP_400_BAD_REQUEST)
            user.email = data['email']
        
        user.save()
        
        # Get profile data for response
        profile = getattr(user, 'profile', None)
        if not profile:
            profile = UserProfile.objects.create(user=user)
        
        user_data = {
            'id': user.id,
            'username': user.email or user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': profile.role,
            'role_display': profile.get_role_display(),
            'can_upload_images': profile.can_upload_images,
            'can_delete_images': profile.can_delete_images,
            'can_comment': profile.can_comment,
        }
        
        return Response({
            'message': 'Profile updated successfully',
            'user': user_data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Profile update failed for user {request.user.id}: {str(e)}')
        
        return Response({
            'error': 'Profile update failed. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """Change user password"""
    try:
        user = request.user
        data = request.data
        
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return Response({
                'error': 'Both current and new passwords are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check current password
        if not user.check_password(current_password):
            return Response({
                'error': 'Current password is incorrect'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate new password length (basic validation)
        if len(new_password) < 8:
            return Response({
                'error': 'New password must be at least 8 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update password
        user.set_password(new_password)
        user.save()
        
        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Password change failed for user {request.user.id}: {str(e)}')
        
        return Response({
            'error': 'Password change failed. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# CLOUD STORAGE API ENDPOINTS WITH AUTHENTICATION AND ACCESS CONTROLS
# ============================================================================

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def get_upload_url(request):
    """
    Get presigned URL for uploading files to Replit App Storage.
    Requires authentication to ensure only logged-in users can upload.
    """
    try:
        if not getattr(settings, 'USE_CLOUD_STORAGE', False):
            return Response({
                'error': 'Cloud storage is not enabled'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        storage = ReplitAppStorage()
        
        # Generate unique filename with user ID for organization
        filename = request.data.get('filename', f'upload_{uuid.uuid4().hex}')
        object_path = storage._generate_object_path(str(request.user.pk), filename)
        
        # Parse bucket and object name
        bucket_name, object_name = storage._get_bucket_and_object_name(object_path)
        
        # Get presigned upload URL
        upload_url = storage._get_presigned_upload_url(bucket_name, object_name)
        
        return Response({
            'upload_url': upload_url,
            'object_path': object_path,
            'bucket_name': bucket_name,
            'object_name': object_name
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Failed to get upload URL for user {request.user.pk}: {str(e)}')
        
        return Response({
            'error': 'Failed to generate upload URL. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def set_file_acl(request):
    """
    Set ACL policy for uploaded file after successful upload.
    This enforces authentication and access control for the file.
    """
    try:
        if not getattr(settings, 'USE_CLOUD_STORAGE', False):
            return Response({
                'error': 'Cloud storage is not enabled'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        upload_url = request.data.get('upload_url')
        is_public = request.data.get('is_public', False)
        
        if not upload_url:
            return Response({
                'error': 'upload_url is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        storage = ReplitAppStorage()
        
        # Extract bucket and object name from upload URL
        from urllib.parse import urlparse
        parsed_url = urlparse(upload_url)
        path_parts = parsed_url.path.split('/')
        bucket_name = path_parts[1] if len(path_parts) > 1 else None
        object_name = '/'.join(path_parts[2:]) if len(path_parts) > 2 else None
        
        if not bucket_name or not object_name:
            return Response({
                'error': 'Invalid upload URL format'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set ACL policy for the file
        storage._set_object_acl_policy(
            bucket_name, 
            object_name, 
            str(request.user.pk), 
            is_public
        )
        
        # Generate normalized object path for client use
        normalized_path = f"/objects/{object_name}"
        
        return Response({
            'success': True,
            'object_path': normalized_path,
            'access_url': storage.url(normalized_path)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Failed to set ACL for user {request.user.pk}: {str(e)}')
        
        return Response({
            'error': 'Failed to set file permissions. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def serve_protected_file(request, file_path):
    """
    Serve files from cloud storage with access control enforcement.
    Checks user authentication and file ownership before serving.
    """
    try:
        if not getattr(settings, 'USE_CLOUD_STORAGE', False):
            raise Http404("File not found")
        
        storage = ReplitAppStorage()
        
        # Get the file from cloud storage
        full_path = f"/objects/{file_path}"
        object_file = storage._storage_client.bucket('default-bucket').blob(file_path)
        
        if not object_file.exists():
            raise Http404("File not found")
        
        # Get ACL policy and check access
        acl_policy = FileAccessControl.get_file_acl_policy('default-bucket', file_path)
        
        if not acl_policy:
            raise Http404("File not found")
        
        # Check if user can access the file
        can_access = FileAccessControl.can_access_file(
            request.user if hasattr(request, 'user') and request.user.is_authenticated else None,
            full_path,
            acl_policy.get('owner', '')
        )
        
        if not can_access:
            return HttpResponse('Unauthorized', status=401)
        
        # Stream the file to the client
        response = HttpResponse(content_type='application/octet-stream')
        
        # Get file metadata for proper content type
        object_file.reload()
        if hasattr(object_file, 'content_type') and object_file.content_type:
            response['Content-Type'] = object_file.content_type
        
        # Set caching headers based on file visibility
        is_public = acl_policy.get('visibility') == 'public'
        cache_control = 'public, max-age=3600' if is_public else 'private, max-age=3600'
        response['Cache-Control'] = cache_control
        
        # Stream file content
        for chunk in object_file.download_as_bytes(chunk_size=8192):
            response.write(chunk)
        
        return response
        
    except Http404:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Failed to serve file {file_path}: {str(e)}')
        raise Http404("File not found")


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_user_files(request):
    """
    List files uploaded by the authenticated user.
    Provides a way for users to see their uploaded files.
    """
    try:
        if not getattr(settings, 'USE_CLOUD_STORAGE', False):
            return Response({
                'files': []
            }, status=status.HTTP_200_OK)
        
        # This would need to be implemented based on your specific
        # file tracking mechanism (e.g., database records of uploads)
        
        return Response({
            'files': [],
            'message': 'File listing feature coming soon'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Failed to list files for user {request.user.pk}: {str(e)}')
        
        return Response({
            'error': 'Failed to retrieve file list.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_verification_email(request):
    """Send email verification link to user's email"""
    try:
        user = request.user
        
        if not user.email:
            return Response({
                'error': 'No email address associated with this account'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        token_obj = EmailVerificationToken.generate_token(user)
        
        verification_url = f"{settings.FRONTEND_URL}/verify-email/{token_obj.raw_token}"
        
        from django.core.mail import send_mail
        from django.template.loader import render_to_string
        
        subject = 'Verify Your Email Address'
        message = f'''
Hi {user.first_name or user.username},

Please verify your email address by clicking the link below:

{verification_url}

This link will expire in 24 hours.

If you didn't request this verification, please ignore this email.

Best regards,
Wedding Gallery Team
        '''
        
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            
            return Response({
                'message': 'Verification email sent successfully'
            }, status=status.HTTP_200_OK)
        except Exception as email_error:
            return Response({
                'error': f'Failed to send email: {str(email_error)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Failed to send verification email: {str(e)}')
        return Response({
            'error': 'Failed to send verification email'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def verify_email(request):
    """Verify email using token"""
    try:
        token = request.data.get('token')
        
        if not token:
            return Response({
                'error': 'Token is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            token_obj = EmailVerificationToken.objects.get(token=token)
        except EmailVerificationToken.DoesNotExist:
            return Response({
                'error': 'Invalid verification token'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not token_obj.is_valid():
            return Response({
                'error': 'Verification token has expired or been used'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        token_obj.is_used = True
        token_obj.save()
        
        return Response({
            'message': 'Email verified successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Email verification failed: {str(e)}')
        return Response({
            'error': 'Email verification failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def request_password_reset(request):
    """Request password reset - sends email with reset link"""
    try:
        email = request.data.get('email')
        
        if not email:
            return Response({
                'error': 'Email is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'message': 'If an account exists with this email, a password reset link will be sent'
            }, status=status.HTTP_200_OK)
        
        token_obj = PasswordResetToken.generate_token(user)
        
        reset_url = f"{settings.FRONTEND_URL}/reset-password/{token_obj.raw_token}"
        
        from django.core.mail import send_mail
        
        subject = 'Reset Your Password'
        message = f'''
Hi {user.first_name or user.username},

You requested to reset your password. Click the link below to set a new password:

{reset_url}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email or contact support if you're concerned.

Best regards,
Wedding Gallery Team
        '''
        
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
        except Exception as email_error:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Failed to send password reset email: {str(email_error)}')
        
        return Response({
            'message': 'If an account exists with this email, a password reset link will be sent'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Password reset request failed: {str(e)}')
        return Response({
            'error': 'Failed to process password reset request'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def reset_password(request):
    """Reset password using token"""
    try:
        token = request.data.get('token')
        new_password = request.data.get('password')
        
        if not token or not new_password:
            return Response({
                'error': 'Token and new password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        token_obj = PasswordResetToken.verify_token(token)
        if not token_obj:
            return Response({
                'error': 'Invalid password reset token'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not token_obj.is_valid():
            return Response({
                'error': 'Password reset token has expired or been used'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = token_obj.user
        user.set_password(new_password)
        user.save()
        
        token_obj.is_used = True
        token_obj.save()
        
        return Response({
            'message': 'Password reset successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Password reset failed: {str(e)}')
        return Response({
            'error': 'Password reset failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def serve_frontend(request, *args, **kwargs):
    """
    Serve the React frontend for all non-API routes.
    This is the catch-all route for the single-page application.
    """
    try:
        # Path to the React build's index.html
        index_path = os.path.join(settings.BASE_DIR, "frontend", "dist", "index.html")
        
        if os.path.exists(index_path):
            with open(index_path, "r", encoding="utf-8") as f:
                content = f.read()
            return HttpResponse(content, content_type="text/html")
        else:
            # Fallback if React build doesn't exist
            return HttpResponse(
                "<html><body><h1>Frontend not built</h1><p>Run: cd frontend && npm run build</p></body></html>",
                content_type="text/html"
            )
    except Exception as e:
        return HttpResponse(f"Error serving frontend: {str(e)}", status=500)
