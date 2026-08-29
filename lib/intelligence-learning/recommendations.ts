import {
  recommendationIdFromKey,
  recommendationPendingKey,
  replayRecommendationId,
} from "@/lib/intelligence-learning/ids";
import type { IntelligenceLearningStore } from "@/lib/intelligence-learning/contracts";
import type {
  RecommendationDraft,
  RecommendationRecord,
} from "@/lib/intelligence-learning/types";

export function materializeRecommendation(
  draft: RecommendationDraft,
  store: IntelligenceLearningStore,
): RecommendationRecord {
  const pendingKey = recommendationPendingKey(draft);
  const pending = store.findPendingByKey(pendingKey);
  if (pending) {
    return {
      ...draft,
      id: pending.id,
      pendingKey,
      status: "pending",
    };
  }

  const settledSameKey = store
    .listRecommendations()
    .some((row) => row.pendingKey === pendingKey && row.status === "settled");
  const id = settledSameKey
    ? replayRecommendationId(pendingKey, draft.timestamp)
    : (draft.id ?? recommendationIdFromKey(pendingKey));

  return {
    ...draft,
    id,
    pendingKey,
    status: "pending",
  };
}

export function createRecommendationRegistry(store: IntelligenceLearningStore) {
  return {
    register(draft: RecommendationDraft): RecommendationRecord {
      const record = materializeRecommendation(draft, store);
      return store.saveRecommendation(record);
    },
    getById(id: string) {
      return store.getRecommendation(id);
    },
    list(filter?: Parameters<IntelligenceLearningStore["listRecommendations"]>[0]) {
      return store.listRecommendations(filter);
    },
  };
}
