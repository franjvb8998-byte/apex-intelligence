/**
 * PE-4I.16 — Path A universal non-xG aggregates.
 * Presence-aware obs/missing counts. NO score / weights / multiplier.
 */

import type { Pe4I16TeamPerspectiveRow } from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import type { Pe4I15PresenceNumeric } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";

export type Pe4I16PresenceAggregate = {
  obsCount: number;
  missingCount: number;
  ambiguousCount: number;
  /** Mean over present values only; null when obsCount === 0. Never zero-filled. */
  mean: number | null;
  sum: number | null;
};

export type Pe4I16ResultCounts = {
  wins: number;
  draws: number;
  losses: number;
  /** Matches with both goals present and usable for W/D/L. */
  resultObsCount: number;
  goalsMissingOrAmbiguous: number;
};

export type Pe4I16UniversalNonXgVector = {
  path: "A_UNIVERSAL_NON_XG";
  observationCount: number;
  results: Pe4I16ResultCounts;
  goalsFor: Pe4I16PresenceAggregate;
  goalsAgainst: Pe4I16PresenceAggregate;
  shotsFor: Pe4I16PresenceAggregate;
  shotsAgainst: Pe4I16PresenceAggregate;
  shotsOnTargetFor: Pe4I16PresenceAggregate;
  shotsOnTargetAgainst: Pe4I16PresenceAggregate;
  possessionFor: Pe4I16PresenceAggregate;
  possessionAgainst: Pe4I16PresenceAggregate;
  cornersFor: Pe4I16PresenceAggregate;
  cornersAgainst: Pe4I16PresenceAggregate;
  yellowCardsFor: Pe4I16PresenceAggregate;
  yellowCardsAgainst: Pe4I16PresenceAggregate;
  redCardsFor: Pe4I16PresenceAggregate;
  redCardsAgainst: Pe4I16PresenceAggregate;
  /** Explicit: no composite score / weight / multiplier applied. */
  noScoreWeightsMultiplier: true;
};

function aggregatePresence(
  values: readonly Pe4I15PresenceNumeric[],
): Pe4I16PresenceAggregate {
  let obsCount = 0;
  let missingCount = 0;
  let ambiguousCount = 0;
  let sum = 0;
  for (const v of values) {
    if (v.presence === "present" && v.value != null) {
      obsCount += 1;
      sum += v.value;
    } else if (v.presence === "ambiguous") {
      ambiguousCount += 1;
    } else {
      missingCount += 1;
    }
  }
  return {
    obsCount,
    missingCount,
    ambiguousCount,
    mean: obsCount === 0 ? null : sum / obsCount,
    sum: obsCount === 0 ? null : sum,
  };
}

function resultCounts(
  rows: readonly Pe4I16TeamPerspectiveRow[],
): Pe4I16ResultCounts {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let resultObsCount = 0;
  let goalsMissingOrAmbiguous = 0;
  for (const r of rows) {
    if (
      r.goalsFor.presence !== "present" ||
      r.goalsAgainst.presence !== "present" ||
      r.goalsFor.value == null ||
      r.goalsAgainst.value == null
    ) {
      goalsMissingOrAmbiguous += 1;
      continue;
    }
    resultObsCount += 1;
    if (r.goalsFor.value > r.goalsAgainst.value) wins += 1;
    else if (r.goalsFor.value < r.goalsAgainst.value) losses += 1;
    else draws += 1;
  }
  return { wins, draws, losses, resultObsCount, goalsMissingOrAmbiguous };
}

/**
 * Build Path A universal non-xG vector from selected history rows.
 * Caller must have already excluded AET/PEN when required by family policy.
 */
export function buildUniversalNonXgVector(
  selected: readonly Pe4I16TeamPerspectiveRow[],
): Pe4I16UniversalNonXgVector {
  return {
    path: "A_UNIVERSAL_NON_XG",
    observationCount: selected.length,
    results: resultCounts(selected),
    goalsFor: aggregatePresence(selected.map((r) => r.goalsFor)),
    goalsAgainst: aggregatePresence(selected.map((r) => r.goalsAgainst)),
    shotsFor: aggregatePresence(selected.map((r) => r.shotsFor)),
    shotsAgainst: aggregatePresence(selected.map((r) => r.shotsAgainst)),
    shotsOnTargetFor: aggregatePresence(
      selected.map((r) => r.shotsOnTargetFor),
    ),
    shotsOnTargetAgainst: aggregatePresence(
      selected.map((r) => r.shotsOnTargetAgainst),
    ),
    possessionFor: aggregatePresence(selected.map((r) => r.possessionFor)),
    possessionAgainst: aggregatePresence(
      selected.map((r) => r.possessionAgainst),
    ),
    cornersFor: aggregatePresence(selected.map((r) => r.cornersFor)),
    cornersAgainst: aggregatePresence(selected.map((r) => r.cornersAgainst)),
    yellowCardsFor: aggregatePresence(selected.map((r) => r.yellowCardsFor)),
    yellowCardsAgainst: aggregatePresence(
      selected.map((r) => r.yellowCardsAgainst),
    ),
    redCardsFor: aggregatePresence(selected.map((r) => r.redCardsFor)),
    redCardsAgainst: aggregatePresence(selected.map((r) => r.redCardsAgainst)),
    noScoreWeightsMultiplier: true,
  };
}
