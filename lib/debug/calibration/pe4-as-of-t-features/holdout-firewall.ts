/**
 * PE-4I.15 — Holdout firewall for calendar-2025 outcomes.
 * Reusable guards for DEV fitting / feature selection / calibration /
 * comparison exclusion. Does not unseal 2025.
 */

import {
  calendarKickoffYear,
  isResearchHoldoutOutcomeEvidence,
} from "@/lib/debug/calibration/pe4-acquisition/holdout";
import { PE4I2_HOLDOUT_SEASON } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import {
  pe4I15Err,
  pe4I15Ok,
  type Pe4I15Result,
} from "@/lib/debug/calibration/pe4-as-of-t-features/fail-closed";

export type Pe4I15HoldoutClassification =
  | "dev_or_conf_eligible"
  | "calendar_2025_sealed_outcome"
  | "provider_season_2025_forbidden"
  | "unknown_kickoff";

export type Pe4I15ResearchPool =
  | "DEV_FITTING"
  | "FEATURE_SELECTION"
  | "CALIBRATION"
  | "COMPARISON"
  | "LEDGER_STORAGE";

/**
 * Calendar-2025 kickoffs are sealed for outcome-consuming research pools.
 * LEDGER_STORAGE may retain raw rows (acquisition evidence) but must not
 * feed fitting / selection / calibration / comparison.
 */
export const PE4I15_POOLS_EXCLUDING_CALENDAR_2025_OUTCOMES: readonly Pe4I15ResearchPool[] =
  [
    "DEV_FITTING",
    "FEATURE_SELECTION",
    "CALIBRATION",
    "COMPARISON",
  ] as const;

export function isCalendar2025Kickoff(kickoffUtc: string): boolean {
  return calendarKickoffYear(kickoffUtc) === 2025;
}

export function classifyHoldoutForResearch(input: {
  kickoffUtc: string;
  providerSeasonId?: string;
}): Pe4I15HoldoutClassification {
  if (input.providerSeasonId === PE4I2_HOLDOUT_SEASON) {
    return "provider_season_2025_forbidden";
  }
  const year = calendarKickoffYear(input.kickoffUtc);
  if (year == null) return "unknown_kickoff";
  if (year === 2025) return "calendar_2025_sealed_outcome";
  return "dev_or_conf_eligible";
}

/**
 * Explicit guard: calendar-2025 outcomes must not enter DEV/CONF research pools.
 * Complements isResearchHoldoutOutcomeEvidence (always false — never auto-promotes).
 */
export function assertCalendar2025OutcomeExcludedFromResearchPools(input: {
  kickoffUtc: string;
  providerSeasonId?: string;
  pool?: Pe4I15ResearchPool;
}): Pe4I15Result<true> {
  const pool = input.pool ?? "DEV_FITTING";
  if (input.providerSeasonId === PE4I2_HOLDOUT_SEASON) {
    return pe4I15Err(
      "provider_season_2025_forbidden",
      `pool=${pool}`,
    );
  }
  if (
    PE4I15_POOLS_EXCLUDING_CALENDAR_2025_OUTCOMES.includes(pool) &&
    isCalendar2025Kickoff(input.kickoffUtc)
  ) {
    return pe4I15Err(
      "calendar_2025_holdout_outcome_excluded",
      `pool=${pool}`,
    );
  }
  return pe4I15Ok(true);
}

/**
 * Whether a row may contribute outcome labels / labels-dependent features
 * to the named research pool. Storage-only always allowed structurally
 * (callers still apply temporal filters).
 */
export function mayUseOutcomeInResearchPool(input: {
  kickoffUtc: string;
  providerSeasonId?: string;
  pool: Pe4I15ResearchPool;
}): boolean {
  if (input.pool === "LEDGER_STORAGE") return true;
  return assertCalendar2025OutcomeExcludedFromResearchPools(input).ok;
}

/**
 * Pin: research holdout outcome evidence is never auto-promoted from
 * calendar year alone (PE-4I.4 sealed behavior).
 */
export function researchHoldoutOutcomeEvidenceIsSealed(input: {
  providerSeasonId: string;
  kickoffUtc: string;
}): true {
  // Always false ⇒ sealed; no authorized holdout protocol in PE-4I.15.
  void isResearchHoldoutOutcomeEvidence(input);
  return true;
}

export function filterOutCalendar2025Outcomes<
  T extends { kickoffUtc: string; providerSeasonId?: string },
>(
  rows: readonly T[],
  pool: Pe4I15ResearchPool = "DEV_FITTING",
): T[] {
  return rows.filter((r) =>
    mayUseOutcomeInResearchPool({
      kickoffUtc: r.kickoffUtc,
      providerSeasonId: r.providerSeasonId,
      pool,
    }),
  );
}
