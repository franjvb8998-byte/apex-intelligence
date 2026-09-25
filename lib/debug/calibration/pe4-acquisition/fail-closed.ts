/**
 * PE-4I.2 — Fail-closed matrix (documented + machine-readable).
 */

export const PE4I2_FAIL_CLOSED_MATRIX = [
  {
    caseId: "provider_error",
    behavior: "mark unit retryable; do not invent fixtures/stats",
  },
  {
    caseId: "malformed_envelope",
    behavior: "reject unit; fail closed; no partial silent accept",
  },
  {
    caseId: "missing_fixture_id",
    behavior: "reject row / unit",
  },
  {
    caseId: "conflicting_duplicate_fixture",
    behavior: "fail closed; do not collapse dissimilar rows",
  },
  {
    caseId: "missing_team_identity",
    behavior: "reject schedule row",
  },
  {
    caseId: "unknown_competition",
    behavior: "preserve fixture + flag unknown_competition; do not discard",
  },
  {
    caseId: "statistics_missing",
    behavior: "store missing presence; never coerce to zero",
  },
  {
    caseId: "statistic_field_unknown",
    behavior: "keep raw name in inventory; candidate map optional",
  },
  {
    caseId: "cache_corruption",
    behavior: "throw; refuse to continue on digest/schema mismatch",
  },
  {
    caseId: "digest_mismatch",
    behavior: "cache conflict error; never overwrite silently",
  },
  {
    caseId: "budget_exhaustion",
    behavior: "refuse further provider attempts",
  },
  {
    caseId: "holdout_2025_request",
    behavior: "reject plan/acquire before any call",
  },
  {
    caseId: "partial_acquisition",
    behavior: "manifest tracks completed/failed/retryable; resume from remaining",
  },
] as const;

export type Pe4I2FailClosedCaseId =
  (typeof PE4I2_FAIL_CLOSED_MATRIX)[number]["caseId"];
