import { notFound } from "next/navigation";
import Dashboard from "../../../components/Dashboard";
import { getAllRunIds, getRun } from "../../../lib/loadRuns";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllRunIds().map((runId) => ({ runId }));
}

export default function RunPage({ params }: { params: { runId: string } }) {
  try {
    return <Dashboard auditRun={getRun(params.runId)} />;
  } catch {
    notFound();
  }
}
