/**
 * 5B.8 independent-Poisson scoreline / clamp / truncation forensics.
 * Uses one production predict() per row. Not a tuner.
 */

import { eloGapBucket, xgDiffBucket } from "@/lib/debug/calibration/draw-5b7-buckets";
import {
  createIsolatedDrawEngine,
} from "@/lib/debug/calibration/draw-5b7-trace";
import {
  applyEqualizedRolePrior,
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { frozenValidationConfig } from "@/lib/debug/calibration/validation-5b6-configs";
import { createCurrentCataloguePolicy } from "@/lib/debug/calibration/policies";
import {
  isValidOneXTwo,
  summarizeMetrics,
} from "@/lib/debug/calibration/metrics";
import {
  DRAW_FORENSICS_CONFIG_IDS,
  ELO_GAP_BUCKETS,
  XG_DIFF_BUCKETS,
  type DrawForensicsConfigId,
} from "@/lib/debug/calibration/draw-5b7-shape";
import {
  DRAW_SCORELINE_PARTS,
  OBSERVED_SCORELINE_KEYS,
  PRODUCTION_LAMBDA_CLAMP_MAX,
  type DrawScorelinePart,
  type ObservedScorelineKey,
} from "@/lib/debug/calibration/dc-5b8-shape";
import {
  independentPoissonGrid,
  observedScorelineKey,
  type DrawPartMasses,
  type ScorelineMasses,
} from "@/lib/debug/calibration/dc-5b8-dixon-coles";
import type { CalibrationOutcome, CalibrationRow, OneXTwo } from "@/lib/debug/calibration/types";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

export type PoissonSnapshot = {
  fixtureId: string;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
  actualOutcome: CalibrationOutcome;
  actualHomeGoals: number;
  actualAwayGoals: number;
  observedScoreline: ObservedScorelineKey;
  absEloGap: number;
  absXgDiff: number;
  lambdaHome: number;
  lambdaAway: number;
  clampHome: boolean;
  clampAway: boolean;
  coveredMass: number;
  lostMass: number;
  eloOneXTwo: OneXTwo;
  poissonOneXTwo: OneXTwo;
  hybridOneXTwo: OneXTwo;
  scorelines: ScorelineMasses;
  drawParts: DrawPartMasses;
  poissonBlendWeight: number;
};

function emptyCounts(): Record<ObservedScorelineKey, number> {
  return Object.fromEntries(OBSERVED_SCORELINE_KEYS.map((key) => [key, 0])) as Record<
    ObservedScorelineKey,
    number
  >;
}

function emptyMasses(): ScorelineMasses {
  return Object.fromEntries(OBSERVED_SCORELINE_KEYS.map((key) => [key, 0])) as ScorelineMasses;
}

function emptyParts(): DrawPartMasses {
  return { "0-0": 0, "1-1": 0, "2-2": 0, "3-3": 0, "4-4+": 0 };
}

export function snapshotPoissonRow(input: {
  row: CalibrationRow;
  configId: DrawForensicsConfigId;
  role: "HOLDOUT" | "DEVELOPMENT";
  engine: ReturnType<typeof createIsolatedDrawEngine>;
}): PoissonSnapshot {
  const { row, configId, role, engine } = input;
  if (row.actualOutcome == null || row.actualHomeGoals == null || row.actualAwayGoals == null) {
    throw new Error(`Unlabeled outcome on ${row.fixtureId}`);
  }
  const config = frozenValidationConfig(configId);
  const policy = createCurrentCataloguePolicy();
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
  if (!isValidOneXTwo(hybrid.oneXTwo) || !isValidOneXTwo(hybrid.poisson.oneXTwo)) {
    throw new Error(`Invalid production 1X2 on ${row.fixtureId}`);
  }
  const grid = independentPoissonGrid({
    lambdaHome: hybrid.expectedGoals.home,
    lambdaAway: hybrid.expectedGoals.away,
    maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
  });
  return {
    fixtureId: row.fixtureId,
    season: row.season,
    role,
    configId,
    actualOutcome: row.actualOutcome,
    actualHomeGoals: row.actualHomeGoals,
    actualAwayGoals: row.actualAwayGoals,
    observedScoreline: observedScorelineKey(row.actualHomeGoals, row.actualAwayGoals),
    absEloGap: Math.abs(homeElo - awayElo),
    absXgDiff: Math.abs(hybrid.expectedGoals.home - hybrid.expectedGoals.away),
    lambdaHome: hybrid.expectedGoals.home,
    lambdaAway: hybrid.expectedGoals.away,
    clampHome: hybrid.expectedGoals.home === PRODUCTION_LAMBDA_CLAMP_MAX,
    clampAway: hybrid.expectedGoals.away === PRODUCTION_LAMBDA_CLAMP_MAX,
    coveredMass: hybrid.poisson.coveredMass,
    lostMass: 1 - hybrid.poisson.coveredMass,
    eloOneXTwo: hybrid.elo.oneXTwo,
    poissonOneXTwo: hybrid.poisson.oneXTwo,
    hybridOneXTwo: hybrid.oneXTwo,
    scorelines: grid.scorelines,
    drawParts: grid.drawParts,
    poissonBlendWeight: hybrid.meta.poissonBlendWeight,
  };
}

export function snapshotPoissonSeason(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
}): PoissonSnapshot[] {
  if (!DRAW_FORENSICS_CONFIG_IDS.includes(input.configId)) {
    throw new Error(`DC forensics forbids config ${input.configId}`);
  }
  const before = snapshotDefaultHybridConfig();
  const engine = createIsolatedDrawEngine(frozenValidationConfig(input.configId));
  const snapshots = input.rows.map((row) => {
    if (row.season !== input.season) {
      throw new Error(`Season identity mismatch: row ${row.season} vs ${input.season}`);
    }
    return snapshotPoissonRow({
      row,
      configId: input.configId,
      role: input.role,
      engine,
    });
  });
  assertProductionHybridConfigUnchanged(before);
  return snapshots;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type ScorelineFrequencyRow = {
  key: ObservedScorelineKey;
  observedCount: number;
  observedRate: number;
  meanPredicted: number;
  residual: number;
};

export function scorelineFrequencies(
  snapshots: readonly PoissonSnapshot[],
): ScorelineFrequencyRow[] {
  const counts = emptyCounts();
  const predicted = emptyMasses();
  for (const snapshot of snapshots) {
    counts[snapshot.observedScoreline] += 1;
    for (const key of OBSERVED_SCORELINE_KEYS) {
      predicted[key] += snapshot.scorelines[key];
    }
  }
  const n = snapshots.length;
  return OBSERVED_SCORELINE_KEYS.map((key) => {
    const observedRate = n === 0 ? 0 : counts[key] / n;
    const meanPredicted = n === 0 ? 0 : predicted[key] / n;
    return {
      key,
      observedCount: counts[key],
      observedRate,
      meanPredicted,
      residual: observedRate - meanPredicted,
    };
  });
}

export type DrawPartRow = {
  part: DrawScorelinePart;
  predicted: number;
  observed: number;
  residual: number;
};

export function drawScorelineDecomposition(
  snapshots: readonly PoissonSnapshot[],
): {
  parts: DrawPartRow[];
  predictedDraw: number;
  observedDraw: number;
  partsSumToPredictedDraw: number;
} {
  const n = snapshots.length;
  const predictedParts = emptyParts();
  const observedParts = emptyParts();
  let observedDraw = 0;
  for (const snapshot of snapshots) {
    if (snapshot.actualOutcome === "draw") observedDraw += 1;
    for (const part of DRAW_SCORELINE_PARTS) {
      predictedParts[part] += snapshot.drawParts[part];
    }
    if (snapshot.actualOutcome === "draw") {
      const home = snapshot.actualHomeGoals;
      const away = snapshot.actualAwayGoals;
      if (home === away) {
        if (home === 0) observedParts["0-0"] += 1;
        else if (home === 1) observedParts["1-1"] += 1;
        else if (home === 2) observedParts["2-2"] += 1;
        else if (home === 3) observedParts["3-3"] += 1;
        else observedParts["4-4+"] += 1;
      }
    }
  }
  const parts = DRAW_SCORELINE_PARTS.map((part) => {
    const predicted = n === 0 ? 0 : predictedParts[part] / n;
    const observed = n === 0 ? 0 : observedParts[part] / n;
    return { part, predicted, observed, residual: observed - predicted };
  });
  return {
    parts,
    predictedDraw: mean(snapshots.map((snapshot) => snapshot.poissonOneXTwo.draw)),
    observedDraw: n === 0 ? 0 : observedDraw / n,
    partsSumToPredictedDraw: parts.reduce((sum, row) => sum + row.predicted, 0),
  };
}

export type GapLowScoreRow = {
  bucket: string;
  n: number;
  observed00: number;
  predicted00: number;
  observed11: number;
  predicted11: number;
  observedDraw: number;
  predictedPoissonDraw: number;
  residual: number;
};

function lowScoreCurve(
  snapshots: readonly PoissonSnapshot[],
  bucketOf: (snapshot: PoissonSnapshot) => string,
  labels: readonly string[],
): GapLowScoreRow[] {
  return labels.map((bucket) => {
    const scoped = snapshots.filter((snapshot) => bucketOf(snapshot) === bucket);
    const n = scoped.length;
    const observed00 =
      n === 0 ? 0 : scoped.filter((snapshot) => snapshot.observedScoreline === "0-0").length / n;
    const observed11 =
      n === 0 ? 0 : scoped.filter((snapshot) => snapshot.observedScoreline === "1-1").length / n;
    const observedDraw =
      n === 0 ? 0 : scoped.filter((snapshot) => snapshot.actualOutcome === "draw").length / n;
    const predictedPoissonDraw = mean(scoped.map((snapshot) => snapshot.poissonOneXTwo.draw));
    return {
      bucket,
      n,
      observed00,
      predicted00: mean(scoped.map((snapshot) => snapshot.scorelines["0-0"])),
      observed11,
      predicted11: mean(scoped.map((snapshot) => snapshot.scorelines["1-1"])),
      observedDraw,
      predictedPoissonDraw,
      residual: observedDraw - predictedPoissonDraw,
    };
  });
}

export type ClampCohort = {
  label: "clamp" | "non_clamp";
  n: number;
  observedDraw: number;
  poissonDraw: number;
  hybridDraw: number;
  drawBias: number;
  logLoss: number;
  brier: number;
  meanAbsEloGap: number;
  actualDraws: number;
};

function cohortMetrics(
  snapshots: readonly PoissonSnapshot[],
  label: ClampCohort["label"],
): ClampCohort {
  const n = snapshots.length;
  const observedDraw =
    n === 0 ? 0 : snapshots.filter((snapshot) => snapshot.actualOutcome === "draw").length / n;
  const poissonDraw = mean(snapshots.map((snapshot) => snapshot.poissonOneXTwo.draw));
  const hybridDraw = mean(snapshots.map((snapshot) => snapshot.hybridOneXTwo.draw));
  const metrics =
    n === 0
      ? { logLoss: 0, brier: 0 }
      : summarizeMetrics(
          snapshots.map((snapshot) => ({
            predicted: snapshot.hybridOneXTwo,
            actual: snapshot.actualOutcome,
            bucket: "10+" as const,
            policyId: "current_catalogue",
          })),
        );
  return {
    label,
    n,
    observedDraw,
    poissonDraw,
    hybridDraw,
    drawBias: hybridDraw - observedDraw,
    logLoss: metrics.logLoss,
    brier: metrics.brier,
    meanAbsEloGap: mean(snapshots.map((snapshot) => snapshot.absEloGap)),
    actualDraws: snapshots.filter((snapshot) => snapshot.actualOutcome === "draw").length,
  };
}

export type SeasonPoissonForensics = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
  n: number;
  scorelines: ScorelineFrequencyRow[];
  lowScore: {
    observed00plus11: number;
    predicted00plus11: number;
    residual: number;
  };
  drawDecomposition: ReturnType<typeof drawScorelineDecomposition>;
  eloGap: GapLowScoreRow[];
  xgDiff: GapLowScoreRow[];
  clamp: {
    lambdaHomeEq6: number;
    lambdaAwayEq6: number;
    eitherEq6: number;
    clamp: ClampCohort;
    nonClamp: ClampCohort;
  };
  truncation: {
    minCoveredMass: number;
    meanCoveredMass: number;
    maxCoveredMass: number;
    maxLostMass: number;
  };
};

export function evaluateSeasonPoissonForensics(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
}): SeasonPoissonForensics {
  const snapshots = snapshotPoissonSeason(input);
  const n = snapshots.length;
  const scorelines = scorelineFrequencies(snapshots);
  const low00 = scorelines.find((row) => row.key === "0-0")!;
  const low11 = scorelines.find((row) => row.key === "1-1")!;
  const clampHits = snapshots.filter((snapshot) => snapshot.clampHome || snapshot.clampAway);
  const nonClamp = snapshots.filter((snapshot) => !snapshot.clampHome && !snapshot.clampAway);
  const covered = snapshots.map((snapshot) => snapshot.coveredMass);
  return {
    season: input.season,
    role: input.role,
    configId: input.configId,
    n,
    scorelines,
    lowScore: {
      observed00plus11: low00.observedRate + low11.observedRate,
      predicted00plus11: low00.meanPredicted + low11.meanPredicted,
      residual: low00.residual + low11.residual,
    },
    drawDecomposition: drawScorelineDecomposition(snapshots),
    eloGap: lowScoreCurve(snapshots, (snapshot) => eloGapBucket(snapshot.absEloGap), ELO_GAP_BUCKETS),
    xgDiff: lowScoreCurve(snapshots, (snapshot) => xgDiffBucket(snapshot.absXgDiff), XG_DIFF_BUCKETS),
    clamp: {
      lambdaHomeEq6: snapshots.filter((snapshot) => snapshot.clampHome).length,
      lambdaAwayEq6: snapshots.filter((snapshot) => snapshot.clampAway).length,
      eitherEq6: clampHits.length,
      clamp: cohortMetrics(clampHits, "clamp"),
      nonClamp: cohortMetrics(nonClamp, "non_clamp"),
    },
    truncation: {
      minCoveredMass: covered.length === 0 ? 0 : Math.min(...covered),
      meanCoveredMass: mean(covered),
      maxCoveredMass: covered.length === 0 ? 0 : Math.max(...covered),
      maxLostMass: covered.length === 0 ? 0 : Math.max(...snapshots.map((snapshot) => snapshot.lostMass)),
    },
  };
}
