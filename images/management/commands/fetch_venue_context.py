"""Pull the venue website into SiteConfiguration.labeling_context.

The AI labeler can't browse a URL, so this fetches the venue site's text and
stores it as labeling context. Review/trim the result in the admin afterwards
(raw site copy often has nav/marketing boilerplate worth cutting).

    python manage.py fetch_venue_context                 # uses venue_url
    python manage.py fetch_venue_context --url https://… # override
    python manage.py fetch_venue_context --append        # add to existing context
"""
from django.core.management.base import BaseCommand, CommandError

from images.models import SiteConfiguration
from images.labeling import fetch_site_text


class Command(BaseCommand):
    help = "Fetch the venue website into SiteConfiguration.labeling_context for AI labeling."

    def add_arguments(self, parser):
        parser.add_argument('--url', default=None,
                            help='URL to fetch (defaults to SiteConfiguration.venue_url).')
        parser.add_argument('--max-chars', type=int, default=2000,
                            help='Max characters of site text to keep (default 2000).')
        parser.add_argument('--append', action='store_true',
                            help='Append to existing labeling_context instead of replacing it.')

    def handle(self, *args, **opts):
        cfg = SiteConfiguration.get_solo()
        url = opts['url'] or cfg.venue_url
        if not url:
            raise CommandError('No venue_url set on SiteConfiguration and no --url given.')

        self.stdout.write(f'Fetching {url} …')
        try:
            text = fetch_site_text(url, max_chars=opts['max_chars'])
        except Exception as exc:
            raise CommandError(f'Failed to fetch {url}: {exc}')
        if not text:
            raise CommandError('No extractable text (the site may be JavaScript-rendered) — '
                               'paste a description into labeling_context manually instead.')

        block = f'Venue website ({url}): {text}'
        if opts['append'] and cfg.labeling_context:
            cfg.labeling_context = cfg.labeling_context.rstrip() + '\n\n' + block
        else:
            cfg.labeling_context = block
        cfg.save()

        self.stdout.write(self.style.SUCCESS(f'Stored {len(text)} chars into labeling_context. Preview:'))
        self.stdout.write(text[:400] + ('…' if len(text) > 400 else ''))
        self.stdout.write('Review and trim it in /admin/ → Site configuration → AI labeling.')
