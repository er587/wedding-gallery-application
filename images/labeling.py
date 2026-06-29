"""Server-side label generation: ask Claude to caption an image.

This is the turnkey producer for the labeling workflow — the Django server
calls the Anthropic API itself (via the official `anthropic` SDK) and writes a
pending ImageLabelSuggestion. It shares the same review/approval gate as
agent-submitted suggestions, so nothing reaches the live gallery without a
staff approval.

Requires the ANTHROPIC_API_KEY environment variable. The model defaults to
claude-opus-4-8 and can be overridden with ANTHROPIC_LABELING_MODEL.
"""
import base64
import json
import logging
import os
import re
from io import BytesIO

import requests
from django.utils.html import strip_tags
from PIL import Image as PILImage

from .models import Image, ImageLabelSuggestion, SiteConfiguration

logger = logging.getLogger(__name__)

DEFAULT_MODEL = 'claude-opus-4-8'
# Long-edge cap for the image we send — keeps vision token cost down while
# staying sharp enough to caption a photo.
MAX_DIM = 1024

SYSTEM_PROMPT = (
    "You label photographs for a wedding gallery. Given one image, produce a "
    "short, human, descriptive title (3-6 words, title case, no trailing "
    "punctuation), a one-sentence description, and up to 6 lowercase keyword "
    "tags. Be specific and warm but accurate. If the image is clearly NOT a "
    "wedding photo (a screenshot, a logo, a document), say so plainly in the "
    "title (e.g. \"Logo\" or \"Screenshot\") rather than inventing a scene. "
    "Give a confidence from 0 to 1 and a one-line rationale.\n\n"
    "You may be given context: the couple's names, the wedding date, the venue "
    "and location, a description of the setting, and human-applied tags for this "
    "image (which often include the names of people in it). Use the names "
    "naturally in the title/description WHEN you can tell from the photo who is "
    "who — the couple in wedding attire, or when only one or two people are "
    "present. NEVER assign a specific name to a person whose identity you cannot "
    "visually confirm; describe them generically instead. Use the venue/location "
    "and setting to make captions specific (e.g. reference the venue or a feature "
    "like the creek or the stone mill when it's clearly visible), but never state "
    "a place or detail you cannot actually see in the photo. Do not invent names "
    "that aren't in the provided context."
)

USER_PROMPT = "Label this image for the wedding gallery."


def _build_user_prompt(image):
    """Compose the user text: the ask plus any name context (couple + image tags)."""
    parts = [USER_PROMPT]
    try:
        config = SiteConfiguration.get_solo()
        if config.couple_display:
            parts.append(f"The couple getting married: {config.couple_display}.")
        if config.wedding_date:
            parts.append(f"Wedding date: {config.wedding_date.strftime('%B %-d, %Y')}.")
        venue = ", ".join(p for p in [config.venue_name, config.location] if p)
        if venue:
            parts.append(f"Venue / location: {venue}.")
        if config.labeling_context:
            parts.append(f"About the setting: {config.labeling_context}")
    except Exception:  # never let missing config block labeling
        pass
    tags = [t.name for t in image.tags.all()]
    if tags:
        parts.append(
            "Human-applied tags for this image (treat any name-like tags as "
            "people present in the photo): " + ", ".join(tags) + "."
        )
    return "\n".join(parts)

LABEL_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "number"},
        "rationale": {"type": "string"},
    },
    "required": ["title", "description", "tags", "confidence", "rationale"],
    "additionalProperties": False,
}


class LabelingNotConfigured(Exception):
    """Raised when the Anthropic SDK or API key isn't available."""


def _readable_source(image):
    """Pick the best on-disk source for vision: cover/thumbnail for video, else the photo."""
    if image.vimeo_url or getattr(image, 'is_video', False):
        return image.cover_image or image.thumbnail or image.image_file
    return image.image_file


def _encode_image(image):
    """Downscale to MAX_DIM and return (base64_jpeg, 'image/jpeg')."""
    source = _readable_source(image)
    if not source:
        raise LabelingNotConfigured(f"Image {image.pk} has no file to read.")
    with source.open('rb') as fh:
        raw = fh.read()
    im = PILImage.open(BytesIO(raw))
    im = im.convert('RGB')
    im.thumbnail((MAX_DIM, MAX_DIM))
    buf = BytesIO()
    im.save(buf, format='JPEG', quality=85)
    return base64.standard_b64encode(buf.getvalue()).decode('utf-8'), 'image/jpeg'


def generate_label_suggestion(image_id, model=None):
    """Generate one pending ImageLabelSuggestion for an image via Claude vision.

    Returns the created ImageLabelSuggestion. Raises LabelingNotConfigured if the
    SDK isn't installed or ANTHROPIC_API_KEY is unset; lets Image.DoesNotExist
    propagate for an unknown id.
    """
    try:
        import anthropic
    except ImportError as exc:
        raise LabelingNotConfigured(
            "The 'anthropic' package is not installed. Add it to requirements and install."
        ) from exc

    if not os.environ.get('ANTHROPIC_API_KEY'):
        raise LabelingNotConfigured("ANTHROPIC_API_KEY is not set.")

    image = Image.objects.get(pk=image_id)
    model = model or os.environ.get('ANTHROPIC_LABELING_MODEL', DEFAULT_MODEL)
    b64, media_type = _encode_image(image)

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": _build_user_prompt(image)},
            ],
        }],
        output_config={"format": {"type": "json_schema", "schema": LABEL_SCHEMA}},
    )

    text = next((b.text for b in response.content if b.type == "text"), "")
    data = json.loads(text)

    tags = [str(t).strip().lower() for t in data.get("tags", []) if str(t).strip()]
    suggestion = ImageLabelSuggestion.objects.create(
        image=image,
        suggested_title=(data.get("title") or "")[:255],
        suggested_description=data.get("description") or "",
        suggested_tags=tags[:ImageLabelSuggestion.MAX_TAGS],
        confidence=data.get("confidence"),
        rationale=data.get("rationale") or "",
        source=model[:64],
        status="pending",
    )
    logger.info("Generated label suggestion %s for image %s via %s", suggestion.pk, image_id, model)
    return suggestion


def fetch_site_text(url, max_chars=2000, timeout=15):
    """Fetch a web page and return its readable text (HTML/scripts stripped).

    Used to pull a venue website into SiteConfiguration.labeling_context so the
    AI labeler has real context about the location.
    """
    resp = requests.get(
        url, timeout=timeout,
        headers={'User-Agent': 'Mozilla/5.0 (wedding-gallery labeler)'},
    )
    resp.raise_for_status()
    # Drop script/style blocks (their inner text is code, not content) before stripping tags.
    html = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', resp.text)
    text = strip_tags(html)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:max_chars]
