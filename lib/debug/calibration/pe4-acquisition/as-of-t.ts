/**
 * PE-4I.4 — Future as-of-T evidence contract (design / helpers only).
 */

import {
  assertNotSameKickoffOrSelf,
  isStrictlyBeforeKickoff,
} from "@/lib/debug/calibration/pe4-acquisition/temporal";
import type { Pe4I4CanonicalPerformanceField } from "@/lib/debug/calibration/pe4-acquisition/performance-fields";

export type Pe4I4HistoryWindow =
  | { kind: "last_n"; n: number }
  | { kind: "calendar_days"; days: number };

export type Pe4I4AsOfTFieldSummary = {
  field: Pe4I4CanonicalPerformanceField;
  requestedWindow: Pe4I4HistoryWindow;
  actualObservations: number;
  missingCount: number;
  competitionComposition: Record<string, number>;
  evidenceCutoffUtc: string;
  provenanceNote: string;
};

export type Pe4I4AsOfTFixtureRef = {
  providerFixtureId: string;
  kickoffUtc: string;
};

/**
 * Strict eligibility of historical fixture M for target T.
 */
export function isEligibleHistoricalForTarget(input: {
  historical: Pe4I4AsOfTFixtureRef;
  target: Pe4I4AsOfTFixtureRef;
}): { ok: true } | { ok: false; reason: string } {
  return assertNotSameKickoffOrSelf({
    historicalFixtureId: input.historical.providerFixtureId,
    historicalKickoffUtc: input.historical.kickoffUtc,
    targetFixtureId: input.target.providerFixtureId,
    targetKickoffUtc: input.target.kickoffUtc,
  });
}

export function filterStrictlyBeforeTarget(
  candidates: readonly Pe4I4AsOfTFixtureRef[],
  target: Pe4I4AsOfTFixtureRef,
): Pe4I4AsOfTFixtureRef[] {
  return candidates
    .filter(
      (m) =>
        m.providerFixtureId !== target.providerFixtureId &&
        isStrictlyBeforeKickoff(m.kickoffUtc, target.kickoffUtc),
    )
    .sort((a, b) => {
      const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
      if (k !== 0) return k;
      return a.providerFixtureId.localeCompare(b.providerFixtureId);
    });
}
