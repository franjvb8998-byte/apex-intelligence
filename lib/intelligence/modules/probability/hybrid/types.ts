import type { OutcomeProbability, UUID } from "@/lib/intelligence/types";

/** Tunable parameters for the Elo × Poisson hybrid. */
export type HybridProbabilityConfig = {
  /** Elo points added to the home team for two-way expectancy / draw model. */
  homeAdvantageElo: number;
  /** Classic Elo scale factor F (usually 400). */
  eloScale: number;
  /** Baseline expected home goals μ_home. */
  baseHomeGoals: number;
  /** Baseline expected away goals μ_away. */
  baseAwayGoals: number;
  /** Elo→goals scale S in λ ∝ 10^(ΔR / S). */
  eloGoalScale: number;
  /** Extra multiplicative home boost γ on λ_home. */
  homeGoalsAdvantage: number;
  /** Peak draw probability when ΔR ≈ 0 (Elo→1X2 bridge). */
  eloDrawBase: number;
  /** Controls how fast Elo draw mass decays with |ΔR|. */
  eloDrawDecay: number;
  /**
   * Blend weight w for final 1X2:
   * P = w * P_poisson + (1 - w) * P_elo
   */
  poissonBlendWeight: number;
  /** Truncate scoreline grid to 0..maxGoals (inclusive). */
  maxGoals: number;
  modelVersion: string;
};

export type TeamEloInput = {
  homeElo: number;
  awayElo: number;
  /** Optional identifiers for tracing / future rating providers. */
  homeTeamId?: UUID;
  awayTeamId?: UUID;
  matchId?: UUID;
};

export type OverUnderProbability = {
  line: 2.5;
  over: number;
  under: number;
};

export type PoissonBreakdown = {
  lambdaHome: number;
  lambdaAway: number;
  oneXTwo: OutcomeProbability;
  overUnder25: OverUnderProbability;
  /** Probability mass captured inside the truncated grid (should be ≈ 1). */
  coveredMass: number;
};

export type EloBreakdown = {
  winExpectancyHome: number;
  oneXTwo: OutcomeProbability;
};

export type HybridProbabilityResult = {
  oneXTwo: OutcomeProbability;
  overUnder25: OverUnderProbability;
  expectedGoals: {
    home: number;
    away: number;
    total: number;
  };
  elo: EloBreakdown;
  poisson: PoissonBreakdown;
  meta: {
    modelVersion: string;
    poissonBlendWeight: number;
    config: HybridProbabilityConfig;
  };
};

/**
 * Port for loading Elo ratings. Not wired to DB/API yet.
 *
 * TODO(elo-provider): implement Supabase/ co-backed provider that updates
 * ratings after each finished match (K-factor schedule TBD).
 */
export interface EloRatingProvider {
  getPair(input: {
    homeTeamId: UUID;
    awayTeamId: UUID;
    at?: string;
  }): Promise<{ homeElo: number; awayElo: number }>;
}

/**
 * Match-level probability engine (1X2 + O/U 2.5).
 * Independent from HTTP / frontend.
 */
export interface ProbabilityEngine {
  readonly modelVersion: string;
  predict(input: TeamEloInput): HybridProbabilityResult;
}
