from __future__ import annotations

import json
from typing import Any

from engines import call_model
from prompts import EXTRACTION


_REQUIRED_BRAND_KEYS = {
    "name",
    "mentioned",
    "position",
    "recommended",
    "sentiment",
    "context",
}
_SENTIMENTS = {"positive", "neutral", "negative", "absent"}


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


def _build_prompt(prompt: str, answer: str, tracked_brands: list[str]) -> str:
    return (
        EXTRACTION
        .replace("{prompt}", prompt)
        .replace("{answer}", answer)
        .replace("{tracked_brands}", json.dumps(tracked_brands, ensure_ascii=False))
    )


def _validate_brand_record(record: Any, tracked_names: set[str]) -> None:
    if not isinstance(record, dict):
        raise ValueError("brand record must be an object")
    missing = _REQUIRED_BRAND_KEYS - set(record)
    if missing:
        raise ValueError(f"brand record missing keys: {sorted(missing)}")
    if not isinstance(record["name"], str) or record["name"].strip().lower() not in tracked_names:
        raise ValueError("brand record has an unknown name")
    if not isinstance(record["mentioned"], bool):
        raise ValueError("mentioned must be boolean")
    if not isinstance(record["recommended"], bool):
        raise ValueError("recommended must be boolean")
    position = record["position"]
    if position is not None and (not isinstance(position, int) or position < 1):
        raise ValueError("position must be null or a positive integer")
    if record["sentiment"] not in _SENTIMENTS:
        raise ValueError("sentiment has an unknown label")
    if not isinstance(record["context"], str):
        raise ValueError("context must be a string")


def _validate_extraction(payload: Any, tracked_brands: list[str]) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("expected a JSON object")
    if not isinstance(payload.get("brands"), list):
        raise ValueError("missing brands list")
    if not isinstance(payload.get("other_brands_mentioned"), list):
        raise ValueError("missing other_brands_mentioned list")

    tracked_names = {b.strip().lower() for b in tracked_brands}
    seen = set()
    for record in payload["brands"]:
        _validate_brand_record(record, tracked_names)
        seen.add(record["name"].strip().lower())

    missing = tracked_names - seen
    if missing:
        raise ValueError(f"missing tracked brand records: {sorted(missing)}")

    for name in payload["other_brands_mentioned"]:
        if not isinstance(name, str):
            raise ValueError("other_brands_mentioned must contain strings")

    return payload


def extract(prompt: str, answer: str, tracked_brands: list[str], engine: dict) -> dict:
    extraction_prompt = _build_prompt(prompt, answer, tracked_brands)
    extractor_engine = dict(engine)
    extractor_engine["temperature"] = 0
    last_error = "unknown extraction error"

    for _ in range(2):
        result = call_model(extractor_engine, extraction_prompt)
        if not result.ok:
            last_error = result.error or "engine call failed"
            continue
        try:
            payload = json.loads(_strip_code_fences(result.text))
            return _validate_extraction(payload, tracked_brands)
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)

    return {
        "error": f"malformed extraction: {last_error}",
        "brands": [],
        "other_brands_mentioned": [],
    }
