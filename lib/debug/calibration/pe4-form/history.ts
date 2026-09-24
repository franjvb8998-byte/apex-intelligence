/**
 * PE-4H.1 — Predeclared history windows (not optimized).
 */

import {
  PE4_FORM_SIGNAL_CALENDAR_DAY_WINDOWS,
  PE4_FORM_SIGNAL_INCLUDE_RECENCY_WEIGHTED,
  PE4_FORM_SIGNAL_LAST_N_WINDOWS,
  PE4_FORM_SIGNAL_RECENCY_HALF_LIFE_DAYS,
} from "@/lib/debug/calibration/pe4-form/protocol";
import type { Pe4FormTeamObservation } from "@/lib/debug/calibration/pe4-form/observations";
import { sortTeamObservations } from "@/lib/debug/calibration/pe4-form/observations";

export type HistoryWindowId =
  | `last_${(typeof PE4_FORM_SIGNAL_LAST_N_WINDOWS)[number]}`
  | `days_${(typeof PE4_FORM_SIGNAL_CALENDAR_DAY_WINDOWS)[number]}`
  | "recency_hl28";

export type HistorySummary = {
  windowId: HistoryWindowId;
  sufficient: boolean;
  nPrior: number;
  meanResidual: number | null;
  medianResidual: number | null;
  recencyWeightedMeanResidual: number | null;
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[m - 1]! + s[m]!) / 2;
  return s[m]!;
}

/**
 * Strict temporal priors for target M:
 * prior.kickoffUtc < M.kickoffUtc (same kickoff excluded).
 * Same season only (cross-season disabled).
 */
export function priorObservationsForTarget(
  target: Pe4FormTeamObservation,
  teamSeasonObs: readonly Pe4FormTeamObservation[],
): Pe4FormTeamObservation[] {
  return sortTeamObservations(teamSeasonObs).filter(
    (p) =>
      p.teamId === target.teamId &&
      p.season === target.season &&
      p.kickoffUtc < target.kickoffUtc &&
      !(p.fixtureId === target.fixtureId),
  );
}

function lastN(
  priors: readonly Pe4FormTeamObservation[],
  n: number,
): Pe4FormTeamObservation[] {
  if (priors.length < n) return [];
  return priors.slice(-n);
}

function calendarWindow(
  target: Pe4FormTeamObservation,
  priors: readonly Pe4FormTeamObservation[],
  days: number,
): Pe4FormTeamObservation[] {
  const t = Date.parse(target.kickoffUtc);
  const lo = t - days * 24 * 60 * 60 * 1000;
  return priors.filter((p) => {
    const pk = Date.parse(p.kickoffUtc);
    return pk >= lo && pk < t;
  });
}

function summarize(
  windowId: HistoryWindowId,
  selected: readonly Pe4FormTeamObservation[],
  minRequired: number,
  targetKickoffUtc: string,
): HistorySummary {
  if (selected.length < minRequired) {
    return {
      windowId,
      sufficient: false,
      nPrior: selected.length,
      meanResidual: null,
      medianResidual: null,
      recencyWeightedMeanResidual: null,
    };
  }
  const rs = selected.map((o) => o.resultResidualPoints);
  const meanResidual = rs.reduce((a, b) => a + b, 0) / rs.length;
  const medianResidual = median(rs);

  let recencyWeightedMeanResidual: number | null = null;
  if (PE4_FORM_SIGNAL_INCLUDE_RECENCY_WEIGHTED) {
    const t = Date.parse(targetKickoffUtc);
    let wSum = 0;
    let wr = 0;
    for (const o of selected) {
      const lagDays =
        (t - Date.parse(o.kickoffUtc)) / (24 * 60 * 60 * 1000);
      const w = Math.pow(
        0.5,
        lagDays / PE4_FORM_SIGNAL_RECENCY_HALF_LIFE_DAYS,
      );
      wSum += w;
      wr += w * o.resultResidualPoints;
    }
    recencyWeightedMeanResidual = wSum > 0 ? wr / wSum : null;
  }

  return {
    windowId,
    sufficient: true,
    nPrior: selected.length,
    meanResidual,
    medianResidual,
    recencyWeightedMeanResidual,
  };
}

export function computeHistorySummaries(
  target: Pe4FormTeamObservation,
  teamSeasonObs: readonly Pe4FormTeamObservation[],
): HistorySummary[] {
  const priors = priorObservationsForTarget(target, teamSeasonObs);
  const out: HistorySummary[] = [];

  for (const n of PE4_FORM_SIGNAL_LAST_N_WINDOWS) {
    const selected = lastN(priors, n);
    out.push(summarize(`last_${n}`, selected, n, target.kickoffUtc));
  }

  for (const days of PE4_FORM_SIGNAL_CALENDAR_DAY_WINDOWS) {
    const selected = calendarWindow(target, priors, days);
    // Calendar windows: require at least 2 prior matches for sufficiency.
    out.push(summarize(`days_${days}`, selected, 2, target.kickoffUtc));
  }

  if (PE4_FORM_SIGNAL_INCLUDE_RECENCY_WEIGHTED) {
    // Same eligible set as last_5 for recency diagnostic comparability.
    const selected = lastN(priors, 5);
    const s = summarize("recency_hl28", selected, 5, target.kickoffUtc);
    out.push(s);
  }

  return out;
}

export function groupObservationsByTeam(
  obs: readonly Pe4FormTeamObservation[],
): Map<string, Pe4FormTeamObservation[]> {
  const map = new Map<string, Pe4FormTeamObservation[]>();
  for (const o of sortTeamObservations(obs)) {
    const list = map.get(o.teamId) ?? [];
    list.push(o);
    map.set(o.teamId, list);
  }
  return map;
}

/** Horizon k: residual of the k-th subsequent match for same team (k>=1). */
export function residualAtHorizon(
  target: Pe4FormTeamObservation,
  teamSeasonObs: readonly Pe4FormTeamObservation[],
  horizon: number,
): number | null {
  const sorted = sortTeamObservations(
    teamSeasonObs.filter(
      (o) => o.teamId === target.teamId && o.season === target.season,
    ),
  );
  const idx = sorted.findIndex(
    (o) =>
      o.fixtureId === target.fixtureId && o.venueRole === target.venueRole,
  );
  if (idx < 0) return null;
  const future = sorted[idx + horizon];
  return future ? future.resultResidualPoints : null;
}
