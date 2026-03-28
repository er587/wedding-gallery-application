"""
Management command to backfill image dimensions and regenerate thumbnails as WebP.

Usage:
    python manage.py backfill_images              # Run both: dimensions + thumbnails
    python manage.py backfill_images --dimensions  # Only backfill missing dimensions
    python manage.py backfill_images --thumbnails  # Only regenerate thumbnails as WebP
    python manage.py backfill_images --dry-run     # Show what would be done without changes
"""
import logging

from django.core.management.base import BaseCommand
from django.conf import settings
from PIL import Image as PILImage
from easy_thumbnails.files import get_thumbnailer

from images.models import Image

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Backfill image dimensions and regenerate thumbnails as WebP'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dimensions',
            action='store_true',
            help='Only backfill missing image_width/image_height',
        )
        parser.add_argument(
            '--thumbnails',
            action='store_true',
            help='Only regenerate thumbnails as WebP',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        do_dimensions = options['dimensions']
        do_thumbnails = options['thumbnails']

        # If neither flag specified, do both
        if not do_dimensions and not do_thumbnails:
            do_dimensions = True
            do_thumbnails = True

        if do_dimensions:
            self._backfill_dimensions(dry_run)

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
                    image.image_width = width
                    image.image_height = height
                    # Use update() to avoid triggering save() override and background threads
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
            self.stdout.write(f'Would regenerate {total} × {len(alias_names)} = {total * len(alias_names)} thumbnails')
            return

        success = 0
        errors = 0

        for i, image in enumerate(images.iterator(), 1):
            try:
                thumbnailer = get_thumbnailer(image.image_file)

                # Build options with face data if available
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
                        # Force regeneration by getting thumbnail (easy-thumbnails
                        # checks if the source is newer than the cached version)
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
