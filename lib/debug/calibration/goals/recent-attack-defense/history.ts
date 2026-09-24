/**
 * GOALS-1H.1 — Strict temporal history windows (not optimized).
 */

import type { GoalsRadTeamObservation } from "@/lib/debug/calibration/goals/recent-attack-defense/observations";
import { sortTeamObservations } from "@/lib/debug/calibration/goals/recent-attack-defense/observations";
import {
  GOALS_RAD_CALENDAR_DAY_WINDOWS,
  GOALS_RAD_LAST_N_WINDOWS,
  GOALS_RAD_RECENCY_HALF_LIFE_DAYS,
} from "@/lib/debug/calibration/goals/recent-attack-defense/protocol";

export type GoalsRadWindowId =
  | `last_${(typeof GOALS_RAD_LAST_N_WINDOWS)[number]}`
  | `days_${(typeof GOALS_RAD_CALENDAR_DAY_WINDOWS)[number]}`
  | "halfLife_28";

export type HistorySupportStatus = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";

export type GoalsRadHistorySummary = {
  windowId: GoalsRadWindowId;
  status: HistorySupportStatus;
  historyCount: number;
  historySpanDays: number | null;
  recentAttackResidualMean: number | null;
  recentDefenseResidualMean: number | null;
  sameVenueRole?: boolean;
};

/**
 * Strict priors: kickoff(history) < kickoff(T), same team, same season.
 * Excludes T itself and same-kickoff fixtures.
 */
export function priorObservationsForTarget(
  target: GoalsRadTeamObservation,
  teamSeasonObs: readonly GoalsRadTeamObservation[],
  opts?: { sameVenueRoleOnly?: boolean },
): GoalsRadTeamObservation[] {
  return sortTeamObservations(teamSeasonObs).filter((p) => {
    if (p.teamId !== target.teamId) return false;
    if (p.season !== target.season) return false;
    if (!(p.kickoffUtc < target.kickoffUtc)) return false;
    if (p.fixtureId === target.fixtureId) return false;
    if (opts?.sameVenueRoleOnly && p.venueRole !== target.venueRole) {
      return false;
    }
    return true;
  });
}

function spanDays(
  selected: readonly GoalsRadTeamObservation[],
  targetKickoff: string,
): number | null {
  if (!selected.length) return null;
  const first = Date.parse(selected[0]!.kickoffUtc);
  const t = Date.parse(targetKickoff);
  return (t - first) / (24 * 60 * 60 * 1000);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function summarize(
  windowId: GoalsRadWindowId,
  selected: readonly GoalsRadTeamObservation[],
  minRequired: number,
  targetKickoffUtc: string,
  sameVenueRole?: boolean,
): GoalsRadHistorySummary {
  if (selected.length === 0) {
    return {
      windowId,
      status: "UNAVAILABLE",
      historyCount: 0,
      historySpanDays: null,
      recentAttackResidualMean: null,
      recentDefenseResidualMean: null,
      sameVenueRole,
    };
  }
  if (selected.length < minRequired) {
    return {
      windowId,
      status: "PARTIAL",
      historyCount: selected.length,
      historySpanDays: spanDays(selected, targetKickoffUtc),
      recentAttackResidualMean: null,
      recentDefenseResidualMean: null,
      sameVenueRole,
    };
  }
  return {
    windowId,
    status: "AVAILABLE",
    historyCount: selected.length,
    historySpanDays: spanDays(selected, targetKickoffUtc),
    recentAttackResidualMean: mean(selected.map((o) => o.attackResidual)),
    recentDefenseResidualMean: mean(selected.map((o) => o.defenseResidual)),
    sameVenueRole,
  };
}

function lastN(
  priors: readonly GoalsRadTeamObservation[],
  n: number,
): GoalsRadTeamObservation[] {
  // No padding: return empty if insufficient for last_n sufficiency check
  // Caller passes full priors; summarize checks minRequired.
  return priors.slice(-n);
}

function calendarWindow(
  target: GoalsRadTeamObservation,
  priors: readonly GoalsRadTeamObservation[],
  days: number,
): GoalsRadTeamObservation[] {
  const t = Date.parse(target.kickoffUtc);
  const lo = t - days * 24 * 60 * 60 * 1000;
  return priors.filter((p) => {
    const pk = Date.parse(p.kickoffUtc);
    return pk >= lo && pk < t;
  });
}

function halfLifeMean(
  selected: readonly GoalsRadTeamObservation[],
  targetKickoffUtc: string,
): { attack: number; defense: number } {
  const t = Date.parse(targetKickoffUtc);
  let wSum = 0;
  let a = 0;
  let d = 0;
  for (const o of selected) {
    const lagDays = (t - Date.parse(o.kickoffUtc)) / (24 * 60 * 60 * 1000);
    const w = Math.pow(0.5, lagDays / GOALS_RAD_RECENCY_HALF_LIFE_DAYS);
    wSum += w;
    a += w * o.attackResidual;
    d += w * o.defenseResidual;
  }
  return { attack: a / wSum, defense: d / wSum };
}

export function computeHistorySummaries(
  target: GoalsRadTeamObservation,
  teamSeasonObs: readonly GoalsRadTeamObservation[],
): GoalsRadHistorySummary[] {
  const priors = priorObservationsForTarget(target, teamSeasonObs);
  const out: GoalsRadHistorySummary[] = [];

  for (const n of GOALS_RAD_LAST_N_WINDOWS) {
    const selected = lastN(priors, n);
    // last_n requires exactly n available (slice of n when priors.length >= n)
    out.push(
      summarize(
        `last_${n}`,
        priors.length >= n ? selected : priors,
        n,
        target.kickoffUtc,
      ),
    );
  }

  for (const days of GOALS_RAD_CALENDAR_DAY_WINDOWS) {
    const selected = calendarWindow(target, priors, days);
    out.push(summarize(`days_${days}`, selected, 2, target.kickoffUtc));
  }

  // halfLife_28: weighted over all priors; require ≥3 (no padding)
  if (priors.length >= 3) {
    const hl = halfLifeMean(priors, target.kickoffUtc);
    out.push({
      windowId: "halfLife_28",
      status: "AVAILABLE",
      historyCount: priors.length,
      historySpanDays: spanDays(priors, target.kickoffUtc),
      recentAttackResidualMean: hl.attack,
      recentDefenseResidualMean: hl.defense,
    });
  } else if (priors.length === 0) {
    out.push({
      windowId: "halfLife_28",
      status: "UNAVAILABLE",
      historyCount: 0,
      historySpanDays: null,
      recentAttackResidualMean: null,
      recentDefenseResidualMean: null,
    });
  } else {
    out.push({
      windowId: "halfLife_28",
      status: "PARTIAL",
      historyCount: priors.length,
      historySpanDays: spanDays(priors, target.kickoffUtc),
      recentAttackResidualMean: null,
      recentDefenseResidualMean: null,
    });
  }

  return out;
}

/** last_5 all-venue vs same-venue-role diagnostic. */
export function last5VenueRoleCompare(
  target: GoalsRadTeamObservation,
  teamSeasonObs: readonly GoalsRadTeamObservation[],
): {
  allVenue: GoalsRadHistorySummary;
  sameVenue: GoalsRadHistorySummary;
} {
  const allPriors = priorObservationsForTarget(target, teamSeasonObs);
  const samePriors = priorObservationsForTarget(target, teamSeasonObs, {
    sameVenueRoleOnly: true,
  });
  return {
    allVenue: summarize(
      "last_5",
      allPriors.length >= 5 ? allPriors.slice(-5) : allPriors,
      5,
      target.kickoffUtc,
      false,
    ),
    sameVenue: summarize(
      "last_5",
      samePriors.length >= 5 ? samePriors.slice(-5) : samePriors,
      5,
      target.kickoffUtc,
      true,
    ),
  };
}

export function groupObservationsByTeam(
  obs: readonly GoalsRadTeamObservation[],
): Map<string, GoalsRadTeamObservation[]> {
  const map = new Map<string, GoalsRadTeamObservation[]>();
  for (const o of obs) {
    const key = `${o.season}|${o.teamId}`;
    const list = map.get(key) ?? [];
    list.push(o);
    map.set(key, list);
  }
  for (const [k, list] of map) {
    map.set(k, sortTeamObservations(list));
  }
  return map;
}

/**
 * For horizon persistence: history at match M predicts residual at M+(h-1).
 * horizon 1 = target itself (next match after history).
 */
export function residualAtHorizon(
  base: GoalsRadTeamObservation,
  teamSeasonObs: readonly GoalsRadTeamObservation[],
  horizon: number,
): { attack: number; defense: number; goalsFor: number; goalsAgainst: number } | null {
  const sorted = sortTeamObservations(
    teamSeasonObs.filter(
      (o) => o.teamId === base.teamId && o.season === base.season,
    ),
  );
  const idx = sorted.findIndex(
    (o) => o.fixtureId === base.fixtureId && o.venueRole === base.venueRole,
  );
  if (idx < 0) return null;
  const at = sorted[idx + horizon - 1];
  if (!at) return null;
  return {
    attack: at.attackResidual,
    defense: at.defenseResidual,
    goalsFor: at.actualGoalsFor,
    goalsAgainst: at.actualGoalsAgainst,
  };
}
