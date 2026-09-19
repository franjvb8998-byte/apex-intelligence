/**
 * Empirical P0/P7 × G0–G5 Elo→xG evaluation. Frozen inputs. Not a tuner.
 */

import {
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { isValidOneXTwo, summarizeMetrics } from "@/lib/debug/calibration/metrics";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import { distributionSummary, lambdaRatio } from "@/lib/debug/calibration/xg-5b9-geometry";
import { catalogueEloGapBucket } from "@/lib/debug/calibration/cat-5b10-formula";
import {
  CATALOGUE_ELO_GAP_BUCKETS,
  type CatalogueEloGapBucket,
} from "@/lib/debug/calibration/cat-5b10-shape";
import { confidenceFromHybrid } from "@/lib/intelligence/modules/probability";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import {
  assertG0MirrorsProductionEngine,
  assertP0MirrorsC0,
  assertP7MirrorsC7,
  panelMatchElos,
  predictDebugGeometry,
} from "@/lib/debug/calibration/xg-5b12-formula";
import {
  GEOMETRY_ARMS,
  GEOMETRY_DELTA_CONTRASTS,
  GEOMETRY_EVIDENCE_SCOPES,
  GEOMETRY_NAMED_TRACES,
  P7_NON_CANDIDATE_LABEL,
  geometryArmSpec,
  type GeometryArmId,
  type GeometryDeltaContrast,
  type GeometryEvidenceScope,
  type GeometryPanelId,
} from "@/lib/debug/calibration/xg-5b12-shape";
import type {
  CalibrationOutcome,
  CalibrationRow,
  EvidenceBucket,
  OneXTwo,
} from "@/lib/debug/calibration/types";

export type NumericFailure = {
  fixtureId: string;
  panel: GeometryPanelId;
  armId: GeometryArmId;
  reason: string;
};

export type GeometryMatchTrace = {
  fixtureId: string;
  kickoff: string;
  season: string;
  seasonRole: "HOLDOUT" | "DEVELOPMENT";
  panel: GeometryPanelId;
  armId: GeometryArmId;
  eloGoalScale: number;
  homeTeamName: string;
  awayTeamName: string;
  actualOutcome: CalibrationOutcome;
  actualHomeGoals: number;
  actualAwayGoals: number;
  evidenceBucket: EvidenceBucket;
  homeElo: number;
  awayElo: number;
  rawGap: number;
  absGap: number;
  effectiveGap: number;
  lambdaHome: number;
  lambdaAway: number;
  lambdaRatio: number;
  poisson: OneXTwo;
  hybrid: OneXTwo;
  confidence: number;
};

export type GeometryMetrics = {
  armId: GeometryArmId;
  n: number;
  logLoss: number;
  brier: number;
  ece: number;
  predictedHome: number;
  observedHome: number;
  homeBias: number;
  predictedDraw: number;
  observedDraw: number;
  drawBias: number;
  predictedAway: number;
  observedAway: number;
  awayBias: number;
  countMaxGe80: number;
  countMaxGe90: number;
  countMaxGe95: number;
  meanLambdaRatio: number;
  medianLambdaRatio: number;
  p90LambdaRatio: number;
  p95LambdaRatio: number;
  maxLambdaRatio: number;
  meanPoissonDraw: number;
  meanHybridDraw: number;
  accuracy: number;
  meanConfidence: number;
};

export type GeometryGapBucketRow = {
  armId: GeometryArmId;
  bucket: CatalogueEloGapBucket;
  n: number;
  observed: OneXTwo;
  predicted: OneXTwo;
  drawBias: number;
  logLoss: number;
  brier: number;
  meanLambdaRatio: number;
  countMaxGe90: number;
};

export type GeometryDelta = {
  contrast: GeometryDeltaContrast;
  dLogLoss: number;
  dBrier: number;
  dEce: number;
  dHomeBias: number;
  dDrawBias: number;
  dCountGe90: number;
  dCountGe95: number;
  dMeanLambdaRatio: number;
};

export type NamedGeometryTrace = {
  label: string;
  fixtureId: string;
  season: string;
  score: string;
  actualOutcome: CalibrationOutcome;
  panel: GeometryPanelId;
  armId: GeometryArmId;
  homeElo: number;
  awayElo: number;
  rawGap: number;
  effectiveGap: number;
  eloGoalScale: number;
  lambdaHome: number;
  lambdaAway: number;
  lambdaRatio: number;
  poisson: OneXTwo;
  hybrid: OneXTwo;
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function peak(oneXTwo: OneXTwo): number {
  return Math.max(oneXTwo.home, oneXTwo.draw, oneXTwo.away);
}

function observedRates(traces: readonly GeometryMatchTrace[]): OneXTwo {
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

export function summarizeGeometryTraces(traces: readonly GeometryMatchTrace[]): GeometryMetrics {
  const armId = traces[0]?.armId ?? "G0";
  const metrics = summarizeMetrics(
    traces.map((trace) => ({
      predicted: trace.hybrid,
      actual: trace.actualOutcome,
      bucket: trace.evidenceBucket,
      policyId: `${trace.panel}-${armId}`,
    })),
  );
  const predicted = {
    home: mean(traces.map((trace) => trace.hybrid.home)),
    draw: mean(traces.map((trace) => trace.hybrid.draw)),
    away: mean(traces.map((trace) => trace.hybrid.away)),
  };
  const observed = observedRates(traces);
  const ratios = traces.map((trace) => trace.lambdaRatio);
  const ratioSummary = distributionSummary(ratios);
  return {
    armId,
    n: traces.length,
    logLoss: metrics.logLoss,
    brier: metrics.brier,
    ece: metrics.ece,
    predictedHome: predicted.home,
    observedHome: observed.home,
    homeBias: predicted.home - observed.home,
    predictedDraw: predicted.draw,
    observedDraw: observed.draw,
    drawBias: predicted.draw - observed.draw,
    predictedAway: predicted.away,
    observedAway: observed.away,
    awayBias: predicted.away - observed.away,
    countMaxGe80: traces.filter((trace) => peak(trace.hybrid) >= 0.8).length,
    countMaxGe90: traces.filter((trace) => peak(trace.hybrid) >= 0.9).length,
    countMaxGe95: traces.filter((trace) => peak(trace.hybrid) >= 0.95).length,
    meanLambdaRatio: ratioSummary.mean,
    medianLambdaRatio: ratioSummary.median,
    p90LambdaRatio: ratioSummary.p90,
    p95LambdaRatio: ratioSummary.p95,
    maxLambdaRatio: ratioSummary.max,
    meanPoissonDraw: mean(traces.map((trace) => trace.poisson.draw)),
    meanHybridDraw: mean(traces.map((trace) => trace.hybrid.draw)),
    accuracy: metrics.accuracy,
    meanConfidence: mean(traces.map((trace) => trace.confidence)),
  };
}

export function snapshotGeometryArm(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  panel: GeometryPanelId;
  armId: GeometryArmId;
}): { traces: GeometryMatchTrace[]; failures: NumericFailure[] } {
  const before = snapshotDefaultHybridConfig();
  const spec = geometryArmSpec(input.armId);
  const traces: GeometryMatchTrace[] = [];
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
      if (input.panel === "P0") assertP0MirrorsC0(row);
      else assertP7MirrorsC7(row);
      const elos = panelMatchElos(input.panel, row);
      if (input.armId === "G0") assertG0MirrorsProductionEngine(elos);
      const predicted = predictDebugGeometry({
        ...elos,
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        matchId: row.fixtureId,
        armId: input.armId,
      });
      if (
        !isValidOneXTwo(predicted.oneXTwo) ||
        !isValidOneXTwo(predicted.poisson.oneXTwo) ||
        !(predicted.expectedGoals.home > 0) ||
        !(predicted.expectedGoals.away > 0)
      ) {
        throw new Error("Debug geometry produced invalid probabilities");
      }
      traces.push({
        fixtureId: row.fixtureId,
        kickoff: row.kickoff,
        season: row.season,
        seasonRole: input.role,
        panel: input.panel,
        armId: input.armId,
        eloGoalScale: spec.eloGoalScale,
        homeTeamName: row.homeTeamName,
        awayTeamName: row.awayTeamName,
        actualOutcome: row.actualOutcome,
        actualHomeGoals: row.actualHomeGoals,
        actualAwayGoals: row.actualAwayGoals,
        evidenceBucket: rowEvidenceBucket(row),
        homeElo: elos.homeElo,
        awayElo: elos.awayElo,
        rawGap: predicted.rawGap,
        absGap: Math.abs(predicted.rawGap),
        effectiveGap: predicted.effectiveGap,
        lambdaHome: predicted.expectedGoals.home,
        lambdaAway: predicted.expectedGoals.away,
        lambdaRatio: lambdaRatio(predicted.expectedGoals.home, predicted.expectedGoals.away),
        poisson: predicted.poisson.oneXTwo,
        hybrid: predicted.oneXTwo,
        confidence: confidenceFromHybrid(predicted).value,
      });
    } catch (error) {
      failures.push({
        fixtureId: row.fixtureId,
        panel: input.panel,
        armId: input.armId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  assertProductionHybridConfigUnchanged(before);
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== 400) {
    throw new Error("Production eloGoalScale mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.homeAdvantageElo !== 65) {
    throw new Error("Production homeAdvantageElo mutated");
  }
  return { traces, failures };
}

function gapRows(armId: GeometryArmId, traces: readonly GeometryMatchTrace[]): GeometryGapBucketRow[] {
  return CATALOGUE_ELO_GAP_BUCKETS.map((bucket) => {
    const scoped = traces.filter((trace) => catalogueEloGapBucket(trace.absGap) === bucket);
    const metrics = summarizeMetrics(
      scoped.map((trace) => ({
        predicted: trace.hybrid,
        actual: trace.actualOutcome,
        bucket: trace.evidenceBucket,
        policyId: armId,
      })),
    );
    const predicted = {
      home: mean(scoped.map((trace) => trace.hybrid.home)),
      draw: mean(scoped.map((trace) => trace.hybrid.draw)),
      away: mean(scoped.map((trace) => trace.hybrid.away)),
    };
    const observed = observedRates(scoped);
    return {
      armId,
      bucket,
      n: scoped.length,
      observed,
      predicted,
      drawBias: predicted.draw - observed.draw,
      logLoss: metrics.logLoss,
      brier: metrics.brier,
      meanLambdaRatio: mean(scoped.map((trace) => trace.lambdaRatio)),
      countMaxGe90: scoped.filter((trace) => peak(trace.hybrid) >= 0.9).length,
    };
  });
}

export function subtractGeometry(
  left: GeometryMetrics,
  right: GeometryMetrics,
  contrast: GeometryDeltaContrast,
): GeometryDelta {
  return {
    contrast,
    dLogLoss: left.logLoss - right.logLoss,
    dBrier: left.brier - right.brier,
    dEce: left.ece - right.ece,
    dHomeBias: left.homeBias - right.homeBias,
    dDrawBias: left.drawBias - right.drawBias,
    dCountGe90: left.countMaxGe90 - right.countMaxGe90,
    dCountGe95: left.countMaxGe95 - right.countMaxGe95,
    dMeanLambdaRatio: left.meanLambdaRatio - right.meanLambdaRatio,
  };
}

function namedTraces(traces: readonly GeometryMatchTrace[]): NamedGeometryTrace[] {
  return GEOMETRY_NAMED_TRACES.flatMap((spec) => {
    const match = traces.find(
      (row) =>
        row.season === spec.season &&
        row.homeTeamName === spec.home &&
        row.awayTeamName === spec.away &&
        `${row.actualHomeGoals}-${row.actualAwayGoals}` === spec.score,
    );
    if (!match) return [];
    return [
      {
        label: `${spec.season} ${spec.home} vs ${spec.away} ${spec.score}`,
        fixtureId: match.fixtureId,
        season: match.season,
        score: `${match.actualHomeGoals}-${match.actualAwayGoals}`,
        actualOutcome: match.actualOutcome,
        panel: match.panel,
        armId: match.armId,
        homeElo: match.homeElo,
        awayElo: match.awayElo,
        rawGap: match.rawGap,
        effectiveGap: match.effectiveGap,
        eloGoalScale: match.eloGoalScale,
        lambdaHome: match.lambdaHome,
        lambdaAway: match.lambdaAway,
        lambdaRatio: match.lambdaRatio,
        poisson: match.poisson,
        hybrid: match.hybrid,
      },
    ];
  });
}

function emptyMetrics(armId: GeometryArmId): GeometryMetrics {
  return { ...summarizeGeometryTraces([]), armId, n: 0 };
}

export type GeometryArmReport = {
  armId: GeometryArmId;
  eloGoalScale: number;
  capEffectiveGap: boolean;
  all: GeometryMetrics;
  byEvidence: Record<GeometryEvidenceScope, GeometryMetrics>;
  gapBuckets: GeometryGapBucketRow[];
  namedTraces: NamedGeometryTrace[];
};

export type PanelSeasonReport = {
  panel: GeometryPanelId;
  panelLabel: string;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  n: number;
  failures: NumericFailure[];
  peHomeAdvantageElo: number;
  arms: Record<GeometryArmId, GeometryArmReport>;
  deltas: GeometryDelta[];
};

export function evaluatePanelSeason(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  panel: GeometryPanelId;
}): PanelSeasonReport {
  const failures: NumericFailure[] = [];
  const arms = {} as Record<GeometryArmId, GeometryArmReport>;
  for (const armId of GEOMETRY_ARMS) {
    const spec = geometryArmSpec(armId);
    const snap = snapshotGeometryArm({ ...input, armId });
    failures.push(...snap.failures);
    const byEvidence = {} as Record<GeometryEvidenceScope, GeometryMetrics>;
    for (const scope of GEOMETRY_EVIDENCE_SCOPES) {
      const scoped =
        scope === "all"
          ? snap.traces
          : snap.traces.filter((trace) => trace.evidenceBucket === scope);
      byEvidence[scope] =
        scoped.length === 0 ? emptyMetrics(armId) : summarizeGeometryTraces(scoped);
    }
    arms[armId] = {
      armId,
      eloGoalScale: spec.eloGoalScale,
      capEffectiveGap: spec.capEffectiveGap,
      all: summarizeGeometryTraces(snap.traces),
      byEvidence,
      gapBuckets: gapRows(armId, snap.traces),
      namedTraces: namedTraces(snap.traces),
    };
  }
  const g0 = arms.G0.all;
  const deltas = GEOMETRY_DELTA_CONTRASTS.map((contrast) => {
    const leftId = contrast.split("-")[0] as GeometryArmId;
    return subtractGeometry(arms[leftId].all, g0, contrast);
  });
  return {
    panel: input.panel,
    panelLabel: input.panel === "P7" ? P7_NON_CANDIDATE_LABEL : "PRODUCTION_INPUT_C0",
    season: input.season,
    role: input.role,
    n: input.rows.length,
    failures,
    peHomeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    arms,
    deltas,
  };
}

export function poolHoldoutGeometry(reports: readonly PanelSeasonReport[]): {
  panel: GeometryPanelId;
  n: number;
  seasons: readonly string[];
  arms: Record<GeometryArmId, GeometryMetrics>;
  deltas: GeometryDelta[];
} {
  const holdouts = reports.filter((report) => report.role === "HOLDOUT");
  if (holdouts.some((report) => report.season === "2024")) {
    throw new Error("HOLDOUT-ONLY aggregate must exclude PL 2024");
  }
  if (holdouts.length === 0) {
    throw new Error("HOLDOUT-ONLY aggregate is empty");
  }
  const panel = holdouts[0]!.panel;
  if (holdouts.some((report) => report.panel !== panel)) {
    throw new Error("HOLDOUT-ONLY aggregate mixed panels");
  }
  const n = holdouts.reduce((sum, report) => sum + report.n, 0);
  const arms = {} as Record<GeometryArmId, GeometryMetrics>;
  for (const armId of GEOMETRY_ARMS) {
    const parts = holdouts.map((report) => report.arms[armId].all);
    const weight = (value: (metrics: GeometryMetrics) => number) =>
      n === 0 ? 0 : parts.reduce((sum, metrics) => sum + value(metrics) * metrics.n, 0) / n;
    const first = parts[0] ?? emptyMetrics(armId);
    arms[armId] = {
      ...first,
      armId,
      n,
      logLoss: weight((metrics) => metrics.logLoss),
      brier: weight((metrics) => metrics.brier),
      ece: weight((metrics) => metrics.ece),
      predictedHome: weight((metrics) => metrics.predictedHome),
      observedHome: weight((metrics) => metrics.observedHome),
      homeBias: weight((metrics) => metrics.homeBias),
      predictedDraw: weight((metrics) => metrics.predictedDraw),
      observedDraw: weight((metrics) => metrics.observedDraw),
      drawBias: weight((metrics) => metrics.drawBias),
      predictedAway: weight((metrics) => metrics.predictedAway),
      observedAway: weight((metrics) => metrics.observedAway),
      awayBias: weight((metrics) => metrics.awayBias),
      countMaxGe80: parts.reduce((sum, metrics) => sum + metrics.countMaxGe80, 0),
      countMaxGe90: parts.reduce((sum, metrics) => sum + metrics.countMaxGe90, 0),
      countMaxGe95: parts.reduce((sum, metrics) => sum + metrics.countMaxGe95, 0),
      meanLambdaRatio: weight((metrics) => metrics.meanLambdaRatio),
      medianLambdaRatio: weight((metrics) => metrics.medianLambdaRatio),
      p90LambdaRatio: weight((metrics) => metrics.p90LambdaRatio),
      p95LambdaRatio: weight((metrics) => metrics.p95LambdaRatio),
      maxLambdaRatio: Math.max(0, ...parts.map((metrics) => metrics.maxLambdaRatio)),
      meanPoissonDraw: weight((metrics) => metrics.meanPoissonDraw),
      meanHybridDraw: weight((metrics) => metrics.meanHybridDraw),
      accuracy: weight((metrics) => metrics.accuracy),
      meanConfidence: weight((metrics) => metrics.meanConfidence),
    };
  }
  const g0 = arms.G0;
  const deltas = GEOMETRY_DELTA_CONTRASTS.map((contrast) => {
    const leftId = contrast.split("-")[0] as GeometryArmId;
    return subtractGeometry(arms[leftId], g0, contrast);
  });
  return {
    panel,
    n,
    seasons: holdouts.map((report) => report.season),
    arms,
    deltas,
  };
}
