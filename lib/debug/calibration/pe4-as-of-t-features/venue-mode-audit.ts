/**
 * PE-4I.18 — Venue-mode structural audit (all / home / away).
 * Availability depth + cross-venue redundancy. No predictive ranking.
 */

import {
  PE4I18_MIN_PAIRWISE_N,
  classifyCorrelationBand,
  type Pe4I18CorrelationBand,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";

export type Pe4I18VenueModeDepth = {
  venueMode: string;
  rows: number;
  meanObservationCount: number;
  shareObsGe3: number;
  shareObsEq0: number;
  meanPresentShareSelectedFields: number;
};

export type Pe4I18VenuePairOverlap = {
  venueA: string;
  venueB: string;
  field: string;
  pairwiseN: number;
  pearsonR: number | null;
  band: Pe4I18CorrelationBand;
};

export type Pe4I18VenueModeAudit = {
  alignmentKey: "targetFixtureId+teamId+windowId";
  depths: Pe4I18VenueModeDepth[];
  pairOverlaps: Pe4I18VenuePairOverlap[];
  summary: {
    extremePairs: number;
    veryHighPairs: number;
    highPairs: number;
    note: string;
  };
};

const COMPARE_FIELDS = [
  "observationCount",
  "pathA.goalsFor.mean",
  "pathA.goalsAgainst.mean",
  "derived.winRate",
  "derived.goalDiffMean",
  "pathB.expectedGoalsFor.mean",
] as const;

type DepthAcc = {
  rows: number;
  obsSum: number;
  obsGe3: number;
  obsEq0: number;
  presentSum: number;
  presentDenom: number;
};

type PairAcc = {
  n: number;
  sumX: number;
  sumY: number;
  sumXY: number;
  sumXX: number;
  sumYY: number;
};

function alignKey(
  targetFixtureId: string,
  teamId: string,
  windowId: string,
): string {
  return `${targetFixtureId}\t${teamId}\t${windowId}`;
}

export type Pe4I18VenueModeState = {
  depths: Map<string, DepthAcc>;
  groups: Map<string, Map<string, Record<string, number>>>;
};

export function createVenueModeState(): Pe4I18VenueModeState {
  return { depths: new Map(), groups: new Map() };
}

export function accumulateVenueModeRow(
  state: Pe4I18VenueModeState,
  meta: {
    targetFixtureId: string;
    teamId: string;
    windowId: string;
    venueMode: string;
  },
  numerics: Record<string, number>,
): void {
  let d = state.depths.get(meta.venueMode);
  if (!d) {
    d = {
      rows: 0,
      obsSum: 0,
      obsGe3: 0,
      obsEq0: 0,
      presentSum: 0,
      presentDenom: 0,
    };
    state.depths.set(meta.venueMode, d);
  }
  d.rows += 1;
  const obs = numerics.observationCount;
  if (Number.isFinite(obs)) {
    d.obsSum += obs;
    if (obs >= 3) d.obsGe3 += 1;
    if (obs === 0) d.obsEq0 += 1;
  }
  for (const f of COMPARE_FIELDS) {
    d.presentDenom += 1;
    if (Number.isFinite(numerics[f]!)) d.presentSum += 1;
  }

  const k = alignKey(meta.targetFixtureId, meta.teamId, meta.windowId);
  let g = state.groups.get(k);
  if (!g) {
    g = new Map();
    state.groups.set(k, g);
  }
  const subset: Record<string, number> = {};
  for (const f of COMPARE_FIELDS) subset[f] = numerics[f] ?? Number.NaN;
  g.set(meta.venueMode, subset);
}

function pearson(acc: PairAcc): number | null {
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

export function finalizeVenueModeAudit(
  state: Pe4I18VenueModeState,
  minPairwiseN: number = PE4I18_MIN_PAIRWISE_N,
): Pe4I18VenueModeAudit {
  const depths: Pe4I18VenueModeDepth[] = [...state.depths.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([venueMode, d]) => ({
      venueMode,
      rows: d.rows,
      meanObservationCount: d.rows === 0 ? 0 : d.obsSum / d.rows,
      shareObsGe3: d.rows === 0 ? 0 : d.obsGe3 / d.rows,
      shareObsEq0: d.rows === 0 ? 0 : d.obsEq0 / d.rows,
      meanPresentShareSelectedFields:
        d.presentDenom === 0 ? 0 : d.presentSum / d.presentDenom,
    }));

  const moments = new Map<string, PairAcc>();
  for (const g of state.groups.values()) {
    const venues = [...g.keys()].sort();
    for (let i = 0; i < venues.length; i++) {
      const va = venues[i]!;
      const xa = g.get(va)!;
      for (let j = i + 1; j < venues.length; j++) {
        const vb = venues[j]!;
        const xb = g.get(vb)!;
        for (const field of COMPARE_FIELDS) {
          const x = xa[field];
          const y = xb[field];
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          const mk = `${va}\0${vb}\0${field}`;
          let acc = moments.get(mk);
          if (!acc) {
            acc = { n: 0, sumX: 0, sumY: 0, sumXY: 0, sumXX: 0, sumYY: 0 };
            moments.set(mk, acc);
          }
          acc.n += 1;
          acc.sumX += x!;
          acc.sumY += y!;
          acc.sumXY += x! * y!;
          acc.sumXX += x! * x!;
          acc.sumYY += y! * y!;
        }
      }
    }
  }

  let extremePairs = 0;
  let veryHighPairs = 0;
  let highPairs = 0;
  const pairOverlaps: Pe4I18VenuePairOverlap[] = [];
  for (const [mk, acc] of [...moments.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const [venueA, venueB, field] = mk.split("\0") as [string, string, string];
    if (acc.n < minPairwiseN) {
      pairOverlaps.push({
        venueA,
        venueB,
        field,
        pairwiseN: acc.n,
        pearsonR: null,
        band: "INSUFFICIENT_PAIRWISE_N",
      });
      continue;
    }
    const r = pearson(acc);
    const band =
      r == null
        ? "INSUFFICIENT_PAIRWISE_N"
        : classifyCorrelationBand(Math.abs(r));
    if (band === "EXTREME") extremePairs += 1;
    else if (band === "VERY_HIGH") veryHighPairs += 1;
    else if (band === "HIGH") highPairs += 1;
    pairOverlaps.push({
      venueA,
      venueB,
      field,
      pairwiseN: acc.n,
      pearsonR: r,
      band,
    });
  }

  return {
    alignmentKey: "targetFixtureId+teamId+windowId",
    depths,
    pairOverlaps,
    summary: {
      extremePairs,
      veryHighPairs,
      highPairs,
      note: "Venue-mode depth/redundancy only — no venue ranking by outcomes.",
    },
  };
}
