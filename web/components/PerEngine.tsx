import type { ScoreReport } from "../lib/types";

function percent(value: number | undefined): string {
  return value === undefined ? "no data" : `${Math.round(value * 100)}%`;
}

export default function PerEngine({ report }: { report: ScoreReport }) {
  if (!report.engines.length) {
    return <div className="surface p-5 text-muted">no data</div>;
  }

  return (
    <div className="surface overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="table-heading">Engine</th>
            <th className="table-heading text-right">Ok</th>
            <th className="table-heading text-right">Failed</th>
            {report.tracked_brands.map((brand) => (
              <th key={brand} className="table-heading text-right">
                {brand}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.engines.map((engine) => (
            <tr key={engine}>
              <td className="table-cell font-medium text-ink">{engine}</td>
              <td className="table-cell text-right tabular-nums">{report.coverage[engine]?.ok ?? 0}</td>
              <td className="table-cell text-right tabular-nums">
                {report.coverage[engine]?.failed ?? 0}
              </td>
              {report.tracked_brands.map((brand) => (
                <td key={brand} className="table-cell text-right tabular-nums">
                  {percent(report.per_engine_share[engine]?.[brand])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
