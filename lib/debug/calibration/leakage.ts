/**
 * Independent leakage check: no contributing prior may kick off at/after T.
 */

import { countableGoals } from "@/lib/debug/calibration/reconstruct";
import type { ReconstructionFixture } from "@/lib/debug/calibration/types";

export class ReconstructionLeakageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconstructionLeakageError";
  }
}

export function contributingPriorFixtures(input: {
  teamId: string;
  kickoff: string;
  competitionId: string;
  season: string;
  fixtures: readonly ReconstructionFixture[];
}): ReconstructionFixture[] {
  const t = Date.parse(input.kickoff);
  return input.fixtures.filter((fixture) => {
    if (fixture.competitionId !== input.competitionId) return false;
    if (fixture.season !== input.season) return false;
    if (fixture.homeTeamId !== input.teamId && fixture.awayTeamId !== input.teamId) {
      return false;
    }
    if (countableGoals(fixture) == null) return false;
    return Date.parse(fixture.kickoff) < t;
  });
}

export function assertReconstructionHasNoFuturePriors(input: {
  target: ReconstructionFixture;
  fixtures: readonly ReconstructionFixture[];
}): void {
  const t = Date.parse(input.target.kickoff);
  for (const teamId of [input.target.homeTeamId, input.target.awayTeamId]) {
    const priors = contributingPriorFixtures({
      teamId,
      kickoff: input.target.kickoff,
      competitionId: input.target.competitionId,
      season: input.target.season,
      fixtures: input.fixtures,
    });
    for (const prior of priors) {
      if (Date.parse(prior.kickoff) >= t) {
        throw new ReconstructionLeakageError(
          `Prior ${prior.fixtureId} kickoff is not strictly before target ${input.target.fixtureId}`,
        );
      }
      if (prior.fixtureId === input.target.fixtureId) {
        throw new ReconstructionLeakageError(
          `Target ${input.target.fixtureId} contributed to its own features`,
        );
      }
    }
  }
}
