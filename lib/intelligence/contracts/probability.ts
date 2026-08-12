import type { MatchOutcome, OutcomeProbability } from "@/lib/intelligence/types";

/**
 * Probability module — normalize, validate, and derive outcomes from distributions.
 * Match-level 1X2 / O/U markets: see `ProbabilityEngine` (Elo × Poisson hybrid).
 */
export interface ProbabilityModule {
  /** Ensure probabilities are finite, non-negative, and sum to 1. */
  normalize(probabilities: OutcomeProbability): OutcomeProbability;

  /** Softmax over raw scores keyed by outcome. */
  fromScores(scores: Record<MatchOutcome, number>): OutcomeProbability;

  /** Argmax outcome (ties broken by module policy — TBD). */
  mostLikely(probabilities: OutcomeProbability): MatchOutcome;

  /** Shannon entropy or equivalent uncertainty measure in [0, 1] scale (TBD). */
  uncertainty(probabilities: OutcomeProbability): number;
}
