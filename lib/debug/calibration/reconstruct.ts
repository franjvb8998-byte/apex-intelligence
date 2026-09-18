/**
 * Point-in-time pre-match record reconstruction.
 * Scope: same competition + same season, kickoff strictly before T.
 * Does not call API-Football.
 */

import {
  CALIBRATION_RECONSTRUCTION_VERSION,
  CALIBRATION_SCHEMA_VERSION,
  type CalibrationOutcome,
  type CalibrationRow,
  type ReconstructionFixture,
  type TeamRecordBefore,
} from "@/lib/debug/calibration/types";

/** Statuses that count as completed 90-minute (plus ET) football. */
export const COUNTABLE_STATUSES = new Set(["FT", "AET", "PEN"]);

const EXCLUDED_STATUSES = new Set([
  "PST",
  "CANC",
  "ABD",
  "AWD",
  "WO",
  "NS",
  "TBD",
  "SUSP",
  "INT",
]);

export type FixtureCalibrationRole = {
  status: string;
  contributeToPrior: boolean;
  eligibleTarget: boolean;
  canProvideOutcomeLabel: boolean;
};

export function fixtureCalibrationRole(status: string): FixtureCalibrationRole {
  const countable = COUNTABLE_STATUSES.has(status);
  return {
    status,
    contributeToPrior: countable,
    eligibleTarget: countable,
    canProvideOutcomeLabel: countable,
  };
}

export function countableGoals(
  fixture: ReconstructionFixture,
): { home: number; away: number } | null {
  if (EXCLUDED_STATUSES.has(fixture.status)) return null;
  if (!COUNTABLE_STATUSES.has(fixture.status)) return null;

  if (fixture.status === "PEN") {
    if (fixture.fulltimeHome != null && fixture.fulltimeAway != null) {
      return { home: fixture.fulltimeHome, away: fixture.fulltimeAway };
    }
  }

  if (fixture.goalsHome == null || fixture.goalsAway == null) return null;
  return { home: fixture.goalsHome, away: fixture.goalsAway };
}

function kickoffMs(value: string): number {
  return Date.parse(value);
}

export function compareFixturesDeterministically(
  a: ReconstructionFixture,
  b: ReconstructionFixture,
): number {
  const delta = kickoffMs(a.kickoff) - kickoffMs(b.kickoff);
  if (delta !== 0) return delta;
  return a.fixtureId.localeCompare(b.fixtureId);
}

function reconstructionSignature(fixture: ReconstructionFixture): string {
  return [
    fixture.kickoff,
    fixture.competitionId,
    fixture.season,
    fixture.homeTeamId,
    fixture.awayTeamId,
    fixture.status,
    String(fixture.goalsHome),
    String(fixture.goalsAway),
    String(fixture.fulltimeHome),
    String(fixture.fulltimeAway),
  ].join("|");
}

export function dedupeReconstructionFixtures(
  fixtures: readonly ReconstructionFixture[],
): {
  fixtures: ReconstructionFixture[];
  beforeCount: number;
  afterCount: number;
} {
  const byId = new Map<string, ReconstructionFixture>();
  for (const fixture of fixtures) {
    const existing = byId.get(fixture.fixtureId);
    if (!existing) {
      byId.set(fixture.fixtureId, fixture);
      continue;
    }
    if (reconstructionSignature(existing) !== reconstructionSignature(fixture)) {
      throw new Error(
        `Conflicting duplicate fixture ${fixture.fixtureId} in calibration source`,
      );
    }
  }
  const deduped = [...byId.values()].sort(compareFixturesDeterministically);
  return {
    fixtures: deduped,
    beforeCount: fixtures.length,
    afterCount: deduped.length,
  };
}

export function reconstructTeamRecord(input: {
  teamId: string;
  kickoff: string;
  competitionId: string;
  season: string;
  fixtures: readonly ReconstructionFixture[];
}): TeamRecordBefore {
  const source = dedupeReconstructionFixtures(input.fixtures).fixtures;
  const t = kickoffMs(input.kickoff);
  let played = 0;
  let wins = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const fixture of source) {
    if (fixture.competitionId !== input.competitionId) continue;
    if (fixture.season !== input.season) continue;
    if (kickoffMs(fixture.kickoff) >= t) continue;
    const isHome = fixture.homeTeamId === input.teamId;
    const isAway = fixture.awayTeamId === input.teamId;
    if (!isHome && !isAway) continue;
    const goals = countableGoals(fixture);
    if (!goals) continue;

    const forGoals = isHome ? goals.home : goals.away;
    const againstGoals = isHome ? goals.away : goals.home;
    played += 1;
    goalsFor += forGoals;
    goalsAgainst += againstGoals;
    if (forGoals > againstGoals) wins += 1;
  }

  return { played, wins, goalsFor, goalsAgainst };
}

export function outcomeFromScore(
  home: number,
  away: number,
): CalibrationOutcome {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function evidenceBucket(playedMin: number): "0" | "1-3" | "4-9" | "10+" {
  if (playedMin <= 0) return "0";
  if (playedMin <= 3) return "1-3";
  if (playedMin <= 9) return "4-9";
  return "10+";
}

export function rowEvidenceBucket(row: CalibrationRow): "0" | "1-3" | "4-9" | "10+" {
  return evidenceBucket(
    Math.min(row.homePlayedBefore, row.awayPlayedBefore),
  );
}

export function eligibleTargetGoals(
  target: ReconstructionFixture,
): { home: number; away: number } | null {
  if (!fixtureCalibrationRole(target.status).eligibleTarget) return null;
  return countableGoals(target);
}

export function buildCalibrationRow(input: {
  target: ReconstructionFixture;
  fixtures: readonly ReconstructionFixture[];
  category?: CalibrationRow["category"];
  odds?: Partial<
    Pick<
      CalibrationRow,
      | "bookmaker"
      | "homeOdds"
      | "drawOdds"
      | "awayOdds"
      | "oddsObservedAt"
      | "oddsTiming"
    >
  >;
}): CalibrationRow {
  const { target, fixtures } = input;
  const home = reconstructTeamRecord({
    teamId: target.homeTeamId,
    kickoff: target.kickoff,
    competitionId: target.competitionId,
    season: target.season,
    fixtures,
  });
  const away = reconstructTeamRecord({
    teamId: target.awayTeamId,
    kickoff: target.kickoff,
    competitionId: target.competitionId,
    season: target.season,
    fixtures,
  });
  const resultGoals = eligibleTargetGoals(target);
  const actualHomeGoals = resultGoals?.home ?? null;
  const actualAwayGoals = resultGoals?.away ?? null;
  const actualOutcome =
    actualHomeGoals != null && actualAwayGoals != null
      ? outcomeFromScore(actualHomeGoals, actualAwayGoals)
      : null;

  return {
    schemaVersion: CALIBRATION_SCHEMA_VERSION,
    reconstructionVersion: CALIBRATION_RECONSTRUCTION_VERSION,
    fixtureId: target.fixtureId,
    kickoff: target.kickoff,
    competitionId: target.competitionId,
    competitionName: target.competitionName ?? target.competitionId,
    season: target.season,
    category: input.category ?? "other",
    homeTeamId: target.homeTeamId,
    homeTeamName: target.homeTeamName ?? target.homeTeamId,
    awayTeamId: target.awayTeamId,
    awayTeamName: target.awayTeamName ?? target.awayTeamId,
    homePlayedBefore: home.played,
    homeWinsBefore: home.wins,
    homeGfBefore: home.goalsFor,
    homeGaBefore: home.goalsAgainst,
    awayPlayedBefore: away.played,
    awayWinsBefore: away.wins,
    awayGfBefore: away.goalsFor,
    awayGaBefore: away.goalsAgainst,
    actualHomeGoals,
    actualAwayGoals,
    actualOutcome,
    bookmaker: input.odds?.bookmaker ?? null,
    market: input.odds?.homeOdds != null ? "1x2" : null,
    homeOdds: input.odds?.homeOdds ?? null,
    drawOdds: input.odds?.drawOdds ?? null,
    awayOdds: input.odds?.awayOdds ?? null,
    oddsObservedAt: input.odds?.oddsObservedAt ?? null,
    oddsTiming: input.odds?.oddsTiming ?? "unknown",
  };
}
