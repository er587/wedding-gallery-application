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
        parser.add_argument('--provider', default=None,
                            help='AI provider: anthropic | openai | gemini (default LABELING_PROVIDER).')
        parser.add_argument('--model', default=None,
                            help='Override the provider model for this run.')
        parser.add_argument('--max-tags', type=int, default=None,
                            help='Cap AI-suggested tags per image (0 = none; default 5 or '
                                 'ANTHROPIC_LABEL_MAX_TAGS).')
        parser.add_argument('--existing-tags-only', action='store_true',
                            help='Only apply tags that already exist; never invent new ones '
                                 '(controlled vocabulary).')
        parser.add_argument('--needs-label', action='store_true',
                            help='Only images with a blank or placeholder title.')
        parser.add_argument('--all', action='store_true',
                            help='Include images that already have a suggestion (default skips them).')
        parser.add_argument('--replace', action='store_true',
                            help='Re-label images whose suggestion is still PENDING: delete the '
                                 'stale pending suggestion and generate a fresh one. Leaves '
                                 'already-approved/applied images untouched. Use after tuning the prompt/model.')
        parser.add_argument('--redo', action='store_true',
                            help='Re-caption EVERY image, including ones already approved/applied '
                                 '(clears their pending suggestions first). For a full refresh after '
                                 'changing the prompt. Combine with --apply to write the results.')
        parser.add_argument('--apply', action='store_true',
                            help='Apply each generated caption immediately (overwrite title/description, '
                                 'no manual review). DESTRUCTIVE — back up the DB first.')

    def handle(self, *args, **opts):
        # Images already approved/applied are "done" — never touch them.
        done = ImageLabelSuggestion.objects.filter(
            status__in=['approved', 'applied']
        ).values_list('image_id', flat=True)
        pending = ImageLabelSuggestion.objects.filter(
            status='pending'
        ).values_list('image_id', flat=True)

        qs = Image.objects.all().order_by('id')
        if not opts['redo']:
            # --redo re-captions everything; otherwise leave finished images alone.
            qs = qs.exclude(id__in=done)
            if not opts['replace'] and not opts['all']:
                # Default: skip anything that already has a pending suggestion too.
                qs = qs.exclude(id__in=pending)
        if opts['needs_label']:
            qs = qs.filter(Q(title='') | Q(title__isnull=True) | Q(title__iregex=PLACEHOLDER_RE))

        image_ids = list(qs.values_list('id', flat=True)[:opts['limit']])
        if (opts['replace'] or opts['redo']) and image_ids:
            removed = ImageLabelSuggestion.objects.filter(
                image_id__in=image_ids, status='pending'
            ).delete()[0]
            self.stdout.write(f'Cleared {removed} stale pending suggestion(s) before re-labeling.')
        if not image_ids:
            self.stdout.write(self.style.WARNING('No images to label (all caught up?).'))
            return

        verb = 'Re-captioning' if opts['redo'] else 'Labeling'
        if opts['apply']:
            self.stdout.write(self.style.WARNING(
                '--apply: captions will OVERWRITE titles/descriptions immediately (no review).'))
        self.stdout.write(f'{verb} {len(image_ids)} image(s)…')
        ok = applied = failed = 0
        for i, image_id in enumerate(image_ids, 1):
            try:
                suggestion = generate_label_suggestion(
                    image_id, model=opts['model'], max_tags=opts['max_tags'],
                    existing_tags_only=opts['existing_tags_only'], provider=opts['provider'],
                )
                ok += 1
                if opts['apply']:
                    suggestion.apply()
                    applied += 1
                self.stdout.write(
                    f'  [{i}/{len(image_ids)}] image {image_id} → "{suggestion.suggested_title}" '
                    f'(conf {suggestion.confidence}, {suggestion.source})'
                    + (' [applied]' if opts['apply'] else '')
                )
            except LabelingNotConfigured as exc:
                # Misconfiguration affects every image — fail fast rather than loop.
                raise CommandError(f'Labeling not configured: {exc}')
            except Exception as exc:  # one bad image shouldn't abort the batch
                failed += 1
                self.stderr.write(f'  [{i}/{len(image_ids)}] image {image_id} FAILED: {exc}')

        if opts['apply']:
            self.stdout.write(self.style.SUCCESS(
                f'Done: {ok} captioned, {applied} applied, {failed} failed.'))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Done: {ok} suggested, {failed} failed. '
                f'Review and approve in /admin/ → Image label suggestions.'))
