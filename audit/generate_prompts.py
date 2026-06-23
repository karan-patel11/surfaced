from __future__ import annotations

import json

import config
from engines import call_model
from prompts import PROMPT_GENERATION


def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped

    lines = stripped.splitlines()
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _extractor_engine() -> dict:
    engine = next((e for e in config.ENGINES if e["name"] == config.EXTRACTOR_ENGINE), None)
    if engine is None:
        raise RuntimeError(f"extractor engine {config.EXTRACTOR_ENGINE!r} not found in config")
    return engine


def _parse_prompt_list(text: str) -> list[str]:
    payload = json.loads(_strip_code_fences(text))
    if not isinstance(payload, list):
        raise ValueError("expected a JSON array")

    prompts = [item.strip() for item in payload if isinstance(item, str) and item.strip()]
    if not prompts:
        raise ValueError("prompt array did not contain any strings")
    return prompts


def generate_prompts(category: str, brands: list[str], n: int) -> list[str]:
    prompt = PROMPT_GENERATION.format(
        category=category.strip(),
        brands=", ".join(brands),
        n=n,
    )
    engine = _extractor_engine()
    last_error = "unknown prompt generation error"

    for _ in range(2):
        result = call_model(engine, prompt)
        if not result.ok:
            last_error = result.error or "engine call failed"
            continue
        try:
            return _parse_prompt_list(result.text)
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)

    raise RuntimeError(
        f"prompt generation failed with {engine['name']}: {last_error}"
    )
