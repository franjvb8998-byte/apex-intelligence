import type {
  RecommendationDraft,
  RecommendationId,
  RecommendationRecord,
  RecommendationSource,
  ResultRecord,
  SettledLearningCase,
  SettlementInput,
} from "@/lib/intelligence-learning/types";

export type RecommendationListFilter = {
  source?: RecommendationSource;
  fixtureId?: string;
  status?: RecommendationRecord["status"];
  competition?: string;
};

/**
 * Persistence port. In-memory today; swap for Supabase/warehouse later
 * without changing Performance / Calibration / Metrics engines.
 */
export type IntelligenceLearningStore = {
  saveRecommendation(record: RecommendationRecord): RecommendationRecord;
  getRecommendation(id: RecommendationId): RecommendationRecord | null;
  findPendingByKey(pendingKey: string): RecommendationRecord | null;
  listRecommendations(
    filter?: RecommendationListFilter,
  ): RecommendationRecord[];
  saveResult(result: ResultRecord): ResultRecord;
  getResult(recommendationId: RecommendationId): ResultRecord | null;
  listResults(): ResultRecord[];
  clear(): void;
};

export type RecommendationRegistry = {
  register(draft: RecommendationDraft): RecommendationRecord;
  getById(id: RecommendationId): RecommendationRecord | null;
  list(filter?: RecommendationListFilter): RecommendationRecord[];
};

export type ResultRegistry = {
  settle(input: SettlementInput): ResultRecord;
  getByRecommendationId(id: RecommendationId): ResultRecord | null;
  list(): ResultRecord[];
};

export type IntelligenceLearningSystem = {
  recommendations: RecommendationRegistry;
  results: ResultRegistry;
  store: IntelligenceLearningStore;
  listSettled(): SettledLearningCase[];
};
