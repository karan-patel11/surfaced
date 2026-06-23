import type { AuditRun, BrandExtraction, EngineResult, Extraction, ScoreReport } from "./types";

function usable(result: EngineResult): result is EngineResult & { extraction: Extraction } {
  return Boolean(result.ok) && Boolean(result.extraction) && Array.isArray(result.extraction?.brands);
}

function brandRecord(extraction: Extraction, brand: string): BrandExtraction | undefined {
  const target = brand.trim().toLowerCase();
  return extraction.brands.find((record) => record.name.trim().toLowerCase() === target);
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreRun(auditRun: AuditRun): ScoreReport {
  const brands = [...(auditRun.tracked_brands ?? [])];
  const results = [...(auditRun.results ?? [])];
  const engines = [...(auditRun.engines ?? [])];
  const prompts = [...(auditRun.prompts ?? [])];

  const usableByPrompt = new Map<string, Array<EngineResult & { extraction: Extraction }>>();
  for (const result of results) {
    if (usable(result)) {
      const group = usableByPrompt.get(result.prompt) ?? [];
      group.push(result);
      usableByPrompt.set(result.prompt, group);
    }
  }

  const consideredPrompts = usableByPrompt.size;
  const scores = new Map(
    brands.map((brand) => [
      brand,
      {
        name: brand,
        mentions: 0,
        recommendations: 0,
        share_of_voice: 0,
        recommendation_rate: 0,
        avg_position: null as number | null,
        sentiment: {} as Record<string, number>,
        gap_prompts: [] as string[]
      }
    ])
  );
  const positions = new Map(brands.map((brand) => [brand, [] as number[]]));

  for (const [prompt, promptResults] of usableByPrompt.entries()) {
    const present = new Map(brands.map((brand) => [brand, false]));
    const recommended = new Map(brands.map((brand) => [brand, false]));

    for (const result of promptResults) {
      for (const brand of brands) {
        const record = brandRecord(result.extraction, brand);
        if (!record) {
          continue;
        }
        if (record.mentioned) {
          present.set(brand, true);
          if (Number.isInteger(record.position) && record.position !== null && record.position > 0) {
            positions.get(brand)?.push(record.position);
          }
          const sentiment = record.sentiment || "neutral";
          const score = scores.get(brand);
          if (score) {
            score.sentiment[sentiment] = (score.sentiment[sentiment] ?? 0) + 1;
          }
        }
        if (record.recommended) {
          recommended.set(brand, true);
        }
      }
    }

    const presentBrands = brands.filter((brand) => present.get(brand));
    for (const brand of brands) {
      const score = scores.get(brand);
      if (!score) {
        continue;
      }
      if (present.get(brand)) {
        score.mentions += 1;
      }
      if (recommended.get(brand)) {
        score.recommendations += 1;
      }
      if (!present.get(brand) && presentBrands.some((other) => present.get(other))) {
        score.gap_prompts.push(prompt);
      }
    }
  }

  const denom = consideredPrompts > 0 ? consideredPrompts : 1;
  for (const brand of brands) {
    const score = scores.get(brand);
    const brandPositions = positions.get(brand) ?? [];
    if (!score) {
      continue;
    }
    score.share_of_voice = round4(score.mentions / denom);
    score.recommendation_rate = round4(score.recommendations / denom);
    score.avg_position = brandPositions.length
      ? round2(brandPositions.reduce((sum, position) => sum + position, 0) / brandPositions.length)
      : null;
  }

  const perEngineShare: Record<string, Record<string, number>> = {};
  const coverage: Record<string, { ok: number; failed: number }> = {};
  for (const engine of engines) {
    const engineResults = results.filter((result) => result.engine === engine);
    const okResults = engineResults.filter(usable);
    coverage[engine] = {
      ok: engineResults.filter((result) => result.ok).length,
      failed: engineResults.filter((result) => !result.ok).length
    };
    const engineDenom = okResults.length || 1;
    perEngineShare[engine] = {};
    for (const brand of brands) {
      let hits = 0;
      for (const result of okResults) {
        const record = brandRecord(result.extraction, brand);
        if (record?.mentioned) {
          hits += 1;
        }
      }
      perEngineShare[engine][brand] = round4(hits / engineDenom);
    }
  }

  const trackedNames = new Set(brands.map((brand) => brand.toLowerCase()));
  const untrackedCounts = new Map<string, number>();
  for (const result of results) {
    if (!usable(result)) {
      continue;
    }
    for (const name of result.extraction.other_brands_mentioned ?? []) {
      if (typeof name !== "string") {
        continue;
      }
      const clean = name.trim();
      if (clean && !trackedNames.has(clean.toLowerCase())) {
        untrackedCounts.set(clean, (untrackedCounts.get(clean) ?? 0) + 1);
      }
    }
  }
  const untracked_brands = Object.fromEntries(
    [...untrackedCounts.entries()].sort((left, right) => {
      const countDiff = right[1] - left[1];
      if (countDiff !== 0) {
        return countDiff;
      }
      return left[0].toLowerCase().localeCompare(right[0].toLowerCase());
    })
  );

  const brand_scores = [...scores.values()].sort((left, right) => {
    const shareDiff = right.share_of_voice - left.share_of_voice;
    if (shareDiff !== 0) {
      return shareDiff;
    }
    return left.name.toLowerCase().localeCompare(right.name.toLowerCase());
  });

  return {
    category: auditRun.category ?? "",
    tracked_brands: brands,
    considered_prompts: consideredPrompts,
    total_prompts: prompts.length,
    engines,
    brand_scores,
    per_engine_share: perEngineShare,
    untracked_brands,
    coverage
  };
}

export { brandRecord, usable };
