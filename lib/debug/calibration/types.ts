/**
 * Sprint 5B.3A — offline calibration row schema.
 * Debug/harness only. Not imported by production runtime.
 */

export const CALIBRATION_SCHEMA_VERSION = "apex.calibration.row.v1";
export const CALIBRATION_RECONSTRUCTION_VERSION =
  "same_competition_season.kickoff_lt.v2";
export const CALIBRATION_COLLECTOR_VERSION = "apex.calibration.collector.v1";

/** Role bases copied from production call sites. Do not change production. */
export const CALIBRATION_HOME_BASE = 1580;
export const CALIBRATION_AWAY_BASE = 1520;

export const CALIBRATION_ARTIFACT_DIR = "data/calibration";

export type CalibrationOutcome = "home" | "draw" | "away";

export type CalibrationOddsTiming =
  | "unknown"
  | "vendor_update"
  | "fetch_time";

export type EvidenceBucket = "0" | "1-3" | "4-9" | "10+";

export type EloPolicyId =
  | "current_catalogue"
  | "base_prior"
  | "linear_shrinkage"
  | "exponential_shrinkage"
  | "pseudo_match_bayesian"
  | "shrinkage_plus_cap";

export type TeamRecordBefore = {
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type CalibrationRow = {
  schemaVersion: typeof CALIBRATION_SCHEMA_VERSION;
  reconstructionVersion: typeof CALIBRATION_RECONSTRUCTION_VERSION;
  fixtureId: string;
  kickoff: string;
  competitionId: string;
  competitionName: string;
  season: string;
  category: "mens" | "womens" | "youth" | "international" | "other";
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homePlayedBefore: number;
  homeWinsBefore: number;
  homeGfBefore: number;
  homeGaBefore: number;
  awayPlayedBefore: number;
  awayWinsBefore: number;
  awayGfBefore: number;
  awayGaBefore: number;
  actualHomeGoals: number | null;
  actualAwayGoals: number | null;
  actualOutcome: CalibrationOutcome | null;
  bookmaker: string | null;
  market: "1x2" | null;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
  oddsObservedAt: string | null;
  oddsTiming: CalibrationOddsTiming;
};

export type ReconstructionFixture = {
  fixtureId: string;
  kickoff: string;
  competitionId: string;
  competitionName?: string;
  season: string;
  homeTeamId: string;
  homeTeamName?: string;
  awayTeamId: string;
  awayTeamName?: string;
  status: string;
  goalsHome: number | null;
  goalsAway: number | null;
  fulltimeHome: number | null;
  fulltimeAway: number | null;
};

export type OneXTwo = {
  home: number;
  draw: number;
  away: number;
};

export type SeasonListPaging = {
  current: number;
  total: number;
};

export type LeagueSeasonSelection = {
  leagueId: string;
  season: string;
  /** 1 for the single unpaged season response. Not pages traversed. */
  pageCount: number;
};

export type CollectionRunMetadata = {
  datasetSchemaVersion: string;
  reconstructionVersion: string;
  collectorVersion: string;
  collectionTimestamp: string;
  selectedLeagueSeasons: LeagueSeasonSelection[];
  pageCounts: number[];
  fixtureCountBeforeDedupe: number;
  fixtureCountAfterDedupe: number;
  /** Requested target count (15 for the 5B.3B microcollection). */
  requestedTargetCount?: number;
  /** Rows actually written after selection/reconstruction. */
  targetRowCount: number;
  oddsCoverageCount: number;
  /**
   * Observed oddsTiming histogram. Timing stays "unknown" unless proven.
   * Do not read this as pre-match / opening / closing.
   */
  oddsTimingClassification: Record<CalibrationOddsTiming, number>;
  selectionRule?: string;
  /** Logical fixture-list lookups (1 for the unpaged collector). */
  fixtureListLogicalCalls?: number;
  /** Logical GET /odds lookups. Not origin HTTP attempts. */
  oddsLogicalCalls?: number;
  /**
   * Observed LOGICAL lookups (fixture-list + odds).
   * Not origin HTTP attempts; retries can add more HTTP than this number.
   */
  logicalCallCount?: number;
  /** Historical alias of logicalCallCount. */
  originCallCount?: number;
  /**
   * Explicit: the microcollection ceiling counts logical lookups, not
   * origin HTTP attempts (retries / limiter waits are outside this number).
   */
  callBudgetKind?: "logical_lookups_not_origin_http_attempts";
  leagueName?: string;
};

export type EvidenceBucketCounts = Record<EvidenceBucket, number>;

/**
 * Metadata for the 5B.4 historical probability pilot.
 * Distinct from microcollection metadata. Odds are never requested.
 */
export type PilotRunMetadata = {
  schemaVersion: string;
  reconstructionVersion: string;
  collectorVersion: string;
  leagueId: string;
  season: string;
  leagueName: string;
  generatedAt: string;
  requestedTargetCount: number;
  targetRowCount: number;
  fullEligiblePopulationCount: number;
  fullPopulationEvidenceBuckets: EvidenceBucketCounts;
  selectedEvidenceBuckets: EvidenceBucketCounts;
  fixtureCountBeforeDedupe: number;
  fixtureCountAfterDedupe: number;
  fixtureListLogicalCalls: number;
  logicalCallCount: number;
  callBudgetKind: "logical_lookups_not_origin_http_attempts";
  oddsRequested: false;
  oddsLogicalCalls: 0;
  leakageViolationCount: number;
  selectionAlgorithm: string;
  selectionRule: string;
  /** Basename of the full eligible-population JSONL. */
  populationArtifact?: string;
  /** Basename of the stratified-sample JSONL. */
  sampleArtifact?: string;
  populationRowCount?: number;
  sampleRowCount?: number;
};

/**
 * Metadata for a 5B.6 holdout-season natural population.
 * No stratified sample. Odds are never requested.
 */
export type ValidationSeasonMetadata = {
  schemaVersion: string;
  reconstructionVersion: string;
  collectorVersion: string;
  datasetKind: "NATURAL FULL POPULATION";
  validationRole: "HOLDOUT" | "DEVELOPMENT";
  leagueId: string;
  season: string;
  leagueName: string;
  generatedAt: string;
  populationRowCount: number;
  evidenceBuckets: EvidenceBucketCounts;
  fixtureCountBeforeDedupe: number;
  fixtureCountAfterDedupe: number;
  fixtureListLogicalCalls: 1;
  logicalCallCount: number;
  callBudgetKind: "logical_lookups_not_origin_http_attempts";
  oddsRequested: false;
  oddsLogicalCalls: 0;
  leakageViolationCount: number;
  populationArtifact: string;
};
