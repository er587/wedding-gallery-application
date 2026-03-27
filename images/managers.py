"""Custom model managers for soft-delete support."""
from django.db import models


class ImageManager(models.Manager):
    """Default manager that excludes soft-deleted images."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class ImageAllManager(models.Manager):
    """Manager that includes soft-deleted images (for admin use)."""
    pass
