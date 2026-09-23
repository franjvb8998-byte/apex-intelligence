/**
 * PE-3A — Prematch-safe team strength reconstruction (product core).
 *
 * Pure / offline. Accepts a supplied fixture universe; never calls providers
 * or durable stores. Not wired into production lifecycle yet (PE-3B).
 */

export const PREMATCH_STRENGTH_REGIME_C0_RECON_V1 =
  "REGIME_LIFECYCLE_C0_RECON_V1" as const;

export type PrematchStrengthRegime =
  typeof PREMATCH_STRENGTH_REGIME_C0_RECON_V1;

/** Elo source for one side after reconstruction. */
export type PrematchStrengthEloSource = "catalogue" | "base_prior";

export type PrematchStrengthFallbackReason =
  | "empty_universe"
  | "no_completed_priors"
  | "malformed_target"
  | null;

/**
 * Target fixture identity for reconstruction.
 * Competition + season scope matches calibration prior rules.
 */
export type PrematchStrengthTarget = {
  fixtureId: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  competitionId: string;
  season: string;
};

/**
 * One fixture that may contribute as historical evidence.
 * Goals are absolute home/away scores (not team-perspective).
 */
export type PrematchStrengthUniverseFixture = {
  fixtureId: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  competitionId: string;
  season: string;
  /** Provider status short string (e.g. FT, AET, PEN, NS, LIVE). */
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

export type PrematchTeamEvidenceCounts = {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type PrematchSideStrength = {
  teamId: string;
  elo: number;
  source: PrematchStrengthEloSource;
  base: number;
  evidence: PrematchTeamEvidenceCounts;
};

export type PrematchStrengthResult = {
  homeElo: number;
  awayElo: number;
  home: PrematchSideStrength;
  away: PrematchSideStrength;
  /** Always catalogue | base_prior pair summary; see sides for detail. */
  source: PrematchStrengthEloSource | "mixed";
  regime: PrematchStrengthRegime;
  /**
   * Lifecycle acquisition / prediction clock when reconstruction ran.
   * NOT a provider historical snapshot timestamp (API-Football does not expose one).
   */
  evidenceAcquiredAtUtc: string | null;
  /**
   * @deprecated Alias of evidenceAcquiredAtUtc for older readers.
   * Same semantics: acquisition clock — NOT provider snapshot time.
   */
  evidenceAsOfUtc: string | null;
  /** Exclusive historical cutoff = target kickoff (priors must be strictly before). */
  historicalCutoffUtc: string;
  targetFixtureId: string;
  priorsInspected: number;
  /** Unique completed priors that contributed to at least one side. */
  priorsAccepted: number;
  /**
   * Versioned digest of accepted prior rows (order-independent).
   * Improves reproducibility audit; does not prove provider immutability.
   */
  acceptedEvidenceDigest: string;
  fallback: boolean;
  fallbackReason: PrematchStrengthFallbackReason;
};
