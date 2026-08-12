import type {
  ConfidenceScore,
  FeatureVector,
  MatchContext,
  ModelInferenceResult,
  PredictionPipelineInput,
  PredictionPipelineResult,
  UUID,
} from "@/lib/intelligence/types";

/**
 * Prediction engine — orchestrates feature build → inference → confidence → persist.
 * Implementations must compose core modules; no algorithm bodies yet.
 */
export interface FeatureBuilder {
  build(context: MatchContext): Promise<FeatureVector>;
}

export interface InferenceModel {
  readonly modelVersion: string;
  infer(features: FeatureVector): Promise<ModelInferenceResult>;
}

export interface ConfidenceCalibrator {
  calibrate(
    inference: ModelInferenceResult,
    features: FeatureVector,
  ): Promise<ConfidenceScore>;
}

export interface PredictionEngine {
  run(input: PredictionPipelineInput): Promise<PredictionPipelineResult>;
  runBatch(matchIds: UUID[]): Promise<PredictionPipelineResult[]>;
}
