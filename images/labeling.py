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
    "You write captions for a wedding photo gallery. For each image return: a "
    "title (3-6 words, title case, no trailing punctuation), a one-sentence "
    "description, up to 6 lowercase keyword tags, a confidence from 0 to 1, and a "
    "one-line rationale.\n\n"
    "WHAT COUNTS AS A WEDDING PHOTO:\n"
    "- Getting-ready, candids, details, portraits, and travel shots are all part "
    "of the wedding — caption them normally even when the setting is a home, "
    "hotel room, hallway, car, or anywhere that isn't the venue. An unusual or "
    "plain location is NOT a reason to doubt it's a wedding photo.\n"
    "- Only return a non-wedding label (e.g. \"Screenshot\", \"Logo\", "
    "\"Document\") for an image that is literally that. Never use it for a real "
    "photo of people or places.\n\n"
    "PEOPLE AND NAMES:\n"
    "- The names of people in a photo come ONLY from THIS image's tags. Never "
    "take a name from anywhere else.\n"
    "- The couple's names are given only as context (whose wedding this is). Do "
    "NOT assume the couple — or any specific person — appears in a given photo. "
    "Say Renée, Eric, or anyone else is present ONLY if their name is in this "
    "image's tags.\n"
    "- A tag may be lowercase or run names together (e.g. \"hueyanddiana\", "
    "\"maryjane\"). Write them as natural, properly capitalized names (\"Huey and "
    "Diana\", \"Mary Jane\"). Never show the raw tag text and never write "
    "\"tagged as\".\n"
    "- For people NOT identified by a tag, use plain roles: \"the bride\" (a woman "
    "in a wedding gown), \"the couple\", or \"guests\". Do NOT assume a man in a "
    "suit is the groom — guests wear suits too; call him \"a guest\" unless a tag "
    "names him or he is unmistakably the groom (at the altar or a first look with "
    "the bride).\n"
    "- Never guess ages — do not call an adult a child, kid, baby, or toddler. "
    "Never guess relationships (sister, brother, mother, father, parent, son, "
    "daughter, friend) unless a tag or the context states it.\n\n"
    "SETTING: use the venue, location, and setting description to make captions "
    "specific (mention the creek, gardens, or the stone mill when clearly "
    "visible), but never state a place or feature you cannot actually see.\n\n"
    "CONSISTENCY: keep the style uniform — near-identical photos should get "
    "near-identical captions. Prefer plain, factual wording over flowery or "
    "speculative wording."
)

USER_PROMPT = "Label this image for the wedding gallery."


def _build_user_prompt(image):
    """Compose the user text: the ask plus any name context (couple + image tags)."""
    parts = [USER_PROMPT]
    try:
        config = SiteConfiguration.get_solo()
        if config.couple_display:
            parts.append(
                f"Whose wedding this is (context only — do NOT assume they appear "
                f"in this photo): {config.couple_display}."
            )
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
            "Tags on this image — personal names here are the people in the photo "
            "(use them); other tags describe the scene: " + ", ".join(tags) + "."
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


def _dhash(pil_img, hash_size=8):
    """64-bit difference hash (perceptual). Near-identical images share most bits."""
    img = pil_img.convert('L').resize((hash_size + 1, hash_size))
    px = list(img.getdata())
    width = hash_size + 1
    bits = 0
    for row in range(hash_size):
        for col in range(hash_size):
            left = px[row * width + col]
            right = px[row * width + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    return bits


def image_phash(image):
    """Perceptual hash for an Image, or None if its file can't be read."""
    source = _readable_source(image)
    if not source:
        return None
    try:
        with source.open('rb') as fh:
            raw = fh.read()
        return _dhash(PILImage.open(BytesIO(raw)))
    except Exception as exc:
        logger.warning("phash failed for image %s: %s", getattr(image, 'pk', '?'), exc)
        return None


def hamming(a, b):
    """Bit difference between two integer hashes (0 = identical)."""
    return bin(a ^ b).count('1')


def fetch_site_text(url, max_chars=2000, timeout=15, verify=True):
    """Fetch a web page and return its readable text (HTML/scripts stripped).

    Used to pull a venue website into SiteConfiguration.labeling_context so the
    AI labeler has real context about the location. Pass verify=False to tolerate
    a site that serves an incomplete TLS chain (insecure — caller's choice).
    """
    if not verify:
        # Caller explicitly opted out of cert verification; silence the noise.
        try:
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        except Exception:
            pass
    resp = requests.get(
        url, timeout=timeout, verify=verify,
        headers={'User-Agent': 'Mozilla/5.0 (wedding-gallery labeler)'},
    )
    resp.raise_for_status()
    # Drop script/style blocks (their inner text is code, not content) before stripping tags.
    html = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', resp.text)
    text = strip_tags(html)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:max_chars]
