/**
 * Sprint 5B.8 low-score dependence / Dixon-Coles forensics shape.
 * Characterization only. Not a production policy. Not a tuner.
 */

export const DC_FORENSICS_VERSION = "apex.calibration.dc.5b8.v1";

/** Predeclared rho sensitivity. Not a search. */
export const DECLARED_DIXON_COLES_RHO_GRID = [
  -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2,
] as const;

export const PRODUCTION_LAMBDA_CLAMP_MIN = 0.05;
export const PRODUCTION_LAMBDA_CLAMP_MAX = 6;

export const OBSERVED_SCORELINE_KEYS = [
  "0-0",
  "1-0",
  "0-1",
  "1-1",
  "2-0",
  "0-2",
  "2-1",
  "1-2",
  "2-2",
  "3-3+",
  "other",
] as const;
export type ObservedScorelineKey = (typeof OBSERVED_SCORELINE_KEYS)[number];

export const DRAW_SCORELINE_PARTS = [
  "0-0",
  "1-1",
  "2-2",
  "3-3",
  "4-4+",
] as const;
export type DrawScorelinePart = (typeof DRAW_SCORELINE_PARTS)[number];
