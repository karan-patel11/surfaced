import DownloadReport from "./DownloadReport";
import type { AuditRun, ScoreReport } from "../lib/types";

export default function Header({
  auditRun,
  report,
  primaryBrand,
  refreshedDate
}: {
  auditRun: AuditRun;
  report: ScoreReport;
  primaryBrand: string;
  refreshedDate: string;
}) {
  return (
    <header className="grid gap-8 pb-10 pt-16 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:pt-24">
      <div>
        <div className="eyebrow mb-3">KAPS</div>
        <h1 className="font-serif text-[clamp(4rem,9vw,7.5rem)] font-semibold leading-[0.9]">
          Surfaced
        </h1>
        <p className="mt-8 max-w-2xl text-sm leading-7 text-muted md:text-base">
          {report.category || "no data"} | {report.considered_prompts}/{report.total_prompts}{" "}
          prompts considered | Refreshed {refreshedDate}
        </p>
      </div>
      <div className="md:pt-5">
        <DownloadReport auditRun={auditRun} report={report} primaryBrand={primaryBrand} />
      </div>
    </header>
  );
}
