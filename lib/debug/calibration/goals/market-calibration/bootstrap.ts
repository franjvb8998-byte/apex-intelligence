/**
 * GOALS-1G.1 — Fixture-level bootstrap for CITL uncertainty.
 */

import type { GoalsMcalObservation } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  GOALS_MCAL_BOOTSTRAP_MARKETS,
  GOALS_MCAL_BOOTSTRAP_REPLICATES,
  GOALS_MCAL_BOOTSTRAP_SEED,
  type GoalsMcalCanonicalMarket,
} from "@/lib/debug/calibration/goals/market-calibration/protocol";

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

export type CitlBootstrap = {
  market: GoalsMcalCanonicalMarket;
  mean: number;
  p2_5: number;
  p50: number;
  p97_5: number;
};

export function bootstrapCitlByMarket(
  obs: readonly GoalsMcalObservation[],
  markets: readonly GoalsMcalCanonicalMarket[] = GOALS_MCAL_BOOTSTRAP_MARKETS,
  seed: number = GOALS_MCAL_BOOTSTRAP_SEED,
  replicates: number = GOALS_MCAL_BOOTSTRAP_REPLICATES,
): { seed: number; replicates: number; markets: CitlBootstrap[] } {
  // Fixture-level: unique fixtures, then take all markets for resampled fixtures
  const byFixture = new Map<string, GoalsMcalObservation[]>();
  for (const o of obs) {
    const list = byFixture.get(o.fixtureId) ?? [];
    list.push(o);
    byFixture.set(o.fixtureId, list);
  }
  const fixtureIds = [...byFixture.keys()].sort();
  const rng = mulberry32(seed);

  const samples: Record<string, number[]> = {};
  for (const m of markets) samples[m] = [];

  for (let b = 0; b < replicates; b += 1) {
    const picked: GoalsMcalObservation[] = [];
    for (let i = 0; i < fixtureIds.length; i += 1) {
      const id = fixtureIds[Math.floor(rng() * fixtureIds.length)]!;
      picked.push(...(byFixture.get(id) ?? []));
    }
    for (const m of markets) {
      const rows = picked.filter((o) => o.market === m);
      if (!rows.length) {
        samples[m]!.push(NaN);
        continue;
      }
      const meanP =
        rows.reduce((s, o) => s + o.rawProbability, 0) / rows.length;
      const meanY =
        rows.reduce((s, o) => s + o.actualBinaryOutcome, 0) / rows.length;
      samples[m]!.push(meanY - meanP);
    }
  }

  const out: CitlBootstrap[] = markets.map((m) => {
    const xs = samples[m]!.filter((x) => Number.isFinite(x)).sort(
      (a, b) => a - b,
    );
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    return {
      market: m,
      mean,
      p2_5: percentile(xs, 2.5),
      p50: percentile(xs, 50),
      p97_5: percentile(xs, 97.5),
    };
  });

  return { seed, replicates, markets: out };
}
