/**
 * Empirical C0–C7 input-geometry evaluation. Frozen production Elo→xG. Not a tuner.
 */

import { createIsolatedDrawEngine } from "@/lib/debug/calibration/draw-5b7-trace";
import {
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { frozenValidationConfig } from "@/lib/debug/calibration/validation-5b6-configs";
import {
  isValidOneXTwo,
  summarizeMetrics,
} from "@/lib/debug/calibration/metrics";
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
  assertC0MirrorsCurrentCatalogue,
  resolveMatchElos,
} from "@/lib/debug/calibration/ig-5b11-formula";
import {
  INPUT_GEOMETRY_ARMS,
  INPUT_GEOMETRY_DELTA_CONTRASTS,
  INPUT_GEOMETRY_EVIDENCE_SCOPES,
  INPUT_GEOMETRY_NAMED_TRACES,
  PE_HOME_ADVANTAGE_REMAINS,
  type InputGeometryArmId,
  type InputGeometryDeltaContrast,
  type InputGeometryEvidenceScope,
} from "@/lib/debug/calibration/ig-5b11-shape";
import type {
  CalibrationOutcome,
  CalibrationRow,
  EvidenceBucket,
  OneXTwo,
} from "@/lib/debug/calibration/types";

export type NumericFailure = {
  fixtureId: string;
  armId: InputGeometryArmId;
  reason: string;
};

export type ArmMatchTrace = {
  fixtureId: string;
  kickoff: string;
  season: string;
  seasonRole: "HOLDOUT" | "DEVELOPMENT";
  armId: InputGeometryArmId;
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
  lambdaHome: number;
  lambdaAway: number;
  lambdaRatio: number;
  poisson: OneXTwo;
  hybrid: OneXTwo;
  confidence: number;
};

export type ArmMetrics = {
  armId: InputGeometryArmId;
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
  meanSignedGap: number;
  meanAbsGap: number;
  medianAbsGap: number;
  p90AbsGap: number;
  p95AbsGap: number;
  maxAbsGap: number;
  countGe200: number;
  countGe250: number;
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

export type GapBucketRow = {
  armId: InputGeometryArmId;
  bucket: CatalogueEloGapBucket;
  n: number;
  observed: OneXTwo;
  predicted: OneXTwo;
  drawBias: number;
  logLoss: number;
  brier: number;
  meanLambdaRatio: number;
};

export type IsolatedDelta = {
  contrast: InputGeometryDeltaContrast;
  dLogLoss: number;
  dBrier: number;
  dEce: number;
  dHomeBias: number;
  dDrawBias: number;
  dCountGe90: number;
  dCountGe200: number;
  dCountGe250: number;
  dMeanLambdaRatio: number;
};

export type NamedMatchArmTrace = {
  label: string;
  fixtureId: string;
  kickoff: string;
  season: string;
  score: string;
  actualOutcome: CalibrationOutcome;
  armId: InputGeometryArmId;
  homeElo: number;
  awayElo: number;
  rawGap: number;
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

function observedRates(traces: readonly ArmMatchTrace[]): OneXTwo {
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

export function summarizeArmTraces(traces: readonly ArmMatchTrace[]): ArmMetrics {
  const armId = traces[0]?.armId ?? "C0";
  const n = traces.length;
  const metrics = summarizeMetrics(
    traces.map((trace) => ({
      predicted: trace.hybrid,
      actual: trace.actualOutcome,
      bucket: trace.evidenceBucket,
      policyId: armId,
    })),
  );
  const predicted = {
    home: mean(traces.map((trace) => trace.hybrid.home)),
    draw: mean(traces.map((trace) => trace.hybrid.draw)),
    away: mean(traces.map((trace) => trace.hybrid.away)),
  };
  const observed = observedRates(traces);
  const absGaps = traces.map((trace) => trace.absGap);
  const absSummary = distributionSummary(absGaps);
  const ratios = traces.map((trace) => trace.lambdaRatio);
  const ratioSummary = distributionSummary(ratios);
  return {
    armId,
    n,
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
    meanSignedGap: mean(traces.map((trace) => trace.rawGap)),
    meanAbsGap: absSummary.mean,
    medianAbsGap: absSummary.median,
    p90AbsGap: absSummary.p90,
    p95AbsGap: absSummary.p95,
    maxAbsGap: absSummary.max,
    countGe200: absGaps.filter((value) => value >= 200).length,
    countGe250: absGaps.filter((value) => value >= 250).length,
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

export function snapshotArmSeason(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  armId: InputGeometryArmId;
}): { traces: ArmMatchTrace[]; failures: NumericFailure[] } {
  const before = snapshotDefaultHybridConfig();
  const engine = createIsolatedDrawEngine(frozenValidationConfig("V0"));
  const traces: ArmMatchTrace[] = [];
  const failures: NumericFailure[] = [];
  const seen = new Set<string>();
  for (const row of input.rows) {
    if (row.season !== input.season) {
      throw new Error(`Season identity mismatch: row ${row.season} vs ${input.season}`);
    }
    if (seen.has(row.fixtureId)) {
      throw new Error(`Duplicate fixture ${row.fixtureId}`);
    }
    seen.add(row.fixtureId);
    if (row.actualOutcome == null || row.actualHomeGoals == null || row.actualAwayGoals == null) {
      throw new Error(`Unlabeled outcome on ${row.fixtureId}`);
    }
    try {
      if (row.homePlayedBefore < 0 || row.awayPlayedBefore < 0) {
        throw new Error("playedBefore < 0");
      }
      if (row.homeWinsBefore > row.homePlayedBefore || row.awayWinsBefore > row.awayPlayedBefore) {
        throw new Error("winsBefore > playedBefore");
      }
      if (row.homeGfBefore < 0 || row.homeGaBefore < 0 || row.awayGfBefore < 0 || row.awayGaBefore < 0) {
        throw new Error("GF/GA < 0");
      }
      if (input.armId === "C0") assertC0MirrorsCurrentCatalogue(row);
      const elos = resolveMatchElos(input.armId, row);
      if (!Number.isFinite(elos.homeElo) || !Number.isFinite(elos.awayElo)) {
        throw new Error("Non-finite Elo");
      }
      const predicted = engine.predict({
        homeElo: elos.homeElo,
        awayElo: elos.awayElo,
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        matchId: row.fixtureId,
      });
      if (
        !isValidOneXTwo(predicted.oneXTwo) ||
        !isValidOneXTwo(predicted.poisson.oneXTwo) ||
        !(predicted.expectedGoals.home > 0) ||
        !(predicted.expectedGoals.away > 0)
      ) {
        throw new Error("Frozen production geometry produced invalid probabilities");
      }
      traces.push({
        fixtureId: row.fixtureId,
        kickoff: row.kickoff,
        season: row.season,
        seasonRole: input.role,
        armId: input.armId,
        homeTeamName: row.homeTeamName,
        awayTeamName: row.awayTeamName,
        actualOutcome: row.actualOutcome,
        actualHomeGoals: row.actualHomeGoals,
        actualAwayGoals: row.actualAwayGoals,
        evidenceBucket: rowEvidenceBucket(row),
        homeElo: elos.homeElo,
        awayElo: elos.awayElo,
        rawGap: elos.homeElo - elos.awayElo,
        absGap: Math.abs(elos.homeElo - elos.awayElo),
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
        armId: input.armId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  assertProductionHybridConfigUnchanged(before);
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== 400) {
    throw new Error("Production eloGoalScale mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.homeAdvantageElo !== PE_HOME_ADVANTAGE_REMAINS) {
    throw new Error("Production homeAdvantageElo mutated");
  }
  return { traces, failures };
}

function gapRows(armId: InputGeometryArmId, traces: readonly ArmMatchTrace[]): GapBucketRow[] {
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
    };
  });
}

export function subtractMetrics(left: ArmMetrics, right: ArmMetrics, contrast: InputGeometryDeltaContrast): IsolatedDelta {
  return {
    contrast,
    dLogLoss: left.logLoss - right.logLoss,
    dBrier: left.brier - right.brier,
    dEce: left.ece - right.ece,
    dHomeBias: left.homeBias - right.homeBias,
    dDrawBias: left.drawBias - right.drawBias,
    dCountGe90: left.countMaxGe90 - right.countMaxGe90,
    dCountGe200: left.countGe200 - right.countGe200,
    dCountGe250: left.countGe250 - right.countGe250,
    dMeanLambdaRatio: left.meanLambdaRatio - right.meanLambdaRatio,
  };
}

function namedTracesForArm(traces: readonly ArmMatchTrace[]): NamedMatchArmTrace[] {
  return INPUT_GEOMETRY_NAMED_TRACES.flatMap((spec) => {
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
        kickoff: match.kickoff,
        season: match.season,
        score: `${match.actualHomeGoals}-${match.actualAwayGoals}`,
        actualOutcome: match.actualOutcome,
        armId: match.armId,
        homeElo: match.homeElo,
        awayElo: match.awayElo,
        rawGap: match.rawGap,
        lambdaHome: match.lambdaHome,
        lambdaAway: match.lambdaAway,
        lambdaRatio: match.lambdaRatio,
        poisson: match.poisson,
        hybrid: match.hybrid,
      },
    ];
  });
}

export type ArmSeasonReport = {
  armId: InputGeometryArmId;
  all: ArmMetrics;
  byEvidence: Record<InputGeometryEvidenceScope, ArmMetrics>;
  gapBuckets: GapBucketRow[];
  namedTraces: NamedMatchArmTrace[];
};

export type SeasonInputGeometryReport = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  n: number;
  failures: NumericFailure[];
  peHomeAdvantageElo: number;
  catalogueRolePriorIsolatedFromPeHa: true;
  arms: Record<InputGeometryArmId, ArmSeasonReport>;
  deltas: IsolatedDelta[];
};

function emptyMetrics(armId: InputGeometryArmId): ArmMetrics {
  return { ...summarizeArmTraces([]), armId, n: 0 };
}

export function evaluateSeasonInputGeometry(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
}): SeasonInputGeometryReport {
  const failures: NumericFailure[] = [];
  const arms = {} as Record<InputGeometryArmId, ArmSeasonReport>;
  for (const armId of INPUT_GEOMETRY_ARMS) {
    const snap = snapshotArmSeason({ ...input, armId });
    failures.push(...snap.failures);
    const byEvidence = {} as Record<InputGeometryEvidenceScope, ArmMetrics>;
    for (const scope of INPUT_GEOMETRY_EVIDENCE_SCOPES) {
      const scoped =
        scope === "all"
          ? snap.traces
          : snap.traces.filter((trace) => trace.evidenceBucket === scope);
      byEvidence[scope] = scoped.length === 0 ? { ...emptyMetrics(armId), armId, n: 0 } : summarizeArmTraces(scoped);
    }
    arms[armId] = {
      armId,
      all: summarizeArmTraces(snap.traces),
      byEvidence,
      gapBuckets: gapRows(armId, snap.traces),
      namedTraces: namedTracesForArm(snap.traces),
    };
  }
  const c0 = arms.C0.all;
  const deltas = INPUT_GEOMETRY_DELTA_CONTRASTS.map((contrast) => {
    const leftId = contrast.split("-")[0] as InputGeometryArmId;
    return subtractMetrics(arms[leftId].all, c0, contrast);
  });
  return {
    season: input.season,
    role: input.role,
    n: input.rows.length,
    failures,
    peHomeAdvantageElo: PE_HOME_ADVANTAGE_REMAINS,
    catalogueRolePriorIsolatedFromPeHa: true,
    arms,
    deltas,
  };
}

export function poolHoldoutOnly(reports: readonly SeasonInputGeometryReport[]): {
  n: number;
  seasons: readonly string[];
  arms: Record<InputGeometryArmId, ArmMetrics>;
  deltas: IsolatedDelta[];
} {
  const holdouts = reports.filter((report) => report.role === "HOLDOUT");
  if (holdouts.some((report) => report.season === "2024")) {
    throw new Error("HOLDOUT-ONLY aggregate must exclude PL 2024");
  }
  const n = holdouts.reduce((sum, report) => sum + report.n, 0);
  const arms = {} as Record<InputGeometryArmId, ArmMetrics>;
  for (const armId of INPUT_GEOMETRY_ARMS) {
    const parts = holdouts.map((report) => report.arms[armId].all);
    const weight = (value: (metrics: ArmMetrics) => number) =>
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
      meanSignedGap: weight((metrics) => metrics.meanSignedGap),
      meanAbsGap: weight((metrics) => metrics.meanAbsGap),
      medianAbsGap: weight((metrics) => metrics.medianAbsGap),
      p90AbsGap: weight((metrics) => metrics.p90AbsGap),
      p95AbsGap: weight((metrics) => metrics.p95AbsGap),
      maxAbsGap: Math.max(0, ...parts.map((metrics) => metrics.maxAbsGap)),
      countGe200: parts.reduce((sum, metrics) => sum + metrics.countGe200, 0),
      countGe250: parts.reduce((sum, metrics) => sum + metrics.countGe250, 0),
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
  const c0 = arms.C0;
  const deltas = INPUT_GEOMETRY_DELTA_CONTRASTS.map((contrast) => {
    const leftId = contrast.split("-")[0] as InputGeometryArmId;
    return subtractMetrics(arms[leftId], c0, contrast);
  });
  return {
    n,
    seasons: holdouts.map((report) => report.season),
    arms,
    deltas,
  };
}
