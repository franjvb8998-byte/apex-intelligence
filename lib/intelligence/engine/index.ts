import type {
  ConfidenceCalibrator,
  ExplainabilityModule,
  FeatureBuilder,
  InferenceModel,
  LearningModule,
  LiveModule,
  MarketsModule,
  MatchContextRepository,
  PredictionEngine,
  PredictionRepository,
  ProbabilityModule,
  SimulationModule,
} from "@/lib/intelligence/contracts";
import { PredictionPipeline } from "@/lib/intelligence/engine/pipeline";
import { createExplainabilityModule } from "@/lib/intelligence/modules/explainability";
import { createLearningModule } from "@/lib/intelligence/modules/learning";
import { createLiveModule } from "@/lib/intelligence/modules/live";
import { createMarketsModule } from "@/lib/intelligence/modules/markets";
import { createProbabilityModule } from "@/lib/intelligence/modules/probability";
import { createSimulationModule } from "@/lib/intelligence/modules/simulation";

export { PredictionPipeline } from "@/lib/intelligence/engine/pipeline";

export type IntelligenceCore = {
  probability: ProbabilityModule;
  markets: MarketsModule;
  simulation: SimulationModule;
  learning: LearningModule;
  explainability: ExplainabilityModule;
  live: LiveModule;
  engine: PredictionEngine;
};

export type IntelligenceCoreOptions = {
  matchContexts: MatchContextRepository;
  predictions: PredictionRepository;
  features: FeatureBuilder;
  model: InferenceModel;
  calibrator: ConfidenceCalibrator;
  /** Optional overrides for tests or alternate implementations. */
  modules?: Partial<
    Pick<
      IntelligenceCore,
      | "probability"
      | "markets"
      | "simulation"
      | "learning"
      | "explainability"
      | "live"
    >
  >;
};

/**
 * Composition root for the Intelligence Core.
 * Callers (API routes / jobs) inject Supabase-backed repositories and model adapters.
 */
export function createIntelligenceCore(
  options: IntelligenceCoreOptions,
): IntelligenceCore {
  const probability =
    options.modules?.probability ?? createProbabilityModule();
  const markets = options.modules?.markets ?? createMarketsModule();
  const simulation =
    options.modules?.simulation ?? createSimulationModule();
  const learning = options.modules?.learning ?? createLearningModule();
  const explainability =
    options.modules?.explainability ?? createExplainabilityModule();
  const live = options.modules?.live ?? createLiveModule();

  const engine = new PredictionPipeline({
    matchContexts: options.matchContexts,
    predictions: options.predictions,
    features: options.features,
    model: options.model,
    calibrator: options.calibrator,
    probability,
    markets,
    explainability,
  });

  return {
    probability,
    markets,
    simulation,
    learning,
    explainability,
    live,
    engine,
  };
}
