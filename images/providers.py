"""Pluggable vision-LLM providers for caption generation.

The operator picks a default with LABELING_PROVIDER (anthropic | openai | gemini);
each provider reads its own API key from the environment. A run can override the
provider/model. Adding a provider here makes it available to captioning without
touching the rest of the pipeline.

Keys (env): ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY.
Per-provider model default (env): ANTHROPIC_LABELING_MODEL, OPENAI_LABELING_MODEL,
GEMINI_LABELING_MODEL.
"""
import base64
import json
import os

CAPTION_PROVIDERS = ('anthropic', 'openai', 'gemini')

DEFAULT_MODELS = {
    'anthropic': 'claude-opus-4-8',
    'openai': 'gpt-4o',
    'gemini': 'gemini-2.0-flash',
}

KEY_ENV = {
    'anthropic': 'ANTHROPIC_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'gemini': 'GEMINI_API_KEY',
}

# Appended to the prompt for providers without a native JSON-schema mode, so the
# returned JSON has the keys we expect even when only "JSON mode" is available.
SHAPE_HINT = (
    "\n\nRespond ONLY with a JSON object with these keys: "
    "title (string), description (string), tags (array of strings), "
    "confidence (number 0-1), rationale (string)."
)


class ProviderNotConfigured(Exception):
    """Raised when the selected provider's SDK or API key isn't available."""


def normalize(provider):
    p = (provider or '').lower().strip()
    return p if p in CAPTION_PROVIDERS else ''


def default_provider():
    return normalize(os.environ.get('LABELING_PROVIDER')) or 'anthropic'


def resolve_model(provider, model=None):
    if model:
        return model
    return os.environ.get(f'{provider.upper()}_LABELING_MODEL') or DEFAULT_MODELS[provider]


def configured_providers():
    """{provider: bool} — which providers have an API key set (for the dashboard)."""
    return {p: bool(os.environ.get(KEY_ENV[p])) for p in CAPTION_PROVIDERS}


def generate_caption(provider, model, *, b64, media_type, system_prompt, user_prompt, schema):
    """Call the chosen provider and return the parsed JSON dict (title/description/…)."""
    provider = normalize(provider) or default_provider()
    if not os.environ.get(KEY_ENV[provider]):
        raise ProviderNotConfigured(f'{KEY_ENV[provider]} is not set.')
    model = resolve_model(provider, model)
    if provider == 'anthropic':
        return _anthropic(model, b64, media_type, system_prompt, user_prompt, schema)
    if provider == 'openai':
        return _openai(model, b64, media_type, system_prompt, user_prompt, schema)
    return _gemini(model, b64, media_type, system_prompt, user_prompt, schema)


def _anthropic(model, b64, media_type, system_prompt, user_prompt, schema):
    try:
        import anthropic
    except ImportError as exc:
        raise ProviderNotConfigured("The 'anthropic' package is not installed.") from exc
    client = anthropic.Anthropic()
    response = client.messages.create(
        model=model, max_tokens=1024, system=system_prompt,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            {"type": "text", "text": user_prompt},
        ]}],
        output_config={"format": {"type": "json_schema", "schema": schema}},
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    return json.loads(text or "{}")


def _openai(model, b64, media_type, system_prompt, user_prompt, schema):
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise ProviderNotConfigured("The 'openai' package is not installed.") from exc
    client = OpenAI()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": [
                {"type": "text", "text": user_prompt + SHAPE_HINT},
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}},
            ]},
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content or "{}")


def _gemini(model, b64, media_type, system_prompt, user_prompt, schema):
    try:
        import google.generativeai as genai
    except ImportError as exc:
        raise ProviderNotConfigured("The 'google-generativeai' package is not installed.") from exc
    genai.configure(api_key=os.environ['GEMINI_API_KEY'])
    gm = genai.GenerativeModel(model_name=model, system_instruction=system_prompt)
    response = gm.generate_content(
        [user_prompt + SHAPE_HINT, {"mime_type": media_type, "data": base64.b64decode(b64)}],
        generation_config={"response_mime_type": "application/json"},
    )
    return json.loads(response.text or "{}")
