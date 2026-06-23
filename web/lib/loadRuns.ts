import fs from "node:fs";
import path from "node:path";
import type { AuditRun, LoadedRuns, RunIndex } from "./types";

function findDataDir(): string {
  const candidates = [
    process.env.SURFACED_DATA_DIR ? path.resolve(process.env.SURFACED_DATA_DIR) : null,
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), "..", "data")
  ].filter(Boolean) as string[];

  const dataDir = candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.json")));
  if (!dataDir) {
    throw new Error("No data/index.json found");
  }
  return dataDir;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function getRunIndex(): RunIndex {
  return readJson<RunIndex>(path.join(findDataDir(), "index.json"));
}

export function getAllRunIds(): string[] {
  return getAllRuns().runs.map((run) => run.manifest.run_id);
}

export function getRun(runId: string): AuditRun {
  const dataDir = findDataDir();
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

export function getAllRuns(): LoadedRuns {
  const dataDir = findDataDir();
  const manifest = readJson<RunIndex>(path.join(dataDir, "index.json"));
  const runs: LoadedRuns["runs"] = [];

  for (const entry of manifest.runs) {
    try {
      const auditRun = readJson<AuditRun>(path.join(dataDir, "runs", `${entry.run_id}.json`));
      if (!auditRun || typeof auditRun !== "object" || !Array.isArray(auditRun.results)) {
        continue;
      }
      runs.push({ manifest: entry, auditRun });
    } catch {
      continue;
    }
  }

  return { manifest, runs };
}

export function getLatestRun(): AuditRun {
  const { manifest, runs } = getAllRuns();
  const latest = runs.find((run) => run.manifest.run_id === manifest.latest) ?? runs[0];
  if (!latest) {
    throw new Error("No valid runs in data/index.json");
  }
  return latest.auditRun;
}
