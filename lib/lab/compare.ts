import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ApexDecision } from "@/lib/decision-engine/types";
import type { ExplainablePrediction } from "@/lib/explainable-ai/types";
import type { EvaluationReport } from "@/lib/learning-engine/types/evaluation";
import type { ApexMatchRating } from "@/lib/match-rating/types";
import type { LabEngineCompareRow } from "@/lib/lab/types";
import { modelById } from "@/lib/lab/registry";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function finite(values: Array<number | null | undefined>): number[] {
  return values.filter((n): n is number => n != null && Number.isFinite(n));
}

function fmt(value: number | null, digits = 1, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

export function compareDecisionScan(
  analyzed: ApexOpportunity[],
): LabEngineCompareRow {
  const model = modelById("decision-engine");
  const avgScore = mean(analyzed.map((row) => row.score));
  const avgEv = mean(finite(analyzed.map((row) => row.expectedValue)));
  return {
    id: model.id,
    name: model.name,
    version: model.version,
    sample: analyzed.length === 0 ? "Scan offline" : `${analyzed.length} fixtures this scan`,
    paired: false,
    primaryLabel: "Avg score",
    primary: avgScore == null ? "—" : String(Math.round(avgScore)),
    secondaryLabel: "Avg EV",
    secondary: fmt(avgEv == null ? null : avgEv * 100, 1, "%"),
    href: "/opportunities",
    tone: analyzed.length === 0 ? "warning" : "accent",
  };
}

export function compareLearningReport(
  report: EvaluationReport,
): LabEngineCompareRow {
  const model = modelById("probability-engine");
  return {
    id: model.id,
    name: model.name,
    version: report.modelVersion || model.version,
    sample: `${report.sampleSize} closed-book cases`,
    paired: false,
    primaryLabel: "1X2 accuracy",
    primary: fmt(report.accuracy.outcome * 100, 0, "%"),
    secondaryLabel: "ECE",
    secondary: fmt(report.calibration.ece, 3),
    href: "/lab#backtest",
    tone: report.accuracy.outcome >= 0.5 ? "accent" : "warning",
  };
}

export function compareFeaturedMatch(input: {
  label: string | null;
  href: string;
  decision: ApexDecision | null;
  rating: ApexMatchRating | null;
  explainable: ExplainablePrediction | null;
  probability: {
    modelVersion: string;
    home: number;
    draw: number;
    away: number;
  } | null;
}): LabEngineCompareRow[] {
  const sample = input.label
    ? `Paired · ${input.label}`
    : "Featured match unavailable";
  const rows: LabEngineCompareRow[] = [];

  if (input.decision) {
    const model = modelById("decision-engine");
    rows.push({
      id: "paired-decision",
      name: model.name,
      version: input.decision.engineId,
      sample,
      paired: true,
      primaryLabel: "Verdict",
      primary: input.decision.verdict.label,
      secondaryLabel: "Score",
      secondary: String(Math.round(input.decision.score.value)),
      href: input.href,
      tone: input.decision.verdict.kind === "avoid" ? "danger" : "accent",
    });
  }

  if (input.probability) {
    const model = modelById("probability-engine");
    const top = Math.max(
      input.probability.home,
      input.probability.draw,
      input.probability.away,
    );
    rows.push({
      id: "paired-probability",
      name: model.name,
      version: input.probability.modelVersion,
      sample,
      paired: true,
      primaryLabel: "Top 1X2",
      primary: fmt(top * 100, 1, "%"),
      secondaryLabel: "H / D / A",
      secondary: `${fmt(input.probability.home * 100, 0)}/${fmt(input.probability.draw * 100, 0)}/${fmt(input.probability.away * 100, 0)}`,
      href: input.href,
      tone: "info",
    });
  }

  if (input.rating) {
    const model = modelById("match-rating");
    rows.push({
      id: "paired-rating",
      name: model.name,
      version: model.version,
      sample,
      paired: true,
      primaryLabel: "Rating",
      primary: String(Math.round(input.rating.overall)),
      secondaryLabel: "Action",
      secondary: input.rating.recommendationLabel,
      href: input.href,
      tone: "neutral",
    });
  }

  if (input.explainable) {
    const model = modelById("explainable-ai");
    rows.push({
      id: "paired-xai",
      name: model.name,
      version: model.version,
      sample,
      paired: true,
      primaryLabel: "Quality",
      primary: String(Math.round(input.explainable.qualityScore.value)),
      secondaryLabel: "Band",
      secondary: input.explainable.qualityScore.band,
      href: input.href,
      tone: "info",
    });
  }

  return rows;
}

export function buildComparison(input: {
  analyzed: ApexOpportunity[];
  report: EvaluationReport;
  featured: {
    label: string | null;
    href: string;
    decision: ApexDecision | null;
    rating: ApexMatchRating | null;
    explainable: ExplainablePrediction | null;
    probability: {
      modelVersion: string;
      home: number;
      draw: number;
      away: number;
    } | null;
  };
}): LabEngineCompareRow[] {
  return [
    ...compareFeaturedMatch(input.featured),
    compareDecisionScan(input.analyzed),
    compareLearningReport(input.report),
  ];
}
