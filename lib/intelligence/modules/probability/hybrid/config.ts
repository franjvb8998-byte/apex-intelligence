import type { HybridProbabilityConfig } from "@/lib/intelligence/modules/probability/hybrid/types";

/**
 * Default hybrid parameters (football-oriented priors).
 * Calibrate later against historical leagues — see TODO in engine.
 */
export const DEFAULT_HYBRID_CONFIG: HybridProbabilityConfig = {
  homeAdvantageElo: 65,
  eloScale: 400,
  // Typical top-flight scoring rates (home slightly higher than away).
  baseHomeGoals: 1.45,
  baseAwayGoals: 1.15,
  // ~400 keeps a 200-point gap as a meaningful but not extreme λ shift.
  eloGoalScale: 400,
  // Small extra γ; most HFA already sits in baseHomeGoals vs baseAwayGoals.
  homeGoalsAdvantage: 1.0,
  eloDrawBase: 0.28,
  eloDrawDecay: 220,
  // Prefer Poisson for score-derived markets; Elo still anchors 1X2.
  poissonBlendWeight: 0.7,
  // Keep high enough so Pois(λ≈6) truncation mass stays > 0.99.
  maxGoals: 15,
  modelVersion: "elo-poisson-hybrid-0.1.0",
};

export function mergeHybridConfig(
  overrides?: Partial<HybridProbabilityConfig>,
): HybridProbabilityConfig {
  return { ...DEFAULT_HYBRID_CONFIG, ...overrides };
}
