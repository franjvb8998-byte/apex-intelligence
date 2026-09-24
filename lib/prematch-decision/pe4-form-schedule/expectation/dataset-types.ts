/**
 * PE-4G.3 — Offline historical expectation dataset row schema.
 * Development/POC data only. Not production PE input.
 */

export const PE4_EXPECTATION_DATASET_SCHEMA_VERSION =
  "pe4.expectation.dataset.v1" as const;

export const PE4_EXPECTATION_DATASET_BUILDER_VERSION =
  "pe4.expectation.dataset.builder.v1" as const;

/** Same common baseline as PE-4G.1 (PRODUCTION_HOME_ELO_BASE). */
export const PE4_EXPECTATION_COMMON_BASELINE = 1580 as const;

export type Pe4ExpectationStrengthSource = "catalogue" | "base_prior";

export type Pe4ExpectationQualityKind =
  | "catalogue_catalogue"
  | "catalogue_base_prior"
  | "base_prior_catalogue"
  | "base_prior_base_prior"
  | "unavailable";

export type Pe4ExpectationActualOutcome = "HOME" | "DRAW" | "AWAY";

export type Pe4ExpectationDatasetRow = {
  schemaVersion: typeof PE4_EXPECTATION_DATASET_SCHEMA_VERSION;
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  homeCommonStrength: number;
  awayCommonStrength: number;
  /** homeCommonStrength - awayCommonStrength */
  strengthDifferentialHome: number;
  homeStrengthSource: Pe4ExpectationStrengthSource;
  awayStrengthSource: Pe4ExpectationStrengthSource;
  homePlayed: number;
  awayPlayed: number;
  qualityKind: Pe4ExpectationQualityKind;
  /** True when both sides are base_prior (D typically 0). */
  lowInformationBothBasePrior: boolean;
  actualHomeGoals: number;
  actualAwayGoals: number;
  actualOutcome: Pe4ExpectationActualOutcome;
  actualGoalDifferenceHome: number;
  /** Provenance of source reconstruction contract. */
  sourceReconstructionVersion: string;
  sourceSchemaVersion: string;
};

export type Pe4ExpectationDatasetSplitName =
  | "DEVELOPMENT"
  | "VALIDATION"
  | "HOLDOUT_RESERVED";

export type Pe4ExpectationSplitManifest = {
  name: Pe4ExpectationDatasetSplitName;
  /** All PE-4G.3 PL seasons are development/POC — not untouched promotion. */
  promotionEligible: false;
  firstKickoffUtc: string;
  lastKickoffUtc: string;
  rowCount: number;
  fixtureIdDigest: string;
  seasons: string[];
};

export type Pe4ExpectationDatasetManifest = {
  schemaVersion: typeof PE4_EXPECTATION_DATASET_SCHEMA_VERSION;
  builderVersion: typeof PE4_EXPECTATION_DATASET_BUILDER_VERSION;
  commonBaseline: typeof PE4_EXPECTATION_COMMON_BASELINE;
  datasetDigest: string;
  rowCount: number;
  rejectedCount: number;
  identicalDuplicateCount: number;
  conflictingDuplicateCount: number;
  qualityCounts: Record<Pe4ExpectationQualityKind, number>;
  outcomeCounts: Record<Pe4ExpectationActualOutcome, number>;
  seasonCounts: Record<string, number>;
  bothBasePriorCount: number;
  kickoffMinUtc: string | null;
  kickoffMaxUtc: string | null;
  sourceFiles: string[];
  splits: Pe4ExpectationSplitManifest[];
  notes: {
    competitionScope: "premier_league_39";
    temporalProvenance: "same_competition_season.kickoff_lt.v2";
    notProspectivePromotionData: true;
    noModelFitted: true;
    noBinsOptimized: true;
  };
};
