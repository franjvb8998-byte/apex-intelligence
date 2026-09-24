/**
 * GOALS-1F.1 — Deterministic fixture-level bootstrap.
 */

import type { LabeledG1Row } from "@/lib/debug/calibration/goals/distributional-audit/diagnostics";
import {
  dispersionAudit,
  homeAwayDependence,
  lowScoreAudit,
} from "@/lib/debug/calibration/goals/distributional-audit/diagnostics";
import {
  GOALS_DIST_AUDIT_BOOTSTRAP_REPLICATES,
  GOALS_DIST_AUDIT_BOOTSTRAP_SEED,
} from "@/lib/debug/calibration/goals/distributional-audit/protocol";

/** Mulberry32 PRNG — deterministic from seed. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function resample(
  rows: readonly LabeledG1Row[],
  rng: () => number,
): LabeledG1Row[] {
  const n = rows.length;
  const out: LabeledG1Row[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(rows[Math.floor(rng() * n)]!);
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1))),
  );
  return sorted[idx]!;
}

export type BootstrapInterval = {
  mean: number;
  p2_5: number;
  p50: number;
  p97_5: number;
};

function summarize(samples: number[]): BootstrapInterval {
  const s = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    mean,
    p2_5: percentile(s, 2.5),
    p50: percentile(s, 50),
    p97_5: percentile(s, 97.5),
  };
}

export function bootstrapDiagnostics(
  rows: readonly LabeledG1Row[],
  seed: number = GOALS_DIST_AUDIT_BOOTSTRAP_SEED,
  replicates: number = GOALS_DIST_AUDIT_BOOTSTRAP_REPLICATES,
): {
  seed: number;
  replicates: number;
  zeroZeroRateDiff: BootstrapInterval;
  lowScore2x2MassDiff: BootstrapInterval;
  pearsonTotalDispersion: BootstrapInterval;
  residualHomeAwayCorr: BootstrapInterval;
} {
  const rng = mulberry32(seed);
  const zz: number[] = [];
  const ls: number[] = [];
  const pd: number[] = [];
  const rc: number[] = [];

  for (let b = 0; b < replicates; b += 1) {
    const sample = resample(rows, rng);
    const low = lowScoreAudit(sample);
    const n = sample.length || 1;
    zz.push(low.zeroZero.observedFrequency - low.zeroZero.meanPredictedProbability);
    ls.push(low.lowScore2x2.observedMass - low.lowScore2x2.expectedMass);
    pd.push(dispersionAudit(sample).pearsonTotal.statistic);
    const dep = homeAwayDependence(sample);
    rc.push(dep.corrResidualHomeAway ?? 0);
    void n;
  }

  return {
    seed,
    replicates,
    zeroZeroRateDiff: summarize(zz),
    lowScore2x2MassDiff: summarize(ls),
    pearsonTotalDispersion: summarize(pd),
    residualHomeAwayCorr: summarize(rc),
  };
}
