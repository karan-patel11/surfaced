"use client";

import { useMemo, useState } from "react";
import { brandRecord, usable } from "../lib/score";
import type { AuditRun, EngineResult } from "../lib/types";

function orderedPromptResults(auditRun: AuditRun, prompt: string): EngineResult[] {
  const promptResults = auditRun.results.filter((result) => result.prompt === prompt);
  const ordered: EngineResult[] = [];
  const used = new Set<number>();
  for (const engine of auditRun.engines) {
    promptResults.forEach((result, index) => {
      if (!used.has(index) && result.engine === engine) {
        ordered.push(result);
        used.add(index);
      }
    });
  }
  promptResults.forEach((result, index) => {
    if (!used.has(index)) {
      ordered.push(result);
    }
  });
  return ordered;
}

export default function PromptDetail({ auditRun }: { auditRun: AuditRun }) {
  const prompts = auditRun.prompts ?? [];
  const [selectedPrompt, setSelectedPrompt] = useState(prompts[0] ?? "");
  const activePrompt = prompts.includes(selectedPrompt) ? selectedPrompt : prompts[0] ?? "";
  const results = useMemo(
    () => orderedPromptResults(auditRun, activePrompt),
    [auditRun, activePrompt]
  );

  if (!prompts.length) {
    return <div className="surface p-5 text-muted">no data</div>;
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="eyebrow mb-2 block">Prompt</span>
        <select
          value={activePrompt}
          onChange={(event) => setSelectedPrompt(event.target.value)}
          className="w-full rounded border border-rule bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent"
        >
          {prompts.map((prompt) => (
            <option key={prompt} value={prompt}>
              {prompt}
            </option>
          ))}
        </select>
      </label>

      {results.map((result) => (
        <article key={`${result.engine}-${result.model}`} className="surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-extrabold text-ink">{result.engine || "no data"}</div>
              <div className="mt-1 text-sm text-muted">{result.model || "no data"}</div>
            </div>
            <span className="rounded-full border border-rule px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-muted">
              {result.ok ? "ok" : "failed"}
            </span>
          </div>

          {!result.ok ? (
            <div className="mt-5 rounded border border-rule bg-paper p-4 text-sm text-ink">
              {result.error || "no data"}
            </div>
          ) : (
            <>
              <details className="mt-5 rounded border border-rule bg-paper p-4">
                <summary className="cursor-pointer text-sm font-bold text-ink">Raw answer</summary>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-body">
                  {result.answer || "no data"}
                </p>
              </details>
              {usable(result) ? (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="table-heading">Brand</th>
                        <th className="table-heading">Mentioned</th>
                        <th className="table-heading text-right">Position</th>
                        <th className="table-heading">Recommended</th>
                        <th className="table-heading">Sentiment</th>
                        <th className="table-heading">Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRun.tracked_brands.map((brand) => {
                        const record = brandRecord(result.extraction, brand);
                        const mentioned = Boolean(record?.mentioned);
                        return (
                          <tr key={brand} className={mentioned ? "" : "text-muted"}>
                            <td className="table-cell font-medium">{brand}</td>
                            <td className="table-cell">{mentioned ? "yes" : "no"}</td>
                            <td className="table-cell text-right tabular-nums">
                              {record?.position ?? "no data"}
                            </td>
                            <td className="table-cell">{record?.recommended ? "yes" : "no"}</td>
                            <td className="table-cell">{record?.sentiment || "no data"}</td>
                            <td className="table-cell">{record?.context || "no data"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-4 text-sm text-muted">
                    <span className="font-bold text-ink">Other brands mentioned:</span>{" "}
                    {result.extraction.other_brands_mentioned?.length
                      ? result.extraction.other_brands_mentioned.join(", ")
                      : "no data"}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded border border-rule bg-paper p-4 text-sm text-muted">
                  no data
                </div>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
