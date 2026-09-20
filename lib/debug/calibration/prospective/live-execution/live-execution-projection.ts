/**
 * Project synthetic provider-shaped fixtures onto the minimum safe debug fields.
 * Extra raw fields are dropped and never persisted.
 */

import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import { toUtcIso } from "@/lib/debug/calibration/prospective/protocol/protocol-utc";
import type {
  ProjectedPriorFixture,
  ProjectedTargetFixture,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nested(value: unknown, key: string): Record<string, unknown> {
  return asRecord(asRecord(value)[key]);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function optionalFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function readKickoff(raw: Record<string, unknown>): string {
  const fixture = nested(raw, "fixture");
  const value = firstString(raw.kickoffUtc, raw.kickoff, raw.date, fixture.date);
  if (!value) {
    throw new ProspectiveIntegrityError("target kickoff is missing");
  }
  return toUtcIso(value, "kickoff");
}

function readStatus(raw: Record<string, unknown>): string {
  const fixture = nested(raw, "fixture");
  const status = nested(raw.status ?? fixture.status, "short");
  return firstString(
    raw.status,
    asRecord(raw.status).short,
    asRecord(fixture.status).short,
    status.short,
    "UNKNOWN",
  );
}

function projectIdentity(raw: unknown): Omit<ProjectedTargetFixture, "kickoffUtc" | "status"> & {
  kickoffUtc: string;
  status: string;
} {
  const record = asRecord(raw);
  const fixture = nested(record, "fixture");
  const league = nested(record, "league");
  const teams = nested(record, "teams");
  const home = nested(teams, "home");
  const away = nested(teams, "away");
  const fixtureId = firstString(record.fixtureId, record.id, fixture.id);
  const competitionId = firstString(record.competitionId, record.leagueId, league.id);
  const season = firstString(record.season, league.season);
  const homeTeamId = firstString(record.homeTeamId, home.id);
  const awayTeamId = firstString(record.awayTeamId, away.id);
  if (!fixtureId || !homeTeamId || !awayTeamId) {
    throw new ProspectiveIntegrityError("target fixture or team identifiers are missing");
  }
  return {
    fixtureId,
    competitionId,
    season,
    kickoffUtc: readKickoff(record),
    status: readStatus(record),
    homeTeamId,
    awayTeamId,
    homeTeamName: firstString(record.homeTeamName, home.name, "Home"),
    awayTeamName: firstString(record.awayTeamName, away.name, "Away"),
  };
}

export function projectTargetFixture(raw: unknown): ProjectedTargetFixture {
  const projected = projectIdentity(raw);
  return {
    fixtureId: projected.fixtureId,
    competitionId: projected.competitionId,
    season: projected.season,
    kickoffUtc: projected.kickoffUtc,
    status: projected.status,
    homeTeamId: projected.homeTeamId,
    awayTeamId: projected.awayTeamId,
    homeTeamName: projected.homeTeamName,
    awayTeamName: projected.awayTeamName,
  };
}

export function projectPriorFixture(raw: unknown): ProjectedPriorFixture | null {
  try {
    const projected = projectIdentity(raw);
    const record = asRecord(raw);
    const goals = nested(record, "goals");
    return {
      ...projected,
      homeGoals: optionalFiniteNumber(record.homeGoals ?? goals.home),
      awayGoals: optionalFiniteNumber(record.awayGoals ?? goals.away),
    };
  } catch {
    return null;
  }
}

export function projectPriorUniverse(rawFixtures: readonly unknown[]): ProjectedPriorFixture[] {
  const projected: ProjectedPriorFixture[] = [];
  for (const row of rawFixtures) {
    const prior = projectPriorFixture(row);
    if (prior) projected.push(prior);
  }
  return projected;
}
