import { threeWayEntropy } from "@/lib/decision-engine/math";
import { clamp, component } from "@/lib/scoring-engine/normalizers";
import type { ScoringComponent, ScoringEngineInput } from "@/lib/scoring-engine/types";

/**
 * Reliability of the reading — not 1X2 probability.
 * Uses Decision Engine confidence when published; otherwise coverage + sample + entropy.
 */
export function scoreConfidence(input: ScoringEngineInput): ScoringComponent {
  if (input.confidence != null && Number.isFinite(input.confidence)) {
    return component(
      "confidence",
      clamp(input.confidence, 0, 100),
      "Confidence published by the Decision Engine (reliability, not 1X2).",
    );
  }

  const coverage = input.coverage;
  const sample = input.formSample;
  if (coverage == null && (sample == null || sample <= 0) && input.oneXTwo == null) {
    return component(
      "confidence",
      null,
      "No confidence, coverage, form sample, or 1X2 board to score reliability.",
    );
  }

  let value = 36;
  if (sample != null && sample > 0) value += (Math.min(sample, 10) / 10) * 22;
  if (coverage != null) value += clamp(coverage, 0, 1) * 22;
  if (input.oneXTwo) value -= threeWayEntropy(input.oneXTwo) * 16;
  if (input.risk != null && input.risk >= 65) value -= 10;

  return component(
    "confidence",
    clamp(value, 8, 92),
    "Fallback reliability from coverage, form sample and 1X2 entropy.",
  );
}
