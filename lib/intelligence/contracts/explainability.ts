import type {
  FeatureVector,
  ModelInferenceResult,
  PredictionExplanation,
  SystemPrediction,
} from "@/lib/intelligence/types";

/**
 * Explainability module — human-readable reasons, factors, and caveats.
 * Algorithms intentionally unimplemented.
 */
export interface ExplainabilityModule {
  explain(input: {
    prediction: SystemPrediction;
    inference: ModelInferenceResult;
    features: FeatureVector;
  }): PredictionExplanation;

  /** Short one-liner for cards / notifications. */
  summarize(explanation: PredictionExplanation): string;
}
