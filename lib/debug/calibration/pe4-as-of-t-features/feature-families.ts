/**
 * PE-4I.15 — Declarative feature family specs (no weights / no fitting).
 */

export type Pe4I15Availability =
  | "UNIVERSAL_WHEN_MIN_OBS"
  | "CONDITIONAL_ON_FIELD_PRESENCE"
  | "CONDITIONAL_ON_STRENGTH_JOIN"
  | "CONDITIONAL_ON_SCHEDULE_CORPUS"
  | "UNSUPPORTED";

export type Pe4I15MissingBehavior =
  | "FAIL_CLOSED_UNAVAILABLE"
  | "PARTIAL_WITH_COUNTS"
  | "EXCLUDE_MATCH_FROM_WINDOW"
  | "FAMILY_UNAVAILABLE";

export type Pe4I15LeakageRule =
  | "STRICT_KICKOFF_BEFORE_T"
  | "STRICT_KICKOFF_BEFORE_T_AND_NO_POST_T_SNAPSHOT"
  | "OPPONENT_STRENGTH_AS_OF_KICKOFF_M_NOT_T"
  | "HOLDOUT_2025_OUTCOMES_EXCLUDED";

export type Pe4I15ScopeKind = "universal" | "conditional";

export type Pe4I15FeatureFamilyId =
  | "recent_results"
  | "recent_performance"
  | "home_away_splits"
  | "opponent_strength_join"
  | "schedule_rest"
  | "competition_context";

export type Pe4I15FeatureFamilySpec = {
  id: Pe4I15FeatureFamilyId;
  label: string;
  requiredEvidence: readonly string[];
  availability: Pe4I15Availability;
  missingBehavior: Pe4I15MissingBehavior;
  leakageRule: Pe4I15LeakageRule;
  /** Minimum observations inside the selected window before AVAILABLE. */
  minObservations: number;
  universalVsConditional: Pe4I15ScopeKind;
  /** May consume AET/PEN rows only when regulation is known / FT-safe. */
  aetPenPolicy:
    | "FT_ONLY"
    | "REGULATION_KNOWN_ONLY"
    | "ALLOW_WITH_AMBIGUITY_FLAG"
    | "EXCLUDE_AMBIGUOUS";
  notes: string;
};

export const PE4I15_FEATURE_FAMILY_SPECS: readonly Pe4I15FeatureFamilySpec[] = [
  {
    id: "recent_results",
    label: "Recent results (W/D/L, GF/GA)",
    requiredEvidence: [
      "fixture_identity",
      "kickoff_utc",
      "home_away_team_ids",
      "ft_or_regulation_known_goals",
    ],
    availability: "UNIVERSAL_WHEN_MIN_OBS",
    missingBehavior: "PARTIAL_WITH_COUNTS",
    leakageRule: "STRICT_KICKOFF_BEFORE_T",
    minObservations: 3,
    universalVsConditional: "universal",
    aetPenPolicy: "EXCLUDE_AMBIGUOUS",
    notes:
      "Uses FT goals when status=FT. AET/PEN excluded unless regulation goals proven. No invented encodings.",
  },
  {
    id: "recent_performance",
    label: "Recent performance (shots/SoT/poss/corners/cards; optional xG)",
    requiredEvidence: [
      "statistics_envelope",
      "presence_aware_fields",
      "kickoff_utc_before_T",
    ],
    availability: "CONDITIONAL_ON_FIELD_PRESENCE",
    missingBehavior: "EXCLUDE_MATCH_FROM_WINDOW",
    leakageRule: "STRICT_KICKOFF_BEFORE_T",
    minObservations: 3,
    universalVsConditional: "conditional",
    aetPenPolicy: "EXCLUDE_AMBIGUOUS",
    notes:
      "Missing ≠ 0. Per-field presence gates observation inclusion. xG is optional additive path B.",
  },
  {
    id: "home_away_splits",
    label: "Home/away role splits",
    requiredEvidence: [
      "venue_role_at_M",
      "same_team_identity",
      "recent_results_or_performance_base",
    ],
    availability: "UNIVERSAL_WHEN_MIN_OBS",
    missingBehavior: "PARTIAL_WITH_COUNTS",
    leakageRule: "STRICT_KICKOFF_BEFORE_T",
    minObservations: 3,
    universalVsConditional: "universal",
    aetPenPolicy: "EXCLUDE_AMBIGUOUS",
    notes:
      "Separate windows for home-only and away-only priors; do not mix roles silently.",
  },
  {
    id: "opponent_strength_join",
    label: "Opponent-strength join (as-of kickoff M)",
    requiredEvidence: [
      "opponent_team_id_at_M",
      "common_baseline_strength_as_of_kickoff_M",
      "no_target_T_strength_leakage",
    ],
    availability: "CONDITIONAL_ON_STRENGTH_JOIN",
    missingBehavior: "FAIL_CLOSED_UNAVAILABLE",
    leakageRule: "OPPONENT_STRENGTH_AS_OF_KICKOFF_M_NOT_T",
    minObservations: 3,
    universalVsConditional: "conditional",
    aetPenPolicy: "ALLOW_WITH_AMBIGUITY_FLAG",
    notes:
      "Join strength at kickoff(M), never kickoff(T). Reuses PE-4C/G.1 semantics conceptually; this phase declares join rules only.",
  },
  {
    id: "schedule_rest",
    label: "Schedule / rest load",
    requiredEvidence: [
      "multi_competition_schedule_corpus_as_of_T",
      "kickoff_ordered_priors",
    ],
    availability: "CONDITIONAL_ON_SCHEDULE_CORPUS",
    missingBehavior: "FAMILY_UNAVAILABLE",
    leakageRule: "STRICT_KICKOFF_BEFORE_T_AND_NO_POST_T_SNAPSHOT",
    minObservations: 1,
    universalVsConditional: "conditional",
    aetPenPolicy: "ALLOW_WITH_AMBIGUITY_FLAG",
    notes:
      "Requires as-of-T schedule snapshots for future anticipation honesty. Rest hours from known past kickoffs only.",
  },
  {
    id: "competition_context",
    label: "Competition context",
    requiredEvidence: [
      "competition_id",
      "provider_season",
      "policy_pin_registry",
    ],
    availability: "UNIVERSAL_WHEN_MIN_OBS",
    missingBehavior: "FAIL_CLOSED_UNAVAILABLE",
    leakageRule: "HOLDOUT_2025_OUTCOMES_EXCLUDED",
    minObservations: 1,
    universalVsConditional: "universal",
    aetPenPolicy: "ALLOW_WITH_AMBIGUITY_FLAG",
    notes:
      "Competition/season tags for stratification; not a strength feature. Holdout outcomes excluded from DEV pools.",
  },
] as const;

export function getFeatureFamilySpec(
  id: Pe4I15FeatureFamilyId,
): Pe4I15FeatureFamilySpec {
  const spec = PE4I15_FEATURE_FAMILY_SPECS.find((s) => s.id === id);
  if (!spec) {
    throw new Error(`unknown feature family: ${id}`);
  }
  return spec;
}

export const PE4I15_UNSUPPORTED_FEATURES = [
  {
    id: "manager_change_series",
    reason: "no_historical_as_of_t_coach_archive",
  },
  {
    id: "travel_distance",
    reason: "not_in_offline_corpus",
  },
  {
    id: "lineup_confirmed_xi",
    reason: "no_historical_as_of_t_lineup_archive",
  },
  {
    id: "injury_list_as_of_t",
    reason: "no_historical_as_of_t_injury_archive",
  },
  {
    id: "market_odds_implied_form",
    reason: "odds_ev_forbidden_in_pe4i15",
  },
  {
    id: "fitted_form_coefficients",
    reason: "modeling_forbidden_in_pe4i15",
  },
  {
    id: "elo_poisson_xg_substitution",
    reason: "model_output_is_not_vendor_xg",
  },
] as const;
