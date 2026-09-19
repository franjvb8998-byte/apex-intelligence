/**
 * Dixon-Coles rho sensitivity. Isolated debug grids only. Not a search.
 */

import { blendOneXTwo } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import {
  isValidOneXTwo,
  summarizeMetrics,
} from "@/lib/debug/calibration/metrics";
import { DECLARED_DIXON_COLES_RHO_GRID } from "@/lib/debug/calibration/dc-5b8-shape";
import {
  buildScoreGrid,
  type DixonColesFailure,
} from "@/lib/debug/calibration/dc-5b8-dixon-coles";
import {
  snapshotPoissonSeason,
  type PoissonSnapshot,
} from "@/lib/debug/calibration/dc-5b8-evaluate";
import { peakOneXTwo } from "@/lib/debug/calibration/draw-5b7-trace";
import { xgDiffBucket } from "@/lib/debug/calibration/draw-5b7-buckets";
import type { DrawForensicsConfigId } from "@/lib/debug/calibration/draw-5b7-shape";
import type { CalibrationRow, OneXTwo } from "@/lib/debug/calibration/types";
import {
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";

export type DixonColesSensitivityCell = {
  rho: number;
  valid: boolean;
  n: number;
  poissonPredictedDraw: number | null;
  hybridPredictedDraw: number | null;
  drawBias: number | null;
  logLoss: number | null;
  brier: number | null;
  ece: number | null;
  homeBias: number | null;
  awayBias: number | null;
  gte90: number | null;
  predicted00: number | null;
  predicted11: number | null;
  predicted01: number | null;
  predicted10: number | null;
  largeXgDiffDrawBias: number | null;
  failures: DixonColesFailure[];
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function observedRates(snapshots: readonly PoissonSnapshot[]): OneXTwo {
  const n = snapshots.length;
  if (n === 0) return { home: 0, draw: 0, away: 0 };
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const snapshot of snapshots) {
    if (snapshot.actualOutcome === "home") home += 1;
    else if (snapshot.actualOutcome === "draw") draw += 1;
    else away += 1;
  }
  return { home: home / n, draw: draw / n, away: away / n };
}

export function evaluateDixonColesRho(input: {
  snapshots: readonly PoissonSnapshot[];
  rho: number;
}): DixonColesSensitivityCell {
  const failures: DixonColesFailure[] = [];
  const poissonVectors: OneXTwo[] = [];
  const hybridVectors: OneXTwo[] = [];
  const p00: number[] = [];
  const p11: number[] = [];
  const p01: number[] = [];
  const p10: number[] = [];
  const largeGapHybridDraw: number[] = [];
  const largeGapObserved: number[] = [];

  for (const snapshot of input.snapshots) {
    const grid = buildScoreGrid({
      lambdaHome: snapshot.lambdaHome,
      lambdaAway: snapshot.lambdaAway,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
      rho: input.rho,
      fixtureId: snapshot.fixtureId,
    });
    if (!grid.ok) {
      failures.push(grid.failure);
      continue;
    }
    const hybrid = blendOneXTwo(
      grid.oneXTwo,
      snapshot.eloOneXTwo,
      snapshot.poissonBlendWeight,
    );
    if (!isValidOneXTwo(grid.oneXTwo) || !isValidOneXTwo(hybrid)) {
      failures.push({
        rho: input.rho,
        fixtureId: snapshot.fixtureId,
        homeGoals: -1,
        awayGoals: -1,
        lambdaHome: snapshot.lambdaHome,
        lambdaAway: snapshot.lambdaAway,
        tau: Number.NaN,
        reason: "blended or Poisson 1X2 is not finite or does not sum to 1",
      });
      continue;
    }
    poissonVectors.push(grid.oneXTwo);
    hybridVectors.push(hybrid);
    p00.push(grid.scorelines["0-0"]);
    p11.push(grid.scorelines["1-1"]);
    p01.push(grid.scorelines["0-1"]);
    p10.push(grid.scorelines["1-0"]);
    if (xgDiffBucket(snapshot.absXgDiff) === "1.50+") {
      largeGapHybridDraw.push(hybrid.draw);
      largeGapObserved.push(snapshot.actualOutcome === "draw" ? 1 : 0);
    }
  }

  if (failures.length > 0) {
    return {
      rho: input.rho,
      valid: false,
      n: input.snapshots.length,
      poissonPredictedDraw: null,
      hybridPredictedDraw: null,
      drawBias: null,
      logLoss: null,
      brier: null,
      ece: null,
      homeBias: null,
      awayBias: null,
      gte90: null,
      predicted00: null,
      predicted11: null,
      predicted01: null,
      predicted10: null,
      largeXgDiffDrawBias: null,
      failures,
    };
  }

  const observed = observedRates(input.snapshots);
  const poissonDraw = mean(poissonVectors.map((vector) => vector.draw));
  const hybridDraw = mean(hybridVectors.map((vector) => vector.draw));
  const hybridHome = mean(hybridVectors.map((vector) => vector.home));
  const hybridAway = mean(hybridVectors.map((vector) => vector.away));
  const metrics = summarizeMetrics(
    input.snapshots.map((snapshot, index) => ({
      predicted: hybridVectors[index]!,
      actual: snapshot.actualOutcome,
      bucket: "10+" as const,
      policyId: "current_catalogue",
    })),
  );
  return {
    rho: input.rho,
    valid: true,
    n: input.snapshots.length,
    poissonPredictedDraw: poissonDraw,
    hybridPredictedDraw: hybridDraw,
    drawBias: hybridDraw - observed.draw,
    logLoss: metrics.logLoss,
    brier: metrics.brier,
    ece: metrics.ece,
    homeBias: hybridHome - observed.home,
    awayBias: hybridAway - observed.away,
    gte90: hybridVectors.filter((vector) => peakOneXTwo(vector) >= 0.9).length,
    predicted00: mean(p00),
    predicted11: mean(p11),
    predicted01: mean(p01),
    predicted10: mean(p10),
    largeXgDiffDrawBias:
      largeGapHybridDraw.length === 0
        ? null
        : mean(largeGapHybridDraw) - mean(largeGapObserved),
    failures,
  };
}

export function evaluateDixonColesSensitivity(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
}): DixonColesSensitivityCell[] {
  const before = snapshotDefaultHybridConfig();
  const snapshots = snapshotPoissonSeason(input);
  const cells = DECLARED_DIXON_COLES_RHO_GRID.map((rho) =>
    evaluateDixonColesRho({ snapshots, rho }),
  );
  assertProductionHybridConfigUnchanged(before);
  return cells;
}
