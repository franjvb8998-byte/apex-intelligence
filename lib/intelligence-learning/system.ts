import type { IntelligenceLearningSystem } from "@/lib/intelligence-learning/contracts";
import { InMemoryIntelligenceLearningStore } from "@/lib/intelligence-learning/memory";
import { createRecommendationRegistry } from "@/lib/intelligence-learning/recommendations";
import { createResultRegistry } from "@/lib/intelligence-learning/results";
import { evaluateCalibration } from "@/lib/intelligence-learning/calibration";
import { exportLearningDataset } from "@/lib/intelligence-learning/dataset";
import { evaluateLearningMetrics } from "@/lib/intelligence-learning/metrics";
import { evaluatePerformance } from "@/lib/intelligence-learning/performance";
import type { IntelligenceLearningStore } from "@/lib/intelligence-learning/contracts";
import type {
  CalibrationReport,
  LearningFeatureRow,
  LearningMetricsReport,
  PerformanceReport,
  RecommendationDraft,
  RecommendationRecord,
  SettledLearningCase,
  SettlementInput,
} from "@/lib/intelligence-learning/types";

export type IntelligenceLearningServices = IntelligenceLearningSystem & {
  register(draft: RecommendationDraft): RecommendationRecord;
  settle(input: SettlementInput): SettledLearningCase;
  performance(): PerformanceReport;
  calibration(): CalibrationReport;
  metrics(): LearningMetricsReport;
  dataset(): LearningFeatureRow[];
};

export function listSettledCases(
  store: IntelligenceLearningStore,
): SettledLearningCase[] {
  const results = store.listResults();
  const cases: SettledLearningCase[] = [];
  for (const result of results) {
    const recommendation = store.getRecommendation(result.recommendationId);
    if (!recommendation) continue;
    cases.push({ recommendation, result });
  }
  return cases;
}

export function createIntelligenceLearningSystem(
  store: IntelligenceLearningStore = new InMemoryIntelligenceLearningStore(),
): IntelligenceLearningServices {
  const recommendations = createRecommendationRegistry(store);
  const results = createResultRegistry(store);

  return {
    store,
    recommendations,
    results,
    listSettled: () => listSettledCases(store),
    register(draft) {
      return recommendations.register(draft);
    },
    settle(input) {
      const result = results.settle(input);
      const recommendation = store.getRecommendation(result.recommendationId);
      if (!recommendation) {
        throw new Error(`Settled recommendation ${result.recommendationId} missing.`);
      }
      return { recommendation, result };
    },
    performance() {
      return evaluatePerformance(
        listSettledCases(store),
        store.listRecommendations({ status: "pending" }).length,
      );
    },
    calibration() {
      return evaluateCalibration(listSettledCases(store));
    },
    metrics() {
      return evaluateLearningMetrics(listSettledCases(store));
    },
    dataset() {
      return exportLearningDataset(
        store.listRecommendations(),
        store.listResults(),
      );
    },
  };
}

let platform: IntelligenceLearningServices | null = null;

export function getIntelligenceLearningSystem(): IntelligenceLearningServices {
  if (!platform) {
    platform = createIntelligenceLearningSystem();
  }
  return platform;
}

/** Test isolation only. Does not exist as a product API. */
export function resetIntelligenceLearningSystem(): IntelligenceLearningServices {
  platform = createIntelligenceLearningSystem();
  return platform;
}
