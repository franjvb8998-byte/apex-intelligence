/**
 * PE entropy → ConfidenceScore (0–1).
 * Single source for Match Center, Match Analysis rules, and Explainable AI.
 * Decision Engine confidence (0–100 reliability) is a different metric.
 */

import { normalizedEntropy } from "@/lib/intelligence/modules/probability/math/normalize";
import type { ConfidenceScore } from "@/lib/intelligence/types";
import type { HybridProbabilityResult } from "@/lib/intelligence/modules/probability/hybrid/types";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function confidenceFromHybrid(
  result: HybridProbabilityResult,
): ConfidenceScore {
  const entropy = normalizedEntropy(result.oneXTwo);
  const value = clamp01(1 - entropy);
  const band: ConfidenceScore["band"] =
    value >= 0.75 ? "high" : value >= 0.45 ? "medium" : "low";
  return { value, band };
}
