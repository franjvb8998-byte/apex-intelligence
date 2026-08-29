/**
 * Combo verdict and stake — Decision Engine functions on combo-level blocks.
 * Does not re-run Probability Engine or change DE weights.
 */

import { decideVerdict } from "@/lib/decision-engine/verdict";
import { evaluateSizing } from "@/lib/decision-engine/sizing";
import { impliedProbability } from "@/lib/match-rating/pricing";
import { fairOdds } from "@/lib/match-rating/pricing";
import type {
  ApexConfidenceBlock,
  ApexRiskBlock,
  ApexValueBlock,
} from "@/lib/decision-engine/types";
import type { ComboAnalysis } from "@/lib/smart-combos/types";
import { comboConfidenceBand } from "@/lib/smart-combos/health";

export function comboValueBlock(input: {
  apexProbability: number | null;
  combinedOdds: number | null;
  expectedValue: number | null;
}): ApexValueBlock {
  const modelProbability = input.apexProbability ?? 0;
  const marketProbability = impliedProbability(input.combinedOdds);
  const marketEdge =
    marketProbability != null && input.apexProbability != null
      ? input.apexProbability - marketProbability
      : null;
  return {
    modelProbability,
    marketProbability,
    valuePct: marketEdge,
    expectedValue: input.expectedValue,
    fairOdds: fairOdds(input.apexProbability),
    impliedOdds: input.combinedOdds,
    marketEdge,
    positiveEdge: (input.expectedValue ?? 0) > 0.005,
    negativeEdge: input.expectedValue != null && input.expectedValue < -0.005,
  };
}

export function decideComboVerdict(input: {
  healthScore: number;
  confidence: number;
  risk: { score: number; band: ApexRiskBlock["band"] };
  value: ApexValueBlock;
}): ComboAnalysis["verdict"] {
  const confidence: ApexConfidenceBlock = {
    value: input.confidence,
    band: comboConfidenceBand(input.confidence),
    caption:
      input.confidence >= 70
        ? "High confidence"
        : input.confidence >= 45
          ? "Medium confidence"
          : "Low confidence",
  };
  const risk: ApexRiskBlock = {
    score: input.risk.score,
    band: input.risk.band,
    reasons: [],
  };
  return decideVerdict({
    score: input.healthScore,
    confidence,
    risk,
    value: input.value,
  });
}

export function sizeCombo(input: {
  apexProbability: number | null;
  combinedOdds: number | null;
  expectedValue: number | null;
  verdict: ComboAnalysis["verdict"]["kind"];
}) {
  return evaluateSizing({
    modelProbability: input.apexProbability ?? 0,
    decimalOdds: input.combinedOdds,
    verdict: input.verdict,
    expectedValue: input.expectedValue,
  });
}
