import type { ScoreReport } from "../lib/types";

export default function UntrackedBrands({ report }: { report: ScoreReport }) {
  const rows = Object.entries(report.untracked_brands);

  if (!rows.length) {
    return <div className="surface p-5 text-muted">no data</div>;
  }

  return (
    <div className="surface overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="table-heading">Brand</th>
            <th className="table-heading text-right">Mentions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([brand, count]) => (
            <tr key={brand}>
              <td className="table-cell font-medium text-ink">{brand}</td>
              <td className="table-cell text-right tabular-nums">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
