/**
 * Presentation mapping only — does not re-score the Decision Engine.
 */

import type { ApexDecisionVerdictKind } from "@/lib/decision-engine/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";
import type { BrainRecommendationKind } from "@/lib/apex-brain/types";

export const BRAIN_RECOMMENDATION: Record<
  ApexDecisionVerdictKind,
  { kind: BrainRecommendationKind; label: "STRONG BET" | "BET" | "LEAN BET" | "WATCH" | "SKIP" }
> = {
  elite_pick: { kind: "strong_bet", label: "STRONG BET" },
  strong_bet: { kind: "bet", label: "BET" },
  lean_bet: { kind: "lean_bet", label: "LEAN BET" },
  pass: { kind: "watch", label: "WATCH" },
  avoid: { kind: "skip", label: "SKIP" },
};

/** Scoring Engine v2 → Brain card labels. Stake still comes from Decision Engine. */
export const BRAIN_FROM_TIER: Record<
  ScoringTier,
  { kind: BrainRecommendationKind; label: "STRONG BET" | "BET" | "LEAN BET" | "WATCH" | "SKIP" }
> = {
  Elite: { kind: "strong_bet", label: "STRONG BET" },
  "Strong Bet": { kind: "bet", label: "BET" },
  "Value Bet": { kind: "lean_bet", label: "LEAN BET" },
  Watch: { kind: "watch", label: "WATCH" },
  Avoid: { kind: "skip", label: "SKIP" },
};
