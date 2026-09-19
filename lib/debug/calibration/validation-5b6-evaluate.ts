/**
 * Offline evaluator for frozen 5B.6 validation configs.
 * Does not search. Does not fit. Does not mutate production PE.
 */

import {
  applyEqualizedRolePrior,
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { isValidOneXTwo, summarizeMetrics } from "@/lib/debug/calibration/metrics";
import {
  createDefaultEloPolicies,
  type EloPolicy,
} from "@/lib/debug/calibration/policies";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import type { ScoredCalibrationRow } from "@/lib/debug/calibration/evaluate";
import {
  FROZEN_VALIDATION_CONFIGS,
  type ValidationConfigId,
  type ValidationHaConfig,
} from "@/lib/debug/calibration/validation-5b6-configs";
import { VALIDATION_PRIMARY_POLICY_ID } from "@/lib/debug/calibration/validation-5b6-shape";
import type {
  CalibrationOutcome,
  CalibrationRow,
  EloPolicyId,
  OneXTwo,
} from "@/lib/debug/calibration/types";
import { confidenceFromHybrid } from "@/lib/intelligence/modules/probability";
import { EloPoissonHybridEngine } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";

export const VALIDATION_SCOPES = ["all", "0", "1-3", "4-9", "10+"] as const;
export type ValidationScope = (typeof VALIDATION_SCOPES)[number];

export type ValidationCell = {
  policyId: EloPolicyId;
  configId: ValidationConfigId;
  scope: ValidationScope;
  n: number;
  logLoss: number;
  brier: number;
  ece: number;
  accuracy: number;
  meanPredicted: OneXTwo;
  observedRate: OneXTwo & { n: number };
  homeBias: number;
  drawBias: number;
  awayBias: number;
  meanConfidence: number;
  extremeCounts: { gte80: number; gte90: number; gte95: number };
  eloGap: { mean: number; median: number; p90Abs: number; maxAbs: number };
  gapGte200: number;
  gapGte250: number;
};

function createValidationEngine(config: ValidationHaConfig): EloPoissonHybridEngine {
  const before = snapshotDefaultHybridConfig();
  const engine = new EloPoissonHybridEngine({
    homeAdvantageElo: config.homeAdvantageElo,
    baseHomeGoals: config.baseHomeGoals,
    baseAwayGoals: config.baseAwayGoals,
  });
  assertProductionHybridConfigUnchanged(before);
  return engine;
}

function scoreRow(
  row: CalibrationRow,
  policy: EloPolicy,
  config: ValidationHaConfig,
  engine: EloPoissonHybridEngine,
): ScoredCalibrationRow {
  const home = policy.resolve(row, "home");
  const away = policy.resolve(row, "away");
  const homeElo = applyEqualizedRolePrior(home.elo, "home", config.equalizeRolePriors);
  const awayElo = applyEqualizedRolePrior(away.elo, "away", config.equalizeRolePriors);
  const hybrid = engine.predict({
    homeElo,
    awayElo,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    matchId: row.fixtureId,
  });
  if (!isValidOneXTwo(hybrid.oneXTwo)) {
    throw new Error(`Invalid 1X2 for ${row.fixtureId} ${policy.id} ${config.id}`);
  }
  const sum = hybrid.oneXTwo.home + hybrid.oneXTwo.draw + hybrid.oneXTwo.away;
  if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-6) {
    throw new Error(`Probability vector does not sum to 1 for ${row.fixtureId}`);
  }
  const confidence = confidenceFromHybrid(hybrid);
  return {
    fixtureId: row.fixtureId,
    policyId: policy.id,
    homeElo,
    awayElo,
    oneXTwo: hybrid.oneXTwo,
    expectedGoals: { home: hybrid.expectedGoals.home, away: hybrid.expectedGoals.away },
    confidence: confidence.value,
    confidenceBand: confidence.band,
    peModelVersion: hybrid.meta.modelVersion,
    bucket: rowEvidenceBucket(row),
  };
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! * (1 - (index - lower)) + sorted[upper]! * (index - lower);
}

function observedRate(rows: readonly CalibrationRow[]): OneXTwo & { n: number } {
  const n = rows.length;
  if (n === 0) return { n: 0, home: 0, draw: 0, away: 0 };
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const row of rows) {
    if (row.actualOutcome === "home") home += 1;
    else if (row.actualOutcome === "draw") draw += 1;
    else away += 1;
  }
  return { n, home: home / n, draw: draw / n, away: away / n };
}

function meanPredicted(scores: readonly ScoredCalibrationRow[]): OneXTwo {
  const n = scores.length;
  if (n === 0) return { home: 0, draw: 0, away: 0 };
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const score of scores) {
    home += score.oneXTwo.home;
    draw += score.oneXTwo.draw;
    away += score.oneXTwo.away;
  }
  return { home: home / n, draw: draw / n, away: away / n };
}

function peak(oneXTwo: OneXTwo): number {
  return Math.max(oneXTwo.home, oneXTwo.draw, oneXTwo.away);
}

function buildCell(
  rows: readonly CalibrationRow[],
  scores: readonly ScoredCalibrationRow[],
  policyId: EloPolicyId,
  configId: ValidationConfigId,
  scope: ValidationScope,
): ValidationCell {
  const scopedRows =
    scope === "all" ? [...rows] : rows.filter((row) => rowEvidenceBucket(row) === scope);
  const ids = new Set(scopedRows.map((row) => row.fixtureId));
  const scopedScores = scores.filter((score) => ids.has(score.fixtureId));
  const byFixture = new Map(scopedRows.map((row) => [row.fixtureId, row]));
  const metricRows = scopedScores.flatMap((score) => {
    const row = byFixture.get(score.fixtureId);
    if (!row?.actualOutcome) return [];
    return [
      {
        predicted: score.oneXTwo,
        actual: row.actualOutcome as CalibrationOutcome,
        bucket: score.bucket,
        policyId: score.policyId,
      },
    ];
  });
  const metrics = summarizeMetrics(metricRows);
  const predicted = meanPredicted(scopedScores);
  const observed = observedRate(scopedRows);
  const gaps = scopedScores.map((score) => Math.abs(score.homeElo - score.awayElo)).sort((a, b) => a - b);
  let gte80 = 0;
  let gte90 = 0;
  let gte95 = 0;
  let gapGte200 = 0;
  let gapGte250 = 0;
  let confidenceSum = 0;
  for (const score of scopedScores) {
    const value = peak(score.oneXTwo);
    if (value >= 0.8) gte80 += 1;
    if (value >= 0.9) gte90 += 1;
    if (value >= 0.95) gte95 += 1;
    const gap = Math.abs(score.homeElo - score.awayElo);
    if (gap >= 200) gapGte200 += 1;
    if (gap >= 250) gapGte250 += 1;
    confidenceSum += score.confidence;
  }
  if (metrics.n !== scopedRows.length) {
    throw new Error(`N mismatch for ${policyId} ${configId} ${scope}`);
  }
  return {
    policyId,
    configId,
    scope,
    n: metrics.n,
    logLoss: metrics.logLoss,
    brier: metrics.brier,
    ece: metrics.ece,
    accuracy: metrics.accuracy,
    meanPredicted: predicted,
    observedRate: observed,
    homeBias: predicted.home - observed.home,
    drawBias: predicted.draw - observed.draw,
    awayBias: predicted.away - observed.away,
    meanConfidence: scopedScores.length === 0 ? 0 : confidenceSum / scopedScores.length,
    extremeCounts: { gte80, gte90, gte95 },
    eloGap: {
      mean: gaps.length === 0 ? 0 : gaps.reduce((sum, value) => sum + value, 0) / gaps.length,
      median: quantile(gaps, 0.5),
      p90Abs: quantile(gaps, 0.9),
      maxAbs: gaps[gaps.length - 1] ?? 0,
    },
    gapGte200,
    gapGte250,
  };
}

export type SeasonValidationEvaluation = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  n: number;
  observed: OneXTwo & { n: number };
  cells: ValidationCell[];
};

export function evaluateValidationSeason(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role?: "HOLDOUT" | "DEVELOPMENT";
  policies?: readonly EloPolicy[];
}): SeasonValidationEvaluation {
  const before = snapshotDefaultHybridConfig();
  const policies = input.policies ?? createDefaultEloPolicies();
  const cells: ValidationCell[] = [];
  for (const config of FROZEN_VALIDATION_CONFIGS) {
    const engine = createValidationEngine(config);
    for (const policy of policies) {
      const scores = input.rows.map((row) => scoreRow(row, policy, config, engine));
      for (const scope of VALIDATION_SCOPES) {
        cells.push(buildCell(input.rows, scores, policy.id, config.id, scope));
      }
    }
  }
  assertProductionHybridConfigUnchanged(before);
  return {
    season: input.season,
    role: input.role ?? "HOLDOUT",
    n: input.rows.length,
    observed: observedRate(input.rows),
    cells,
  };
}

export function catalogueCell(
  evaluation: SeasonValidationEvaluation,
  configId: ValidationConfigId,
  scope: ValidationScope = "all",
): ValidationCell {
  const cell = evaluation.cells.find(
    (item) =>
      item.policyId === VALIDATION_PRIMARY_POLICY_ID &&
      item.configId === configId &&
      item.scope === scope,
  );
  if (!cell) throw new Error(`Missing catalogue cell ${configId} ${scope}`);
  return cell;
}

