/**
 * Offline Elo × HA factorial evaluator.
 * Does not select a production configuration.
 */

import {
  applyEqualizedRolePrior,
  assertProductionHybridConfigUnchanged,
  COMPONENT_CONTRASTS,
  createExperimentalEngine,
  EXPERIMENT_HA_CONFIGS,
  snapshotDefaultHybridConfig,
  type ExperimentHaConfig,
  type ExperimentHaId,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import {
  isValidOneXTwo,
  logLossOneXTwo,
  summarizeMetrics,
} from "@/lib/debug/calibration/metrics";
import { createDefaultEloPolicies, type EloPolicy } from "@/lib/debug/calibration/policies";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import { scoreRowWithPolicy, type ScoredCalibrationRow } from "@/lib/debug/calibration/evaluate";
import type {
  CalibrationOutcome,
  CalibrationRow,
  EloPolicyId,
  EvidenceBucket,
  OneXTwo,
} from "@/lib/debug/calibration/types";
import { confidenceFromHybrid } from "@/lib/intelligence/modules/probability";
import type { ProbabilityEngine } from "@/lib/intelligence/modules/probability";

export const EXPERIMENT_SCOPES = ["all", "0", "1-3", "4-9", "10+"] as const;
export type ExperimentScope = (typeof EXPERIMENT_SCOPES)[number];

export type HomeCalibrationBin = {
  index: number;
  lower: number;
  upper: number;
  n: number;
  meanPredictedHome: number;
  observedHomeRate: number;
  calibrationError: number;
};

export type ExtremeCounts = {
  gte80: number;
  gte90: number;
  gte95: number;
};

export type ExperimentCell = {
  policyId: EloPolicyId;
  haId: ExperimentHaId;
  haFamily: ExperimentHaConfig["family"];
  scope: ExperimentScope;
  n: number;
  logLoss: number;
  brier: number;
  ece: number;
  accuracy: number;
  meanPredicted: OneXTwo;
  observedRate: OneXTwo & { n: number };
  predictionBias: OneXTwo;
  homeBrierComponent: number;
  drawBrierComponent: number;
  awayBrierComponent: number;
  meanConfidence: number;
  confidenceBandCounts: { low: number; medium: number; high: number };
  logLossByConfidenceBand: Record<"low" | "medium" | "high", { n: number; logLoss: number }>;
  extremeCounts: ExtremeCounts;
  homeCalibration: HomeCalibrationBin[];
};

export type ComponentDelta = {
  policyId: EloPolicyId;
  contrastId: string;
  label: string;
  from: ExperimentHaId;
  to: ExperimentHaId;
  deltaHomePredictionMean: number;
  deltaHomeBias: number;
  deltaLogLoss: number;
  deltaBrier: number;
  deltaEce: number;
};

export type CatalogueExtremeTrack = {
  fixtureId: string;
  kickoff: string;
  homeTeamName: string;
  awayTeamName: string;
  bucket: EvidenceBucket;
  homePlayedBefore: number;
  awayPlayedBefore: number;
  actualOutcome: CalibrationRow["actualOutcome"];
  peaks: Record<ExperimentHaId, number>;
  deltasFromHa0: Record<ExperimentHaId, number>;
};

export type FactorialExperimentResult = {
  combinationCount: number;
  cells: ExperimentCell[];
  componentDeltas: ComponentDelta[];
  catalogueExtremeTracks: CatalogueExtremeTrack[];
  productionFingerprint: OneXTwo[];
};

function peak(oneXTwo: OneXTwo): number {
  return Math.max(oneXTwo.home, oneXTwo.draw, oneXTwo.away);
}

function outcomeRates(rows: readonly CalibrationRow[]): OneXTwo & { n: number } {
  const n = rows.length;
  if (n === 0) return { n: 0, home: 0, draw: 0, away: 0 };
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const row of rows) {
    if (row.actualOutcome === "home") home += 1;
    else if (row.actualOutcome === "draw") draw += 1;
    else if (row.actualOutcome === "away") away += 1;
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

function brierComponents(
  scores: readonly ScoredCalibrationRow[],
  byFixture: Map<string, CalibrationRow>,
): { home: number; draw: number; away: number } {
  let home = 0;
  let draw = 0;
  let away = 0;
  let n = 0;
  for (const score of scores) {
    const row = byFixture.get(score.fixtureId);
    if (!row?.actualOutcome) continue;
    const yHome = row.actualOutcome === "home" ? 1 : 0;
    const yDraw = row.actualOutcome === "draw" ? 1 : 0;
    const yAway = row.actualOutcome === "away" ? 1 : 0;
    home += (score.oneXTwo.home - yHome) ** 2;
    draw += (score.oneXTwo.draw - yDraw) ** 2;
    away += (score.oneXTwo.away - yAway) ** 2;
    n += 1;
  }
  return {
    home: n === 0 ? 0 : home / n,
    draw: n === 0 ? 0 : draw / n,
    away: n === 0 ? 0 : away / n,
  };
}

export function homeProbabilityCalibrationBins(
  scores: readonly ScoredCalibrationRow[],
  byFixture: Map<string, CalibrationRow>,
  binCount = 10,
): HomeCalibrationBin[] {
  const bins: HomeCalibrationBin[] = Array.from({ length: binCount }, (_, index) => ({
    index,
    lower: index / binCount,
    upper: (index + 1) / binCount,
    n: 0,
    meanPredictedHome: 0,
    observedHomeRate: 0,
    calibrationError: 0,
  }));
  const sums = bins.map(() => ({ p: 0, hits: 0 }));
  for (const score of scores) {
    const row = byFixture.get(score.fixtureId);
    if (!row?.actualOutcome) continue;
    const last = binCount - 1;
    const index =
      score.oneXTwo.home >= 1
        ? last
        : Math.max(0, Math.min(last, Math.floor(score.oneXTwo.home * binCount)));
    bins[index]!.n += 1;
    sums[index]!.p += score.oneXTwo.home;
    if (row.actualOutcome === "home") sums[index]!.hits += 1;
  }
  for (let i = 0; i < binCount; i += 1) {
    const bin = bins[i]!;
    if (bin.n === 0) continue;
    bin.meanPredictedHome = sums[i]!.p / bin.n;
    bin.observedHomeRate = sums[i]!.hits / bin.n;
    bin.calibrationError = Math.abs(bin.meanPredictedHome - bin.observedHomeRate);
  }
  return bins;
}

function extremeCounts(scores: readonly ScoredCalibrationRow[]): ExtremeCounts {
  let gte80 = 0;
  let gte90 = 0;
  let gte95 = 0;
  for (const score of scores) {
    const value = peak(score.oneXTwo);
    if (value >= 0.8) gte80 += 1;
    if (value >= 0.9) gte90 += 1;
    if (value >= 0.95) gte95 += 1;
  }
  return { gte80, gte90, gte95 };
}

function logLossByBand(
  scores: readonly ScoredCalibrationRow[],
  byFixture: Map<string, CalibrationRow>,
): ExperimentCell["logLossByConfidenceBand"] {
  const groups: Record<"low" | "medium" | "high", number[]> = {
    low: [],
    medium: [],
    high: [],
  };
  for (const score of scores) {
    const row = byFixture.get(score.fixtureId);
    if (!row?.actualOutcome) continue;
    groups[score.confidenceBand].push(logLossOneXTwo(score.oneXTwo, row.actualOutcome));
  }
  const summarize = (values: number[]) => ({
    n: values.length,
    logLoss: values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length,
  });
  return {
    low: summarize(groups.low),
    medium: summarize(groups.medium),
    high: summarize(groups.high),
  };
}

export function scoreRowWithHaConfig(input: {
  row: CalibrationRow;
  policy: EloPolicy;
  ha: ExperimentHaConfig;
  engine: ProbabilityEngine;
}): ScoredCalibrationRow {
  const home = input.policy.resolve(input.row, "home");
  const away = input.policy.resolve(input.row, "away");
  const homeElo = applyEqualizedRolePrior(home.elo, "home", input.ha.equalizeRolePriors);
  const awayElo = applyEqualizedRolePrior(away.elo, "away", input.ha.equalizeRolePriors);
  const hybrid = input.engine.predict({
    homeElo,
    awayElo,
    homeTeamId: input.row.homeTeamId,
    awayTeamId: input.row.awayTeamId,
    matchId: input.row.fixtureId,
  });
  const confidence = confidenceFromHybrid(hybrid);
  if (!isValidOneXTwo(hybrid.oneXTwo)) {
    throw new Error(`Invalid 1X2 for ${input.row.fixtureId} ${input.policy.id} ${input.ha.id}`);
  }
  return {
    fixtureId: input.row.fixtureId,
    policyId: input.policy.id,
    homeElo,
    awayElo,
    oneXTwo: hybrid.oneXTwo,
    expectedGoals: {
      home: hybrid.expectedGoals.home,
      away: hybrid.expectedGoals.away,
    },
    confidence: confidence.value,
    confidenceBand: confidence.band,
    peModelVersion: hybrid.meta.modelVersion,
    bucket: rowEvidenceBucket(input.row),
  };
}

function buildCell(
  rows: readonly CalibrationRow[],
  scores: readonly ScoredCalibrationRow[],
  policyId: EloPolicyId,
  ha: ExperimentHaConfig,
  scope: ExperimentScope,
): ExperimentCell {
  const scopedRows =
    scope === "all"
      ? [...rows]
      : rows.filter((row) => rowEvidenceBucket(row) === scope);
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
  const observed = outcomeRates(scopedRows);
  const components = brierComponents(scopedScores, byFixture);
  const bands = { low: 0, medium: 0, high: 0 };
  let confidenceSum = 0;
  for (const score of scopedScores) {
    confidenceSum += score.confidence;
    bands[score.confidenceBand] += 1;
  }
  if (metrics.n !== scopedRows.length) {
    throw new Error(`N mismatch for ${policyId} ${ha.id} ${scope}: ${metrics.n} vs ${scopedRows.length}`);
  }
  return {
    policyId,
    haId: ha.id,
    haFamily: ha.family,
    scope,
    n: metrics.n,
    logLoss: metrics.logLoss,
    brier: metrics.brier,
    ece: metrics.ece,
    accuracy: metrics.accuracy,
    meanPredicted: predicted,
    observedRate: observed,
    predictionBias: {
      home: predicted.home - observed.home,
      draw: predicted.draw - observed.draw,
      away: predicted.away - observed.away,
    },
    homeBrierComponent: components.home,
    drawBrierComponent: components.draw,
    awayBrierComponent: components.away,
    meanConfidence: scopedScores.length === 0 ? 0 : confidenceSum / scopedScores.length,
    confidenceBandCounts: bands,
    logLossByConfidenceBand: logLossByBand(scopedScores, byFixture),
    extremeCounts: extremeCounts(scopedScores),
    homeCalibration: homeProbabilityCalibrationBins(scopedScores, byFixture),
  };
}

export function evaluateFactorialExperiment(
  rows: readonly CalibrationRow[],
  policies: readonly EloPolicy[] = createDefaultEloPolicies(),
): FactorialExperimentResult {
  const before = snapshotDefaultHybridConfig();
  const productionFingerprint = rows.map((row) => {
    const policy = policies.find((item) => item.id === "current_catalogue") ?? policies[0]!;
    return scoreRowWithPolicy(row, policy).oneXTwo;
  });

  const cells: ExperimentCell[] = [];
  const cataloguePeaks = new Map<string, Partial<Record<ExperimentHaId, number>>>();

  for (const ha of EXPERIMENT_HA_CONFIGS) {
    const engine = createExperimentalEngine(ha);
    for (const policy of policies) {
      const scores = rows.map((row) =>
        scoreRowWithHaConfig({ row, policy, ha, engine }),
      );
      for (const score of scores) {
        if (!Number.isFinite(score.oneXTwo.home + score.oneXTwo.draw + score.oneXTwo.away)) {
          throw new Error("Non-finite probability vector");
        }
        if (Math.abs(score.oneXTwo.home + score.oneXTwo.draw + score.oneXTwo.away - 1) > 1e-6) {
          throw new Error("Probability vector does not sum to 1");
        }
      }
      for (const scope of EXPERIMENT_SCOPES) {
        cells.push(buildCell(rows, scores, policy.id, ha, scope));
      }
      if (policy.id === "current_catalogue") {
        for (const score of scores) {
          const current = cataloguePeaks.get(score.fixtureId) ?? {};
          current[ha.id] = peak(score.oneXTwo);
          cataloguePeaks.set(score.fixtureId, current);
        }
      }
    }
    assertProductionHybridConfigUnchanged(before);
  }

  const overall = cells.filter((cell) => cell.scope === "all");
  const byKey = new Map(
    overall.map((cell) => [`${cell.policyId}:${cell.haId}`, cell]),
  );
  const componentDeltas: ComponentDelta[] = [];
  for (const policy of policies) {
    for (const contrast of COMPONENT_CONTRASTS) {
      const from = byKey.get(`${policy.id}:${contrast.from}`);
      const to = byKey.get(`${policy.id}:${contrast.to}`);
      if (!from || !to) continue;
      componentDeltas.push({
        policyId: policy.id,
        contrastId: contrast.id,
        label: contrast.label,
        from: contrast.from,
        to: contrast.to,
        deltaHomePredictionMean: to.meanPredicted.home - from.meanPredicted.home,
        deltaHomeBias: to.predictionBias.home - from.predictionBias.home,
        deltaLogLoss: to.logLoss - from.logLoss,
        deltaBrier: to.brier - from.brier,
        deltaEce: to.ece - from.ece,
      });
    }
  }

  const ha0Catalogue = rows
    .map((row) => {
      const peaks = cataloguePeaks.get(row.fixtureId) ?? {};
      const ha0 = peaks.HA0_PRODUCTION ?? 0;
      return { row, peaks, ha0 };
    })
    .filter((item) => item.ha0 >= 0.8)
    .sort((a, b) => b.ha0 - a.ha0);

  const catalogueExtremeTracks: CatalogueExtremeTrack[] = ha0Catalogue.map((item) => {
    const peaks = {} as Record<ExperimentHaId, number>;
    const deltasFromHa0 = {} as Record<ExperimentHaId, number>;
    for (const ha of EXPERIMENT_HA_CONFIGS) {
      const value = item.peaks[ha.id] ?? 0;
      peaks[ha.id] = value;
      deltasFromHa0[ha.id] = value - item.ha0;
    }
    return {
      fixtureId: item.row.fixtureId,
      kickoff: item.row.kickoff,
      homeTeamName: item.row.homeTeamName,
      awayTeamName: item.row.awayTeamName,
      bucket: rowEvidenceBucket(item.row),
      homePlayedBefore: item.row.homePlayedBefore,
      awayPlayedBefore: item.row.awayPlayedBefore,
      actualOutcome: item.row.actualOutcome,
      peaks,
      deltasFromHa0,
    };
  });

  const afterFingerprint = rows.map((row) => {
    const policy = policies.find((item) => item.id === "current_catalogue") ?? policies[0]!;
    return scoreRowWithPolicy(row, policy).oneXTwo;
  });
  for (let i = 0; i < productionFingerprint.length; i += 1) {
    const beforeVec = productionFingerprint[i]!;
    const afterVec = afterFingerprint[i]!;
    if (
      beforeVec.home !== afterVec.home ||
      beforeVec.draw !== afterVec.draw ||
      beforeVec.away !== afterVec.away
    ) {
      throw new Error("Production prediction changed after the experiment");
    }
  }
  assertProductionHybridConfigUnchanged(before);

  return {
    combinationCount: policies.length * EXPERIMENT_HA_CONFIGS.length,
    cells,
    componentDeltas,
    catalogueExtremeTracks,
    productionFingerprint,
  };
}

export function cellBrierMatchesComponents(cell: ExperimentCell): boolean {
  const reconstructed = cell.homeBrierComponent + cell.drawBrierComponent + cell.awayBrierComponent;
  return Math.abs(reconstructed - cell.brier) < 1e-12;
}
