import { clamp, component } from "@/lib/scoring-engine/normalizers";
import type { ScoringComponent, ScoringEngineInput } from "@/lib/scoring-engine/types";

/** Pass-through of the Team Intelligence overall. Never re-scores the twin. */
export function scoreTeamIntelligence(input: ScoringEngineInput): ScoringComponent {
  const value = input.teamIntelligenceScore;
  if (value == null || !Number.isFinite(value)) {
    return component(
      "teamIntelligence",
      null,
      "No Team Intelligence twin on this selection.",
    );
  }
  return component(
    "teamIntelligence",
    clamp(value, 0, 100),
    "Club twin overall from Team Intelligence Engine.",
  );
}
