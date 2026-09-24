/**
 * PE-4F — Normalize API-Football fixture items into Pe4TeamScheduleFixture[].
 */

import { apexIdFor } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApiFootballFixtureItem } from "@/lib/data-platform/providers/api-football/types";
import { classifyPe4CompetitionLoad } from "@/lib/prematch-decision/pe4-form-schedule/schedule/competition-policy";
import type {
  Pe4TeamScheduleAcquisitionScope,
  Pe4TeamScheduleFixture,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/types";

const PROVIDER = "api-football" as const;

export type NormalizeTeamScheduleResult =
  | { ok: true; fixtures: Pe4TeamScheduleFixture[] }
  | {
      ok: false;
      reason:
        | "requested_team_absent_from_row"
        | "malformed_schedule_row"
        | "conflicting_duplicate_fixture";
      fixtureId?: string;
      message: string;
    };

function identityKey(row: Pe4TeamScheduleFixture): string {
  return [
    row.kickoffUtc,
    row.homeTeamId,
    row.awayTeamId,
    row.competitionId ?? "",
    row.season ?? "",
    row.status,
    row.homeGoals == null ? "" : String(row.homeGoals),
    row.awayGoals == null ? "" : String(row.awayGoals),
  ].join("|");
}

function compareFixtures(a: Pe4TeamScheduleFixture, b: Pe4TeamScheduleFixture): number {
  const kickoff = a.kickoffUtc.localeCompare(b.kickoffUtc);
  if (kickoff !== 0) return kickoff;
  return a.fixtureId.localeCompare(b.fixtureId);
}

function vendorTeamMatches(
  item: ApiFootballFixtureItem,
  vendorTeamId: string,
): boolean {
  const id = Number(vendorTeamId);
  return item.teams?.home?.id === id || item.teams?.away?.id === id;
}

function mapRow(input: {
  item: ApiFootballFixtureItem;
  vendorTeamId: string;
  targetCompetitionId: string;
  acquisitionScope: Pe4TeamScheduleAcquisitionScope;
}): Pe4TeamScheduleFixture | { error: "absent" | "malformed" } {
  const { item } = input;
  const fixtureId = String(item.fixture?.id ?? "");
  if (!/^[1-9]\d*$/.test(fixtureId)) return { error: "malformed" };
  if (!vendorTeamMatches(item, input.vendorTeamId)) return { error: "absent" };
  if (item.teams?.home?.id == null || item.teams?.away?.id == null) {
    return { error: "malformed" };
  }
  if (item.teams.home.id === item.teams.away.id) return { error: "malformed" };
  const status = item.fixture?.status?.short;
  if (!status) return { error: "malformed" };
  const kickoffMs = Date.parse(item.fixture.date);
  if (!Number.isFinite(kickoffMs)) return { error: "malformed" };
  const kickoffUtc = new Date(kickoffMs).toISOString();

  const vendorLeagueId =
    item.league?.id != null ? String(item.league.id) : null;
  const competitionId = vendorLeagueId
    ? apexIdFor(PROVIDER, "league", vendorLeagueId)
    : null;
  const season =
    item.league?.season != null ? String(item.league.season).trim() : null;

  const homeGoals =
    item.score?.fulltime?.home ?? item.goals?.home ?? null;
  const awayGoals =
    item.score?.fulltime?.away ?? item.goals?.away ?? null;

  return {
    fixtureId,
    kickoffUtc,
    status,
    homeTeamId: apexIdFor(PROVIDER, "team", String(item.teams.home.id)),
    awayTeamId: apexIdFor(PROVIDER, "team", String(item.teams.away.id)),
    competitionId,
    vendorLeagueId,
    season,
    homeGoals: homeGoals == null ? null : homeGoals,
    awayGoals: awayGoals == null ? null : awayGoals,
    acquisitionScope: input.acquisitionScope,
    loadClass: classifyPe4CompetitionLoad({
      rowCompetitionId: competitionId,
      targetCompetitionId: input.targetCompetitionId,
    }),
  };
}

/**
 * Normalize + dedupe provider rows for a requested vendor team.
 * Fail closed if any row omits the team or conflicts on fixtureId.
 */
export function normalizePe4TeamScheduleFixtures(input: {
  items: readonly ApiFootballFixtureItem[];
  vendorTeamId: string;
  targetCompetitionId: string;
  acquisitionScope: Pe4TeamScheduleAcquisitionScope;
}): NormalizeTeamScheduleResult {
  const mapped: Pe4TeamScheduleFixture[] = [];
  for (const item of input.items) {
    const row = mapRow({
      item,
      vendorTeamId: input.vendorTeamId,
      targetCompetitionId: input.targetCompetitionId,
      acquisitionScope: input.acquisitionScope,
    });
    if ("error" in row) {
      if (row.error === "absent") {
        return {
          ok: false,
          reason: "requested_team_absent_from_row",
          message: "Provider row does not contain requested team",
        };
      }
      return {
        ok: false,
        reason: "malformed_schedule_row",
        message: "Malformed schedule fixture row",
      };
    }
    mapped.push(row);
  }

  mapped.sort(compareFixtures);
  const byId = new Map<string, Pe4TeamScheduleFixture>();
  for (const row of mapped) {
    const existing = byId.get(row.fixtureId);
    if (!existing) {
      byId.set(row.fixtureId, row);
      continue;
    }
    if (identityKey(existing) !== identityKey(row)) {
      return {
        ok: false,
        reason: "conflicting_duplicate_fixture",
        fixtureId: row.fixtureId,
        message: `Conflicting duplicate schedule fixture ${row.fixtureId}`,
      };
    }
  }

  return { ok: true, fixtures: [...byId.values()].sort(compareFixtures) };
}
