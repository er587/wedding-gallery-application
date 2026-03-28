"""
Management command to send anniversary reminder emails.

Checks MemorableDate entries for dates matching today (month + day),
then emails all active users with a reminder and gallery link.

Usage:
    python manage.py send_anniversary_emails            # Send emails for today's anniversaries
    python manage.py send_anniversary_emails --dry-run   # Preview without sending

Cron setup (daily at 8am):
    0 8 * * * cd /var/www/wedding-gallery && sudo -u www-data venv/bin/python manage.py send_anniversary_emails
"""
import logging
from datetime import date

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from images.models import Image, MemorableDate

logger = logging.getLogger(__name__)

EVENT_EMOJIS = {
    'wedding': '💍',
    'proposal': '💐',
    'honeymoon': '🌴',
    'custom': '🎉',
}


class Command(BaseCommand):
    help = 'Send anniversary reminder emails for memorable dates matching today'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be sent without actually sending emails',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        today = date.today()

        # Find memorable dates matching today (same month + day, any year)
        matching_dates = MemorableDate.objects.filter(
            date__month=today.month,
            date__day=today.day,
        )

        if not matching_dates.exists():
            self.stdout.write(f'No memorable dates match today ({today.strftime("%B %d")}). Nothing to send.')
            return

        # Get all active users with email addresses
        users = User.objects.filter(is_active=True).exclude(email='')
        if not users.exists():
            self.stdout.write('No active users with email addresses found.')
            return

        gallery_url = getattr(settings, 'FRONTEND_URL', '') or 'https://reneeanderic.wedding'
        image_count = Image.objects.count()
        sent = 0
        errors = 0

        for memorable_date in matching_dates:
            years_ago = today.year - memorable_date.date.year
            if years_ago <= 0:
                continue  # Skip future dates or same-year entries

            event_name = (
                memorable_date.label
                if memorable_date.date_type == 'custom' and memorable_date.label
                else memorable_date.get_date_type_display()
            )
            emoji = EVENT_EMOJIS.get(memorable_date.date_type, '🎉')

            subject = f"{emoji} Happy Anniversary! Relive your {event_name} memories"

            self.stdout.write(f'\n--- {event_name} ({years_ago} year(s) ago) ---')
            self.stdout.write(f'Sending to {users.count()} users...')

            for user in users:
                first_name = user.first_name or user.username

                html_message = render_to_string('emails/anniversary_reminder.html', {
                    'first_name': first_name,
                    'event_name': event_name,
                    'years_ago': years_ago,
                    'emoji': emoji,
                    'image_count': image_count,
                    'gallery_url': gallery_url,
                })

                # Plain text fallback
                plain_message = (
                    f"Hi {first_name},\n\n"
                    f"On this day {years_ago} year(s) ago, you celebrated your {event_name}. "
                    f"Visit your gallery to relive the memories: {gallery_url}\n\n"
                    f"With love from your Wedding Gallery"
                )

                if dry_run:
                    self.stdout.write(f'  Would email: {user.email} — "{subject}"')
                else:
                    try:
                        send_mail(
                            subject=subject,
                            message=plain_message,
                            from_email=settings.DEFAULT_FROM_EMAIL,
                            recipient_list=[user.email],
                            html_message=html_message,
                            fail_silently=False,
                        )
                        sent += 1
                    except Exception as e:
                        logger.error("Failed to send anniversary email to %s: %s", user.email, e)
                        self.stderr.write(f'  Error emailing {user.email}: {e}')
                        errors += 1

        prefix = 'Would send' if dry_run else 'Sent'
        self.stdout.write(self.style.SUCCESS(
            f'\n{prefix} {sent} email(s). {errors} error(s).'
        ))
