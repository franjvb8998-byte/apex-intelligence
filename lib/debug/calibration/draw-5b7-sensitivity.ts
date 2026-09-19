/**
 * eloDrawBase sensitivity. Isolated engines only. Not a search. Not a tuner.
 */

import {
  isValidOneXTwo,
  summarizeMetrics,
  type MetricRow,
} from "@/lib/debug/calibration/metrics";
import { frozenValidationConfig } from "@/lib/debug/calibration/validation-5b6-configs";
import {
  DECLARED_ELO_DRAW_BASE_GRID,
  type DrawForensicsConfigId,
} from "@/lib/debug/calibration/draw-5b7-shape";
import { PRODUCTION_ELO_DRAW_BASE } from "@/lib/debug/calibration/draw-5b7-formula";
import {
  createIsolatedDrawEngine,
  peakOneXTwo,
  traceRowDraw,
} from "@/lib/debug/calibration/draw-5b7-trace";
import {
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import type { CalibrationOutcome, CalibrationRow, OneXTwo } from "@/lib/debug/calibration/types";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

export type DrawBaseSensitivityCell = {
  eloDrawBase: number;
  isCurrent: boolean;
  n: number;
  predictedDrawRate: number;
  drawBias: number;
  logLoss: number;
  brier: number;
  ece: number;
  homeBias: number;
  awayBias: number;
  gte90: number;
};

export function eloDrawBaseSensitivityValues(): number[] {
  const values = [...DECLARED_ELO_DRAW_BASE_GRID, PRODUCTION_ELO_DRAW_BASE];
  return [...new Set(values)].sort((left, right) => left - right);
}

function meanPredicted(vectors: readonly OneXTwo[]): OneXTwo {
  const n = vectors.length;
  if (n === 0) return { home: 0, draw: 0, away: 0 };
  return {
    home: vectors.reduce((sum, item) => sum + item.home, 0) / n,
    draw: vectors.reduce((sum, item) => sum + item.draw, 0) / n,
    away: vectors.reduce((sum, item) => sum + item.away, 0) / n,
  };
}

function observedRate(rows: readonly CalibrationRow[]): OneXTwo {
  const n = rows.length;
  if (n === 0) return { home: 0, draw: 0, away: 0 };
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const row of rows) {
    if (row.actualOutcome === "home") home += 1;
    else if (row.actualOutcome === "draw") draw += 1;
    else away += 1;
  }
  return { home: home / n, draw: draw / n, away: away / n };
}

export function evaluateEloDrawBaseSensitivity(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
}): DrawBaseSensitivityCell[] {
  const before = snapshotDefaultHybridConfig();
  const config = frozenValidationConfig(input.configId);
  const observed = observedRate(input.rows);
  const cells = eloDrawBaseSensitivityValues().map((eloDrawBase) => {
    const engine = createIsolatedDrawEngine(config, { eloDrawBase });
    const traces = input.rows.map((row) =>
      traceRowDraw({
        row,
        configId: input.configId,
        role: input.role,
        engine,
      }),
    );
    const predicted = traces.map((trace) => trace.hybridOneXTwo);
    predicted.forEach((vector, index) => {
      if (!isValidOneXTwo(vector)) {
        throw new Error(`Non-finite 1X2 at ${input.rows[index]?.fixtureId}`);
      }
    });
    const mean = meanPredicted(predicted);
    const metricRows: MetricRow[] = traces.map((trace, index) => ({
      predicted: trace.hybridOneXTwo,
      actual: input.rows[index]!.actualOutcome as CalibrationOutcome,
      bucket: trace.evidenceBucket,
      policyId: trace.policyId,
    }));
    const metrics = summarizeMetrics(metricRows);
    if (metrics.n !== input.rows.length) {
      throw new Error(`Sensitivity N ${metrics.n} !== ${input.rows.length}`);
    }
    return {
      eloDrawBase,
      isCurrent: eloDrawBase === PRODUCTION_ELO_DRAW_BASE,
      n: metrics.n,
      predictedDrawRate: mean.draw,
      drawBias: mean.draw - observed.draw,
      logLoss: metrics.logLoss,
      brier: metrics.brier,
      ece: metrics.ece,
      homeBias: mean.home - observed.home,
      awayBias: mean.away - observed.away,
      gte90: traces.filter((trace) => peakOneXTwo(trace.hybridOneXTwo) >= 0.9).length,
    };
  });
  assertProductionHybridConfigUnchanged(before);
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== PRODUCTION_ELO_DRAW_BASE) {
    throw new Error("Sensitivity mutated DEFAULT_HYBRID_CONFIG.eloDrawBase");
  }
  return cells;
}
