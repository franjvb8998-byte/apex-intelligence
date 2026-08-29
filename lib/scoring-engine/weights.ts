/**
 * Published Scoring Engine v2 weights.
 * Recalibrate this file only. Missing components are dropped and renormalized.
 */

import type { ScoringComponentKey, ScoringTier } from "@/lib/scoring-engine/types";

export const SCORING_WEIGHTS: Record<ScoringComponentKey, number> = {
  probability: 0.14,
  expectedValue: 0.16,
  marketValue: 0.12,
  teamIntelligence: 0.14,
  momentum: 0.08,
  tactical: 0.08,
  confidence: 0.12,
  risk: 0.08,
  dataQuality: 0.08,
};

export const SCORING_COMPONENT_LABELS: Record<ScoringComponentKey, string> = {
  probability: "Probability Score",
  expectedValue: "Expected Value Score",
  marketValue: "Market Value Score",
  teamIntelligence: "Team Intelligence Score",
  momentum: "Momentum Score",
  tactical: "Tactical Score",
  confidence: "Confidence Score",
  risk: "Risk Score",
  dataQuality: "Data Quality Score",
};

export const SCORING_TIER_STARS: Record<ScoringTier, number> = {
  Elite: 5,
  "Strong Bet": 4,
  "Value Bet": 3,
  Watch: 2,
  Avoid: 1,
};
