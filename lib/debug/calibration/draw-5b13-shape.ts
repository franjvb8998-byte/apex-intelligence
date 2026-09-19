/**
 * Sprint 5B.13 draw-channel residual forensics.
 * Debug-only. Not a production policy. Not a tuner. No search.
 */

export const DRAW_CHANNEL_VERSION = "apex.calibration.draw-channel.5b13.v1";

export const DRAW_PANELS = ["D0", "D1"] as const;
export type DrawPanelId = (typeof DRAW_PANELS)[number];

export const D1_NON_CANDIDATE_LABEL = "NON_CANDIDATE_CLEANER_INPUT_C7_G0";

export const DRAW_PROB_BUCKETS = [
  "0-2.5%",
  "2.5-5%",
  "5-7.5%",
  "7.5-10%",
  "10-12.5%",
  "12.5-15%",
  "15-17.5%",
  "17.5-20%",
  "20-22.5%",
  "22.5-25%",
  "25-30%",
  "30%+",
] as const;
export type DrawProbBucket = (typeof DRAW_PROB_BUCKETS)[number];

export const ELO_GAP_DRAW_BUCKETS = [
  "0-49",
  "50-99",
  "100-149",
  "150-199",
  "200-249",
  "250+",
] as const;
export type EloGapDrawBucket = (typeof ELO_GAP_DRAW_BUCKETS)[number];

export const LAMBDA_RATIO_DRAW_BUCKETS = [
  "1.00-1.49",
  "1.50-1.99",
  "2.00-2.99",
  "3.00-4.99",
  "5.00-7.99",
  "8.00-11.99",
  "12+",
] as const;
export type LambdaRatioDrawBucket = (typeof LAMBDA_RATIO_DRAW_BUCKETS)[number];

export const TOTAL_XG_DRAW_BUCKETS = [
  "<2.0",
  "2.0-2.49",
  "2.5-2.99",
  "3.0-3.49",
  "3.5-3.99",
  "4.0-4.99",
  "5.0+",
] as const;
export type TotalXgDrawBucket = (typeof TOTAL_XG_DRAW_BUCKETS)[number];

export const DRAW_SCORELINE_KEYS = [
  "0-0",
  "1-1",
  "2-2",
  "3-3",
  "4-4+",
  "other-equal",
] as const;
export type DrawScorelineKey = (typeof DRAW_SCORELINE_KEYS)[number];

/** Predeclared DC rhos only. Not a search. rho=0 is independent Poisson control. */
export const DECLARED_DC_RHOS = [0, -0.05, -0.1] as const;
export type DeclaredDcRho = (typeof DECLARED_DC_RHOS)[number];

/** Symmetric descriptive perturbations around production eloDrawBase. Not a search. */
export const DECLARED_DRAW_BASE_DELTAS = [-0.03, 0.03] as const;
export type DeclaredDrawBaseDelta = (typeof DECLARED_DRAW_BASE_DELTAS)[number];

/** Production 0.7 plus two diagnostics. Not a search. */
export const DECLARED_BLEND_WEIGHTS = [0.7, 0.5, 0.9] as const;
export type DeclaredBlendWeight = (typeof DECLARED_BLEND_WEIGHTS)[number];

/** Production 65 plus HA0 diagnostic. Not a search. */
export const DECLARED_HA_VALUES = [65, 0] as const;
export type DeclaredHaValue = (typeof DECLARED_HA_VALUES)[number];

export const DRAW_NAMED_TRACES = [
  { season: "2023", home: "Aston Villa", away: "Sheffield Utd", score: "1-1" },
  { season: "2024", home: "Chelsea", away: "Ipswich", score: "2-2" },
  { season: "2025", home: "Manchester City", away: "Nottingham Forest", score: "2-2" },
] as const;

export function drawPanelInputArm(panel: DrawPanelId): "C0" | "C7" {
  return panel === "D0" ? "C0" : "C7";
}

export function drawProbBucket(hybridDraw: number): DrawProbBucket {
  if (!Number.isFinite(hybridDraw) || hybridDraw < 0) {
    throw new Error(`Invalid hybrid draw ${hybridDraw}`);
  }
  if (hybridDraw < 0.025) return "0-2.5%";
  if (hybridDraw < 0.05) return "2.5-5%";
  if (hybridDraw < 0.075) return "5-7.5%";
  if (hybridDraw < 0.1) return "7.5-10%";
  if (hybridDraw < 0.125) return "10-12.5%";
  if (hybridDraw < 0.15) return "12.5-15%";
  if (hybridDraw < 0.175) return "15-17.5%";
  if (hybridDraw < 0.2) return "17.5-20%";
  if (hybridDraw < 0.225) return "20-22.5%";
  if (hybridDraw < 0.25) return "22.5-25%";
  if (hybridDraw < 0.3) return "25-30%";
  return "30%+";
}

export function eloGapDrawBucket(absGap: number): EloGapDrawBucket {
  if (!Number.isFinite(absGap) || absGap < 0) {
    throw new Error(`Invalid Elo gap ${absGap}`);
  }
  if (absGap < 50) return "0-49";
  if (absGap < 100) return "50-99";
  if (absGap < 150) return "100-149";
  if (absGap < 200) return "150-199";
  if (absGap < 250) return "200-249";
  return "250+";
}

export function lambdaRatioDrawBucket(ratio: number): LambdaRatioDrawBucket {
  if (!Number.isFinite(ratio) || ratio < 1) {
    throw new Error(`Invalid lambda ratio ${ratio}`);
  }
  if (ratio < 1.5) return "1.00-1.49";
  if (ratio < 2) return "1.50-1.99";
  if (ratio < 3) return "2.00-2.99";
  if (ratio < 5) return "3.00-4.99";
  if (ratio < 8) return "5.00-7.99";
  if (ratio < 12) return "8.00-11.99";
  return "12+";
}

export function totalXgDrawBucket(total: number): TotalXgDrawBucket {
  if (!Number.isFinite(total) || total < 0) {
    throw new Error(`Invalid total xG ${total}`);
  }
  if (total < 2) return "<2.0";
  if (total < 2.5) return "2.0-2.49";
  if (total < 3) return "2.5-2.99";
  if (total < 3.5) return "3.0-3.49";
  if (total < 4) return "3.5-3.99";
  if (total < 5) return "4.0-4.99";
  return "5.0+";
}

export function observedDrawScoreline(
  homeGoals: number,
  awayGoals: number,
): DrawScorelineKey | null {
  if (homeGoals !== awayGoals) return null;
  if (homeGoals === 0) return "0-0";
  if (homeGoals === 1) return "1-1";
  if (homeGoals === 2) return "2-2";
  if (homeGoals === 3) return "3-3";
  if (homeGoals >= 4) return "4-4+";
  return "other-equal";
}
