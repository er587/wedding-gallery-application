"""
Management command to backfill image dimensions, detect faces, and regenerate thumbnails.

Usage:
    python manage.py backfill_images              # Run all: dimensions + faces + thumbnails
    python manage.py backfill_images --dimensions  # Only backfill missing width/height
    python manage.py backfill_images --faces       # Only run face detection (OpenCV)
    python manage.py backfill_images --thumbnails  # Only regenerate thumbnails as WebP
    python manage.py backfill_images --dry-run     # Show what would be done without changes

Order matters when running all: dimensions → faces → thumbnails
(faces must run before thumbnails so face data is available for smart cropping)
"""
import logging

from django.core.management.base import BaseCommand
from django.conf import settings
from PIL import Image as PILImage
from easy_thumbnails.files import get_thumbnailer

from images.models import Image

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Backfill image dimensions, detect faces, and regenerate thumbnails as WebP'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dimensions',
            action='store_true',
            help='Only backfill missing image_width/image_height',
        )
        parser.add_argument(
            '--faces',
            action='store_true',
            help='Only run face detection on images missing face coordinates',
        )
        parser.add_argument(
            '--thumbnails',
            action='store_true',
            help='Only regenerate thumbnails as WebP with face-aware cropping',
        )
        parser.add_argument(
            '--force-faces',
            action='store_true',
            help='Re-run face detection on ALL images (not just those missing data)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        do_dimensions = options['dimensions']
        do_faces = options['faces'] or options['force_faces']
        do_thumbnails = options['thumbnails']
        force_faces = options['force_faces']

        # If no flags specified, run all three in order
        if not do_dimensions and not do_faces and not do_thumbnails:
            do_dimensions = True
            do_faces = True
            do_thumbnails = True

        if do_dimensions:
            self._backfill_dimensions(dry_run)

        if do_faces:
            self._backfill_faces(dry_run, force=force_faces)

        if do_thumbnails:
            self._regenerate_thumbnails(dry_run)

    def _backfill_dimensions(self, dry_run):
        """Read original image files and populate image_width/image_height."""
        images = Image.all_objects.filter(
            image_width__isnull=True,
            image_file__isnull=False,
        ).exclude(image_file='')

        total = images.count()
        self.stdout.write(f'\n--- Backfill Dimensions ---')
        self.stdout.write(f'Found {total} images missing dimensions')

        if total == 0:
            self.stdout.write(self.style.SUCCESS('Nothing to do.'))
            return

        success = 0
        errors = 0

        for i, image in enumerate(images.iterator(), 1):
            try:
                with PILImage.open(image.image_file.path) as img:
                    width, height = img.size

                if dry_run:
                    self.stdout.write(f'  [{i}/{total}] Would set {image.title} → {width}x{height}')
                else:
                    Image.all_objects.filter(pk=image.pk).update(
                        image_width=width, image_height=height
                    )
                    success += 1

                if i % 25 == 0:
                    self.stdout.write(f'  Progress: {i}/{total}')

            except FileNotFoundError:
                self.stderr.write(f'  [{i}/{total}] File not found: {image.image_file.name}')
                errors += 1
            except Exception as e:
                self.stderr.write(f'  [{i}/{total}] Error for image {image.pk} ({image.title}): {e}')
                errors += 1

        prefix = 'Would update' if dry_run else 'Updated'
        self.stdout.write(self.style.SUCCESS(
            f'{prefix} {success} images. {errors} errors.'
        ))

    def _backfill_faces(self, dry_run, force=False):
        """Run OpenCV face detection and store normalized face coordinates."""
        if force:
            images = Image.all_objects.filter(
                image_file__isnull=False,
            ).exclude(image_file='')
        else:
            images = Image.all_objects.filter(
                face_x__isnull=True,
                image_file__isnull=False,
            ).exclude(image_file='')

        total = images.count()
        label = 'ALL images (force mode)' if force else 'images missing face data'
        self.stdout.write(f'\n--- Face Detection ---')
        self.stdout.write(f'Found {total} {label}')

        if total == 0:
            self.stdout.write(self.style.SUCCESS('Nothing to do.'))
            return

        # Check OpenCV availability
        try:
            import cv2
            self.stdout.write(f'OpenCV version: {cv2.__version__}')
        except ImportError:
            self.stderr.write(self.style.ERROR(
                'OpenCV (opencv-python-headless) is not installed. '
                'Install with: pip install opencv-python-headless'
            ))
            return

        if dry_run:
            self.stdout.write(f'Would run face detection on {total} images')
            return

        detected = 0
        no_face = 0
        errors = 0

        for i, image in enumerate(images.iterator(), 1):
            try:
                cv_image = cv2.imread(image.image_file.path)
                if cv_image is None:
                    self.stderr.write(f'  [{i}/{total}] Could not read: {image.image_file.name}')
                    errors += 1
                    continue

                face_cascade = cv2.CascadeClassifier(
                    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                )
                gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(
                    gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
                )

                if len(faces) > 0:
                    # Use the largest face
                    largest = max(faces, key=lambda r: r[2] * r[3])
                    x, y, w, h = largest
                    img_h, img_w = cv_image.shape[:2]

                    face_x = (x + w / 2) / img_w
                    face_y = (y + h / 2) / img_h
                    face_width = w / img_w
                    face_height = h / img_h

                    Image.all_objects.filter(pk=image.pk).update(
                        face_x=face_x, face_y=face_y,
                        face_width=face_width, face_height=face_height
                    )
                    detected += 1
                else:
                    no_face += 1

                if i % 10 == 0:
                    self.stdout.write(f'  Progress: {i}/{total} ({detected} faces found)')

            except FileNotFoundError:
                self.stderr.write(f'  [{i}/{total}] File not found: {image.image_file.name}')
                errors += 1
            except Exception as e:
                self.stderr.write(f'  [{i}/{total}] Error for image {image.pk}: {e}')
                errors += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done. Faces detected: {detected}. No face: {no_face}. Errors: {errors}.'
        ))

    def _regenerate_thumbnails(self, dry_run):
        """Delete old thumbnails and regenerate as WebP using easy-thumbnails."""
        images = Image.all_objects.filter(
            image_file__isnull=False,
        ).exclude(image_file='')

        total = images.count()
        self.stdout.write(f'\n--- Regenerate Thumbnails (WebP) ---')
        self.stdout.write(f'Found {total} images to process')

        if total == 0:
            self.stdout.write(self.style.SUCCESS('Nothing to do.'))
            return

        aliases = settings.THUMBNAIL_ALIASES.get('', {})
        alias_names = list(aliases.keys())
        self.stdout.write(f'Thumbnail aliases: {", ".join(alias_names)}')

        if dry_run:
            self.stdout.write(f'Would regenerate {total} x {len(alias_names)} = {total * len(alias_names)} thumbnails')
            return

        success = 0
        errors = 0

        for i, image in enumerate(images.iterator(), 1):
            try:
                thumbnailer = get_thumbnailer(image.image_file)

                for alias_name, alias_options in aliases.items():
                    try:
                        options = alias_options.copy()
                        if image.face_x is not None:
                            options.update({
                                'face_x': image.face_x,
                                'face_y': image.face_y,
                                'face_width': image.face_width,
                                'face_height': image.face_height,
                            })
                        thumbnailer.get_thumbnail(options)
                    except Exception as e:
                        self.stderr.write(f'  [{i}/{total}] Error generating {alias_name} for {image.pk}: {e}')
                        errors += 1

                success += 1

                if i % 10 == 0:
                    self.stdout.write(f'  Progress: {i}/{total}')

            except Exception as e:
                self.stderr.write(f'  [{i}/{total}] Error for image {image.pk} ({image.title}): {e}')
                errors += 1

        self.stdout.write(self.style.SUCCESS(
            f'Processed {success} images ({success * len(alias_names)} thumbnails). {errors} errors.'
        ))
