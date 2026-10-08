/**
 * PE-4I.17 — Deterministic DEV-target eligibility for regulation-outcome research.
 * Default: AET/PEN excluded as ambiguous unless proven safe (not proven here).
 */

import { parseKickoffUtcMillis } from "@/lib/debug/calibration/pe4-acquisition/temporal";
import type { Pe4I15HistoricalMatchLedgerRow } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import {
  classifyHoldoutForResearch,
  isCalendar2025Kickoff,
} from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import { classifyRegulationStatus } from "@/lib/debug/calibration/pe4-as-of-t-features/aet-pen-contract";

export const PE4I17_TARGET_EXCLUSION_REASONS = [
  "missing_fixture_id",
  "malformed_kickoff",
  "malformed_teams",
  "calendar_2025_holdout",
  "provider_season_2025_forbidden",
  "unknown_kickoff_holdout",
  "cancelled",
  "aet_pen_ambiguous_regulation_default_exclude",
  "unsupported_completed_status",
  "incomplete_outcome_goals",
] as const;

export type Pe4I17TargetExclusionReason =
  (typeof PE4I17_TARGET_EXCLUSION_REASONS)[number];

export type Pe4I17TargetEligibilityDecision =
  | {
      eligible: true;
      fixtureId: string;
      reason: null;
    }
  | {
      eligible: false;
      fixtureId: string;
      reason: Pe4I17TargetExclusionReason;
      detail?: string;
    };

export type Pe4I17TargetEligibilityReport = {
  inputCount: number;
  eligibleCount: number;
  excludedCount: number;
  exclusionCounts: Record<Pe4I17TargetExclusionReason, number>;
  eligibleFixtureIds: string[];
  decisions: Pe4I17TargetEligibilityDecision[];
};

function emptyExclusionCounts(): Record<Pe4I17TargetExclusionReason, number> {
  const out = {} as Record<Pe4I17TargetExclusionReason, number>;
  for (const r of PE4I17_TARGET_EXCLUSION_REASONS) out[r] = 0;
  return out;
}

function isCancelledStatus(status: string): boolean {
  const u = (status ?? "").trim().toUpperCase();
  // Provider emits CANC and Canc; both normalize to CANC.
  return u === "CANC" || u === "CANCELLED";
}

/**
 * Classify one ledger row for DEV regulation-outcome research targets.
 * Fail-closed: AET/PEN default EXCLUDE (ambiguous; not proven safe).
 */
export function classifyDevTargetEligibility(
  row: Pe4I15HistoricalMatchLedgerRow,
): Pe4I17TargetEligibilityDecision {
  const fixtureId = row.fixtureId?.trim() ?? "";
  if (!fixtureId) {
    return { eligible: false, fixtureId: "(missing)", reason: "missing_fixture_id" };
  }

  if (parseKickoffUtcMillis(row.kickoffUtc) == null) {
    return {
      eligible: false,
      fixtureId,
      reason: "malformed_kickoff",
      detail: row.kickoffUtc,
    };
  }

  const home = row.homeTeamId?.trim() ?? "";
  const away = row.awayTeamId?.trim() ?? "";
  if (!home || !away || home === away) {
    return { eligible: false, fixtureId, reason: "malformed_teams" };
  }

  const holdout = classifyHoldoutForResearch({
    kickoffUtc: row.kickoffUtc,
    providerSeasonId: row.providerSeason,
  });
  if (holdout === "calendar_2025_sealed_outcome" || isCalendar2025Kickoff(row.kickoffUtc)) {
    return { eligible: false, fixtureId, reason: "calendar_2025_holdout" };
  }
  if (holdout === "provider_season_2025_forbidden") {
    return {
      eligible: false,
      fixtureId,
      reason: "provider_season_2025_forbidden",
    };
  }
  if (holdout === "unknown_kickoff") {
    return { eligible: false, fixtureId, reason: "unknown_kickoff_holdout" };
  }

  if (isCancelledStatus(row.status)) {
    return {
      eligible: false,
      fixtureId,
      reason: "cancelled",
      detail: row.status,
    };
  }

  const reg = classifyRegulationStatus(row.status);
  if (reg === "AET_PEN_AMBIGUOUS" || row.regulationAmbiguity) {
    return {
      eligible: false,
      fixtureId,
      reason: "aet_pen_ambiguous_regulation_default_exclude",
      detail: row.status,
    };
  }

  if (reg !== "FT_REGULATION") {
    return {
      eligible: false,
      fixtureId,
      reason: "unsupported_completed_status",
      detail: row.status,
    };
  }

  if (
    row.home.goals.presence !== "present" ||
    row.away.goals.presence !== "present" ||
    row.home.goals.value == null ||
    row.away.goals.value == null
  ) {
    return {
      eligible: false,
      fixtureId,
      reason: "incomplete_outcome_goals",
    };
  }

  return { eligible: true, fixtureId, reason: null };
}

/**
 * Deterministic DEV-target selection: eligible rows sorted by kickoff, fixtureId.
 */
export function selectDevEligibleTargets(
  ledger: readonly Pe4I15HistoricalMatchLedgerRow[],
): Pe4I17TargetEligibilityReport {
  const exclusionCounts = emptyExclusionCounts();
  const decisions: Pe4I17TargetEligibilityDecision[] = [];
  const eligible: Pe4I15HistoricalMatchLedgerRow[] = [];

  for (const row of ledger) {
    const d = classifyDevTargetEligibility(row);
    decisions.push(d);
    if (d.eligible) {
      eligible.push(row);
    } else {
      exclusionCounts[d.reason] += 1;
    }
  }

  eligible.sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.fixtureId.localeCompare(b.fixtureId);
  });

  return {
    inputCount: ledger.length,
    eligibleCount: eligible.length,
    excludedCount: ledger.length - eligible.length,
    exclusionCounts,
    eligibleFixtureIds: eligible.map((r) => r.fixtureId),
    decisions,
  };
}

export function eligibleTargetRows(
  ledger: readonly Pe4I15HistoricalMatchLedgerRow[],
): Pe4I15HistoricalMatchLedgerRow[] {
  const report = selectDevEligibleTargets(ledger);
  const idSet = new Set(report.eligibleFixtureIds);
  return ledger
    .filter((r) => idSet.has(r.fixtureId))
    .sort((a, b) => {
      const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
      if (k !== 0) return k;
      return a.fixtureId.localeCompare(b.fixtureId);
    });
}
