/**
 * Sprint 5B.15 HIGH_EQUAL temporal robustness.
 * Debug-only. Not a production policy. Not a tuner. No search.
 */

export const TEMPORAL_ROBUSTNESS_VERSION = "apex.calibration.high-equal-temporal.5b15.v1";

export const TR_PANELS = ["D0", "D1"] as const;
export type TrPanelId = (typeof TR_PANELS)[number];

export const SEASON_N = 380;
export const HALF_SIZE = 190;
export const QUARTILE_SIZE = 95;

export const HALF_WINDOWS = ["H1", "H2"] as const;
export type HalfWindow = (typeof HALF_WINDOWS)[number];

export const QUARTILE_WINDOWS = ["Q1", "Q2", "Q3", "Q4"] as const;
export type QuartileWindow = (typeof QUARTILE_WINDOWS)[number];

export const TEMPORAL_WINDOWS = [...HALF_WINDOWS, ...QUARTILE_WINDOWS] as const;
export type TemporalWindow = (typeof TEMPORAL_WINDOWS)[number];

/** Descriptive robustness threshold only. Not a fitted cutoff. */
export const HIGH_EQUAL_OE_THRESHOLD = 1.1;

export const TR_BOOTSTRAP_SEED = 5152026;
export const TR_BOOTSTRAP_RESAMPLES = 2000;

export type ChronologicalItem = {
  kickoff: string;
  fixtureId: string;
};

export function compareChronological(left: ChronologicalItem, right: ChronologicalItem): number {
  const kick = left.kickoff.localeCompare(right.kickoff);
  if (kick !== 0) return kick;
  return left.fixtureId.localeCompare(right.fixtureId);
}

export function sortChronological<T extends ChronologicalItem>(items: readonly T[]): T[] {
  return [...items].sort(compareChronological);
}

export function requireSeasonLength(n: number, label: string): void {
  if (n !== SEASON_N) {
    throw new Error(`${label} must have exactly ${SEASON_N} fixtures, received ${n}`);
  }
}

export function splitHalves<T>(sorted: readonly T[]): { H1: T[]; H2: T[] } {
  if (sorted.length !== SEASON_N) {
    throw new Error(`Halves require ${SEASON_N} fixtures, received ${sorted.length}`);
  }
  return {
    H1: sorted.slice(0, HALF_SIZE),
    H2: sorted.slice(HALF_SIZE, SEASON_N),
  };
}

export function splitQuartiles<T>(sorted: readonly T[]): Record<QuartileWindow, T[]> {
  if (sorted.length !== SEASON_N) {
    throw new Error(`Quartiles require ${SEASON_N} fixtures, received ${sorted.length}`);
  }
  return {
    Q1: sorted.slice(0, QUARTILE_SIZE),
    Q2: sorted.slice(QUARTILE_SIZE, HALF_SIZE),
    Q3: sorted.slice(HALF_SIZE, HALF_SIZE + QUARTILE_SIZE),
    Q4: sorted.slice(HALF_SIZE + QUARTILE_SIZE, SEASON_N),
  };
}

export function isHalfWindow(window: string): window is HalfWindow {
  return window === "H1" || window === "H2";
}

export function isQuartileWindow(window: string): window is QuartileWindow {
  return window === "Q1" || window === "Q2" || window === "Q3" || window === "Q4";
}
