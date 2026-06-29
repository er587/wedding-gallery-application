"""Bulk-generate AI label suggestions for images (server-side Claude vision).

Runs synchronously — no django-q worker required. Each image gets a *pending*
ImageLabelSuggestion; nothing changes on the live gallery until you approve it
in the admin (Image label suggestions → "Approve & apply selected").

    # one cheap batch
    python manage.py autolabel --limit 50 --model claude-haiku-4-5
    # everything still missing a suggestion
    python manage.py autolabel --limit 2000

Requires ANTHROPIC_API_KEY in the environment. Model defaults to
ANTHROPIC_LABELING_MODEL (or claude-opus-4-8); override with --model.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from images.models import Image, ImageLabelSuggestion
from images.labeling import generate_label_suggestion, LabelingNotConfigured

# Auto-generated / placeholder filename patterns worth relabeling.
PLACEHOLDER_RE = (
    r'^(img[_-]|dsc[_-]|dscf|pxl_|vid[_-]|mvimg|gopr|screenshot|image\d|photo\d|untitled|logo$)'
)


class Command(BaseCommand):
    help = 'Generate pending AI label suggestions for images via server-side Claude vision.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=50,
                            help='Max images to process this run (default 50).')
        parser.add_argument('--model', default=None,
                            help='Override ANTHROPIC_LABELING_MODEL for this run.')
        parser.add_argument('--needs-label', action='store_true',
                            help='Only images with a blank or placeholder title.')
        parser.add_argument('--all', action='store_true',
                            help='Include images that already have a suggestion (default skips them).')

    def handle(self, *args, **opts):
        already = ImageLabelSuggestion.objects.filter(
            status__in=['pending', 'approved', 'applied']
        ).values_list('image_id', flat=True)

        qs = Image.objects.all().order_by('id')
        if not opts['all']:
            qs = qs.exclude(id__in=already)
        if opts['needs_label']:
            qs = qs.filter(Q(title='') | Q(title__isnull=True) | Q(title__iregex=PLACEHOLDER_RE))

        image_ids = list(qs.values_list('id', flat=True)[:opts['limit']])
        if not image_ids:
            self.stdout.write(self.style.WARNING('No images to label (all caught up?).'))
            return

        self.stdout.write(f'Labeling {len(image_ids)} image(s)…')
        ok = failed = 0
        for i, image_id in enumerate(image_ids, 1):
            try:
                suggestion = generate_label_suggestion(image_id, model=opts['model'])
                ok += 1
                self.stdout.write(
                    f'  [{i}/{len(image_ids)}] image {image_id} → "{suggestion.suggested_title}" '
                    f'(conf {suggestion.confidence}, {suggestion.source})'
                )
            except LabelingNotConfigured as exc:
                # Misconfiguration affects every image — fail fast rather than loop.
                raise CommandError(f'Labeling not configured: {exc}')
            except Exception as exc:  # one bad image shouldn't abort the batch
                failed += 1
                self.stderr.write(f'  [{i}/{len(image_ids)}] image {image_id} FAILED: {exc}')

        self.stdout.write(self.style.SUCCESS(
            f'Done: {ok} suggested, {failed} failed. '
            f'Review and approve in /admin/ → Image label suggestions.'
        ))
