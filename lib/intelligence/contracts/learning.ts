import type {
  LearningSignal,
  ModelEvaluationSnapshot,
  SystemPrediction,
  UUID,
} from "@/lib/intelligence/types";

/**
 * Learning module — post-match evaluation, calibration feedback, user vs model.
 * Algorithms intentionally unimplemented.
 */
export interface LearningModule {
  /** Build learning signals once a match is finished. */
  buildSignals(input: {
    matchId: UUID;
    actualOutcome: "home" | "draw" | "away";
    systemPrediction: SystemPrediction;
    userPredictedOutcome?: "home" | "draw" | "away";
    userId?: UUID;
  }): LearningSignal[];

  evaluateModel(
    signals: LearningSignal[],
    modelVersion: string,
  ): ModelEvaluationSnapshot;

  /** Optional hook for online / batch recalibration jobs. */
  recordFeedback(signals: LearningSignal[]): Promise<void>;
}
