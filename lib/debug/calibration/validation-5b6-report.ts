/**
 * Cross-season reporter for frozen 5B.6 hypotheses.
 * PL 2024 is DEVELOPMENT only and is excluded from holdout aggregates.
 */

import { catalogueCell, type SeasonValidationEvaluation, type ValidationCell } from "@/lib/debug/calibration/validation-5b6-evaluate";
import { VALIDATION_DEVELOPMENT_SEASON } from "@/lib/debug/calibration/validation-5b6-shape";
import type { OneXTwo } from "@/lib/debug/calibration/types";

export type ReplicationAnswer = "YES" | "NO" | "MIXED";

export const PL_2024_DEVELOPMENT_REFERENCE = {
  season: "2024",
  role: "DEVELOPMENT" as const,
  n: 380,
  observed: { n: 380, home: 0.40789473684210525, draw: 0.24473684210526317, away: 0.3473684210526316 },
  catalogue: {
    V0: {
      homeBias: 0.19300418602571928,
      drawBias: -0.0816465542356021,
      awayBias: -0.11135763179011676,
      logLoss: 1.1407390902837289,
      brier: 0.673796134941536,
      ece: 0.16605658172986204,
      predictedDraw: 0.16309028786966107,
      gte90: 36,
    },
    V1: {
      homeBias: 0.0563,
      drawBias: -0.0568,
      awayBias: 0.0005,
      logLoss: 1.0528,
      brier: 0.63,
      ece: 0.1157,
      predictedDraw: 0.1879,
      gte90: 11,
    },
    V5: {
      homeBias: -0.005,
      drawBias: -0.0525,
      awayBias: 0.0575,
      logLoss: 1.0546,
      brier: 0.6329,
      ece: 0.1235,
      predictedDraw: 0.1922,
      gte90: 6,
    },
    bucket10: {
      n: 280,
      V0HomeBias: 0.2056085005144404,
      V1HomeBias: 0.0712,
      V5HomeBias: 0.0107,
    },
  },
};

export type CatalogueDelta = {
  homeBias: number;
  logLoss: number;
  brier: number;
  ece: number;
  drawBias: number;
  awayBias: number;
  gte90: number;
};

export function catalogueDeltas(
  evaluation: SeasonValidationEvaluation,
  scope: "all" | "10+" = "all",
): CatalogueDelta {
  const v0 = catalogueCell(evaluation, "V0", scope);
  const v1 = catalogueCell(evaluation, "V1", scope);
  return {
    homeBias: v1.homeBias - v0.homeBias,
    logLoss: v1.logLoss - v0.logLoss,
    brier: v1.brier - v0.brier,
    ece: v1.ece - v0.ece,
    drawBias: v1.drawBias - v0.drawBias,
    awayBias: v1.awayBias - v0.awayBias,
    gte90: v1.extremeCounts.gte90 - v0.extremeCounts.gte90,
  };
}

function sign(value: number): -1 | 0 | 1 {
  if (value > 1e-12) return 1;
  if (value < -1e-12) return -1;
  return 0;
}

function allSame<T>(values: readonly T[]): boolean {
  return values.every((value) => value === values[0]);
}

function yesNoMixed(flags: readonly boolean[]): ReplicationAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

export function interpretReplication(
  holdouts: readonly SeasonValidationEvaluation[],
): Record<
  | "homeBiasReplication"
  | "properScoreReplication"
  | "calibrationReplication"
  | "matureReplication"
  | "drawReplication"
  | "extremeReplication",
  ReplicationAnswer
> {
  if (holdouts.some((item) => item.season === VALIDATION_DEVELOPMENT_SEASON || item.role === "DEVELOPMENT")) {
    throw new Error("PL 2024 DEVELOPMENT cannot enter holdout replication");
  }
  const home = holdouts.map((season) => {
    const v0 = catalogueCell(season, "V0");
    const v1 = catalogueCell(season, "V1");
    return Math.abs(v1.homeBias) < Math.abs(v0.homeBias);
  });
  const proper = holdouts.map((season) => {
    const delta = catalogueDeltas(season);
    return sign(delta.logLoss) === sign(delta.brier) && sign(delta.logLoss) !== 0;
  });
  const properDirection = holdouts.map((season) => sign(catalogueDeltas(season).logLoss));
  const calibration = holdouts.map((season) => sign(catalogueDeltas(season).ece));
  const mature = holdouts.map((season) => {
    const v0 = catalogueCell(season, "V0", "10+");
    const v1 = catalogueCell(season, "V1", "10+");
    return v1.homeBias < v0.homeBias;
  });
  const draw = holdouts.map((season) => catalogueCell(season, "V5").drawBias < 0);
  const extreme = holdouts.map((season) => {
    const v0 = catalogueCell(season, "V0");
    if (v0.extremeCounts.gte90 === 0) return v0.gapGte200 > 0;
    return v0.gapGte200 >= v0.extremeCounts.gte90 / 2;
  });
  return {
    homeBiasReplication: yesNoMixed(home),
    properScoreReplication: proper.every(Boolean) && allSame(properDirection) ? "YES" : yesNoMixed(proper),
    calibrationReplication: allSame(calibration) && calibration[0] !== 0 ? "YES" : "MIXED",
    matureReplication: yesNoMixed(mature),
    drawReplication: yesNoMixed(draw),
    extremeReplication: yesNoMixed(extreme),
  };
}

function weightedMean(values: readonly number[], weights: readonly number[]): number {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;
  return values.reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0) / total;
}

export function aggregateHoldoutSeasons(
  holdouts: readonly SeasonValidationEvaluation[],
): {
  n: number;
  seasons: string[];
  observed: OneXTwo & { n: number };
  catalogue: Record<"V0" | "V1" | "V5", Pick<ValidationCell, "n" | "logLoss" | "brier" | "ece" | "homeBias" | "drawBias" | "awayBias" | "extremeCounts" | "meanPredicted">>;
} {
  if (holdouts.length === 0) {
    throw new Error("Holdout aggregate requires at least one holdout season");
  }
  for (const season of holdouts) {
    if (season.season === VALIDATION_DEVELOPMENT_SEASON || season.role === "DEVELOPMENT") {
      throw new Error("PL 2024 DEVELOPMENT is excluded from the holdout aggregate");
    }
  }
  const weights = holdouts.map((season) => season.n);
  const n = weights.reduce((sum, value) => sum + value, 0);
  const pick = (configId: "V0" | "V1" | "V5") => {
    const cells = holdouts.map((season) => catalogueCell(season, configId));
    const predHome = weightedMean(cells.map((cell) => cell.meanPredicted.home), weights);
    const predDraw = weightedMean(cells.map((cell) => cell.meanPredicted.draw), weights);
    const predAway = weightedMean(cells.map((cell) => cell.meanPredicted.away), weights);
    const obsHome = weightedMean(cells.map((cell) => cell.observedRate.home), weights);
    const obsDraw = weightedMean(cells.map((cell) => cell.observedRate.draw), weights);
    const obsAway = weightedMean(cells.map((cell) => cell.observedRate.away), weights);
    return {
      n,
      logLoss: weightedMean(cells.map((cell) => cell.logLoss), weights),
      brier: weightedMean(cells.map((cell) => cell.brier), weights),
      ece: weightedMean(cells.map((cell) => cell.ece), weights),
      homeBias: predHome - obsHome,
      drawBias: predDraw - obsDraw,
      awayBias: predAway - obsAway,
      meanPredicted: { home: predHome, draw: predDraw, away: predAway },
      extremeCounts: {
        gte80: cells.reduce((sum, cell) => sum + cell.extremeCounts.gte80, 0),
        gte90: cells.reduce((sum, cell) => sum + cell.extremeCounts.gte90, 0),
        gte95: cells.reduce((sum, cell) => sum + cell.extremeCounts.gte95, 0),
      },
    };
  };
  return {
    n,
    seasons: holdouts.map((season) => season.season),
    observed: {
      n,
      home: weightedMean(holdouts.map((season) => season.observed.home), weights),
      draw: weightedMean(holdouts.map((season) => season.observed.draw), weights),
      away: weightedMean(holdouts.map((season) => season.observed.away), weights),
    },
    catalogue: {
      V0: pick("V0"),
      V1: pick("V1"),
      V5: pick("V5"),
    },
  };
}

export function buildCrossSeasonValidationReport(input: {
  holdouts: readonly SeasonValidationEvaluation[];
  development?: SeasonValidationEvaluation | typeof PL_2024_DEVELOPMENT_REFERENCE;
}): {
  holdouts: readonly SeasonValidationEvaluation[];
  development: SeasonValidationEvaluation | typeof PL_2024_DEVELOPMENT_REFERENCE;
  holdoutAggregate: ReturnType<typeof aggregateHoldoutSeasons>;
  replication: ReturnType<typeof interpretReplication>;
  deltas: Record<string, { all: CatalogueDelta; mature: CatalogueDelta }>;
} {
  const holdoutAggregate = aggregateHoldoutSeasons(input.holdouts);
  return {
    holdouts: input.holdouts,
    development: input.development ?? PL_2024_DEVELOPMENT_REFERENCE,
    holdoutAggregate,
    replication: interpretReplication(input.holdouts),
    deltas: Object.fromEntries(
      input.holdouts.map((season) => [
        season.season,
        { all: catalogueDeltas(season, "all"), mature: catalogueDeltas(season, "10+") },
      ]),
    ),
  };
}
