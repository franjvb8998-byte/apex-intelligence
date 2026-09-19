/**
 * Sprint 5B.10 catalogue Elo input / gap-generation forensics shape.
 * Characterization only. Not a production policy. Not a tuner.
 */

export const CATALOGUE_INPUT_VERSION = "apex.calibration.catalogue.5b10.v1";

export const CATALOGUE_CONSTANT_OFFSET = -80;
export const CATALOGUE_WIN_RATE_COEFFICIENT = 220;
export const CATALOGUE_GD_COEFFICIENT = 2.5;
export const CATALOGUE_GD_CLAMP = 30;

export const PLAYED_BEFORE_BUCKETS = [
  "0",
  "1",
  "2",
  "3",
  "4-5",
  "6-9",
  "10-14",
  "15-19",
  "20-29",
  "30+",
] as const;
export type PlayedBeforeBucket = (typeof PLAYED_BEFORE_BUCKETS)[number];

export const CATALOGUE_ELO_GAP_BUCKETS = [
  "0-49",
  "50-99",
  "100-149",
  "150-199",
  "200-249",
  "250-299",
  "300+",
] as const;
export type CatalogueEloGapBucket = (typeof CATALOGUE_ELO_GAP_BUCKETS)[number];

export const SPARSE_WIN_RATE_CASES = [
  [0, 1],
  [1, 1],
  [0, 2],
  [1, 2],
  [2, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [3, 3],
] as const;

export const MATURITY_PLAYED_MARKS = [0, 1, 2, 3, 5, 10, 15, 20, 25, 30] as const;

export const R0_HOME_BASE = 1580;
export const R0_AWAY_BASE = 1520;
export const R1_EQUAL_BASE = 1550;
