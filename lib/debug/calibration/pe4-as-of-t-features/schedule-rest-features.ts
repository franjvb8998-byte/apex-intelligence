/**
 * PE-4I.16 — Schedule / rest features from past kickoffs only.
 * Days since previous; trailing 7/14/28 match counts. No fatigue multiplier.
 */

import { parseKickoffUtcMillis } from "@/lib/debug/calibration/pe4-acquisition/temporal";
import { PE4I2_FUTURE_SCHEDULE_ANTICIPATION } from "@/lib/debug/calibration/pe4-acquisition/temporal";
import type { Pe4I16TeamPerspectiveRow } from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";

export const PE4I16_REST_ROLLING_DAYS = [7, 14, 28] as const;

export type Pe4I16ScheduleRestFeatures = {
  familyId: "schedule_rest";
  status: "AVAILABLE" | "UNAVAILABLE";
  unavailableReason: string | null;
  targetKickoffUtc: string;
  /** Days since previous match kickoff (past only). null if no prior. */
  daysSincePreviousMatch: number | null;
  hoursSincePreviousMatch: number | null;
  matchesInLast7d: number;
  matchesInLast14d: number;
  matchesInLast28d: number;
  priorMatchCount: number;
  ambiguityFlaggedPriorCount: number;
  futureScheduleAnticipation: typeof PE4I2_FUTURE_SCHEDULE_ANTICIPATION;
  noFatigueMultiplier: true;
};

function countInWindow(
  priorMs: readonly number[],
  targetMs: number,
  days: number,
): number {
  const cutoff = targetMs - days * 24 * 60 * 60 * 1000;
  let n = 0;
  for (const ms of priorMs) {
    if (ms >= cutoff && ms < targetMs) n += 1;
  }
  return n;
}

/**
 * Compute schedule/rest features for a team as-of target kickoff.
 * Uses only past kickoffs from team history (already filtered temporally by caller
 * or filtered here with strict before).
 */
export function buildScheduleRestFeatures(input: {
  teamHistory: readonly Pe4I16TeamPerspectiveRow[];
  targetKickoffUtc: string;
  /** Exclude target fixture id if present in history. */
  targetFixtureId?: string;
}): Pe4I16ScheduleRestFeatures {
  const targetMs = parseKickoffUtcMillis(input.targetKickoffUtc);
  if (targetMs == null) {
    return {
      familyId: "schedule_rest",
      status: "UNAVAILABLE",
      unavailableReason: "malformed_target_kickoff",
      targetKickoffUtc: input.targetKickoffUtc,
      daysSincePreviousMatch: null,
      hoursSincePreviousMatch: null,
      matchesInLast7d: 0,
      matchesInLast14d: 0,
      matchesInLast28d: 0,
      priorMatchCount: 0,
      ambiguityFlaggedPriorCount: 0,
      futureScheduleAnticipation: PE4I2_FUTURE_SCHEDULE_ANTICIPATION,
      noFatigueMultiplier: true,
    };
  }

  const priors = input.teamHistory
    .filter((r) => {
      if (
        input.targetFixtureId &&
        r.fixtureId === input.targetFixtureId
      ) {
        return false;
      }
      const ms = parseKickoffUtcMillis(r.kickoffUtc);
      return ms != null && ms < targetMs;
    })
    .sort((a, b) => {
      const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
      if (k !== 0) return k;
      return a.fixtureId.localeCompare(b.fixtureId);
    });

  if (priors.length === 0) {
    return {
      familyId: "schedule_rest",
      status: "UNAVAILABLE",
      unavailableReason: "no_prior_kickoffs_in_corpus",
      targetKickoffUtc: input.targetKickoffUtc,
      daysSincePreviousMatch: null,
      hoursSincePreviousMatch: null,
      matchesInLast7d: 0,
      matchesInLast14d: 0,
      matchesInLast28d: 0,
      priorMatchCount: 0,
      ambiguityFlaggedPriorCount: 0,
      futureScheduleAnticipation: PE4I2_FUTURE_SCHEDULE_ANTICIPATION,
      noFatigueMultiplier: true,
    };
  }

  const priorMs = priors.map((r) => parseKickoffUtcMillis(r.kickoffUtc)!);
  const lastMs = priorMs[priorMs.length - 1]!;
  const hours = (targetMs - lastMs) / (60 * 60 * 1000);
  const days = hours / 24;
  const ambiguityFlaggedPriorCount = priors.filter(
    (r) => r.regulationAmbiguity,
  ).length;

  return {
    familyId: "schedule_rest",
    status: "AVAILABLE",
    unavailableReason: null,
    targetKickoffUtc: input.targetKickoffUtc,
    daysSincePreviousMatch: days,
    hoursSincePreviousMatch: hours,
    matchesInLast7d: countInWindow(priorMs, targetMs, 7),
    matchesInLast14d: countInWindow(priorMs, targetMs, 14),
    matchesInLast28d: countInWindow(priorMs, targetMs, 28),
    priorMatchCount: priors.length,
    ambiguityFlaggedPriorCount,
    futureScheduleAnticipation: PE4I2_FUTURE_SCHEDULE_ANTICIPATION,
    noFatigueMultiplier: true,
  };
}
