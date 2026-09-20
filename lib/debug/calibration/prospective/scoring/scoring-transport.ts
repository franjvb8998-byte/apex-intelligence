/**
 * Injected synthetic outcome source. No live provider implementation.
 */

import type {
  ProspectiveFinalOutcome,
  ProspectiveOutcomeSource,
} from "@/lib/debug/calibration/prospective/scoring/scoring-types";

export function createSyntheticOutcomeSource(
  outcomes: readonly ProspectiveFinalOutcome[],
): ProspectiveOutcomeSource {
  const byId = new Map(outcomes.map((row) => [row.fixtureId, row]));
  return {
    kind: "synthetic",
    loadOutcome(fixtureId: string): ProspectiveFinalOutcome | null {
      return byId.get(fixtureId) ?? null;
    },
  };
}
