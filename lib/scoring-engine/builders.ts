/**
 * Adapters into ScoringEngineInput. No HTTP. Does not re-run Probability or Decision Engine.
 */

import type { ApexDecision, ApexDecisionInput } from "@/lib/decision-engine/types";
import type { TeamIntelligence } from "@/lib/team-intelligence/models";
import type { ScoringEngineInput } from "@/lib/scoring-engine/types";

export function emptyScoringInput(
  over: Partial<ScoringEngineInput> &
    Pick<ScoringEngineInput, "selectionId" | "selectionLabel">,
): ScoringEngineInput {
  return {
    predicted: null,
    modelProbability: null,
    oneXTwo: null,
    decimalOdds: null,
    bookmakerCount: 0,
    expectedValue: null,
    marketEdge: null,
    teamIntelligenceScore: null,
    teamIntelligenceCoverage: null,
    momentumScore: null,
    tacticalScore: null,
    confidence: null,
    risk: null,
    coverage: null,
    formSample: null,
    injuriesPublished: false,
    ...over,
  };
}

/**
 * Compose published Decision Engine + Team Intelligence outputs.
 * Scoring Engine v2 does not change those engines' internals.
 */
export function scoringInputFromEngines(args: {
  selectionId: string;
  selectionLabel: string;
  decision?: ApexDecision;
  decisionInput?: ApexDecisionInput;
  team?: TeamIntelligence;
}): ScoringEngineInput {
  const { decision, decisionInput, team } = args;
  const predicted = decision?.predicted ?? decisionInput?.predicted ?? null;
  const modelProbability =
    decision?.value.modelProbability ??
    (predicted && decisionInput ? decisionInput.oneXTwo[predicted] : null);

  const side =
    decisionInput == null
      ? null
      : predicted === "away"
        ? decisionInput.away
        : decisionInput.home;

  return emptyScoringInput({
    selectionId: args.selectionId,
    selectionLabel: args.selectionLabel,
    predicted,
    modelProbability: modelProbability ?? null,
    oneXTwo: decisionInput?.oneXTwo ?? null,
    decimalOdds: decisionInput?.decimalOdds ?? decision?.value.impliedOdds ?? null,
    bookmakerCount: decisionInput?.bookmakerCount ?? 0,
    expectedValue: decision?.value.expectedValue ?? null,
    marketEdge: decision?.value.marketEdge ?? null,
    teamIntelligenceScore: team?.scores.overall ?? null,
    teamIntelligenceCoverage: team?.scores.coverage ?? null,
    momentumScore: team?.scores.momentum.value ?? null,
    tacticalScore: team?.scores.tacticalIdentity.value ?? null,
    confidence: decision?.confidence.value ?? null,
    risk: decision?.risk.score ?? null,
    coverage: decision?.score.coverage ?? team?.scores.coverage ?? null,
    formSample: side
      ? Math.max(side.formLetters.length, side.played ?? 0)
      : null,
    injuriesPublished: side != null,
  });
}
