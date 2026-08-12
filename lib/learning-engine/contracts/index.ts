import type {
  ActualMatchResult,
  LearningCase,
  LearningId,
  PredictionRecord,
} from "@/lib/learning-engine/types/case";
import type { EvaluationReport } from "@/lib/learning-engine/types/evaluation";
import type { KnowledgeDiscovery } from "@/lib/learning-engine/types/knowledge";

export interface LearningCaseRepository {
  save(learningCase: LearningCase): Promise<LearningCase>;
  getById(id: LearningId): Promise<LearningCase | null>;
  listByModel(modelVersion?: string): Promise<LearningCase[]>;
  listByMatch(matchId: LearningId): Promise<LearningCase[]>;
}

export interface EvaluationReportRepository {
  save(report: EvaluationReport): Promise<EvaluationReport>;
  latest(modelVersion?: string): Promise<EvaluationReport | null>;
  list(limit?: number): Promise<EvaluationReport[]>;
}

export interface KnowledgeStore {
  upsert(discovery: KnowledgeDiscovery): Promise<KnowledgeDiscovery>;
  getById(id: LearningId): Promise<KnowledgeDiscovery | null>;
  list(filter?: {
    kind?: KnowledgeDiscovery["kind"];
    tag?: string;
    minConfidence?: number;
  }): Promise<KnowledgeDiscovery[]>;
}

/**
 * Registers a closed-loop learning case from prediction + actual result.
 */
export interface LearningCaseRegistrar {
  register(input: {
    prediction: PredictionRecord;
    actual: ActualMatchResult;
  }): Promise<LearningCase>;
}

/**
 * Runs post-registration evaluation over accumulated cases.
 */
export interface LearningEvaluator {
  evaluate(input?: {
    modelVersion?: string;
    caseIds?: LearningId[];
  }): Promise<EvaluationReport>;
}

/**
 * Accumulates reusable statistical discoveries from evaluations.
 */
export interface KnowledgeAccumulator {
  ingestEvaluation(report: EvaluationReport): Promise<KnowledgeDiscovery[]>;
  listDiscoveries(filter?: {
    kind?: KnowledgeDiscovery["kind"];
    tag?: string;
    minConfidence?: number;
  }): Promise<KnowledgeDiscovery[]>;
}

/**
 * Orchestrates register → evaluate → accumulate.
 */
export interface LearningEngine {
  recordAndLearn(input: {
    prediction: PredictionRecord;
    actual: ActualMatchResult;
  }): Promise<{
    learningCase: LearningCase;
    report: EvaluationReport;
    discoveries: KnowledgeDiscovery[];
  }>;
  evaluate(modelVersion?: string): Promise<EvaluationReport>;
  listCases(modelVersion?: string): Promise<LearningCase[]>;
  listKnowledge(): Promise<KnowledgeDiscovery[]>;
}
