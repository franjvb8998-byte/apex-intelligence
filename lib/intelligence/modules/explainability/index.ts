import type { ExplainabilityModule } from "@/lib/intelligence/contracts";
import type {
  FeatureVector,
  ModelInferenceResult,
  PredictionExplanation,
  SystemPrediction,
} from "@/lib/intelligence/types";

/**
 * Stub — human-readable explanations.
 */
export class ExplainabilityService implements ExplainabilityModule {
  explain(_input: {
    prediction: SystemPrediction;
    inference: ModelInferenceResult;
    features: FeatureVector;
  }): PredictionExplanation {
    throw new Error("ExplainabilityService.explain is not implemented");
  }

  summarize(_explanation: PredictionExplanation): string {
    throw new Error("ExplainabilityService.summarize is not implemented");
  }
}

export function createExplainabilityModule(): ExplainabilityModule {
  return new ExplainabilityService();
}
