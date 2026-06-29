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
from email.utils import make_msgid, parseaddr

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import EmailMultiAlternatives
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
        parser.add_argument('--reply-to', metavar='EMAIL', default=None,
                            help='Reply-To address (default: REPLY_TO_EMAIL env, else DEFAULT_FROM_EMAIL).')

    def handle(self, *args, **opts):
        config = SiteConfiguration.get_solo()
        couple = config.couple_display or 'Our Wedding'
        gallery_url = getattr(settings, 'FRONTEND_URL', '') or 'http://localhost:5173'
        image_count = Image.objects.count()
        subject = f"{couple} — the wedding gallery has a fresh new look ✨"

        if not settings.DEFAULT_FROM_EMAIL:
            self.stderr.write(self.style.WARNING(
                'DEFAULT_FROM_EMAIL is not set — emails may be rejected by the mail server.'))

        reply_to = (opts['reply_to'] or getattr(settings, 'REPLY_TO_EMAIL', '')
                    or settings.DEFAULT_FROM_EMAIL)

        # Stamp the Message-ID with the From domain (not the server's hostname),
        # so headers are consistent for spam filters / SPF/DKIM alignment.
        from_addr = parseaddr(settings.DEFAULT_FROM_EMAIL)[1]
        msgid_domain = from_addr.rsplit('@', 1)[-1] if '@' in from_addr else None

        if opts['test']:
            recipients = [('', opts['test'])]
            self.stdout.write(self.style.WARNING(f'TEST mode → sending ONE preview to {opts["test"]}'))
        else:
            users = User.objects.filter(is_active=True).exclude(email='').order_by('id')
            # Use the first name only when it's set; otherwise greet generically
            # (never expose a username in the greeting).
            recipients = [(u.first_name, u.email) for u in users]
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
            name = (first_name or '').strip() or 'there'
            html_message = render_to_string('emails/announcement.html', {
                'first_name': name, 'couple': couple,
                'gallery_url': gallery_url, 'image_count': image_count,
            })
            plain_message = (
                f"Hi {name},\n\n"
                f"It's been a little while! We've given the {couple} wedding gallery a fresh new "
                "look and tidied everything up. With a little help from AI, we've also labeled as "
                "many people as we could by name, given the photos proper titles, and added "
                "captions — so the gallery is much easier to browse and search.\n\n"
                + (f"All {image_count} photos and films are waiting for you" if image_count
                   else "All our photos and films are waiting for you")
                + " — and if you have pictures from the day you haven't shared yet, we'd love to "
                "see them.\n\n"
                "One quick note: the gallery is now private, so just log in with your account to "
                f"view.\n\nRelive the day: {gallery_url}\n\n"
                f"With love,\n{couple}\n\n"
                "—\nYou're receiving this because you created an account on our wedding gallery. "
                "To stop receiving these emails, just reply and let us know and we'll take you "
                "off the list."
            )
            try:
                msg = EmailMultiAlternatives(
                    subject=subject, body=plain_message,
                    from_email=settings.DEFAULT_FROM_EMAIL, to=[email],
                    reply_to=[reply_to] if reply_to else None,
                    headers={'Message-ID': make_msgid(domain=msgid_domain)} if msgid_domain else None,
                )
                msg.attach_alternative(html_message, 'text/html')
                msg.send(fail_silently=False)
                sent += 1
            except Exception as exc:
                failed += 1
                logger.error("announcement email failed for %s: %s", email, exc)
                self.stderr.write(f'  error emailing {email}: {exc}')

        if opts['dry_run']:
            self.stdout.write(self.style.SUCCESS(f'Dry run: would send {len(recipients)} email(s).'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Sent {sent} email(s), {failed} error(s).'))
