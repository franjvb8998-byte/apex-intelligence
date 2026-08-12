import {
  InMemoryEvaluationReportRepository,
  InMemoryKnowledgeStore,
  InMemoryLearningCaseRepository,
} from "@/lib/learning-engine/adapters/memory";
import { createMockLearningFixtures } from "@/lib/learning-engine/adapters/mock-fixtures";
import type { LearningEngine } from "@/lib/learning-engine/contracts";
import { DefaultLearningEngine } from "@/lib/learning-engine/engine/learning-engine";
import { createLearningEvaluator } from "@/lib/learning-engine/evaluation/evaluator";
import { createKnowledgeAccumulator } from "@/lib/learning-engine/knowledge/accumulator";
import { createLearningCaseRegistrar } from "@/lib/learning-engine/registry/registrar";

export type LearningEngineBundle = {
  engine: LearningEngine;
  cases: InMemoryLearningCaseRepository;
  reports: InMemoryEvaluationReportRepository;
  knowledge: InMemoryKnowledgeStore;
};

/**
 * Composition root — mock-backed Learning Engine + Knowledge Accumulator.
 */
export function createLearningEngine(): LearningEngineBundle {
  const cases = new InMemoryLearningCaseRepository();
  const reports = new InMemoryEvaluationReportRepository();
  const knowledge = new InMemoryKnowledgeStore();

  const registrar = createLearningCaseRegistrar(cases);
  const evaluator = createLearningEvaluator(cases);
  const accumulator = createKnowledgeAccumulator(knowledge, reports);

  const engine = new DefaultLearningEngine(
    registrar,
    evaluator,
    accumulator,
    (modelVersion) => cases.listByModel(modelVersion),
  );

  return { engine, cases, reports, knowledge };
}

/** Seeds demo closed matches through the full learn loop. */
export async function seedLearningEngine(
  bundle: LearningEngineBundle,
): Promise<LearningEngineBundle> {
  for (const fixture of createMockLearningFixtures()) {
    await bundle.engine.recordAndLearn(fixture);
  }
  return bundle;
}

export async function createLearningEngineWithMocks(): Promise<LearningEngineBundle> {
  return seedLearningEngine(createLearningEngine());
}
