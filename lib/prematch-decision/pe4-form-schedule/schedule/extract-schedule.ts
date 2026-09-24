/**
 * PE-4F — Extract congestion / previous-match evidence from a normalized
 * team schedule. Pure / offline. Does not invent multi-season rest.
 */

import { isCompletedPrematchEvidenceStatus } from "@/lib/match-center/prematch-strength/completed-status";
import {
  isEligiblePriorKickoff,
  parseKickoffUtcMillis,
} from "@/lib/match-center/prematch-strength/reconstruct-evidence";
import { digestPe4CrossCompScheduleSide } from "@/lib/prematch-decision/pe4-form-schedule/schedule/digest";
import { pe4LoadClassCountsTowardSemanticSchedule } from "@/lib/prematch-decision/pe4-form-schedule/schedule/competition-policy";
import type {
  Pe4CrossCompScheduleSideEvidence,
  Pe4TeamScheduleAcquisitionScope,
  Pe4TeamScheduleFixture,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/types";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const CONGESTION_WINDOW_DAYS = 28;

export type ExtractPe4CrossCompScheduleSideInput = {
  teamId: string;
  vendorTeamId: string;
  providerSeason: string;
  acquisitionScope: Pe4TeamScheduleAcquisitionScope;
  requestedFromDate: string | null;
  requestedToDate: string | null;
  providerEnvelopeComplete: boolean;
  fixtures: readonly Pe4TeamScheduleFixture[];
  targetKickoffUtc: string;
  competitionScopedRestHoursSnapshot: number | null;
  competitionScopedCongestion28dSnapshot: number | null;
};

function utcCalendarDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function pe4CongestionWindowBounds(targetKickoffUtc: string): {
  fromUtc: string;
  toExclusiveUtc: string;
  fromMs: number;
  toExclusiveMs: number;
} | null {
  const targetMs = parseKickoffUtcMillis(targetKickoffUtc);
  if (targetMs == null) return null;
  const fromMs = targetMs - CONGESTION_WINDOW_DAYS * MS_PER_DAY;
  return {
    fromUtc: new Date(fromMs).toISOString(),
    toExclusiveUtc: targetKickoffUtc,
    fromMs,
    toExclusiveMs: targetMs,
  };
}

/**
 * True when calendar from/to fully covers [T-28d, T) for provider queries.
 * toDate must include the calendar day of T (fixtures earlier the same day).
 * fromDate must be on or before the calendar day of T-28d.
 */
export function requestedWindowCoversCongestionInterval(input: {
  fromDate: string;
  toDate: string;
  targetKickoffUtc: string;
}): boolean {
  const bounds = pe4CongestionWindowBounds(input.targetKickoffUtc);
  if (bounds == null) return false;
  const needFrom = utcCalendarDate(bounds.fromMs);
  const needTo = utcCalendarDate(bounds.toExclusiveMs);
  return input.fromDate <= needFrom && input.toDate >= needTo;
}

function compareFixtures(
  a: Pe4TeamScheduleFixture,
  b: Pe4TeamScheduleFixture,
): number {
  const kickoff = a.kickoffUtc.localeCompare(b.kickoffUtc);
  if (kickoff !== 0) return kickoff;
  return a.fixtureId.localeCompare(b.fixtureId);
}

function isEligibleCompletedPrior(
  row: Pe4TeamScheduleFixture,
  targetKickoffUtc: string,
): boolean {
  if (!isEligiblePriorKickoff(row.kickoffUtc, targetKickoffUtc)) return false;
  return isCompletedPrematchEvidenceStatus(row.status);
}

function inCongestionWindow(
  row: Pe4TeamScheduleFixture,
  fromMs: number,
  toExclusiveMs: number,
): boolean {
  const ms = parseKickoffUtcMillis(row.kickoffUtc);
  if (ms == null) return false;
  return ms >= fromMs && ms < toExclusiveMs;
}

function restHours(
  previousKickoffUtc: string | null,
  targetKickoffUtc: string,
): number | null {
  if (previousKickoffUtc == null) return null;
  const prev = parseKickoffUtcMillis(previousKickoffUtc);
  const target = parseKickoffUtcMillis(targetKickoffUtc);
  if (prev == null || target == null) return null;
  return (target - prev) / MS_PER_HOUR;
}

/**
 * Build side-level cross-competition schedule evidence from a normalized list.
 */
export function extractPe4CrossCompScheduleSide(
  input: ExtractPe4CrossCompScheduleSideInput,
): Pe4CrossCompScheduleSideEvidence {
  const bounds = pe4CongestionWindowBounds(input.targetKickoffUtc);
  const competitionIdsRepresented = [
    ...new Set(
      input.fixtures
        .map((f) => f.competitionId)
        .filter((id): id is string => id != null),
    ),
  ].sort();
  const normalizedFixtureIds = [...input.fixtures.map((f) => f.fixtureId)].sort();

  const failPartial = (
    reason: string,
    extras?: Partial<Pe4CrossCompScheduleSideEvidence>,
  ): Pe4CrossCompScheduleSideEvidence => {
    const base = {
      teamId: input.teamId,
      vendorTeamId: input.vendorTeamId,
      providerSeason: input.providerSeason,
      acquisitionScope: input.acquisitionScope,
      requestedFromDate: input.requestedFromDate,
      requestedToDate: input.requestedToDate,
      providerEnvelopeComplete: input.providerEnvelopeComplete,
      congestionWindowComplete: false,
      previousMatchComplete: false,
      crossCompetitionBlind: true,
      congestionWindowFromUtc: bounds?.fromUtc ?? "",
      congestionWindowToExclusiveUtc: bounds?.toExclusiveUtc ?? input.targetKickoffUtc,
      congestionFixtureIds: [] as string[],
      congestionMatchCount: 0,
      previousCompletedKickoffUtc: null as string | null,
      restHoursSincePreviousCompleted: null as number | null,
      competitionIdsRepresented,
      normalizedFixtureIds,
      semanticStatus: "PARTIAL" as const,
      semanticReason: reason,
      semanticScheduleComplete: false,
      competitionScopedRestHoursSnapshot:
        input.competitionScopedRestHoursSnapshot,
      competitionScopedCongestion28dSnapshot:
        input.competitionScopedCongestion28dSnapshot,
      ...extras,
    };
    return {
      ...base,
      scheduleEvidenceDigest: digestPe4CrossCompScheduleSide(base),
    };
  };

  if (!input.providerEnvelopeComplete) {
    return failPartial("provider_envelope_incomplete", {
      semanticStatus: "UNAVAILABLE",
    });
  }
  if (bounds == null) {
    return failPartial("invalid_target_kickoff", {
      semanticStatus: "UNAVAILABLE",
    });
  }

  const ordered = [...input.fixtures].sort(compareFixtures);
  const eligibleCompleted = ordered.filter((row) =>
    isEligibleCompletedPrior(row, input.targetKickoffUtc),
  );

  // Congestion: only load classes that count; unknown rows in window → incomplete.
  const inWindow = eligibleCompleted.filter((row) =>
    inCongestionWindow(row, bounds.fromMs, bounds.toExclusiveMs),
  );
  const unknownInWindow = inWindow.filter(
    (row) => !pe4LoadClassCountsTowardSemanticSchedule(row.loadClass),
  );
  const countableInWindow = inWindow.filter((row) =>
    pe4LoadClassCountsTowardSemanticSchedule(row.loadClass),
  );

  let windowCoverageOk = false;
  if (input.acquisitionScope === "team_season") {
    // Full season list covers any in-season sub-window when envelope complete.
    windowCoverageOk = true;
  } else if (
    input.requestedFromDate != null &&
    input.requestedToDate != null
  ) {
    windowCoverageOk = requestedWindowCoversCongestionInterval({
      fromDate: input.requestedFromDate,
      toDate: input.requestedToDate,
      targetKickoffUtc: input.targetKickoffUtc,
    });
  }

  const congestionFixtureIds = countableInWindow.map((r) => r.fixtureId);
  const unresolvedLoadPolicy = unknownInWindow.length > 0;
  const congestionWindowComplete =
    windowCoverageOk && !unresolvedLoadPolicy;

  // Previous match: countable completed only; unknown between prev and T → incomplete.
  const countableCompleted = eligibleCompleted.filter((row) =>
    pe4LoadClassCountsTowardSemanticSchedule(row.loadClass),
  );
  const previous =
    countableCompleted.length === 0
      ? null
      : countableCompleted[countableCompleted.length - 1]!;

  let previousMatchComplete = false;
  let previousCompletedKickoffUtc: string | null = null;
  let restHoursSincePreviousCompleted: number | null = null;

  if (previous == null) {
    // No prior in this provider season — season-boundary uncertainty.
    previousMatchComplete = false;
  } else {
    previousCompletedKickoffUtc = previous.kickoffUtc;
    const unknownsAfterPrevious = eligibleCompleted.filter((row) => {
      if (pe4LoadClassCountsTowardSemanticSchedule(row.loadClass)) return false;
      const ms = parseKickoffUtcMillis(row.kickoffUtc);
      const prevMs = parseKickoffUtcMillis(previous.kickoffUtc);
      if (ms == null || prevMs == null) return false;
      return ms > prevMs && ms < bounds.toExclusiveMs;
    });
    if (unknownsAfterPrevious.length > 0) {
      previousMatchComplete = false;
      restHoursSincePreviousCompleted = null;
    } else {
      previousMatchComplete = true;
      restHoursSincePreviousCompleted = restHours(
        previousCompletedKickoffUtc,
        input.targetKickoffUtc,
      );
    }
  }

  // crossCompetitionBlind false only when congestion is semantically complete.
  const crossCompetitionBlind = !congestionWindowComplete;

  let semanticStatus: "USED" | "PARTIAL" | "UNAVAILABLE" = "PARTIAL";
  let semanticReason: string | null = null;
  if (congestionWindowComplete && previousMatchComplete) {
    semanticStatus = "USED";
    semanticReason = null;
  } else if (!windowCoverageOk) {
    semanticReason = "incomplete_requested_window";
  } else if (unresolvedLoadPolicy) {
    semanticReason = "unresolved_competition_load_policy";
  } else if (!previousMatchComplete) {
    semanticReason =
      previous == null
        ? "no_previous_match_in_season"
        : "season_boundary_or_load_uncertainty";
  } else {
    semanticReason = "semantic_schedule_partial";
  }

  const semanticScheduleComplete =
    congestionWindowComplete && previousMatchComplete;

  const base = {
    teamId: input.teamId,
    vendorTeamId: input.vendorTeamId,
    providerSeason: input.providerSeason,
    acquisitionScope: input.acquisitionScope,
    requestedFromDate: input.requestedFromDate,
    requestedToDate: input.requestedToDate,
    providerEnvelopeComplete: true,
    congestionWindowComplete,
    previousMatchComplete,
    crossCompetitionBlind,
    congestionWindowFromUtc: bounds.fromUtc,
    congestionWindowToExclusiveUtc: bounds.toExclusiveUtc,
    congestionFixtureIds,
    congestionMatchCount: congestionFixtureIds.length,
    previousCompletedKickoffUtc,
    restHoursSincePreviousCompleted,
    competitionIdsRepresented,
    normalizedFixtureIds,
    semanticStatus,
    semanticReason,
    semanticScheduleComplete,
    competitionScopedRestHoursSnapshot:
      input.competitionScopedRestHoursSnapshot,
    competitionScopedCongestion28dSnapshot:
      input.competitionScopedCongestion28dSnapshot,
  };

  return {
    ...base,
    scheduleEvidenceDigest: digestPe4CrossCompScheduleSide(base),
  };
}
