from django.contrib.auth.models import User
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import datetime
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


class Image(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    image_file = models.ImageField(upload_to=get_image_upload_path)
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
    code = models.CharField(max_length=20, unique=True)
    is_used = models.BooleanField(default=False)
    used_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='used_invitation'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_invitations'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, help_text="Admin notes about this invitation")
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        status = "Used" if self.is_used else "Available"
        return f"{self.code} ({status})"
    
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