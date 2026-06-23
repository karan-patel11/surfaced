import { notFound } from "next/navigation";
import Dashboard from "../../../components/Dashboard";
import { getAllRunIds, getAllRuns } from "../../../lib/loadRuns";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllRunIds().map((runId) => ({ runId }));
}

export default function RunPage({ params }: { params: { runId: string } }) {
  const runBundle = getAllRuns();
  if (!runBundle.runs.some((run) => run.manifest.run_id === params.runId)) {
    notFound();
  }
  return <Dashboard runBundle={runBundle} initialRunId={params.runId} />;
}
