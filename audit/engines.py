"""
engines.py — unified adapter layer over multiple LLM "answer engines".

Design contract:
- One public function, call_model(engine, prompt), returns an EngineResult with an
  identical shape for every provider.
- Adding or removing a provider never changes calling code; it is a config + a branch here.
- Fail-soft: provider and network errors are caught and returned as ok=False results.
  This module never raises to its caller for an engine-level failure.
- This module knows nothing about caching, scoring, prompt templates, or brands. It only
  turns (engine, prompt) into a normalized result.

Supported providers: groq, gemini, ollama (local), openrouter.
All providers are free-tier reachable; OpenAI/Anthropic are intentionally not included.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, asdict
from typing import Any

import requests


# ---------------------------------------------------------------------------
# Canonical result shape — every engine returns exactly this.
# ---------------------------------------------------------------------------
@dataclass
class EngineResult:
    engine: str          # stable engine id from config, e.g. "groq-llama"
    model: str           # provider model string actually used
    prompt: str          # exact prompt sent
    text: str            # answer text; "" when ok is False
    ok: bool             # True only on a genuine successful response
    error: str | None    # error message when ok is False, else None
    latency_ms: int      # wall-clock latency

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# Network timeout (seconds) applied to every hosted call.
_TIMEOUT = 60


def call_model(engine: dict, prompt: str) -> EngineResult:
    """
    Route a prompt to the correct provider adapter and return a normalized EngineResult.

    engine: a config dict with keys: name (str), provider (str), model (str).
    prompt: the full prompt string to send.

    Never raises for an engine-level failure; returns ok=False instead.
    """
    name = engine.get("name", "unknown")
    provider = (engine.get("provider") or "").lower()
    model = engine.get("model", "")
    started = time.perf_counter()

    try:
        if provider == "groq":
            text = _call_groq(model, prompt)
        elif provider == "gemini":
            text = _call_gemini(model, prompt)
        elif provider == "ollama":
            text = _call_ollama(model, prompt)
        elif provider == "openrouter":
            text = _call_openrouter(model, prompt)
        else:
            raise ValueError(f"unknown provider: {provider!r}")

        latency_ms = int((time.perf_counter() - started) * 1000)
        text = (text or "").strip()
        if not text:
            # An empty body is a failure, not a successful empty answer.
            return EngineResult(name, model, prompt, "", False,
                                "empty response from provider", latency_ms)
        return EngineResult(name, model, prompt, text, True, None, latency_ms)

    except Exception as exc:  # fail-soft: one engine must not abort the run
        latency_ms = int((time.perf_counter() - started) * 1000)
        return EngineResult(name, model, prompt, "", False, str(exc), latency_ms)


# ---------------------------------------------------------------------------
# Provider adapters. Each takes (model, prompt) and returns raw answer text,
# or raises on failure (call_model normalizes the raise into ok=False).
# ---------------------------------------------------------------------------
def _call_groq(model: str, prompt: str) -> str:
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY not set")
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.4,
        },
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _call_gemini(model: str, prompt: str) -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={key}"
    )
    resp = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    # Gemini nests text under candidates[0].content.parts[*].text
    parts = data["candidates"][0]["content"]["parts"]
    return "".join(p.get("text", "") for p in parts)


def _call_ollama(model: str, prompt: str) -> str:
    # Local engine. Assumes `ollama serve` is running on the default port.
    host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
    resp = requests.post(
        f"{host}/api/generate",
        json={"model": model, "prompt": prompt, "stream": False},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json().get("response", "")


def _call_openrouter(model: str, prompt: str) -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY not set")
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.4,
        },
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]
