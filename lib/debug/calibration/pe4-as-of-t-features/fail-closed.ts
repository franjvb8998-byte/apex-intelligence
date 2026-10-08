/**
 * PE-4I.15 — Fail-closed reason codes for as-of-T feature planning.
 * Deterministic; no silent accept of malformed / leaky evidence.
 */

export const PE4I15_FAIL_CLOSED_REASONS = [
  "missing_kickoff",
  "malformed_kickoff",
  "target_fixture_excluded",
  "same_kickoff_excluded",
  "not_strictly_before_target",
  "future_or_post_t_info",
  "duplicate_fixture_id",
  "conflicting_identity",
  "malformed_teams",
  "incomplete_stats",
  "aet_pen_ambiguous_regulation",
  "calendar_2025_holdout_outcome_excluded",
  "provider_season_2025_forbidden",
  "missing_fixture_id",
  "missing_competition",
  "missing_provider_season",
  "ledger_row_rejected",
  "window_below_min_observations",
  "xg_zero_fill_forbidden",
  "unsupported_feature_family",
] as const;

export type Pe4I15FailClosedReason =
  (typeof PE4I15_FAIL_CLOSED_REASONS)[number];

export type Pe4I15Ok<T> = { ok: true; value: T };
export type Pe4I15Err = {
  ok: false;
  reason: Pe4I15FailClosedReason;
  detail?: string;
};

export type Pe4I15Result<T> = Pe4I15Ok<T> | Pe4I15Err;

export function pe4I15Ok<T>(value: T): Pe4I15Ok<T> {
  return { ok: true, value };
}

export function pe4I15Err(
  reason: Pe4I15FailClosedReason,
  detail?: string,
): Pe4I15Err {
  return detail === undefined
    ? { ok: false, reason }
    : { ok: false, reason, detail };
}
