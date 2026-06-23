from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import config
from run_audit import run_audit
from score import score_run


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
RUNS_DIR = DATA_DIR / "runs"
INDEX_PATH = DATA_DIR / "index.json"


def _created_from_run_id(run_id: str) -> str:
    try:
        parsed = datetime.strptime(run_id, "%Y%m%d-%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return "no data"
    return parsed.isoformat().replace("+00:00", "Z")


def _load_run(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _manifest_entry(run: dict[str, Any]) -> dict[str, Any]:
    prompts = run.get("prompts", [])
    return {
        "run_id": run.get("run_id", "no data"),
        "category": run.get("category", "no data"),
        "created": _created_from_run_id(str(run.get("run_id", ""))),
        "engines": list(run.get("engines", [])),
        "prompt_count": run.get("prompt_count", len(prompts) if isinstance(prompts, list) else 0),
    }


def rebuild_index() -> dict[str, Any]:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    by_run_id: dict[str, dict[str, Any]] = {}
    for path in RUNS_DIR.glob("*.json"):
        run = _load_run(path)
        if not run:
            continue
        run_id = str(run.get("run_id", "")).strip()
        if not run_id:
            continue
        if run_id not in by_run_id or path.stem == run_id:
            by_run_id[run_id] = _manifest_entry(run)

    runs = sorted(
        by_run_id.values(),
        key=lambda item: (item.get("created", ""), item.get("run_id", "")),
        reverse=True,
    )
    index = {"latest": runs[0]["run_id"] if runs else None, "runs": runs}
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return index


def _refresh_targets() -> list[dict[str, Any]]:
    targets = getattr(config, "REFRESH_TARGETS", None) or config.CATEGORY_PRESETS
    return [dict(target) for target in targets]


def refresh() -> None:
    os.chdir(PROJECT_ROOT)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    prompt_count = int(os.environ.get("REFRESH_PROMPT_COUNT", config.DEFAULT_PROMPT_COUNT))

    for target in _refresh_targets():
        category = str(target.get("category", "")).strip()
        brands = [str(brand).strip() for brand in target.get("brands", []) if str(brand).strip()]
        if not category or not brands:
            raise RuntimeError(f"invalid refresh target: {target!r}")

        run = run_audit(category=category, brands=brands, n=prompt_count)
        report = score_run(run)
        if report.considered_prompts <= 0:
            staged = DATA_DIR / f"{run.get('run_id', 'failed')}.json"
            if staged.exists():
                staged.unlink()
            raise RuntimeError(f"zero usable results for {category}")

        run_id = str(run["run_id"])
        source = DATA_DIR / f"{run_id}.json"
        destination = RUNS_DIR / f"{run_id}.json"
        if source.exists():
            shutil.move(str(source), destination)
        else:
            destination.write_text(
                json.dumps(run, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    rebuild_index()


if __name__ == "__main__":
    refresh()
