import {
  APEX_SCORE_BUCKETS,
  CONFIDENCE_BUCKETS,
  bucketKey,
} from "@/lib/intelligence-learning/buckets";
import { mean, ratio, round4 } from "@/lib/intelligence-learning/math";
import type {
  PerformanceReport,
  SettledLearningCase,
  SliceMetrics,
} from "@/lib/intelligence-learning/types";
import { INTELLIGENCE_LEARNING_VERSION } from "@/lib/intelligence-learning/types";

function emptySlice(key: string): SliceMetrics {
  return {
    key,
    sampleSize: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    roi: null,
    sizedRoi: null,
    averageOdds: null,
    averageEv: null,
    averageStake: null,
    averageApexScore: null,
    averageConfidence: null,
    kellyEfficiency: null,
  };
}

function sliceFrom(key: string, rows: SettledLearningCase[]): SliceMetrics {
  const wins = rows.filter((row) => row.result.win).length;
  const losses = rows.filter((row) => row.result.loss).length;
  const rois = rows
    .map((row) => row.result.roi)
    .filter((n): n is number => n != null);
  const sizedRois = rows
    .map((row) => row.result.sizedRoi)
    .filter((n): n is number => n != null);
  const odds = rows
    .map((row) => row.recommendation.odds)
    .filter((n): n is number => n != null && n > 1);
  const evs = rows
    .map((row) => row.recommendation.expectedValue)
    .filter((n): n is number => n != null);
  const stakes = rows.map((row) => row.result.sizedStake);
  const scores = rows.map((row) => row.recommendation.apexScore);
  const conf = rows
    .map((row) => row.recommendation.confidence)
    .filter((n): n is number => n != null);

  let kellyProfit = 0;
  let kellyAllocated = 0;
  for (const row of rows) {
    const kelly = (row.recommendation.kellyStake ?? 0) / 100;
    if (kelly <= 0 || row.recommendation.odds == null) continue;
    kellyAllocated += kelly;
    kellyProfit += row.result.win
      ? (row.recommendation.odds - 1) * kelly
      : -kelly;
  }

  return {
    key,
    sampleSize: rows.length,
    wins,
    losses,
    winRate: ratio(wins, rows.length),
    roi: mean(rois),
    sizedRoi: mean(sizedRois),
    averageOdds: mean(odds),
    averageEv: mean(evs),
    averageStake: mean(stakes),
    averageApexScore: mean(scores),
    averageConfidence: mean(conf),
    kellyEfficiency:
      kellyAllocated > 0 ? round4(kellyProfit / kellyAllocated) : null,
  };
}

function group(
  rows: SettledLearningCase[],
  keyOf: (row: SettledLearningCase) => string | null,
): SliceMetrics[] {
  const buckets = new Map<string, SettledLearningCase[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .map(([key, list]) => sliceFrom(key, list))
    .sort((a, b) => (b.roi ?? -999) - (a.roi ?? -999));
}

export function evaluatePerformance(
  rows: SettledLearningCase[],
  pendingCount = 0,
): PerformanceReport {
  return {
    engineVersion: INTELLIGENCE_LEARNING_VERSION,
    sampleSize: rows.length,
    pendingCount,
    settledCount: rows.length,
    overall: rows.length === 0 ? emptySlice("overall") : sliceFrom("overall", rows),
    byRecommendationTier: group(rows, (row) => row.recommendation.recommendation),
    byMarket: group(rows, (row) => row.recommendation.market),
    byLeague: group(rows, (row) => row.recommendation.competition),
    byConfidenceBucket: group(rows, (row) =>
      bucketKey(row.recommendation.confidence, CONFIDENCE_BUCKETS),
    ),
    byApexScoreBucket: group(rows, (row) =>
      bucketKey(row.recommendation.apexScore, APEX_SCORE_BUCKETS),
    ),
  };
}
