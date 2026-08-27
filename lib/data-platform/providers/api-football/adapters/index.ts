/**
 * Adapters: API-Football vendor DTOs → Apex canonical model (Sprint 6).
 * Match bundle mapping stays in mapper.ts; this module covers entity-level shapes.
 */

import type {
  ApexLeague,
  ApexPlayer,
  ApexTeam,
  PlayerPosition,
} from "@/lib/data-platform/types/team";
import type {
  ApiFootballLeagueItem,
  ApiFootballPlayerDetails,
  ApiFootballTeamDetails,
  ApiFootballTeamStatistics,
} from "@/lib/data-platform/providers/api-football/types";

export {
  mapApiFootballEnvelopeToApexBundle,
  mapApiFootballFixtureItemToApexBundle,
  mapApiFootballStatus,
  isApiFootballFixturesPayload,
} from "@/lib/data-platform/providers/api-football/mapper";

function apexId(entity: string, externalId: string | number): string {
  return `apex:api-football:${entity}:${externalId}`;
}

function mapPosition(raw: string | null | undefined): PlayerPosition {
  if (!raw) return "unknown";
  const value = raw.toLowerCase();
  if (value.startsWith("g") || value.includes("goal")) return "goalkeeper";
  if (value.startsWith("d") || value.includes("defen")) return "defender";
  if (value.startsWith("m") || value.includes("mid")) return "midfielder";
  if (
    value.startsWith("f") ||
    value.startsWith("a") ||
    value.includes("forward") ||
    value.includes("attack")
  ) {
    return "forward";
  }
  return "unknown";
}

/** Team details → ApexTeam */
export function adaptApiFootballTeam(
  details: ApiFootballTeamDetails,
  leagueId: string | null = null,
): ApexTeam {
  return {
    id: apexId("team", details.team.id),
    leagueId,
    name: details.team.name,
    shortName: details.team.code ?? null,
    crestUrl: details.team.logo ?? null,
    externalRefs: [
      {
        provider: "api-football",
        externalId: String(details.team.id),
      },
    ],
  };
}

/** Player details → ApexPlayer */
export function adaptApiFootballPlayer(
  details: ApiFootballPlayerDetails,
): ApexPlayer {
  const stats = details.statistics?.[0];
  const teamId = stats?.team?.id
    ? apexId("team", stats.team.id)
    : null;
  return {
    id: apexId("player", details.player.id),
    teamId,
    name: details.player.name,
    shirtNumber: stats?.games?.number ?? null,
    position: mapPosition(stats?.games?.position),
    nationality: details.player.nationality ?? null,
    externalRefs: [
      {
        provider: "api-football",
        externalId: String(details.player.id),
      },
    ],
  };
}

/** League item → ApexLeague */
export function adaptApiFootballLeague(
  item: ApiFootballLeagueItem,
): ApexLeague {
  const current =
    item.seasons?.find((s) => s.current)?.year ??
    item.seasons?.[0]?.year ??
    null;
  return {
    id: apexId("league", item.league.id),
    name: item.league.name,
    country: item.country?.name ?? null,
    sport: "football",
    season: current != null ? String(current) : null,
    logoUrl: item.league.logo ?? null,
    externalRefs: [
      {
        provider: "api-football",
        externalId: String(item.league.id),
      },
    ],
  };
}

/** Normalized team statistics (Apex-facing, not vendor JSON). */
export type ApexTeamStatistics = {
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueName: string;
  season: string;
  form: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number | null;
  goalsAgainst: number | null;
};

export function adaptApiFootballTeamStatistics(
  stats: ApiFootballTeamStatistics | null | undefined,
): ApexTeamStatistics | null {
  if (
    stats?.team?.id == null ||
    stats.league?.id == null ||
    stats.fixtures?.played == null
  ) {
    return null;
  }
  return {
    teamId: apexId("team", stats.team.id),
    teamName: stats.team.name,
    leagueId: apexId("league", stats.league.id),
    leagueName: stats.league.name,
    season: String(stats.league.season),
    form: stats.form ?? null,
    played: stats.fixtures.played.total,
    wins: stats.fixtures.wins.total,
    draws: stats.fixtures.draws.total,
    losses: stats.fixtures.loses.total,
    goalsFor: stats.goals?.for?.total?.total ?? null,
    goalsAgainst: stats.goals?.against?.total?.total ?? null,
  };
}
