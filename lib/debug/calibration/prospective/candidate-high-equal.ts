/**
 * Prospective HIGH_EQUAL operator. Exact 5B.16 T1 only.
 */

import {
  applyHighEqualTransfer,
  summarizeCells,
} from "@/lib/debug/calibration/lm-5b16-formula";
import { TRANSFER_HIGH_EQUAL_RELATIVE } from "@/lib/debug/calibration/lm-5b16-shape";
import type { ScoreGridResult } from "@/lib/debug/calibration/hs-5b14-formula";
import type { HighEqualPolicy } from "@/lib/debug/calibration/prospective/candidate-types";

export function applyCandidateHighEqual(
  policy: HighEqualPolicy,
  control: ScoreGridResult,
): ScoreGridResult {
  if (policy === "NONE") return control;
  if (TRANSFER_HIGH_EQUAL_RELATIVE !== 0.1) {
    throw new Error("T1 relative increase must remain +10%");
  }
  const transferred = applyHighEqualTransfer(control);
  return summarizeCells(transferred.cells);
}
