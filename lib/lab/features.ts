/**
 * Published weights and observed factor mass.
 * This is not SHAP. Missing signals stay unavailable.
 */

import {
  DECISION_COMPONENT_LABELS,
  DECISION_INJURY_WEIGHT,
  DECISION_POSITIVE_WEIGHTS,
  DECISION_RISK_WEIGHT,
} from "@/lib/decision-engine/weights";
import type {
  ApexScoreComponent,
  ApexScoreComponentKey,
} from "@/lib/decision-engine/types";
import {
  APEX_RATING_METRIC_LABELS,
  APEX_RATING_WEIGHTS,
} from "@/lib/match-rating/metrics";
import type { LearningCase } from "@/lib/learning-engine/types/case";
import type { LabBar, LabFeatureSeries } from "@/lib/lab/types";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function decisionWeightBars(): LabBar[] {
  const positives = (
    Object.entries(DECISION_POSITIVE_WEIGHTS) as Array<
      [Exclude<ApexScoreComponentKey, "injuries" | "riskAdjustment">, number]
    >
  ).map(([key, weight]) => ({
    key,
    label: DECISION_COMPONENT_LABELS[key],
    weight,
    valueLabel: pct(weight),
    available: true,
  }));
  return [
    ...positives,
    {
      key: "injuries",
      label: DECISION_COMPONENT_LABELS.injuries,
      weight: DECISION_INJURY_WEIGHT,
      valueLabel: `−${pct(DECISION_INJURY_WEIGHT)}`,
      available: true,
      tone: "warning",
    },
    {
      key: "riskAdjustment",
      label: DECISION_COMPONENT_LABELS.riskAdjustment,
      weight: DECISION_RISK_WEIGHT,
      valueLabel: `−${pct(DECISION_RISK_WEIGHT)}`,
      available: true,
      tone: "danger",
    },
  ];
}

export function ratingWeightBars(): LabBar[] {
  return (Object.keys(APEX_RATING_WEIGHTS) as Array<keyof typeof APEX_RATING_WEIGHTS>).map(
    (key) => ({
      key,
      label: APEX_RATING_METRIC_LABELS[key],
      weight: APEX_RATING_WEIGHTS[key],
      valueLabel: pct(APEX_RATING_WEIGHTS[key]),
      available: true,
    }),
  );
}

export function liveComponentBars(components: ApexScoreComponent[]): LabBar[] {
  return components.map((component) => ({
    key: component.key,
    label: component.label,
    weight: (component.score ?? 0) / 100,
    valueLabel: component.available ? String(Math.round(component.score ?? 0)) : "n/d",
    available: component.available,
    tone: component.available ? undefined : "neutral",
  }));
}

export function learningFactorBars(cases: LearningCase[]): LabBar[] {
  const mass = new Map<string, { label: string; weight: number; n: number }>();
  for (const row of cases) {
    for (const factor of row.prediction.factors) {
      const current = mass.get(factor.key) ?? {
        label: factor.label,
        weight: 0,
        n: 0,
      };
      current.weight += Math.abs(factor.weight);
      current.n += 1;
      mass.set(factor.key, current);
    }
  }
  const bars = [...mass.entries()].map(([key, value]) => ({
    key,
    label: value.label,
    weight: value.n === 0 ? 0 : value.weight / value.n,
    valueLabel: (value.n === 0 ? 0 : value.weight / value.n).toFixed(2),
    available: true,
  }));
  const max = Math.max(0, ...bars.map((bar) => bar.weight));
  if (max <= 0) return bars;
  return bars
    .map((bar) => ({ ...bar, weight: bar.weight / max }))
    .sort((a, b) => b.weight - a.weight);
}

export function buildFeatureSeries(input: {
  components: ApexScoreComponent[] | null;
  cases: LearningCase[];
}): LabFeatureSeries[] {
  const series: LabFeatureSeries[] = [
    {
      id: "decision-weights",
      title: "Decision Engine weights",
      description:
        "Published APEX Score pillars. Injuries and risk are downward adjustments, never invented.",
      bars: decisionWeightBars(),
    },
    {
      id: "rating-weights",
      title: "Match Rating weights",
      description: "Legacy 10-metric board. Coverage drops unavailable signals.",
      bars: ratingWeightBars(),
    },
    {
      id: "learning-factors",
      title: "Closed-book factor mass",
      description:
        "Mean |weight| of Learning Engine explanatory factors. Sample is the mock closed book.",
      bars: learningFactorBars(input.cases),
    },
  ];
  if (input.components && input.components.length > 0) {
    series.unshift({
      id: "live-components",
      title: "Featured match components",
      description:
        "Live 0–100 pillar scores on the featured fixture. n/d means the catalogue was silent.",
      bars: liveComponentBars(input.components),
    });
  }
  return series;
}
