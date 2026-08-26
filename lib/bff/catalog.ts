/**
 * BFF catalog — uses ProviderFactory; returns normalized DTOs.
 */

import {
  createDataProviderFromEnv,
  getDefaultMatchId,
  type ProviderFactoryOptions,
} from "@/lib/data-platform/provider-factory";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import type { IDataProvider } from "@/lib/data-platform/provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import { badRequest, notFound } from "@/lib/bff/errors";
import {
  eventsFromApiFootball,
  eventsFromBundle,
  fixtureFromBundle,
  leagueFromApiFootball,
  leagueFromBundle,
  lineupsFromApiFootball,
  lineupsFromBundle,
  playerFromApiFootball,
  playerFromBundle,
  standingsFromApiFootball,
  teamFromApiFootball,
  teamFromBundleSide,
  teamStatisticsFromApiFootball,
} from "@/lib/bff/normalize";
import type {
  BffEvent,
  BffFixtureSummary,
  BffLeague,
  BffLineup,
  BffPlayer,
  BffStandings,
  BffTeam,
  BffTeamStatistics,
} from "@/lib/bff/types";

export type BffCatalogOptions = {
  factory?: ProviderFactoryOptions;
  /** Inject provider (tests). */
  provider?: IDataProvider;
};

function resolveProvider(options: BffCatalogOptions = {}): IDataProvider {
  return options.provider ?? createDataProviderFromEnv(options.factory);
}

function asApiFootball(
  provider: IDataProvider,
): ApiFootballDataProvider | null {
  return provider instanceof ApiFootballDataProvider ? provider : null;
}

export type GetFixturesInput = {
  id?: string | null;
  date?: string | null;
  leagueId?: string | null;
  limit?: number | null;
};

export async function getFixtures(
  input: GetFixturesInput = {},
  options: BffCatalogOptions = {},
): Promise<{ items: BffFixtureSummary[]; provider: string }> {
  const provider = resolveProvider(options);

  if (input.id) {
    const bundle = await provider.getMatch({ matchId: input.id });
    return {
      items: [fixtureFromBundle(bundle)],
      provider: provider.id,
    };
  }

  if (!provider.listFixtures) {
    const bundle = await provider.getMatch({
      matchId: getDefaultMatchId(),
    });
    return {
      items: [fixtureFromBundle(bundle)],
      provider: provider.id,
    };
  }

  const bundles = await provider.listFixtures({
    date: input.date ?? undefined,
    leagueId: input.leagueId ?? undefined,
    limit: input.limit ?? undefined,
  });

  return {
    items: bundles.map(fixtureFromBundle),
    provider: provider.id,
  };
}

export async function getTeam(
  teamId: string,
  options: BffCatalogOptions = {},
): Promise<{ team: BffTeam; provider: string }> {
  if (!teamId) throw badRequest("Query param `id` is required");

  const provider = resolveProvider(options);
  const api = asApiFootball(provider);

  if (api) {
    const payload = await api.http.getTeam(teamId);
    const first = payload.response[0];
    if (!first) throw notFound(`Team not found: ${teamId}`);
    return { team: teamFromApiFootball(first), provider: provider.id };
  }

  const bundle = await provider.getMatch({
    matchId: DEMO_MATCH_EXTERNAL_ID,
  });
  if (
    bundle.homeTeam.id === teamId ||
    bundle.homeTeam.externalRefs[0]?.externalId === teamId
  ) {
    return { team: teamFromBundleSide(bundle, "home"), provider: provider.id };
  }
  if (
    bundle.awayTeam.id === teamId ||
    bundle.awayTeam.externalRefs[0]?.externalId === teamId
  ) {
    return { team: teamFromBundleSide(bundle, "away"), provider: provider.id };
  }

  throw notFound(`Team not found in mock catalogue: ${teamId}`);
}

export async function getStandings(
  input: { league?: string | null; season?: string | null },
  options: BffCatalogOptions = {},
): Promise<{ standings: BffStandings; provider: string }> {
  if (!input.league) throw badRequest("Query param `league` is required");
  if (!input.season) throw badRequest("Query param `season` is required");

  const provider = resolveProvider(options);
  const api = asApiFootball(provider);

  if (api) {
    const payload = await api.http.getStandings(input.league, input.season);
    const first = payload.response[0];
    if (!first) {
      throw notFound(
        `Standings not found for league=${input.league} season=${input.season}`,
      );
    }
    return {
      standings: standingsFromApiFootball(first),
      provider: provider.id,
    };
  }

  const bundle = await provider.getMatch({ matchId: DEMO_MATCH_EXTERNAL_ID });
  const standings: BffStandings = {
    leagueId: bundle.league?.id ?? "apex:mock:league:unknown",
    leagueName: bundle.league?.name ?? "Mock League",
    season: bundle.league?.season ?? String(input.season),
    table: [
      {
        rank: 1,
        team: { id: bundle.homeTeam.id, name: bundle.homeTeam.name },
        points: 3,
        played: 1,
        won: 1,
        drawn: 0,
        lost: 0,
        goalsFor: bundle.match.score.home,
        goalsAgainst: bundle.match.score.away,
        goalDiff:
          (bundle.match.score.home ?? 0) - (bundle.match.score.away ?? 0),
      },
      {
        rank: 2,
        team: { id: bundle.awayTeam.id, name: bundle.awayTeam.name },
        points: 0,
        played: 1,
        won: 0,
        drawn: 0,
        lost: 1,
        goalsFor: bundle.match.score.away,
        goalsAgainst: bundle.match.score.home,
        goalDiff:
          (bundle.match.score.away ?? 0) - (bundle.match.score.home ?? 0),
      },
    ],
  };

  return { standings, provider: provider.id };
}

export async function getEvents(
  fixtureId: string,
  options: BffCatalogOptions = {},
): Promise<{ events: BffEvent[]; provider: string }> {
  if (!fixtureId) throw badRequest("Query param `fixture` is required");

  const provider = resolveProvider(options);
  const api = asApiFootball(provider);

  if (api) {
    const payload = await api.http.getEvents(fixtureId);
    return {
      events: eventsFromApiFootball(fixtureId, payload.response ?? []),
      provider: provider.id,
    };
  }

  const bundle = await provider.getMatch({ matchId: fixtureId });
  return { events: eventsFromBundle(bundle), provider: provider.id };
}

export async function getLineups(
  fixtureId: string,
  options: BffCatalogOptions = {},
): Promise<{ lineups: BffLineup[]; provider: string }> {
  if (!fixtureId) throw badRequest("Query param `fixture` is required");

  const provider = resolveProvider(options);
  const api = asApiFootball(provider);

  if (api) {
    const payload = await api.http.getLineups(fixtureId);
    return {
      lineups: lineupsFromApiFootball(payload.response ?? []),
      provider: provider.id,
    };
  }

  const bundle = await provider.getMatch({ matchId: fixtureId });
  return { lineups: lineupsFromBundle(bundle), provider: provider.id };
}

export async function getPlayer(
  input: { id?: string | null; season?: string | null },
  options: BffCatalogOptions = {},
): Promise<{ player: BffPlayer; provider: string }> {
  if (!input.id) throw badRequest("Query param `id` is required");

  const provider = resolveProvider(options);
  const api = asApiFootball(provider);

  if (api) {
    const season = input.season ?? "2023";
    const payload = await api.http.getPlayer(input.id, season);
    const first = payload.response[0];
    if (!first) throw notFound(`Player not found: ${input.id}`);
    return { player: playerFromApiFootball(first), provider: provider.id };
  }

  const bundle = await provider.getMatch({
    matchId: DEMO_MATCH_EXTERNAL_ID,
  });
  const fromBundle = playerFromBundle(bundle, input.id);
  if (fromBundle) {
    return { player: fromBundle, provider: provider.id };
  }

  throw notFound(`Player not found in mock catalogue: ${input.id}`);
}

export async function getLeague(
  leagueId: string,
  options: BffCatalogOptions = {},
): Promise<{ league: BffLeague; provider: string }> {
  if (!leagueId) throw badRequest("Query param `id` is required");

  const provider = resolveProvider(options);
  const api = asApiFootball(provider);

  if (api) {
    const payload = await api.http.getLeague(leagueId);
    const first = payload.response[0];
    if (!first) throw notFound(`League not found: ${leagueId}`);
    return { league: leagueFromApiFootball(first), provider: provider.id };
  }

  const bundle = await provider.getMatch({
    matchId: DEMO_MATCH_EXTERNAL_ID,
  });
  const league = leagueFromBundle(bundle);
  if (
    league &&
    (league.id === leagueId || league.externalId === leagueId)
  ) {
    return { league, provider: provider.id };
  }

  throw notFound(`League not found in mock catalogue: ${leagueId}`);
}

export async function getTeamStatistics(
  input: {
    team?: string | null;
    league?: string | null;
    season?: string | null;
  },
  options: BffCatalogOptions = {},
): Promise<{ statistics: BffTeamStatistics; provider: string }> {
  if (!input.team) throw badRequest("Query param `team` is required");
  if (!input.league) throw badRequest("Query param `league` is required");
  if (!input.season) throw badRequest("Query param `season` is required");

  const provider = resolveProvider(options);
  const api = asApiFootball(provider);

  if (api) {
    const payload = await api.http.getTeamStatistics(
      input.team,
      input.league,
      input.season,
    );
    if (!payload.response) {
      throw notFound(
        `Team statistics not found for team=${input.team} league=${input.league} season=${input.season}`,
      );
    }
    return {
      statistics: teamStatisticsFromApiFootball(payload.response),
      provider: provider.id,
    };
  }

  const bundle = await provider.getMatch({ matchId: DEMO_MATCH_EXTERNAL_ID });
  const isHome =
    bundle.homeTeam.id === input.team ||
    bundle.homeTeam.externalRefs[0]?.externalId === input.team;
  const team = isHome ? bundle.homeTeam : bundle.awayTeam;
  const statistics: BffTeamStatistics = {
    teamId: team.id,
    teamName: team.name,
    leagueId: bundle.league?.id ?? `apex:mock:league:${input.league}`,
    leagueName: bundle.league?.name ?? "Mock League",
    season: String(input.season),
    form: "WDL",
    played: 1,
    wins: isHome ? 1 : 0,
    draws: 0,
    losses: isHome ? 0 : 1,
    goalsFor: isHome ? bundle.match.score.home : bundle.match.score.away,
    goalsAgainst: isHome ? bundle.match.score.away : bundle.match.score.home,
  };

  return { statistics, provider: provider.id };
}
