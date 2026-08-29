/**
 * APEX Scoring Engine v2 — evaluate().
 * Future models implement ScoringEnginePort with the same ApexScoring output.
 */

import { scoringInputFromEngines } from "@/lib/scoring-engine/builders";
import { explainScoring } from "@/lib/scoring-engine/explain";
import { coverageBlend, roundScore } from "@/lib/scoring-engine/normalizers";
import { recommendScoring } from "@/lib/scoring-engine/recommend";
import type { ApexDecision, ApexDecisionInput } from "@/lib/decision-engine/types";
import type { TeamIntelligence } from "@/lib/team-intelligence/models";
import {
  scoreConfidence,
  scoreDataQuality,
  scoreExpectedValue,
  scoreMarketValue,
  scoreMomentum,
  scoreProbability,
  scoreRisk,
  scoreTactical,
  scoreTeamIntelligence,
} from "@/lib/scoring-engine/scores";
import type {
  ApexScoring,
  ScoringEngineInput,
} from "@/lib/scoring-engine/types";

export type ScoringEnginePort = {
  readonly id: "scoring-v2";
  evaluate(input: ScoringEngineInput): ApexScoring;
};

export function scoringComponents(input: ScoringEngineInput) {
  return [
    scoreProbability(input),
    scoreExpectedValue(input),
    scoreMarketValue(input),
    scoreTeamIntelligence(input),
    scoreMomentum(input),
    scoreTactical(input),
    scoreConfidence(input),
    scoreRisk(input),
    scoreDataQuality(input),
  ];
}

export function evaluateScoring(input: ScoringEngineInput): ApexScoring {
  const components = scoringComponents(input);
  const blend = coverageBlend(components);
  const overall = roundScore(blend.score);
  const coverage = Math.round(blend.coverage * 1000) / 1000;
  const recommendation = recommendScoring({ overall, input, components });
  const explanation = explainScoring({
    input,
    overall,
    coverage,
    components,
    recommendation: recommendation.tier,
  });

  return {
    engineId: "scoring-v2",
    selectionId: input.selectionId,
    selectionLabel: input.selectionLabel,
    overall,
    coverage,
    components,
    recommendation,
    explanation,
  };
}

export function createScoringEngine(): ScoringEnginePort {
  return {
    id: "scoring-v2",
    evaluate: evaluateScoring,
  };
}

/** Single platform entry: Decision Engine + Team Intelligence → Scoring Engine v2. */
export function evaluateScoringFromEngines(args: {
  selectionId: string;
  selectionLabel: string;
  decision?: ApexDecision;
  decisionInput?: ApexDecisionInput;
  team?: TeamIntelligence;
}): ApexScoring {
  return evaluateScoring(scoringInputFromEngines(args));
}
