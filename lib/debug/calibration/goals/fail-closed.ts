/**
 * GOALS-1B — Fail-closed classification matrix (documentation + helpers).
 */

import type { GoalsFailClosedClass } from "@/lib/debug/calibration/goals/types";

export const GOALS_FAIL_CLOSED_MATRIX: {
  caseId: string;
  classification: GoalsFailClosedClass;
  note: string;
}[] = [
  {
    caseId: "malformed_target",
    classification: "extractionFatal",
    note: "Missing identity fields throw",
  },
  {
    caseId: "invalid_kickoff",
    classification: "extractionFatal",
    note: "Non-finite kickoff throws",
  },
  {
    caseId: "identical_home_away",
    classification: "extractionFatal",
    note: "Throws",
  },
  {
    caseId: "conflicting_duplicate",
    classification: "extractionFatal",
    note: "normalizeGoalsHistoricalUniverse throws",
  },
  {
    caseId: "missing_competition",
    classification: "extractionFatal",
    note: "Throws at normalize",
  },
  {
    caseId: "missing_season",
    classification: "extractionFatal",
    note: "Throws at normalize",
  },
  {
    caseId: "target_regulation_label_unavailable",
    classification: "targetLabelUnavailable",
    note: "labels.labelStatus=UNAVAILABLE; row still emitted",
  },
  {
    caseId: "prior_regulation_label_unavailable",
    classification: "componentUnavailable",
    note: "Prior excluded from attack/defense evidence",
  },
  {
    caseId: "zero_prior_team_history",
    classification: "componentUnavailable",
    note: "rates null; futureModelFallbackEligible",
  },
  {
    caseId: "zero_prior_league_history",
    classification: "componentUnavailable",
    note: "league env UNAVAILABLE; futureModelFallbackEligible",
  },
  {
    caseId: "thin_recent_history",
    classification: "componentPartial",
    note: "PARTIAL — not fatal",
  },
  {
    caseId: "common_strength_unavailable",
    classification: "componentUnavailable",
    note: "Seam UNAVAILABLE",
  },
  {
    caseId: "cross_comp_evidence_unavailable",
    classification: "componentUnavailable",
    note: "Policy excludes cross-comp from rates",
  },
  {
    caseId: "holdout_season_forbidden",
    classification: "extractionFatal",
    note: "2025 targets rejected",
  },
];
