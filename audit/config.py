from __future__ import annotations

import os
from pathlib import Path

import requests
from dotenv import load_dotenv


load_dotenv()

CACHE_DIR = Path("cache")
DATA_DIR = Path("data")

REQUEST_DELAY_SECONDS = float(os.environ.get("REQUEST_DELAY_SECONDS", "1.0"))
DEFAULT_PROMPT_COUNT = int(os.environ.get("DEFAULT_PROMPT_COUNT", "18"))


def _has_env(name: str) -> bool:
    return bool(os.environ.get(name, "").strip())


def _ollama_reachable() -> bool:
    host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    try:
        resp = requests.get(f"{host}/api/tags", timeout=0.25)
        return resp.ok
    except requests.RequestException:
        return False


ENGINES = [
    {
        "name": "groq-llama",
        "provider": "groq",
        "model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "enabled": _has_env("GROQ_API_KEY"),
    },
    {
        "name": "gemini",
        "provider": "gemini",
        "model": os.environ.get("GEMINI_MODEL", "gemini-1.5-flash"),
        "enabled": _has_env("GEMINI_API_KEY"),
    },
    {
        "name": "ollama-llama",
        "provider": "ollama",
        "model": os.environ.get("OLLAMA_MODEL", "llama3.1"),
        "enabled": _ollama_reachable(),
    },
    {
        "name": "openrouter",
        "provider": "openrouter",
        "model": os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"),
        "enabled": _has_env("OPENROUTER_API_KEY"),
    },
]


def _choose_extractor_engine() -> str:
    for name in ("gemini", "groq-llama", "openrouter", "ollama-llama"):
        engine = next((e for e in ENGINES if e["name"] == name), None)
        if engine and engine.get("enabled"):
            return name
    return "gemini"


EXTRACTOR_ENGINE = os.environ.get("EXTRACTOR_ENGINE", _choose_extractor_engine())

CATEGORY_PRESETS = [
    {
        "category": "project management software",
        "brands": ["Notion", "Asana", "Monday"],
    },
    {
        "category": "customer support software",
        "brands": ["Zendesk", "Intercom", "Freshdesk"],
    },
    {
        "category": "email marketing software",
        "brands": ["Mailchimp", "Klaviyo", "ConvertKit"],
    },
    {
        "category": "CRM software",
        "brands": ["HubSpot", "Salesforce", "Pipedrive"],
    },
]
