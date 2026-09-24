/**
 * PE-4G.5 — Low-information / base_prior policy + quality metadata.
 */

import {
  empiricalOneXTwo,
  type OneXTwoProb,
} from "@/lib/debug/calibration/pe4-expectation/metrics";
import {
  PE4_EXPECTATION_REFINEMENT_LOW_INFO_POLICY,
} from "@/lib/debug/calibration/pe4-expectation/refinement-protocol";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type StrengthEvidenceQuality =
  | "catalogue_catalogue"
  | "mixed_source"
  | "both_base_prior"
  | "unavailable";

export type TrainingCoverageClass =
  | "in_distribution_catalogue"
  | "low_information_fallback"
  | "mixed_or_other";

export type ExpectationQualityMetadata = {
  expectationStatus: "AVAILABLE" | "FALLBACK_PRIOR";
  strengthEvidenceQuality: StrengthEvidenceQuality;
  expectationModelVersion: string;
  lowInformationFallbackUsed: boolean;
  trainingCoverageClass: TrainingCoverageClass;
  lowInfoPolicy: typeof PE4_EXPECTATION_REFINEMENT_LOW_INFO_POLICY;
};

export function qualityFromRow(
  row: Pick<
    Pe4ExpectationDatasetRow,
    "qualityKind" | "lowInformationBothBasePrior"
  >,
): StrengthEvidenceQuality {
  if (row.qualityKind === "catalogue_catalogue") return "catalogue_catalogue";
  if (row.qualityKind === "base_prior_base_prior") return "both_base_prior";
  if (
    row.qualityKind === "catalogue_base_prior" ||
    row.qualityKind === "base_prior_catalogue"
  ) {
    return "mixed_source";
  }
  return "unavailable";
}

/**
 * Build the global train prior used for both_base_prior fallback.
 * Fitted from eligible catalogue/catalogue training rows only.
 */
export function fitLowInfoFallbackPrior(
  eligibleTrainRows: readonly Pe4ExpectationDatasetRow[],
): OneXTwoProb {
  return empiricalOneXTwo(eligibleTrainRows.map((r) => r.actualOutcome));
}

/**
 * Resolve home-oriented 1X2 with explicit low-info policy.
 * Does NOT treat both_base_prior as known D=0.
 */
export function resolveHomeOrientedExpectation(input: {
  qualityKind: Pe4ExpectationDatasetRow["qualityKind"];
  lowInformationBothBasePrior: boolean;
  modelPrediction: OneXTwoProb;
  lowInfoPrior: OneXTwoProb;
  modelVersion: string;
}): {
  expectedOneXTwo: OneXTwoProb;
  metadata: ExpectationQualityMetadata;
} {
  const quality = qualityFromRow({
    qualityKind: input.qualityKind,
    lowInformationBothBasePrior: input.lowInformationBothBasePrior,
  });

  if (quality === "both_base_prior") {
    return {
      expectedOneXTwo: { ...input.lowInfoPrior },
      metadata: {
        expectationStatus: "FALLBACK_PRIOR",
        strengthEvidenceQuality: "both_base_prior",
        expectationModelVersion: input.modelVersion,
        lowInformationFallbackUsed: true,
        trainingCoverageClass: "low_information_fallback",
        lowInfoPolicy: PE4_EXPECTATION_REFINEMENT_LOW_INFO_POLICY,
      },
    };
  }

  return {
    expectedOneXTwo: { ...input.modelPrediction },
    metadata: {
      expectationStatus: "AVAILABLE",
      strengthEvidenceQuality: quality,
      expectationModelVersion: input.modelVersion,
      lowInformationFallbackUsed: false,
      trainingCoverageClass:
        quality === "catalogue_catalogue"
          ? "in_distribution_catalogue"
          : "mixed_or_other",
      lowInfoPolicy: PE4_EXPECTATION_REFINEMENT_LOW_INFO_POLICY,
    },
  };
}
