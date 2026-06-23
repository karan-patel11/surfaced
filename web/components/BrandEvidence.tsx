"use client";

import { useMemo } from "react";
import { brandRecord, usable } from "../lib/score";
import type { AuditRun, ScoreReport } from "../lib/types";

function orderedPromptResults(auditRun: AuditRun, prompt: string) {
  return auditRun.results
    .filter((result) => result.prompt === prompt)
    .sort((left, right) => auditRun.engines.indexOf(left.engine) - auditRun.engines.indexOf(right.engine));
}

function truncate(text: string, limit = 260): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    return "no data";
  }
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trim()}...`;
}

function sentenceExcerpt(answer: string, names: string[], fallback = "", limit = 240): string {
  const sentences = (answer || "").split(/(?<=[.!?])\s+/);
  const loweredNames = names.map((name) => name.toLowerCase()).filter(Boolean);
  const hit = sentences.find((sentence) =>
    loweredNames.some((name) => sentence.toLowerCase().includes(name))
  );
  return truncate(hit || fallback || answer, limit);
}

export default function BrandEvidence({
  auditRun,
  report,
  primaryBrand
}: {
  auditRun: AuditRun;
  report: ScoreReport;
  primaryBrand: string;
}) {
  const brands = report.tracked_brands;
  const selectedBrand = brands.includes(primaryBrand) ? primaryBrand : brands[0] || "";

  const surfaced = useMemo(() => {
    return auditRun.prompts
      .map((prompt) => {
        const hits = orderedPromptResults(auditRun, prompt)
          .filter(usable)
          .map((result) => {
            const record = brandRecord(result.extraction, selectedBrand);
            if (!record?.mentioned) {
              return null;
            }
            return {
              engine: result.engine,
              context: record.context || sentenceExcerpt(result.answer, [selectedBrand])
            };
          })
          .filter(Boolean) as Array<{ engine: string; context: string }>;
        return hits.length ? { prompt, hits } : null;
      })
      .filter(Boolean) as Array<{ prompt: string; hits: Array<{ engine: string; context: string }> }>;
  }, [auditRun, selectedBrand]);

  const missed = useMemo(() => {
    const score = report.brand_scores.find((brandScore) => brandScore.name === selectedBrand);
    return (score?.gap_prompts ?? [])
      .map((prompt) => {
        const hits = orderedPromptResults(auditRun, prompt)
          .filter(usable)
          .flatMap((result) =>
            report.tracked_brands.flatMap((competitor) => {
              if (competitor === selectedBrand) {
                return [];
              }
              const record = brandRecord(result.extraction, competitor);
              if (!record?.mentioned) {
                return [];
              }
              return [
                {
                  engine: result.engine,
                  competitor,
                  snippet: sentenceExcerpt(result.answer, [competitor], record.context)
                }
              ];
            })
          );
        return hits.length ? { prompt, hits } : null;
      })
      .filter(Boolean) as Array<{
      prompt: string;
      hits: Array<{ engine: string; competitor: string; snippet: string }>;
    }>;
  }, [auditRun, report, selectedBrand]);

  if (!brands.length) {
    return <div className="surface p-5 text-muted">no data</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <EvidenceColumn title="Surfaced on">
          {surfaced.length ? (
            surfaced.map((item) => (
              <EvidenceCard key={item.prompt} title={item.prompt}>
                {item.hits.map((hit) => (
                  <p key={`${item.prompt}-${hit.engine}`} className="mt-2 text-sm leading-6">
                    <span className="font-bold text-ink">{hit.engine}:</span> {hit.context || "no data"}
                  </p>
                ))}
              </EvidenceCard>
            ))
          ) : (
            <div className="surface p-5 text-muted">no data</div>
          )}
        </EvidenceColumn>

        <EvidenceColumn title="Missed on">
          {missed.length ? (
            missed.map((item) => (
              <EvidenceCard key={item.prompt} title={item.prompt}>
                {item.hits.map((hit) => (
                  <p
                    key={`${item.prompt}-${hit.engine}-${hit.competitor}-${hit.snippet}`}
                    className="mt-2 text-sm leading-6"
                  >
                    <span className="font-bold text-ink">
                      {hit.competitor} via {hit.engine}:
                    </span>{" "}
                    {hit.snippet || "no data"}
                  </p>
                ))}
              </EvidenceCard>
            ))
          ) : (
            <div className="surface p-5 text-muted">no data</div>
          )}
        </EvidenceColumn>
      </div>
    </div>
  );
}

function EvidenceColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-4 font-serif text-3xl font-semibold text-ink">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function EvidenceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="surface p-5">
      <div className="font-bold leading-6 text-ink">{title}</div>
      <div className="mt-3 text-body">{children}</div>
    </article>
  );
}
