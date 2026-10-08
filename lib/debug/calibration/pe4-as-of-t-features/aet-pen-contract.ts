/**
 * PE-4I.15 — AET/PEN contract.
 * Distinguishes FT vs regulation-known vs ambiguous; declares which families may consume.
 */

import { getFeatureFamilySpec } from "@/lib/debug/calibration/pe4-as-of-t-features/feature-families";
import type { Pe4I15FeatureFamilyId } from "@/lib/debug/calibration/pe4-as-of-t-features/feature-families";

export type Pe4I15RegulationClass =
  | "FT_REGULATION"
  | "REGULATION_KNOWN"
  | "AET_PEN_AMBIGUOUS"
  | "UNKNOWN_STATUS";

export type Pe4I15AetPenContract = {
  ftUsableForResultsAndPerformance: true;
  regulationKnownUsableWhenProven: true;
  aetPenProviderStatsRegulationUnproven: true;
  ambiguousExcludedFromResultsAndPerformance: true;
  ambiguousMayAppearInScheduleRestWithFlag: true;
  neverInventRegulationOnlySplit: true;
};

export const PE4I15_AET_PEN_CONTRACT: Pe4I15AetPenContract = {
  ftUsableForResultsAndPerformance: true,
  regulationKnownUsableWhenProven: true,
  aetPenProviderStatsRegulationUnproven: true,
  ambiguousExcludedFromResultsAndPerformance: true,
  ambiguousMayAppearInScheduleRestWithFlag: true,
  neverInventRegulationOnlySplit: true,
};

export function classifyRegulationStatus(status: string): Pe4I15RegulationClass {
  const u = (status ?? "").trim().toUpperCase();
  if (u === "FT") return "FT_REGULATION";
  if (u === "AET" || u === "PEN") return "AET_PEN_AMBIGUOUS";
  if (u === "") return "UNKNOWN_STATUS";
  // Other completed codes remain unknown unless a future protocol proves regulation.
  return "UNKNOWN_STATUS";
}

export function regulationAmbiguityFromStatus(status: string): boolean {
  return classifyRegulationStatus(status) === "AET_PEN_AMBIGUOUS";
}

/**
 * Whether family may consume a match with the given regulation class.
 */
export function familyMayConsumeRegulation(input: {
  familyId: Pe4I15FeatureFamilyId;
  regulationClass: Pe4I15RegulationClass;
}): boolean {
  const policy = getFeatureFamilySpec(input.familyId).aetPenPolicy;
  const { regulationClass } = input;

  if (regulationClass === "FT_REGULATION") return true;
  if (regulationClass === "REGULATION_KNOWN") {
    return (
      policy === "REGULATION_KNOWN_ONLY" ||
      policy === "ALLOW_WITH_AMBIGUITY_FLAG" ||
      policy === "EXCLUDE_AMBIGUOUS"
    );
  }
  if (regulationClass === "AET_PEN_AMBIGUOUS") {
    return policy === "ALLOW_WITH_AMBIGUITY_FLAG";
  }
  // UNKNOWN_STATUS: only allow families that explicitly allow ambiguity flag
  // (schedule/competition context), not results/performance.
  return policy === "ALLOW_WITH_AMBIGUITY_FLAG";
}
