from django.contrib.auth.models import User
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import datetime
from PIL import Image as PILImage
from io import BytesIO
from django.core.files.base import ContentFile
import os
import secrets
import string


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
    image_file = models.ImageField(upload_to=get_image_upload_path)
    thumbnail = models.ImageField(upload_to=get_thumbnail_upload_path, blank=True, null=True)
    
    # Face detection coordinates for smart cropping (normalized 0-1)
    face_x = models.FloatField(null=True, blank=True, help_text="Face center X coordinate (0-1)")
    face_y = models.FloatField(null=True, blank=True, help_text="Face center Y coordinate (0-1)")
    face_width = models.FloatField(null=True, blank=True, help_text="Face width (0-1)")
    face_height = models.FloatField(null=True, blank=True, help_text="Face height (0-1)")
    
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='uploaded_images'
    )
    tags = models.ManyToManyField('Tag', blank=True, related_name='images')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-uploaded_at']
        
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        """Override save to detect faces and store coordinates"""
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        # Detect and store face coordinates if this is a new image
        if is_new and self.image_file and self.face_x is None:
            self.detect_and_store_face_coordinates()
        
        # Legacy: Generate thumbnail if image_file exists but thumbnail doesn't
        # (will be deprecated once easy-thumbnails is fully integrated)
        if self.image_file and not self.thumbnail:
            self.create_thumbnail()
    
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
            print(f"Error detecting face for image {self.id}: {e}")
    
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
            pil_image.save(thumb_io, format='JPEG', quality=85, optimize=True)
            thumb_io.seek(0)
            
            # Generate thumbnail filename
            original_name = os.path.basename(self.image_file.name)
            name, ext = os.path.splitext(original_name)
            thumbnail_name = f'{name}_thumb.jpg'
            
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
            print(f"OpenCV not available, using basic thumbnail for image {self.id}")
            return self._create_basic_thumbnail()
        except Exception as e:
            print(f"Error creating smart thumbnail for image {self.id}: {e}")
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
                thumbnail_name = f'{name}_thumb.jpg'
                
                # Save thumbnail
                self.thumbnail.save(
                    thumbnail_name,
                    ContentFile(thumb_io.getvalue()),
                    save=False
                )
                
                # Save the model again to save the thumbnail field
                super().save(update_fields=['thumbnail'])
                
        except Exception as e:
            print(f"Error creating basic thumbnail for image {self.id}: {e}")


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
    
    class Meta:
        ordering = ['created_at']
        
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