/**
 * PE-4G.1 — Historical expectation / residual contracts.
 *
 * CRITICAL: EloPoissonHybridEngine is NOT semantically reusable for
 * common-baseline pairwise indices:
 * - Engine adds homeAdvantageElo (65) on top of homeElo/awayElo
 * - Engine uses asymmetric baseHomeGoals / baseAwayGoals
 * - PE-3 ticket Elo already embeds 1580/1520 role bases
 * - Common-baseline indices are both reconstructed at 1580 and are
 *   explicitly NOT venue-role C0 Elo
 *
 * Therefore numeric expectations and residuals remain UNAVAILABLE
 * until a dedicated, prospectively validated mapping exists.
 */

import type {
  Pe4HistoricalExpectationEvidence,
  Pe4HistoricalResidualEvidence,
  Pe4PairwiseHistoricalStrengthContext,
  Pe4VenueRole,
} from "@/lib/prematch-decision/pe4-form-schedule/types";

export const PE4_HISTORICAL_EXPECTATION_MODEL_VERSION =
  "pe4_historical_expectation_undefined_v0" as const;

export const PE4_HISTORICAL_EXPECTATION_UNAVAILABLE_REASON =
  "expectation_model_not_defined" as const;

/**
 * Audit result: existing PE engine cannot consume common-baseline pairs
 * plus role without inventing / double-applying HFA.
 */
export const PE4_HISTORICAL_EXPECTATION_ENGINE_REUSE_AUDIT = {
  eloPoissonHybridReusable: false as const,
  reason:
    "common_baseline_index_incompatible_with_venue_role_elo_and_engine_HFA",
  hfaEntangledWithEngineInputs: true as const,
  pe3RoleBasesEntangled: true as const,
  arbitraryMappingForbidden: true as const,
} as const;

export type Pe4HistoricalExpectationInput = {
  targetStrengthCommon: number | null;
  opponentStrengthCommon: number | null;
  targetVenueRole: Pe4VenueRole;
  pairwiseAvailable: boolean;
  historicalCutoffUtc: string;
  /** Descriptive quality; does not unlock numeric expectation. */
  targetSource: string | null;
  opponentSource: string | null;
};

/**
 * Resolve historical expectation. Always UNAVAILABLE in PE-4G.1 —
 * no fitted / invented Elo→P or Elo→GD map is permitted.
 */
export function resolvePe4HistoricalExpectation(
  input: Pe4HistoricalExpectationInput,
): Pe4HistoricalExpectationEvidence {
  void input;
  return {
    status: "UNAVAILABLE",
    reason: PE4_HISTORICAL_EXPECTATION_UNAVAILABLE_REASON,
    modelVersion: PE4_HISTORICAL_EXPECTATION_MODEL_VERSION,
    expectedHomeWinProbability: null,
    expectedDrawProbability: null,
    expectedAwayWinProbability: null,
    expectedPointsFromTargetPerspective: null,
    expectedGoalDifferenceFromTargetPerspective: null,
    expectedGoalsFor: null,
    expectedGoalsAgainst: null,
    auditNotes: {
      eloPoissonHybridNotReusable: true,
      hfaEntangledWithEngineInputs: true,
      commonBaselineNotVenueRoleElo: true,
      noArbitraryMappingEmitted: true,
    },
  };
}

export function resolvePe4HistoricalExpectationFromPairwise(
  pairwise: Pe4PairwiseHistoricalStrengthContext,
): Pe4HistoricalExpectationEvidence {
  return resolvePe4HistoricalExpectation({
    targetStrengthCommon: pairwise.targetCommonIndex,
    opponentStrengthCommon: pairwise.opponentCommonIndex,
    targetVenueRole: pairwise.targetVenueRole,
    pairwiseAvailable: pairwise.pairwiseAvailable,
    historicalCutoffUtc: pairwise.historicalCutoffUtc,
    targetSource: pairwise.targetSource,
    opponentSource: pairwise.opponentSource,
  });
}

/**
 * Residuals require a defined expectation in matching units.
 * PE-4G.1 emits no numeric residuals and does not invent result encodings.
 */
export function resolvePe4HistoricalResidual(input: {
  expectation: Pe4HistoricalExpectationEvidence;
}): Pe4HistoricalResidualEvidence {
  // PE-4G.1: expectation is always UNAVAILABLE; never emit numeric residuals.
  void input;
  return {
    status: "UNAVAILABLE",
    reason: "expectation_model_not_defined",
    resultResidual: null,
    goalDifferenceResidual: null,
    observedResultEncoding: null,
    resultEncodingScheme: null,
  };
}
