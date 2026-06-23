"""
score.py — pure, deterministic aggregation of an audit_run into a ScoreReport.

Contract:
  - No network, no disk, no LLM calls. score_run() is a pure function: identical input
    yields byte-identical output. This is what makes the scoreboard trustworthy.
  - Operates only on the structured `extraction` objects inside the audit_run.
  - A result with ok=False or extraction=None is MISSING DATA. It never counts as a
    zero-mention success and is excluded from the denominators it would distort.

Definitions:
  - "Considered" prompts for an engine = prompts where that engine returned a usable
    extraction. Share-of-voice denominators use considered prompts, not all prompts, so a
    dead engine does not silently deflate every brand's score.
  - share_of_voice(brand) = prompts where brand.mentioned / considered prompts.
  - recommendation_rate(brand) = prompts where brand.recommended / considered prompts.
  - avg_position(brand) = mean of brand.position over prompts where mentioned with a
    numeric position (lower is better; None if never positioned).
  - A "gap" = a (prompt) where at least one OTHER tracked brand was mentioned but THIS brand
    was not, aggregated per brand. The per-brand gap list is the headline output.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class BrandScore:
    name: str
    mentions: int = 0
    recommendations: int = 0
    share_of_voice: float = 0.0          # 0..1 over considered prompts
    recommendation_rate: float = 0.0     # 0..1 over considered prompts
    avg_position: float | None = None    # mean first-mention rank, lower is better
    sentiment: dict[str, int] = field(default_factory=dict)  # label -> count
    gap_prompts: list[str] = field(default_factory=list)     # prompts brand missed but a rival won


@dataclass
class ScoreReport:
    category: str
    tracked_brands: list[str]
    considered_prompts: int               # prompts with >=1 usable extraction
    total_prompts: int
    engines: list[str]
    brand_scores: list[BrandScore]
    per_engine_share: dict[str, dict[str, float]]   # engine -> brand -> share_of_voice
    untracked_brands: dict[str, int]      # competitor brand -> mention count, desc
    coverage: dict[str, dict[str, int]]   # engine -> {ok, failed} call counts

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["brand_scores"] = [asdict(b) for b in self.brand_scores]
        return d


def _usable(result: dict) -> bool:
    """A result contributes to scoring only if the engine succeeded and extraction parsed."""
    ext = result.get("extraction")
    return bool(result.get("ok")) and isinstance(ext, dict) and isinstance(
        ext.get("brands"), list
    )


def _brand_record(extraction: dict, brand: str) -> dict | None:
    for b in extraction.get("brands", []):
        if isinstance(b, dict) and b.get("name", "").strip().lower() == brand.strip().lower():
            return b
    return None


def score_run(audit_run: dict) -> ScoreReport:
    """Aggregate an audit_run dict into a deterministic ScoreReport."""
    brands: list[str] = list(audit_run.get("tracked_brands", []))
    results: list[dict] = list(audit_run.get("results", []))
    engines: list[str] = list(audit_run.get("engines", []))
    prompts: list[str] = list(audit_run.get("prompts", []))

    # Group usable results by prompt so we can reason per-prompt across engines.
    usable_by_prompt: dict[str, list[dict]] = {}
    for r in results:
        if _usable(r):
            usable_by_prompt.setdefault(r["prompt"], []).append(r)

    considered_prompts = len(usable_by_prompt)

    # Stable initial state for every tracked brand.
    scores: dict[str, BrandScore] = {b: BrandScore(name=b) for b in brands}
    positions: dict[str, list[int]] = {b: [] for b in brands}

    # A brand is "present on a prompt" if mentioned in ANY usable engine answer for it.
    for prompt, prompt_results in usable_by_prompt.items():
        present: dict[str, bool] = {b: False for b in brands}
        recommended: dict[str, bool] = {b: False for b in brands}

        for r in prompt_results:
            ext = r["extraction"]
            for b in brands:
                rec = _brand_record(ext, b)
                if rec is None:
                    continue
                if rec.get("mentioned"):
                    present[b] = True
                    pos = rec.get("position")
                    if isinstance(pos, int) and pos > 0:
                        positions[b].append(pos)
                    sentiment = rec.get("sentiment", "neutral") or "neutral"
                    scores[b].sentiment[sentiment] = scores[b].sentiment.get(sentiment, 0) + 1
                if rec.get("recommended"):
                    recommended[b] = True

        present_brands = [b for b in brands if present[b]]
        for b in brands:
            if present[b]:
                scores[b].mentions += 1
            if recommended[b]:
                scores[b].recommendations += 1
            # Gap: this brand absent on a prompt where a rival was present.
            if not present[b] and any(present[o] for o in present_brands):
                scores[b].gap_prompts.append(prompt)

    # Finalize rates and average positions over the considered-prompt denominator.
    denom = considered_prompts if considered_prompts > 0 else 1
    for b in brands:
        s = scores[b]
        s.share_of_voice = round(s.mentions / denom, 4)
        s.recommendation_rate = round(s.recommendations / denom, 4)
        s.avg_position = round(sum(positions[b]) / len(positions[b]), 2) if positions[b] else None

    # Per-engine share of voice (each engine judged on its own usable prompts).
    per_engine_share: dict[str, dict[str, float]] = {}
    coverage: dict[str, dict[str, int]] = {}
    for eng in engines:
        eng_results = [r for r in results if r.get("engine") == eng]
        ok_results = [r for r in eng_results if _usable(r)]
        coverage[eng] = {
            "ok": sum(1 for r in eng_results if r.get("ok")),
            "failed": sum(1 for r in eng_results if not r.get("ok")),
        }
        eng_denom = len(ok_results) if ok_results else 1
        per_engine_share[eng] = {}
        for b in brands:
            hits = 0
            for r in ok_results:
                rec = _brand_record(r["extraction"], b)
                if rec and rec.get("mentioned"):
                    hits += 1
            per_engine_share[eng][b] = round(hits / eng_denom, 4)

    # Untracked competitor roll-up, sorted by frequency then name for determinism.
    untracked_counts: dict[str, int] = {}
    for r in results:
        if not _usable(r):
            continue
        for name in r["extraction"].get("other_brands_mentioned", []) or []:
            if not isinstance(name, str):
                continue
            clean = name.strip()
            if clean and clean.lower() not in {b.lower() for b in brands}:
                untracked_counts[clean] = untracked_counts.get(clean, 0) + 1
    untracked_brands = dict(
        sorted(untracked_counts.items(), key=lambda kv: (-kv[1], kv[0].lower()))
    )

    # Order brand_scores by share of voice desc, then name, for stable display.
    ordered = sorted(
        scores.values(), key=lambda s: (-s.share_of_voice, s.name.lower())
    )

    return ScoreReport(
        category=audit_run.get("category", ""),
        tracked_brands=brands,
        considered_prompts=considered_prompts,
        total_prompts=len(prompts),
        engines=engines,
        brand_scores=ordered,
        per_engine_share=per_engine_share,
        untracked_brands=untracked_brands,
        coverage=coverage,
    )
