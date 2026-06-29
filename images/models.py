import logging
import os
import re
import secrets
import string
import threading
from datetime import datetime, timedelta
from io import BytesIO

import requests
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from PIL import Image as PILImage

from .managers import ImageAllManager, ImageManager

logger = logging.getLogger(__name__)


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('full', 'Full User'),  # Can upload, delete, and comment
        ('memory', 'Memory User'),  # Can only comment on images
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='full')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"
    
    @property
    def can_upload_images(self):
        return self.role == 'full'
    
    @property 
    def can_delete_images(self):
        return self.role == 'full'
    
    @property
    def can_comment(self):
        return True  # All users can comment


def get_image_upload_path(instance, filename):
    """Generate upload path for images"""
    ext = filename.split('.')[-1]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return f'images/{instance.uploader.username}/{timestamp}_{filename}'

def get_thumbnail_upload_path(instance, filename):
    """Generate upload path for thumbnails"""
    ext = filename.split('.')[-1]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return f'images/{instance.uploader.username}/thumbnails/{timestamp}_{filename}'


class Image(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    image_file = models.ImageField(upload_to=get_image_upload_path, blank=True, null=True)
    thumbnail = models.ImageField(upload_to=get_thumbnail_upload_path, blank=True, null=True)
    
    # Vimeo embed URL for videos (domain-level privacy links)
    vimeo_url = models.URLField(blank=True, null=True, help_text="Vimeo embed URL with domain-level privacy")
    
    # Manual cover image for videos (takes priority over auto-fetched Vimeo thumbnail)
    cover_image = models.ImageField(upload_to=get_image_upload_path, blank=True, null=True, help_text="Optional cover image for videos")
    
    # Face detection coordinates for smart cropping (normalized 0-1)
    face_x = models.FloatField(null=True, blank=True, help_text="Face center X coordinate (0-1)")
    face_y = models.FloatField(null=True, blank=True, help_text="Face center Y coordinate (0-1)")
    face_width = models.FloatField(null=True, blank=True, help_text="Face width (0-1)")
    face_height = models.FloatField(null=True, blank=True, help_text="Face height (0-1)")

    # Original image dimensions for masonry layout
    image_width = models.PositiveIntegerField(null=True, blank=True, help_text="Original image width in pixels")
    image_height = models.PositiveIntegerField(null=True, blank=True, help_text="Original image height in pixels")

    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='uploaded_images'
    )
    tags = models.ManyToManyField('Tag', blank=True, related_name='images')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='deleted_images',
    )

    # Default manager filters out soft-deleted images; all_objects includes them
    objects = ImageManager()
    all_objects = ImageAllManager()

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['-uploaded_at']),
            models.Index(fields=['uploader']),
        ]

    @property
    def is_video(self):
        """Check if this entry is a video (has vimeo_url)"""
        return bool(self.vimeo_url)
        
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        """Override save - extract dimensions and dispatch background processing."""
        is_new = self.pk is None
        super().save(*args, **kwargs)

        # Extract image dimensions for masonry layout (fast — reads header only)
        if is_new and self.image_file and self.image_width is None:
            try:
                with PILImage.open(self.image_file.path) as img:
                    self.image_width, self.image_height = img.size
                super(Image, self).save(update_fields=['image_width', 'image_height'])
            except Exception as e:
                logger.error("Error reading dimensions for image %s: %s", self.id, e)

        # Fetch Vimeo thumbnail if this is a video and no thumbnail exists
        if is_new and self.vimeo_url and not self.thumbnail:
            threading.Thread(target=self._async_fetch_vimeo_thumbnail, daemon=True).start()

        # Move face detection to background thread to prevent blocking upload
        if is_new and self.image_file and self.face_x is None:
            threading.Thread(target=self._async_detect_and_store_face_coordinates, daemon=True).start()

        # Generate thumbnail if image_file exists but thumbnail doesn't
        if self.image_file and not self.thumbnail:
            threading.Thread(target=self.create_thumbnail, daemon=True).start()
    
    def _async_fetch_vimeo_thumbnail(self):
        """Async wrapper for Vimeo thumbnail fetching - runs in background thread"""
        try:
            self.fetch_vimeo_thumbnail()
        except Exception as e:
            logger.error("Error fetching Vimeo thumbnail for image %s: %s", self.id, e)
    
    def _async_detect_and_store_face_coordinates(self):
        """Async wrapper for face detection - runs in background thread"""
        try:
            self.detect_and_store_face_coordinates()
        except Exception as e:
            logger.error("Error in async face detection for image %s: %s", self.id, e)
    
    def detect_and_store_face_coordinates(self):
        """Detect faces and store normalized coordinates for smart cropping"""
        if not self.image_file:
            return
            
        try:
            import cv2
            
            # Load image with OpenCV for face detection
            cv_image = cv2.imread(self.image_file.path)
            if cv_image is None:
                return
            
            # Detect faces in the image
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            if len(faces) > 0:
                # Get the largest face
                largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
                x, y, w, h = largest_face
                
                # Normalize coordinates (0-1) based on image dimensions
                img_height, img_width = cv_image.shape[:2]
                self.face_x = (x + w/2) / img_width  # Center X
                self.face_y = (y + h/2) / img_height  # Center Y
                self.face_width = w / img_width
                self.face_height = h / img_height
                
                # Save face coordinates without triggering recursion
                super(Image, self).save(update_fields=['face_x', 'face_y', 'face_width', 'face_height'])
                
        except ImportError:
            # OpenCV not available - skip face detection
            pass
        except Exception as e:
            logger.error("Error detecting face for image %s: %s", self.id, e)
    
    def create_thumbnail(self):
        """Create a smart thumbnail version of the image with face detection"""
        if not self.image_file:
            return
            
        try:
            import cv2
            import numpy as np
            
            # Load image with OpenCV for face detection
            cv_image = cv2.imread(self.image_file.path)
            if cv_image is None:
                # Fallback to basic thumbnail if OpenCV can't read the image
                return self._create_basic_thumbnail()
            
            # Detect faces in the image
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            thumbnail_size = 300
            
            if len(faces) > 0:
                # Face detected - create smart crop centered on the largest face
                largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
                x, y, w, h = largest_face
                
                # Calculate center of the face
                face_center_x = x + w // 2
                face_center_y = y + h // 2
                
                # Calculate crop area (square) centered on face
                img_height, img_width = cv_image.shape[:2]
                
                # Determine crop size (use smaller of image dimensions or desired size)
                crop_size = min(thumbnail_size * 2, img_width, img_height)  # Use 2x for better quality
                half_crop = crop_size // 2
                
                # Calculate crop boundaries, ensuring they stay within image
                crop_x1 = max(0, min(face_center_x - half_crop, img_width - crop_size))
                crop_y1 = max(0, min(face_center_y - half_crop, img_height - crop_size))
                crop_x2 = crop_x1 + crop_size
                crop_y2 = crop_y1 + crop_size
                
                # Crop the image
                cropped = cv_image[crop_y1:crop_y2, crop_x1:crop_x2]
                
                # Resize to thumbnail size
                resized = cv2.resize(cropped, (thumbnail_size, thumbnail_size), interpolation=cv2.INTER_AREA)
                
                # Convert back to PIL format
                rgb_image = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
                pil_image = PILImage.fromarray(rgb_image)
                
            else:
                # No faces detected - use center crop
                pil_image = self._create_center_crop(cv_image, thumbnail_size)
            
            # Save to BytesIO
            thumb_io = BytesIO()
            pil_image.save(thumb_io, format='WEBP', quality=80)
            thumb_io.seek(0)
            
            # Generate thumbnail filename
            original_name = os.path.basename(self.image_file.name)
            name, ext = os.path.splitext(original_name)
            thumbnail_name = f'{name}_thumb.webp'
            
            # Save thumbnail
            self.thumbnail.save(
                thumbnail_name,
                ContentFile(thumb_io.getvalue()),
                save=False
            )
            
            # Save the model again to save the thumbnail field
            super().save(update_fields=['thumbnail'])
            
        except ImportError:
            # OpenCV not available - fallback to basic thumbnail
            logger.warning("OpenCV not available, using basic thumbnail for image %s", self.id)
            return self._create_basic_thumbnail()
        except Exception as e:
            logger.error("Error creating smart thumbnail for image %s: %s", self.id, e)
            # Try fallback to basic thumbnail
            return self._create_basic_thumbnail()
    
    def _create_center_crop(self, cv_image, size):
        """Create center-cropped thumbnail from OpenCV image"""
        import cv2
        
        img_height, img_width = cv_image.shape[:2]
        
        # Calculate center crop
        crop_size = min(img_width, img_height)
        center_x, center_y = img_width // 2, img_height // 2
        half_crop = crop_size // 2
        
        # Crop to square from center
        cropped = cv_image[
            center_y - half_crop:center_y + half_crop,
            center_x - half_crop:center_x + half_crop
        ]
        
        # Resize to target size
        resized = cv2.resize(cropped, (size, size), interpolation=cv2.INTER_AREA)
        
        # Convert to PIL
        rgb_image = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        return PILImage.fromarray(rgb_image)
    
    def fetch_vimeo_thumbnail(self):
        """Fetch thumbnail image from Vimeo using oEmbed API"""
        if not self.vimeo_url:
            return
        
        try:
            # Extract video ID from Vimeo player URL
            video_id = self._extract_vimeo_id(self.vimeo_url)
            if not video_id:
                logger.warning("Could not extract video ID from URL: %s", self.vimeo_url)
                return
            
            # Get domain for Referer header (needed for domain-restricted videos)
            # Use production domain first (this is whitelisted on Vimeo for domain-restricted videos)
            frontend_url = os.environ.get('FRONTEND_URL', '')
            if frontend_url:
                referer = frontend_url
            else:
                # Use the production domain - this is whitelisted on Vimeo
                referer = "https://reneeanderic.wedding"
            
            # Fetch thumbnail URL from Vimeo oEmbed API
            # Include Referer header for domain-restricted videos
            oembed_url = f"https://vimeo.com/api/oembed.json?url=https://vimeo.com/{video_id}&width=640"
            headers = {'Referer': referer}
            response = requests.get(oembed_url, headers=headers, timeout=10)
            
            if response.status_code != 200:
                logger.warning("Vimeo oEmbed API returned status %s for video %s", response.status_code, video_id)
                return
            
            data = response.json()
            thumbnail_url = data.get('thumbnail_url')
            
            if not thumbnail_url:
                logger.warning("No thumbnail URL in Vimeo response for video %s", video_id)
                return
            
            # Download the thumbnail image
            thumb_response = requests.get(thumbnail_url, timeout=10)
            if thumb_response.status_code != 200:
                logger.warning("Failed to download thumbnail from %s", thumbnail_url)
                return
            
            # Save thumbnail to model
            thumbnail_name = f"vimeo_{video_id}_thumb.webp"
            self.thumbnail.save(
                thumbnail_name,
                ContentFile(thumb_response.content),
                save=False
            )
            
            # Update the model
            super().save(update_fields=['thumbnail'])
            logger.info("Successfully fetched Vimeo thumbnail for video %s", video_id)
            
        except requests.RequestException as e:
            logger.error("Error fetching Vimeo thumbnail: %s", e)
        except Exception as e:
            logger.error("Unexpected error fetching Vimeo thumbnail: %s", e)
    
    def _extract_vimeo_id(self, url):
        """Extract Vimeo video ID from player URL"""
        # Matches URLs like:
        # https://player.vimeo.com/video/123456789
        # https://vimeo.com/123456789
        match = re.search(r'(?:vimeo\.com/(?:video/)?|player\.vimeo\.com/video/)(\d+)', url)
        return match.group(1) if match else None
    
    def _create_basic_thumbnail(self):
        """Fallback basic thumbnail creation using PIL only"""
        try:
            # Open the image file
            with PILImage.open(self.image_file.path) as image:
                # Convert RGBA to RGB if necessary (for PNG files with transparency)
                if image.mode in ('RGBA', 'LA', 'P'):
                    background = PILImage.new('RGB', image.size, (255, 255, 255))
                    if image.mode == 'P':
                        image = image.convert('RGBA')
                    if 'transparency' in image.info:
                        background.paste(image, mask=image.split()[-1])
                    else:
                        background.paste(image)
                    image = background
                
                # Calculate thumbnail size maintaining aspect ratio
                # Max dimensions: 300x300 pixels
                image.thumbnail((300, 300), PILImage.Resampling.LANCZOS)
                
                # Save to BytesIO
                thumb_io = BytesIO()
                image.save(thumb_io, format='JPEG', quality=85, optimize=True)
                thumb_io.seek(0)
                
                # Generate thumbnail filename
                original_name = os.path.basename(self.image_file.name)
                name, ext = os.path.splitext(original_name)
                thumbnail_name = f'{name}_thumb.webp'
                
                # Save thumbnail
                self.thumbnail.save(
                    thumbnail_name,
                    ContentFile(thumb_io.getvalue()),
                    save=False
                )
                
                # Save the model again to save the thumbnail field
                super().save(update_fields=['thumbnail'])
                
        except Exception as e:
            logger.error("Error creating basic thumbnail for image %s: %s", self.id, e)


class Comment(models.Model):
    image = models.ForeignKey(
        Image,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    content = models.TextField()
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Moderation fields
    is_flagged = models.BooleanField(default=False)
    flag_count = models.PositiveIntegerField(default=0)
    flagged_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name='flagged_comments'
    )
    is_hidden = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['image', 'created_at']),
        ]
        
    def __str__(self):
        return f'Comment by {self.author.username} on {self.image.title}'
    
    @property
    def is_reply(self):
        return self.parent is not None


# Signal to create UserProfile automatically when User is created
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created and not hasattr(instance, 'profile'):
        try:
            UserProfile.objects.create(user=instance)
        except:
            # Profile already exists, skip creation
            pass

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
    else:
        # Only create if one doesn't exist
        if not UserProfile.objects.filter(user=instance).exists():
            UserProfile.objects.create(user=instance)


class InvitationCode(models.Model):
    """Invitation codes for user registration"""
    ROLE_CHOICES = [
        ('full', 'Full User'),  # Can upload, delete, and comment
        ('memory', 'Memory User'),  # Can only comment on images
    ]
    
    code = models.CharField(max_length=20, unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='full')
    is_active = models.BooleanField(default=True, help_text="Whether this code can be used for new registrations")
    usage_count = models.IntegerField(default=0, help_text="Number of times this code has been used")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_invitations'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, help_text="Admin notes about this invitation")
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        status = "Active" if self.is_active else "Inactive"
        role_display = self.get_role_display()
        return f"{self.code} ({role_display}, {status}, Used: {self.usage_count})"
    
    @classmethod
    def generate_code(cls):
        """Generate a unique invitation code"""
        while True:
            # Generate 8-character code with uppercase letters and numbers
            code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            if not cls.objects.filter(code=code).exists():
                return code


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Like(models.Model):
    """User likes/favorites for images"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    image = models.ForeignKey(
        Image,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'image']  # Prevent duplicate likes
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} likes {self.image.title}"


class EmailVerificationToken(models.Model):
    """Token for email verification (used for password recovery)"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_verification_tokens'
    )
    token_prefix = models.CharField(max_length=16, db_index=True, default='')
    token_hash = models.CharField(max_length=128, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Email verification for {self.user.email}"

    @classmethod
    def generate_token(cls, user):
        """Generate a unique verification token for a user and return raw token"""
        raw_token = secrets.token_urlsafe(48)
        token_hash = make_password(raw_token)
        expires_at = timezone.now() + timedelta(hours=24)

        token_obj = cls.objects.create(
            user=user,
            token_prefix=raw_token[:16],
            token_hash=token_hash,
            expires_at=expires_at
        )

        token_obj.raw_token = raw_token
        return token_obj

    @classmethod
    def verify_token(cls, raw_token):
        """Verify a token and return the token object if valid.
        Uses token_prefix for O(1) DB lookup instead of scanning all tokens."""
        prefix = raw_token[:16]
        for token_obj in cls.objects.filter(
            token_prefix=prefix, is_used=False, expires_at__gt=timezone.now()
        ):
            if check_password(raw_token, token_obj.token_hash):
                return token_obj
        return None

    def is_valid(self):
        """Check if token is still valid"""
        return not self.is_used and timezone.now() < self.expires_at


class PasswordResetToken(models.Model):
    """Token for password reset"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token_prefix = models.CharField(max_length=16, db_index=True, default='')
    token_hash = models.CharField(max_length=128, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Password reset for {self.user.email}"

    @classmethod
    def generate_token(cls, user):
        """Generate a unique password reset token for a user and return raw token"""
        raw_token = secrets.token_urlsafe(48)
        token_hash = make_password(raw_token)
        expires_at = timezone.now() + timedelta(hours=1)

        cls.objects.filter(user=user, is_used=False).update(is_used=True)

        token_obj = cls.objects.create(
            user=user,
            token_prefix=raw_token[:16],
            token_hash=token_hash,
            expires_at=expires_at
        )

        token_obj.raw_token = raw_token
        return token_obj

    @classmethod
    def verify_token(cls, raw_token):
        """Verify a token and return the token object if valid.
        Uses token_prefix for O(1) DB lookup instead of scanning all tokens."""
        prefix = raw_token[:16]
        for token_obj in cls.objects.filter(
            token_prefix=prefix, is_used=False, expires_at__gt=timezone.now()
        ):
            if check_password(raw_token, token_obj.token_hash):
                return token_obj
        return None

    def is_valid(self):
        """Check if token is still valid"""
        return not self.is_used and timezone.now() < self.expires_at

class GuestBookEntry(models.Model):
    """Digital guest book — text messages from wedding guests."""
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='guestbook_entries',
    )
    message = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Guest book entries'

    def __str__(self):
        return f"Guest book entry by {self.author.username}"


class MemorableDate(models.Model):
    """Admin-managed dates for anniversary email reminders."""
    DATE_TYPES = [
        ('wedding', 'Wedding Day'),
        ('proposal', 'Proposal'),
        ('honeymoon', 'Honeymoon'),
        ('custom', 'Custom'),
    ]
    date_type = models.CharField(max_length=20, choices=DATE_TYPES)
    date = models.DateField()
    label = models.CharField(max_length=100, blank=True, help_text="Custom label (for 'custom' type)")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )

    class Meta:
        ordering = ['date']

    def __str__(self):
        display = self.label if self.date_type == 'custom' and self.label else self.get_date_type_display()
        return f"{display} — {self.date}"


class SiteConfiguration(models.Model):
    """Singleton holding all wedding-/deployment-specific display content.

    Everything that personalizes the site (couple names, date, venue, the
    masthead/footer copy, and the featured-photo caption) lives here in the
    database rather than hardcoded in source — so the codebase can be shipped
    as open source with no personal information baked in, and each couple fills
    in their own details through the Django admin.
    """
    partner_one_name = models.CharField(max_length=80, blank=True, default='')
    partner_two_name = models.CharField(max_length=80, blank=True, default='')
    wedding_date = models.DateField(null=True, blank=True)
    venue_name = models.CharField(max_length=160, blank=True, default='')
    venue_url = models.URLField(blank=True, default='')
    location = models.CharField(
        max_length=160, blank=True, default='',
        help_text='City, State/Region — shown next to the date in the masthead.',
    )
    intro_text = models.TextField(
        blank=True, default='',
        help_text='Italic subtitle under the names on the gallery masthead.',
    )
    featured_image = models.ForeignKey(
        'Image', null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
        help_text='Large hero photo at the top of the gallery. '
                  'Leave empty to use the most-liked photo automatically.',
    )
    featured_title = models.CharField(
        max_length=120, blank=True, default='',
        help_text='Caption shown over the featured photo. Leave blank for no text overlay.',
    )
    featured_subtitle = models.CharField(max_length=160, blank=True, default='')
    site_domain = models.CharField(
        max_length=120, blank=True, default='',
        help_text='Shown in the footer, e.g. "yourwedding.com".',
    )
    footer_message = models.CharField(
        max_length=200, blank=True, default='With love, from our day to yours.',
    )
    labeling_context = models.TextField(
        blank=True, default='',
        help_text='Extra context for AI photo labeling — a description of the venue '
                  'and setting, season, notable features, etc. Not shown publicly; '
                  'fed to the model so captions can reference the location accurately.',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Site configuration'
        verbose_name_plural = 'Site configuration'

    def __str__(self):
        return self.couple_display or 'Site configuration'

    def save(self, *args, **kwargs):
        # Enforce a single row — this is a site-wide singleton.
        self.pk = 1
        super().save(*args, **kwargs)

    @property
    def couple_display(self):
        return ' & '.join(n for n in [self.partner_one_name, self.partner_two_name] if n)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class AgentApiKey(models.Model):
    """Scoped, hashed API key for headless agents that submit label suggestions.

    The raw key is shown exactly once at creation and only its hash is stored,
    so it can be issued and rotated independently of any admin password. Keys
    authorize only the labeling endpoints (see images.permissions).
    """
    name = models.CharField(max_length=100, help_text='Human label, e.g. "claude-labeler".')
    key_prefix = models.CharField(max_length=12, unique=True, db_index=True, editable=False)
    key_hash = models.CharField(max_length=255, editable=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.key_prefix}…)"

    @classmethod
    def issue(cls, name, created_by=None):
        """Create a key and return (instance, raw_key). The raw key is never stored."""
        prefix = secrets.token_hex(4)  # 8 chars, used for fast lookup
        secret = secrets.token_urlsafe(32)
        raw = f"{prefix}.{secret}"
        obj = cls.objects.create(
            name=name, key_prefix=prefix,
            key_hash=make_password(raw), created_by=created_by,
        )
        return obj, raw

    @classmethod
    def authenticate(cls, raw):
        """Return the matching active key (and stamp last_used_at), or None."""
        if not raw or '.' not in raw:
            return None
        prefix = raw.split('.', 1)[0]
        try:
            key = cls.objects.get(key_prefix=prefix, is_active=True)
        except cls.DoesNotExist:
            return None
        if not check_password(raw, key.key_hash):
            return None
        # Best-effort usage stamp; don't touch updated fields that don't exist.
        cls.objects.filter(pk=key.pk).update(last_used_at=timezone.now())
        return key


class ImageLabelSuggestion(models.Model):
    """An AI agent's proposed label for an image, pending human approval.

    Suggestions never change the live image until approved — the approval step
    is the trust boundary between automated labeling and guest-visible content.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('applied', 'Applied'),
    ]
    MAX_TAGS = 15

    image = models.ForeignKey(Image, on_delete=models.CASCADE, related_name='label_suggestions')
    suggested_title = models.CharField(max_length=255, blank=True, default='')
    suggested_description = models.TextField(blank=True, default='')
    suggested_tags = models.JSONField(default=list, blank=True)
    source = models.CharField(max_length=64, help_text='Producer, e.g. "claude-opus-4-8".')
    confidence = models.FloatField(null=True, blank=True)
    rationale = models.TextField(blank=True, default='', help_text='Why the agent chose this label.')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['image', 'status'])]

    def __str__(self):
        return f"[{self.status}] {self.suggested_title or '(no title)'} → image {self.image_id}"

    def apply(self, reviewer=None):
        """Write the suggested label onto the image and mark as applied."""
        img = self.image
        if self.suggested_title:
            img.title = self.suggested_title[:255]
        if self.suggested_description:
            img.description = self.suggested_description
        img.save(update_fields=['title', 'description', 'updated_at'])

        for raw_name in (self.suggested_tags or [])[:self.MAX_TAGS]:
            name = str(raw_name).strip().lower()[:50]
            if name:
                tag, _ = Tag.objects.get_or_create(name=name)
                img.tags.add(tag)

        self.status = 'applied'
        self.reviewed_by = reviewer
        self.reviewed_at = timezone.now()
        self.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])

    def reject(self, reviewer=None):
        self.status = 'rejected'
        self.reviewed_by = reviewer
        self.reviewed_at = timezone.now()
        self.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
