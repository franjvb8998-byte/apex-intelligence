/**
 * Confidence is reliability of the reading — not the 1X2 probability.
 */

import { clamp, formVariance, roundScore, threeWayEntropy } from "@/lib/decision-engine/math";
import type {
  ApexConfidenceBlock,
  ApexDecisionInput,
  ApexRiskBlock,
  ApexValueBlock,
} from "@/lib/decision-engine/types";

function pick(input: ApexDecisionInput) {
  return input.predicted === "away" ? input.away : input.home;
}

export function evaluateConfidence(input: {
  data: ApexDecisionInput;
  coverage: number;
  risk: ApexRiskBlock;
  value: ApexValueBlock;
}): ApexConfidenceBlock {
  const { data, coverage, risk, value } = input;
  const side = pick(data);
  const sample = Math.min(side.played ?? side.formLetters.length, 10);
  let score = 38;
  score += (sample / 10) * 18;
  score += coverage * 16;

  const variance = formVariance(side.formLetters);
  if (variance != null && variance <= 0.18 && side.formLetters.length >= 4) {
    score += 10;
  } else if (variance != null && variance >= 0.28) {
    score -= 8;
  }

  if (side.injuryCount === 0 && (side.played != null || side.formLetters.length >= 3)) {
    // Empty injury list is not a clean XI — only a small bump when other sample exists.
    score += 3;
  }
  if (side.injuryCount >= 1) score -= clamp(side.injuryCount * 7, 0, 18);

  if (value.positiveEdge) score += 8;
  if (value.negativeEdge) score -= 6;

  score -= threeWayEntropy(data.oneXTwo) * 18;
  if (risk.band === "high") score -= 12;
  if (risk.band === "medium") score -= 5;
  if (side.matchesLast7 >= 2) score -= 6;

  const valueClamped = roundScore(score);
  const band: ApexConfidenceBlock["band"] =
    valueClamped >= 70 ? "high" : valueClamped >= 45 ? "medium" : "low";
  const caption =
    band === "high"
      ? "High confidence"
      : band === "medium"
        ? "Medium confidence"
        : "Low confidence";

  return { value: valueClamped, band, caption };
}
