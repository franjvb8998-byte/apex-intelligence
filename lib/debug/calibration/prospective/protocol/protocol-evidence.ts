/**
 * Pre-match evidence rules. Same-kickoff fixtures cannot leak into one another.
 */

import { utcMillis } from "@/lib/debug/calibration/prospective/protocol/protocol-utc";

export type TimedFixture = {
  fixtureId: string;
  kickoff: string;
};

export function isEligiblePriorEvidence(priorKickoff: string, targetKickoff: string): boolean {
  return utcMillis(priorKickoff, "priorKickoff") < utcMillis(targetKickoff, "targetKickoff");
}

export function selectPriorEvidenceFixtures<T extends TimedFixture>(
  priors: readonly T[],
  target: TimedFixture,
): T[] {
  return priors.filter(
    (row) => row.fixtureId !== target.fixtureId && isEligiblePriorEvidence(row.kickoff, target.kickoff),
  );
}

export function sortDeterministicKickoffThenId<T extends TimedFixture>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    const kickoff = left.kickoff.localeCompare(right.kickoff);
    if (kickoff !== 0) return kickoff;
    return left.fixtureId.localeCompare(right.fixtureId);
  });
}
