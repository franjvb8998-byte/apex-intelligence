import type {
  ExplainabilityModule,
  FeatureBuilder,
  InferenceModel,
  ConfidenceCalibrator,
  MarketsModule,
  MatchContextRepository,
  PredictionEngine,
  PredictionRepository,
  ProbabilityModule,
} from "@/lib/intelligence/contracts";
import type {
  PredictionPipelineInput,
  PredictionPipelineResult,
  UUID,
} from "@/lib/intelligence/types";

export type PredictionPipelineDeps = {
  matchContexts: MatchContextRepository;
  predictions: PredictionRepository;
  features: FeatureBuilder;
  model: InferenceModel;
  calibrator: ConfidenceCalibrator;
  probability: ProbabilityModule;
  markets: MarketsModule;
  explainability: ExplainabilityModule;
};

/**
 * Orchestrates the pre-match prediction flow.
 * Steps are documented; algorithm bodies remain unimplemented.
 *
 * Flow:
 * 1. Load MatchContext (Supabase via repository)
 * 2. Build FeatureVector
 * 3. Run InferenceModel
 * 4. Normalize probabilities
 * 5. Calibrate confidence
 * 6. Optionally compare markets / explain
 * 7. Optionally persist SystemPrediction
 */
export class PredictionPipeline implements PredictionEngine {
  constructor(private readonly deps: PredictionPipelineDeps) {}

  async run(_input: PredictionPipelineInput): Promise<PredictionPipelineResult> {
    throw new Error(
      "PredictionPipeline.run is not implemented — wire modules before use",
    );
  }

  async runBatch(_matchIds: UUID[]): Promise<PredictionPipelineResult[]> {
    throw new Error(
      "PredictionPipeline.runBatch is not implemented — wire modules before use",
    );
  }
}
