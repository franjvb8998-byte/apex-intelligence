import type { LearningCaseRegistrar } from "@/lib/learning-engine/contracts";
import type { LearningCaseRepository } from "@/lib/learning-engine/contracts";
import { buildLearningCase } from "@/lib/learning-engine/registry/build-case";
import type {
  ActualMatchResult,
  LearningCase,
  PredictionRecord,
} from "@/lib/learning-engine/types/case";

export class DefaultLearningCaseRegistrar implements LearningCaseRegistrar {
  constructor(private readonly cases: LearningCaseRepository) {}

  async register(input: {
    prediction: PredictionRecord;
    actual: ActualMatchResult;
  }): Promise<LearningCase> {
    const learningCase = buildLearningCase(input);
    return this.cases.save(learningCase);
  }
}

export function createLearningCaseRegistrar(
  cases: LearningCaseRepository,
): LearningCaseRegistrar {
  return new DefaultLearningCaseRegistrar(cases);
}
