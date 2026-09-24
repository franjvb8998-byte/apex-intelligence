/**
 * GOALS-1B — Canonical historical goal evidence contracts.
 * Evidence infrastructure only. No model fitting.
 */

export const GOALS_EVIDENCE_SCHEMA_VERSION = "goals.historical.evidence.v1" as const;
export const GOALS_EVIDENCE_BUILDER_VERSION =
  "goals.historical.evidence.builder.v1" as const;

export const GOALS_REGULATION_LABEL_POLICY = "REGULATION_90_ONLY" as const;
export const GOALS_TEMPORAL_RULE = "kickoff_lt_target" as const;
export const GOALS_CROSS_COMPETITION_POLICY =
  "same_competition_same_season_only" as const;

export const GOALS_HOLDOUT_SEASON = "2025" as const;
export const GOALS_DEV_SEASON = "2023" as const;
export const GOALS_CONFIRMATORY_SEASON = "2024" as const;

/** Predeclared recent windows — not optimized. */
export const GOALS_LAST_N_WINDOWS = [3, 5, 8] as const;
export const GOALS_CALENDAR_DAY_WINDOWS = [28, 56] as const;

export type GoalsComponentStatus = "USED" | "PARTIAL" | "UNAVAILABLE";

export type GoalsUnavailableReason =
  | "no_prior_team_matches"
  | "no_prior_home_matches"
  | "no_prior_away_matches"
  | "no_prior_league_matches"
  | "regulation90_label_unavailable"
  | "regulation90_label_unproven"
  | "conflicting_duplicate"
  | "malformed_fixture"
  | "insufficient_recent_history"
  | "identical_home_away"
  | "invalid_kickoff"
  | "missing_competition"
  | "missing_season"
  | "holdout_season_forbidden"
  | "common_strength_unavailable"
  | "cross_comp_evidence_unavailable"
  | "zero_history_rates_null";

/**
 * How regulation-90 goals were obtained for a fixture.
 * ASSUMED_* is explicit research provenance — never silent.
 */
export type GoalsRegulationLabelSource =
  | "explicit_fulltime_fields"
  | "status_ft_goals_fields"
  | "calibration_actual_under_league_ft_assumption"
  | "unavailable";

export type GoalsHistoricalFixture = {
  fixtureId: string;
  kickoffUtc: string;
  status: string | null;
  competitionId: string;
  season: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Explicit regulation/fulltime goals when known. */
  regulationHomeGoals: number | null;
  regulationAwayGoals: number | null;
  regulationGoalsAvailable: boolean;
  regulationLabelSource: GoalsRegulationLabelSource;
  /** Raw vendor goals fields when present (never used as AET substitute). */
  sourceGoalsHome: number | null;
  sourceGoalsAway: number | null;
  sourceFulltimeHome: number | null;
  sourceFulltimeAway: number | null;
};

export type GoalsRateBlock = {
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  goalsForPerMatch: number | null;
  goalsAgainstPerMatch: number | null;
  status: GoalsComponentStatus;
  reason: GoalsUnavailableReason | null;
};

export type GoalsRecentWindowEvidence = {
  windowId: string;
  requestedN: number | null;
  actualN: number;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  goalsForPerMatch: number | null;
  goalsAgainstPerMatch: number | null;
  status: GoalsComponentStatus;
  reason: GoalsUnavailableReason | null;
};

export type GoalsTeamHistoricalEvidence = {
  teamId: string;
  historicalCutoffUtc: string;
  competitionId: string;
  season: string;
  allVenues: GoalsRateBlock;
  homeRole: GoalsRateBlock;
  awayRole: GoalsRateBlock;
  recentLastN: GoalsRecentWindowEvidence[];
  recentCalendar: GoalsRecentWindowEvidence[];
  recentVenueRoleLastN: GoalsRecentWindowEvidence[];
};

export type GoalsLeagueHistoricalEnvironment = {
  competitionId: string;
  season: string;
  historicalCutoffUtc: string;
  leagueMatchesPlayedBefore: number;
  leagueHomeGoalsBefore: number;
  leagueAwayGoalsBefore: number;
  leagueTotalGoalsBefore: number;
  leagueHomeGoalsPerMatch: number | null;
  leagueAwayGoalsPerMatch: number | null;
  leagueTotalGoalsPerMatch: number | null;
  status: GoalsComponentStatus;
  reason: GoalsUnavailableReason | null;
};

export type GoalsMarketActualLabels = {
  totalGoals90: number;
  over05: boolean;
  under05: boolean;
  over15: boolean;
  under15: boolean;
  over25: boolean;
  under25: boolean;
  over35: boolean;
  under35: boolean;
  over45: boolean;
  under45: boolean;
  bttsYes: boolean;
  bttsNo: boolean;
  homeOver05: boolean;
  homeUnder05: boolean;
  homeOver15: boolean;
  homeUnder15: boolean;
  homeOver25: boolean;
  homeUnder25: boolean;
  awayOver05: boolean;
  awayUnder05: boolean;
  awayOver15: boolean;
  awayUnder15: boolean;
  awayOver25: boolean;
  awayUnder25: boolean;
};

export type GoalsTargetLabels = {
  labelStatus: GoalsComponentStatus;
  reason: GoalsUnavailableReason | null;
  regulationLabelSource: GoalsRegulationLabelSource;
  actualHomeGoals90: number | null;
  actualAwayGoals90: number | null;
  actualTotalGoals90: number | null;
  actualGoalDifference90: number | null;
  marketLabels: GoalsMarketActualLabels | null;
};

export type GoalsCommonStrengthSeam = {
  semantics: "common_fixed_baseline_index_not_venue_role_elo";
  comparableToVenueSpecificC0Elo: false;
  status: GoalsComponentStatus;
  reason: GoalsUnavailableReason | null;
  homeCommonStrength: number | null;
  awayCommonStrength: number | null;
  strengthDifferentialHome: number | null;
};

export type GoalsOpponentAdjustmentSeam = {
  status: "DEFERRED_TO_GOALS_1D";
  note: "Opponent rates as-of each prior match M are reconstructible via kickoff_lt(M) but not attached numerically in 1B.";
};

export type GoalsEvidenceProvenance = {
  schemaVersion: typeof GOALS_EVIDENCE_SCHEMA_VERSION;
  evidenceVersion: typeof GOALS_EVIDENCE_BUILDER_VERSION;
  historicalCutoffUtc: string;
  competitionId: string;
  season: string;
  regulationLabelPolicy: typeof GOALS_REGULATION_LABEL_POLICY;
  temporalRule: typeof GOALS_TEMPORAL_RULE;
  crossCompetitionPolicy: typeof GOALS_CROSS_COMPETITION_POLICY;
  homePlayedAll: number;
  awayPlayedAll: number;
  leagueMatchesPlayedBefore: number;
  regulationLabelSource: GoalsRegulationLabelSource;
  homeAdvantageEncoded: false;
  fittedModelPresent: false;
};

export type GoalsTargetEvidence = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  historicalCutoffUtc: string;
  labels: GoalsTargetLabels;
  homeEvidence: GoalsTeamHistoricalEvidence;
  awayEvidence: GoalsTeamHistoricalEvidence;
  leagueEnvironment: GoalsLeagueHistoricalEnvironment;
  commonStrengthSeam: GoalsCommonStrengthSeam;
  opponentAdjustmentSeam: GoalsOpponentAdjustmentSeam;
  provenance: GoalsEvidenceProvenance;
  digest: string;
};

export type GoalsFailClosedClass =
  | "extractionFatal"
  | "componentUnavailable"
  | "componentPartial"
  | "targetLabelUnavailable"
  | "futureModelFallbackEligible";
