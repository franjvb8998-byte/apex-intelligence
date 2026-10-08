/**
 * PE-4I.15 — Predeclared window contract (NOT optimized / NOT fitted).
 * N={3,5,8,10}, days={30,60,90}. Deterministic selection + ordering.
 */

import { parseKickoffUtcMillis } from "@/lib/debug/calibration/pe4-acquisition/temporal";
import {
  pe4I15Err,
  pe4I15Ok,
  type Pe4I15Result,
} from "@/lib/debug/calibration/pe4-as-of-t-features/fail-closed";

export const PE4I15_LAST_N_WINDOWS = [3, 5, 8, 10] as const;
export type Pe4I15LastN = (typeof PE4I15_LAST_N_WINDOWS)[number];

export const PE4I15_CALENDAR_DAY_WINDOWS = [30, 60, 90] as const;
export type Pe4I15CalendarDays =
  (typeof PE4I15_CALENDAR_DAY_WINDOWS)[number];

export type Pe4I15WindowSpec =
  | {
      kind: "last_n";
      n: Pe4I15LastN;
      proceeds: true;
      justification: string;
    }
  | {
      kind: "calendar_days";
      days: Pe4I15CalendarDays;
      proceeds: true;
      justification: string;
    };

export const PE4I15_WINDOW_CONTRACT: readonly Pe4I15WindowSpec[] = [
  {
    kind: "last_n",
    n: 3,
    proceeds: true,
    justification:
      "Short-horizon form probe; aligns with GOALS-RAD last_3 and PE-4 last-N practice.",
  },
  {
    kind: "last_n",
    n: 5,
    proceeds: true,
    justification:
      "Primary mid-short window used across form audits; balances recency vs variance.",
  },
  {
    kind: "last_n",
    n: 8,
    proceeds: true,
    justification:
      "Longer last-N already audited in GOALS-RAD; retained for continuity, not optimized.",
  },
  {
    kind: "last_n",
    n: 10,
    proceeds: true,
    justification:
      "Upper last-N bound for PE-4I.15; exposes stability vs last_8 without fitting.",
  },
  {
    kind: "calendar_days",
    days: 30,
    proceeds: true,
    justification:
      "Approx one month congestion/form probe; replaces RAD 28d with round calendar month.",
  },
  {
    kind: "calendar_days",
    days: 60,
    proceeds: true,
    justification:
      "Two-month window for medium-horizon performance presence coverage.",
  },
  {
    kind: "calendar_days",
    days: 90,
    proceeds: true,
    justification:
      "Quarter window for sparse competitions / cross-comp rest context; not optimized.",
  },
] as const;

export type Pe4I15WindowId =
  | `last_${Pe4I15LastN}`
  | `days_${Pe4I15CalendarDays}`;

export function windowId(spec: Pe4I15WindowSpec): Pe4I15WindowId {
  return spec.kind === "last_n" ? `last_${spec.n}` : `days_${spec.days}`;
}

export type Pe4I15WindowOrdering = {
  /** Newest-first for last-N take; then reverse to chronological for digests. */
  primarySort: "kickoff_asc_then_fixture_id_asc";
  lastNTake: "most_recent_n_after_sort_desc_kickoff";
  tieBreak: "fixture_id_asc";
  crossCompetition: "allowed_when_corpus_includes_them_tagged_in_counts";
  homeAwayWindows: "separate_optional_filters_not_mixed_silently";
  missingInsideWindow: "exclude_match_from_family_obs_count_do_not_impute";
  minObservationsPolicy: "family_spec_minObservations_gates_AVAILABLE";
};

export const PE4I15_WINDOW_ORDERING: Pe4I15WindowOrdering = {
  primarySort: "kickoff_asc_then_fixture_id_asc",
  lastNTake: "most_recent_n_after_sort_desc_kickoff",
  tieBreak: "fixture_id_asc",
  crossCompetition: "allowed_when_corpus_includes_them_tagged_in_counts",
  homeAwayWindows: "separate_optional_filters_not_mixed_silently",
  missingInsideWindow: "exclude_match_from_family_obs_count_do_not_impute",
  minObservationsPolicy: "family_spec_minObservations_gates_AVAILABLE",
};

export type Pe4I15WindowCandidate = {
  fixtureId: string;
  kickoffUtc: string;
  competition?: string;
  venueRole?: "HOME" | "AWAY";
};

export type Pe4I15SelectedWindow = {
  windowId: Pe4I15WindowId;
  selected: Pe4I15WindowCandidate[];
  observationCount: number;
  competitionCounts: Record<string, number>;
  belowMinObservations: boolean;
};

function sortAsc(
  rows: readonly Pe4I15WindowCandidate[],
): Pe4I15WindowCandidate[] {
  return [...rows].sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.fixtureId.localeCompare(b.fixtureId);
  });
}

/**
 * Deterministic window selection from an already temporally-eligible pool
 * (caller must have applied temporal + holdout filters).
 */
export function selectWindow(input: {
  eligibleChronological: readonly Pe4I15WindowCandidate[];
  targetKickoffUtc: string;
  window: Pe4I15WindowSpec;
  minObservations: number;
  venueRoleFilter?: "HOME" | "AWAY";
}): Pe4I15Result<Pe4I15SelectedWindow> {
  const targetMs = parseKickoffUtcMillis(input.targetKickoffUtc);
  if (targetMs == null) {
    return pe4I15Err("malformed_kickoff", "target");
  }

  let pool = sortAsc(input.eligibleChronological);
  if (input.venueRoleFilter) {
    pool = pool.filter((r) => r.venueRole === input.venueRoleFilter);
  }

  let selected: Pe4I15WindowCandidate[];
  if (input.window.kind === "last_n") {
    // Most recent N: sort desc kickoff, then fixtureId asc for ties, take N, re-sort asc.
    const desc = [...pool].sort((a, b) => {
      const k = b.kickoffUtc.localeCompare(a.kickoffUtc);
      if (k !== 0) return k;
      return a.fixtureId.localeCompare(b.fixtureId);
    });
    selected = sortAsc(desc.slice(0, input.window.n));
  } else {
    const cutoff = targetMs - input.window.days * 24 * 60 * 60 * 1000;
    selected = pool.filter((r) => {
      const ms = parseKickoffUtcMillis(r.kickoffUtc);
      return ms != null && ms >= cutoff && ms < targetMs;
    });
  }

  const competitionCounts: Record<string, number> = {};
  for (const r of selected) {
    const key = r.competition ?? "unknown";
    competitionCounts[key] = (competitionCounts[key] ?? 0) + 1;
  }

  const observationCount = selected.length;
  return pe4I15Ok({
    windowId: windowId(input.window),
    selected,
    observationCount,
    competitionCounts,
    belowMinObservations: observationCount < input.minObservations,
  });
}

export function allProceedingWindows(): readonly Pe4I15WindowSpec[] {
  return PE4I15_WINDOW_CONTRACT.filter((w) => w.proceeds);
}
