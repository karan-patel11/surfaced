import BrandEvidence from "./BrandEvidence";
import GapTable from "./GapTable";
import Header from "./Header";
import PerEngine from "./PerEngine";
import PromptDetail from "./PromptDetail";
import Scoreboard from "./Scoreboard";
import Section from "./Section";
import UntrackedBrands from "./UntrackedBrands";
import { scoreRun } from "../lib/score";
import type { AuditRun } from "../lib/types";

export default function Dashboard({ auditRun }: { auditRun: AuditRun }) {
  const report = scoreRun(auditRun);
  const primaryBrand = auditRun.tracked_brands[0] || "no data";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 pb-20 md:px-10">
      <Header auditRun={auditRun} report={report} primaryBrand={primaryBrand} />
      <Section eyebrow="Share of Voice" title="Visibility Scoreboard">
        <Scoreboard report={report} primaryBrand={primaryBrand} />
      </Section>
      <Section eyebrow="Per Engine" title="Engine Coverage">
        <PerEngine report={report} />
      </Section>
      <Section eyebrow="Gap Table" title="Missed Prompts">
        <GapTable report={report} primaryBrand={primaryBrand} />
      </Section>
      <Section eyebrow="Untracked Brands" title="Competitor Roll-Up">
        <UntrackedBrands report={report} />
      </Section>
      <Section eyebrow="Prompt Detail" title="Evidence by Prompt">
        <PromptDetail auditRun={auditRun} />
      </Section>
      <Section eyebrow="Brand Evidence" title="Evidence by Brand">
        <BrandEvidence auditRun={auditRun} report={report} primaryBrand={primaryBrand} />
      </Section>
    </main>
  );
}
