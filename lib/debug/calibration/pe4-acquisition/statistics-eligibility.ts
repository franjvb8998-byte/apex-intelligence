/**
 * PE-4I.4 — Statistics eligibility for Stage-2 queue (deterministic).
 */

import { isPrimaryStatisticsCompetition } from "@/lib/debug/calibration/pe4-acquisition/competition-policy";
import type { Pe4I2CompetitionClass } from "@/lib/debug/calibration/pe4-acquisition/competition-registry";
import { PE4I2_HOLDOUT_SEASON } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { isCompletedPrematchEvidenceStatus } from "@/lib/match-center/prematch-strength/completed-status";
import { parseKickoffUtcMillis } from "@/lib/debug/calibration/pe4-acquisition/temporal";

export type Pe4I4StatisticsEligibilityReason =
  | "eligible"
  | "missing_fixture_id"
  | "not_completed"
  | "friendlies_or_preseason_excluded"
  | "community_shield_separate_audit"
  | "unknown_competition_audit_only"
  | "future_kickoff_at_acquisition"
  | "holdout_provider_season_forbidden";

export type Pe4I4StatisticsEligibility = {
  eligibleForPrimaryQueue: boolean;
  reason: Pe4I4StatisticsEligibilityReason;
};

export function evaluateStatisticsEligibility(input: {
  providerFixtureId: string;
  status: string;
  kickoffUtc: string;
  providerCompetitionId: string | null;
  competitionClass: Pe4I2CompetitionClass;
  /** Provider season of the schedule unit that discovered this fixture. */
  discoveredFromProviderSeason: string;
  /** Acquisition clock — future fixtures relative to this are ineligible. */
  acquisitionNowUtc: string;
}): Pe4I4StatisticsEligibility {
  const id = input.providerFixtureId?.trim();
  if (!id) {
    return { eligibleForPrimaryQueue: false, reason: "missing_fixture_id" };
  }
  if (input.discoveredFromProviderSeason === PE4I2_HOLDOUT_SEASON) {
    return {
      eligibleForPrimaryQueue: false,
      reason: "holdout_provider_season_forbidden",
    };
  }
  if (!isCompletedPrematchEvidenceStatus(input.status)) {
    return { eligibleForPrimaryQueue: false, reason: "not_completed" };
  }
  const kickoffMs = parseKickoffUtcMillis(input.kickoffUtc);
  const nowMs = parseKickoffUtcMillis(input.acquisitionNowUtc);
  if (kickoffMs == null || nowMs == null || kickoffMs > nowMs) {
    return {
      eligibleForPrimaryQueue: false,
      reason: "future_kickoff_at_acquisition",
    };
  }

  const inclusion = isPrimaryStatisticsCompetition({
    providerCompetitionId: input.providerCompetitionId,
    competitionClass: input.competitionClass,
  });
  if (!inclusion) {
    // Map non-primary to specific reasons
    const idTrim = input.providerCompetitionId?.trim();
    if (idTrim === "667" || idTrim === "1022") {
      return {
        eligibleForPrimaryQueue: false,
        reason: "friendlies_or_preseason_excluded",
      };
    }
    if (idTrim === "528") {
      return {
        eligibleForPrimaryQueue: false,
        reason: "community_shield_separate_audit",
      };
    }
    if (input.competitionClass === "unknown_competition") {
      return {
        eligibleForPrimaryQueue: false,
        reason: "unknown_competition_audit_only",
      };
    }
    if (input.competitionClass === "other_known_competition") {
      return {
        eligibleForPrimaryQueue: false,
        reason: "friendlies_or_preseason_excluded",
      };
    }
    return {
      eligibleForPrimaryQueue: false,
      reason: "unknown_competition_audit_only",
    };
  }

  // Prefer FT for regulation usability; AET/PEN still completed — include for now
  // (regulation goals policy applied later in feature build).
  return { eligibleForPrimaryQueue: true, reason: "eligible" };
}
