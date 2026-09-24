/**
 * PE-4G.5 — Offline inference adapter (NOT production-wired).
 * Production resolvePe4HistoricalExpectation remains UNAVAILABLE.
 */

import type { ModelC2Artifact } from "@/lib/debug/calibration/pe4-expectation/model-c2";
import { predictModelC2FromD } from "@/lib/debug/calibration/pe4-expectation/model-c2";
import {
  fitLowInfoFallbackPrior,
  resolveHomeOrientedExpectation,
  type ExpectationQualityMetadata,
} from "@/lib/debug/calibration/pe4-expectation/low-information";
import {
  expectedAwayPoints,
  expectedHomePoints,
  expectedTargetPoints,
  orientToTarget,
} from "@/lib/debug/calibration/pe4-expectation/orientation";
import type { OneXTwoProb } from "@/lib/debug/calibration/pe4-expectation/metrics";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";
import type { Pe4HistoricalExpectationInput } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import type { Pe4VenueRole } from "@/lib/prematch-decision/pe4-form-schedule/types";

export const PE4_EXPECTATION_REFINEMENT_MODEL_VERSION =
  "pe4.expectation.refinement.model_c2.v1" as const;

export type Pe4RefinementInferenceResult = {
  expectedHomeProbability: number;
  expectedDrawProbability: number;
  expectedAwayProbability: number;
  expectedTargetWinProbability: number;
  expectedTargetDrawProbability: number;
  expectedTargetLossProbability: number;
  expectedHomePoints: number;
  expectedAwayPoints: number;
  expectedTargetPoints: number;
  modelVersion: string;
  quality: ExpectationQualityMetadata;
};

export type Pe4RefinementFrozenBundle = {
  model: ModelC2Artifact;
  lowInfoPrior: OneXTwoProb;
  modelVersion: string;
  protocolDigest: string;
  parentProtocolDigest: string;
  datasetDigest: string;
};

/**
 * Infer from D + quality + venue role using frozen C2 + low-info policy.
 */
export function inferRefinementExpectation(input: {
  bundle: Pe4RefinementFrozenBundle;
  strengthDifferentialHome: number;
  qualityKind: Pe4ExpectationDatasetRow["qualityKind"];
  lowInformationBothBasePrior: boolean;
  targetVenueRole: Pe4VenueRole;
}): Pe4RefinementInferenceResult {
  const modelPrediction = predictModelC2FromD(
    input.bundle.model,
    input.strengthDifferentialHome,
  );
  const resolved = resolveHomeOrientedExpectation({
    qualityKind: input.qualityKind,
    lowInformationBothBasePrior: input.lowInformationBothBasePrior,
    modelPrediction,
    lowInfoPrior: input.bundle.lowInfoPrior,
    modelVersion: input.bundle.modelVersion,
  });
  const p = resolved.expectedOneXTwo;
  const oriented = orientToTarget(p, input.targetVenueRole);
  return {
    expectedHomeProbability: p.HOME,
    expectedDrawProbability: p.DRAW,
    expectedAwayProbability: p.AWAY,
    expectedTargetWinProbability: oriented.targetWinP,
    expectedTargetDrawProbability: oriented.targetDrawP,
    expectedTargetLossProbability: oriented.targetLossP,
    expectedHomePoints: expectedHomePoints(p),
    expectedAwayPoints: expectedAwayPoints(p),
    expectedTargetPoints: expectedTargetPoints(oriented),
    modelVersion: input.bundle.modelVersion,
    quality: resolved.metadata,
  };
}

/**
 * Offline adapter from Pe4HistoricalExpectationInput shape.
 * Still does NOT replace production UNAVAILABLE resolver.
 */
export function adaptHistoricalExpectationInput(input: {
  bundle: Pe4RefinementFrozenBundle;
  pe4Input: Pe4HistoricalExpectationInput;
  /** Canonical home-oriented D when both strengths available. */
  strengthDifferentialHome: number | null;
  qualityKind: Pe4ExpectationDatasetRow["qualityKind"];
}): Pe4RefinementInferenceResult | { status: "UNAVAILABLE"; reason: string } {
  if (
    !input.pe4Input.pairwiseAvailable ||
    input.pe4Input.targetStrengthCommon == null ||
    input.pe4Input.opponentStrengthCommon == null ||
    input.strengthDifferentialHome == null
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "pairwise_strength_unavailable",
    };
  }

  const bothBase =
    input.pe4Input.targetSource === "base_prior" &&
    input.pe4Input.opponentSource === "base_prior";

  // When target is AWAY, D was still stored as home−away in canonical rows.
  // Orientation happens after home-oriented prediction.
  return inferRefinementExpectation({
    bundle: input.bundle,
    strengthDifferentialHome: input.strengthDifferentialHome,
    qualityKind: input.qualityKind,
    lowInformationBothBasePrior: bothBase,
    targetVenueRole: input.pe4Input.targetVenueRole,
  });
}

export function buildLowInfoPriorFromTrain(
  eligibleTrainRows: readonly Pe4ExpectationDatasetRow[],
): OneXTwoProb {
  return fitLowInfoFallbackPrior(eligibleTrainRows);
}
