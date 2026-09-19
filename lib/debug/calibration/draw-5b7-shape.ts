/**
 * Sprint 5B.7 draw-probability forensics shape.
 * Characterization only. Not a production policy. Not a tuner.
 */

export const DRAW_FORENSICS_VERSION = "apex.calibration.draw.5b7.v1";
export const DRAW_FORENSICS_PRIMARY_POLICY_ID = "current_catalogue" as const;
export const DRAW_FORENSICS_CONFIG_IDS = ["V0", "V5"] as const;
export type DrawForensicsConfigId = (typeof DRAW_FORENSICS_CONFIG_IDS)[number];

export const DRAW_FORENSICS_SEASONS = ["2023", "2024", "2025"] as const;
export type DrawForensicsSeason = (typeof DRAW_FORENSICS_SEASONS)[number];

export const DRAW_FORENSICS_HOLDOUT_SEASONS = ["2023", "2025"] as const;
export const DRAW_FORENSICS_DEVELOPMENT_SEASON = "2024";

export const DRAW_FORENSICS_ARTIFACTS = {
  "2023": {
    season: "2023",
    role: "HOLDOUT" as const,
    metaPath:
      "data/calibration/validation-5b6-pl-2023-2026-09-19T06-15-50-956Z.meta.json",
  },
  "2024": {
    season: "2024",
    role: "DEVELOPMENT" as const,
    populationPath:
      "data/calibration/pilot-2026-09-19T05-52-08-473Z.population.jsonl",
    metaPath: "data/calibration/pilot-2026-09-19T05-52-08-473Z.meta.json",
  },
  "2025": {
    season: "2025",
    role: "HOLDOUT" as const,
    metaPath:
      "data/calibration/validation-5b6-pl-2025-2026-09-19T06-15-51-490Z.meta.json",
  },
} as const;

/** Declared sensitivity values excluding the frozen current (deduped at runtime). */
export const DECLARED_ELO_DRAW_BASE_GRID = [0.15, 0.2, 0.3, 0.35] as const;

export const ELO_GAP_BUCKETS = [
  "0-49",
  "50-99",
  "100-149",
  "150-199",
  "200-249",
  "250+",
] as const;
export type EloGapBucket = (typeof ELO_GAP_BUCKETS)[number];

export const XG_DIFF_BUCKETS = [
  "<0.25",
  "0.25-0.49",
  "0.50-0.99",
  "1.00-1.49",
  "1.50+",
] as const;
export type XgDiffBucket = (typeof XG_DIFF_BUCKETS)[number];

export const TOTAL_XG_BUCKETS = [
  "<2.0",
  "2.0-2.49",
  "2.5-2.99",
  "3.0-3.49",
  "3.5+",
] as const;
export type TotalXgBucket = (typeof TOTAL_XG_BUCKETS)[number];

export const SCORELINE_GROUPS = [
  "0-0",
  "1-1",
  "2-2",
  "3-3",
  "4-4+",
  "other_draw",
] as const;
export type ScorelineGroup = (typeof SCORELINE_GROUPS)[number];

export const CONFIDENCE_BANDS = ["low", "medium", "high"] as const;
export type ForensicConfidenceBand = (typeof CONFIDENCE_BANDS)[number];
