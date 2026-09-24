/**
 * GOALS-1H.1 — Correlations, bootstrap, classification (no model fit).
 */

import type { GoalsRadTeamObservation } from "@/lib/debug/calibration/goals/recent-attack-defense/observations";
import {
  computeHistorySummaries,
  groupObservationsByTeam,
  last5VenueRoleCompare,
  residualAtHorizon,
  type GoalsRadWindowId,
} from "@/lib/debug/calibration/goals/recent-attack-defense/history";
import {
  GOALS_RAD_ABS_RESIDUAL_STRATA,
  GOALS_RAD_BOOTSTRAP_ITERATIONS,
  GOALS_RAD_BOOTSTRAP_SEED,
  GOALS_RAD_HORIZONS,
  GOALS_RAD_NEAR_ZERO_ABS_R,
  GOALS_RAD_WINSOR_CAP,
} from "@/lib/debug/calibration/goals/recent-attack-defense/protocol";

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

export type SignalPair = {
  fixtureId: string;
  teamId: string;
  venueRole: string;
  evidenceSupportBucket: string;
  historicalAttack: number;
  historicalDefense: number;
  nextAttackResidual: number;
  nextDefenseResidual: number;
  nextGoalsFor: number;
  nextGoalsAgainst: number;
};

export function buildSignalPairs(
  obs: readonly GoalsRadTeamObservation[],
  windowId: GoalsRadWindowId,
  horizon = 1,
): SignalPair[] {
  const byTeam = groupObservationsByTeam(obs);
  const pairs: SignalPair[] = [];
  for (const o of obs) {
    const teamObs = byTeam.get(`${o.season}|${o.teamId}`) ?? [];
    const summaries = computeHistorySummaries(o, teamObs);
    const s = summaries.find((x) => x.windowId === windowId);
    if (!s || s.status !== "AVAILABLE") continue;
    if (
      s.recentAttackResidualMean == null ||
      s.recentDefenseResidualMean == null
    ) {
      continue;
    }
    const next = residualAtHorizon(o, teamObs, horizon);
    if (!next) continue;
    pairs.push({
      fixtureId: o.fixtureId,
      teamId: o.teamId,
      venueRole: o.venueRole,
      evidenceSupportBucket: o.evidenceSupportBucket,
      historicalAttack: s.recentAttackResidualMean,
      historicalDefense: s.recentDefenseResidualMean,
      nextAttackResidual: next.attack,
      nextDefenseResidual: next.defense,
      nextGoalsFor: next.goalsFor,
      nextGoalsAgainst: next.goalsAgainst,
    });
  }
  return pairs;
}

export type AssociationSummary = {
  n: number;
  pearson: number | null;
  spearman: number | null;
  signAgreement: number | null;
};

export function associate(
  pairs: readonly SignalPair[],
  side: "attack" | "defense",
): AssociationSummary {
  const xs =
    side === "attack"
      ? pairs.map((p) => p.historicalAttack)
      : pairs.map((p) => p.historicalDefense);
  const ys =
    side === "attack"
      ? pairs.map((p) => p.nextAttackResidual)
      : pairs.map((p) => p.nextDefenseResidual);
  return {
    n: pairs.length,
    pearson: pearson(xs, ys),
    spearman: spearman(xs, ys),
    signAgreement: signAgreement(xs, ys),
  };
}

export function associateCross(
  pairs: readonly SignalPair[],
  hist: "attack" | "defense",
  next: "attackResidual" | "defenseResidual" | "goalsFor" | "goalsAgainst",
): AssociationSummary {
  const xs =
    hist === "attack"
      ? pairs.map((p) => p.historicalAttack)
      : pairs.map((p) => p.historicalDefense);
  const ys = pairs.map((p) => {
    if (next === "attackResidual") return p.nextAttackResidual;
    if (next === "defenseResidual") return p.nextDefenseResidual;
    if (next === "goalsFor") return p.nextGoalsFor;
    return p.nextGoalsAgainst;
  });
  return {
    n: pairs.length,
    pearson: pearson(xs, ys),
    spearman: spearman(xs, ys),
    signAgreement: signAgreement(xs, ys),
  };
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function fixtureClusterPearsonCi(
  pairs: readonly SignalPair[],
  side: "attack" | "defense",
  seed = GOALS_RAD_BOOTSTRAP_SEED,
  iterations = GOALS_RAD_BOOTSTRAP_ITERATIONS,
): { mean: number; p2_5: number; p50: number; p97_5: number } | null {
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
      const id = fixtures[Math.floor(rand() * fixtures.length)]!;
      sampled.push(...(byFix.get(id) ?? []));
    }
    const a = associate(sampled, side);
    if (a.pearson != null) stats.push(a.pearson);
  }
  if (stats.length < 10) return null;
  stats.sort((a, b) => a - b);
  const pct = (p: number) =>
    stats[
      Math.min(stats.length - 1, Math.max(0, Math.floor((p / 100) * (stats.length - 1))))
    ]!;
  return {
    mean: stats.reduce((a, b) => a + b, 0) / stats.length,
    p2_5: pct(2.5),
    p50: pct(50),
    p97_5: pct(97.5),
  };
}

export type SignalClass =
  | "POSITIVE_PERSISTENCE"
  | "NEGATIVE_PERSISTENCE"
  | "NEAR_ZERO"
  | "UNSTABLE";

export function classifySignal(r: number | null): SignalClass {
  if (r == null || !Number.isFinite(r)) return "UNSTABLE";
  if (Math.abs(r) < GOALS_RAD_NEAR_ZERO_ABS_R) return "NEAR_ZERO";
  if (r >= GOALS_RAD_NEAR_ZERO_ABS_R) return "POSITIVE_PERSISTENCE";
  return "NEGATIVE_PERSISTENCE";
}

export function classifyReplication(
  c23: SignalClass,
  c24: SignalClass,
): "REPLICATES" | "DOES_NOT_REPLICATE" | "UNSTABLE" {
  if (c23 === "UNSTABLE" || c24 === "UNSTABLE") return "UNSTABLE";
  if (c23 === c24) return "REPLICATES";
  if (
    (c23 === "POSITIVE_PERSISTENCE" && c24 === "NEGATIVE_PERSISTENCE") ||
    (c23 === "NEGATIVE_PERSISTENCE" && c24 === "POSITIVE_PERSISTENCE")
  ) {
    return "DOES_NOT_REPLICATE";
  }
  if (c23 === "NEAR_ZERO" || c24 === "NEAR_ZERO") {
    return c23 === c24 ? "REPLICATES" : "DOES_NOT_REPLICATE";
  }
  return "DOES_NOT_REPLICATE";
}

export function winsorize(x: number, cap = GOALS_RAD_WINSOR_CAP): number {
  return Math.max(-cap, Math.min(cap, x));
}

export function extremeResidualStrata(
  pairs: readonly SignalPair[],
  side: "attack" | "defense",
): Record<string, { n: number; pearson: number | null }> {
  const out: Record<string, { n: number; pearson: number | null }> = {};
  for (const stratum of GOALS_RAD_ABS_RESIDUAL_STRATA) {
    const filtered = pairs.filter((p) => {
      const hist =
        side === "attack" ? p.historicalAttack : p.historicalDefense;
      const abs = Math.abs(hist);
      const prevMax =
        stratum.id === "lt_1" ? 0 : stratum.id === "1_to_2" ? 1 : 2;
      return abs >= prevMax && abs < stratum.maxExclusive;
    });
    out[stratum.id] = {
      n: filtered.length,
      pearson: associate(filtered, side).pearson,
    };
  }
  return out;
}

export function supportInventory(obs: readonly GoalsRadTeamObservation[]): {
  eligibleObservations: number;
  unavailableLast5: number;
  partialLast5: number;
  availableLast5: number;
  historyCountBuckets: Record<string, number>;
  uniqueTeams: number;
  uniqueFixtures: number;
} {
  const byTeam = groupObservationsByTeam(obs);
  let unavailableLast5 = 0;
  let partialLast5 = 0;
  let availableLast5 = 0;
  const buckets: Record<string, number> = {
    "0": 0,
    "1_2": 0,
    "3_4": 0,
    "5_7": 0,
    "8_plus": 0,
  };
  for (const o of obs) {
    const teamObs = byTeam.get(`${o.season}|${o.teamId}`) ?? [];
    const summaries = computeHistorySummaries(o, teamObs);
    const s = summaries.find((x) => x.windowId === "last_5")!;
    if (s.status === "UNAVAILABLE") unavailableLast5 += 1;
    else if (s.status === "PARTIAL") partialLast5 += 1;
    else availableLast5 += 1;
    const n = s.historyCount;
    if (n === 0) buckets["0"]! += 1;
    else if (n <= 2) buckets["1_2"]! += 1;
    else if (n <= 4) buckets["3_4"]! += 1;
    else if (n <= 7) buckets["5_7"]! += 1;
    else buckets["8_plus"]! += 1;
  }
  return {
    eligibleObservations: obs.length,
    unavailableLast5,
    partialLast5,
    availableLast5,
    historyCountBuckets: buckets,
    uniqueTeams: new Set(obs.map((o) => o.teamId)).size,
    uniqueFixtures: new Set(obs.map((o) => o.fixtureId)).size,
  };
}

export function venueRoleAudit(obs: readonly GoalsRadTeamObservation[]): {
  allVenueAttack: AssociationSummary;
  sameVenueAttack: AssociationSummary;
  allVenueDefense: AssociationSummary;
  sameVenueDefense: AssociationSummary;
} {
  const byTeam = groupObservationsByTeam(obs);
  const allPairs: SignalPair[] = [];
  const samePairs: SignalPair[] = [];
  for (const o of obs) {
    const teamObs = byTeam.get(`${o.season}|${o.teamId}`) ?? [];
    const cmp = last5VenueRoleCompare(o, teamObs);
    if (
      cmp.allVenue.status === "AVAILABLE" &&
      cmp.allVenue.recentAttackResidualMean != null
    ) {
      allPairs.push({
        fixtureId: o.fixtureId,
        teamId: o.teamId,
        venueRole: o.venueRole,
        evidenceSupportBucket: o.evidenceSupportBucket,
        historicalAttack: cmp.allVenue.recentAttackResidualMean,
        historicalDefense: cmp.allVenue.recentDefenseResidualMean!,
        nextAttackResidual: o.attackResidual,
        nextDefenseResidual: o.defenseResidual,
        nextGoalsFor: o.actualGoalsFor,
        nextGoalsAgainst: o.actualGoalsAgainst,
      });
    }
    if (
      cmp.sameVenue.status === "AVAILABLE" &&
      cmp.sameVenue.recentAttackResidualMean != null
    ) {
      samePairs.push({
        fixtureId: o.fixtureId,
        teamId: o.teamId,
        venueRole: o.venueRole,
        evidenceSupportBucket: o.evidenceSupportBucket,
        historicalAttack: cmp.sameVenue.recentAttackResidualMean,
        historicalDefense: cmp.sameVenue.recentDefenseResidualMean!,
        nextAttackResidual: o.attackResidual,
        nextDefenseResidual: o.defenseResidual,
        nextGoalsFor: o.actualGoalsFor,
        nextGoalsAgainst: o.actualGoalsAgainst,
      });
    }
  }
  return {
    allVenueAttack: associate(allPairs, "attack"),
    sameVenueAttack: associate(samePairs, "attack"),
    allVenueDefense: associate(allPairs, "defense"),
    sameVenueDefense: associate(samePairs, "defense"),
  };
}

export function teamDemeanedLast5(
  obs: readonly GoalsRadTeamObservation[],
): {
  rawAttack: AssociationSummary;
  demeanedAttack: AssociationSummary;
  rawDefense: AssociationSummary;
  demeanedDefense: AssociationSummary;
} {
  const byTeam = groupObservationsByTeam(obs);
  const teamMeans = new Map<string, { a: number; d: number }>();
  for (const [key, list] of byTeam) {
    teamMeans.set(key, {
      a: list.reduce((s, o) => s + o.attackResidual, 0) / list.length,
      d: list.reduce((s, o) => s + o.defenseResidual, 0) / list.length,
    });
  }
  const rawPairs = buildSignalPairs(obs, "last_5", 1);
  const demeaned: SignalPair[] = rawPairs.map((p) => {
    const o = obs.find(
      (x) => x.fixtureId === p.fixtureId && x.teamId === p.teamId,
    )!;
    const m = teamMeans.get(`${o.season}|${p.teamId}`)!;
    return {
      ...p,
      historicalAttack: p.historicalAttack - m.a,
      historicalDefense: p.historicalDefense - m.d,
      nextAttackResidual: p.nextAttackResidual - m.a,
      nextDefenseResidual: p.nextDefenseResidual - m.d,
    };
  });
  return {
    rawAttack: associate(rawPairs, "attack"),
    demeanedAttack: associate(demeaned, "attack"),
    rawDefense: associate(rawPairs, "defense"),
    demeanedDefense: associate(demeaned, "defense"),
  };
}

export function horizonPersistence(
  obs: readonly GoalsRadTeamObservation[],
  windowId: "last_5" | "halfLife_28",
): Record<
  string,
  { attack: AssociationSummary; defense: AssociationSummary }
> {
  const out: Record<
    string,
    { attack: AssociationSummary; defense: AssociationSummary }
  > = {};
  for (const h of GOALS_RAD_HORIZONS) {
    const pairs = buildSignalPairs(obs, windowId, h);
    out[`plus_${h}`] = {
      attack: associate(pairs, "attack"),
      defense: associate(pairs, "defense"),
    };
  }
  return out;
}

export function qualityStrata(
  obs: readonly GoalsRadTeamObservation[],
): Record<string, { attack: AssociationSummary; defense: AssociationSummary }> {
  const buckets = ["BASE_PRIOR", "THIN", "DEVELOPING", "ESTABLISHED"];
  const pairs = buildSignalPairs(obs, "last_5", 1);
  const out: Record<
    string,
    { attack: AssociationSummary; defense: AssociationSummary }
  > = {};
  for (const b of buckets) {
    const sub = pairs.filter((p) => p.evidenceSupportBucket === b);
    out[b] = {
      attack: associate(sub, "attack"),
      defense: associate(sub, "defense"),
    };
  }
  return out;
}

export function homeAwayRobustness(
  obs: readonly GoalsRadTeamObservation[],
): {
  HOME: { attack: AssociationSummary; defense: AssociationSummary };
  AWAY: { attack: AssociationSummary; defense: AssociationSummary };
} {
  const pairs = buildSignalPairs(obs, "last_5", 1);
  const home = pairs.filter((p) => p.venueRole === "HOME");
  const away = pairs.filter((p) => p.venueRole === "AWAY");
  return {
    HOME: {
      attack: associate(home, "attack"),
      defense: associate(home, "defense"),
    },
    AWAY: {
      attack: associate(away, "attack"),
      defense: associate(away, "defense"),
    },
  };
}
