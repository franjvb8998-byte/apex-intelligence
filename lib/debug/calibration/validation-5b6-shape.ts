/**
 * Sprint 5B.6 multi-season holdout validation shape.
 * Frozen before any holdout is collected. Not a production policy.
 */

export const VALIDATION_LEAGUE_ID = "39";
export const VALIDATION_LEAGUE_NAME = "Premier League";
export const VALIDATION_CATEGORY = "mens" as const;
export const VALIDATION_HOLDOUT_SEASONS = ["2023", "2025"] as const;
export const VALIDATION_DEVELOPMENT_SEASON = "2024";
export const VALIDATION_VERSION = "apex.calibration.validation.5b6.v1";
export const VALIDATION_FIXTURE_LIST_LOGICAL_CALLS_PER_SEASON = 1;
export const VALIDATION_ODDS_LOGICAL_CALLS = 0;
export const VALIDATION_SEASON_COUNT = VALIDATION_HOLDOUT_SEASONS.length;
export const VALIDATION_LOGICAL_CALL_CEILING = VALIDATION_SEASON_COUNT;
export const VALIDATION_DATASET_KIND = "NATURAL FULL POPULATION";
export const VALIDATION_ROLE = "HOLDOUT";
export const DEVELOPMENT_ROLE = "DEVELOPMENT";

export type ValidationHoldoutSeason = (typeof VALIDATION_HOLDOUT_SEASONS)[number];

export const VALIDATION_PRIMARY_POLICY_ID = "current_catalogue" as const;

export const VALIDATION_PRIMARY_METRICS = [
  "logLoss",
  "brier",
  "ece",
  "homeBias",
  "drawBias",
  "awayBias",
  "countMaxOneXTwoGte90",
] as const;

export const VALIDATION_SECONDARY_METRICS = [
  "accuracy",
  "meanConfidence",
  "countMaxOneXTwoGte80",
  "countMaxOneXTwoGte95",
  "eloGap",
] as const;
