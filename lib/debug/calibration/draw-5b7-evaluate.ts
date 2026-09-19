/**
 * 5B.7 draw-mass evaluator. Frozen V0/V5 only. Not a tuner.
 */

import {
  eloGapBucket,
  scorelineGroup,
  totalXgBucket,
  xgDiffBucket,
} from "@/lib/debug/calibration/draw-5b7-buckets";
import {
  CONFIDENCE_BANDS,
  ELO_GAP_BUCKETS,
  SCORELINE_GROUPS,
  TOTAL_XG_BUCKETS,
  XG_DIFF_BUCKETS,
  type DrawForensicsConfigId,
  type DrawForensicsSeason,
  type ForensicConfidenceBand,
  type ScorelineGroup,
} from "@/lib/debug/calibration/draw-5b7-shape";
import {
  peakOneXTwo,
  traceSeasonDraw,
  type DrawTrace,
} from "@/lib/debug/calibration/draw-5b7-trace";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

export type DrawMassDecomposition = {
  n: number;
  observedDraw: number;
  meanEloDraw: number;
  meanPoissonDraw: number;
  meanHybridDraw: number;
  poissonMinusElo: number;
  hybridMinusElo: number;
  hybridMinusPoisson: number;
  observedMinusHybrid: number;
};

export type DrawCurveRow = {
  bucket: string;
  n: number;
  observedDraw: number;
  meanEloDraw: number;
  meanPoissonDraw: number;
  meanHybridDraw: number;
  hybridDrawBias: number;
  meanXgTotal: number;
  meanAbsXgDiff: number;
  meanAbsEloGap: number;
};

export type ScorelineForensicsRow = {
  group: ScorelineGroup | "non_draw";
  n: number;
  meanPredictedDraw: number;
  meanPoissonDraw: number;
  meanEloDraw: number;
  meanXgHome: number;
  meanXgAway: number;
  meanXgTotal: number;
  meanAbsEloGap: number;
};

export type ConfidenceForensicsRow = {
  band: ForensicConfidenceBand;
  n: number;
  observedDraw: number;
  predictedHybridDraw: number;
  drawBias: number;
  meanMaxProbability: number;
  meanAbsEloGap: number;
};

export type HighConfidenceDrawForensics = {
  nHigh: number;
  actualDraws: number;
  meanDrawProbabilityOnActualDraws: number;
  drawProbLt10: number;
  drawProbLt05: number;
};

export type ExtremeDrawMiss = {
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoff: string;
  actualScore: string;
  eloGap: number;
  eloDraw: number;
  poissonDraw: number;
  hybrid: { home: number; draw: number; away: number };
  xg: { home: number; away: number };
  confidence: number;
};

export type SeasonDrawForensics = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
  n: number;
  decomposition: DrawMassDecomposition;
  eloGapCurve: DrawCurveRow[];
  xgDiffCurve: DrawCurveRow[];
  totalXgCurve: DrawCurveRow[];
  scorelines: ScorelineForensicsRow[];
  confidence: ConfidenceForensicsRow[];
  highConfidence: HighConfidenceDrawForensics;
  extremeDrawsGte80: number;
  extremeDrawsGte90: number;
  extremeCases: ExtremeDrawMiss[];
  traces: DrawTrace[];
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function observedDrawRate(traces: readonly DrawTrace[]): number {
  if (traces.length === 0) return 0;
  return traces.filter((trace) => trace.actualOutcome === "draw").length / traces.length;
}

export function decomposeDrawMass(traces: readonly DrawTrace[]): DrawMassDecomposition {
  const n = traces.length;
  const observedDraw = observedDrawRate(traces);
  const meanEloDraw = mean(traces.map((trace) => trace.eloDraw));
  const meanPoissonDraw = mean(traces.map((trace) => trace.poissonDraw));
  const meanHybridDraw = mean(traces.map((trace) => trace.hybridDraw));
  return {
    n,
    observedDraw,
    meanEloDraw,
    meanPoissonDraw,
    meanHybridDraw,
    poissonMinusElo: meanPoissonDraw - meanEloDraw,
    hybridMinusElo: meanHybridDraw - meanEloDraw,
    hybridMinusPoisson: meanHybridDraw - meanPoissonDraw,
    observedMinusHybrid: observedDraw - meanHybridDraw,
  };
}

function curve(
  traces: readonly DrawTrace[],
  bucketOf: (trace: DrawTrace) => string,
  labels: readonly string[],
): DrawCurveRow[] {
  return labels.map((bucket) => {
    const scoped = traces.filter((trace) => bucketOf(trace) === bucket);
    const observedDraw = observedDrawRate(scoped);
    const meanHybridDraw = mean(scoped.map((trace) => trace.hybridDraw));
    return {
      bucket,
      n: scoped.length,
      observedDraw,
      meanEloDraw: mean(scoped.map((trace) => trace.eloDraw)),
      meanPoissonDraw: mean(scoped.map((trace) => trace.poissonDraw)),
      meanHybridDraw,
      hybridDrawBias: meanHybridDraw - observedDraw,
      meanXgTotal: mean(scoped.map((trace) => trace.xgTotal)),
      meanAbsXgDiff: mean(scoped.map((trace) => trace.absXgDiff)),
      meanAbsEloGap: mean(scoped.map((trace) => trace.absEloGap)),
    };
  });
}

function scorelineTable(traces: readonly DrawTrace[]): ScorelineForensicsRow[] {
  const groups: Array<ScorelineGroup | "non_draw"> = [...SCORELINE_GROUPS, "non_draw"];
  return groups.map((group) => {
    const scoped = traces.filter((trace) =>
      scorelineGroup({
        actualOutcome: trace.actualOutcome,
        actualHomeGoals: trace.actualHomeGoals,
        actualAwayGoals: trace.actualAwayGoals,
      }) === group,
    );
    return {
      group,
      n: scoped.length,
      meanPredictedDraw: mean(scoped.map((trace) => trace.hybridDraw)),
      meanPoissonDraw: mean(scoped.map((trace) => trace.poissonDraw)),
      meanEloDraw: mean(scoped.map((trace) => trace.eloDraw)),
      meanXgHome: mean(scoped.map((trace) => trace.xgHome)),
      meanXgAway: mean(scoped.map((trace) => trace.xgAway)),
      meanXgTotal: mean(scoped.map((trace) => trace.xgTotal)),
      meanAbsEloGap: mean(scoped.map((trace) => trace.absEloGap)),
    };
  });
}

function confidenceTable(traces: readonly DrawTrace[]): ConfidenceForensicsRow[] {
  return CONFIDENCE_BANDS.map((band) => {
    const scoped = traces.filter((trace) => trace.confidenceBand === band);
    const observedDraw = observedDrawRate(scoped);
    const predictedHybridDraw = mean(scoped.map((trace) => trace.hybridDraw));
    return {
      band,
      n: scoped.length,
      observedDraw,
      predictedHybridDraw,
      drawBias: predictedHybridDraw - observedDraw,
      meanMaxProbability: mean(scoped.map((trace) => peakOneXTwo(trace.hybridOneXTwo))),
      meanAbsEloGap: mean(scoped.map((trace) => trace.absEloGap)),
    };
  });
}

function highConfidenceDraws(traces: readonly DrawTrace[]): HighConfidenceDrawForensics {
  const high = traces.filter((trace) => trace.confidenceBand === "high");
  const actualDraws = high.filter((trace) => trace.actualOutcome === "draw");
  return {
    nHigh: high.length,
    actualDraws: actualDraws.length,
    meanDrawProbabilityOnActualDraws: mean(actualDraws.map((trace) => trace.hybridDraw)),
    drawProbLt10: actualDraws.filter((trace) => trace.hybridDraw < 0.1).length,
    drawProbLt05: actualDraws.filter((trace) => trace.hybridDraw < 0.05).length,
  };
}

function compareExtreme(a: DrawTrace, b: DrawTrace): number {
  const peakDelta = peakOneXTwo(b.hybridOneXTwo) - peakOneXTwo(a.hybridOneXTwo);
  if (peakDelta !== 0) return peakDelta;
  return a.fixtureId.localeCompare(b.fixtureId);
}

export function extractExtremeDrawMisses(
  traces: readonly DrawTrace[],
  limit = 10,
): ExtremeDrawMiss[] {
  return traces
    .filter((trace) => trace.actualOutcome === "draw")
    .slice()
    .sort(compareExtreme)
    .slice(0, limit)
    .map((trace) => ({
      fixtureId: trace.fixtureId,
      homeTeamName: trace.homeTeamName,
      awayTeamName: trace.awayTeamName,
      kickoff: trace.kickoff,
      actualScore: `${trace.actualHomeGoals}-${trace.actualAwayGoals}`,
      eloGap: trace.eloGap,
      eloDraw: trace.eloDraw,
      poissonDraw: trace.poissonDraw,
      hybrid: { ...trace.hybridOneXTwo },
      xg: { home: trace.xgHome, away: trace.xgAway },
      confidence: trace.confidence,
    }));
}

export function evaluateSeasonDrawForensics(input: {
  rows: readonly CalibrationRow[];
  season: DrawForensicsSeason | string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
}): SeasonDrawForensics {
  const traces = traceSeasonDraw(input);
  const draws = traces.filter((trace) => trace.actualOutcome === "draw");
  return {
    season: input.season,
    role: input.role,
    configId: input.configId,
    n: traces.length,
    decomposition: decomposeDrawMass(traces),
    eloGapCurve: curve(traces, (trace) => eloGapBucket(trace.absEloGap), ELO_GAP_BUCKETS),
    xgDiffCurve: curve(traces, (trace) => xgDiffBucket(trace.absXgDiff), XG_DIFF_BUCKETS),
    totalXgCurve: curve(traces, (trace) => totalXgBucket(trace.xgTotal), TOTAL_XG_BUCKETS),
    scorelines: scorelineTable(traces),
    confidence: confidenceTable(traces),
    highConfidence: highConfidenceDraws(traces),
    extremeDrawsGte80: draws.filter((trace) => peakOneXTwo(trace.hybridOneXTwo) >= 0.8).length,
    extremeDrawsGte90: draws.filter((trace) => peakOneXTwo(trace.hybridOneXTwo) >= 0.9).length,
    extremeCases: extractExtremeDrawMisses(traces),
    traces,
  };
}

export function evaluateDrawForensicsConfigs(input: {
  rows: readonly CalibrationRow[];
  season: DrawForensicsSeason | string;
  role: "HOLDOUT" | "DEVELOPMENT";
}): Record<DrawForensicsConfigId, SeasonDrawForensics> {
  return {
    V0: evaluateSeasonDrawForensics({ ...input, configId: "V0" }),
    V5: evaluateSeasonDrawForensics({ ...input, configId: "V5" }),
  };
}

