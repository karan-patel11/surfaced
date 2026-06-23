import Dashboard from "../components/Dashboard";
import { getAllRuns } from "../lib/loadRuns";

export const dynamic = "force-static";

export default function HomePage() {
  return <Dashboard runBundle={getAllRuns()} />;
}
