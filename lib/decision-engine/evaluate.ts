/**
 * APEX Decision Engine v1 — deterministic evaluate().
 * Future ML models implement DecisionEnginePort with the same ApexDecision output.
 */

import {
  buildPositiveComponents,
  scoreInjuries,
} from "@/lib/decision-engine/components";
import { evaluateConfidence } from "@/lib/decision-engine/confidence";
import { explainDecision } from "@/lib/decision-engine/narrative";
import { clamp, roundScore } from "@/lib/decision-engine/math";
import { reasonsNotToBet, reasonsToBet } from "@/lib/decision-engine/reasons";
import { evaluateRisk } from "@/lib/decision-engine/risk";
import { evaluateSizing } from "@/lib/decision-engine/sizing";
import type {
  ApexDecision,
  ApexDecisionInput,
  ApexScoreComponent,
  DecisionEnginePort,
} from "@/lib/decision-engine/types";
import { evaluateValue } from "@/lib/decision-engine/value";
import { decideVerdict } from "@/lib/decision-engine/verdict";
import {
  DECISION_COMPONENT_LABELS,
  DECISION_POSITIVE_WEIGHTS,
  DECISION_RISK_WEIGHT,
} from "@/lib/decision-engine/weights";

function blendPositive(components: ApexScoreComponent[]): {
  score: number;
  coverage: number;
} {
  const keys = Object.keys(DECISION_POSITIVE_WEIGHTS) as Array<
    keyof typeof DECISION_POSITIVE_WEIGHTS
  >;
  const total = keys.reduce((sum, key) => sum + DECISION_POSITIVE_WEIGHTS[key], 0);
  const available = components.filter(
    (row) => row.available && row.score != null && row.weight > 0,
  );
  const used = available.reduce((sum, row) => sum + row.weight, 0);
  const blended =
    used > 0
      ? available.reduce((sum, row) => sum + (row.score ?? 0) * row.weight, 0) / used
      : 0;
  return { score: blended, coverage: total > 0 ? used / total : 0 };
}

export function evaluateDecision(input: ApexDecisionInput): ApexDecision {
  const value = evaluateValue(input);
  const risk = evaluateRisk(input);
  const positives = buildPositiveComponents(input, value);
  const injuries = scoreInjuries(input);
  const { score: blended, coverage } = blendPositive(positives);
  const injuryPenalty = ((injuries.score ?? 0) / 100) * 8;
  const riskPenalty = (risk.score / 100) * (DECISION_RISK_WEIGHT * 100);
  const apex = roundScore(clamp(blended - injuryPenalty - riskPenalty, 0, 100));

  const riskComponent: ApexScoreComponent = {
    key: "riskAdjustment",
    label: DECISION_COMPONENT_LABELS.riskAdjustment,
    weight: -DECISION_RISK_WEIGHT,
    score: risk.score,
    available: true,
    note: `Risk Engine ${risk.band} (${risk.score}/100) subtracts up to 7 points.`,
  };

  const components = [...positives, injuries, riskComponent];
  const confidence = evaluateConfidence({
    data: input,
    coverage,
    risk,
    value,
  });
  const verdict = decideVerdict({
    score: apex,
    confidence,
    risk,
    value,
  });
  const sizing = evaluateSizing({
    modelProbability: value.modelProbability,
    decimalOdds: input.decimalOdds,
    verdict: verdict.kind,
    expectedValue: value.expectedValue,
  });
  const reasonsFor = reasonsToBet({ data: input, components: positives, value });
  const reasonsAgainst = reasonsNotToBet({
    data: input,
    risk,
    value,
    coverage,
  });
  const explanation = explainDecision({
    data: input,
    score: apex,
    confidence,
    risk,
    value,
    verdict,
    reasonsFor,
  });

  return {
    engineId: "deterministic-v1",
    predicted: input.predicted,
    selectionLabel: input.predictedLabel,
    score: {
      value: apex,
      label: `${verdict.label} · ${input.predictedLabel}`,
      coverage,
      components,
    },
    confidence,
    risk,
    value,
    sizing,
    verdict,
    reasonsFor,
    reasonsAgainst,
    explanation,
  };
}

export function createDeterministicDecisionEngine(): DecisionEnginePort {
  return {
    id: "deterministic-v1",
    evaluate: evaluateDecision,
  };
}
