import { opportunityAnalysisHref } from "@/lib/apex-opportunities/hrefs";
import { VERDICT_META } from "@/lib/decision-engine/verdict";
import { simulateUnitMarks } from "@/lib/lab/backtest";
import { buildComparison } from "@/lib/lab/compare";
import { buildFeatureSeries } from "@/lib/lab/features";
import { formatEv, formatScore } from "@/lib/lab/format";
import { LAB_MODELS } from "@/lib/lab/registry";
import type { LabDecisionView, LabKpi, LabWorkspace } from "@/lib/lab/types";
import type {
  LabBookLoad,
  LabFeaturedLoad,
  LabResearchLoad,
  LabScanLoad,
} from "@/lib/lab/load";
import type { ApexDecision } from "@/lib/decision-engine/types";

function decisionKpis(decision: ApexDecision): LabKpi[] {
  return [
    { label: "Score", value: formatScore(decision.score.value), tone: "accent" },
    {
      label: "Conf",
      value: formatScore(decision.confidence.value),
      tone: decision.confidence.band === "high" ? "success" : "warning",
    },
    {
      label: "Risk",
      value: `${formatScore(decision.risk.score)} ${decision.risk.band}`,
      tone: decision.risk.band === "high" ? "danger" : "neutral",
    },
    { label: "EV", value: formatEv(decision.value.expectedValue) },
    {
      label: "Kelly",
      value:
        decision.sizing.kellyPct == null
          ? "—"
          : `${decision.sizing.kellyPct.toFixed(1)}%`,
    },
    { label: "Stake", value: decision.sizing.stakeLabel },
  ];
}

export function buildDecisionView(
  featured: LabFeaturedLoad,
): LabDecisionView | null {
  if (!featured.decision || !featured.label) return null;
  return {
    matchLabel: featured.label,
    href: featured.href,
    verdictLabel: featured.decision.verdict.label,
    verdictKind: featured.decision.verdict.kind,
    selectionLabel: featured.decision.selectionLabel,
    explanation: featured.decision.explanation,
    kpis: decisionKpis(featured.decision),
    components: featured.decision.score.components,
    reasonsFor: featured.decision.reasonsFor,
    reasonsAgainst: featured.decision.reasonsAgainst,
  };
}

export function buildLabWorkspace(input: {
  scan: LabScanLoad;
  research: LabResearchLoad;
  book: LabBookLoad;
  featured: LabFeaturedLoad;
}): LabWorkspace {
  const analyzed = input.scan.ok ? input.scan.analyzed : [];
  return {
    generatedAt: new Date().toISOString(),
    models: LAB_MODELS,
    versions: LAB_MODELS,
    scan: {
      ok: input.scan.ok,
      generatedAt: input.scan.ok ? input.scan.generatedAt : null,
      analyzed,
    },
    comparison: buildComparison({
      analyzed,
      report: input.research.report,
      featured: input.featured,
    }),
    backtest: simulateUnitMarks(input.research.cases),
    report: input.research.report,
    knowledge: input.research.knowledge,
    cases: input.research.cases,
    book: input.book.data,
    fixtures: input.book.fixtures,
    featured: {
      label: input.featured.label,
      href: input.featured.href,
      decision: input.featured.decision,
      rating: input.featured.rating,
      explainable: input.featured.explainable,
      probability: input.featured.probability,
    },
    features: buildFeatureSeries({
      components: input.featured.decision?.score.components ?? null,
      cases: input.research.cases,
    }),
    decision: buildDecisionView(input.featured),
  };
}

export function opportunityHref(fixtureId: string): string {
  return opportunityAnalysisHref(fixtureId);
}

export { VERDICT_META };
