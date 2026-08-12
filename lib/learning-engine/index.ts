/**
 * APEX Learning Engine
 *
 * Closed-loop learning after each match: register → evaluate → accumulate knowledge.
 * Mock-first. No HTTP. No Probability Engine changes. No UI/Supabase/auth.
 *
 * See docs/LEARNING_ENGINE.md
 */

export type * from "@/lib/learning-engine/types";
export type * from "@/lib/learning-engine/contracts";

export {
  createLearningEngine,
  createLearningEngineWithMocks,
  seedLearningEngine,
  type LearningEngineBundle,
} from "@/lib/learning-engine/platform";

export { buildLearningCase } from "@/lib/learning-engine/registry/build-case";
export {
  createLearningCaseRegistrar,
  DefaultLearningCaseRegistrar,
} from "@/lib/learning-engine/registry/registrar";
export {
  createLearningEvaluator,
  DefaultLearningEvaluator,
} from "@/lib/learning-engine/evaluation/evaluator";
export {
  createKnowledgeAccumulator,
  DefaultKnowledgeAccumulator,
} from "@/lib/learning-engine/knowledge/accumulator";
export { DefaultLearningEngine } from "@/lib/learning-engine/engine/learning-engine";

export {
  InMemoryLearningCaseRepository,
  InMemoryEvaluationReportRepository,
  InMemoryKnowledgeStore,
} from "@/lib/learning-engine/adapters/memory";
export { createMockLearningFixtures } from "@/lib/learning-engine/adapters/mock-fixtures";
