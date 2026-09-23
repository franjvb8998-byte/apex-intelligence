/**
 * PE-3B fail-closed policy for future C0 lifecycle activation (PE-3C).
 * Observable decisions only — no silent recovery.
 */

export type Pe3FailClosedAction =
  | "skip_ticket"
  | "explicit_base_prior"
  | "mixed_side_catalogue"
  | "abort_run"
  | "continue_other_fixtures";

export type Pe3FailClosedCase =
  | "season_universe_acquisition_failure"
  | "malformed_provider_response"
  | "missing_season"
  | "missing_competition"
  | "zero_historical_fixtures"
  | "one_side_evidence_only"
  | "provider_timeout"
  | "quota_rate_limit"
  | "reconstruction_exception";

/**
 * Intended PE-3C behavior matrix. Not wired into production yet.
 */
export const PE3_FAIL_CLOSED_MATRIX: Record<
  Pe3FailClosedCase,
  {
    action: Pe3FailClosedAction;
    provenanceFallback: boolean;
    notes: string;
  }
> = {
  season_universe_acquisition_failure: {
    action: "skip_ticket",
    provenanceFallback: false,
    notes: "Do not invent Elo; skip this fixture; continue others unless run-fatal.",
  },
  malformed_provider_response: {
    action: "skip_ticket",
    provenanceFallback: false,
    notes: "Treat as acquisition failure for that league/season key.",
  },
  missing_season: {
    action: "skip_ticket",
    provenanceFallback: false,
    notes: "No calendar-year guess. Authoritative league.season required.",
  },
  missing_competition: {
    action: "skip_ticket",
    provenanceFallback: false,
    notes: "Need league/competition id for universe key.",
  },
  zero_historical_fixtures: {
    action: "explicit_base_prior",
    provenanceFallback: true,
    notes: "Reconstruction returns base_prior with fallbackReason=no_completed_priors.",
  },
  one_side_evidence_only: {
    action: "mixed_side_catalogue",
    provenanceFallback: false,
    notes: "Per-side C0: catalogue vs base_prior; source=mixed; not a run failure.",
  },
  provider_timeout: {
    action: "skip_ticket",
    provenanceFallback: false,
    notes: "Continue other fixtures; do not use stale/partial universe silently.",
  },
  quota_rate_limit: {
    action: "abort_run",
    provenanceFallback: false,
    notes: "Matches existing lifecycle quota fatal semantics.",
  },
  reconstruction_exception: {
    action: "skip_ticket",
    provenanceFallback: false,
    notes: "Unexpected throw → isolated skip; never silent base_prior without marker.",
  },
};
