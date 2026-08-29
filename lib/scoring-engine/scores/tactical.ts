import { clamp, component } from "@/lib/scoring-engine/normalizers";
import type { ScoringComponent, ScoringEngineInput } from "@/lib/scoring-engine/types";

export function scoreTactical(input: ScoringEngineInput): ScoringComponent {
  const value = input.tacticalScore;
  if (value == null || !Number.isFinite(value)) {
    return component(
      "tactical",
      null,
      "No published tactical identity from Team Intelligence.",
    );
  }
  return component(
    "tactical",
    clamp(value, 0, 100),
    "Tactical identity from the published Team Intelligence pillar.",
  );
}
