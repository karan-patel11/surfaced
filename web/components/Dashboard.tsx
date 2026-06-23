"use client";

import { useMemo, useState } from "react";
import BrandEvidence from "./BrandEvidence";
import GapTable from "./GapTable";
import Header from "./Header";
import PerEngine from "./PerEngine";
import PromptDetail from "./PromptDetail";
import Scoreboard from "./Scoreboard";
import Section from "./Section";
import UntrackedBrands from "./UntrackedBrands";
import { scoreRun } from "../lib/score";
import type { AuditRun, LoadedRun, LoadedRuns } from "../lib/types";

const scheduleNote =
  "Audits run on a schedule via an automated job; the dashboard reads the latest results.";

const emptyRun: AuditRun = {
  run_id: "",
  category: "",
  tracked_brands: [],
  engines: [],
  prompt_count: 0,
  prompts: [],
  results: []
};

function parseDateFromRunId(runId: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})-\d{6}$/.exec(runId);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return `${year}-${month}-${day}T00:00:00Z`;
}

function formatRefreshedDate(value: string | null | undefined, runId: string): string {
  const source = value || parseDateFromRunId(runId);
  if (!source) {
    return "no data";
  }
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) {
    return "no data";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function latestRunId(runBundle: LoadedRuns): string {
  const latest = runBundle.runs.find((run) => run.manifest.run_id === runBundle.manifest.latest);
  return latest?.manifest.run_id ?? runBundle.runs[0]?.manifest.run_id ?? "";
}

function categoryLabels(runs: LoadedRun[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const run of runs) {
    const category = run.manifest.category || run.auditRun.category || "no data";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return new Map(
    runs.map((run) => {
      const category = run.manifest.category || run.auditRun.category || "no data";
      const date = formatRefreshedDate(run.manifest.created, run.manifest.run_id);
      return [
        run.manifest.run_id,
        counts.get(category) && counts.get(category)! > 1 ? `${category} (${date})` : category
      ];
    })
  );
}

export default function Dashboard({
  runBundle,
  initialRunId
}: {
  runBundle: LoadedRuns;
  initialRunId?: string;
}) {
  const defaultRunId =
    runBundle.runs.find((run) => run.manifest.run_id === initialRunId)?.manifest.run_id ||
    latestRunId(runBundle);
  const [activeRunId, setActiveRunId] = useState(defaultRunId);
  const activeEntry =
    runBundle.runs.find((run) => run.manifest.run_id === activeRunId) ?? runBundle.runs[0] ?? null;
  const auditRun = activeEntry?.auditRun ?? emptyRun;
  const labels = useMemo(() => categoryLabels(runBundle.runs), [runBundle.runs]);
  const [primaryBrand, setPrimaryBrand] = useState(auditRun.tracked_brands[0] || "");
  const activePrimaryBrand = auditRun.tracked_brands.includes(primaryBrand)
    ? primaryBrand
    : auditRun.tracked_brands[0] || "no data";
  const report = useMemo(() => scoreRun(auditRun), [auditRun]);
  const refreshedDate = formatRefreshedDate(activeEntry?.manifest.created, auditRun.run_id);

  function handleRunChange(runId: string) {
    const nextEntry = runBundle.runs.find((run) => run.manifest.run_id === runId);
    setActiveRunId(runId);
    setPrimaryBrand(nextEntry?.auditRun.tracked_brands[0] || "");
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 pb-20 md:px-10 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="pt-10 lg:sticky lg:top-0 lg:h-screen lg:pt-24">
        <div className="surface p-5">
          <label className="block">
            <span className="eyebrow mb-2 block">Category</span>
            <select
              value={activeRunId}
              onChange={(event) => handleRunChange(event.target.value)}
              className="w-full rounded border border-rule bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent"
            >
              {runBundle.runs.length ? (
                runBundle.runs.map((run) => (
                  <option key={run.manifest.run_id} value={run.manifest.run_id}>
                    {labels.get(run.manifest.run_id) ?? run.manifest.category}
                  </option>
                ))
              ) : (
                <option value="">no data</option>
              )}
            </select>
          </label>

          <label className="mt-6 block">
            <span className="eyebrow mb-2 block">Primary Brand</span>
            <select
              value={activePrimaryBrand === "no data" ? "" : activePrimaryBrand}
              onChange={(event) => setPrimaryBrand(event.target.value)}
              className="w-full rounded border border-rule bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent"
            >
              {auditRun.tracked_brands.length ? (
                auditRun.tracked_brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))
              ) : (
                <option value="">no data</option>
              )}
            </select>
          </label>

          <p className="mt-6 text-xs leading-5 text-muted">{scheduleNote}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <Header
          auditRun={auditRun}
          report={report}
          primaryBrand={activePrimaryBrand}
          refreshedDate={refreshedDate}
        />
        <Section eyebrow="Share of Voice" title="Visibility Scoreboard">
          <Scoreboard report={report} primaryBrand={activePrimaryBrand} />
        </Section>
        <Section eyebrow="Per Engine" title="Engine Coverage">
          <PerEngine report={report} />
        </Section>
        <Section eyebrow="Gap Table" title="Missed Prompts">
          <GapTable report={report} primaryBrand={activePrimaryBrand} />
        </Section>
        <Section eyebrow="Untracked Brands" title="Competitor Roll-Up">
          <UntrackedBrands report={report} />
        </Section>
        <Section eyebrow="Prompt Detail" title="Evidence by Prompt">
          <PromptDetail auditRun={auditRun} />
        </Section>
        <Section eyebrow="Brand Evidence" title="Evidence by Brand">
          <BrandEvidence auditRun={auditRun} report={report} primaryBrand={activePrimaryBrand} />
        </Section>
      </div>
    </main>
  );
}
