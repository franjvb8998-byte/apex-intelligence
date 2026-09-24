/**
 * GOALS-1G.3 — Fixture bootstrap for selected-vs-R0 deltas on 2024.
 */

import { binaryBrier, binaryLogLoss } from "@/lib/debug/calibration/goals/g0/metrics";
import type { GoalsMcalObservation } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  applyCandidateProbability,
  type RefParams,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/candidates";
import {
  GOALS_MCAL_REF_BOOTSTRAP_REPLICATES,
  GOALS_MCAL_REF_BOOTSTRAP_SEED,
  GOALS_MCAL_REF_MATCH_TOTAL_MARKETS,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1))),
  );
  return sorted[idx]!;
}

export type DeltaBootstrap = {
  key: string;
  meanDeltaLl: number;
  meanDeltaBrier: number;
  deltaLl_p2_5: number;
  deltaLl_p50: number;
  deltaLl_p97_5: number;
};

function meanDelta(
  rows: readonly GoalsMcalObservation[],
  params: RefParams,
): { deltaLl: number; deltaBrier: number } {
  if (!rows.length) return { deltaLl: NaN, deltaBrier: NaN };
  let dll = 0;
  let dbr = 0;
  for (const o of rows) {
    const pCal = applyCandidateProbability(o.market, o.rawProbability, params);
    const ll0 = binaryLogLoss(o.rawProbability, o.actualBinaryOutcome);
    const ll1 = binaryLogLoss(pCal, o.actualBinaryOutcome);
    const br0 = binaryBrier(o.rawProbability, o.actualBinaryOutcome);
    const br1 = binaryBrier(pCal, o.actualBinaryOutcome);
    dll += ll1 - ll0;
    dbr += br1 - br0;
  }
  return { deltaLl: dll / rows.length, deltaBrier: dbr / rows.length };
}

export function bootstrapSelectedVsR0(
  obs2024: readonly GoalsMcalObservation[],
  params: RefParams,
  seed = GOALS_MCAL_REF_BOOTSTRAP_SEED,
  replicates = GOALS_MCAL_REF_BOOTSTRAP_REPLICATES,
): { seed: number; replicates: number; results: DeltaBootstrap[] } {
  const mt = obs2024.filter((o) =>
    (GOALS_MCAL_REF_MATCH_TOTAL_MARKETS as readonly string[]).includes(o.market),
  );
  const byFixture = new Map<string, GoalsMcalObservation[]>();
  for (const o of mt) {
    const list = byFixture.get(o.fixtureId) ?? [];
    list.push(o);
    byFixture.set(o.fixtureId, list);
  }
  const fixtureIds = [...byFixture.keys()].sort();
  const rng = mulberry32(seed);

  const keys = [
    { key: "AGGREGATE", markets: GOALS_MCAL_REF_MATCH_TOTAL_MARKETS },
    { key: "MATCH_TOTAL_OVER_0_5", markets: ["MATCH_TOTAL_OVER_0_5"] as const },
    { key: "MATCH_TOTAL_OVER_1_5", markets: ["MATCH_TOTAL_OVER_1_5"] as const },
    { key: "MATCH_TOTAL_OVER_2_5", markets: ["MATCH_TOTAL_OVER_2_5"] as const },
    { key: "MATCH_TOTAL_OVER_3_5", markets: ["MATCH_TOTAL_OVER_3_5"] as const },
    { key: "MATCH_TOTAL_OVER_4_5", markets: ["MATCH_TOTAL_OVER_4_5"] as const },
  ];

  const samples: Record<string, number[]> = {};
  for (const k of keys) samples[k.key] = [];

  for (let b = 0; b < replicates; b += 1) {
    const picked: GoalsMcalObservation[] = [];
    for (let i = 0; i < fixtureIds.length; i += 1) {
      const id = fixtureIds[Math.floor(rng() * fixtureIds.length)]!;
      picked.push(...(byFixture.get(id) ?? []));
    }
    for (const k of keys) {
      const set = new Set<string>(k.markets);
      const rows = picked.filter((o) => set.has(o.market));
      samples[k.key]!.push(meanDelta(rows, params).deltaLl);
    }
  }

  const results: DeltaBootstrap[] = keys.map((k) => {
    const xs = samples[k.key]!.filter(Number.isFinite).sort((a, b) => a - b);
    return {
      key: k.key,
      meanDeltaLl: xs.reduce((a, b) => a + b, 0) / xs.length,
      meanDeltaBrier: NaN,
      deltaLl_p2_5: percentile(xs, 2.5),
      deltaLl_p50: percentile(xs, 50),
      deltaLl_p97_5: percentile(xs, 97.5),
    };
  });

  return { seed, replicates, results };
}
