import type {
  ConfidenceCalibrator,
  FeatureBuilder,
  InferenceModel,
} from "@/lib/intelligence/contracts";
import type {
  ConfidenceScore,
  FeatureVector,
  MatchContext,
  ModelInferenceResult,
} from "@/lib/intelligence/types";

/**
 * AI / model adapter stubs.
 * Swap these for real feature pipelines and model runtimes later
 * without changing module contracts or API façades.
 */

export class StubFeatureBuilder implements FeatureBuilder {
  async build(_context: MatchContext): Promise<FeatureVector> {
    throw new Error("StubFeatureBuilder.build is not implemented");
  }
}

export class StubInferenceModel implements InferenceModel {
  readonly modelVersion = "stub-0.0.0";

  async infer(_features: FeatureVector): Promise<ModelInferenceResult> {
    throw new Error("StubInferenceModel.infer is not implemented");
  }
}

export class StubConfidenceCalibrator implements ConfidenceCalibrator {
  async calibrate(
    _inference: ModelInferenceResult,
    _features: FeatureVector,
  ): Promise<ConfidenceScore> {
    throw new Error("StubConfidenceCalibrator.calibrate is not implemented");
  }
}

export function createStubAiAdapters() {
  return {
    features: new StubFeatureBuilder(),
    model: new StubInferenceModel(),
    calibrator: new StubConfidenceCalibrator(),
  };
}
