/**
 * Checkpoint labels. N counts fixtures. Labels are not significance claims.
 */

import { PROSPECTIVE_CHECKPOINTS } from "@/lib/debug/calibration/prospective/candidate-types";
import type { EvaluationCheckpointState } from "@/lib/debug/calibration/prospective/evaluation/evaluation-types";

export function evaluationCheckpointState(evaluatedN: number): EvaluationCheckpointState {
  const [n100, n250, n500] = PROSPECTIVE_CHECKPOINTS;
  if (evaluatedN < n100) return "BELOW_FIRST_CHECKPOINT";
  if (evaluatedN < n250) return "CHECKPOINT_100";
  if (evaluatedN < n500) return "CHECKPOINT_250";
  if (evaluatedN === n500) return "CHECKPOINT_500";
  return "ABOVE_500";
}

export function formalReviewAvailable(evaluatedN: number): boolean {
  return evaluatedN >= PROSPECTIVE_CHECKPOINTS[0];
}
