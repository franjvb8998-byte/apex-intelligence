/**
 * PE-4G.4 — BASELINE_0: constant empirical 1X2 from training outcomes.
 */

import {
  empiricalOneXTwo,
  type OneXTwoProb,
} from "@/lib/debug/calibration/pe4-expectation/metrics";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type Baseline0Model = {
  family: "BASELINE_0";
  prior: OneXTwoProb;
  trainingRowCount: number;
};

export function fitBaseline0(
  trainRows: readonly Pe4ExpectationDatasetRow[],
): Baseline0Model {
  const prior = empiricalOneXTwo(trainRows.map((r) => r.actualOutcome));
  return {
    family: "BASELINE_0",
    prior,
    trainingRowCount: trainRows.length,
  };
}

export function predictBaseline0(
  model: Baseline0Model,
  rows: readonly Pe4ExpectationDatasetRow[],
): OneXTwoProb[] {
  return rows.map(() => ({ ...model.prior }));
}
