import type {
  IntelligenceLearningStore,
  RecommendationListFilter,
} from "@/lib/intelligence-learning/contracts";
import type {
  RecommendationId,
  RecommendationRecord,
  ResultRecord,
} from "@/lib/intelligence-learning/types";

export class InMemoryIntelligenceLearningStore
  implements IntelligenceLearningStore
{
  private readonly recommendations = new Map<
    RecommendationId,
    RecommendationRecord
  >();
  private readonly results = new Map<RecommendationId, ResultRecord>();

  saveRecommendation(record: RecommendationRecord): RecommendationRecord {
    this.recommendations.set(record.id, record);
    return record;
  }

  getRecommendation(id: RecommendationId): RecommendationRecord | null {
    return this.recommendations.get(id) ?? null;
  }

  findPendingByKey(pendingKey: string): RecommendationRecord | null {
    for (const row of this.recommendations.values()) {
      if (row.pendingKey === pendingKey && row.status === "pending") {
        return row;
      }
    }
    return null;
  }

  listRecommendations(
    filter: RecommendationListFilter = {},
  ): RecommendationRecord[] {
    let rows = [...this.recommendations.values()];
    if (filter.source) {
      rows = rows.filter((row) => row.source === filter.source);
    }
    if (filter.fixtureId) {
      rows = rows.filter((row) => row.fixtureId === filter.fixtureId);
    }
    if (filter.status) {
      rows = rows.filter((row) => row.status === filter.status);
    }
    if (filter.competition) {
      rows = rows.filter((row) => row.competition === filter.competition);
    }
    return rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  saveResult(result: ResultRecord): ResultRecord {
    this.results.set(result.recommendationId, result);
    return result;
  }

  getResult(recommendationId: RecommendationId): ResultRecord | null {
    return this.results.get(recommendationId) ?? null;
  }

  listResults(): ResultRecord[] {
    return [...this.results.values()].sort((a, b) =>
      a.settlementDate.localeCompare(b.settlementDate),
    );
  }

  clear(): void {
    this.recommendations.clear();
    this.results.clear();
  }
}
