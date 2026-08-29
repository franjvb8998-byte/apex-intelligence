import { mean, round4, variance } from "@/lib/intelligence-learning/math";
import type {
  LearningMetricRow,
  LearningMetricsReport,
  SettledLearningCase,
} from "@/lib/intelligence-learning/types";
import { INTELLIGENCE_LEARNING_VERSION } from "@/lib/intelligence-learning/types";

function rowsFrom(
  cases: SettledLearningCase[],
  keyOf: (row: SettledLearningCase) => string,
): LearningMetricRow[] {
  const buckets = new Map<string, SettledLearningCase[]>();
  for (const row of cases) {
    const key = keyOf(row);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  return [...buckets.entries()].map(([key, list]) => {
    const rois = list
      .map((row) => row.result.roi)
      .filter((n): n is number => n != null);
    const evs = list
      .map((row) => row.recommendation.expectedValue)
      .filter((n): n is number => n != null);
    const conf = list
      .map((row) => row.recommendation.confidence)
      .filter((n): n is number => n != null);
    const wins = list.filter((row) => row.result.win).length;
    return {
      key,
      sampleSize: list.length,
      roi: mean(rois),
      winRate: list.length === 0 ? null : round4(wins / list.length),
      averageEv: mean(evs),
      averageConfidence: mean(conf),
      variance: variance(rois),
    };
  });
}

function rank(
  rows: LearningMetricRow[],
  pick: (row: LearningMetricRow) => number | null,
  direction: "desc" | "asc",
  limit = 5,
): LearningMetricRow[] {
  const scored = rows.filter((row) => pick(row) != null);
  scored.sort((a, b) => {
    const left = pick(a) ?? 0;
    const right = pick(b) ?? 0;
    return direction === "desc" ? right - left : left - right;
  });
  return scored.slice(0, limit);
}

export function evaluateLearningMetrics(
  cases: SettledLearningCase[],
): LearningMetricsReport {
  const markets = rowsFrom(cases, (row) => row.recommendation.market);
  const leagues = rowsFrom(cases, (row) => row.recommendation.competition);
  return {
    engineVersion: INTELLIGENCE_LEARNING_VERSION,
    sampleSize: cases.length,
    mostProfitableMarkets: rank(markets, (row) => row.roi, "desc"),
    worstMarkets: rank(markets, (row) => row.roi, "asc"),
    bestLeagues: rank(leagues, (row) => row.roi, "desc"),
    worstLeagues: rank(leagues, (row) => row.roi, "asc"),
    highestConfidenceMarkets: rank(markets, (row) => row.averageConfidence, "desc"),
    highestVarianceMarkets: rank(markets, (row) => row.variance, "desc"),
    highestExpectedValueMarkets: rank(markets, (row) => row.averageEv, "desc"),
  };
}
