/**
 * Sprint 5B.14 higher-score draw dependence forensics.
 * Debug-only. Not a production policy. Not a tuner. No search.
 */

export const HIGHER_SCORE_DRAW_VERSION = "apex.calibration.higher-score-draw.5b14.v1";

export const HS_PANELS = ["D0", "D1"] as const;
export type HsPanelId = (typeof HS_PANELS)[number];

export const HS_D1_NON_CANDIDATE_LABEL = "NON_CANDIDATE_CLEANER_INPUT_C7_G0";

export const EQUAL_SCORE_KEYS = [
  "0-0",
  "1-1",
  "2-2",
  "3-3",
  "4-4",
  "5-5+",
] as const;
export type EqualScoreKey = (typeof EQUAL_SCORE_KEYS)[number];

export const NON_DRAW_SCORE_GROUPS = [
  "1-0",
  "0-1",
  "2-0",
  "0-2",
  "2-1",
  "1-2",
  "other-unequal",
] as const;
export type NonDrawScoreGroup = (typeof NON_DRAW_SCORE_GROUPS)[number];

export const DRAW_RESIDUAL_PARTS = [
  "0-0",
  "1-1",
  "2-2",
  "3-3",
  "4-4+",
] as const;
export type DrawResidualPart = (typeof DRAW_RESIDUAL_PARTS)[number];

export const TWO_TWO_RATIO_BUCKETS = [
  "1-1.49",
  "1.5-1.99",
  "2-2.99",
  "3-4.99",
  "5+",
] as const;
export type TwoTwoRatioBucket = (typeof TWO_TWO_RATIO_BUCKETS)[number];

export const TWO_TWO_XG_BUCKETS = [
  "<2.5",
  "2.5-2.99",
  "3-3.49",
  "3.5-3.99",
  "4-4.99",
  "5+",
] as const;
export type TwoTwoXgBucket = (typeof TWO_TWO_XG_BUCKETS)[number];

export const ACTUAL_TOTAL_BUCKETS = ["0-1", "2", "3", "4", "5", "6+"] as const;
export type ActualTotalBucket = (typeof ACTUAL_TOTAL_BUCKETS)[number];

/** Predeclared shared-goal intensities. Not a search. λ3=0 is independent Poisson. */
export const DECLARED_LAMBDA3 = [0, 0.05, 0.1, 0.2] as const;
export type DeclaredLambda3 = (typeof DECLARED_LAMBDA3)[number];

export const BIVARIATE_EPSILON = 1e-9;

export const BOOTSTRAP_SEED = 5142026;
export const BOOTSTRAP_RESAMPLES = 2000;

export const HS_NAMED_TRACES = [
  { season: "2023", home: "Aston Villa", away: "Sheffield Utd", score: "1-1" },
  { season: "2024", home: "Chelsea", away: "Ipswich", score: "2-2" },
  { season: "2025", home: "Manchester City", away: "Nottingham Forest", score: "2-2" },
] as const;

export const RESIDUAL_SHARE_MIN_ABS = 1;

export function twoTwoRatioBucket(ratio: number): TwoTwoRatioBucket {
  if (!Number.isFinite(ratio) || ratio < 1) {
    throw new Error(`Invalid lambda ratio ${ratio}`);
  }
  if (ratio < 1.5) return "1-1.49";
  if (ratio < 2) return "1.5-1.99";
  if (ratio < 3) return "2-2.99";
  if (ratio < 5) return "3-4.99";
  return "5+";
}

export function twoTwoXgBucket(total: number): TwoTwoXgBucket {
  if (!Number.isFinite(total) || total < 0) {
    throw new Error(`Invalid total xG ${total}`);
  }
  if (total < 2.5) return "<2.5";
  if (total < 3) return "2.5-2.99";
  if (total < 3.5) return "3-3.49";
  if (total < 4) return "3.5-3.99";
  if (total < 5) return "4-4.99";
  return "5+";
}

export function actualTotalBucket(total: number): ActualTotalBucket {
  if (!Number.isInteger(total) || total < 0) {
    throw new Error(`Invalid actual total ${total}`);
  }
  if (total <= 1) return "0-1";
  if (total === 2) return "2";
  if (total === 3) return "3";
  if (total === 4) return "4";
  if (total === 5) return "5";
  return "6+";
}

export function equalScoreKey(homeGoals: number, awayGoals: number): EqualScoreKey | null {
  if (homeGoals !== awayGoals) return null;
  if (homeGoals === 0) return "0-0";
  if (homeGoals === 1) return "1-1";
  if (homeGoals === 2) return "2-2";
  if (homeGoals === 3) return "3-3";
  if (homeGoals === 4) return "4-4";
  return "5-5+";
}

export function nonDrawScoreGroup(homeGoals: number, awayGoals: number): NonDrawScoreGroup | null {
  if (homeGoals === awayGoals) return null;
  const key = `${homeGoals}-${awayGoals}`;
  if (key === "1-0" || key === "0-1" || key === "2-0" || key === "0-2" || key === "2-1" || key === "1-2") {
    return key;
  }
  return "other-unequal";
}

export function isLowEqual(homeGoals: number, awayGoals: number): boolean {
  return homeGoals === awayGoals && (homeGoals === 0 || homeGoals === 1);
}

export function isHighEqual(homeGoals: number, awayGoals: number): boolean {
  return homeGoals === awayGoals && homeGoals >= 2;
}

export function drawResidualPart(homeGoals: number, awayGoals: number): DrawResidualPart | null {
  if (homeGoals !== awayGoals) return null;
  if (homeGoals === 0) return "0-0";
  if (homeGoals === 1) return "1-1";
  if (homeGoals === 2) return "2-2";
  if (homeGoals === 3) return "3-3";
  return "4-4+";
}
