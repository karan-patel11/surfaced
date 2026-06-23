import type { ScoreReport } from "../lib/types";

export default function GapTable({
  report,
  primaryBrand
}: {
  report: ScoreReport;
  primaryBrand: string;
}) {
  const score = report.brand_scores.find((brandScore) => brandScore.name === primaryBrand);
  const gaps = score?.gap_prompts ?? [];

  if (!gaps.length) {
    return <div className="surface p-5 text-muted">No gap prompts found for {primaryBrand}.</div>;
  }

  return (
    <div className="surface overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="table-heading">Missed prompt</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((prompt) => (
            <tr key={prompt}>
              <td className="table-cell">{prompt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
