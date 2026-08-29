import { component } from "@/lib/scoring-engine/normalizers";
import type { ScoringComponent, ScoringEngineInput } from "@/lib/scoring-engine/types";

/** Selection Probability Engine mass mapped onto 0–100. */
export function scoreProbability(input: ScoringEngineInput): ScoringComponent {
  const p = input.modelProbability;
  if (p == null || !Number.isFinite(p) || p < 0 || p > 1) {
    return component(
      "probability",
      null,
      "No Probability Engine mass on this selection.",
    );
  }
  return component(
    "probability",
    p * 100,
    `Model probability ${(p * 100).toFixed(0)}% on ${input.selectionLabel}.`,
  );
}
