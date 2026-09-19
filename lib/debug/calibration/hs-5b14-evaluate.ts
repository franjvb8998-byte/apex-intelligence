/**
 * Empirical D0/D1 higher-score draw evaluation. Frozen production G0. Not a tuner.
 */

import {
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { isValidOneXTwo, summarizeMetrics } from "@/lib/debug/calibration/metrics";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import {
  assertD0MirrorsProduction,
  assertD1MirrorsP7G0,
  panelDrawElos,
  predictProductionDrawChain,
  type DrawSnapshot,
} from "@/lib/debug/calibration/draw-5b13-formula";
import {
  bootstrapPearson,
  buildIndependentScoreGrid,
  emptyEqualMasses,
  pearsonCorrelation,
  predictBivariateHybrid,
  type BootstrapCorrelation,
  type EqualScoreMasses,
  type ScoreCellAggregate,
} from "@/lib/debug/calibration/hs-5b14-formula";
import {
  ACTUAL_TOTAL_BUCKETS,
  DECLARED_LAMBDA3,
  DRAW_RESIDUAL_PARTS,
  EQUAL_SCORE_KEYS,
  HS_D1_NON_CANDIDATE_LABEL,
  HS_NAMED_TRACES,
  NON_DRAW_SCORE_GROUPS,
  RESIDUAL_SHARE_MIN_ABS,
  TWO_TWO_RATIO_BUCKETS,
  TWO_TWO_XG_BUCKETS,
  actualTotalBucket,
  drawResidualPart,
  equalScoreKey,
  isHighEqual,
  isLowEqual,
  nonDrawScoreGroup,
  twoTwoRatioBucket,
  twoTwoXgBucket,
  type ActualTotalBucket,
  type DeclaredLambda3,
  type DrawResidualPart,
  type EqualScoreKey,
  type HsPanelId,
  type TwoTwoRatioBucket,
  type TwoTwoXgBucket,
} from "@/lib/debug/calibration/hs-5b14-shape";
import type {
  CalibrationOutcome,
  CalibrationRow,
  OneXTwo,
} from "@/lib/debug/calibration/types";

export type NumericFailure = {
  fixtureId: string;
  panel: HsPanelId;
  reason: string;
};

export type HsMatchTrace = {
  fixtureId: string;
  kickoff: string;
  season: string;
  seasonRole: "HOLDOUT" | "DEVELOPMENT";
  panel: HsPanelId;
  homeTeamName: string;
  awayTeamName: string;
  actualOutcome: CalibrationOutcome;
  actualHomeGoals: number;
  actualAwayGoals: number;
  snapshot: DrawSnapshot;
  independentEqual: EqualScoreMasses;
  independentCells: number[][];
  independentDraw: number;
  homeResidual: number;
  awayResidual: number;
};

export type OeRow = {
  key: string;
  observedCount: number;
  expectedCount: number;
  meanProbability: number;
  oeRatio: number | null;
};

export type ResidualPartRow = {
  part: DrawResidualPart | "TOTAL";
  observedCount: number;
  expectedCount: number;
  residualCount: number;
  shareOfResidual: number | null;
};

export type TwoTwoFixture = {
  season: string;
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  eloGap: number;
  lambdaHome: number;
  lambdaAway: number;
  lambdaRatio: number;
  totalXg: number;
  p22: number;
  poissonDraw: number;
  hybridDraw: number;
  hybrid: OneXTwo;
};

export type BucketCountRow = {
  bucket: string;
  nMatches: number;
  observed22: number;
  expected22: number;
  oeRatio: number | null;
};

export type ConditionalDrawRow = {
  key: EqualScoreKey;
  observedGivenDraw: number;
  poissonGivenDraw: number;
};

export type CorrelationBlock = {
  n: number;
  rawGoal: number;
  residual: number;
  residualBootstrap: BootstrapCorrelation;
};

export type ActualTotalRow = {
  bucket: ActualTotalBucket;
  n: number;
  drawRate: number;
  shareOfDraws: number;
  composition: Record<EqualScoreKey, number>;
};

export type PredictedXgRow = {
  bucket: TwoTwoXgBucket;
  n: number;
  observedDraw: number;
  expectedPoissonDraw: number;
  residual: number;
  observed22: number;
  expected22: number;
};

export type Lambda3Diagnostic = {
  lambda3: DeclaredLambda3;
  diagnosticOnly: true;
  n: number;
  logLoss: number;
  brier: number;
  ece: number;
  drawBias: number;
  homeBias: number;
  awayBias: number;
  meanDraw: number;
  meanP00: number;
  meanP11: number;
  meanP22: number;
  meanP33: number;
  meanP44plus: number;
};

export type NamedHsTrace = {
  label: string;
  fixtureId: string;
  season: string;
  panel: HsPanelId;
  homeElo: number;
  awayElo: number;
  lambdaHome: number;
  lambdaAway: number;
  production: OneXTwo;
  byLambda3: Record<
    string,
    { p00: number; p11: number; p22: number; p33: number; draw: number; hybrid: OneXTwo }
  >;
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function oe(observed: number, expected: number): number | null {
  if (!(expected > 0)) return null;
  return observed / expected;
}

function share(partResidual: number, totalResidual: number): number | null {
  if (Math.abs(totalResidual) < RESIDUAL_SHARE_MIN_ABS) return null;
  return partResidual / totalResidual;
}

export function snapshotHsPanel(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  panel: HsPanelId;
}): { traces: HsMatchTrace[]; failures: NumericFailure[] } {
  const before = snapshotDefaultHybridConfig();
  const traces: HsMatchTrace[] = [];
  const failures: NumericFailure[] = [];
  const seen = new Set<string>();
  for (const row of input.rows) {
    if (row.season !== input.season) {
      throw new Error(`Season identity mismatch: row ${row.season} vs ${input.season}`);
    }
    if (seen.has(row.fixtureId)) throw new Error(`Duplicate fixture ${row.fixtureId}`);
    seen.add(row.fixtureId);
    if (row.actualOutcome == null || row.actualHomeGoals == null || row.actualAwayGoals == null) {
      throw new Error(`Unlabeled outcome on ${row.fixtureId}`);
    }
    try {
      if (input.panel === "D0") assertD0MirrorsProduction(row);
      else assertD1MirrorsP7G0(row);
      const elos = panelDrawElos(input.panel, row);
      const snapshot = predictProductionDrawChain(elos);
      const grid = buildIndependentScoreGrid({
        lambdaHome: snapshot.lambdaHome,
        lambdaAway: snapshot.lambdaAway,
      });
      if (Math.abs(grid.draw - snapshot.poisson.draw) > 1e-12) {
        throw new Error("Independent score matrix diverged from production Poisson");
      }
      if (
        !isValidOneXTwo(snapshot.hybrid) ||
        !(snapshot.lambdaHome > 0) ||
        !(snapshot.lambdaAway > 0)
      ) {
        throw new Error("Invalid production draw chain");
      }
      traces.push({
        fixtureId: row.fixtureId,
        kickoff: row.kickoff,
        season: row.season,
        seasonRole: input.role,
        panel: input.panel,
        homeTeamName: row.homeTeamName,
        awayTeamName: row.awayTeamName,
        actualOutcome: row.actualOutcome,
        actualHomeGoals: row.actualHomeGoals,
        actualAwayGoals: row.actualAwayGoals,
        snapshot,
        independentEqual: grid.equal,
        independentCells: grid.cells,
        independentDraw: grid.draw,
        homeResidual: row.actualHomeGoals - snapshot.lambdaHome,
        awayResidual: row.actualAwayGoals - snapshot.lambdaAway,
      });
    } catch (error) {
      failures.push({
        fixtureId: row.fixtureId,
        panel: input.panel,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  assertProductionHybridConfigUnchanged(before);
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== 400) {
    throw new Error("Production eloGoalScale mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== 0.28) {
    throw new Error("Production eloDrawBase mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.poissonBlendWeight !== 0.7) {
    throw new Error("Production blend mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.homeAdvantageElo !== 65) {
    throw new Error("Production homeAdvantageElo mutated");
  }
  return { traces, failures };
}

export function aggregateScoreCells(traces: readonly HsMatchTrace[]): ScoreCellAggregate[] {
  const maxGoals = DEFAULT_HYBRID_CONFIG.maxGoals;
  const cells: ScoreCellAggregate[] = [];
  for (let i = 0; i <= maxGoals; i += 1) {
    for (let j = 0; j <= maxGoals; j += 1) {
      let expected = 0;
      let observed = 0;
      for (const trace of traces) {
        expected += trace.independentCells[i]?.[j] ?? 0;
        if (trace.actualHomeGoals === i && trace.actualAwayGoals === j) observed += 1;
      }
      cells.push({
        homeGoals: i,
        awayGoals: j,
        expectedCount: expected,
        observedCount: observed,
        meanProbability: traces.length === 0 ? 0 : expected / traces.length,
        oeRatio: oe(observed, expected),
      });
    }
  }
  return cells;
}

function equalOe(traces: readonly HsMatchTrace[]): OeRow[] {
  const rows: OeRow[] = EQUAL_SCORE_KEYS.map((key) => {
    const observed = traces.filter((trace) => equalScoreKey(trace.actualHomeGoals, trace.actualAwayGoals) === key)
      .length;
    const expected = traces.reduce((sum, trace) => sum + trace.independentEqual[key], 0);
    return {
      key,
      observedCount: observed,
      expectedCount: expected,
      meanProbability: traces.length === 0 ? 0 : expected / traces.length,
      oeRatio: oe(observed, expected),
    };
  });
  const allObs = traces.filter((trace) => trace.actualHomeGoals === trace.actualAwayGoals).length;
  const allExp = traces.reduce((sum, trace) => sum + trace.independentDraw, 0);
  rows.push({
    key: "all-equal",
    observedCount: allObs,
    expectedCount: allExp,
    meanProbability: traces.length === 0 ? 0 : allExp / traces.length,
    oeRatio: oe(allObs, allExp),
  });
  return rows;
}

function nonDrawOe(traces: readonly HsMatchTrace[]): OeRow[] {
  return NON_DRAW_SCORE_GROUPS.map((key) => {
    const observed = traces.filter(
      (trace) => nonDrawScoreGroup(trace.actualHomeGoals, trace.actualAwayGoals) === key,
    ).length;
    let expected = 0;
    for (const trace of traces) {
      if (key === "other-unequal") {
        for (let i = 0; i < trace.independentCells.length; i += 1) {
          for (let j = 0; j < (trace.independentCells[i]?.length ?? 0); j += 1) {
            if (nonDrawScoreGroup(i, j) === "other-unequal") {
              expected += trace.independentCells[i]![j]!;
            }
          }
        }
      } else {
        const [h, a] = key.split("-").map(Number) as [number, number];
        expected += trace.independentCells[h]?.[a] ?? 0;
      }
    }
    return {
      key,
      observedCount: observed,
      expectedCount: expected,
      meanProbability: traces.length === 0 ? 0 : expected / traces.length,
      oeRatio: oe(observed, expected),
    };
  });
}

function residualDecomposition(traces: readonly HsMatchTrace[]): ResidualPartRow[] {
  const parts: ResidualPartRow[] = DRAW_RESIDUAL_PARTS.map((part) => {
    const observed = traces.filter(
      (trace) => drawResidualPart(trace.actualHomeGoals, trace.actualAwayGoals) === part,
    ).length;
    const expected = traces.reduce((sum, trace) => {
      if (part === "4-4+") return sum + trace.independentEqual["4-4"] + trace.independentEqual["5-5+"];
      return sum + trace.independentEqual[part];
    }, 0);
    return {
      part,
      observedCount: observed,
      expectedCount: expected,
      residualCount: observed - expected,
      shareOfResidual: null as number | null,
    };
  });
  const observedDraw = traces.filter((trace) => trace.actualHomeGoals === trace.actualAwayGoals).length;
  const expectedDraw = traces.reduce((sum, trace) => sum + trace.independentDraw, 0);
  const totalResidual = observedDraw - expectedDraw;
  for (const row of parts) {
    row.shareOfResidual = share(row.residualCount, totalResidual);
  }
  parts.push({
    part: "TOTAL",
    observedCount: observedDraw,
    expectedCount: expectedDraw,
    residualCount: totalResidual,
    shareOfResidual: Math.abs(totalResidual) < RESIDUAL_SHARE_MIN_ABS ? null : 1,
  });
  return parts;
}

function twoTwoFixtures(traces: readonly HsMatchTrace[]): TwoTwoFixture[] {
  return traces
    .filter((trace) => trace.actualHomeGoals === 2 && trace.actualAwayGoals === 2)
    .map((trace) => ({
      season: trace.season,
      fixtureId: trace.fixtureId,
      homeTeamName: trace.homeTeamName,
      awayTeamName: trace.awayTeamName,
      eloGap: trace.snapshot.rawGap,
      lambdaHome: trace.snapshot.lambdaHome,
      lambdaAway: trace.snapshot.lambdaAway,
      lambdaRatio: trace.snapshot.lambdaRatio,
      totalXg: trace.snapshot.totalXg,
      p22: trace.independentEqual["2-2"],
      poissonDraw: trace.snapshot.poisson.draw,
      hybridDraw: trace.snapshot.hybrid.draw,
      hybrid: trace.snapshot.hybrid,
    }));
}

function twoTwoByRatio(traces: readonly HsMatchTrace[]): BucketCountRow[] {
  return TWO_TWO_RATIO_BUCKETS.map((bucket) => {
    const scoped = traces.filter((trace) => twoTwoRatioBucket(trace.snapshot.lambdaRatio) === bucket);
    const observed22 = scoped.filter((trace) => trace.actualHomeGoals === 2 && trace.actualAwayGoals === 2).length;
    const expected22 = scoped.reduce((sum, trace) => sum + trace.independentEqual["2-2"], 0);
    return { bucket, nMatches: scoped.length, observed22, expected22, oeRatio: oe(observed22, expected22) };
  });
}

function twoTwoByXg(traces: readonly HsMatchTrace[]): BucketCountRow[] {
  return TWO_TWO_XG_BUCKETS.map((bucket) => {
    const scoped = traces.filter((trace) => twoTwoXgBucket(trace.snapshot.totalXg) === bucket);
    const observed22 = scoped.filter((trace) => trace.actualHomeGoals === 2 && trace.actualAwayGoals === 2).length;
    const expected22 = scoped.reduce((sum, trace) => sum + trace.independentEqual["2-2"], 0);
    return { bucket, nMatches: scoped.length, observed22, expected22, oeRatio: oe(observed22, expected22) };
  });
}

function conditionalDraw(traces: readonly HsMatchTrace[]): ConditionalDrawRow[] {
  const draws = traces.filter((trace) => trace.actualHomeGoals === trace.actualAwayGoals);
  const expectedDraw = traces.reduce((sum, trace) => sum + trace.independentDraw, 0);
  return EQUAL_SCORE_KEYS.map((key) => {
    const observed = draws.filter((trace) => equalScoreKey(trace.actualHomeGoals, trace.actualAwayGoals) === key)
      .length;
    const expected = traces.reduce((sum, trace) => sum + trace.independentEqual[key], 0);
    return {
      key,
      observedGivenDraw: draws.length === 0 ? 0 : observed / draws.length,
      poissonGivenDraw: expectedDraw === 0 ? 0 : expected / expectedDraw,
    };
  });
}

function correlationFor(traces: readonly HsMatchTrace[]): CorrelationBlock {
  const homeGoals = traces.map((trace) => trace.actualHomeGoals);
  const awayGoals = traces.map((trace) => trace.actualAwayGoals);
  const homeRes = traces.map((trace) => trace.homeResidual);
  const awayRes = traces.map((trace) => trace.awayResidual);
  return {
    n: traces.length,
    rawGoal: pearsonCorrelation(homeGoals, awayGoals),
    residual: pearsonCorrelation(homeRes, awayRes),
    residualBootstrap: bootstrapPearson({ xs: homeRes, ys: awayRes }),
  };
}

function lowHighEqual(traces: readonly HsMatchTrace[]): {
  low: OeRow;
  high: OeRow;
} {
  const lowObs = traces.filter((trace) => isLowEqual(trace.actualHomeGoals, trace.actualAwayGoals)).length;
  const highObs = traces.filter((trace) => isHighEqual(trace.actualHomeGoals, trace.actualAwayGoals)).length;
  const lowExp = traces.reduce(
    (sum, trace) => sum + trace.independentEqual["0-0"] + trace.independentEqual["1-1"],
    0,
  );
  const highExp = traces.reduce(
    (sum, trace) =>
      sum +
      trace.independentEqual["2-2"] +
      trace.independentEqual["3-3"] +
      trace.independentEqual["4-4"] +
      trace.independentEqual["5-5+"],
    0,
  );
  return {
    low: {
      key: "LOW_EQUAL",
      observedCount: lowObs,
      expectedCount: lowExp,
      meanProbability: traces.length === 0 ? 0 : lowExp / traces.length,
      oeRatio: oe(lowObs, lowExp),
    },
    high: {
      key: "HIGH_EQUAL",
      observedCount: highObs,
      expectedCount: highExp,
      meanProbability: traces.length === 0 ? 0 : highExp / traces.length,
      oeRatio: oe(highObs, highExp),
    },
  };
}

function actualTotalRows(traces: readonly HsMatchTrace[]): ActualTotalRow[] {
  const drawN = traces.filter((trace) => trace.actualHomeGoals === trace.actualAwayGoals).length;
  return ACTUAL_TOTAL_BUCKETS.map((bucket) => {
    const scoped = traces.filter(
      (trace) => actualTotalBucket(trace.actualHomeGoals + trace.actualAwayGoals) === bucket,
    );
    const draws = scoped.filter((trace) => trace.actualHomeGoals === trace.actualAwayGoals);
    const composition = emptyEqualMasses();
    for (const trace of draws) {
      const key = equalScoreKey(trace.actualHomeGoals, trace.actualAwayGoals);
      if (key) composition[key] += 1;
    }
    const nDraws = draws.length;
    if (nDraws > 0) {
      for (const key of EQUAL_SCORE_KEYS) composition[key] /= nDraws;
    }
    return {
      bucket,
      n: scoped.length,
      drawRate: scoped.length === 0 ? 0 : nDraws / scoped.length,
      shareOfDraws: drawN === 0 ? 0 : nDraws / drawN,
      composition,
    };
  });
}

function predictedXgRows(traces: readonly HsMatchTrace[]): PredictedXgRow[] {
  return TWO_TWO_XG_BUCKETS.map((bucket) => {
    const scoped = traces.filter((trace) => twoTwoXgBucket(trace.snapshot.totalXg) === bucket);
    const observedDraw = scoped.filter((trace) => trace.actualHomeGoals === trace.actualAwayGoals).length;
    const expectedPoissonDraw = scoped.reduce((sum, trace) => sum + trace.independentDraw, 0);
    const observed22 = scoped.filter((trace) => trace.actualHomeGoals === 2 && trace.actualAwayGoals === 2).length;
    const expected22 = scoped.reduce((sum, trace) => sum + trace.independentEqual["2-2"], 0);
    return {
      bucket,
      n: scoped.length,
      observedDraw: scoped.length === 0 ? 0 : observedDraw / scoped.length,
      expectedPoissonDraw: scoped.length === 0 ? 0 : expectedPoissonDraw / scoped.length,
      residual: scoped.length === 0 ? 0 : observedDraw / scoped.length - expectedPoissonDraw / scoped.length,
      observed22,
      expected22,
    };
  });
}

function lambda3Diagnostics(traces: readonly HsMatchTrace[]): Lambda3Diagnostic[] {
  return DECLARED_LAMBDA3.map((lambda3) => {
    const hybrids = traces.map((trace) =>
      predictBivariateHybrid({
        elo: trace.snapshot.elo,
        lambdaHome: trace.snapshot.lambdaHome,
        lambdaAway: trace.snapshot.lambdaAway,
        lambda3,
      }),
    );
    const metrics = summarizeMetrics(
      traces.map((trace, index) => ({
        predicted: hybrids[index]!.hybrid,
        actual: trace.actualOutcome,
        bucket: "10+",
        policyId: `lambda3:${lambda3}`,
      })),
    );
    const predicted = {
      home: mean(hybrids.map((row) => row.hybrid.home)),
      draw: mean(hybrids.map((row) => row.hybrid.draw)),
      away: mean(hybrids.map((row) => row.hybrid.away)),
    };
    const n = traces.length;
    const observedHome = traces.filter((trace) => trace.actualOutcome === "home").length / (n || 1);
    const observedDraw = traces.filter((trace) => trace.actualOutcome === "draw").length / (n || 1);
    const observedAway = traces.filter((trace) => trace.actualOutcome === "away").length / (n || 1);
    return {
      lambda3,
      diagnosticOnly: true,
      n,
      logLoss: metrics.logLoss,
      brier: metrics.brier,
      ece: metrics.ece,
      drawBias: predicted.draw - observedDraw,
      homeBias: predicted.home - observedHome,
      awayBias: predicted.away - observedAway,
      meanDraw: mean(hybrids.map((row) => row.grid.draw)),
      meanP00: mean(hybrids.map((row) => row.grid.p00)),
      meanP11: mean(hybrids.map((row) => row.grid.p11)),
      meanP22: mean(hybrids.map((row) => row.grid.p22)),
      meanP33: mean(hybrids.map((row) => row.grid.p33)),
      meanP44plus: mean(hybrids.map((row) => row.grid.p44 + row.grid.p55plus)),
    };
  });
}

function namedTraces(traces: readonly HsMatchTrace[]): NamedHsTrace[] {
  return HS_NAMED_TRACES.flatMap((spec) => {
    const match = traces.find(
      (row) =>
        row.season === spec.season &&
        row.homeTeamName === spec.home &&
        row.awayTeamName === spec.away &&
        `${row.actualHomeGoals}-${row.actualAwayGoals}` === spec.score,
    );
    if (!match) return [];
    const byLambda3: NamedHsTrace["byLambda3"] = {};
    for (const lambda3 of DECLARED_LAMBDA3) {
      const replay = predictBivariateHybrid({
        elo: match.snapshot.elo,
        lambdaHome: match.snapshot.lambdaHome,
        lambdaAway: match.snapshot.lambdaAway,
        lambda3,
      });
      byLambda3[String(lambda3)] = {
        p00: replay.grid.p00,
        p11: replay.grid.p11,
        p22: replay.grid.p22,
        p33: replay.grid.p33,
        draw: replay.grid.draw,
        hybrid: replay.hybrid,
      };
    }
    return [
      {
        label: `${spec.season} ${spec.home} vs ${spec.away} ${spec.score}`,
        fixtureId: match.fixtureId,
        season: match.season,
        panel: match.panel,
        homeElo: match.snapshot.homeElo,
        awayElo: match.snapshot.awayElo,
        lambdaHome: match.snapshot.lambdaHome,
        lambdaAway: match.snapshot.lambdaAway,
        production: match.snapshot.hybrid,
        byLambda3,
      },
    ];
  });
}

function ratioCorrelations(traces: readonly HsMatchTrace[]): Record<TwoTwoRatioBucket, CorrelationBlock> {
  const out = {} as Record<TwoTwoRatioBucket, CorrelationBlock>;
  for (const bucket of TWO_TWO_RATIO_BUCKETS) {
    const scoped = traces.filter((trace) => twoTwoRatioBucket(trace.snapshot.lambdaRatio) === bucket);
    out[bucket] = correlationFor(scoped);
  }
  return out;
}

function xgCorrelations(traces: readonly HsMatchTrace[]): Record<TwoTwoXgBucket, CorrelationBlock> {
  const out = {} as Record<TwoTwoXgBucket, CorrelationBlock>;
  for (const bucket of TWO_TWO_XG_BUCKETS) {
    const scoped = traces.filter((trace) => twoTwoXgBucket(trace.snapshot.totalXg) === bucket);
    out[bucket] = correlationFor(scoped);
  }
  return out;
}

export type HsPanelSeasonReport = {
  panel: HsPanelId;
  panelLabel: string;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  n: number;
  failures: NumericFailure[];
  scoreCells: ScoreCellAggregate[];
  exactScoreOe: OeRow[];
  nonDrawOe: OeRow[];
  residualDecomposition: ResidualPartRow[];
  twoTwoFixtures: TwoTwoFixture[];
  twoTwoByRatio: BucketCountRow[];
  twoTwoByXg: BucketCountRow[];
  conditionalDraw: ConditionalDrawRow[];
  correlation: CorrelationBlock;
  correlationByRatio: Record<TwoTwoRatioBucket, CorrelationBlock>;
  correlationByXg: Record<TwoTwoXgBucket, CorrelationBlock>;
  lowHighEqual: { low: OeRow; high: OeRow };
  actualTotalGoals: ActualTotalRow[];
  predictedXgCalibration: PredictedXgRow[];
  lambda3: Lambda3Diagnostic[];
  namedTraces: NamedHsTrace[];
};

export function evaluateHsPanelSeason(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  panel: HsPanelId;
}): HsPanelSeasonReport {
  const snap = snapshotHsPanel(input);
  return {
    panel: input.panel,
    panelLabel: input.panel === "D1" ? HS_D1_NON_CANDIDATE_LABEL : "PRODUCTION_CHAIN_C0_G0",
    season: input.season,
    role: input.role,
    n: input.rows.length,
    failures: snap.failures,
    scoreCells: aggregateScoreCells(snap.traces),
    exactScoreOe: equalOe(snap.traces),
    nonDrawOe: nonDrawOe(snap.traces),
    residualDecomposition: residualDecomposition(snap.traces),
    twoTwoFixtures: twoTwoFixtures(snap.traces),
    twoTwoByRatio: twoTwoByRatio(snap.traces),
    twoTwoByXg: twoTwoByXg(snap.traces),
    conditionalDraw: conditionalDraw(snap.traces),
    correlation: correlationFor(snap.traces),
    correlationByRatio: ratioCorrelations(snap.traces),
    correlationByXg: xgCorrelations(snap.traces),
    lowHighEqual: lowHighEqual(snap.traces),
    actualTotalGoals: actualTotalRows(snap.traces),
    predictedXgCalibration: predictedXgRows(snap.traces),
    lambda3: lambda3Diagnostics(snap.traces),
    namedTraces: namedTraces(snap.traces),
  };
}

export function contrastDrawSeasons(
  earlier: HsPanelSeasonReport,
  later: HsPanelSeasonReport,
): {
  earlierSeason: string;
  laterSeason: string;
  panel: HsPanelId;
  n: number;
  observedPp: Record<string, number>;
  expectedPp: Record<string, number>;
  shareOfObservedDrawDiff: Record<string, number | null>;
} {
  if (earlier.panel !== later.panel) throw new Error("Season contrast mixed panels");
  if (earlier.n !== later.n) throw new Error("Season contrast N mismatch");
  const n = earlier.n;
  const keys = ["0-0", "1-1", "2-2", "3-3+", "draw"] as const;
  const count = (report: HsPanelSeasonReport, key: string): { obs: number; exp: number } => {
    if (key === "draw") {
      const total = report.residualDecomposition.find((row) => row.part === "TOTAL");
      return { obs: total?.observedCount ?? 0, exp: total?.expectedCount ?? 0 };
    }
    if (key === "3-3+") {
      const a = report.exactScoreOe.find((row) => row.key === "3-3");
      const b = report.exactScoreOe.find((row) => row.key === "4-4");
      const c = report.exactScoreOe.find((row) => row.key === "5-5+");
      return {
        obs: (a?.observedCount ?? 0) + (b?.observedCount ?? 0) + (c?.observedCount ?? 0),
        exp: (a?.expectedCount ?? 0) + (b?.expectedCount ?? 0) + (c?.expectedCount ?? 0),
      };
    }
    const row = report.exactScoreOe.find((item) => item.key === key);
    return { obs: row?.observedCount ?? 0, exp: row?.expectedCount ?? 0 };
  };
  const observedPp: Record<string, number> = {};
  const expectedPp: Record<string, number> = {};
  const shareOfObservedDrawDiff: Record<string, number | null> = {};
  const drawDiff = (count(later, "draw").obs - count(earlier, "draw").obs) / n;
  for (const key of keys) {
    observedPp[key] = (count(later, key).obs - count(earlier, key).obs) / n;
    expectedPp[key] = (count(later, key).exp - count(earlier, key).exp) / n;
    shareOfObservedDrawDiff[key] = Math.abs(drawDiff) < 0.005 ? null : observedPp[key]! / drawDiff;
  }
  return {
    earlierSeason: earlier.season,
    laterSeason: later.season,
    panel: earlier.panel,
    n,
    observedPp,
    expectedPp,
    shareOfObservedDrawDiff,
  };
}

function weightOe(parts: readonly OeRow[][]): OeRow[] {
  const first = parts[0] ?? [];
  return first.map((row, index) => {
    const observedCount = parts.reduce((sum, list) => sum + (list[index]?.observedCount ?? 0), 0);
    const expectedCount = parts.reduce((sum, list) => sum + (list[index]?.expectedCount ?? 0), 0);
    const n = parts.reduce((sum, list) => sum + (list[index] ? 1 : 0), 0);
    void n;
    return {
      key: row.key,
      observedCount,
      expectedCount,
      meanProbability: expectedCount,
      oeRatio: oe(observedCount, expectedCount),
    };
  });
}

export function poolHoldoutHs(reports: readonly HsPanelSeasonReport[]): {
  panel: HsPanelId;
  n: number;
  seasons: readonly string[];
  exactScoreOe: OeRow[];
  residualDecomposition: ResidualPartRow[];
  twoTwoByRatio: BucketCountRow[];
  twoTwoByXg: BucketCountRow[];
  conditionalDraw: ConditionalDrawRow[];
  correlation: CorrelationBlock;
  lowHighEqual: { low: OeRow; high: OeRow };
  lambda3: Lambda3Diagnostic[];
} {
  const holdouts = reports.filter((report) => report.role === "HOLDOUT");
  if (holdouts.some((report) => report.season === "2024")) {
    throw new Error("HOLDOUT-ONLY aggregate must exclude PL 2024");
  }
  if (holdouts.length === 0) throw new Error("HOLDOUT-ONLY aggregate is empty");
  const panel = holdouts[0]!.panel;
  if (holdouts.some((report) => report.panel !== panel)) {
    throw new Error("HOLDOUT-ONLY aggregate mixed panels");
  }
  const n = holdouts.reduce((sum, report) => sum + report.n, 0);
  const exactScoreOe = weightOe(holdouts.map((report) => report.exactScoreOe));
  const residualParts: ResidualPartRow[] = DRAW_RESIDUAL_PARTS.map((part, index) => {
    const observedCount = holdouts.reduce(
      (sum, report) => sum + (report.residualDecomposition[index]?.observedCount ?? 0),
      0,
    );
    const expectedCount = holdouts.reduce(
      (sum, report) => sum + (report.residualDecomposition[index]?.expectedCount ?? 0),
      0,
    );
    return {
      part,
      observedCount,
      expectedCount,
      residualCount: observedCount - expectedCount,
      shareOfResidual: null as number | null,
    };
  });
  const totalObs = holdouts.reduce(
    (sum, report) => sum + (report.residualDecomposition.find((row) => row.part === "TOTAL")?.observedCount ?? 0),
    0,
  );
  const totalExp = holdouts.reduce(
    (sum, report) => sum + (report.residualDecomposition.find((row) => row.part === "TOTAL")?.expectedCount ?? 0),
    0,
  );
  const totalResidual = totalObs - totalExp;
  for (const row of residualParts) row.shareOfResidual = share(row.residualCount, totalResidual);
  residualParts.push({
    part: "TOTAL",
    observedCount: totalObs,
    expectedCount: totalExp,
    residualCount: totalResidual,
    shareOfResidual: Math.abs(totalResidual) < RESIDUAL_SHARE_MIN_ABS ? null : 1,
  });
  const sumBucket = (pick: (report: HsPanelSeasonReport) => BucketCountRow[]): BucketCountRow[] => {
    const first = pick(holdouts[0]!);
    return first.map((row, index) => {
      const observed22 = holdouts.reduce((sum, report) => sum + (pick(report)[index]?.observed22 ?? 0), 0);
      const expected22 = holdouts.reduce((sum, report) => sum + (pick(report)[index]?.expected22 ?? 0), 0);
      const nMatches = holdouts.reduce((sum, report) => sum + (pick(report)[index]?.nMatches ?? 0), 0);
      return { bucket: row.bucket, nMatches, observed22, expected22, oeRatio: oe(observed22, expected22) };
    });
  };
  const condDenomObs = holdouts.reduce(
    (sum, report) => sum + (report.residualDecomposition.find((row) => row.part === "TOTAL")?.observedCount ?? 0),
    0,
  );
  const condDenomExp = holdouts.reduce(
    (sum, report) => sum + (report.residualDecomposition.find((row) => row.part === "TOTAL")?.expectedCount ?? 0),
    0,
  );
  const conditionalDraw = EQUAL_SCORE_KEYS.map((key, index) => {
    const observedCount = holdouts.reduce(
      (sum, report) =>
        sum +
        (report.conditionalDraw[index]?.observedGivenDraw ?? 0) *
          (report.residualDecomposition.find((row) => row.part === "TOTAL")?.observedCount ?? 0),
      0,
    );
    const expectedCount = holdouts.reduce(
      (sum, report) =>
        sum +
        (report.conditionalDraw[index]?.poissonGivenDraw ?? 0) *
          (report.residualDecomposition.find((row) => row.part === "TOTAL")?.expectedCount ?? 0),
      0,
    );
    return {
      key,
      observedGivenDraw: condDenomObs === 0 ? 0 : observedCount / condDenomObs,
      poissonGivenDraw: condDenomExp === 0 ? 0 : expectedCount / condDenomExp,
    };
  });
  const w = (value: (report: HsPanelSeasonReport) => number) =>
    n === 0 ? 0 : holdouts.reduce((sum, report) => sum + value(report) * report.n, 0) / n;
  const firstCorr = holdouts[0]!.correlation;
  const correlation: CorrelationBlock = {
    n,
    rawGoal: w((report) => report.correlation.rawGoal),
    residual: w((report) => report.correlation.residual),
    residualBootstrap: {
      ...firstCorr.residualBootstrap,
      estimate: w((report) => report.correlation.residualBootstrap.estimate),
      lo: w((report) => report.correlation.residualBootstrap.lo),
      hi: w((report) => report.correlation.residualBootstrap.hi),
    },
  };
  const lowHigh = {
    low: weightOe(holdouts.map((report) => [report.lowHighEqual.low]))[0]!,
    high: weightOe(holdouts.map((report) => [report.lowHighEqual.high]))[0]!,
  };
  const lambda3 = DECLARED_LAMBDA3.map((lambda3, index) => {
    const parts = holdouts.map((report) => report.lambda3[index]!);
    const ww = (value: (row: Lambda3Diagnostic) => number) =>
      n === 0 ? 0 : parts.reduce((sum, row) => sum + value(row) * row.n, 0) / n;
    return {
      lambda3,
      diagnosticOnly: true as const,
      n,
      logLoss: ww((row) => row.logLoss),
      brier: ww((row) => row.brier),
      ece: ww((row) => row.ece),
      drawBias: ww((row) => row.drawBias),
      homeBias: ww((row) => row.homeBias),
      awayBias: ww((row) => row.awayBias),
      meanDraw: ww((row) => row.meanDraw),
      meanP00: ww((row) => row.meanP00),
      meanP11: ww((row) => row.meanP11),
      meanP22: ww((row) => row.meanP22),
      meanP33: ww((row) => row.meanP33),
      meanP44plus: ww((row) => row.meanP44plus),
    };
  });
  return {
    panel,
    n,
    seasons: holdouts.map((report) => report.season),
    exactScoreOe,
    residualDecomposition: residualParts,
    twoTwoByRatio: sumBucket((report) => report.twoTwoByRatio),
    twoTwoByXg: sumBucket((report) => report.twoTwoByXg),
    conditionalDraw,
    correlation,
    lowHighEqual: lowHigh,
    lambda3,
  };
}
