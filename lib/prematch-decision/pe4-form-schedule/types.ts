/**
 * PE-4 — Competition-scoped form & schedule evidence types.
 *
 * PE-4B: raw form / schedule evidence.
 * PE-4C: historical-time opponent strength evidence (no PE math).
 * PE-4D: fail-closed contract + provenance hardening.
 *
 * Evidence only. No probability labels, no provider I/O.
 */

import type { PrematchStrengthEloSource } from "@/lib/match-center/prematch-strength/types";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";

/** Context layer key under PrematchInputProvenance.contextLayers. */
export const PE4_FORM_SCHEDULE_CONTEXT_LAYER_KEY = "pe4_form_schedule_v1" as const;

export const PE4_FORM_SCHEDULE_LAYER_VERSION = "pe4_form_schedule_v1" as const;

/**
 * Default last-N window.
 * Aligns with Match Center's existing recent-form display window (last 5)
 * without implying that N=5 is statistically sufficient. Callers may override.
 * Provenance always records requestedLastN and actualLastN.
 */
export const PE4_DEFAULT_LAST_N = 5 as const;

export const PE4_FORM_SCHEDULE_SCOPE_COMPETITION_SEASON =
  "competition_season" as const;

export type Pe4FormScheduleScope =
  typeof PE4_FORM_SCHEDULE_SCOPE_COMPETITION_SEASON;

export type Pe4VenueRole = "HOME" | "AWAY";

export type Pe4MatchResult = "W" | "D" | "L";

export type Pe4ComponentStatusCode = "USED" | "UNAVAILABLE" | "PARTIAL";

export type Pe4UnavailableReason =
  | "no_completed_priors"
  | "trajectory_classification_deferred"
  | "malformed_target"
  | "conflicting_duplicate_fixture"
  | "extraction_failed"
  | "some_historical_opponent_strength_unavailable";

/**
 * Semantic identity of PE-4C/G.1 historical strength numbers.
 *
 * These values are C0 catalogue/base_prior compositions against a *common
 * fixed reconstruction baseline* (PRODUCTION_HOME_ELO_BASE = 1580).
 * They are a relative comparison index — NOT venue-role home/away C0 Elo
 * for a target fixture. Do not compare them directly to ticket home.elo /
 * away.elo without accounting for base (1580 vs 1520).
 */
export const PE4_COMMON_BASELINE_STRENGTH_SEMANTICS =
  "common_fixed_baseline_index_not_venue_role_elo" as const;

/** @deprecated Alias — prefer PE4_COMMON_BASELINE_STRENGTH_SEMANTICS */
export const PE4_OPPONENT_STRENGTH_SEMANTICS =
  PE4_COMMON_BASELINE_STRENGTH_SEMANTICS;

export type Pe4CommonBaselineStrengthSemantics =
  typeof PE4_COMMON_BASELINE_STRENGTH_SEMANTICS;

export type Pe4OpponentStrengthSemantics = Pe4CommonBaselineStrengthSemantics;

export type Pe4OpponentStrengthUnavailableReason =
  | "invalid_opponent_team_id"
  | "reconstruction_failed";

export type Pe4TargetStrengthUnavailableReason =
  | "invalid_target_team_id"
  | "reconstruction_failed";

/**
 * Historical-time opponent strength for one prior match M.
 * Cutoff is always kickoff(M) — never target kickoff T.
 */
export type Pe4OpponentStrengthEvidence = {
  opponentTeamId: string;
  /**
   * C0-composed strength index for Y as of kickoff(M); null if unavailable.
   * Common fixed baseline — see opponentStrengthSemantics.
   */
  opponentStrengthAsOfMatchKickoff: number | null;
  opponentStrengthSource: PrematchStrengthEloSource | null;
  opponentStrengthPlayed: number | null;
  /** Always kickoff(M). */
  opponentStrengthCutoffUtc: string;
  opponentStrengthAvailable: boolean;
  unavailableReason: Pe4OpponentStrengthUnavailableReason | null;
  /** Fixed common baseline (1580). Not a claim that Y was home. */
  opponentStrengthReconstructionBase: number;
  /** Prevents misuse as venue-specific C0 Elo. */
  opponentStrengthSemantics: Pe4OpponentStrengthSemantics;
  /** Always false: never pairwise-comparable to side C0 without base adjust. */
  comparableToVenueSpecificC0Elo: false;
};

/**
 * Historical-time TARGET-team strength for prior match M (PE-4G.1).
 * Same common-baseline semantics as opponent strength.
 */
export type Pe4TargetStrengthEvidence = {
  targetTeamId: string;
  targetStrengthAsOfMatchKickoff: number | null;
  targetStrengthSource: PrematchStrengthEloSource | null;
  targetStrengthPlayed: number | null;
  /** Always kickoff(M). */
  targetStrengthCutoffUtc: string;
  targetStrengthAvailable: boolean;
  unavailableReason: Pe4TargetStrengthUnavailableReason | null;
  targetStrengthReconstructionBase: number;
  targetStrengthSemantics: Pe4CommonBaselineStrengthSemantics;
  comparableToVenueSpecificC0Elo: false;
};

export type Pe4PairwiseStrengthQualityKind =
  | "catalogue_catalogue"
  | "catalogue_base_prior"
  | "base_prior_catalogue"
  | "base_prior_base_prior"
  | "unavailable";

export type Pe4PairwiseUnavailableReason =
  | "target_historical_strength_unavailable"
  | "opponent_historical_strength_unavailable"
  | "both_sides_unavailable"
  | "pairwise_differential_unavailable";

/**
 * Descriptive pairwise common-baseline context for match M.
 * Differential is evidence only — NOT a probability.
 */
export type Pe4PairwiseHistoricalStrengthContext = {
  targetTeamId: string;
  opponentTeamId: string;
  targetCommonIndex: number | null;
  opponentCommonIndex: number | null;
  /** targetCommonIndex - opponentCommonIndex when both available. */
  strengthDifferential: number | null;
  targetVenueRole: Pe4VenueRole;
  targetSource: PrematchStrengthEloSource | null;
  opponentSource: PrematchStrengthEloSource | null;
  targetPlayed: number | null;
  opponentPlayed: number | null;
  historicalCutoffUtc: string;
  commonReconstructionBase: number;
  semantics: Pe4CommonBaselineStrengthSemantics;
  comparableToVenueSpecificC0Elo: false;
  pairwiseAvailable: boolean;
  unavailableReason: Pe4PairwiseUnavailableReason | null;
  qualityKind: Pe4PairwiseStrengthQualityKind;
};

export type Pe4HistoricalExpectationUnavailableReason =
  | "expectation_model_not_defined"
  | "pairwise_strength_unavailable";

/**
 * Historical expectation for residual construction.
 * PE-4G.1: always UNAVAILABLE (no valid EloPoisson reuse / no invented map).
 */
export type Pe4HistoricalExpectationEvidence = {
  status: "UNAVAILABLE";
  reason: Pe4HistoricalExpectationUnavailableReason;
  modelVersion: string;
  expectedHomeWinProbability: null;
  expectedDrawProbability: null;
  expectedAwayWinProbability: null;
  expectedPointsFromTargetPerspective: null;
  expectedGoalDifferenceFromTargetPerspective: null;
  expectedGoalsFor: null;
  expectedGoalsAgainst: null;
  auditNotes: {
    eloPoissonHybridNotReusable: true;
    hfaEntangledWithEngineInputs: true;
    commonBaselineNotVenueRoleElo: true;
    noArbitraryMappingEmitted: true;
  };
};

export type Pe4HistoricalResidualUnavailableReason =
  | "expectation_model_not_defined"
  | "expectation_unavailable";

/**
 * Residual contract. No numeric residuals without a defined expectation
 * in matching units. No silent win=1/draw=0.5 encoding.
 */
export type Pe4HistoricalResidualEvidence = {
  status: "UNAVAILABLE";
  reason: Pe4HistoricalResidualUnavailableReason;
  resultResidual: null;
  goalDifferenceResidual: null;
  observedResultEncoding: null;
  resultEncodingScheme: null;
};

export type Pe4OpponentStrengthCoverage = {
  selectedMatchCount: number;
  catalogueCount: number;
  basePriorCount: number;
  unavailableCount: number;
};

export type Pe4TargetStrengthCoverage = Pe4OpponentStrengthCoverage;

export type Pe4PairwiseStrengthCoverage = {
  selectedMatchCount: number;
  catalogueCatalogueCount: number;
  catalogueBasePriorCount: number;
  basePriorCatalogueCount: number;
  basePriorBasePriorCount: number;
  unavailableCount: number;
};

export type Pe4OpponentAdjustedCoverageKind =
  | "all_catalogue"
  | "all_base_prior"
  | "mixed_catalogue_base_prior";

export type Pe4ComponentStatus =
  | {
      status: "USED";
      /** Present for opponentAdjustedForm when coverage is complete. */
      coverage?: Pe4OpponentAdjustedCoverageKind;
    }
  | {
      status: "PARTIAL";
      reason: "some_historical_opponent_strength_unavailable";
      coverage: Pe4OpponentStrengthCoverage;
    }
  | { status: "UNAVAILABLE"; reason: Pe4UnavailableReason };

export type Pe4RollingWindowCounts = {
  previous7Days: number;
  previous14Days: number;
  previous21Days: number;
  previous28Days: number;
};

/**
 * One completed prior from the team's perspective.
 * Neutral-ground physical venue truth is unavailable in the season universe;
 * venueRole is competition home/away ROLE only.
 */
export type Pe4PriorMatchSummary = {
  fixtureId: string;
  kickoffUtc: string;
  opponentTeamId: string;
  venueRole: Pe4VenueRole;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  result: Pe4MatchResult;
  status: string;
  competitionId: string;
  season: string;
  /** PE-4C historical-time opponent strength (as of kickoff of this match). */
  opponentStrength: Pe4OpponentStrengthEvidence;
  /** PE-4G.1 historical-time TARGET strength (as of kickoff of this match). */
  targetStrength: Pe4TargetStrengthEvidence;
  /** Pairwise common-baseline context (descriptive; not a probability). */
  pairwiseHistoricalStrength: Pe4PairwiseHistoricalStrengthContext;
  /** Expectation for residual construction — UNAVAILABLE until mapping exists. */
  historicalExpectation: Pe4HistoricalExpectationEvidence;
  /** Residual vs expectation — UNAVAILABLE without expectation map. */
  historicalResidual: Pe4HistoricalResidualEvidence;
};

export type Pe4SideAggregate = {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type Pe4SideEvidence = {
  teamId: string;
  requestedLastN: number;
  /** Number of last-N selected matches (never padded). */
  actualLastN: number;
  /** Chronological (oldest→newest) completed priors for this team before T. */
  orderedCompletedPriors: Pe4PriorMatchSummary[];
  /** Last-N slice of orderedCompletedPriors (newest N), chronological oldest→newest. */
  lastNMatches: Pe4PriorMatchSummary[];
  /** Fixture ids of lastNMatches in chronological order. */
  selectedFixtureIds: string[];
  /** Aggregates over lastNMatches only. */
  lastNAggregate: Pe4SideAggregate;
  /** Aggregates over all orderedCompletedPriors. */
  allCompletedAggregate: Pe4SideAggregate;
  previousCompletedKickoffUtc: string | null;
  /**
   * Hours since previous *competition-season* completed match.
   * NOT global/cross-competition rest. See crossCompetitionBlind.
   */
  competitionScopedRestHoursSincePreviousCompleted: number | null;
  /**
   * Counts of competition-season completed matches in rolling windows.
   * Blind to other competitions.
   */
  competitionScopedMatchesInWindows: Pe4RollingWindowCounts;
  /** Coverage over lastNMatches opponent-strength evidence. */
  opponentStrengthCoverage: Pe4OpponentStrengthCoverage;
  /** Coverage over lastNMatches target-strength evidence (PE-4G.1). */
  targetStrengthCoverage: Pe4TargetStrengthCoverage;
  /** Coverage over lastNMatches pairwise quality kinds (PE-4G.1). */
  pairwiseStrengthCoverage: Pe4PairwiseStrengthCoverage;
  components: {
    recentForm: Pe4ComponentStatus;
    venueRole: Pe4ComponentStatus;
    /**
     * Competition-season schedule density / rest only.
     * Always interpreted with layer.crossCompetitionBlind === true.
     */
    scheduleCompetitionScoped: Pe4ComponentStatus;
    /** Ordered sequence available for future trajectory — not classified. */
    trajectoryOrderedEvidence: Pe4ComponentStatus;
    /**
     * Historical-time opponent context on selected priors.
     * Not a form score or probability adjustment.
     */
    opponentAdjustedForm: Pe4ComponentStatus;
    /** Improving/stable/deteriorating labels — deferred. */
    trajectoryClassification: Pe4ComponentStatus;
  };
};

export type Pe4FormScheduleTarget = {
  fixtureId: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  competitionId: string;
  season: string;
};

export type Pe4FormScheduleExtractInput = {
  target: Pe4FormScheduleTarget;
  universe: readonly PrematchStrengthUniverseFixture[];
  /**
   * Lifecycle acquisition clock. Stored in provenance only.
   * Must not affect evidenceDigest.
   */
  evidenceAcquiredAtUtc?: string | null;
  /** Override default last-N. Must be a positive finite integer. */
  lastN?: number;
};

/**
 * Versioned PE-4 context layer snapshot (reproducible evidence).
 */
export type Pe4FormScheduleContextLayer = {
  layerVersion: typeof PE4_FORM_SCHEDULE_LAYER_VERSION;
  scope: Pe4FormScheduleScope;
  historicalCutoffUtc: string;
  evidenceAcquiredAtUtc: string | null;
  universeKey: {
    competitionId: string;
    season: string;
  };
  /**
   * Always true while universe is competition+season only.
   * Competition-scoped rest must not be read as globally complete fatigue.
   * Literal type `true` — validators reject false.
   */
  crossCompetitionBlind: true;
  requestedLastN: number;
  home: Pe4SideEvidence;
  away: Pe4SideEvidence;
  /**
   * Order-independent SHA-256 hex of materially used evidence.
   * Excludes evidenceAcquiredAtUtc.
   */
  evidenceDigest: string;
  priorsInspected: number;
  notes: {
    venueRoleIsCompetitionHomeAwayOnly: true;
    neutralGroundUnavailableInSeasonUniverse: true;
    opponentAdjustedForm: "historical_time_c0_evidence_pe4c";
    trajectoryClassification: "deferred";
    opponentStrengthCutoffRule: "kickoff_of_historical_match_M_strictly_before";
    opponentStrengthNeverUsesTargetKickoff: true;
    opponentStrengthSemantics: Pe4OpponentStrengthSemantics;
    targetStrengthCutoffRule: "kickoff_of_historical_match_M_strictly_before";
    targetStrengthNeverUsesTargetKickoff: true;
    targetStrengthSemantics: Pe4CommonBaselineStrengthSemantics;
    pairwiseHistoricalStrength: "common_baseline_differential_descriptive_only";
    historicalExpectationModel: "undefined_pending_compatible_mapping";
    historicalResidual: "unavailable_without_expectation_model";
    scheduleRestIsCompetitionSeasonOnly: true;
    competitionScopedRestIsNotGlobalRest: true;
  };
};

export type Pe4FormScheduleExtractOk = {
  ok: true;
  layer: Pe4FormScheduleContextLayer;
};

export type Pe4FormScheduleExtractErr = {
  ok: false;
  reason: "malformed_target" | "conflicting_duplicate_fixture" | "invalid_last_n";
  fixtureId?: string;
  message: string;
};

export type Pe4FormScheduleExtractResult =
  | Pe4FormScheduleExtractOk
  | Pe4FormScheduleExtractErr;
