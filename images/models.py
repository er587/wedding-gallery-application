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
        """Override save to generate thumbnail"""
        super().save(*args, **kwargs)
        
        # Generate thumbnail if image_file exists but thumbnail doesn't
        if self.image_file and not self.thumbnail:
            self.create_thumbnail()
    
    def create_thumbnail(self):
        """Create a thumbnail version of the image"""
        if not self.image_file:
            return
            
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
            print(f"Error creating thumbnail for image {self.id}: {e}")


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