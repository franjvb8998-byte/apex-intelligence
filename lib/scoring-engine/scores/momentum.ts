import { clamp, component } from "@/lib/scoring-engine/normalizers";
import type { ScoringComponent, ScoringEngineInput } from "@/lib/scoring-engine/types";

export function scoreMomentum(input: ScoringEngineInput): ScoringComponent {
  const value = input.momentumScore;
  if (value == null || !Number.isFinite(value)) {
    return component(
      "momentum",
      null,
      "No published momentum (Team Intelligence last-5 quality).",
    );
  }
  return component(
    "momentum",
    clamp(value, 0, 100),
    "Momentum from the published Team Intelligence pillar.",
  );
}
