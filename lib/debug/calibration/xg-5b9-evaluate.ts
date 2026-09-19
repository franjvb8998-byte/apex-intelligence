/**
 * Empirical Elo→λ geometry on persisted seasons. Not a tuner.
 */

import { eloGapBucket } from "@/lib/debug/calibration/draw-5b7-buckets";
import { createIsolatedDrawEngine, peakOneXTwo } from "@/lib/debug/calibration/draw-5b7-trace";
import {
  ELO_GAP_BUCKETS,
  type DrawForensicsSeason,
} from "@/lib/debug/calibration/draw-5b7-shape";
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
import { confidenceFromHybrid } from "@/lib/intelligence/modules/probability";
import {
  eloToExpectedGoalsMirrored,
  productionEloXgInputs,
} from "@/lib/debug/calibration/xg-5b9-formula";
import {
  CLAMP_COHORTS,
  LAMBDA_RATIO_BUCKETS,
  type ClampCohortId,
  type LambdaRatioBucket,
} from "@/lib/debug/calibration/xg-5b9-shape";
import {
  distributionSummary,
  lambdaRatio,
  lambdaRatioBucket,
  totalXg,
} from "@/lib/debug/calibration/xg-5b9-geometry";
import type {
  CalibrationOutcome,
  CalibrationRow,
  OneXTwo,
} from "@/lib/debug/calibration/types";

export type NumericFailure = {
  fixtureId: string;
  reason: string;
  lambdaHome?: number;
  lambdaAway?: number;
};

export type LambdaSnapshot = {
  fixtureId: string;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  kickoff: string;
  homeTeamName: string;
  awayTeamName: string;
  actualOutcome: CalibrationOutcome;
  actualHomeGoals: number;
  actualAwayGoals: number;
  homeElo: number;
  awayElo: number;
  rawEloDiff: number;
  absEloGap: number;
  lambdaHome: number;
  lambdaAway: number;
  lambdaHomeUnclamped: number;
  lambdaAwayUnclamped: number;
  ratio: number;
  totalXg: number;
  poissonOneXTwo: OneXTwo;
  eloOneXTwo: OneXTwo;
  hybridOneXTwo: OneXTwo;
  confidence: number;
  clampCohort: ClampCohortId;
};

export function clampCohortOf(input: {
  clampHomeMax: boolean;
  clampAwayMax: boolean;
  clampHomeMin: boolean;
  clampAwayMin: boolean;
}): ClampCohortId {
  const hits = [
    input.clampHomeMax,
    input.clampAwayMax,
    input.clampHomeMin,
    input.clampAwayMin,
  ].filter(Boolean).length;
  if (hits === 0) return "NO_CLAMP";
  if (hits > 1) return "MULTIPLE_CLAMP";
  if (input.clampHomeMax) return "HOME_MAX_CLAMP";
  if (input.clampAwayMax) return "AWAY_MAX_CLAMP";
  if (input.clampHomeMin) return "HOME_MIN_CLAMP";
  return "AWAY_MIN_CLAMP";
}

function favoriteSide(oneXTwo: OneXTwo): "home" | "away" {
  return oneXTwo.home >= oneXTwo.away ? "home" : "away";
}

export function snapshotLambdaRow(input: {
  row: CalibrationRow;
  role: "HOLDOUT" | "DEVELOPMENT";
  engine: ReturnType<typeof createIsolatedDrawEngine>;
}): LambdaSnapshot {
  const { row, role, engine } = input;
  if (row.actualOutcome == null || row.actualHomeGoals == null || row.actualAwayGoals == null) {
    throw new Error(`Unlabeled outcome on ${row.fixtureId}`);
  }
  const config = frozenValidationConfig("V0");
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
  if (
    !isValidOneXTwo(hybrid.oneXTwo) ||
    !isValidOneXTwo(hybrid.poisson.oneXTwo) ||
    !isValidOneXTwo(hybrid.elo.oneXTwo)
  ) {
    throw new Error(`Invalid production 1X2 on ${row.fixtureId}`);
  }
  const mapped = eloToExpectedGoalsMirrored({
    ...productionEloXgInputs(),
    homeElo,
    awayElo,
  });
  if (
    mapped.lambdaHomeClamped !== hybrid.expectedGoals.home ||
    mapped.lambdaAwayClamped !== hybrid.expectedGoals.away
  ) {
    throw new Error(`Mirrored λ diverged from production predict() on ${row.fixtureId}`);
  }
  return {
    fixtureId: row.fixtureId,
    season: row.season,
    role,
    kickoff: row.kickoff,
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    actualOutcome: row.actualOutcome,
    actualHomeGoals: row.actualHomeGoals,
    actualAwayGoals: row.actualAwayGoals,
    homeElo,
    awayElo,
    rawEloDiff: homeElo - awayElo,
    absEloGap: Math.abs(homeElo - awayElo),
    lambdaHome: hybrid.expectedGoals.home,
    lambdaAway: hybrid.expectedGoals.away,
    lambdaHomeUnclamped: mapped.lambdaHomeUnclamped,
    lambdaAwayUnclamped: mapped.lambdaAwayUnclamped,
    ratio: lambdaRatio(hybrid.expectedGoals.home, hybrid.expectedGoals.away),
    totalXg: totalXg(hybrid.expectedGoals.home, hybrid.expectedGoals.away),
    poissonOneXTwo: hybrid.poisson.oneXTwo,
    eloOneXTwo: hybrid.elo.oneXTwo,
    hybridOneXTwo: hybrid.oneXTwo,
    confidence: confidenceFromHybrid(hybrid).value,
    clampCohort: clampCohortOf(mapped),
  };
}

export function snapshotLambdaSeason(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
}): LambdaSnapshot[] {
  const before = snapshotDefaultHybridConfig();
  const engine = createIsolatedDrawEngine(frozenValidationConfig("V0"));
  const snapshots = input.rows.map((row) => {
    if (row.season !== input.season) {
      throw new Error(`Season identity mismatch: row ${row.season} vs ${input.season}`);
    }
    return snapshotLambdaRow({ row, role: input.role, engine });
  });
  assertProductionHybridConfigUnchanged(before);
  return snapshots;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function observedRates(snapshots: readonly LambdaSnapshot[]): OneXTwo {
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

function meanOneXTwo(
  snapshots: readonly LambdaSnapshot[],
  pick: (snapshot: LambdaSnapshot) => OneXTwo,
): OneXTwo {
  if (snapshots.length === 0) return { home: 0, draw: 0, away: 0 };
  return {
    home: mean(snapshots.map((snapshot) => pick(snapshot).home)),
    draw: mean(snapshots.map((snapshot) => pick(snapshot).draw)),
    away: mean(snapshots.map((snapshot) => pick(snapshot).away)),
  };
}

export type GeometryCohortMetrics = {
  n: number;
  observed: OneXTwo;
  poisson: OneXTwo;
  hybrid: OneXTwo;
  drawBias: number;
  homeBias: number;
  awayBias: number;
  logLoss: number;
  brier: number;
  ece: number;
  meanConfidence: number;
  gte80: number;
  gte90: number;
  favoriteBias: number;
  actualUpsetCount: number;
  actualDrawCount: number;
};

export function cohortMetrics(snapshots: readonly LambdaSnapshot[]): GeometryCohortMetrics {
  const n = snapshots.length;
  const observed = observedRates(snapshots);
  const poisson = meanOneXTwo(snapshots, (snapshot) => snapshot.poissonOneXTwo);
  const hybrid = meanOneXTwo(snapshots, (snapshot) => snapshot.hybridOneXTwo);
  const metrics =
    n === 0
      ? { logLoss: 0, brier: 0, ece: 0 }
      : summarizeMetrics(
          snapshots.map((snapshot) => ({
            predicted: snapshot.hybridOneXTwo,
            actual: snapshot.actualOutcome,
            bucket: "10+" as const,
            policyId: "current_catalogue",
          })),
        );
  let favoriteHits = 0;
  let favoritePredicted = 0;
  let upsets = 0;
  for (const snapshot of snapshots) {
    const favorite = favoriteSide(snapshot.hybridOneXTwo);
    favoritePredicted += snapshot.hybridOneXTwo[favorite];
    if (snapshot.actualOutcome === favorite) favoriteHits += 1;
    const underdog = favorite === "home" ? "away" : "home";
    if (snapshot.actualOutcome === underdog) upsets += 1;
  }
  return {
    n,
    observed,
    poisson,
    hybrid,
    drawBias: hybrid.draw - observed.draw,
    homeBias: hybrid.home - observed.home,
    awayBias: hybrid.away - observed.away,
    logLoss: metrics.logLoss,
    brier: metrics.brier,
    ece: metrics.ece,
    meanConfidence: mean(snapshots.map((snapshot) => snapshot.confidence)),
    gte80: snapshots.filter((snapshot) => peakOneXTwo(snapshot.hybridOneXTwo) >= 0.8).length,
    gte90: snapshots.filter((snapshot) => peakOneXTwo(snapshot.hybridOneXTwo) >= 0.9).length,
    favoriteBias: n === 0 ? 0 : favoritePredicted / n - favoriteHits / n,
    actualUpsetCount: upsets,
    actualDrawCount: snapshots.filter((snapshot) => snapshot.actualOutcome === "draw").length,
  };
}

export type LambdaDistributions = {
  lambdaHome: ReturnType<typeof distributionSummary>;
  lambdaAway: ReturnType<typeof distributionSummary>;
  lambdaRatio: ReturnType<typeof distributionSummary>;
  totalXg: ReturnType<typeof distributionSummary>;
};

export function lambdaDistributions(snapshots: readonly LambdaSnapshot[]): LambdaDistributions {
  return {
    lambdaHome: distributionSummary(snapshots.map((snapshot) => snapshot.lambdaHome)),
    lambdaAway: distributionSummary(snapshots.map((snapshot) => snapshot.lambdaAway)),
    lambdaRatio: distributionSummary(snapshots.map((snapshot) => snapshot.ratio)),
    totalXg: distributionSummary(snapshots.map((snapshot) => snapshot.totalXg)),
  };
}

export type RatioBucketRow = GeometryCohortMetrics & {
  bucket: LambdaRatioBucket;
};

export function ratioBucketRows(snapshots: readonly LambdaSnapshot[]): RatioBucketRow[] {
  return LAMBDA_RATIO_BUCKETS.map((bucket) => {
    const scoped = snapshots.filter(
      (snapshot) => lambdaRatioBucket(snapshot.ratio) === bucket,
    );
    return { bucket, ...cohortMetrics(scoped) };
  });
}

export type EloGapPropagationRow = {
  bucket: string;
  n: number;
  meanLambdaHome: number;
  meanLambdaAway: number;
  medianLambdaRatio: number;
  p90LambdaRatio: number;
  meanTotalXg: number;
  observedDraw: number;
  poissonDraw: number;
  hybridDraw: number;
  drawResidual: number;
};

export function eloGapPropagation(snapshots: readonly LambdaSnapshot[]): EloGapPropagationRow[] {
  return ELO_GAP_BUCKETS.map((bucket) => {
    const scoped = snapshots.filter((snapshot) => eloGapBucket(snapshot.absEloGap) === bucket);
    const ratios = scoped.map((snapshot) => snapshot.ratio);
    const observedDraw =
      scoped.length === 0
        ? 0
        : scoped.filter((snapshot) => snapshot.actualOutcome === "draw").length / scoped.length;
    const poissonDraw = mean(scoped.map((snapshot) => snapshot.poissonOneXTwo.draw));
    const hybridDraw = mean(scoped.map((snapshot) => snapshot.hybridOneXTwo.draw));
    return {
      bucket,
      n: scoped.length,
      meanLambdaHome: mean(scoped.map((snapshot) => snapshot.lambdaHome)),
      meanLambdaAway: mean(scoped.map((snapshot) => snapshot.lambdaAway)),
      medianLambdaRatio: distributionSummary(ratios).median,
      p90LambdaRatio: distributionSummary(ratios).p90,
      meanTotalXg: mean(scoped.map((snapshot) => snapshot.totalXg)),
      observedDraw,
      poissonDraw,
      hybridDraw,
      drawResidual: observedDraw - poissonDraw,
    };
  });
}

export type SideDistribution = ReturnType<typeof distributionSummary>;

export type ActualDrawGeometry = {
  nDraws: number;
  nNonDraws: number;
  draws: {
    absEloGap: SideDistribution;
    lambdaHome: SideDistribution;
    lambdaAway: SideDistribution;
    lambdaRatio: SideDistribution;
    totalXg: SideDistribution;
    poissonDraw: SideDistribution;
    hybridDraw: SideDistribution;
  };
  nonDraws: {
    absEloGap: SideDistribution;
    lambdaRatio: SideDistribution;
    poissonDraw: SideDistribution;
    hybridDraw: SideDistribution;
  };
  drawsRatioGe3: number;
  drawsRatioGe5: number;
  drawsRatioGe8: number;
  drawsRatioGe12: number;
  drawsHybridLt10: number;
  drawsHybridLt05: number;
  drawsHybridLt025: number;
};

export function actualDrawGeometry(snapshots: readonly LambdaSnapshot[]): ActualDrawGeometry {
  const draws = snapshots.filter((snapshot) => snapshot.actualOutcome === "draw");
  const nonDraws = snapshots.filter((snapshot) => snapshot.actualOutcome !== "draw");
  return {
    nDraws: draws.length,
    nNonDraws: nonDraws.length,
    draws: {
      absEloGap: distributionSummary(draws.map((snapshot) => snapshot.absEloGap)),
      lambdaHome: distributionSummary(draws.map((snapshot) => snapshot.lambdaHome)),
      lambdaAway: distributionSummary(draws.map((snapshot) => snapshot.lambdaAway)),
      lambdaRatio: distributionSummary(draws.map((snapshot) => snapshot.ratio)),
      totalXg: distributionSummary(draws.map((snapshot) => snapshot.totalXg)),
      poissonDraw: distributionSummary(draws.map((snapshot) => snapshot.poissonOneXTwo.draw)),
      hybridDraw: distributionSummary(draws.map((snapshot) => snapshot.hybridOneXTwo.draw)),
    },
    nonDraws: {
      absEloGap: distributionSummary(nonDraws.map((snapshot) => snapshot.absEloGap)),
      lambdaRatio: distributionSummary(nonDraws.map((snapshot) => snapshot.ratio)),
      poissonDraw: distributionSummary(nonDraws.map((snapshot) => snapshot.poissonOneXTwo.draw)),
      hybridDraw: distributionSummary(nonDraws.map((snapshot) => snapshot.hybridOneXTwo.draw)),
    },
    drawsRatioGe3: draws.filter((snapshot) => snapshot.ratio >= 3).length,
    drawsRatioGe5: draws.filter((snapshot) => snapshot.ratio >= 5).length,
    drawsRatioGe8: draws.filter((snapshot) => snapshot.ratio >= 8).length,
    drawsRatioGe12: draws.filter((snapshot) => snapshot.ratio >= 12).length,
    drawsHybridLt10: draws.filter((snapshot) => snapshot.hybridOneXTwo.draw < 0.1).length,
    drawsHybridLt05: draws.filter((snapshot) => snapshot.hybridOneXTwo.draw < 0.05).length,
    drawsHybridLt025: draws.filter((snapshot) => snapshot.hybridOneXTwo.draw < 0.025).length,
  };
}

export type ExtremeFavoriteRow = {
  fixtureId: string;
  kickoff: string;
  homeTeamName: string;
  awayTeamName: string;
  score: string;
  homeElo: number;
  awayElo: number;
  rawEloDiff: number;
  absEloGap: number;
  lambdaHome: number;
  lambdaAway: number;
  ratio: number;
  totalXg: number;
  poisson: OneXTwo;
  hybrid: OneXTwo;
  confidence: number;
  actualOutcome: CalibrationOutcome;
};

function toExtreme(snapshot: LambdaSnapshot): ExtremeFavoriteRow {
  return {
    fixtureId: snapshot.fixtureId,
    kickoff: snapshot.kickoff,
    homeTeamName: snapshot.homeTeamName,
    awayTeamName: snapshot.awayTeamName,
    score: `${snapshot.actualHomeGoals}-${snapshot.actualAwayGoals}`,
    homeElo: snapshot.homeElo,
    awayElo: snapshot.awayElo,
    rawEloDiff: snapshot.rawEloDiff,
    absEloGap: snapshot.absEloGap,
    lambdaHome: snapshot.lambdaHome,
    lambdaAway: snapshot.lambdaAway,
    ratio: snapshot.ratio,
    totalXg: snapshot.totalXg,
    poisson: snapshot.poissonOneXTwo,
    hybrid: snapshot.hybridOneXTwo,
    confidence: snapshot.confidence,
    actualOutcome: snapshot.actualOutcome,
  };
}

export function extractTopBy(
  snapshots: readonly LambdaSnapshot[],
  metric: (snapshot: LambdaSnapshot) => number,
  limit = 20,
): ExtremeFavoriteRow[] {
  return [...snapshots]
    .sort((left, right) => {
      const delta = metric(right) - metric(left);
      if (delta !== 0) return delta;
      return left.fixtureId.localeCompare(right.fixtureId);
    })
    .slice(0, limit)
    .map(toExtreme);
}

export function extremeFavorites(snapshots: readonly LambdaSnapshot[]): {
  byAbsEloGap: ExtremeFavoriteRow[];
  byLambdaRatio: ExtremeFavoriteRow[];
  byPeakHybrid: ExtremeFavoriteRow[];
} {
  return {
    byAbsEloGap: extractTopBy(snapshots, (snapshot) => snapshot.absEloGap),
    byLambdaRatio: extractTopBy(snapshots, (snapshot) => snapshot.ratio),
    byPeakHybrid: extractTopBy(snapshots, (snapshot) => peakOneXTwo(snapshot.hybridOneXTwo)),
  };
}

export type ClampCohortRow = GeometryCohortMetrics & {
  cohort: ClampCohortId;
  rate: number;
};

export function clampCohortRows(snapshots: readonly LambdaSnapshot[]): ClampCohortRow[] {
  const n = snapshots.length;
  return CLAMP_COHORTS.map((cohort) => {
    const scoped = snapshots.filter((snapshot) => snapshot.clampCohort === cohort);
    return {
      cohort,
      rate: n === 0 ? 0 : scoped.length / n,
      ...cohortMetrics(scoped),
    };
  });
}

export type SeasonLambdaGeometry = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  n: number;
  distributions: LambdaDistributions;
  ratioBuckets: RatioBucketRow[];
  eloGap: EloGapPropagationRow[];
  actualDraws: ActualDrawGeometry;
  extremes: ReturnType<typeof extremeFavorites>;
  clamp: ClampCohortRow[];
  failures: NumericFailure[];
};

export function evaluateSeasonLambdaGeometry(input: {
  rows: readonly CalibrationRow[];
  season: DrawForensicsSeason | string;
  role: "HOLDOUT" | "DEVELOPMENT";
}): SeasonLambdaGeometry {
  const snapshots = snapshotLambdaSeason(input);
  return {
    season: input.season,
    role: input.role,
    n: snapshots.length,
    distributions: lambdaDistributions(snapshots),
    ratioBuckets: ratioBucketRows(snapshots),
    eloGap: eloGapPropagation(snapshots),
    actualDraws: actualDrawGeometry(snapshots),
    extremes: extremeFavorites(snapshots),
    clamp: clampCohortRows(snapshots),
    failures: [],
  };
}

export function pooledDistributions(
  seasons: readonly SeasonLambdaGeometry[],
  snapshots: readonly LambdaSnapshot[],
): LambdaDistributions {
  if (seasons.length === 0) return lambdaDistributions([]);
  return lambdaDistributions(snapshots);
}
