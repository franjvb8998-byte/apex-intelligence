/**
 * Fail-closed integrity for 5B.6 holdout reconstruction.
 */

import {
  assertReconstructionHasNoFuturePriors,
  contributingPriorFixtures,
  ReconstructionLeakageError,
} from "@/lib/debug/calibration/leakage";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import type { CalibrationRow, ReconstructionFixture } from "@/lib/debug/calibration/types";

export class ValidationIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationIntegrityError";
  }
}

export function assertValidationLeakageContract(input: {
  target: ReconstructionFixture;
  fixtures: readonly ReconstructionFixture[];
  row: CalibrationRow;
}): void {
  assertReconstructionHasNoFuturePriors(input);
  const homePriors = contributingPriorFixtures({
    teamId: input.target.homeTeamId,
    kickoff: input.target.kickoff,
    competitionId: input.target.competitionId,
    season: input.target.season,
    fixtures: input.fixtures,
  });
  const awayPriors = contributingPriorFixtures({
    teamId: input.target.awayTeamId,
    kickoff: input.target.kickoff,
    competitionId: input.target.competitionId,
    season: input.target.season,
    fixtures: input.fixtures,
  });
  if (input.row.homePlayedBefore !== homePriors.length) {
    throw new ReconstructionLeakageError(
      `Home playedBefore ${input.row.homePlayedBefore} does not match ${homePriors.length} strictly-earlier priors for ${input.row.fixtureId}`,
    );
  }
  if (input.row.awayPlayedBefore !== awayPriors.length) {
    throw new ReconstructionLeakageError(
      `Away playedBefore ${input.row.awayPlayedBefore} does not match ${awayPriors.length} strictly-earlier priors for ${input.row.fixtureId}`,
    );
  }
}

export function assertValidValidationPopulation(
  rows: readonly CalibrationRow[],
): void {
  if (rows.length === 0) {
    throw new ValidationIntegrityError("Eligible reconstructed population is empty");
  }
  const ids = new Set<string>();
  let previous: CalibrationRow | undefined;
  for (const row of rows) {
    if (ids.has(row.fixtureId)) {
      throw new ValidationIntegrityError(`Duplicate fixtureId ${row.fixtureId}`);
    }
    ids.add(row.fixtureId);
    const kickoff = Date.parse(row.kickoff);
    if (!Number.isFinite(kickoff)) {
      throw new ValidationIntegrityError(`Invalid kickoff on ${row.fixtureId}`);
    }
    const stats = [
      row.homePlayedBefore,
      row.homeWinsBefore,
      row.homeGfBefore,
      row.homeGaBefore,
      row.awayPlayedBefore,
      row.awayWinsBefore,
      row.awayGfBefore,
      row.awayGaBefore,
    ];
    if (stats.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new ValidationIntegrityError(`Non-finite or negative reconstructed stats on ${row.fixtureId}`);
    }
    if (row.homeWinsBefore > row.homePlayedBefore || row.awayWinsBefore > row.awayPlayedBefore) {
      throw new ValidationIntegrityError(`Wins exceed played on ${row.fixtureId}`);
    }
    if (
      row.actualHomeGoals == null ||
      row.actualAwayGoals == null ||
      row.actualHomeGoals < 0 ||
      row.actualAwayGoals < 0 ||
      !Number.isFinite(row.actualHomeGoals) ||
      !Number.isFinite(row.actualAwayGoals)
    ) {
      throw new ValidationIntegrityError(`Invalid goals on ${row.fixtureId}`);
    }
    if (row.actualOutcome == null) {
      throw new ValidationIntegrityError(`Missing outcome on ${row.fixtureId}`);
    }
    rowEvidenceBucket(row);
    if (previous) {
      const kickoffDelta = Date.parse(row.kickoff) - Date.parse(previous.kickoff);
      const outOfOrder =
        kickoffDelta < 0 || (kickoffDelta === 0 && row.fixtureId < previous.fixtureId);
      if (outOfOrder) {
        throw new ValidationIntegrityError(`Population is not chronological at ${row.fixtureId}`);
      }
    }
    previous = row;
  }
}
