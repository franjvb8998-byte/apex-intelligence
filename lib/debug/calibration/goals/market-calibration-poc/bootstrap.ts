/**
 * GOALS-1G.2 — Fixture-level bootstrap for delta LL / Brier uncertainty.
 */

import { binaryBrier, binaryLogLoss } from "@/lib/debug/calibration/goals/g0/metrics";
import type { CalibratedObservation } from "@/lib/debug/calibration/goals/market-calibration-poc/apply";
import {
  GOALS_MCAL_POC_BOOTSTRAP_REPLICATES,
  GOALS_MCAL_POC_BOOTSTRAP_SEED,
  type GoalsMcalPocCanonicalMarket,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";

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
  deltaBrier_p2_5: number;
  deltaBrier_p50: number;
  deltaBrier_p97_5: number;
};

function meanDelta(
  rows: readonly CalibratedObservation[],
): { deltaLl: number; deltaBrier: number } {
  if (!rows.length) return { deltaLl: NaN, deltaBrier: NaN };
  let dll = 0;
  let dbr = 0;
  for (const o of rows) {
    const ll0 = binaryLogLoss(o.rawProbability, o.actualBinaryOutcome);
    const ll1 = binaryLogLoss(o.calibratedProbability, o.actualBinaryOutcome);
    const br0 = binaryBrier(o.rawProbability, o.actualBinaryOutcome);
    const br1 = binaryBrier(o.calibratedProbability, o.actualBinaryOutcome);
    dll += ll1 - ll0;
    dbr += br1 - br0;
  }
  return { deltaLl: dll / rows.length, deltaBrier: dbr / rows.length };
}

export function bootstrapDeltaMetrics(
  obs: readonly CalibratedObservation[],
  keys: { key: string; markets: readonly GoalsMcalPocCanonicalMarket[] }[],
  seed: number = GOALS_MCAL_POC_BOOTSTRAP_SEED,
  replicates: number = GOALS_MCAL_POC_BOOTSTRAP_REPLICATES,
): { seed: number; replicates: number; results: DeltaBootstrap[] } {
  const byFixture = new Map<string, CalibratedObservation[]>();
  for (const o of obs) {
    const list = byFixture.get(o.fixtureId) ?? [];
    list.push(o);
    byFixture.set(o.fixtureId, list);
  }
  const fixtureIds = [...byFixture.keys()].sort();
  const rng = mulberry32(seed);

  const samples: Record<string, { dll: number[]; dbr: number[] }> = {};
  for (const k of keys) samples[k.key] = { dll: [], dbr: [] };

  for (let b = 0; b < replicates; b += 1) {
    const picked: CalibratedObservation[] = [];
    for (let i = 0; i < fixtureIds.length; i += 1) {
      const id = fixtureIds[Math.floor(rng() * fixtureIds.length)]!;
      picked.push(...(byFixture.get(id) ?? []));
    }
    for (const k of keys) {
      const set = new Set<string>(k.markets);
      const rows = picked.filter((o) => set.has(o.market));
      const d = meanDelta(rows);
      samples[k.key]!.dll.push(d.deltaLl);
      samples[k.key]!.dbr.push(d.deltaBrier);
    }
  }

  const results: DeltaBootstrap[] = keys.map((k) => {
    const dll = samples[k.key]!.dll.filter(Number.isFinite).sort((a, b) => a - b);
    const dbr = samples[k.key]!.dbr.filter(Number.isFinite).sort((a, b) => a - b);
    return {
      key: k.key,
      meanDeltaLl: dll.reduce((a, b) => a + b, 0) / dll.length,
      meanDeltaBrier: dbr.reduce((a, b) => a + b, 0) / dbr.length,
      deltaLl_p2_5: percentile(dll, 2.5),
      deltaLl_p50: percentile(dll, 50),
      deltaLl_p97_5: percentile(dll, 97.5),
      deltaBrier_p2_5: percentile(dbr, 2.5),
      deltaBrier_p50: percentile(dbr, 50),
      deltaBrier_p97_5: percentile(dbr, 97.5),
    };
  });

  return { seed, replicates, results };
}
