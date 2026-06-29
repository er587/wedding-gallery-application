"""Find your already-tagged people in untagged photos, via Claude few-shot matching.

Uses photos tagged with `person` tags as references, then proposes those names on
photos where the same people appear — as PENDING suggestions to approve.

    python manage.py match_people --dry-run                 # preview matches
    python manage.py match_people --limit 20                # create suggestions
    python manage.py match_people --min-confidence 0.75     # stricter
"""
from django.core.management.base import BaseCommand, CommandError

from images.models import Image, ImageLabelSuggestion, Tag
from images.labeling import DEFAULT_MODEL
from images.matching import (
    build_people_references, match_people_in_image, create_match_suggestion,
)


class Command(BaseCommand):
    help = 'Match known (person-tagged) people into untagged photos and suggest their tags.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=50,
                            help='Max target photos to scan this run (default 50).')
        parser.add_argument('--model', default=None,
                            help='Model to use (default ANTHROPIC_LABELING_MODEL or opus).')
        parser.add_argument('--min-confidence', type=float, default=0.6,
                            help='Only keep matches at/above this confidence 0-1 (default 0.6).')
        parser.add_argument('--refs-per-person', type=int, default=2,
                            help='Reference photos per known person (default 2).')
        parser.add_argument('--max-people', type=int, default=None,
                            help='Cap how many known people to load references for.')
        parser.add_argument('--all', action='store_true',
                            help='Include photos that already have a suggestion (default skips them).')
        parser.add_argument('--dry-run', action='store_true',
                            help='Show matches without creating suggestions.')

    def handle(self, *args, **opts):
        import os
        try:
            import anthropic  # noqa: F401
        except ImportError:
            raise CommandError("The 'anthropic' package is not installed.")
        if not os.environ.get('ANTHROPIC_API_KEY'):
            raise CommandError('ANTHROPIC_API_KEY is not set.')

        model = opts['model'] or os.environ.get('ANTHROPIC_LABELING_MODEL', DEFAULT_MODEL)

        reference_content, known, people = build_people_references(
            refs_per_person=opts['refs_per_person'], max_people=opts['max_people'],
        )
        if not known:
            self.stdout.write(self.style.WARNING(
                'No reference people found. Tag a few photos with person-kind tags first '
                '(set a tag\'s kind to "Person" in the admin).'))
            return
        self.stdout.write(f'Known people ({len(people)}): {", ".join(people)}')

        # Targets: photos with no person tag yet and (by default) no existing suggestion.
        already_person = Image.objects.filter(tags__kind=Tag.PERSON).values_list('id', flat=True)
        qs = Image.objects.all().order_by('id').exclude(id__in=already_person)
        if not opts['all']:
            handled = ImageLabelSuggestion.objects.filter(
                status__in=['pending', 'approved', 'applied']
            ).values_list('image_id', flat=True)
            qs = qs.exclude(id__in=handled)
        targets = list(qs[:opts['limit']])
        if not targets:
            self.stdout.write(self.style.WARNING('No untagged target photos to scan.'))
            return

        self.stdout.write(f'Scanning {len(targets)} photo(s) at min-confidence {opts["min_confidence"]}…')
        client = anthropic.Anthropic()
        created = matched = failed = 0
        for i, image in enumerate(targets, 1):
            try:
                matches = match_people_in_image(
                    image, client=client, model=model,
                    reference_content=reference_content, known=known,
                    min_confidence=opts['min_confidence'],
                )
            except Exception as exc:
                failed += 1
                self.stderr.write(f'  [{i}/{len(targets)}] image {image.id} error: {exc}')
                continue
            if not matches:
                continue
            matched += 1
            detail = ", ".join(f"{n} ({c})" for n, c in matches)
            self.stdout.write(f'  [{i}/{len(targets)}] image {image.id} → {detail}')
            if not opts['dry_run']:
                create_match_suggestion(image, matches)
                created += 1

        if opts['dry_run']:
            self.stdout.write(self.style.SUCCESS(f'Dry run: {matched} photo(s) matched ({failed} errors).'))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Created {created} pending suggestion(s) from {matched} match(es), {failed} errors. '
                f'Review in /admin/ → Image label suggestions.'))
