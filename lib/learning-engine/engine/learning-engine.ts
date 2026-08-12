import type {
  KnowledgeAccumulator,
  LearningCaseRegistrar,
  LearningEngine,
  LearningEvaluator,
} from "@/lib/learning-engine/contracts";
import type {
  ActualMatchResult,
  LearningCase,
  PredictionRecord,
} from "@/lib/learning-engine/types/case";
import type { EvaluationReport } from "@/lib/learning-engine/types/evaluation";
import type { KnowledgeDiscovery } from "@/lib/learning-engine/types/knowledge";

export class DefaultLearningEngine implements LearningEngine {
  constructor(
    private readonly registrar: LearningCaseRegistrar,
    private readonly evaluator: LearningEvaluator,
    private readonly knowledge: KnowledgeAccumulator,
    private readonly listCasesFn: (
      modelVersion?: string,
    ) => Promise<LearningCase[]>,
  ) {}

  async recordAndLearn(input: {
    prediction: PredictionRecord;
    actual: ActualMatchResult;
  }): Promise<{
    learningCase: LearningCase;
    report: EvaluationReport;
    discoveries: KnowledgeDiscovery[];
  }> {
    const learningCase = await this.registrar.register(input);
    const report = await this.evaluator.evaluate({
      modelVersion: input.prediction.modelVersion,
    });
    const discoveries = await this.knowledge.ingestEvaluation(report);
    return { learningCase, report, discoveries };
  }

  async evaluate(modelVersion?: string): Promise<EvaluationReport> {
    const report = await this.evaluator.evaluate({ modelVersion });
    await this.knowledge.ingestEvaluation(report);
    return report;
  }

  async listCases(modelVersion?: string): Promise<LearningCase[]> {
    return this.listCasesFn(modelVersion);
  }

  async listKnowledge(): Promise<KnowledgeDiscovery[]> {
    return this.knowledge.listDiscoveries();
  }
}
