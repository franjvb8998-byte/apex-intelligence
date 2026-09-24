/**
 * PE-4D — Formal fail-closed contract for form/schedule evidence extraction.
 *
 * Observable policy only. Does not wire into production lifecycle.
 * Distinguishes fatal extraction failure from explicit component
 * UNAVAILABLE/PARTIAL (ordinary thin evidence is not fatal).
 */

export type Pe4FailClosedOutcomeKind =
  | "extraction_fatal"
  | "component_unavailable"
  | "component_partial"
  | "component_used"
  | "pe3_fallback_eligible";

export type Pe4FailClosedCase =
  | "malformed_target"
  | "invalid_target_kickoff"
  | "invalid_target_team_ids"
  | "identical_home_away_team_ids"
  | "invalid_competition_or_season"
  | "invalid_last_n"
  | "conflicting_duplicate_fixture"
  | "malformed_historical_row"
  | "no_completed_priors"
  | "early_season_actual_last_n_lt_requested"
  | "opponent_historical_base_prior"
  | "opponent_historical_reconstruction_unavailable"
  | "cross_competition_blind_schedule"
  | "invalid_provenance_context_layer"
  | "internal_extraction_exception"
  // PE-4F cross-competition schedule acquisition
  | "provider_rejected_request"
  | "provider_errors_nonempty"
  | "paging_total_not_one"
  | "results_length_mismatch"
  | "malformed_schedule_row"
  | "requested_team_absent_from_row"
  | "conflicting_duplicate_schedule_fixture"
  | "incomplete_requested_window"
  | "unresolved_competition_load_policy"
  | "no_previous_match_in_season"
  | "season_boundary_uncertainty"
  | "one_team_complete_other_partial"
  // PE-4G.1 historical two-sided strength / expectation
  | "target_historical_strength_unavailable"
  | "opponent_historical_strength_unavailable"
  | "target_historical_base_prior"
  | "both_sides_base_prior"
  | "pairwise_differential_unavailable"
  | "expectation_model_unavailable"
  | "residual_unavailable";

export type Pe4FailClosedEntry = {
  /** A–E outcome class. */
  outcome: Pe4FailClosedOutcomeKind;
  /**
   * When true, PE-3/C0 ticket path may proceed without PE-4 layer
   * (PE-4 is additive evidence; absence/failure of PE-4 must not invent PE).
   */
  pe3FallbackEligible: boolean;
  /**
   * When true, extractPe4FormScheduleEvidence returns ok:false.
   * Ordinary thin history is NOT fatal.
   */
  extractionFatal: boolean;
  notes: string;
};

/**
 * Machine-readable PE-4D fail-closed matrix.
 */
export const PE4_FAIL_CLOSED_MATRIX: Record<
  Pe4FailClosedCase,
  Pe4FailClosedEntry
> = {
  malformed_target: {
    outcome: "extraction_fatal",
    pe3FallbackEligible: true,
    extractionFatal: true,
    notes: "Refuse layer; do not invent evidence. PE-3 may still run alone.",
  },
  invalid_target_kickoff: {
    outcome: "extraction_fatal",
    pe3FallbackEligible: true,
    extractionFatal: true,
    notes: "Covered by malformed_target validation (kickoff parse).",
  },
  invalid_target_team_ids: {
    outcome: "extraction_fatal",
    pe3FallbackEligible: true,
    extractionFatal: true,
    notes: "Missing/empty team ids → malformed_target.",
  },
  identical_home_away_team_ids: {
    outcome: "extraction_fatal",
    pe3FallbackEligible: true,
    extractionFatal: true,
    notes: "homeTeamId === awayTeamId → malformed_target.",
  },
  invalid_competition_or_season: {
    outcome: "extraction_fatal",
    pe3FallbackEligible: true,
    extractionFatal: true,
    notes: "Missing competition/season → malformed_target.",
  },
  invalid_last_n: {
    outcome: "extraction_fatal",
    pe3FallbackEligible: true,
    extractionFatal: true,
    notes: "Non-positive / non-integer lastN → ok:false invalid_last_n.",
  },
  conflicting_duplicate_fixture: {
    outcome: "extraction_fatal",
    pe3FallbackEligible: true,
    extractionFatal: true,
    notes: "Reuse PE-3 dedupe fail-closed; never pick a conflicting row.",
  },
  malformed_historical_row: {
    outcome: "component_unavailable",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Skip malformed prior rows (no fabrication). Remaining valid evidence may still USED.",
  },
  no_completed_priors: {
    outcome: "component_unavailable",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "recentForm/venueRole/trajectoryOrdered/opponentAdjusted → UNAVAILABLE; not fatal.",
  },
  early_season_actual_last_n_lt_requested: {
    outcome: "component_used",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "actualLastN < requestedLastN is explicit; never pad. Still USED when N>0.",
  },
  opponent_historical_base_prior: {
    outcome: "component_used",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "base_prior is valid but lower quality; coverage all_base_prior or mixed — never labelled catalogue.",
  },
  opponent_historical_reconstruction_unavailable: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "If any selected prior lacks opponent strength → PARTIAL; do not invent Elo.",
  },
  cross_competition_blind_schedule: {
    outcome: "component_used",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "scheduleCompetitionScoped USED only as competition-season evidence; crossCompetitionBlind must stay true.",
  },
  invalid_provenance_context_layer: {
    outcome: "extraction_fatal",
    pe3FallbackEligible: true,
    extractionFatal: true,
    notes:
      "Validator rejects malformed layer; readers must not treat invalid JSON as PE-4 evidence.",
  },
  internal_extraction_exception: {
    outcome: "extraction_fatal",
    pe3FallbackEligible: true,
    extractionFatal: true,
    notes:
      "Unexpected throw → no silent layer. Callers should omit PE-4 and keep PE-3.",
  },
  provider_rejected_request: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Cross-comp request rejected/invalid. Keep competition-scoped PE-4 with blindness=true. PE-3 untouched.",
  },
  provider_errors_nonempty: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Provider envelope incomplete. Fallback competition-scoped schedule evidence; PE-3 ok.",
  },
  paging_total_not_one: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "paging.total != 1 → not labelled complete. Competition-scoped fallback.",
  },
  results_length_mismatch: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "results !== response.length → incomplete envelope. Competition-scoped fallback.",
  },
  malformed_schedule_row: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Malformed cross-comp row fails closed for schedule completeness; PE-3/C0 intact.",
  },
  requested_team_absent_from_row: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Provider row missing requested team → schedule incomplete; no silent accept.",
  },
  conflicting_duplicate_schedule_fixture: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Conflicting duplicate schedule fixture → fail closed; do not hash arbitrary winner.",
  },
  incomplete_requested_window: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Requested from/to does not cover [T-28d,T). congestionWindowComplete=false.",
  },
  unresolved_competition_load_policy: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Unknown/friendly-like comps not counted as competitive load; semantic schedule PARTIAL.",
  },
  no_previous_match_in_season: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "No previous completed match in provider season → previousMatchComplete=false; no invented long rest.",
  },
  season_boundary_uncertainty: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Near/before season boundary: prior season may hold true previous. Multi-season deferred.",
  },
  one_team_complete_other_partial: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Merge remains crossCompetitionBlind=true until BOTH sides are congestion-complete.",
  },
  target_historical_strength_unavailable: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Target as-of-M strength missing → pairwise unavailable; PE-3 untouched.",
  },
  opponent_historical_strength_unavailable: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Opponent as-of-M strength missing → pairwise/opponentAdjusted may PARTIAL.",
  },
  target_historical_base_prior: {
    outcome: "component_used",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Target base_prior is valid lower-quality index; never labelled catalogue.",
  },
  both_sides_base_prior: {
    outcome: "component_used",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Both common-baseline sides base_prior; differential descriptive only.",
  },
  pairwise_differential_unavailable: {
    outcome: "component_partial",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Cannot form target−opponent differential; no invented strength gap.",
  },
  expectation_model_unavailable: {
    outcome: "component_unavailable",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "No compatible Elo→expectation map for common-baseline indices. UNAVAILABLE preferred over invention.",
  },
  residual_unavailable: {
    outcome: "component_unavailable",
    pe3FallbackEligible: true,
    extractionFatal: false,
    notes:
      "Residuals require expectation in matching units; never emit numeric residual without map.",
  },
};

/** Cases that must cause extractPe4FormScheduleEvidence ok:false. */
export const PE4_EXTRACTION_FATAL_CASES: readonly Pe4FailClosedCase[] = (
  Object.keys(PE4_FAIL_CLOSED_MATRIX) as Pe4FailClosedCase[]
).filter((k) => PE4_FAIL_CLOSED_MATRIX[k].extractionFatal);
