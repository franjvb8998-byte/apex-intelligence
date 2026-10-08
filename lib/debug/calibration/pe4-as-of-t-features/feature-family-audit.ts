/**
 * PE-4I.18 — Feature-family structural matrix.
 * opponent_strength = UNAVAILABLE (no offline as-of-M catalogue).
 */

import {
  PE4I15_FEATURE_FAMILY_SPECS,
  PE4I15_UNSUPPORTED_FEATURES,
  type Pe4I15FeatureFamilyId,
} from "@/lib/debug/calibration/pe4-as-of-t-features/feature-families";
import type { Pe4I18StructuralStatus } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";
import { PE4I16_OPPONENT_STRENGTH_UNAVAILABLE_REASON } from "@/lib/debug/calibration/pe4-as-of-t-features/opponent-strength-join";

export type Pe4I18FeatureFamilyRow = {
  familyId: Pe4I15FeatureFamilyId | string;
  structuralStatus: Pe4I18StructuralStatus;
  availabilityContract: string;
  notes: string;
};

export type Pe4I18FeatureFamilyMatrix = {
  families: Pe4I18FeatureFamilyRow[];
  unsupported: Array<{ id: string; reason: string; structuralStatus: "UNAVAILABLE" }>;
  opponentStrengthStatus: "UNAVAILABLE";
  opponentStrengthReason: typeof PE4I16_OPPONENT_STRENGTH_UNAVAILABLE_REASON;
};

export function buildFeatureFamilyMatrix(input?: {
  scheduleRestAvailableShare?: number;
  recentResultsAvailableShare?: number;
  xgPresentShare?: number;
}): Pe4I18FeatureFamilyMatrix {
  const scheduleShare = input?.scheduleRestAvailableShare ?? 0;
  const resultsShare = input?.recentResultsAvailableShare ?? 0;
  const xgShare = input?.xgPresentShare ?? 0;

  const statusFor = (
    id: Pe4I15FeatureFamilyId,
  ): { status: Pe4I18StructuralStatus; notes: string } => {
    switch (id) {
      case "opponent_strength_join":
        return {
          status: "UNAVAILABLE",
          notes: PE4I16_OPPONENT_STRENGTH_UNAVAILABLE_REASON,
        };
      case "schedule_rest":
        if (scheduleShare <= 0) {
          return {
            status: "UNAVAILABLE",
            notes: "No schedule/rest AVAILABLE rows observed in sample/stream",
          };
        }
        if (scheduleShare < 0.5) {
          return {
            status: "PARTIAL",
            notes: `scheduleRest AVAILABLE share≈${scheduleShare.toFixed(3)}`,
          };
        }
        return {
          status: "AVAILABLE",
          notes: `scheduleRest AVAILABLE share≈${scheduleShare.toFixed(3)}`,
        };
      case "recent_results":
      case "recent_performance":
      case "home_away_splits":
        if (resultsShare < 0.1) {
          return {
            status: "SPARSE",
            notes: `obs>=3 share≈${resultsShare.toFixed(3)}`,
          };
        }
        if (resultsShare < 0.9) {
          return {
            status: "PARTIAL",
            notes: `obs>=3 share≈${resultsShare.toFixed(3)}`,
          };
        }
        return {
          status: "AVAILABLE",
          notes: `obs>=3 share≈${resultsShare.toFixed(3)}`,
        };
      case "competition_context":
        return {
          status: "AVAILABLE",
          notes: "Competition/season stratifiers present on records",
        };
      default:
        return { status: "REQUIRES_LATER_RESEARCH", notes: "Unhandled family" };
    }
  };

  const families: Pe4I18FeatureFamilyRow[] = PE4I15_FEATURE_FAMILY_SPECS.map(
    (spec) => {
      const { status, notes } = statusFor(spec.id);
      // Annotate xG path under recent_performance
      const xgNote =
        spec.id === "recent_performance"
          ? `; optional xG present share≈${xgShare.toFixed(3)} (PARTIAL when missing)`
          : "";
      return {
        familyId: spec.id,
        structuralStatus: status,
        availabilityContract: spec.availability,
        notes: notes + xgNote,
      };
    },
  );

  return {
    families,
    unsupported: PE4I15_UNSUPPORTED_FEATURES.map((u) => ({
      id: u.id,
      reason: u.reason,
      structuralStatus: "UNAVAILABLE" as const,
    })),
    opponentStrengthStatus: "UNAVAILABLE",
    opponentStrengthReason: PE4I16_OPPONENT_STRENGTH_UNAVAILABLE_REASON,
  };
}
