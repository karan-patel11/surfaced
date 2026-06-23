import Dashboard from "../components/Dashboard";
import { getLatestRun } from "../lib/loadRuns";

export const dynamic = "force-static";

export default function HomePage() {
  const auditRun = getLatestRun();
  return <Dashboard auditRun={auditRun} />;
}
