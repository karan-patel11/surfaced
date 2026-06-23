import fs from "node:fs";
import path from "node:path";
import type { AuditRun, RunIndex } from "./types";

const dataDir = process.env.SURFACED_DATA_DIR
  ? path.resolve(process.env.SURFACED_DATA_DIR)
  : path.join(process.cwd(), "..", "data");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function getRunIndex(): RunIndex {
  return readJson<RunIndex>(path.join(dataDir, "index.json"));
}

export function getAllRunIds(): string[] {
  return getRunIndex().runs.map((run) => run.run_id);
}

export function getRun(runId: string): AuditRun {
  const directPath = path.join(dataDir, "runs", `${runId}.json`);
  if (fs.existsSync(directPath)) {
    return readJson<AuditRun>(directPath);
  }

  const runsDir = path.join(dataDir, "runs");
  for (const fileName of fs.readdirSync(runsDir)) {
    if (!fileName.endsWith(".json")) {
      continue;
    }
    const run = readJson<AuditRun>(path.join(runsDir, fileName));
    if (run.run_id === runId) {
      return run;
    }
  }
  throw new Error(`Run not found: ${runId}`);
}

export function getLatestRun(): AuditRun {
  const index = getRunIndex();
  if (!index.latest) {
    throw new Error("No latest run in data/index.json");
  }
  return getRun(index.latest);
}
