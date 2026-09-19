/**
 * Descriptive pilot diagnostics. Does not change PE / Elo / confidence.
 */

import {
  evaluateCalibrationRows,
  type CalibrationHarnessReport,
  type ScoredCalibrationRow,
} from "@/lib/debug/calibration/evaluate";
import {
  logLossOneXTwo,
  summarizeMetrics,
  type MetricSummary,
} from "@/lib/debug/calibration/metrics";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import type { EloPolicy } from "@/lib/debug/calibration/policies";
import type {
  CalibrationOutcome,
  CalibrationRow,
  OneXTwo,
} from "@/lib/debug/calibration/types";

export const PILOT_DIAGNOSTIC_SCOPES = ["all", "0", "1-3", "4-9", "10+"] as const;
export type PilotDiagnosticScope = (typeof PILOT_DIAGNOSTIC_SCOPES)[number];

export type OutcomeRates = {
  n: number;
  home: number;
  draw: number;
  away: number;
};

export type PredictionBias = {
  home: number;
  draw: number;
  away: number;
};

export type EloGapSummary = {
  n: number;
  mean: number;
  median: number;
  p90Abs: number;
  maxAbs: number;
};

export type ConfidenceBandCounts = {
  low: number;
  medium: number;
  high: number;
};

export type ConfidenceBandLogLoss = {
  n: number;
  logLoss: number;
};

export type PolicySliceDiagnostics = {
  policyId: string;
  scope: PilotDiagnosticScope;
  n: number;
  metrics: MetricSummary;
  meanPredicted: OneXTwo;
  observedRate: OutcomeRates;
  predictionBias: PredictionBias;
  meanConfidence: number;
  confidenceBandCounts: ConfidenceBandCounts;
  logLossByConfidenceBand: Record<"low" | "medium" | "high", ConfidenceBandLogLoss>;
  eloGap: EloGapSummary;
};

export type PilotDiagnostics = {
  overallObservedRates: OutcomeRates;
  slices: PolicySliceDiagnostics[];
};

export type PilotEvaluationReport = CalibrationHarnessReport & {
  diagnostics: PilotDiagnostics;
};

export const NATURAL_FULL_POPULATION_LABEL = "NATURAL FULL POPULATION";
export const STRATIFIED_DIAGNOSTIC_SAMPLE_LABEL = "STRATIFIED DIAGNOSTIC SAMPLE";

export type LabeledPilotDatasetKind =
  | typeof NATURAL_FULL_POPULATION_LABEL
  | typeof STRATIFIED_DIAGNOSTIC_SAMPLE_LABEL;

export type LabeledPilotEvaluation = PilotEvaluationReport & {
  datasetKind: LabeledPilotDatasetKind;
};

export function evaluateNaturalFullPopulation(
  rows: readonly CalibrationRow[],
  policies?: readonly EloPolicy[],
): LabeledPilotEvaluation {
  return {
    datasetKind: NATURAL_FULL_POPULATION_LABEL,
    ...evaluatePilotRows(rows, policies),
  };
}

export function evaluateStratifiedDiagnosticSample(
  rows: readonly CalibrationRow[],
  policies?: readonly EloPolicy[],
): LabeledPilotEvaluation {
  return {
    datasetKind: STRATIFIED_DIAGNOSTIC_SAMPLE_LABEL,
    ...evaluatePilotRows(rows, policies),
  };
}

function labeledRows(rows: readonly CalibrationRow[]): CalibrationRow[] {
  return rows.filter((row) => row.actualOutcome != null);
}

function outcomeRates(rows: readonly CalibrationRow[]): OutcomeRates {
  const usable = labeledRows(rows);
  const n = usable.length;
  if (n === 0) return { n: 0, home: 0, draw: 0, away: 0 };
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const row of usable) {
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

function predictionBias(predicted: OneXTwo, observed: OutcomeRates): PredictionBias {
  return {
    home: predicted.home - observed.home,
    draw: predicted.draw - observed.draw,
    away: predicted.away - observed.away,
  };
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function eloGapSummary(scores: readonly ScoredCalibrationRow[]): EloGapSummary {
  const gaps = scores.map((score) => Math.abs(score.homeElo - score.awayElo)).sort(
    (a, b) => a - b,
  );
  const n = gaps.length;
  if (n === 0) {
    return { n: 0, mean: 0, median: 0, p90Abs: 0, maxAbs: 0 };
  }
  const mean = gaps.reduce((sum, value) => sum + value, 0) / n;
  return {
    n,
    mean,
    median: quantile(gaps, 0.5),
    p90Abs: quantile(gaps, 0.9),
    maxAbs: gaps[n - 1]!,
  };
}

function emptyBandCounts(): ConfidenceBandCounts {
  return { low: 0, medium: 0, high: 0 };
}

function logLossByBand(
  scores: readonly ScoredCalibrationRow[],
  byFixture: Map<string, CalibrationRow>,
): Record<"low" | "medium" | "high", ConfidenceBandLogLoss> {
  const groups: Record<"low" | "medium" | "high", number[]> = {
    low: [],
    medium: [],
    high: [],
  };
  for (const score of scores) {
    const row = byFixture.get(score.fixtureId);
    if (!row?.actualOutcome) continue;
    groups[score.confidenceBand].push(
      logLossOneXTwo(score.oneXTwo, row.actualOutcome as CalibrationOutcome),
    );
  }
  const summarize = (values: number[]): ConfidenceBandLogLoss => ({
    n: values.length,
    logLoss: values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length,
  });
  return {
    low: summarize(groups.low),
    medium: summarize(groups.medium),
    high: summarize(groups.high),
  };
}

function matchesScope(
  row: CalibrationRow,
  scope: PilotDiagnosticScope,
): boolean {
  return scope === "all" || rowEvidenceBucket(row) === scope;
}

function sliceDiagnostics(
  rows: readonly CalibrationRow[],
  scores: readonly ScoredCalibrationRow[],
  policyId: string,
  scope: PilotDiagnosticScope,
): PolicySliceDiagnostics {
  const scopedRows = labeledRows(rows).filter((row) => matchesScope(row, scope));
  const rowIds = new Set(scopedRows.map((row) => row.fixtureId));
  const scopedScores = scores.filter(
    (score) => score.policyId === policyId && rowIds.has(score.fixtureId),
  );
  const byFixture = new Map(scopedRows.map((row) => [row.fixtureId, row]));
  const metricRows = scopedScores.flatMap((score) => {
    const row = byFixture.get(score.fixtureId);
    if (!row?.actualOutcome) return [];
    return [
      {
        predicted: score.oneXTwo,
        actual: row.actualOutcome,
        bucket: score.bucket,
        policyId: score.policyId,
        competitionId: row.competitionId,
        category: row.category,
      },
    ];
  });
  const observed = outcomeRates(scopedRows);
  const predicted = meanPredicted(scopedScores);
  const bands = emptyBandCounts();
  let confidenceSum = 0;
  for (const score of scopedScores) {
    confidenceSum += score.confidence;
    bands[score.confidenceBand] += 1;
  }
  return {
    policyId,
    scope,
    n: scopedScores.length,
    metrics: summarizeMetrics(metricRows),
    meanPredicted: predicted,
    observedRate: observed,
    predictionBias: predictionBias(predicted, observed),
    meanConfidence: scopedScores.length === 0 ? 0 : confidenceSum / scopedScores.length,
    confidenceBandCounts: bands,
    logLossByConfidenceBand: logLossByBand(scopedScores, byFixture),
    eloGap: eloGapSummary(scopedScores),
  };
}

export function buildPilotDiagnostics(
  rows: readonly CalibrationRow[],
  report: CalibrationHarnessReport,
): PilotDiagnostics {
  const policyIds = [...new Set(report.scores.map((score) => score.policyId))];
  const slices: PolicySliceDiagnostics[] = [];
  for (const policyId of policyIds) {
    for (const scope of PILOT_DIAGNOSTIC_SCOPES) {
      slices.push(sliceDiagnostics(rows, report.scores, policyId, scope));
    }
  }
  return {
    overallObservedRates: outcomeRates(rows),
    slices,
  };
}

export function evaluatePilotRows(
  rows: readonly CalibrationRow[],
  policies?: readonly EloPolicy[],
): PilotEvaluationReport {
  const report = evaluateCalibrationRows(rows, policies);
  return {
    ...report,
    diagnostics: buildPilotDiagnostics(rows, report),
  };
}
