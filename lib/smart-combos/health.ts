/**
 * Combo health (0–100) and risk/confidence bands.
 * Uses Decision Engine leg scores — does not invent a second 1X2 model.
 */

import { clamp, roundScore } from "@/lib/decision-engine/math";
import type {
  ApexConfidenceBand,
  ApexRiskBand,
} from "@/lib/decision-engine/types";
import type { ComboCorrelationReport, ComboLeg } from "@/lib/smart-combos/types";

export function comboConfidenceValue(
  legs: ComboLeg[],
  correlation: ComboCorrelationReport,
): number {
  if (legs.length === 0 || correlation.hasConflict || correlation.hasDuplicate) {
    return 0;
  }
  const product = legs.reduce((acc, leg) => acc * (leg.confidence / 100), 1);
  const geo = Math.pow(product, 1 / legs.length) * 100;
  return roundScore(geo * (1 - correlation.penalty * 0.35) - Math.max(0, legs.length - 2) * 4);
}

export function comboConfidenceBand(value: number): ApexConfidenceBand {
  if (value >= 70) return "high";
  if (value >= 45) return "medium";
  return "low";
}

export function comboRisk(
  legs: ComboLeg[],
  correlation: ComboCorrelationReport,
): { score: number; band: ApexRiskBand } {
  if (legs.length === 0 || correlation.hasConflict || correlation.hasDuplicate) {
    return { score: 100, band: "high" };
  }
  const mean = legs.reduce((sum, leg) => sum + leg.riskScore, 0) / legs.length;
  const max = Math.max(...legs.map((leg) => leg.riskScore));
  let score = mean * 0.55 + max * 0.45;
  score += correlation.penalty * 28;
  score += Math.max(0, legs.length - 2) * 6;
  if (legs.some((leg) => leg.riskBand === "high")) score += 12;
  const clamped = roundScore(score);
  const band: ApexRiskBand =
    clamped >= 62 || correlation.maxRho >= 0.4 ? "high" : clamped >= 38 ? "medium" : "low";
  return { score: clamped, band };
}

export function comboHealthScore(input: {
  legs: ComboLeg[];
  correlation: ComboCorrelationReport;
  expectedValue: number | null;
  confidence: number;
  independentProbability: number | null;
}): number {
  const { legs, correlation, expectedValue, confidence, independentProbability } = input;
  if (legs.length === 0) return 0;
  if (correlation.hasConflict || correlation.hasDuplicate) return 0;

  const scores = legs.map((leg) => leg.score);
  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const evComponent =
    expectedValue == null
      ? 42
      : clamp(((expectedValue + 0.25) / 0.5) * 100, 0, 100);
  const pComponent =
    independentProbability == null
      ? 30
      : clamp(independentProbability * 220, 8, 100);

  let health =
    meanScore * 0.28 +
    minScore * 0.22 +
    confidence * 0.18 +
    evComponent * 0.18 +
    pComponent * 0.14;

  health -= correlation.penalty * 22;
  const weakestP = Math.min(...legs.map((leg) => leg.apexProbability ?? 0));
  if (weakestP < 0.42) health -= (0.42 - weakestP) * 40;
  if (legs.length >= 5) health -= 8;

  return roundScore(health);
}
