"""Background tasks for image processing (face detection, thumbnails, Vimeo).

These tasks are executed by Django-Q2 workers instead of daemon threads,
providing retry logic, error tracking, and admin visibility.

Run the worker with: python manage.py qcluster
"""
import logging

logger = logging.getLogger(__name__)


def process_face_detection(image_id):
    """Detect faces in an uploaded image and store normalized coordinates."""
    from .models import Image
    try:
        image = Image.objects.get(id=image_id)
        image.detect_and_store_face_coordinates()
        logger.info("Face detection completed for image %s", image_id)
    except Image.DoesNotExist:
        logger.warning("Image %s not found for face detection", image_id)
    except Exception as e:
        logger.error("Face detection failed for image %s: %s", image_id, e)
        raise  # Re-raise so Django-Q marks the task as failed and can retry


def fetch_vimeo_thumbnail(image_id):
    """Fetch thumbnail from Vimeo oEmbed API for a video entry."""
    from .models import Image
    try:
        image = Image.objects.get(id=image_id)
        image.fetch_vimeo_thumbnail()
        logger.info("Vimeo thumbnail fetched for image %s", image_id)
    except Image.DoesNotExist:
        logger.warning("Image %s not found for Vimeo thumbnail", image_id)
    except Exception as e:
        logger.error("Vimeo thumbnail fetch failed for image %s: %s", image_id, e)
        raise


def generate_thumbnail(image_id):
    """Generate a smart-cropped thumbnail for an uploaded image."""
    from .models import Image
    try:
        image = Image.objects.get(id=image_id)
        image.create_thumbnail()
        logger.info("Thumbnail generated for image %s", image_id)
    except Image.DoesNotExist:
        logger.warning("Image %s not found for thumbnail generation", image_id)
    except Exception as e:
        logger.error("Thumbnail generation failed for image %s: %s", image_id, e)
        raise
