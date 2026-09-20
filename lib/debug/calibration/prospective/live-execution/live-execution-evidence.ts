/**
 * Construct frozen catalogue counts from completed prior fixtures only.
 * Same-kickoff, future, target, live, and voided fixtures never contribute.
 */

import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import { FORBIDDEN_FINAL_STATUSES, type TeamEvidenceCounts } from "@/lib/debug/calibration/prospective/capture/capture-types";
import {
  isEligiblePriorEvidence,
  selectPriorEvidenceFixtures,
} from "@/lib/debug/calibration/prospective/protocol/protocol-evidence";
import { classifyProviderStatus } from "@/lib/debug/calibration/prospective/protocol/protocol-status";
import { utcMillis } from "@/lib/debug/calibration/prospective/protocol/protocol-utc";
import type {
  LiveExecutionEvidenceProvenance,
  ProjectedPriorFixture,
  ProjectedTargetFixture,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";

function emptyCounts(teamId: string): TeamEvidenceCounts {
  return {
    teamId,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

function applyCompletedResult(counts: TeamEvidenceCounts, goalsFor: number, goalsAgainst: number): void {
  counts.matchesPlayed += 1;
  counts.goalsFor += goalsFor;
  counts.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) counts.wins += 1;
  else if (goalsFor < goalsAgainst) counts.losses += 1;
  else counts.draws += 1;
}

export function isCompletedEvidenceStatus(status: string): boolean {
  const classified = classifyProviderStatus(status);
  if (classified.disposition !== "INELIGIBLE_STATUS") return false;
  return (FORBIDDEN_FINAL_STATUSES as readonly string[]).includes(classified.normalized);
}

function priorMayContribute(prior: ProjectedPriorFixture, target: ProjectedTargetFixture): boolean {
  if (prior.fixtureId === target.fixtureId) return false;
  if (prior.competitionId !== target.competitionId) return false;
  if (prior.season !== target.season) return false;
  if (!isEligiblePriorEvidence(prior.kickoffUtc, target.kickoffUtc)) return false;
  if (!isCompletedEvidenceStatus(prior.status)) return false;
  if (prior.homeGoals == null || prior.awayGoals == null) return false;
  if (prior.homeTeamId !== target.homeTeamId && prior.awayTeamId !== target.homeTeamId
    && prior.homeTeamId !== target.awayTeamId && prior.awayTeamId !== target.awayTeamId) {
    return false;
  }
  return true;
}

export function buildPreMatchCatalogueEvidence(input: {
  target: ProjectedTargetFixture;
  universe: readonly ProjectedPriorFixture[];
  evidenceAsOf: string;
}): {
  home: TeamEvidenceCounts;
  away: TeamEvidenceCounts;
  provenance: LiveExecutionEvidenceProvenance;
} {
  const home = emptyCounts(input.target.homeTeamId);
  const away = emptyCounts(input.target.awayTeamId);
  const timed = selectPriorEvidenceFixtures(
    input.universe.map((row) => ({ fixtureId: row.fixtureId, kickoff: row.kickoffUtc })),
    { fixtureId: input.target.fixtureId, kickoff: input.target.kickoffUtc },
  );
  const timedIds = new Set(timed.map((row) => row.fixtureId));
  let accepted = 0;
  let latestAcceptedKickoff: string | null = null;

  for (const prior of input.universe) {
    if (!timedIds.has(prior.fixtureId)) continue;
    if (!priorMayContribute(prior, input.target)) continue;
    const homeGoals = prior.homeGoals as number;
    const awayGoals = prior.awayGoals as number;
    if (prior.homeTeamId === input.target.homeTeamId) {
      applyCompletedResult(home, homeGoals, awayGoals);
    } else if (prior.awayTeamId === input.target.homeTeamId) {
      applyCompletedResult(home, awayGoals, homeGoals);
    }
    if (prior.homeTeamId === input.target.awayTeamId) {
      applyCompletedResult(away, homeGoals, awayGoals);
    } else if (prior.awayTeamId === input.target.awayTeamId) {
      applyCompletedResult(away, awayGoals, homeGoals);
    }
    accepted += 1;
    if (
      latestAcceptedKickoff == null
      || utcMillis(prior.kickoffUtc, "priorKickoff") > utcMillis(latestAcceptedKickoff, "latestEvidence")
    ) {
      latestAcceptedKickoff = prior.kickoffUtc;
    }
  }

  if (
    latestAcceptedKickoff != null
    && !isEligiblePriorEvidence(latestAcceptedKickoff, input.target.kickoffUtc)
  ) {
    throw new ProspectiveIntegrityError("latest evidence kickoff must be strictly before the target kickoff");
  }

  return {
    home,
    away,
    provenance: {
      targetFixtureId: input.target.fixtureId,
      targetKickoff: input.target.kickoffUtc,
      evidenceAsOf: input.evidenceAsOf,
      competitionId: input.target.competitionId,
      season: input.target.season,
      homeTeamId: input.target.homeTeamId,
      awayTeamId: input.target.awayTeamId,
      priorsInspected: input.universe.length,
      priorsAccepted: accepted,
      homeEvidenceMatchCount: home.matchesPlayed,
      awayEvidenceMatchCount: away.matchesPlayed,
      latestAcceptedKickoff,
    },
  };
}
