/**
 * First plumbing microcollection shape.
 * Chosen from in-repo identifiers, not a live catalogue scan.
 */

export const MICROCOLLECTION_LEAGUE_ID = "39";
export const MICROCOLLECTION_LEAGUE_NAME = "Premier League";
export const MICROCOLLECTION_SEASON = "2024";
export const MICROCOLLECTION_CATEGORY = "mens" as const;
export const MICROCOLLECTION_TARGET_COUNT = 15;
/** Proven unpaged contract: one GET /fixtures?league&season. */
export const MICROCOLLECTION_FIXTURE_LIST_LOGICAL_CALLS = 1;
/**
 * Hard LOGICAL lookup ceiling (1 fixture-list + up to 15 odds = 16 planned).
 * This is not a ceiling on origin HTTP attempts: retries can exceed this.
 */
export const MICROCOLLECTION_LOGICAL_CALL_CEILING = 30;
/** @deprecated Use MICROCOLLECTION_LOGICAL_CALL_CEILING. Same numeric cap. */
export const MICROCOLLECTION_ORIGIN_CEILING = MICROCOLLECTION_LOGICAL_CALL_CEILING;
export const MICROCOLLECTION_LIVE_ENV = "APEX_CALIBRATION_LIVE";
export const MICROCOLLECTION_EXECUTE_FLAG = "--execute";
export const MICROCOLLECTION_SELECTION_RULE =
  "Eligible completed fixtures (FT/AET/PEN with countable goals), sorted by kickoff then fixtureId; skip the first 20%; take 15 evenly spaced indices including the last.";
export const MICROCOLLECTION_VERSION = "apex.calibration.microcollect.v1";
