/**
 * GOALS-1I.1 — Fixture-cluster bootstrap for rest associations.
 */

import type { GoalsRestTeamObservation } from "@/lib/debug/calibration/goals/rest-schedule/observations";
import { pearson } from "@/lib/debug/calibration/goals/rest-schedule/diagnostics";
import {
  GOALS_REST_BOOTSTRAP_REPS,
  GOALS_REST_BOOTSTRAP_SEED,
} from "@/lib/debug/calibration/goals/rest-schedule/protocol";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export type BootstrapCi = {
  mean: number;
  p2_5: number;
  p50: number;
  p97_5: number;
  excludesZero: boolean;
};

/**
 * Resample fixtures; keep all team-perspective rows for selected fixtures.
 */
export function fixtureClusterRestPearsonCi(
  obs: readonly GoalsRestTeamObservation[],
  residual: "attack" | "defense",
  seed = GOALS_REST_BOOTSTRAP_SEED,
  reps = GOALS_REST_BOOTSTRAP_REPS,
): BootstrapCi | null {
  const avail = obs.filter((o) => o.restFeatureStatus === "AVAILABLE");
  if (avail.length < 20) return null;
  const byFix = new Map<string, GoalsRestTeamObservation[]>();
  for (const o of avail) {
    const list = byFix.get(o.fixtureId) ?? [];
    list.push(o);
    byFix.set(o.fixtureId, list);
  }
  const fixtures = [...byFix.keys()].sort();
  if (fixtures.length < 10) return null;
  const rand = lcg(seed);
  const stats: number[] = [];
  for (let b = 0; b < reps; b += 1) {
    const sampled: GoalsRestTeamObservation[] = [];
    for (let i = 0; i < fixtures.length; i += 1) {
      const id = fixtures[Math.floor(rand() * fixtures.length)]!;
      sampled.push(...(byFix.get(id) ?? []));
    }
    const xs = sampled.map((o) => o.leagueRestDays!);
    const ys = sampled.map((o) =>
      residual === "attack" ? o.attackResidual : o.defenseResidual,
    );
    const r = pearson(xs, ys);
    if (r != null) stats.push(r);
  }
  if (stats.length < 20) return null;
  stats.sort((a, b) => a - b);
  const pct = (p: number) =>
    stats[
      Math.min(
        stats.length - 1,
        Math.max(0, Math.floor((p / 100) * (stats.length - 1))),
      )
    ]!;
  const p2_5 = pct(2.5);
  const p97_5 = pct(97.5);
  return {
    mean: stats.reduce((a, b) => a + b, 0) / stats.length,
    p2_5,
    p50: pct(50),
    p97_5,
    excludesZero: p2_5 > 0 || p97_5 < 0,
  };
}
