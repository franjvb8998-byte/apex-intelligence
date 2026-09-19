/**
 * Sprint 5B.9 Elo→xG / lambda-ratio geometry forensics shape.
 * Characterization only. Not a production policy. Not a tuner.
 */

export const XG_GEOMETRY_VERSION = "apex.calibration.xg.5b9.v1";

/** Synthetic raw Elo differences for the analytic geometry table. */
export const DECLARED_ELO_DIFF_GRID = [
  -400, -350, -300, -250, -200, -150, -100, -50, 0, 50, 100, 150, 200, 250, 300,
  350, 400,
] as const;

/** Gaps used only to characterize 10^(gap / S). Not a search. */
export const DECLARED_EXPONENT_GAPS = [50, 100, 150, 200, 250, 300, 350, 400] as const;

/** Optional debug eloGoalScale sensitivity. 400 is current production. */
export const DECLARED_ELO_GOAL_SCALE_GRID = [300, 400, 500, 600] as const;

export const PRODUCTION_ELO_GOAL_SCALE_CURRENT = 400;

export const LAMBDA_RATIO_BUCKETS = [
  "1.00-1.49",
  "1.50-1.99",
  "2.00-2.99",
  "3.00-4.99",
  "5.00-7.99",
  "8.00-11.99",
  "12.00+",
] as const;
export type LambdaRatioBucket = (typeof LAMBDA_RATIO_BUCKETS)[number];

export const CLAMP_COHORTS = [
  "NO_CLAMP",
  "HOME_MAX_CLAMP",
  "AWAY_MAX_CLAMP",
  "HOME_MIN_CLAMP",
  "AWAY_MIN_CLAMP",
  "MULTIPLE_CLAMP",
] as const;
export type ClampCohortId = (typeof CLAMP_COHORTS)[number];

export const GOAL_BASE_VARIANTS = ["G0", "G1"] as const;
export type GoalBaseVariantId = (typeof GOAL_BASE_VARIANTS)[number];
