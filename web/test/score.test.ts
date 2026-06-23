import { describe, expect, it } from "vitest";
import sampleRun from "../../data/runs/sample_run.json";
import expectedReport from "./fixtures/score_report.sample.json";
import { buildMarkdownReport } from "../lib/report";
import { scoreRun } from "../lib/score";
import type { AuditRun } from "../lib/types";

describe("scoreRun", () => {
  it("matches the Python ScoreReport fixture for sample_run.json", () => {
    expect(scoreRun(sampleRun as AuditRun)).toEqual(expectedReport);
  });

  it("builds a Markdown report without em dashes", () => {
    const auditRun = sampleRun as AuditRun;
    const report = scoreRun(auditRun);
    const markdown = buildMarkdownReport(auditRun, report, auditRun.tracked_brands[0]);

    expect(markdown).toContain("Surfaced by KAPS - GEO Visibility Report");
    expect(markdown).toContain("## Share of Voice");
    expect(markdown).toContain("## Example Evidence");
    expect(markdown).not.toContain("\u2014");
    expect(markdown).not.toContain("\u2013");
  });
});
