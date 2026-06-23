import type { AuditRun, ScoreReport } from "./types";
import { brandRecord, usable } from "./score";

function clean(value: unknown): string {
  const text = String(value ?? "").replace(/\u2014/g, "-").replace(/\u2013/g, "-").trim();
  return text || "no data";
}

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "no data";
  }
  return `${Math.round(value * 100)}%`;
}

function avgPosition(value: number | null): string {
  return value === null ? "no data" : value.toFixed(1);
}

function runDate(runId: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(runId);
  if (!match) {
    return "no data";
  }
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(date);
  return `${monthName} ${Number(day)}, ${year} ${hour}:${minute}`;
}

function truncateAnswer(answer: string, limit = 360): string {
  const text = clean(answer).replace(/\s+/g, " ");
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const excerpt = sentences.slice(0, 2).join(" ").trim() || text;
  return excerpt.length <= limit ? excerpt : `${excerpt.slice(0, limit - 1).trim()}...`;
}

function primaryScore(report: ScoreReport, primaryBrand: string) {
  return report.brand_scores.find((score) => score.name === primaryBrand);
}

function competitorEvidence(auditRun: AuditRun, report: ScoreReport, primaryBrand: string) {
  const score = primaryScore(report, primaryBrand);
  if (!score) {
    return [];
  }

  const evidence = [];
  for (const prompt of score.gap_prompts) {
    for (const result of auditRun.results) {
      if (result.prompt !== prompt || !usable(result)) {
        continue;
      }
      const primary = brandRecord(result.extraction, primaryBrand);
      if (primary?.mentioned) {
        continue;
      }
      const competitors = report.tracked_brands.filter((brand) => {
        if (brand === primaryBrand) {
          return false;
        }
        return Boolean(brandRecord(result.extraction, brand)?.mentioned);
      });
      if (!competitors.length) {
        continue;
      }
      evidence.push({
        prompt,
        engine: result.engine,
        competitors: competitors.join(", "),
        excerpt: truncateAnswer(result.answer)
      });
      if (evidence.length >= 3) {
        return evidence;
      }
    }
  }
  return evidence;
}

export function buildMarkdownReport(
  auditRun: AuditRun,
  report: ScoreReport,
  primaryBrand: string
): string {
  const lines = [
    "# Surfaced by KAPS - GEO Visibility Report",
    "",
    "## Metadata",
    `- Category: ${clean(auditRun.category || report.category)}`,
    `- Run date: ${runDate(auditRun.run_id)}`,
    `- Engines used: ${clean(report.engines.join(", "))}`,
    `- Prompts considered: ${report.considered_prompts}/${report.total_prompts}`,
    "",
    "## Share of Voice",
    "",
    "| Brand | Share | Recommendation | Avg position |",
    "|---|---:|---:|---:|"
  ];

  if (report.brand_scores.length) {
    for (const score of report.brand_scores) {
      const brandName = score.name === primaryBrand ? `${score.name} (primary)` : score.name;
      lines.push(
        `| ${clean(brandName)} | ${percent(score.share_of_voice)} | ${percent(
          score.recommendation_rate
        )} | ${avgPosition(score.avg_position)} |`
      );
    }
  } else {
    lines.push("| no data | no data | no data | no data |");
  }

  lines.push("", `## Gap List for ${clean(primaryBrand)}`);
  const score = primaryScore(report, primaryBrand);
  if (score?.gap_prompts.length) {
    for (const prompt of score.gap_prompts) {
      lines.push(`- ${clean(prompt)}`);
    }
  } else {
    lines.push("- no data");
  }

  lines.push("", "## Top Untracked Competitor Brands");
  const untracked = Object.entries(report.untracked_brands).slice(0, 10);
  if (untracked.length) {
    for (const [name, count] of untracked) {
      lines.push(`- ${clean(name)}: ${count}`);
    }
  } else {
    lines.push("- no data");
  }

  lines.push("", "## Example Evidence");
  const evidence = competitorEvidence(auditRun, report, primaryBrand);
  if (evidence.length) {
    for (const item of evidence) {
      lines.push(
        `- Prompt: ${clean(item.prompt)}. Engine: ${clean(item.engine)}. Competitor surfaced: ${clean(
          item.competitors
        )}. Excerpt: ${clean(item.excerpt)}`
      );
    }
  } else {
    lines.push("- no data");
  }

  return `${lines.join("\n").replace(/\u2014/g, "-").replace(/\u2013/g, "-").trim()}\n`;
}
