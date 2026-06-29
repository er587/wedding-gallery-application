from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Count, Exists, F, OuterRef, Q, Prefetch
from django.core.cache import cache
from django.http import JsonResponse, HttpResponse, Http404
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django_ratelimit.decorators import ratelimit
import json
import logging
import uuid
import requests
import os
from django.utils import timezone

logger = logging.getLogger(__name__)

from .models import Image, Comment, Tag, UserProfile, InvitationCode, Like, EmailVerificationToken, PasswordResetToken, GuestBookEntry, SiteConfiguration, ImageLabelSuggestion


def _is_postgres():
    """Check if the default database is PostgreSQL."""
    engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
    return 'postgresql' in engine or 'postgis' in engine
from .serializers import ImageSerializer, ImageListSerializer, ImageCreateSerializer, CommentSerializer, UserSerializer, TagSerializer, GuestBookEntrySerializer, SiteConfigurationSerializer, LabelingImageSerializer, LabelSuggestionInputSerializer, ImageLabelSuggestionSerializer
from .storage import ReplitAppStorage, FileAccessControl
from .permissions import IsLabelingAgentOrStaff
from .labeling import (
    generate_label_suggestion, LabelingNotConfigured,
    image_phash, tagged_reference_hashes, nearest_reference,
)


class ImagePagination(PageNumberPagination):
    page_size = 6
    page_size_query_param = 'page_size'
    max_page_size = 50


class CommentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TagListView(generics.ListAPIView):
    # Suggested tags first so autocomplete offers the curated ones up top.
    queryset = Tag.objects.all().order_by('-suggested', 'name')
    serializer_class = TagSerializer
    permission_classes = [permissions.AllowAny]


IMAGE_CACHE_VERSION_KEY = 'image_list_version'


def invalidate_image_cache():
    """Increment cache version to invalidate image list caches without clearing the entire cache"""
    try:
        cache.incr(IMAGE_CACHE_VERSION_KEY)
    except ValueError:
        cache.set(IMAGE_CACHE_VERSION_KEY, 1)


class ImageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = ImagePagination

    def list(self, request, *args, **kwargs):
        """Cache list responses using a versioned key so only image caches are invalidated"""
        version = cache.get(IMAGE_CACHE_VERSION_KEY, 0)
        cache_key = f'image_list_v{version}_{request.get_full_path()}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, 120)
        return response
    
    def get_queryset(self):
        # Optimize queries — no comment prefetch needed for list view (uses ImageListSerializer)
        queryset = Image.objects.select_related('uploader', 'uploader__profile').prefetch_related(
            'tags',
        ).annotate(
            comment_count_val=Count('comments', distinct=True),
            like_count_val=Count('likes', distinct=True),
        )

        # Annotate whether the current user has liked each image
        request = self.request
        if request.user.is_authenticated:
            queryset = queryset.annotate(
                user_has_liked_val=Exists(
                    Like.objects.filter(user=request.user, image=OuterRef('pk'))
                )
            )
        
        search = self.request.query_params.get('search', None)
        tags = self.request.query_params.get('tags', None)
        media_type = self.request.query_params.get('media_type', None)
        
        if search:
            if _is_postgres():
                # PostgreSQL full-text search with ranking
                from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
                vector = SearchVector('title', weight='A') + SearchVector('description', weight='B')
                query = SearchQuery(search, search_type='websearch')
                queryset = queryset.annotate(
                    search=vector,
                    rank=SearchRank(vector, query),
                ).filter(
                    Q(search=query) |
                    Q(uploader__username__icontains=search)
                ).order_by('-rank', '-uploaded_at')
            else:
                # SQLite fallback: simple substring matching
                queryset = queryset.filter(
                    Q(title__icontains=search) |
                    Q(description__icontains=search) |
                    Q(uploader__username__icontains=search)
                )
        
        if tags:
            tag_list = [tag.strip().lower() for tag in str(tags).split(',') if tag.strip()]
            # Filter images that have ALL selected tags (AND logic)
            # Use subquery to avoid multiple JOINs that break Count annotations
            for tag_name in tag_list:
                queryset = queryset.filter(
                    pk__in=Image.objects.filter(tags__name__iexact=tag_name).values('pk')
                )
        
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
        return ImageListSerializer  # No comments in list view — much lighter payload
    
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
        invalidate_image_cache()


class ImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ImageSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        # For write operations, use a simple queryset to avoid annotation conflicts
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return Image.objects.select_related('uploader', 'uploader__profile')

        # For reads, use optimized queryset with annotations
        queryset = Image.objects.select_related('uploader', 'uploader__profile').prefetch_related(
            'tags',
            Prefetch(
                'comments',
                queryset=Comment.objects.select_related('author', 'author__profile').prefetch_related(
                    Prefetch('replies', queryset=Comment.objects.select_related('author', 'author__profile'))
                )
            ),
        ).annotate(
            comment_count_val=Count('comments', distinct=True),
            like_count_val=Count('likes', distinct=True),
        )
        if self.request.user.is_authenticated:
            queryset = queryset.annotate(
                user_has_liked_val=Exists(
                    Like.objects.filter(user=self.request.user, image=OuterRef('pk'))
                )
            )
        return queryset
    
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
        invalidate_image_cache()
        return super().destroy(request, *args, **kwargs)
    
    def _check_update_permission(self, request):
        """Check if user has permission to update this image."""
        user = request.user
        image = self.get_object()

        if not hasattr(user, 'profile'):
            from .models import UserProfile
            UserProfile.objects.create(user=user)

        # Allow tag updates for all full users
        is_tag_only_update = 'tag_names' in request.data and len(request.data) == 1
        if is_tag_only_update and user.profile.role == 'full':
            return None  # Allowed

        # For other updates, only allow image owner
        if image.uploader != user:
            return Response(
                {"error": "You can only update images you uploaded yourself."},
                status=status.HTTP_403_FORBIDDEN
            )
        return None  # Allowed

    def update(self, request, *args, **kwargs):
        denied = self._check_update_permission(request)
        if denied:
            return denied
        try:
            return super().update(request, *args, **kwargs)
        except Exception as e:
            logger.error("Image update failed for image %s: %s", kwargs.get('pk'), e, exc_info=True)
            return Response({"error": "Update failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, *args, **kwargs):
        denied = self._check_update_permission(request)
        if denied:
            return denied
        try:
            return super().partial_update(request, *args, **kwargs)
        except Exception as e:
            logger.error("Image partial update failed for image %s: %s", kwargs.get('pk'), e, exc_info=True)
            return Response({"error": "Update failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return super().partial_update(request, *args, **kwargs)
    
    def perform_destroy(self, instance):
        # Soft delete: mark as deleted instead of removing from database
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = CommentPagination
    
    def get_queryset(self):
        image_id = self.kwargs.get('image_id')
        return Comment.objects.filter(
            image_id=image_id, parent=None
        ).select_related('author', 'author__profile').prefetch_related(
            Prefetch('replies', queryset=Comment.objects.select_related('author', 'author__profile'))
        )
    
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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@ratelimit(key='user', rate='10/h', method='POST', block=True)
def report_comment(request, comment_id):
    """Report/flag a comment for moderation."""
    try:
        comment = Comment.objects.get(id=comment_id)

        # Check if user already flagged this comment
        if comment.flagged_by.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You have already reported this comment'},
                status=status.HTTP_400_BAD_REQUEST
            )

        comment.flagged_by.add(request.user)
        comment.flag_count = comment.flagged_by.count()
        comment.is_flagged = True

        # Auto-hide after 3 flags
        if comment.flag_count >= 3:
            comment.is_hidden = True

        comment.save(update_fields=['flag_count', 'is_flagged', 'is_hidden'])

        return Response({
            'message': 'Comment reported successfully',
            'hidden': comment.is_hidden
        }, status=status.HTTP_200_OK)

    except Comment.DoesNotExist:
        return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)


# Bulk download
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@ratelimit(key='user', rate='5/h', method='POST', block=True)
def bulk_download(request):
    """Download multiple images as a ZIP file (max 100 images)."""
    import zipfile
    from django.http import StreamingHttpResponse

    image_ids = request.data.get('image_ids', [])
    if not image_ids:
        return Response({'error': 'No images selected'}, status=status.HTTP_400_BAD_REQUEST)
    if len(image_ids) > 100:
        return Response({'error': 'Maximum 100 images per download'}, status=status.HTTP_400_BAD_REQUEST)

    images = Image.objects.filter(id__in=image_ids, image_file__isnull=False)
    if not images.exists():
        return Response({'error': 'No downloadable images found'}, status=status.HTTP_404_NOT_FOUND)

    def zip_generator():
        """Stream ZIP file chunks to avoid loading all images into memory."""
        import io
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for img in images:
                try:
                    filename = os.path.basename(img.image_file.name)
                    zf.writestr(filename, img.image_file.read())
                except Exception as e:
                    logger.error("Error adding image %s to ZIP: %s", img.id, e)
        buffer.seek(0)
        return buffer.getvalue()

    try:
        zip_data = zip_generator()
        response = HttpResponse(zip_data, content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="wedding-photos.zip"'
        response['Content-Length'] = len(zip_data)
        return response
    except Exception as e:
        logger.error("Bulk download failed: %s", e)
        return Response({'error': 'Download failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Guest Book Views
class GuestBookPagination(PageNumberPagination):
    page_size = 20


class GuestBookListCreateView(generics.ListCreateAPIView):
    serializer_class = GuestBookEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = GuestBookPagination

    def get_queryset(self):
        return GuestBookEntry.objects.select_related('author', 'author__profile').all()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_guestbook_entry(request, pk):
    """Delete a guest book entry (author only)."""
    try:
        entry = GuestBookEntry.objects.get(pk=pk)
        if entry.author != request.user:
            return Response({'error': 'You can only delete your own entries'}, status=status.HTTP_403_FORBIDDEN)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except GuestBookEntry.DoesNotExist:
        return Response({'error': 'Entry not found'}, status=status.HTTP_404_NOT_FOUND)


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
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
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
                'is_staff': user.is_staff,
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
@ratelimit(key='ip', rate='3/m', method='POST', block=True)
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
@permission_classes([permissions.AllowAny])
def site_config(request):
    """Public wedding display content (couple, date, venue, masthead/footer copy)."""
    config = SiteConfiguration.get_solo()
    data = SiteConfigurationSerializer(config, context={'request': request}).data
    if config.randomize_featured:
        # Pick a fresh opening frame each visit. Prefer a landscape photo for the
        # wide hero; fall back to any non-video image.
        from .serializers import FeaturedImageSerializer
        # Photos only (exclude videos via empty vimeo_url) and not soft-deleted.
        base = Image.objects.filter(is_deleted=False).filter(
            Q(vimeo_url='') | Q(vimeo_url__isnull=True))
        pick = base.filter(image_width__gte=F('image_height')).order_by('?').first() \
            or base.order_by('?').first()
        if pick:
            data['featured_image'] = FeaturedImageSerializer(pick, context={'request': request}).data
    return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user_upload_count(request):
    """Get count of images uploaded by the authenticated user"""
    count = request.user.uploaded_images.count()
    return Response({'count': count}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Image labeling agent API
# ---------------------------------------------------------------------------
# A scoped surface for an AI agent (authenticated with an X-Agent-Key, or a
# staff session) to review images and submit suggested labels. Suggestions are
# stored pending review; only a staff approval applies them to the live image.

# Heuristic for auto-generated / placeholder filenames worth relabeling.
_PLACEHOLDER_TITLE_RE = (
    r'^(img[_-]|dsc[_-]|dscf|pxl_|vid[_-]|mvimg|gopr|screenshot|image\d|photo\d|untitled|logo$)'
)


@api_view(['GET'])
@permission_classes([IsLabelingAgentOrStaff])
def labeling_queue(request):
    """Images for an agent to review. Cursor with ?after_id=, page with ?limit=.

    ?needs_label=true (default) restricts to blank or placeholder-named titles.
    Images that already have a pending/approved/applied suggestion are excluded
    so re-running the agent doesn't double-queue them.
    """
    try:
        limit = min(int(request.GET.get('limit', 50)), 200)
    except (TypeError, ValueError):
        limit = 50
    try:
        after_id = int(request.GET.get('after_id', 0))
    except (TypeError, ValueError):
        after_id = 0
    needs_label = request.GET.get('needs_label', 'true').lower() != 'false'

    qs = Image.objects.all().order_by('id')
    if after_id:
        qs = qs.filter(id__gt=after_id)

    already = ImageLabelSuggestion.objects.filter(
        status__in=['pending', 'approved', 'applied']
    ).values_list('image_id', flat=True)
    qs = qs.exclude(id__in=already)

    if needs_label:
        qs = qs.filter(Q(title='') | Q(title__isnull=True) | Q(title__iregex=_PLACEHOLDER_TITLE_RE))

    images = list(qs[:limit])
    data = LabelingImageSerializer(images, many=True, context={'request': request}).data
    return Response({
        'results': data,
        'count_returned': len(data),
        'next_after_id': images[-1].id if images else None,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsLabelingAgentOrStaff])
def create_label_suggestion(request, image_id):
    """Submit one agent label suggestion for an image (stored as pending)."""
    try:
        image = Image.objects.get(pk=image_id)
    except Image.DoesNotExist:
        return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = LabelSuggestionInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # Attribute the suggestion: explicit source > agent key name > staff user.
    agent_key = getattr(request, 'agent_key', None)
    source = data.get('source') or (agent_key.name if agent_key else None)
    if not source:
        source = f'staff:{request.user.username}' if request.user.is_authenticated else 'agent'

    suggestion = ImageLabelSuggestion.objects.create(
        image=image,
        suggested_title=data.get('suggested_title', ''),
        suggested_description=data.get('suggested_description', ''),
        suggested_tags=data.get('suggested_tags', []),
        confidence=data.get('confidence'),
        rationale=data.get('rationale', ''),
        source=source[:64],
        status='pending',
    )
    return Response(
        ImageLabelSuggestionSerializer(suggestion).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsLabelingAgentOrStaff])
def list_label_suggestions(request):
    """List suggestions for review. Filter with ?status= and ?image=."""
    qs = ImageLabelSuggestion.objects.select_related('image', 'reviewed_by').all()
    status_filter = request.GET.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)
    image_filter = request.GET.get('image')
    if image_filter:
        qs = qs.filter(image_id=image_filter)
    try:
        limit = min(int(request.GET.get('limit', 100)), 500)
    except (TypeError, ValueError):
        limit = 100
    data = ImageLabelSuggestionSerializer(qs[:limit], many=True, context={'request': request}).data
    return Response({'results': data, 'count_returned': len(data)}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def approve_label_suggestion(request, pk):
    """Apply a pending suggestion to its image (staff only — the trust gate)."""
    try:
        suggestion = ImageLabelSuggestion.objects.select_related('image').get(pk=pk)
    except ImageLabelSuggestion.DoesNotExist:
        return Response({'error': 'Suggestion not found'}, status=status.HTTP_404_NOT_FOUND)
    if suggestion.status not in ('pending', 'approved'):
        return Response(
            {'error': f'Cannot apply a suggestion in status "{suggestion.status}".'},
            status=status.HTTP_409_CONFLICT,
        )
    suggestion.apply(reviewer=request.user)
    return Response(ImageLabelSuggestionSerializer(suggestion, context={'request': request}).data,
                    status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def reject_label_suggestion(request, pk):
    """Reject a pending suggestion (staff only)."""
    try:
        suggestion = ImageLabelSuggestion.objects.get(pk=pk)
    except ImageLabelSuggestion.DoesNotExist:
        return Response({'error': 'Suggestion not found'}, status=status.HTTP_404_NOT_FOUND)
    suggestion.reject(reviewer=request.user)
    return Response(ImageLabelSuggestionSerializer(suggestion, context={'request': request}).data,
                    status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsLabelingAgentOrStaff])
def suggest_labels(request, image_id):
    """Server-side: ask Claude to caption one image now (synchronous).

    Creates a pending suggestion the same as the agent path. Returns 503 if the
    Anthropic API key / SDK isn't configured on the server.
    """
    try:
        Image.objects.get(pk=image_id)
    except Image.DoesNotExist:
        return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)
    try:
        suggestion = generate_label_suggestion(
            image_id,
            model=request.data.get('model'),
            max_tags=request.data.get('max_tags'),
            existing_tags_only=bool(request.data.get('existing_tags_only', False)),
            provider=request.data.get('provider'),
        )
    except LabelingNotConfigured as exc:
        return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response(
        ImageLabelSuggestionSerializer(suggestion, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([IsLabelingAgentOrStaff])
def generate_labels_bulk(request, *args, **kwargs):
    """Server-side: enqueue Claude label generation for the labeling queue.

    Uses the django-q task queue (a qcluster worker must be running). Returns the
    number of images enqueued. Honors the same ?needs_label / ?limit filters as
    the queue endpoint.
    """
    if not os.environ.get('ANTHROPIC_API_KEY'):
        return Response({'error': 'ANTHROPIC_API_KEY is not set.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    try:
        from django_q.tasks import async_task
    except ImportError:
        return Response({'error': 'django-q is not installed.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        limit = min(int(request.GET.get('limit', 25)), 200)
    except (TypeError, ValueError):
        limit = 25
    needs_label = request.GET.get('needs_label', 'true').lower() != 'false'
    model = request.data.get('model') or None

    already = ImageLabelSuggestion.objects.filter(
        status__in=['pending', 'approved', 'applied']
    ).values_list('image_id', flat=True)
    qs = Image.objects.exclude(id__in=already).order_by('id')
    if needs_label:
        qs = qs.filter(Q(title='') | Q(title__isnull=True) | Q(title__iregex=_PLACEHOLDER_TITLE_RE))

    image_ids = list(qs.values_list('id', flat=True)[:limit])
    for image_id in image_ids:
        async_task('images.labeling.generate_label_suggestion', image_id, model)

    return Response(
        {'enqueued': len(image_ids), 'image_ids': image_ids},
        status=status.HTTP_202_ACCEPTED,
    )


# ---------------------------------------------------------------------------
# Staff dashboard: synchronous, client-driven batch runners. Each returns the
# same shape — {scanned, created, next_after_id, done, detail[]} — so one React
# loop can drive any of them by paging on next_after_id until done is true.
# ---------------------------------------------------------------------------

def _unhandled_image_qs(after_id=0):
    """Images with no pending/approved/applied suggestion, ordered by id."""
    handled = ImageLabelSuggestion.objects.filter(
        status__in=['pending', 'approved', 'applied']
    ).values_list('image_id', flat=True)
    qs = Image.objects.exclude(id__in=handled).order_by('id')
    if after_id:
        qs = qs.filter(id__gt=after_id)
    return qs


def _batch_params(request, default_limit, max_limit):
    try:
        limit = min(int(request.GET.get('limit', default_limit)), max_limit)
    except (TypeError, ValueError):
        limit = default_limit
    try:
        after_id = int(request.GET.get('after_id', 0))
    except (TypeError, ValueError):
        after_id = 0
    return limit, after_id


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def labeling_stats(request):
    """Counts for the staff dashboard header and runner progress denominators."""
    from . import providers
    handled = ImageLabelSuggestion.objects.filter(
        status__in=['pending', 'approved', 'applied']
    ).values_list('image_id', flat=True)
    person_tagged = Image.objects.filter(tags__kind=Tag.PERSON).values_list('id', flat=True)
    known_people = Tag.objects.filter(kind=Tag.PERSON, images__isnull=False).distinct().count()
    configured = providers.configured_providers()
    return Response({
        'images_total': Image.objects.count(),
        'images_untagged': Image.objects.filter(tags__isnull=True).count(),
        'caption_queue': Image.objects.exclude(id__in=handled).filter(
            Q(title='') | Q(title__isnull=True) | Q(title__iregex=_PLACEHOLDER_TITLE_RE)
        ).count(),
        'match_candidates': Image.objects.exclude(id__in=handled).exclude(
            id__in=person_tagged).count(),
        'propagate_candidates': Image.objects.exclude(id__in=handled).filter(
            tags__isnull=True).count(),
        'pending_suggestions': ImageLabelSuggestion.objects.filter(status='pending').count(),
        'known_people': known_people,
        'anthropic_configured': configured.get('anthropic', False),
        'providers': configured,
        'default_provider': providers.default_provider(),
        # People-matching is Anthropic-only for now.
        'matching_configured': configured.get('anthropic', False),
    }, status=status.HTTP_200_OK)


@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAdminUser])
def labeling_prompts(request):
    """Read/update the editable AI prompts (caption + people-matching).

    Blank stored value means "use the built-in default" (also returned, so the
    dashboard can show it and offer reset/edit-from-default).
    """
    from .labeling import SYSTEM_PROMPT
    from .matching import MATCH_SYSTEM_PROMPT
    cfg = SiteConfiguration.get_solo()
    if request.method == 'PUT':
        if 'caption_prompt' in request.data:
            cfg.caption_prompt = (request.data.get('caption_prompt') or '').strip()
        if 'match_prompt' in request.data:
            cfg.match_prompt = (request.data.get('match_prompt') or '').strip()
        cfg.save()
    return Response({
        'caption_prompt': cfg.caption_prompt,
        'match_prompt': cfg.match_prompt,
        'caption_default': SYSTEM_PROMPT,
        'match_default': MATCH_SYSTEM_PROMPT,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def generate_labels_batch(request):
    """Caption a small batch synchronously (no worker needed). Pages by after_id."""
    from . import providers
    provider = providers.normalize(request.data.get('provider')) or providers.default_provider()
    if not providers.configured_providers().get(provider):
        return Response({'error': f'{providers.KEY_ENV[provider]} is not set.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    limit, after_id = _batch_params(request, default_limit=3, max_limit=10)
    needs_label = request.GET.get('needs_label', 'true').lower() != 'false'
    model = request.data.get('model') or None
    max_tags = request.data.get('max_tags')
    existing_only = bool(request.data.get('existing_tags_only', False))

    qs = _unhandled_image_qs(after_id)
    if needs_label:
        qs = qs.filter(Q(title='') | Q(title__isnull=True) | Q(title__iregex=_PLACEHOLDER_TITLE_RE))
    images = list(qs[:limit])

    detail, created = [], 0
    for img in images:
        try:
            s = generate_label_suggestion(img.id, model=model, max_tags=max_tags,
                                          existing_tags_only=existing_only, provider=provider)
            created += 1
            detail.append({'image': img.id, 'title': s.suggested_title, 'tags': s.suggested_tags})
        except LabelingNotConfigured as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as exc:
            detail.append({'image': img.id, 'error': str(exc)})
    return Response({
        'scanned': len(images), 'created': created,
        'next_after_id': images[-1].id if images else after_id,
        'done': len(images) < limit, 'detail': detail,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def match_people_batch(request):
    """Match known (person-tagged) people into a batch of untagged photos."""
    if not os.environ.get('ANTHROPIC_API_KEY'):
        return Response({'error': 'ANTHROPIC_API_KEY is not set.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    from .matching import (
        build_people_references, match_people_in_image, create_match_suggestion,
        effective_match_prompt,
    )
    try:
        import anthropic
    except ImportError:
        return Response({'error': 'anthropic SDK not installed.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    limit, after_id = _batch_params(request, default_limit=4, max_limit=10)
    try:
        min_conf = float(request.data.get('min_confidence', 0.6))
    except (TypeError, ValueError):
        min_conf = 0.6
    model = request.data.get('model') or os.environ.get('ANTHROPIC_LABELING_MODEL', 'claude-opus-4-8')

    reference_content, known, people = build_people_references(
        refs_per_person=int(request.data.get('refs_per_person', 2)))
    if not known:
        return Response({'error': 'No person-tagged reference photos. Tag people first '
                                  '(set a tag\'s kind to "Person").'},
                        status=status.HTTP_400_BAD_REQUEST)

    person_tagged = Image.objects.filter(tags__kind=Tag.PERSON).values_list('id', flat=True)
    images = list(_unhandled_image_qs(after_id).exclude(id__in=person_tagged)[:limit])

    client = anthropic.Anthropic()
    system_prompt = effective_match_prompt()
    detail, created = [], 0
    for img in images:
        try:
            matches = match_people_in_image(img, client=client, model=model,
                                            reference_content=reference_content,
                                            known=known, min_confidence=min_conf,
                                            system_prompt=system_prompt)
        except Exception as exc:
            detail.append({'image': img.id, 'error': str(exc)})
            continue
        if matches:
            create_match_suggestion(img, matches)
            created += 1
            detail.append({'image': img.id, 'matches': [n for n, _ in matches]})
    return Response({
        'scanned': len(images), 'created': created,
        'next_after_id': images[-1].id if images else after_id,
        'done': len(images) < limit, 'detail': detail, 'known_people': people,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def propagate_labels_batch(request):
    """Copy tags to a batch of near-duplicate untagged photos (no API needed)."""
    limit, after_id = _batch_params(request, default_limit=25, max_limit=200)
    try:
        max_distance = int(request.data.get('max_distance', 8))
    except (TypeError, ValueError):
        max_distance = 8

    refs = tagged_reference_hashes()
    if not refs:
        return Response({'error': 'No tagged reference images yet. Tag a few photos first.'},
                        status=status.HTTP_400_BAD_REQUEST)

    images = list(_unhandled_image_qs(after_id).filter(tags__isnull=True)[:limit])
    detail, created = [], 0
    for img in images:
        h = image_phash(img)
        if h is None:
            continue
        match = nearest_reference(h, refs, max_distance)
        if match is None:
            continue
        best_id, best_tags, best_d = match
        ImageLabelSuggestion.objects.create(
            image=img, suggested_tags=best_tags,
            confidence=round(max(0.0, 1 - best_d / 32.0), 2),
            rationale=f'Near-duplicate of image #{best_id} (hash distance {best_d}); copied its tags.',
            source=f'near-dup:{best_id}'[:64], status='pending',
        )
        created += 1
        detail.append({'image': img.id, 'matched': best_id, 'distance': best_d, 'tags': best_tags})
    return Response({
        'scanned': len(images), 'created': created,
        'next_after_id': images[-1].id if images else after_id,
        'done': len(images) < limit, 'detail': detail,
    }, status=status.HTTP_200_OK)


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
        
        # Validate new password using Django's password validators
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response({
                'error': e.messages[0] if e.messages else 'Password does not meet requirements'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update password
        user.set_password(new_password)
        user.save()
        
        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:

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
            logger.error(f'Failed to send verification email: {email_error}')
            return Response({
                'error': 'Failed to send email. Please try again later.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:

        logger.error(f'Failed to send verification email: {str(e)}')
        return Response({
            'error': 'Failed to send verification email'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
def verify_email(request):
    """Verify email using token"""
    try:
        token = request.data.get('token')
        
        if not token:
            return Response({
                'error': 'Token is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        token_obj = EmailVerificationToken.verify_token(token)
        if not token_obj:
            return Response({
                'error': 'Invalid or expired verification token'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        token_obj.is_used = True
        token_obj.save()
        
        return Response({
            'message': 'Email verified successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:

        logger.error(f'Email verification failed: {str(e)}')
        return Response({
            'error': 'Email verification failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@ratelimit(key='ip', rate='3/m', method='POST', block=True)
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

            logger.error(f'Failed to send password reset email: {str(email_error)}')
        
        return Response({
            'message': 'If an account exists with this email, a password reset link will be sent'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:

        logger.error(f'Password reset request failed: {str(e)}')
        return Response({
            'error': 'Failed to process password reset request'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
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

        # Validate new password using Django's password validators
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response({
                'error': e.messages[0] if e.messages else 'Password does not meet requirements'
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        token_obj.is_used = True
        token_obj.save()
        
        return Response({
            'message': 'Password reset successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:

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
        logger.error(f'Error serving frontend: {e}')
        return HttpResponse("Server error", status=500)


def ratelimited_view(request, exception):
    """Handler for rate-limited requests"""
    return JsonResponse(
        {'error': 'Too many requests. Please try again later.'},
        status=429
    )
