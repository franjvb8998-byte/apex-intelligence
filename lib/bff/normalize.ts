/**
 * Normalize Apex / vendor payloads into stable BFF DTOs.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type {
  ApiFootballEvent,
  ApiFootballLeagueItem,
  ApiFootballLineup,
  ApiFootballPlayerDetails,
  ApiFootballStandingLeague,
  ApiFootballTeamDetails,
  ApiFootballTeamStatistics,
} from "@/lib/data-platform/providers/api-football/types";
import type {
  BffEvent,
  BffFixtureSummary,
  BffLeague,
  BffLineup,
  BffPlayer,
  BffStandingRow,
  BffStandings,
  BffTeam,
  BffTeamStatistics,
} from "@/lib/bff/types";
import { adaptApiFootballTeamStatistics } from "@/lib/data-platform/providers/api-football/adapters";

export function fixtureFromBundle(bundle: ApexMatchBundle): BffFixtureSummary {
  const externalId = bundle.match.externalRefs[0]?.externalId ?? null;
  return {
    id: bundle.match.id,
    externalId,
    leagueName: bundle.league?.name ?? null,
    kickoffAt: bundle.match.kickoffAt,
    status: bundle.match.status,
    homeTeam: {
      id: bundle.homeTeam.id,
      name: bundle.homeTeam.name,
      shortName: bundle.homeTeam.shortName,
    },
    awayTeam: {
      id: bundle.awayTeam.id,
      name: bundle.awayTeam.name,
      shortName: bundle.awayTeam.shortName,
    },
    score: {
      home: bundle.match.score.home,
      away: bundle.match.score.away,
    },
    minute: bundle.match.minute,
  };
}

export function teamFromBundleSide(
  bundle: ApexMatchBundle,
  side: "home" | "away",
): BffTeam {
  const team = side === "home" ? bundle.homeTeam : bundle.awayTeam;
  return {
    id: team.id,
    externalId: team.externalRefs[0]?.externalId ?? null,
    name: team.name,
    shortName: team.shortName,
    crestUrl: team.crestUrl,
    country: bundle.league?.country ?? null,
  };
}

export function teamFromApiFootball(details: ApiFootballTeamDetails): BffTeam {
  return {
    id: `apex:api-football:team:${details.team.id}`,
    externalId: String(details.team.id),
    name: details.team.name,
    shortName: details.team.code ?? null,
    crestUrl: details.team.logo ?? null,
    country: details.team.country ?? null,
  };
}

export function standingsFromApiFootball(
  row: ApiFootballStandingLeague,
): BffStandings {
  const flat = row.league.standings.flat();
  const table: BffStandingRow[] = flat.map((item) => ({
    rank: item.rank,
    team: {
      id: `apex:api-football:team:${item.team.id}`,
      name: item.team.name,
    },
    points: item.points,
    played: item.all?.played ?? null,
    won: item.all?.win ?? null,
    drawn: item.all?.draw ?? null,
    lost: item.all?.lose ?? null,
    goalsFor: item.all?.goals.for ?? null,
    goalsAgainst: item.all?.goals.against ?? null,
    goalDiff: item.goalsDiff ?? null,
  }));

  return {
    leagueId: `apex:api-football:league:${row.league.id}`,
    leagueName: row.league.name,
    season: String(row.league.season),
    table,
  };
}

export function eventsFromBundle(bundle: ApexMatchBundle): BffEvent[] {
  return bundle.events.map((event) => ({
    id: event.id,
    fixtureId: bundle.match.id,
    minute: event.minute,
    type: event.type,
    teamId: event.teamId,
    playerName:
      typeof event.payload.playerName === "string"
        ? event.payload.playerName
        : null,
    detail:
      typeof event.payload.detail === "string" ? event.payload.detail : null,
  }));
}

export function eventsFromApiFootball(
  fixtureId: string,
  events: ApiFootballEvent[],
): BffEvent[] {
  return events.map((event, index) => ({
    id: `apex:api-football:event:${fixtureId}:${index}`,
    fixtureId: `apex:api-football:match:${fixtureId}`,
    minute: event.time.elapsed,
    type: event.type,
    teamId: event.team.id
      ? `apex:api-football:team:${event.team.id}`
      : null,
    playerName: event.player.name ?? null,
    detail: event.detail ?? null,
  }));
}

export function lineupsFromApiFootball(
  lineups: ApiFootballLineup[],
): BffLineup[] {
  return lineups.map((lineup) => ({
    teamId: `apex:api-football:team:${lineup.team.id}`,
    teamName: lineup.team.name,
    formation: lineup.formation ?? null,
    startXI: (lineup.startXI ?? []).map((row) => ({
      id: `apex:api-football:player:${row.player.id}`,
      name: row.player.name,
      number: row.player.number ?? null,
      position: row.player.pos ?? null,
    })),
    substitutes: (lineup.substitutes ?? []).map((row) => ({
      id: `apex:api-football:player:${row.player.id}`,
      name: row.player.name,
      number: row.player.number ?? null,
      position: row.player.pos ?? null,
    })),
  }));
}

export function lineupsFromBundle(bundle: ApexMatchBundle): BffLineup[] {
  const byTeam = new Map<string, BffLineup>();

  for (const player of bundle.players) {
    const teamId = player.teamId ?? "unknown";
    const teamName =
      teamId === bundle.homeTeam.id
        ? bundle.homeTeam.name
        : teamId === bundle.awayTeam.id
          ? bundle.awayTeam.name
          : teamId;

    const entry =
      byTeam.get(teamId) ??
      ({
        teamId,
        teamName,
        formation: null,
        startXI: [],
        substitutes: [],
      } satisfies BffLineup);

    entry.startXI.push({
      id: player.id,
      name: player.name,
      number: player.shirtNumber,
      position: player.position,
    });
    byTeam.set(teamId, entry);
  }

  return [...byTeam.values()];
}

export function playerFromApiFootball(
  details: ApiFootballPlayerDetails,
): BffPlayer {
  const stats = details.statistics?.[0];
  return {
    id: `apex:api-football:player:${details.player.id}`,
    externalId: String(details.player.id),
    name: details.player.name,
    nationality: details.player.nationality ?? null,
    photoUrl: details.player.photo ?? null,
    teamId: stats?.team?.id
      ? `apex:api-football:team:${stats.team.id}`
      : null,
    teamName: stats?.team?.name ?? null,
    position: stats?.games?.position ?? null,
    shirtNumber: stats?.games?.number ?? null,
    age: details.player.age ?? null,
  };
}

export function leagueFromApiFootball(item: ApiFootballLeagueItem): BffLeague {
  const current =
    item.seasons?.find((s) => s.current)?.year ??
    item.seasons?.[0]?.year ??
    null;
  return {
    id: `apex:api-football:league:${item.league.id}`,
    externalId: String(item.league.id),
    name: item.league.name,
    country: item.country?.name ?? null,
    logoUrl: item.league.logo ?? null,
    type: item.league.type ?? null,
    currentSeason: current != null ? String(current) : null,
  };
}

export function teamStatisticsFromApiFootball(
  stats: ApiFootballTeamStatistics,
): BffTeamStatistics | null {
  const adapted = adaptApiFootballTeamStatistics(stats);
  if (!adapted) return null;
  return {
    teamId: adapted.teamId,
    teamName: adapted.teamName,
    leagueId: adapted.leagueId,
    leagueName: adapted.leagueName,
    season: adapted.season,
    form: adapted.form,
    played: adapted.played,
    wins: adapted.wins,
    draws: adapted.draws,
    losses: adapted.losses,
    goalsFor: adapted.goalsFor,
    goalsAgainst: adapted.goalsAgainst,
  };
}

export function playerFromBundle(
  bundle: ApexMatchBundle,
  playerId: string,
): BffPlayer | null {
  const player = bundle.players.find(
    (p) =>
      p.id === playerId ||
      p.externalRefs.some((ref) => ref.externalId === playerId),
  );
  if (!player) return null;
  const teamName =
    player.teamId === bundle.homeTeam.id
      ? bundle.homeTeam.name
      : player.teamId === bundle.awayTeam.id
        ? bundle.awayTeam.name
        : null;
  return {
    id: player.id,
    externalId: player.externalRefs[0]?.externalId ?? null,
    name: player.name,
    nationality: player.nationality,
    photoUrl: null,
    teamId: player.teamId,
    teamName,
    position: player.position,
    shirtNumber: player.shirtNumber,
    age: null,
  };
}

export function leagueFromBundle(bundle: ApexMatchBundle): BffLeague | null {
  if (!bundle.league) return null;
  return {
    id: bundle.league.id,
    externalId: bundle.league.externalRefs[0]?.externalId ?? null,
    name: bundle.league.name,
    country: bundle.league.country,
    logoUrl: null,
    type: "League",
    currentSeason: bundle.league.season,
  };
}
