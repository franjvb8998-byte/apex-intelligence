/**
 * Immutable pre-match evidence snapshots. Sufficient to reconstruct candidate Elos.
 */

import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import type { ProspectiveEvidence } from "@/lib/debug/calibration/prospective/candidate-types";
import type {
  ProspectiveEvidenceSnapshot,
  ProspectiveFixtureInput,
  TeamEvidenceCounts,
} from "@/lib/debug/calibration/prospective/capture/capture-types";

function copyTeam(counts: TeamEvidenceCounts): TeamEvidenceCounts {
  return {
    teamId: counts.teamId,
    matchesPlayed: counts.matchesPlayed,
    wins: counts.wins,
    draws: counts.draws,
    losses: counts.losses,
    goalsFor: counts.goalsFor,
    goalsAgainst: counts.goalsAgainst,
  };
}

function assertTeamCounts(counts: TeamEvidenceCounts, label: string): void {
  const fields: Array<keyof TeamEvidenceCounts> = [
    "matchesPlayed",
    "wins",
    "draws",
    "losses",
    "goalsFor",
    "goalsAgainst",
  ];
  for (const field of fields) {
    const value = counts[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new ProspectiveIntegrityError(`${label}.${field} must be a finite non-negative number`);
    }
  }
  if (counts.wins + counts.draws + counts.losses > counts.matchesPlayed) {
    throw new ProspectiveIntegrityError(`${label} win/draw/loss counts exceed matchesPlayed`);
  }
}

export function createEvidenceSnapshot(
  input: ProspectiveFixtureInput,
  capturedAt: string,
): ProspectiveEvidenceSnapshot {
  const home = copyTeam(input.preMatchEvidence.home);
  const away = copyTeam(input.preMatchEvidence.away);
  if (home.teamId !== input.homeTeamId) {
    throw new ProspectiveIntegrityError("home evidence teamId must match homeTeamId");
  }
  if (away.teamId !== input.awayTeamId) {
    throw new ProspectiveIntegrityError("away evidence teamId must match awayTeamId");
  }
  assertTeamCounts(home, "home");
  assertTeamCounts(away, "away");
  const odds = input.oddsSnapshot
    ? {
        capturedAt: input.oddsSnapshot.capturedAt,
        source: input.oddsSnapshot.source,
        home: input.oddsSnapshot.home,
        draw: input.oddsSnapshot.draw,
        away: input.oddsSnapshot.away,
      }
    : null;
  const snapshot: ProspectiveEvidenceSnapshot = {
    fixtureId: input.fixtureId,
    capturedAt,
    evidenceAsOf: input.evidenceAsOf,
    home,
    away,
    source: {
      competitionId: input.competitionId,
      season: input.season,
    },
    oddsSnapshot: odds,
  };
  return Object.freeze({
    fixtureId: snapshot.fixtureId,
    capturedAt: snapshot.capturedAt,
    evidenceAsOf: snapshot.evidenceAsOf,
    home: Object.freeze(copyTeam(snapshot.home)),
    away: Object.freeze(copyTeam(snapshot.away)),
    source: Object.freeze({ ...snapshot.source }),
    oddsSnapshot: snapshot.oddsSnapshot ? Object.freeze({ ...snapshot.oddsSnapshot }) : null,
  });
}

export function evidenceFromSnapshot(
  input: ProspectiveFixtureInput,
  snapshot: ProspectiveEvidenceSnapshot,
): ProspectiveEvidence {
  return {
    fixtureId: snapshot.fixtureId,
    competitionId: snapshot.source.competitionId,
    season: snapshot.source.season,
    kickoff: input.kickoff,
    homeTeamId: snapshot.home.teamId,
    awayTeamId: snapshot.away.teamId,
    homePlayedBefore: snapshot.home.matchesPlayed,
    homeWinsBefore: snapshot.home.wins,
    homeGfBefore: snapshot.home.goalsFor,
    homeGaBefore: snapshot.home.goalsAgainst,
    awayPlayedBefore: snapshot.away.matchesPlayed,
    awayWinsBefore: snapshot.away.wins,
    awayGfBefore: snapshot.away.goalsFor,
    awayGaBefore: snapshot.away.goalsAgainst,
    evidenceAsOf: snapshot.evidenceAsOf,
  };
}
