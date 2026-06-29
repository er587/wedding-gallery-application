"""AI people-matching: find already-known people in untagged photos.

Few-shot visual matching with Claude. We build a reference block from photos
that are already tagged with `person` tags (1-2 examples per person), mark it
for prompt caching so it's reused cheaply across the run, then for each target
photo ask the model which of the known people appear. Confident matches become
PENDING ImageLabelSuggestions (person tags only) behind the usual review gate.

Requires ANTHROPIC_API_KEY. Pairs with autolabel (captions) and propagate_labels
(near-duplicates).
"""
import json
import logging

from .models import Tag, ImageLabelSuggestion, SiteConfiguration
from .labeling import _encode_image

logger = logging.getLogger(__name__)

MATCH_SYSTEM_PROMPT = (
    "You identify which KNOWN people appear in a wedding photo. You are given "
    "reference photos, each labeled with a person's name, followed by one target "
    "photo. Decide which of the named people appear in the target photo.\n\n"
    "- Match on facial identity — the same face — NOT on clothing, role, age, or "
    "general resemblance.\n"
    "- Only include a person if you are confident it is the SAME individual. When "
    "in doubt, leave them out: a false match is worse than a miss.\n"
    "- Use ONLY the provided names; never invent a name.\n"
    "- Return each match with a confidence between 0 and 1."
)

MATCH_SCHEMA = {
    "type": "object",
    "properties": {
        "people": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": ["name", "confidence"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["people"],
    "additionalProperties": False,
}


def effective_match_prompt():
    """The people-matching system prompt: staff-edited DB override, else default."""
    try:
        custom = (SiteConfiguration.get_solo().match_prompt or '').strip()
        if custom:
            return custom
    except Exception:
        pass
    return MATCH_SYSTEM_PROMPT


def build_people_references(refs_per_person=2, max_people=None):
    """Assemble the cached reference block from person-tagged photos.

    Returns (content, known, people) where content is the Anthropic content list
    (text + images, last block marked for prompt caching), known maps
    lowercased -> canonical name, and people is the list of names with references.
    """
    content = [{
        "type": "text",
        "text": "Reference photos of known people. Each name is followed by one or "
                "more photos of that person:",
    }]
    known = {}
    people = []
    for tag in Tag.objects.filter(kind=Tag.PERSON).order_by('name'):
        images = list(tag.images.all()[:max(1, refs_per_person)])
        encoded = []
        for img in images:
            try:
                b64, media_type = _encode_image(img)
            except Exception as exc:  # skip unreadable reference, keep going
                logger.warning("reference encode failed for image %s: %s", img.pk, exc)
                continue
            encoded.append((b64, media_type))
        if not encoded:
            continue
        known[tag.name.lower()] = tag.name
        people.append(tag.name)
        content.append({"type": "text", "text": f"Person: {tag.name}"})
        for b64, media_type in encoded:
            content.append({"type": "image",
                            "source": {"type": "base64", "media_type": media_type, "data": b64}})
        if max_people and len(people) >= max_people:
            break

    # Cache the whole reference prefix (system + these blocks) across target calls.
    if len(content) > 1:
        content[-1] = {**content[-1], "cache_control": {"type": "ephemeral"}}
    return content, known, people


def match_people_in_image(image, *, client, model, reference_content, known,
                          min_confidence, system_prompt=None):
    """Return [(canonical_name, confidence), ...] for known people found in image."""
    b64, media_type = _encode_image(image)
    response = client.messages.create(
        model=model,
        max_tokens=512,
        system=system_prompt or MATCH_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": reference_content + [
                {"type": "text", "text": "TARGET PHOTO below. Which of the known "
                                         "people above appear in it?"},
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            ],
        }],
        output_config={"format": {"type": "json_schema", "schema": MATCH_SCHEMA}},
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    data = json.loads(text or "{}")

    matches = []
    for item in data.get("people", []):
        name = str(item.get("name", "")).strip()
        try:
            conf = float(item.get("confidence") or 0)
        except (TypeError, ValueError):
            conf = 0.0
        canonical = known.get(name.lower())
        if canonical and conf >= min_confidence:
            matches.append((canonical, round(conf, 2)))
    return matches


def create_match_suggestion(image, matches):
    """Persist a pending person-tag suggestion from match results."""
    names = [n for n, _ in matches]
    detail = ", ".join(f"{n} ({c})" for n, c in matches)
    return ImageLabelSuggestion.objects.create(
        image=image,
        suggested_tags=names[:ImageLabelSuggestion.MAX_TAGS],
        confidence=round(min(c for _, c in matches), 2),
        rationale=f"People match: {detail}.",
        source='people-match',
        status='pending',
    )
