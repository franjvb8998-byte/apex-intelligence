/**
 * PE-4I.18 — Cross-window structural overlap / correlation.
 * Aligns same target/team/venue across windows. NO winning-window language.
 */

import {
  PE4I18_MIN_PAIRWISE_N,
  classifyCorrelationBand,
  type Pe4I18CorrelationBand,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";

export type Pe4I18WindowPairOverlap = {
  windowA: string;
  windowB: string;
  field: string;
  pairwiseN: number;
  exactEqualShare: number | null;
  pearsonR: number | null;
  band: Pe4I18CorrelationBand;
};

export type Pe4I18WindowRedundancyAudit = {
  alignmentKey: "targetFixtureId+teamId+venueMode";
  alignedGroupCount: number;
  windowsCompared: string[];
  fieldsCompared: string[];
  pairOverlaps: Pe4I18WindowPairOverlap[];
  summary: {
    extremeFieldWindowPairs: number;
    veryHighFieldWindowPairs: number;
    highFieldWindowPairs: number;
    meanExactEqualShare: number | null;
    note: string;
  };
};

type CellMoments = {
  n: number;
  equal: number;
  sumX: number;
  sumY: number;
  sumXY: number;
  sumXX: number;
  sumYY: number;
};

/** Core numeric fields for window alignment (subset for signal clarity). */
export const PE4I18_WINDOW_COMPARE_FIELDS = [
  "observationCount",
  "pathA.results.wins",
  "pathA.results.draws",
  "pathA.results.losses",
  "pathA.goalsFor.mean",
  "pathA.goalsAgainst.mean",
  "pathA.shotsFor.mean",
  "pathA.shotsAgainst.mean",
  "derived.winRate",
  "derived.pointsPerMatch",
  "derived.goalDiffMean",
  "scheduleRest.daysSincePreviousMatch",
  "pathB.expectedGoalsFor.mean",
  "pathB.expectedGoalsAgainst.mean",
  "derived.xgDiffMean",
] as const;

function alignKey(targetFixtureId: string, teamId: string, venueMode: string): string {
  return `${targetFixtureId}\t${teamId}\t${venueMode}`;
}

function momentKey(windowA: string, windowB: string, field: string): string {
  const [wa, wb] = windowA < windowB ? [windowA, windowB] : [windowB, windowA];
  return `${wa}\0${wb}\0${field}`;
}

export type Pe4I18WindowRedundancyState = {
  /** alignKey → windowId → field → value */
  groups: Map<string, Map<string, Record<string, number>>>;
  fields: readonly string[];
};

export function createWindowRedundancyState(
  fields: readonly string[] = PE4I18_WINDOW_COMPARE_FIELDS,
): Pe4I18WindowRedundancyState {
  return { groups: new Map(), fields };
}

export function accumulateWindowRow(
  state: Pe4I18WindowRedundancyState,
  meta: {
    targetFixtureId: string;
    teamId: string;
    venueMode: string;
    windowId: string;
  },
  numerics: Record<string, number>,
): void {
  const k = alignKey(meta.targetFixtureId, meta.teamId, meta.venueMode);
  let g = state.groups.get(k);
  if (!g) {
    g = new Map();
    state.groups.set(k, g);
  }
  const subset: Record<string, number> = {};
  for (const f of state.fields) {
    subset[f] = numerics[f] ?? Number.NaN;
  }
  g.set(meta.windowId, subset);
}

function pearson(acc: CellMoments): number | null {
  if (acc.n < 2) return null;
  const n = acc.n;
  const num = n * acc.sumXY - acc.sumX * acc.sumY;
  const denX = n * acc.sumXX - acc.sumX * acc.sumX;
  const denY = n * acc.sumYY - acc.sumY * acc.sumY;
  if (denX <= 0 || denY <= 0) return null;
  const r = num / Math.sqrt(denX * denY);
  if (!Number.isFinite(r)) return null;
  return Math.max(-1, Math.min(1, r));
}

export function finalizeWindowRedundancy(
  state: Pe4I18WindowRedundancyState,
  minPairwiseN: number = PE4I18_MIN_PAIRWISE_N,
): Pe4I18WindowRedundancyAudit {
  const moments = new Map<string, CellMoments>();
  const windows = new Set<string>();

  for (const g of state.groups.values()) {
    const wins = [...g.keys()].sort();
    for (const w of wins) windows.add(w);
    for (let i = 0; i < wins.length; i++) {
      const wa = wins[i]!;
      const va = g.get(wa)!;
      for (let j = i + 1; j < wins.length; j++) {
        const wb = wins[j]!;
        const vb = g.get(wb)!;
        for (const field of state.fields) {
          const x = va[field];
          const y = vb[field];
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          const mk = momentKey(wa, wb, field);
          let acc = moments.get(mk);
          if (!acc) {
            acc = {
              n: 0,
              equal: 0,
              sumX: 0,
              sumY: 0,
              sumXY: 0,
              sumXX: 0,
              sumYY: 0,
            };
            moments.set(mk, acc);
          }
          acc.n += 1;
          if (Math.abs(x! - y!) < 1e-12) acc.equal += 1;
          acc.sumX += x!;
          acc.sumY += y!;
          acc.sumXY += x! * y!;
          acc.sumXX += x! * x!;
          acc.sumYY += y! * y!;
        }
      }
    }
  }

  const pairOverlaps: Pe4I18WindowPairOverlap[] = [];
  let equalShareSum = 0;
  let equalShareN = 0;
  let extreme = 0;
  let veryHigh = 0;
  let high = 0;

  for (const [mk, acc] of [...moments.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const [windowA, windowB, field] = mk.split("\0") as [string, string, string];
    if (acc.n < minPairwiseN) {
      pairOverlaps.push({
        windowA,
        windowB,
        field,
        pairwiseN: acc.n,
        exactEqualShare: acc.n > 0 ? acc.equal / acc.n : null,
        pearsonR: null,
        band: "INSUFFICIENT_PAIRWISE_N",
      });
      continue;
    }
    const r = pearson(acc);
    const exactEqualShare = acc.equal / acc.n;
    equalShareSum += exactEqualShare;
    equalShareN += 1;
    const band =
      r == null
        ? "INSUFFICIENT_PAIRWISE_N"
        : classifyCorrelationBand(Math.abs(r));
    if (band === "EXTREME") extreme += 1;
    else if (band === "VERY_HIGH") veryHigh += 1;
    else if (band === "HIGH") high += 1;
    pairOverlaps.push({
      windowA,
      windowB,
      field,
      pairwiseN: acc.n,
      exactEqualShare,
      pearsonR: r,
      band,
    });
  }

  return {
    alignmentKey: "targetFixtureId+teamId+venueMode",
    alignedGroupCount: state.groups.size,
    windowsCompared: [...windows].sort(),
    fieldsCompared: [...state.fields],
    pairOverlaps,
    summary: {
      extremeFieldWindowPairs: extreme,
      veryHighFieldWindowPairs: veryHigh,
      highFieldWindowPairs: high,
      meanExactEqualShare:
        equalShareN === 0 ? null : equalShareSum / equalShareN,
      note: "Structural overlap across windows only — no window ranking by outcomes.",
    },
  };
}
