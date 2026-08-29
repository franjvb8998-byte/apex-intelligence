/**
 * Combo Analyzer — prices a slip from Decision Engine legs.
 */

import { analyzeCorrelation } from "@/lib/smart-combos/correlation";
import { explainCombo } from "@/lib/smart-combos/explain";
import {
  comboConfidenceBand,
  comboConfidenceValue,
  comboHealthScore,
  comboRisk,
} from "@/lib/smart-combos/health";
import {
  combinedDecimalOdds,
  comboExpectedValue,
  comboImpliedProbability,
  independentApexProbability,
  weakestLeg,
} from "@/lib/smart-combos/pricing";
import type { ComboAnalysis, ComboLeg } from "@/lib/smart-combos/types";
import { sizeCombo } from "@/lib/smart-combos/verdict";
import {
  emptyScoringInput,
  evaluateScoring,
  verdictKindFromTier,
} from "@/lib/scoring-engine";
import { captureComboRecommendation } from "@/lib/intelligence-learning/capture";

export function analyzeCombo(legs: ComboLeg[]): ComboAnalysis {
  const correlation = analyzeCorrelation(legs);
  const combinedOdds = combinedDecimalOdds(legs);
  const independent = independentApexProbability(legs);
  const implied = comboImpliedProbability(legs);
  const blockedReason = correlation.hasConflict
    ? "Mutually exclusive 1X2 outcomes cannot form a combo."
    : correlation.hasDuplicate
      ? "Duplicate selections cannot form a combo."
      : legs.length > 0 && independent == null
        ? "Every leg needs a Decision Engine probability and a published price."
        : null;

  const adjusted =
    blockedReason || independent == null
      ? correlation.hasConflict
        ? 0
        : null
      : independent * (1 - correlation.penalty);

  const expectedValue = comboExpectedValue(
    correlation.hasConflict ? 0 : adjusted,
    combinedOdds,
  );
  const confidence = comboConfidenceValue(legs, correlation);
  const risk = comboRisk(legs, correlation);
  const healthScore = comboHealthScore({
    legs,
    correlation,
    expectedValue,
    confidence,
    independentProbability: independent,
  });
  const scored = evaluateScoring(
    emptyScoringInput({
      selectionId:
        [...legs.map((leg) => leg.fixtureId)].sort().join("+") || "combo",
      selectionLabel: "Smart Combo",
      modelProbability: correlation.hasConflict ? 0 : adjusted,
      decimalOdds: combinedOdds,
      expectedValue,
      confidence,
      risk: risk.score,
      coverage: legs.length === 0 ? 0 : 1,
      bookmakerCount: legs.filter((leg) => leg.decimalOdds != null).length,
    }),
  );
  const tier = blockedReason ? "Avoid" : scored.recommendation.tier;
  const verdict = {
    kind: blockedReason ? ("avoid" as const) : verdictKindFromTier(tier),
    label: tier,
    stars: blockedReason ? 1 : scored.recommendation.stars,
  };
  const sizing = sizeCombo({
    apexProbability: correlation.hasConflict ? 0 : adjusted,
    combinedOdds,
    expectedValue,
    verdict: verdict.kind,
  });

  const draft: Omit<ComboAnalysis, "explanation"> = {
    legs,
    combinedOdds,
    impliedProbability: implied,
    independentApexProbability: independent,
    adjustedApexProbability: adjusted,
    expectedValue,
    confidence,
    confidenceBand: comboConfidenceBand(confidence),
    riskBand: risk.band,
    riskScore: risk.score,
    healthScore: blockedReason ? 0 : healthScore,
    weakest: weakestLeg(legs),
    correlation,
    verdict,
    sizing,
    blockedReason,
  };

  const analysis = { ...draft, explanation: explainCombo(draft) };
  captureComboRecommendation(analysis, scored);
  return analysis;
}
