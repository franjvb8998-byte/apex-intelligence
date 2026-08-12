import type { LearningModule } from "@/lib/intelligence/contracts";
import type {
  LearningSignal,
  ModelEvaluationSnapshot,
  SystemPrediction,
  UUID,
} from "@/lib/intelligence/types";

/**
 * Stub — evaluation & feedback loop.
 */
export class LearningService implements LearningModule {
  buildSignals(_input: {
    matchId: UUID;
    actualOutcome: "home" | "draw" | "away";
    systemPrediction: SystemPrediction;
    userPredictedOutcome?: "home" | "draw" | "away";
    userId?: UUID;
  }): LearningSignal[] {
    throw new Error("LearningService.buildSignals is not implemented");
  }

  evaluateModel(
    _signals: LearningSignal[],
    _modelVersion: string,
  ): ModelEvaluationSnapshot {
    throw new Error("LearningService.evaluateModel is not implemented");
  }

  async recordFeedback(_signals: LearningSignal[]): Promise<void> {
    throw new Error("LearningService.recordFeedback is not implemented");
  }
}

export function createLearningModule(): LearningModule {
  return new LearningService();
}
