"""Delete tags that aren't attached to any image (orphaned/unused tags).

    python manage.py prune_tags --dry-run          # list what would be removed
    python manage.py prune_tags                    # delete unused tags
    python manage.py prune_tags --keep-suggested   # but keep curated (suggested) tags

Useful after AI labeling / tag cleanup leaves behind one-off tags no longer on
any photo. Deleting a tag only removes the tag (and its now-empty links); it
never touches images.
"""
from django.core.management.base import BaseCommand

from images.models import Tag


class Command(BaseCommand):
    help = 'Delete tags not attached to any image (unused/orphaned tags).'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='List the unused tags without deleting anything.')
        parser.add_argument('--keep-suggested', action='store_true',
                            help="Don't delete tags marked 'suggested' (your curated vocabulary).")

    def handle(self, *args, **opts):
        qs = Tag.objects.filter(images__isnull=True).distinct()
        if opts['keep_suggested']:
            qs = qs.exclude(suggested=True)

        names = list(qs.order_by('name').values_list('name', flat=True))
        if not names:
            self.stdout.write(self.style.SUCCESS('No unused tags found — nothing to remove.'))
            return

        shown = ', '.join(names[:50]) + ('…' if len(names) > 50 else '')
        self.stdout.write(f'{len(names)} unused tag(s): {shown}')

        if opts['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run — nothing was deleted.'))
            return

        qs.delete()
        self.stdout.write(self.style.SUCCESS(f'Removed {len(names)} unused tag(s).'))
