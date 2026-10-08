/**
 * PE-4I.16 — Path B additive optional xG block.
 * No zero-fill / imputation / population shrink.
 */

import type { Pe4I16PresenceAggregate } from "@/lib/debug/calibration/pe4-as-of-t-features/universal-vector";
import type { Pe4I16TeamPerspectiveRow } from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import type { Pe4I15PresenceNumeric } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import {
  measureXgCoverage,
  type Pe4I15XgCoverageCounts,
} from "@/lib/debug/calibration/pe4-as-of-t-features/xg-heterogeneity";

export type Pe4I16OptionalXgVector = {
  path: "B_ADDITIVE_XG_NO_POPULATION_SHIFT";
  /** True when at least one side-observation of xG is present in the window. */
  anyXgPresent: boolean;
  expectedGoalsFor: Pe4I16PresenceAggregate;
  expectedGoalsAgainst: Pe4I16PresenceAggregate;
  coverage: Pe4I15XgCoverageCounts;
  zeroFillUsed: false;
  imputationUsed: false;
  populationShifted: false;
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

/**
 * Build Path B additive xG features. Missing stays missing (mean=null).
 * Does not alter Path A population.
 */
export function buildOptionalXgVector(
  selected: readonly Pe4I16TeamPerspectiveRow[],
): Pe4I16OptionalXgVector {
  const expectedGoalsFor = aggregatePresence(
    selected.map((r) => r.expectedGoalsFor),
  );
  const expectedGoalsAgainst = aggregatePresence(
    selected.map((r) => r.expectedGoalsAgainst),
  );

  const coverage = measureXgCoverage(
    selected.map((r) => ({
      fixtureId: r.fixtureId,
      home:
        r.venueRole === "HOME"
          ? r.expectedGoalsFor.presence
          : r.expectedGoalsAgainst.presence,
      away:
        r.venueRole === "AWAY"
          ? r.expectedGoalsFor.presence
          : r.expectedGoalsAgainst.presence,
    })),
  );

  return {
    path: "B_ADDITIVE_XG_NO_POPULATION_SHIFT",
    anyXgPresent: expectedGoalsFor.obsCount + expectedGoalsAgainst.obsCount > 0,
    expectedGoalsFor,
    expectedGoalsAgainst,
    coverage,
    zeroFillUsed: false,
    imputationUsed: false,
    populationShifted: false,
  };
}
