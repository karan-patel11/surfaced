import type { ScoreReport } from "../lib/types";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function avg(value: number | null): string {
  return value === null ? "no data" : value.toFixed(1);
}

export default function Scoreboard({
  report,
  primaryBrand
}: {
  report: ScoreReport;
  primaryBrand: string;
}) {
  if (!report.brand_scores.length) {
    return <div className="surface p-5 text-muted">no data</div>;
  }

  return (
    <div className="surface px-5">
      {report.brand_scores.map((score) => {
        const isPrimary = score.name === primaryBrand;
        return (
          <div
            key={score.name}
            className="grid min-h-24 gap-4 border-b border-rule py-5 last:border-b-0 md:grid-cols-[minmax(140px,0.8fr)_minmax(180px,2fr)_minmax(240px,1fr)] md:items-center"
          >
            <div>
              <div className="font-extrabold text-ink">{score.name}</div>
              {isPrimary ? <div className="eyebrow mt-2 text-[0.62rem]">Primary</div> : null}
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-track">
              <div
                className={`h-full rounded-full ${isPrimary ? "bg-accent" : "bg-bar"}`}
                style={{ width: pct(score.share_of_voice), minWidth: score.share_of_voice ? 3 : 0 }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="eyebrow text-[0.62rem]">Share</div>
                <div className="mt-1 font-sans text-xl font-extrabold tabular-nums text-ink">
                  {pct(score.share_of_voice)}
                </div>
              </div>
              <div>
                <div className="eyebrow text-[0.62rem]">Recommend</div>
                <div className="mt-1 font-sans text-xl font-extrabold tabular-nums text-ink">
                  {pct(score.recommendation_rate)}
                </div>
              </div>
              <div>
                <div className="eyebrow text-[0.62rem]">Avg pos</div>
                <div className="mt-1 font-sans text-xl font-extrabold tabular-nums text-ink">
                  {avg(score.avg_position)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
