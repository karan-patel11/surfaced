"""
run_audit.py — orchestrates the full audit and owns ALL caching.

Pipeline:
  1. Resolve prompts (generate from category, or accept a supplied list).
  2. For each (engine, prompt): call the model, but read the disk cache first.
  3. For each successful raw answer: extract structured JSON, cache-first again.
  4. Assemble one audit_run dict and persist it to data/<run_id>.json.

Caching rules:
  - Raw-answer cache key  = sha256(engine_name | model | prompt)
  - Extraction cache key  = sha256(extractor_name | prompt | answer_hash | sorted(brands))
  - Always read cache before a network call; always write cache after a success.
  - A failed engine call is recorded as a result with ok=False and is NOT cached
    (so a later run can retry it), and its extraction is null.

This module imports the engine adapter, the extractor, and the prompt generator. It does
not itself talk to any provider directly.
"""

from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime
from pathlib import Path

import config
from engines import call_model, EngineResult
from extract import extract
from generate_prompts import generate_prompts


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------
def _hash(*parts: str) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(p.encode("utf-8"))
        h.update(b"\x00")  # delimiter so concatenation is unambiguous
    return h.hexdigest()


def _cache_path(prefix: str, key: str) -> Path:
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return config.CACHE_DIR / f"{prefix}_{key}.json"


def _cache_read(path: Path) -> dict | None:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None  # corrupt cache entry is treated as a miss
    return None


def _cache_write(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Cached unit operations
# ---------------------------------------------------------------------------
def _answer_with_cache(engine: dict, prompt: str) -> EngineResult:
    """Return a model answer, reading/writing the raw-answer cache. Successes are cached."""
    key = _hash(engine["name"], engine.get("model", ""), prompt)
    path = _cache_path("raw", key)

    cached = _cache_read(path)
    if cached is not None:
        return EngineResult(**cached)

    time.sleep(config.REQUEST_DELAY_SECONDS)  # rate-limit hygiene on real calls only
    result = call_model(engine, prompt)
    if result.ok:
        _cache_write(path, result.to_dict())
    return result


def _extract_with_cache(prompt: str, answer: str, brands: list[str], extractor: dict) -> dict:
    """Return structured extraction JSON, reading/writing the extraction cache."""
    answer_hash = _hash(answer)
    key = _hash(extractor["name"], prompt, answer_hash, "|".join(sorted(brands)))
    path = _cache_path("ext", key)

    cached = _cache_read(path)
    if cached is not None:
        return cached

    time.sleep(config.REQUEST_DELAY_SECONDS)
    extraction = extract(prompt, answer, brands, extractor)
    if "error" not in extraction:
        _cache_write(path, extraction)
    return extraction


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def run_audit(
    category: str,
    brands: list[str],
    n: int | None = None,
    prompts: list[str] | None = None,
    persist: bool = True,
) -> dict:
    """
    Execute a full audit and return the audit_run dict (also written to data/ if persist).

    category : product category string
    brands   : tracked brand names
    n        : number of prompts to generate (defaults to config.DEFAULT_PROMPT_COUNT)
    prompts  : optional explicit prompt list; if given, generation is skipped
    """
    n = n or config.DEFAULT_PROMPT_COUNT
    engines = [e for e in config.ENGINES if e.get("enabled")]
    if not engines:
        raise RuntimeError("no enabled engines in config.ENGINES")

    extractor = next((e for e in config.ENGINES if e["name"] == config.EXTRACTOR_ENGINE), None)
    if extractor is None:
        raise RuntimeError(f"extractor engine {config.EXTRACTOR_ENGINE!r} not found in config")

    if prompts is None:
        prompts = generate_prompts(category, brands, n)

    results: list[dict] = []
    for prompt in prompts:
        for engine in engines:
            answer = _answer_with_cache(engine, prompt)
            if answer.ok:
                extraction = _extract_with_cache(prompt, answer.text, brands, extractor)
            else:
                extraction = None
            results.append({
                "prompt": prompt,
                "engine": answer.engine,
                "model": answer.model,
                "ok": answer.ok,
                "error": answer.error,
                "latency_ms": answer.latency_ms,
                "answer": answer.text,
                "extraction": extraction,
            })

    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    audit_run = {
        "run_id": run_id,
        "category": category,
        "tracked_brands": brands,
        "engines": [e["name"] for e in engines],
        "prompt_count": len(prompts),
        "prompts": prompts,
        "results": results,
    }

    if persist:
        config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        out = config.DATA_DIR / f"{run_id}.json"
        out.write_text(json.dumps(audit_run, ensure_ascii=False, indent=2), encoding="utf-8")

    return audit_run


if __name__ == "__main__":
    # Minimal CLI for a quick end-to-end smoke run.
    import argparse

    parser = argparse.ArgumentParser(description="Run an AnswerLens audit.")
    parser.add_argument("--category", required=True)
    parser.add_argument("--brands", required=True, help="comma-separated brand names")
    parser.add_argument("--n", type=int, default=None)
    args = parser.parse_args()

    run = run_audit(
        category=args.category,
        brands=[b.strip() for b in args.brands.split(",") if b.strip()],
        n=args.n,
    )
    ok = sum(1 for r in run["results"] if r["ok"])
    print(f"run {run['run_id']}: {ok}/{len(run['results'])} engine calls ok, "
          f"{run['prompt_count']} prompts, engines={run['engines']}")
