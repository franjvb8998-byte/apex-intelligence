/**
 * PE-4H.1 — Correlations, residual ranges, sanity summaries.
 */

import {
  PE4_FORM_SIGNAL_BOOTSTRAP_ITERATIONS,
  PE4_FORM_SIGNAL_BOOTSTRAP_SEED,
  PE4_FORM_SIGNAL_EP_RANGE_EDGES,
  PE4_FORM_SIGNAL_HIST_RESIDUAL_RANGE_EDGES,
  PE4_FORM_SIGNAL_HORIZONS,
} from "@/lib/debug/calibration/pe4-form/protocol";
import type { Pe4FormTeamObservation } from "@/lib/debug/calibration/pe4-form/observations";
import type { HistoryWindowId } from "@/lib/debug/calibration/pe4-form/history";
import {
  computeHistorySummaries,
  groupObservationsByTeam,
  residualAtHorizon,
} from "@/lib/debug/calibration/pe4-form/history";

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3 || n !== ys.length) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den < 1e-15 ? null : num / den;
}

function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v || a.i - b.i);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j]!.v === indexed[i]!.v) j += 1;
    const avg = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k += 1) ranks[indexed[k]!.i] = avg;
    i = j;
  }
  return ranks;
}

export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  return pearson(rank(xs), rank(ys));
}

export function signAgreement(xs: number[], ys: number[]): number | null {
  let n = 0;
  let agree = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const sx = Math.sign(xs[i]!);
    const sy = Math.sign(ys[i]!);
    if (sx === 0 || sy === 0) continue;
    n += 1;
    if (sx === sy) agree += 1;
  }
  return n === 0 ? null : agree / n;
}

export type ResidualSanity = {
  n: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q10: number;
  q25: number;
  q50: number;
  q75: number;
  q90: number;
};

export function residualSanity(
  residuals: readonly number[],
): ResidualSanity | null {
  if (residuals.length === 0) return null;
  const s = [...residuals].sort((a, b) => a - b);
  const n = s.length;
  const mean = residuals.reduce((a, b) => a + b, 0) / n;
  let varSum = 0;
  for (const r of residuals) varSum += (r - mean) ** 2;
  const std = Math.sqrt(varSum / n);
  const q = (p: number) => {
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return s[lo]!;
    return s[lo]! * (hi - idx) + s[hi]! * (idx - lo);
  };
  return {
    n,
    mean,
    median: q(0.5),
    std,
    min: s[0]!,
    max: s[n - 1]!,
    q10: q(0.1),
    q25: q(0.25),
    q50: q(0.5),
    q75: q(0.75),
    q90: q(0.9),
  };
}

export type SignalPair = {
  fixtureId: string;
  teamId: string;
  venueRole: string;
  historical: number;
  next: number;
  realizedPoints: number;
  expectedPoints: number;
  strengthEvidenceQuality: string;
  lowInformationFallbackUsed: boolean;
  expectedTargetPoints: number;
};

export function buildSignalPairs(
  obs: readonly Pe4FormTeamObservation[],
  windowId: HistoryWindowId,
  summaryField: "meanResidual" | "medianResidual" | "recencyWeightedMeanResidual" = "meanResidual",
): SignalPair[] {
  const byTeam = groupObservationsByTeam(obs);
  const pairs: SignalPair[] = [];
  for (const o of obs) {
    const teamObs = byTeam.get(o.teamId) ?? [];
    const summaries = computeHistorySummaries(o, teamObs);
    const s = summaries.find((x) => x.windowId === windowId);
    if (!s || !s.sufficient) continue;
    const hist = s[summaryField];
    if (hist == null) continue;
    pairs.push({
      fixtureId: o.fixtureId,
      teamId: o.teamId,
      venueRole: o.venueRole,
      historical: hist,
      next: o.resultResidualPoints,
      realizedPoints: o.realizedTargetPoints,
      expectedPoints: o.expectedTargetPoints,
      strengthEvidenceQuality: o.strengthEvidenceQuality,
      lowInformationFallbackUsed: o.lowInformationFallbackUsed,
      expectedTargetPoints: o.expectedTargetPoints,
    });
  }
  return pairs;
}

export type AssociationSummary = {
  n: number;
  pearson: number | null;
  spearman: number | null;
  signAgreement: number | null;
  bootstrapPearsonCi90: [number, number] | null;
};

/** Deterministic LCG for bootstrap. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Fixture-cluster bootstrap CI for Pearson.
 * Resample unique fixtureIds with replacement; keep all team obs in selected fixtures.
 */
export function fixtureClusterPearsonCi(
  pairs: readonly SignalPair[],
  seed: number = PE4_FORM_SIGNAL_BOOTSTRAP_SEED,
  iterations: number = PE4_FORM_SIGNAL_BOOTSTRAP_ITERATIONS,
): [number, number] | null {
  if (pairs.length < 10) return null;
  const byFix = new Map<string, SignalPair[]>();
  for (const p of pairs) {
    const list = byFix.get(p.fixtureId) ?? [];
    list.push(p);
    byFix.set(p.fixtureId, list);
  }
  const fixtures = [...byFix.keys()].sort();
  if (fixtures.length < 5) return null;
  const rand = lcg(seed);
  const stats: number[] = [];
  for (let b = 0; b < iterations; b += 1) {
    const sampled: SignalPair[] = [];
    for (let i = 0; i < fixtures.length; i += 1) {
      const idx = Math.floor(rand() * fixtures.length);
      sampled.push(...(byFix.get(fixtures[idx]!) ?? []));
    }
    const r = pearson(
      sampled.map((p) => p.historical),
      sampled.map((p) => p.next),
    );
    if (r != null) stats.push(r);
  }
  if (stats.length < 10) return null;
  stats.sort((a, b) => a - b);
  const lo = stats[Math.floor(0.05 * (stats.length - 1))]!;
  const hi = stats[Math.floor(0.95 * (stats.length - 1))]!;
  return [lo, hi];
}

export function associationSummary(pairs: readonly SignalPair[]): AssociationSummary {
  const xs = pairs.map((p) => p.historical);
  const ys = pairs.map((p) => p.next);
  return {
    n: pairs.length,
    pearson: pearson(xs, ys),
    spearman: spearman(xs, ys),
    signAgreement: signAgreement(xs, ys),
    bootstrapPearsonCi90: fixtureClusterPearsonCi(pairs),
  };
}

export function histResidualRangeTable(pairs: readonly SignalPair[]) {
  const edges = PE4_FORM_SIGNAL_HIST_RESIDUAL_RANGE_EDGES;
  const rows = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    const subset = pairs.filter((p) => p.historical >= lo && p.historical < hi);
    const n = subset.length;
    rows.push({
      lo,
      hi,
      n,
      meanHistorical: n
        ? subset.reduce((s, p) => s + p.historical, 0) / n
        : null,
      meanNextResidual: n
        ? subset.reduce((s, p) => s + p.next, 0) / n
        : null,
      meanRealizedPoints: n
        ? subset.reduce((s, p) => s + p.realizedPoints, 0) / n
        : null,
      meanExpectedPoints: n
        ? subset.reduce((s, p) => s + p.expectedPoints, 0) / n
        : null,
    });
  }
  return rows;
}

export function epRangeAssociation(pairs: readonly SignalPair[]) {
  const edges = PE4_FORM_SIGNAL_EP_RANGE_EDGES;
  const rows = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    const subset = pairs.filter(
      (p) => p.expectedTargetPoints >= lo && p.expectedTargetPoints < hi,
    );
    rows.push({
      lo,
      hi,
      association: associationSummary(subset),
    });
  }
  return rows;
}

export function horizonAssociations(
  obs: readonly Pe4FormTeamObservation[],
  windowId: HistoryWindowId,
): { horizon: number; association: AssociationSummary }[] {
  const byTeam = groupObservationsByTeam(obs);
  const out = [];
  for (const h of PE4_FORM_SIGNAL_HORIZONS) {
    const xs: number[] = [];
    const ys: number[] = [];
    const fixtureIds: string[] = [];
    for (const o of obs) {
      const teamObs = byTeam.get(o.teamId) ?? [];
      const summaries = computeHistorySummaries(o, teamObs);
      const s = summaries.find((x) => x.windowId === windowId);
      if (!s?.sufficient || s.meanResidual == null) continue;
      const future = residualAtHorizon(o, teamObs, h);
      if (future == null) continue;
      xs.push(s.meanResidual);
      ys.push(future);
      fixtureIds.push(o.fixtureId);
    }
    const pairs: SignalPair[] = xs.map((historical, i) => ({
      fixtureId: fixtureIds[i]!,
      teamId: "",
      venueRole: "",
      historical,
      next: ys[i]!,
      realizedPoints: 0,
      expectedPoints: 0,
      strengthEvidenceQuality: "",
      lowInformationFallbackUsed: false,
      expectedTargetPoints: 0,
    }));
    out.push({ horizon: h, association: associationSummary(pairs) });
  }
  return out;
}

export function classifyPersistence(
  pearsonR: number | null,
): "persistence" | "near_zero" | "mean_reverting" | "unknown" {
  if (pearsonR == null) return "unknown";
  if (pearsonR > 0.05) return "persistence";
  if (pearsonR < -0.05) return "mean_reverting";
  return "near_zero";
}

export function teamSupportReport(
  obs: readonly Pe4FormTeamObservation[],
  pairs: readonly SignalPair[],
) {
  const teams = new Set(obs.map((o) => o.teamId));
  const perTeam = new Map<string, number>();
  for (const o of obs) {
    perTeam.set(o.teamId, (perTeam.get(o.teamId) ?? 0) + 1);
  }
  const eligiblePerTeam = new Map<string, number>();
  for (const p of pairs) {
    eligiblePerTeam.set(p.teamId, (eligiblePerTeam.get(p.teamId) ?? 0) + 1);
  }
  // Leave-one-team-out Pearson to check concentration
  const leaveOneOut: { teamId: string; pearson: number | null }[] = [];
  for (const teamId of [...eligiblePerTeam.keys()].sort()) {
    const subset = pairs.filter((p) => p.teamId !== teamId);
    leaveOneOut.push({
      teamId,
      pearson: pearson(
        subset.map((p) => p.historical),
        subset.map((p) => p.next),
      ),
    });
  }
  return {
    teamCount: teams.size,
    observationsPerTeam: Object.fromEntries([...perTeam.entries()].sort()),
    eligibleTargetsPerTeam: Object.fromEntries(
      [...eligiblePerTeam.entries()].sort(),
    ),
    leaveOneTeamOutPearson: leaveOneOut,
  };
}
