/**
 * APEX Intelligence Core — public entrypoint.
 *
 * Structure:
 * - types/       shared domain + engine types
 * - contracts/   TypeScript interfaces (ports)
 * - modules/     probability, markets, simulation, learning, explainability, live
 * - reasoning/   Reasoning Layer (stubs — see docs/REASONING_LAYER.md)
 * - engine/      prediction pipeline composition root
 * - adapters/    Supabase, API façade, AI model stubs
 *
 * See docs/AI_ENGINE.md for architecture and data flow.
 */

export type * from "@/lib/intelligence/types";
export type * from "@/lib/intelligence/contracts";

export {
  createIntelligenceCore,
  PredictionPipeline,
  type IntelligenceCore,
  type IntelligenceCoreOptions,
} from "@/lib/intelligence/engine";

export {
  createProbabilityModule,
  ProbabilityService,
  createEloPoissonHybridEngine,
  EloPoissonHybridEngine,
  StaticEloRatingProvider,
  DEFAULT_HYBRID_CONFIG,
  blendOneXTwo,
  eloWinExpectancy,
  eloToExpectedGoals,
  eloToOneXTwo,
  poissonPmf,
  normalizeOutcomeProbability,
  type ProbabilityEngine,
  type HybridProbabilityResult,
  type HybridProbabilityConfig,
  type TeamEloInput,
  type EloRatingProvider,
} from "@/lib/intelligence/modules/probability";

export {
  createMarketsModule,
  MarketsService,
} from "@/lib/intelligence/modules/markets";
export {
  createSimulationModule,
  SimulationService,
} from "@/lib/intelligence/modules/simulation";
export {
  createLearningModule,
  LearningService,
} from "@/lib/intelligence/modules/learning";
export {
  createExplainabilityModule,
  ExplainabilityService,
} from "@/lib/intelligence/modules/explainability";
export { createLiveModule, LiveService } from "@/lib/intelligence/modules/live";

export {
  createSupabaseIntelligenceAdapters,
  SupabaseMatchContextRepository,
  SupabasePredictionRepository,
  SupabaseUserPredictionRepository,
  SupabaseLearningRepository,
} from "@/lib/intelligence/adapters/supabase";

export {
  createIntelligenceApi,
  type IntelligenceApi,
} from "@/lib/intelligence/adapters/api";

export {
  createStubAiAdapters,
  StubFeatureBuilder,
  StubInferenceModel,
  StubConfidenceCalibrator,
} from "@/lib/intelligence/adapters/ai";

/** Reasoning Layer — prefer `@/lib/intelligence/reasoning` for full surface (incl. ConfidenceScore). */
export {
  createReasoningLayer,
  type ReasoningLayer,
  type ReasoningInput,
  type ReasoningOutput,
  type Recommendation,
  type RiskAnalysis,
  type Explanation,
  type ValueOpportunity,
  type PredictionReport,
} from "@/lib/intelligence/reasoning";
