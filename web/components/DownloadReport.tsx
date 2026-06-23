"use client";

import { buildMarkdownReport } from "../lib/report";
import type { AuditRun, ScoreReport } from "../lib/types";

function fileName(runId: string): string {
  const clean = (runId || "run").replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "");
  return `surfaced_report_${clean || "run"}.md`;
}

export default function DownloadReport({
  auditRun,
  report,
  primaryBrand
}: {
  auditRun: AuditRun;
  report: ScoreReport;
  primaryBrand: string;
}) {
  function handleDownload() {
    const markdown = buildMarkdownReport(auditRun, report, primaryBrand);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName(auditRun.run_id);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="w-full rounded border border-accent bg-accent px-5 py-3 text-sm font-bold text-surface transition hover:bg-ink md:w-auto"
    >
      Download report
    </button>
  );
}
