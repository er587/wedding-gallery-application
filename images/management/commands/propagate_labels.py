"""Propagate tags from labeled images to near-duplicate unlabeled ones.

For each untagged image, find the most visually-similar *tagged* image via a
perceptual hash. If it's a near-duplicate (Hamming distance within the
threshold), create a PENDING suggestion copying that image's tags — nothing is
applied until you approve it in the admin. Pairs with `autolabel` (which still
handles genuinely-new photos).

    python manage.py propagate_labels --dry-run        # preview matches
    python manage.py propagate_labels                  # create pending suggestions
    python manage.py propagate_labels --max-distance 6 # stricter (fewer, surer)
"""
from django.core.management.base import BaseCommand

from images.models import Image, Tag, ImageLabelSuggestion
from images.labeling import image_phash, hamming


class Command(BaseCommand):
    help = 'Copy tags to near-duplicate images from already-tagged ones (pending suggestions).'

    def add_arguments(self, parser):
        parser.add_argument('--max-distance', type=int, default=8,
                            help='Max perceptual-hash Hamming distance to count as a near-duplicate '
                                 '(0-64; lower = stricter, default 8).')
        parser.add_argument('--limit', type=int, default=None,
                            help='Cap how many suggestions to create this run.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Show matches without creating suggestions.')

    def handle(self, *args, **opts):
        max_d = opts['max_distance']

        # Reference set: images that already have tags (the labels we propagate).
        refs = []
        for img in Image.objects.prefetch_related('tags').all():
            tag_names = [t.name for t in img.tags.all()]
            if not tag_names:
                continue
            h = image_phash(img)
            if h is not None:
                refs.append((img.id, h, tag_names))
        if not refs:
            self.stdout.write(self.style.WARNING('No tagged images to learn from. Tag a few first.'))
            return
        self.stdout.write(f'Loaded {len(refs)} tagged reference image(s).')

        # Targets: untagged images with no pending/approved/applied suggestion.
        handled = set(ImageLabelSuggestion.objects.filter(
            status__in=['pending', 'approved', 'applied']
        ).values_list('image_id', flat=True))

        created = matched = 0
        for img in Image.objects.prefetch_related('tags').all():
            if img.id in handled or img.tags.exists():
                continue
            h = image_phash(img)
            if h is None:
                continue
            best_id, best_tags, best_d = None, None, 65
            for ref_id, ref_h, ref_tags in refs:
                d = hamming(h, ref_h)
                if d < best_d:
                    best_id, best_tags, best_d = ref_id, ref_tags, d
            if best_id is None or best_d > max_d:
                continue
            matched += 1
            self.stdout.write(
                f'  image {img.id}  ~  #{best_id} (distance {best_d})  → tags {best_tags}'
            )
            if opts['dry_run']:
                continue
            ImageLabelSuggestion.objects.create(
                image=img,
                suggested_tags=best_tags,
                confidence=round(max(0.0, 1 - best_d / 32.0), 2),
                rationale=f'Near-duplicate of image #{best_id} (hash distance {best_d}); copied its tags.',
                source=f'near-dup:{best_id}'[:64],
                status='pending',
            )
            created += 1
            if opts['limit'] and created >= opts['limit']:
                break

        if opts['dry_run']:
            self.stdout.write(self.style.SUCCESS(f'Dry run: {matched} near-duplicate match(es) found.'))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Created {created} pending tag suggestion(s) from {matched} match(es). '
                f'Review in /admin/ → Image label suggestions.'
            ))
