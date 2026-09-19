/**
 * Debug-only Elo→λ counterfactuals. Isolated engines. Not production candidates.
 */

import { blendOneXTwo } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { marginalizePoissonScoreGrid } from "@/lib/intelligence/modules/probability/hybrid/score-matrix";
import {
  isValidOneXTwo,
  summarizeMetrics,
} from "@/lib/debug/calibration/metrics";
import { eloGapBucket } from "@/lib/debug/calibration/draw-5b7-buckets";
import { ELO_GAP_BUCKETS } from "@/lib/debug/calibration/draw-5b7-shape";
import { createIsolatedDrawEngine, peakOneXTwo } from "@/lib/debug/calibration/draw-5b7-trace";
import {
  applyEqualizedRolePrior,
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import {
  frozenValidationConfig,
  VALIDATION_NEUTRAL_GOAL_BASELINE,
} from "@/lib/debug/calibration/validation-5b6-configs";
import { createCurrentCataloguePolicy } from "@/lib/debug/calibration/policies";
import {
  eloToExpectedGoalsMirrored,
  g1NeutralGoalInputs,
  productionEloXgInputs,
} from "@/lib/debug/calibration/xg-5b9-formula";
import {
  DECLARED_ELO_GOAL_SCALE_GRID,
} from "@/lib/debug/calibration/xg-5b9-shape";
import {
  lambdaRatio,
  totalXg,
} from "@/lib/debug/calibration/xg-5b9-geometry";
import {
  type LambdaSnapshot,
  type NumericFailure,
} from "@/lib/debug/calibration/xg-5b9-evaluate";
import type { CalibrationRow, OneXTwo } from "@/lib/debug/calibration/types";

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type CounterfactualSummary = {
  label: string;
  n: number;
  valid: boolean;
  meanLambdaHome: number | null;
  meanLambdaAway: number | null;
  maxLambda: number | null;
  meanTotalXg: number | null;
  meanLambdaRatio: number | null;
  p90LambdaRatio: number | null;
  clampCount: number | null;
  poissonDraw: number | null;
  hybridDraw: number | null;
  drawBias: number | null;
  logLoss: number | null;
  brier: number | null;
  homeBias: number | null;
  awayBias: number | null;
  gte90: number | null;
  failures: NumericFailure[];
};

function emptyInvalid(label: string, n: number, failures: NumericFailure[]): CounterfactualSummary {
  return {
    label,
    n,
    valid: false,
    meanLambdaHome: null,
    meanLambdaAway: null,
    maxLambda: null,
    meanTotalXg: null,
    meanLambdaRatio: null,
    p90LambdaRatio: null,
    clampCount: null,
    poissonDraw: null,
    hybridDraw: null,
    drawBias: null,
    logLoss: null,
    brier: null,
    homeBias: null,
    awayBias: null,
    gte90: null,
    failures,
  };
}

function summarizeVectors(input: {
  label: string;
  snapshots: readonly LambdaSnapshot[];
  lambdaHome: readonly number[];
  lambdaAway: readonly number[];
  poisson: readonly OneXTwo[];
  hybrid: readonly OneXTwo[];
  clampCount: number;
  failures: NumericFailure[];
}): CounterfactualSummary {
  if (input.failures.length > 0) {
    return emptyInvalid(input.label, input.snapshots.length, input.failures);
  }
  const n = input.snapshots.length;
  const observedDraw =
    n === 0 ? 0 : input.snapshots.filter((snapshot) => snapshot.actualOutcome === "draw").length / n;
  const observedHome =
    n === 0 ? 0 : input.snapshots.filter((snapshot) => snapshot.actualOutcome === "home").length / n;
  const observedAway =
    n === 0 ? 0 : input.snapshots.filter((snapshot) => snapshot.actualOutcome === "away").length / n;
  const ratios = input.lambdaHome.map((home, index) => lambdaRatio(home, input.lambdaAway[index]!));
  const sorted = [...ratios].sort((a, b) => a - b);
  const p90Index = n === 0 ? 0 : (n - 1) * 0.9;
  const p90Lo = Math.floor(p90Index);
  const p90Hi = Math.ceil(p90Index);
  const p90 =
    n === 0
      ? 0
      : p90Lo === p90Hi
        ? sorted[p90Lo]!
        : sorted[p90Lo]! * (1 - (p90Index - p90Lo)) + sorted[p90Hi]! * (p90Index - p90Lo);
  const metrics =
    n === 0
      ? { logLoss: 0, brier: 0 }
      : summarizeMetrics(
          input.snapshots.map((snapshot, index) => ({
            predicted: input.hybrid[index]!,
            actual: snapshot.actualOutcome,
            bucket: "10+" as const,
            policyId: "current_catalogue",
          })),
        );
  const hybridDraw = mean(input.hybrid.map((vector) => vector.draw));
  return {
    label: input.label,
    n,
    valid: true,
    meanLambdaHome: mean(input.lambdaHome),
    meanLambdaAway: mean(input.lambdaAway),
    maxLambda: Math.max(...input.lambdaHome, ...input.lambdaAway, 0),
    meanTotalXg: mean(
      input.lambdaHome.map((home, index) => totalXg(home, input.lambdaAway[index]!)),
    ),
    meanLambdaRatio: mean(ratios),
    p90LambdaRatio: p90,
    clampCount: input.clampCount,
    poissonDraw: mean(input.poisson.map((vector) => vector.draw)),
    hybridDraw,
    drawBias: hybridDraw - observedDraw,
    logLoss: metrics.logLoss,
    brier: metrics.brier,
    homeBias: mean(input.hybrid.map((vector) => vector.home)) - observedHome,
    awayBias: mean(input.hybrid.map((vector) => vector.away)) - observedAway,
    gte90: input.hybrid.filter((vector) => peakOneXTwo(vector) >= 0.9).length,
    failures: input.failures,
  };
}

export function unclampedCounterfactual(
  snapshots: readonly LambdaSnapshot[],
): { clamped: CounterfactualSummary; unclamped: CounterfactualSummary } {
  const clamped = summarizeVectors({
    label: "clamped",
    snapshots,
    lambdaHome: snapshots.map((snapshot) => snapshot.lambdaHome),
    lambdaAway: snapshots.map((snapshot) => snapshot.lambdaAway),
    poisson: snapshots.map((snapshot) => snapshot.poissonOneXTwo),
    hybrid: snapshots.map((snapshot) => snapshot.hybridOneXTwo),
    clampCount: snapshots.filter((snapshot) => snapshot.clampCohort !== "NO_CLAMP").length,
    failures: [],
  });

  const failures: NumericFailure[] = [];
  const lambdaHome: number[] = [];
  const lambdaAway: number[] = [];
  const poisson: OneXTwo[] = [];
  const hybrid: OneXTwo[] = [];
  for (const snapshot of snapshots) {
    const home = snapshot.lambdaHomeUnclamped;
    const away = snapshot.lambdaAwayUnclamped;
    if (!(home > 0) || !(away > 0) || !Number.isFinite(home) || !Number.isFinite(away)) {
      failures.push({
        fixtureId: snapshot.fixtureId,
        reason: "unclamped lambda is not finite and strictly positive",
        lambdaHome: home,
        lambdaAway: away,
      });
      continue;
    }
    try {
      const grid = marginalizePoissonScoreGrid({
        lambdaHome: home,
        lambdaAway: away,
        maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
      });
      const blended = blendOneXTwo(
        grid.oneXTwo,
        snapshot.eloOneXTwo,
        DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
      );
      if (!isValidOneXTwo(grid.oneXTwo) || !isValidOneXTwo(blended)) {
        failures.push({
          fixtureId: snapshot.fixtureId,
          reason: "unclamped 1X2 is not finite or does not sum to 1",
          lambdaHome: home,
          lambdaAway: away,
        });
        continue;
      }
      lambdaHome.push(home);
      lambdaAway.push(away);
      poisson.push(grid.oneXTwo);
      hybrid.push(blended);
    } catch (error) {
      failures.push({
        fixtureId: snapshot.fixtureId,
        reason: error instanceof Error ? error.message : String(error),
        lambdaHome: home,
        lambdaAway: away,
      });
    }
  }

  return {
    clamped,
    unclamped: summarizeVectors({
      label: "unclamped",
      snapshots,
      lambdaHome,
      lambdaAway,
      poisson,
      hybrid,
      clampCount: 0,
      failures,
    }),
  };
}

export type GoalBaseGapRow = {
  bucket: string;
  n: number;
  meanLambdaRatio: number;
  meanTotalXg: number;
  clampHits: number;
  poissonDraw: number;
  hybridDraw: number;
  drawBias: number;
};

export type GoalBaseSeasonReport = {
  variant: "G0" | "G1";
  baseHomeGoals: number;
  baseAwayGoals: number;
  summary: CounterfactualSummary;
  byEloGap: GoalBaseGapRow[];
};

function snapshotsFromEngine(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  baseHomeGoals: number;
  baseAwayGoals: number;
  eloGoalScale?: number;
}): {
  snapshots: LambdaSnapshot[];
  lambdaHome: number[];
  lambdaAway: number[];
  poisson: OneXTwo[];
  hybrid: OneXTwo[];
  clampCount: number;
  failures: NumericFailure[];
} {
  const before = snapshotDefaultHybridConfig();
  const engine = createIsolatedDrawEngine(frozenValidationConfig("V0"), {
    baseHomeGoals: input.baseHomeGoals,
    baseAwayGoals: input.baseAwayGoals,
    ...(input.eloGoalScale == null ? {} : { eloGoalScale: input.eloGoalScale }),
  });
  const policy = createCurrentCataloguePolicy();
  const snapshots: LambdaSnapshot[] = [];
  const lambdaHome: number[] = [];
  const lambdaAway: number[] = [];
  const poisson: OneXTwo[] = [];
  const hybrid: OneXTwo[] = [];
  const failures: NumericFailure[] = [];
  let clampCount = 0;
  for (const row of input.rows) {
    if (row.season !== input.season) {
      throw new Error(`Season identity mismatch: row ${row.season} vs ${input.season}`);
    }
    if (row.actualOutcome == null || row.actualHomeGoals == null || row.actualAwayGoals == null) {
      throw new Error(`Unlabeled outcome on ${row.fixtureId}`);
    }
    const home = policy.resolve(row, "home");
    const away = policy.resolve(row, "away");
    const homeElo = applyEqualizedRolePrior(home.elo, "home", false);
    const awayElo = applyEqualizedRolePrior(away.elo, "away", false);
    const predicted = engine.predict({
      homeElo,
      awayElo,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      matchId: row.fixtureId,
    });
    if (
      !isValidOneXTwo(predicted.oneXTwo) ||
      !isValidOneXTwo(predicted.poisson.oneXTwo) ||
      !isValidOneXTwo(predicted.elo.oneXTwo)
    ) {
      failures.push({
        fixtureId: row.fixtureId,
        reason: "counterfactual 1X2 is not finite or does not sum to 1",
        lambdaHome: predicted.expectedGoals.home,
        lambdaAway: predicted.expectedGoals.away,
      });
      continue;
    }
    const mapped = eloToExpectedGoalsMirrored({
      ...productionEloXgInputs(),
      homeElo,
      awayElo,
      baseHomeGoals: input.baseHomeGoals,
      baseAwayGoals: input.baseAwayGoals,
      eloGoalScale: input.eloGoalScale ?? DEFAULT_HYBRID_CONFIG.eloGoalScale,
    });
    if (mapped.clampHomeMax || mapped.clampAwayMax || mapped.clampHomeMin || mapped.clampAwayMin) {
      clampCount += 1;
    }
    lambdaHome.push(predicted.expectedGoals.home);
    lambdaAway.push(predicted.expectedGoals.away);
    poisson.push(predicted.poisson.oneXTwo);
    hybrid.push(predicted.oneXTwo);
    snapshots.push({
      fixtureId: row.fixtureId,
      season: row.season,
      role: input.role,
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
      lambdaHome: predicted.expectedGoals.home,
      lambdaAway: predicted.expectedGoals.away,
      lambdaHomeUnclamped: mapped.lambdaHomeUnclamped,
      lambdaAwayUnclamped: mapped.lambdaAwayUnclamped,
      ratio: lambdaRatio(predicted.expectedGoals.home, predicted.expectedGoals.away),
      totalXg: predicted.expectedGoals.total,
      poissonOneXTwo: predicted.poisson.oneXTwo,
      eloOneXTwo: predicted.elo.oneXTwo,
      hybridOneXTwo: predicted.oneXTwo,
      confidence: 0,
      clampCohort: "NO_CLAMP",
    });
  }
  assertProductionHybridConfigUnchanged(before);
  return { snapshots, lambdaHome, lambdaAway, poisson, hybrid, clampCount, failures };
}

function goalBaseGapRows(snapshots: readonly LambdaSnapshot[]): GoalBaseGapRow[] {
  return ELO_GAP_BUCKETS.map((bucket) => {
    const scoped = snapshots.filter((snapshot) => eloGapBucket(snapshot.absEloGap) === bucket);
    const n = scoped.length;
    const observedDraw =
      n === 0 ? 0 : scoped.filter((snapshot) => snapshot.actualOutcome === "draw").length / n;
    const hybridDraw = mean(scoped.map((snapshot) => snapshot.hybridOneXTwo.draw));
    return {
      bucket,
      n,
      meanLambdaRatio: mean(scoped.map((snapshot) => snapshot.ratio)),
      meanTotalXg: mean(scoped.map((snapshot) => snapshot.totalXg)),
      clampHits: scoped.filter(
        (snapshot) =>
          snapshot.lambdaHomeUnclamped !== snapshot.lambdaHome ||
          snapshot.lambdaAwayUnclamped !== snapshot.lambdaAway,
      ).length,
      poissonDraw: mean(scoped.map((snapshot) => snapshot.poissonOneXTwo.draw)),
      hybridDraw,
      drawBias: hybridDraw - observedDraw,
    };
  });
}

export function evaluateGoalBaseVariants(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
}): { G0: GoalBaseSeasonReport; G1: GoalBaseSeasonReport } {
  const g0inputs = productionEloXgInputs();
  const g1goals = g1NeutralGoalInputs();
  const g0 = snapshotsFromEngine({
    rows: input.rows,
    season: input.season,
    role: input.role,
    baseHomeGoals: g0inputs.baseHomeGoals,
    baseAwayGoals: g0inputs.baseAwayGoals,
  });
  const g1 = snapshotsFromEngine({
    rows: input.rows,
    season: input.season,
    role: input.role,
    baseHomeGoals: g1goals.baseHomeGoals,
    baseAwayGoals: g1goals.baseAwayGoals,
  });
  return {
    G0: {
      variant: "G0",
      baseHomeGoals: g0inputs.baseHomeGoals,
      baseAwayGoals: g0inputs.baseAwayGoals,
      summary: summarizeVectors({
        label: "G0",
        snapshots: g0.snapshots,
        lambdaHome: g0.lambdaHome,
        lambdaAway: g0.lambdaAway,
        poisson: g0.poisson,
        hybrid: g0.hybrid,
        clampCount: g0.clampCount,
        failures: g0.failures,
      }),
      byEloGap: goalBaseGapRows(g0.snapshots),
    },
    G1: {
      variant: "G1",
      baseHomeGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
      baseAwayGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
      summary: summarizeVectors({
        label: "G1",
        snapshots: g1.snapshots,
        lambdaHome: g1.lambdaHome,
        lambdaAway: g1.lambdaAway,
        poisson: g1.poisson,
        hybrid: g1.hybrid,
        clampCount: g1.clampCount,
        failures: g1.failures,
      }),
      byEloGap: goalBaseGapRows(g1.snapshots),
    },
  };
}

export type DenominatorCell = CounterfactualSummary & {
  eloGoalScale: number;
  isCurrent: boolean;
};

export function evaluateDenominatorSensitivity(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
}): DenominatorCell[] {
  const bases = productionEloXgInputs();
  return DECLARED_ELO_GOAL_SCALE_GRID.map((eloGoalScale) => {
    const built = snapshotsFromEngine({
      rows: input.rows,
      season: input.season,
      role: input.role,
      baseHomeGoals: bases.baseHomeGoals,
      baseAwayGoals: bases.baseAwayGoals,
      eloGoalScale,
    });
    const summary = summarizeVectors({
      label: `S=${eloGoalScale}`,
      snapshots: built.snapshots,
      lambdaHome: built.lambdaHome,
      lambdaAway: built.lambdaAway,
      poisson: built.poisson,
      hybrid: built.hybrid,
      clampCount: built.clampCount,
      failures: built.failures,
    });
    return {
      ...summary,
      eloGoalScale,
      isCurrent: eloGoalScale === DEFAULT_HYBRID_CONFIG.eloGoalScale,
    };
  });
}
