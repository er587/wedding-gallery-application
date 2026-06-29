"""Mint a scoped API key for a labeling agent.

    python manage.py create_agent_key "claude-labeler"

Prints the raw key once — store it somewhere safe; only its hash is kept.
"""
from django.core.management.base import BaseCommand, CommandError

from images.models import AgentApiKey


class Command(BaseCommand):
    help = 'Create an API key for an image-labeling agent (raw key printed once).'

    def add_arguments(self, parser):
        parser.add_argument('name', help='Human-readable label for the key, e.g. "claude-labeler".')

    def handle(self, *args, **options):
        name = options['name'].strip()
        if not name:
            raise CommandError('A non-empty key name is required.')
        key, raw = AgentApiKey.issue(name=name)
        self.stdout.write(self.style.SUCCESS(f'Created agent key "{key.name}" (prefix {key.key_prefix}).'))
        self.stdout.write('')
        self.stdout.write('  Send it as the X-Agent-Key request header:')
        self.stdout.write(self.style.WARNING(f'    {raw}'))
        self.stdout.write('')
        self.stdout.write('Store it now — it will not be shown again.')
