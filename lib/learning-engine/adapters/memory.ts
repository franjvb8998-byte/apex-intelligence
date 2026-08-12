import type {
  EvaluationReportRepository,
  KnowledgeStore,
  LearningCaseRepository,
} from "@/lib/learning-engine/contracts";
import type {
  LearningCase,
  LearningId,
} from "@/lib/learning-engine/types/case";
import type { EvaluationReport } from "@/lib/learning-engine/types/evaluation";
import type { KnowledgeDiscovery } from "@/lib/learning-engine/types/knowledge";

export class InMemoryLearningCaseRepository
  implements LearningCaseRepository
{
  private readonly items = new Map<LearningId, LearningCase>();

  async save(learningCase: LearningCase): Promise<LearningCase> {
    this.items.set(learningCase.id, learningCase);
    return learningCase;
  }

  async getById(id: LearningId): Promise<LearningCase | null> {
    return this.items.get(id) ?? null;
  }

  async listByModel(modelVersion?: string): Promise<LearningCase[]> {
    const all = [...this.items.values()];
    if (!modelVersion) return all;
    return all.filter((c) => c.prediction.modelVersion === modelVersion);
  }

  async listByMatch(matchId: LearningId): Promise<LearningCase[]> {
    return [...this.items.values()].filter(
      (c) => c.prediction.matchId === matchId,
    );
  }
}

export class InMemoryEvaluationReportRepository
  implements EvaluationReportRepository
{
  private readonly items: EvaluationReport[] = [];

  async save(report: EvaluationReport): Promise<EvaluationReport> {
    this.items.unshift(report);
    return report;
  }

  async latest(modelVersion?: string): Promise<EvaluationReport | null> {
    if (!modelVersion) return this.items[0] ?? null;
    return (
      this.items.find((report) => report.modelVersion === modelVersion) ?? null
    );
  }

  async list(limit = 20): Promise<EvaluationReport[]> {
    return this.items.slice(0, limit);
  }
}

export class InMemoryKnowledgeStore implements KnowledgeStore {
  private readonly items = new Map<LearningId, KnowledgeDiscovery>();

  async upsert(discovery: KnowledgeDiscovery): Promise<KnowledgeDiscovery> {
    const existing = this.items.get(discovery.id);
    const next = existing
      ? {
          ...discovery,
          createdAt: existing.createdAt,
          updatedAt: discovery.updatedAt,
          evidenceCaseIds: Array.from(
            new Set([
              ...existing.evidenceCaseIds,
              ...discovery.evidenceCaseIds,
            ]),
          ),
          modelVersions: Array.from(
            new Set([
              ...existing.modelVersions,
              ...discovery.modelVersions,
            ]),
          ),
        }
      : discovery;
    this.items.set(next.id, next);
    return next;
  }

  async getById(id: LearningId): Promise<KnowledgeDiscovery | null> {
    return this.items.get(id) ?? null;
  }

  async list(filter?: {
    kind?: KnowledgeDiscovery["kind"];
    tag?: string;
    minConfidence?: number;
  }): Promise<KnowledgeDiscovery[]> {
    let values = [...this.items.values()];
    if (filter?.kind) {
      values = values.filter((item) => item.kind === filter.kind);
    }
    if (filter?.tag) {
      values = values.filter((item) => item.tags.includes(filter.tag!));
    }
    if (filter?.minConfidence != null) {
      values = values.filter(
        (item) => item.confidence >= filter.minConfidence!,
      );
    }
    return values.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
