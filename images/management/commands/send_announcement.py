"""Send a one-off announcement email to everyone who created an account.

Safe-by-default workflow:
    python manage.py send_announcement --test you@example.com   # 1) preview to yourself
    python manage.py send_announcement --dry-run                # 2) list recipients, send nothing
    python manage.py send_announcement                          # 3) send to all active users
    python manage.py send_announcement --limit 50               #    (send in batches if needed)

Recipients: active users with a non-empty email. Couple name + gallery link come
from SiteConfiguration / FRONTEND_URL. Edit the copy below and
images/templates/emails/announcement.html to taste.
"""
import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from images.models import Image, SiteConfiguration

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Email all account holders a one-off announcement about the gallery updates.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='List recipients without sending anything.')
        parser.add_argument('--test', metavar='EMAIL',
                            help='Send a single preview to this address only.')
        parser.add_argument('--limit', type=int, default=None,
                            help='Cap how many emails to send (for batching).')

    def handle(self, *args, **opts):
        config = SiteConfiguration.get_solo()
        couple = config.couple_display or 'Our Wedding'
        gallery_url = getattr(settings, 'FRONTEND_URL', '') or 'http://localhost:5173'
        image_count = Image.objects.count()
        subject = f"{couple} — the wedding gallery has a fresh new look ✨"

        if not settings.DEFAULT_FROM_EMAIL:
            self.stderr.write(self.style.WARNING(
                'DEFAULT_FROM_EMAIL is not set — emails may be rejected by the mail server.'))

        if opts['test']:
            recipients = [('there', opts['test'])]
            self.stdout.write(self.style.WARNING(f'TEST mode → sending ONE preview to {opts["test"]}'))
        else:
            users = User.objects.filter(is_active=True).exclude(email='').order_by('id')
            recipients = [(u.first_name or u.username, u.email) for u in users]
            if opts['limit']:
                recipients = recipients[:opts['limit']]
            if not recipients:
                self.stdout.write(self.style.WARNING('No active users with an email address.'))
                return
            self.stdout.write(f'{len(recipients)} recipient(s). Subject: "{subject}"')

        sent = failed = 0
        for first_name, email in recipients:
            if opts['dry_run']:
                self.stdout.write(f'  would email: {email}')
                continue
            html_message = render_to_string('emails/announcement.html', {
                'first_name': first_name, 'couple': couple,
                'gallery_url': gallery_url, 'image_count': image_count,
            })
            plain_message = (
                f"Hi {first_name},\n\n"
                f"It's been a little while! We've given the {couple} wedding gallery a fresh new "
                f"look and tidied everything up. "
                + (f"All {image_count} photos and films are waiting for you" if image_count
                   else "All our photos and films are waiting for you")
                + " — and if you have pictures from the day you haven't shared yet, we'd love to "
                "see them.\n\n"
                "One quick note: the gallery is now private, so just log in with your account to "
                f"view.\n\nRelive the day: {gallery_url}\n\nWith love,\n{couple}"
            )
            try:
                send_mail(subject=subject, message=plain_message,
                          from_email=settings.DEFAULT_FROM_EMAIL, recipient_list=[email],
                          html_message=html_message, fail_silently=False)
                sent += 1
            except Exception as exc:
                failed += 1
                logger.error("announcement email failed for %s: %s", email, exc)
                self.stderr.write(f'  error emailing {email}: {exc}')

        if opts['dry_run']:
            self.stdout.write(self.style.SUCCESS(f'Dry run: would send {len(recipients)} email(s).'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Sent {sent} email(s), {failed} error(s).'))
