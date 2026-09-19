/**
 * Historical probability-calibration pilot shape (Sprint 5B.4).
 * Odds are never requested. One unpaged league+season fixture list.
 */

export const PILOT_LEAGUE_ID = "39";
export const PILOT_LEAGUE_NAME = "Premier League";
export const PILOT_SEASON = "2024";
export const PILOT_CATEGORY = "mens" as const;
export const PILOT_TARGET_COUNT = 150;
export const PILOT_FIXTURE_LIST_LOGICAL_CALLS = 1;
export const PILOT_ODDS_LOGICAL_CALLS = 0;
/** Hard logical ceiling: one fixture-list lookup. Odds are forbidden. */
export const PILOT_LOGICAL_CALL_CEILING = 1;
export const PILOT_VERSION = "apex.calibration.pilot.v1.1";
export const PILOT_SELECTION_ALGORITHM = "stratified_even_spacing.v1";
export const PILOT_SELECTION_RULE =
  "Reconstruct every eligible completed match (FT/AET/PEN) in chronological order. Assign evidence = min(homePlayedBefore, awayPlayedBefore). Select ~150 rows by even spacing within buckets 0, 1-3, 4-9, 10+. Desired allocation is equal shares (remainder to 0 then 1-3). Short buckets take all available rows; leftover capacity is redistributed in bucket order without duplication. This is a methodology-coverage sample, not a frequency-weighted season sample.";
export const PILOT_EVIDENCE_BUCKETS = ["0", "1-3", "4-9", "10+"] as const;
