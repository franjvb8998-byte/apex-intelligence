/**
 * GOALS-1G.1 — Temporal stability classification (rules frozen before 2024).
 */

import type { MarketCalibrationMetrics } from "@/lib/debug/calibration/goals/market-calibration/metrics";
import type { MarketSupport } from "@/lib/debug/calibration/goals/market-calibration/metrics";
import {
  GOALS_MCAL_CITL_GOOD,
  GOALS_MCAL_CITL_MATERIAL,
  GOALS_MCAL_CITL_UNSTABLE,
  GOALS_MCAL_LOW_SUPPORT_MIN_CLASS,
} from "@/lib/debug/calibration/goals/market-calibration/protocol";

export type TemporalStabilityClass =
  | "STABLE_GOOD"
  | "STABLE_BIASED"
  | "UNSTABLE"
  | "LOW_SUPPORT"
  | "INCONCLUSIVE";

export function classifyTemporalStability(
  support23: MarketSupport,
  support24: MarketSupport,
  m23: MarketCalibrationMetrics,
  m24: MarketCalibrationMetrics,
): { classification: TemporalStabilityClass; rationale: string } {
  const minClass23 = Math.min(support23.positives, support23.negatives);
  const minClass24 = Math.min(support24.positives, support24.negatives);
  if (
    support23.rareEvent ||
    support24.rareEvent ||
    minClass23 < GOALS_MCAL_LOW_SUPPORT_MIN_CLASS ||
    minClass24 < GOALS_MCAL_LOW_SUPPORT_MIN_CLASS
  ) {
    return {
      classification: "LOW_SUPPORT",
      rationale:
        "Rare-event rate or minority class below frozen support threshold in at least one season.",
    };
  }

  const c23 = m23.calibrationInTheLarge;
  const c24 = m24.calibrationInTheLarge;
  const abs23 = Math.abs(c23);
  const abs24 = Math.abs(c24);

  if (
    abs23 >= GOALS_MCAL_CITL_UNSTABLE &&
    abs24 >= GOALS_MCAL_CITL_UNSTABLE &&
    c23 * c24 < 0
  ) {
    return {
      classification: "UNSTABLE",
      rationale:
        "Calibration-in-the-large has opposite signs across seasons with material magnitude.",
    };
  }

  if (
    abs23 >= GOALS_MCAL_CITL_MATERIAL &&
    abs24 >= GOALS_MCAL_CITL_MATERIAL &&
    c23 * c24 > 0
  ) {
    return {
      classification: "STABLE_BIASED",
      rationale:
        "Same-sign material calibration-in-the-large replicates across 2023 and 2024.",
    };
  }

  if (abs23 < GOALS_MCAL_CITL_GOOD && abs24 < GOALS_MCAL_CITL_GOOD) {
    return {
      classification: "STABLE_GOOD",
      rationale:
        "Calibration-in-the-large within frozen good band in both seasons.",
    };
  }

  return {
    classification: "INCONCLUSIVE",
    rationale:
      "Calibration pattern does not meet frozen STABLE_GOOD / STABLE_BIASED / UNSTABLE / LOW_SUPPORT rules.",
  };
}
