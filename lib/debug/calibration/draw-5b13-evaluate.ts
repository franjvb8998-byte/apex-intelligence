/**
 * Empirical D0/D1 draw-channel evaluation. Frozen production G0. Not a tuner.
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
  assertRho0MirrorsIndependentPoisson,
  dcPoissonDraw,
  emptyDrawScorelines,
  panelDrawElos,
  predictBlendHybrid,
  predictDcHybrid,
  predictDrawBaseHybrid,
  predictHaHybrid,
  predictProductionDrawChain,
  type DrawSnapshot,
} from "@/lib/debug/calibration/draw-5b13-formula";
import {
  D1_NON_CANDIDATE_LABEL,
  DECLARED_BLEND_WEIGHTS,
  DECLARED_DC_RHOS,
  DECLARED_DRAW_BASE_DELTAS,
  DRAW_NAMED_TRACES,
  DRAW_PROB_BUCKETS,
  DRAW_SCORELINE_KEYS,
  ELO_GAP_DRAW_BUCKETS,
  LAMBDA_RATIO_DRAW_BUCKETS,
  TOTAL_XG_DRAW_BUCKETS,
  drawProbBucket,
  eloGapDrawBucket,
  lambdaRatioDrawBucket,
  observedDrawScoreline,
  totalXgDrawBucket,
  type DrawPanelId,
  type DrawProbBucket,
  type DrawScorelineKey,
  type EloGapDrawBucket,
  type LambdaRatioDrawBucket,
  type TotalXgDrawBucket,
} from "@/lib/debug/calibration/draw-5b13-shape";
import type {
  CalibrationOutcome,
  CalibrationRow,
  OneXTwo,
} from "@/lib/debug/calibration/types";

export type NumericFailure = {
  fixtureId: string;
  panel: DrawPanelId;
  reason: string;
};

export type DrawMatchTrace = {
  fixtureId: string;
  kickoff: string;
  season: string;
  seasonRole: "HOLDOUT" | "DEVELOPMENT";
  panel: DrawPanelId;
  homeTeamName: string;
  awayTeamName: string;
  actualOutcome: CalibrationOutcome;
  actualHomeGoals: number;
  actualAwayGoals: number;
  actualDraw: 0 | 1;
  snapshot: DrawSnapshot;
};

export type ChannelMetrics = {
  n: number;
  logLoss: number;
  brier: number;
  ece: number;
  homeBias: number;
  drawBias: number;
  awayBias: number;
  predictedHome: number;
  predictedDraw: number;
  predictedAway: number;
  observedHome: number;
  observedDraw: number;
  observedAway: number;
  meanEloDraw: number;
  meanPoissonDraw: number;
  meanHybridDraw: number;
};

export type DrawProbBucketRow = {
  bucket: DrawProbBucket;
  n: number;
  meanPredictedDraw: number;
  observedDraw: number;
  residual: number;
  meanLogLoss: number;
  meanEloDraw: number;
  meanPoissonDraw: number;
  meanAbsEloGap: number;
  meanLambdaRatio: number;
};

export type EloGapForensicRow = {
  bucket: EloGapDrawBucket;
  n: number;
  meanEloDraw: number;
  observedDraw: number;
  residual: number;
};

export type PoissonRatioRow = {
  bucket: LambdaRatioDrawBucket;
  n: number;
  meanPoissonDraw: number;
  observedDraw: number;
  residual: number;
  meanHybridDraw: number;
};

export type TotalXgRow = {
  bucket: TotalXgDrawBucket;
  n: number;
  meanPoissonDraw: number;
  observedDraw: number;
  residual: number;
  meanHybridDraw: number;
};

export type ScorelineCompareRow = {
  key: DrawScorelineKey;
  observedCount: number;
  expectedCount: number;
  oeRatio: number | null;
};

export type IsolatedDiagnostic = {
  id: string;
  family: "dc" | "drawBase" | "blend" | "ha";
  diagnosticOnly: true;
  metrics: ChannelMetrics;
  meanEloDraw: number;
  meanPoissonDraw: number;
  meanHybridDraw: number;
};

export type NamedDrawTrace = {
  label: string;
  fixtureId: string;
  season: string;
  score: string;
  actualOutcome: CalibrationOutcome;
  panel: DrawPanelId;
  homeElo: number;
  awayElo: number;
  elo: OneXTwo;
  lambdaHome: number;
  lambdaAway: number;
  poisson: OneXTwo;
  hybrid: OneXTwo;
  diagnostics: {
    dcRho0: OneXTwo;
    dcRhoM05: OneXTwo;
    dcRhoM10: OneXTwo;
    drawBaseM03: OneXTwo;
    drawBaseP03: OneXTwo;
    blend05: OneXTwo;
    blend09: OneXTwo;
    ha0: OneXTwo;
  };
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function observedRates(traces: readonly DrawMatchTrace[]): OneXTwo {
  const n = traces.length;
  if (n === 0) return { home: 0, draw: 0, away: 0 };
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const trace of traces) {
    if (trace.actualOutcome === "home") home += 1;
    else if (trace.actualOutcome === "draw") draw += 1;
    else away += 1;
  }
  return { home: home / n, draw: draw / n, away: away / n };
}

function scoreHybrid(
  traces: readonly DrawMatchTrace[],
  hybridOf: (trace: DrawMatchTrace) => OneXTwo,
): ChannelMetrics {
  const hybrids = traces.map(hybridOf);
  const metrics = summarizeMetrics(
    traces.map((trace, index) => ({
      predicted: hybrids[index]!,
      actual: trace.actualOutcome,
      bucket: "10+",
      policyId: `${trace.panel}-draw`,
    })),
  );
  const predicted = {
    home: mean(hybrids.map((row) => row.home)),
    draw: mean(hybrids.map((row) => row.draw)),
    away: mean(hybrids.map((row) => row.away)),
  };
  const observed = observedRates(traces);
  return {
    n: traces.length,
    logLoss: metrics.logLoss,
    brier: metrics.brier,
    ece: metrics.ece,
    homeBias: predicted.home - observed.home,
    drawBias: predicted.draw - observed.draw,
    awayBias: predicted.away - observed.away,
    predictedHome: predicted.home,
    predictedDraw: predicted.draw,
    predictedAway: predicted.away,
    observedHome: observed.home,
    observedDraw: observed.draw,
    observedAway: observed.away,
    meanEloDraw: mean(traces.map((trace) => trace.snapshot.elo.draw)),
    meanPoissonDraw: mean(traces.map((trace) => trace.snapshot.poisson.draw)),
    meanHybridDraw: predicted.draw,
  };
}

export function snapshotDrawPanel(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  panel: DrawPanelId;
}): { traces: DrawMatchTrace[]; failures: NumericFailure[] } {
  const before = snapshotDefaultHybridConfig();
  const traces: DrawMatchTrace[] = [];
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
      assertRho0MirrorsIndependentPoisson(snapshot);
      if (
        !isValidOneXTwo(snapshot.hybrid) ||
        !isValidOneXTwo(snapshot.elo) ||
        !isValidOneXTwo(snapshot.poisson) ||
        !(snapshot.lambdaHome > 0) ||
        !(snapshot.lambdaAway > 0)
      ) {
        throw new Error("Draw chain produced invalid probabilities");
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
        actualDraw: row.actualOutcome === "draw" ? 1 : 0,
        snapshot,
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
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== 0.28) {
    throw new Error("Production eloDrawBase mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.poissonBlendWeight !== 0.7) {
    throw new Error("Production blend mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.homeAdvantageElo !== 65) {
    throw new Error("Production homeAdvantageElo mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== 400) {
    throw new Error("Production eloGoalScale mutated");
  }
  return { traces, failures };
}

function drawProbRows(traces: readonly DrawMatchTrace[]): DrawProbBucketRow[] {
  return DRAW_PROB_BUCKETS.map((bucket) => {
    const scoped = traces.filter((trace) => drawProbBucket(trace.snapshot.hybrid.draw) === bucket);
    const metrics = summarizeMetrics(
      scoped.map((trace) => ({
        predicted: trace.snapshot.hybrid,
        actual: trace.actualOutcome,
        bucket: "10+",
        policyId: "draw-bucket",
      })),
    );
    const predicted = mean(scoped.map((trace) => trace.snapshot.hybrid.draw));
    const observed = mean(scoped.map((trace) => trace.actualDraw));
    return {
      bucket,
      n: scoped.length,
      meanPredictedDraw: predicted,
      observedDraw: observed,
      residual: predicted - observed,
      meanLogLoss: scoped.length === 0 ? 0 : metrics.logLoss,
      meanEloDraw: mean(scoped.map((trace) => trace.snapshot.elo.draw)),
      meanPoissonDraw: mean(scoped.map((trace) => trace.snapshot.poisson.draw)),
      meanAbsEloGap: mean(scoped.map((trace) => Math.abs(trace.snapshot.rawGap))),
      meanLambdaRatio: mean(scoped.map((trace) => trace.snapshot.lambdaRatio)),
    };
  });
}

function eloGapRows(traces: readonly DrawMatchTrace[]): EloGapForensicRow[] {
  return ELO_GAP_DRAW_BUCKETS.map((bucket) => {
    const scoped = traces.filter((trace) => eloGapDrawBucket(Math.abs(trace.snapshot.rawGap)) === bucket);
    const predicted = mean(scoped.map((trace) => trace.snapshot.elo.draw));
    const observed = mean(scoped.map((trace) => trace.actualDraw));
    return {
      bucket,
      n: scoped.length,
      meanEloDraw: predicted,
      observedDraw: observed,
      residual: predicted - observed,
    };
  });
}

function lambdaRows(traces: readonly DrawMatchTrace[]): PoissonRatioRow[] {
  return LAMBDA_RATIO_DRAW_BUCKETS.map((bucket) => {
    const scoped = traces.filter(
      (trace) => lambdaRatioDrawBucket(trace.snapshot.lambdaRatio) === bucket,
    );
    const predicted = mean(scoped.map((trace) => trace.snapshot.poisson.draw));
    const observed = mean(scoped.map((trace) => trace.actualDraw));
    return {
      bucket,
      n: scoped.length,
      meanPoissonDraw: predicted,
      observedDraw: observed,
      residual: predicted - observed,
      meanHybridDraw: mean(scoped.map((trace) => trace.snapshot.hybrid.draw)),
    };
  });
}

function totalXgRows(traces: readonly DrawMatchTrace[]): TotalXgRow[] {
  return TOTAL_XG_DRAW_BUCKETS.map((bucket) => {
    const scoped = traces.filter((trace) => totalXgDrawBucket(trace.snapshot.totalXg) === bucket);
    const predicted = mean(scoped.map((trace) => trace.snapshot.poisson.draw));
    const observed = mean(scoped.map((trace) => trace.actualDraw));
    return {
      bucket,
      n: scoped.length,
      meanPoissonDraw: predicted,
      observedDraw: observed,
      residual: predicted - observed,
      meanHybridDraw: mean(scoped.map((trace) => trace.snapshot.hybrid.draw)),
    };
  });
}

function scorelineRows(traces: readonly DrawMatchTrace[]): ScorelineCompareRow[] {
  const observed = emptyDrawScorelines();
  const expected = emptyDrawScorelines();
  for (const trace of traces) {
    const key = observedDrawScoreline(trace.actualHomeGoals, trace.actualAwayGoals);
    if (key) observed[key] += 1;
    for (const part of DRAW_SCORELINE_KEYS) {
      expected[part] += trace.snapshot.expectedDrawScorelines[part];
    }
  }
  return DRAW_SCORELINE_KEYS.map((key) => ({
    key,
    observedCount: observed[key],
    expectedCount: expected[key],
    oeRatio: expected[key] > 0 ? observed[key] / expected[key] : null,
  }));
}

function isolatedDiagnostics(traces: readonly DrawMatchTrace[]): IsolatedDiagnostic[] {
  const rows: IsolatedDiagnostic[] = [];
  for (const rho of DECLARED_DC_RHOS) {
    if (rho === 0) continue;
    const metrics = scoreHybrid(traces, (trace) => predictDcHybrid(trace.snapshot, rho));
    rows.push({
      id: `dc:${rho}`,
      family: "dc",
      diagnosticOnly: true,
      metrics,
      meanEloDraw: mean(traces.map((trace) => trace.snapshot.elo.draw)),
      meanPoissonDraw: mean(traces.map((trace) => dcPoissonDraw(trace.snapshot, rho))),
      meanHybridDraw: metrics.meanHybridDraw,
    });
  }
  for (const delta of DECLARED_DRAW_BASE_DELTAS) {
    const metrics = scoreHybrid(traces, (trace) => predictDrawBaseHybrid(trace.snapshot, delta).hybrid);
    rows.push({
      id: `drawBase:${delta > 0 ? "+" : ""}${delta}`,
      family: "drawBase",
      diagnosticOnly: true,
      metrics: {
        ...metrics,
        meanEloDraw: mean(traces.map((trace) => predictDrawBaseHybrid(trace.snapshot, delta).elo.draw)),
      },
      meanEloDraw: mean(traces.map((trace) => predictDrawBaseHybrid(trace.snapshot, delta).elo.draw)),
      meanPoissonDraw: mean(traces.map((trace) => trace.snapshot.poisson.draw)),
      meanHybridDraw: metrics.meanHybridDraw,
    });
  }
  for (const weight of DECLARED_BLEND_WEIGHTS) {
    if (weight === 0.7) continue;
    const metrics = scoreHybrid(traces, (trace) => predictBlendHybrid(trace.snapshot, weight));
    rows.push({
      id: `blend:${weight}`,
      family: "blend",
      diagnosticOnly: true,
      metrics,
      meanEloDraw: mean(traces.map((trace) => trace.snapshot.elo.draw)),
      meanPoissonDraw: mean(traces.map((trace) => trace.snapshot.poisson.draw)),
      meanHybridDraw: metrics.meanHybridDraw,
    });
  }
  const ha = scoreHybrid(traces, (trace) => predictHaHybrid(trace.snapshot, 0).hybrid);
  rows.push({
    id: "ha:0",
    family: "ha",
    diagnosticOnly: true,
    metrics: {
      ...ha,
      meanEloDraw: mean(traces.map((trace) => predictHaHybrid(trace.snapshot, 0).elo.draw)),
    },
    meanEloDraw: mean(traces.map((trace) => predictHaHybrid(trace.snapshot, 0).elo.draw)),
    meanPoissonDraw: mean(traces.map((trace) => trace.snapshot.poisson.draw)),
    meanHybridDraw: ha.meanHybridDraw,
  });
  return rows;
}

function namedTraces(traces: readonly DrawMatchTrace[]): NamedDrawTrace[] {
  return DRAW_NAMED_TRACES.flatMap((spec) => {
    const match = traces.find(
      (row) =>
        row.season === spec.season &&
        row.homeTeamName === spec.home &&
        row.awayTeamName === spec.away &&
        `${row.actualHomeGoals}-${row.actualAwayGoals}` === spec.score,
    );
    if (!match) return [];
    const snap = match.snapshot;
    return [
      {
        label: `${spec.season} ${spec.home} vs ${spec.away} ${spec.score}`,
        fixtureId: match.fixtureId,
        season: match.season,
        score: spec.score,
        actualOutcome: match.actualOutcome,
        panel: match.panel,
        homeElo: snap.homeElo,
        awayElo: snap.awayElo,
        elo: snap.elo,
        lambdaHome: snap.lambdaHome,
        lambdaAway: snap.lambdaAway,
        poisson: snap.poisson,
        hybrid: snap.hybrid,
        diagnostics: {
          dcRho0: predictDcHybrid(snap, 0),
          dcRhoM05: predictDcHybrid(snap, -0.05),
          dcRhoM10: predictDcHybrid(snap, -0.1),
          drawBaseM03: predictDrawBaseHybrid(snap, -0.03).hybrid,
          drawBaseP03: predictDrawBaseHybrid(snap, 0.03).hybrid,
          blend05: predictBlendHybrid(snap, 0.5),
          blend09: predictBlendHybrid(snap, 0.9),
          ha0: predictHaHybrid(snap, 0).hybrid,
        },
      },
    ];
  });
}

export type PanelSeasonDrawReport = {
  panel: DrawPanelId;
  panelLabel: string;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  n: number;
  failures: NumericFailure[];
  production: ChannelMetrics;
  decomposition: {
    meanEloDraw: number;
    meanPoissonDraw: number;
    meanHybridDraw: number;
    meanDrawFromElo: number;
    meanDrawFromPoisson: number;
    observedDraw: number;
  };
  drawProbBuckets: DrawProbBucketRow[];
  eloGapForensics: EloGapForensicRow[];
  poissonRatioForensics: PoissonRatioRow[];
  totalXgForensics: TotalXgRow[];
  scorelines: ScorelineCompareRow[];
  diagnostics: IsolatedDiagnostic[];
  namedTraces: NamedDrawTrace[];
};

export function evaluateDrawPanelSeason(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  panel: DrawPanelId;
}): PanelSeasonDrawReport {
  const snap = snapshotDrawPanel(input);
  const production = scoreHybrid(snap.traces, (trace) => trace.snapshot.hybrid);
  return {
    panel: input.panel,
    panelLabel: input.panel === "D1" ? D1_NON_CANDIDATE_LABEL : "PRODUCTION_CHAIN_C0_G0",
    season: input.season,
    role: input.role,
    n: input.rows.length,
    failures: snap.failures,
    production,
    decomposition: {
      meanEloDraw: mean(snap.traces.map((trace) => trace.snapshot.elo.draw)),
      meanPoissonDraw: mean(snap.traces.map((trace) => trace.snapshot.poisson.draw)),
      meanHybridDraw: mean(snap.traces.map((trace) => trace.snapshot.hybrid.draw)),
      meanDrawFromElo: mean(snap.traces.map((trace) => trace.snapshot.drawContributionFromElo)),
      meanDrawFromPoisson: mean(snap.traces.map((trace) => trace.snapshot.drawContributionFromPoisson)),
      observedDraw: production.observedDraw,
    },
    drawProbBuckets: drawProbRows(snap.traces),
    eloGapForensics: eloGapRows(snap.traces),
    poissonRatioForensics: lambdaRows(snap.traces),
    totalXgForensics: totalXgRows(snap.traces),
    scorelines: scorelineRows(snap.traces),
    diagnostics: isolatedDiagnostics(snap.traces),
    namedTraces: namedTraces(snap.traces),
  };
}

function weightMetrics(parts: readonly ChannelMetrics[], n: number): ChannelMetrics {
  const first = parts[0];
  if (!first || n === 0) {
    return {
      n: 0,
      logLoss: 0,
      brier: 0,
      ece: 0,
      homeBias: 0,
      drawBias: 0,
      awayBias: 0,
      predictedHome: 0,
      predictedDraw: 0,
      predictedAway: 0,
      observedHome: 0,
      observedDraw: 0,
      observedAway: 0,
      meanEloDraw: 0,
      meanPoissonDraw: 0,
      meanHybridDraw: 0,
    };
  }
  const w = (value: (metrics: ChannelMetrics) => number) =>
    parts.reduce((sum, metrics) => sum + value(metrics) * metrics.n, 0) / n;
  return {
    n,
    logLoss: w((metrics) => metrics.logLoss),
    brier: w((metrics) => metrics.brier),
    ece: w((metrics) => metrics.ece),
    homeBias: w((metrics) => metrics.homeBias),
    drawBias: w((metrics) => metrics.drawBias),
    awayBias: w((metrics) => metrics.awayBias),
    predictedHome: w((metrics) => metrics.predictedHome),
    predictedDraw: w((metrics) => metrics.predictedDraw),
    predictedAway: w((metrics) => metrics.predictedAway),
    observedHome: w((metrics) => metrics.observedHome),
    observedDraw: w((metrics) => metrics.observedDraw),
    observedAway: w((metrics) => metrics.observedAway),
    meanEloDraw: w((metrics) => metrics.meanEloDraw),
    meanPoissonDraw: w((metrics) => metrics.meanPoissonDraw),
    meanHybridDraw: w((metrics) => metrics.meanHybridDraw),
  };
}

export function poolHoldoutDraw(reports: readonly PanelSeasonDrawReport[]): {
  panel: DrawPanelId;
  n: number;
  seasons: readonly string[];
  production: ChannelMetrics;
  drawProbBuckets: DrawProbBucketRow[];
  eloGapForensics: EloGapForensicRow[];
  poissonRatioForensics: PoissonRatioRow[];
  totalXgForensics: TotalXgRow[];
  scorelines: ScorelineCompareRow[];
  diagnostics: IsolatedDiagnostic[];
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
  const wBucket = <T extends { n: number }>(
    pick: (report: PanelSeasonDrawReport) => readonly T[],
    key: keyof T,
  ): T[] => {
    const first = pick(holdouts[0]!);
    return first.map((row, index) => {
      const parts = holdouts.map((report) => pick(report)[index]!);
      const cellN = parts.reduce((sum, part) => sum + part.n, 0);
      const weighted = { ...row, n: cellN };
      for (const field of Object.keys(row) as (keyof T)[]) {
        if (field === "n" || field === key || typeof row[field] !== "number") continue;
        const value =
          cellN === 0
            ? 0
            : parts.reduce((sum, part) => sum + (part[field] as number) * part.n, 0) / cellN;
        (weighted as Record<string, unknown>)[field as string] = value;
      }
      return weighted;
    });
  };
  const scorelines = DRAW_SCORELINE_KEYS.map((key, index) => {
    const parts = holdouts.map((report) => report.scorelines[index]!);
    const observedCount = parts.reduce((sum, row) => sum + row.observedCount, 0);
    const expectedCount = parts.reduce((sum, row) => sum + row.expectedCount, 0);
    return {
      key,
      observedCount,
      expectedCount,
      oeRatio: expectedCount > 0 ? observedCount / expectedCount : null,
    };
  });
  const diagnostics = holdouts[0]!.diagnostics.map((diag, index) => {
    const parts = holdouts.map((report) => report.diagnostics[index]!);
    const metrics = weightMetrics(
      parts.map((part) => part.metrics),
      n,
    );
    return {
      ...diag,
      metrics,
      meanEloDraw: metrics.meanEloDraw,
      meanPoissonDraw: parts.reduce((sum, part) => sum + part.meanPoissonDraw * part.metrics.n, 0) / n,
      meanHybridDraw: metrics.meanHybridDraw,
    };
  });
  return {
    panel,
    n,
    seasons: holdouts.map((report) => report.season),
    production: weightMetrics(
      holdouts.map((report) => report.production),
      n,
    ),
    drawProbBuckets: wBucket((report) => report.drawProbBuckets, "bucket"),
    eloGapForensics: wBucket((report) => report.eloGapForensics, "bucket"),
    poissonRatioForensics: wBucket((report) => report.poissonRatioForensics, "bucket"),
    totalXgForensics: wBucket((report) => report.totalXgForensics, "bucket"),
    scorelines,
    diagnostics,
  };
}

export function residual2025(report: PanelSeasonDrawReport): {
  observedDraw: number;
  meanEloDraw: number;
  meanPoissonDraw: number;
  hybridDraw: number;
  deficit: number;
  effectDcM05: number;
  effectDcM10: number;
  effectDrawBaseM03: number;
  effectDrawBaseP03: number;
  effectBlend05: number;
  effectBlend09: number;
  effectHa0: number;
} {
  if (report.season !== "2025") throw new Error("2025 residual requires 2025 report");
  const find = (id: string) => report.diagnostics.find((row) => row.id === id);
  const hybrid = report.decomposition.meanHybridDraw;
  return {
    observedDraw: report.decomposition.observedDraw,
    meanEloDraw: report.decomposition.meanEloDraw,
    meanPoissonDraw: report.decomposition.meanPoissonDraw,
    hybridDraw: hybrid,
    deficit: hybrid - report.decomposition.observedDraw,
    effectDcM05: (find("dc:-0.05")?.meanHybridDraw ?? hybrid) - hybrid,
    effectDcM10: (find("dc:-0.1")?.meanHybridDraw ?? hybrid) - hybrid,
    effectDrawBaseM03: (find("drawBase:-0.03")?.meanHybridDraw ?? hybrid) - hybrid,
    effectDrawBaseP03: (find("drawBase:+0.03")?.meanHybridDraw ?? hybrid) - hybrid,
    effectBlend05: (find("blend:0.5")?.meanHybridDraw ?? hybrid) - hybrid,
    effectBlend09: (find("blend:0.9")?.meanHybridDraw ?? hybrid) - hybrid,
    effectHa0: (find("ha:0")?.meanHybridDraw ?? hybrid) - hybrid,
  };
}
