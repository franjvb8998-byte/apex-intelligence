/**
 * PE-4I.15 — Opponent-strength join rules (declarative; no fitting).
 * Strength as-of kickoff(M), never kickoff(T).
 */

export type Pe4I15OpponentStrengthContract = {
  familyId: "opponent_strength_join";
  cutoffRule: "kickoff_utc_of_historical_match_M";
  forbidCutoffAtTargetT: true;
  semantics: "common_baseline_reconstruction_pe4c_pe4g1_style";
  comparableToVenueSpecificC0Elo: false;
  missingJoinBehavior: "FAIL_CLOSED_UNAVAILABLE";
  minObservations: 3;
  joinKeys: readonly ["opponent_team_id", "cutoff_kickoff_M"];
  leakageGuards: readonly [
    "no_post_M_results_in_strength",
    "no_target_T_outcome",
    "calendar_2025_outcomes_excluded_from_dev_pools",
  ];
  noFittedMappingToExpectation: true;
};

export const PE4I15_OPPONENT_STRENGTH_CONTRACT: Pe4I15OpponentStrengthContract =
  {
    familyId: "opponent_strength_join",
    cutoffRule: "kickoff_utc_of_historical_match_M",
    forbidCutoffAtTargetT: true,
    semantics: "common_baseline_reconstruction_pe4c_pe4g1_style",
    comparableToVenueSpecificC0Elo: false,
    missingJoinBehavior: "FAIL_CLOSED_UNAVAILABLE",
    minObservations: 3,
    joinKeys: ["opponent_team_id", "cutoff_kickoff_M"],
    leakageGuards: [
      "no_post_M_results_in_strength",
      "no_target_T_outcome",
      "calendar_2025_outcomes_excluded_from_dev_pools",
    ],
    noFittedMappingToExpectation: true,
  };

/**
 * Pure guard: strength cutoff must equal historical match kickoff, not target T.
 */
export function assertOpponentStrengthCutoffIsKickoffM(input: {
  strengthCutoffUtc: string;
  historicalKickoffUtc: string;
  targetKickoffUtc: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.strengthCutoffUtc !== input.historicalKickoffUtc) {
    return { ok: false, reason: "cutoff_must_equal_kickoff_M" };
  }
  if (input.strengthCutoffUtc === input.targetKickoffUtc) {
    return { ok: false, reason: "cutoff_must_not_equal_kickoff_T" };
  }
  if (!(input.historicalKickoffUtc < input.targetKickoffUtc)) {
    return { ok: false, reason: "historical_must_be_before_target" };
  }
  return { ok: true };
}
