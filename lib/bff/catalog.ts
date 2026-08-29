/**
 * BFF catalog — uses ProviderFactory; returns normalized DTOs.
 */

import {
  createDataProviderFromEnv,
  getDefaultMatchId,
  type ProviderFactoryOptions,
} from "@/lib/data-platform/provider-factory";
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
import { createRepositories, type ApexRepositories } from "@/lib/repositories";

export type BffCatalogOptions = {
  factory?: ProviderFactoryOptions;
  /** Inject provider (tests). */
  provider?: IDataProvider;
};

function resolveProvider(options: BffCatalogOptions = {}): IDataProvider {
  return options.provider ?? createDataProviderFromEnv(options.factory);
}

function repositoriesFor(options: BffCatalogOptions = {}): ApexRepositories {
  return createRepositories({ provider: resolveProvider(options) });
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
  const repos = repositoriesFor(options);

  if (input.id) {
    const bundle = await repos.fixtures.getById(input.id);
    return {
      items: [fixtureFromBundle(bundle)],
      provider: repos.providerId,
    };
  }

  const bundles = await repos.fixtures.list({
    date: input.date ?? undefined,
    leagueId: input.leagueId ?? undefined,
    limit: input.limit ?? undefined,
  });

  if (bundles.length > 0) {
    return {
      items: bundles.map(fixtureFromBundle),
      provider: repos.providerId,
    };
  }

  const provider = resolveProvider(options);
  if (!provider.listFixtures) {
    const bundle = await repos.fixtures.getById(getDefaultMatchId());
    return {
      items: [fixtureFromBundle(bundle)],
      provider: repos.providerId,
    };
  }

  return {
    items: [],
    provider: repos.providerId,
  };
}

export async function getTeam(
  teamId: string,
  options: BffCatalogOptions = {},
): Promise<{ team: BffTeam; provider: string }> {
  if (!teamId) throw badRequest("Query param `id` is required");

  const repos = repositoriesFor(options);
  const details = await repos.teams.getDetails(teamId);
  if (details) {
    return { team: teamFromApiFootball(details), provider: repos.providerId };
  }

  const bundle = await repos.fixtures.getById(DEMO_MATCH_EXTERNAL_ID);
  if (
    bundle.homeTeam.id === teamId ||
    bundle.homeTeam.externalRefs[0]?.externalId === teamId
  ) {
    return {
      team: teamFromBundleSide(bundle, "home"),
      provider: repos.providerId,
    };
  }
  if (
    bundle.awayTeam.id === teamId ||
    bundle.awayTeam.externalRefs[0]?.externalId === teamId
  ) {
    return {
      team: teamFromBundleSide(bundle, "away"),
      provider: repos.providerId,
    };
  }

  throw notFound(`Team not found in mock catalogue: ${teamId}`);
}

export async function getStandings(
  input: { league?: string | null; season?: string | null },
  options: BffCatalogOptions = {},
): Promise<{ standings: BffStandings; provider: string }> {
  if (!input.league) throw badRequest("Query param `league` is required");
  if (!input.season) throw badRequest("Query param `season` is required");

  const repos = repositoriesFor(options);
  const payload = await repos.standings.getTable(input.league, input.season);
  const first = payload?.response[0];
  if (first) {
    return {
      standings: standingsFromApiFootball(first),
      provider: repos.providerId,
    };
  }
  if (payload && repos.hasResourcePort) {
    throw notFound(
      `Standings not found for league=${input.league} season=${input.season}`,
    );
  }

  const bundle = await repos.fixtures.getById(DEMO_MATCH_EXTERNAL_ID);
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

  return { standings, provider: repos.providerId };
}

export async function getEvents(
  fixtureId: string,
  options: BffCatalogOptions = {},
): Promise<{ events: BffEvent[]; provider: string }> {
  if (!fixtureId) throw badRequest("Query param `fixture` is required");

  const repos = repositoriesFor(options);
  const payload = await repos.fixtures.getEvents(fixtureId);
  if (payload) {
    return {
      events: eventsFromApiFootball(fixtureId, payload.response ?? []),
      provider: repos.providerId,
    };
  }

  const bundle = await repos.fixtures.getById(fixtureId);
  return { events: eventsFromBundle(bundle), provider: repos.providerId };
}

export async function getLineups(
  fixtureId: string,
  options: BffCatalogOptions = {},
): Promise<{ lineups: BffLineup[]; provider: string }> {
  if (!fixtureId) throw badRequest("Query param `fixture` is required");

  const repos = repositoriesFor(options);
  const payload = await repos.fixtures.getLineups(fixtureId);
  if (payload) {
    return {
      lineups: lineupsFromApiFootball(payload.response ?? []),
      provider: repos.providerId,
    };
  }

  const bundle = await repos.fixtures.getById(fixtureId);
  return { lineups: lineupsFromBundle(bundle), provider: repos.providerId };
}

export async function getPlayer(
  input: { id?: string | null; season?: string | null },
  options: BffCatalogOptions = {},
): Promise<{ player: BffPlayer; provider: string }> {
  if (!input.id) throw badRequest("Query param `id` is required");

  const repos = repositoriesFor(options);
  const season = input.season ?? "2023";
  const payload = await repos.teams.getPlayer(input.id, season);
  const first = payload?.response[0];
  if (first) {
    return { player: playerFromApiFootball(first), provider: repos.providerId };
  }
  if (payload && repos.hasResourcePort) {
    throw notFound(`Player not found: ${input.id}`);
  }

  const bundle = await repos.fixtures.getById(DEMO_MATCH_EXTERNAL_ID);
  const fromBundle = playerFromBundle(bundle, input.id);
  if (fromBundle) {
    return { player: fromBundle, provider: repos.providerId };
  }

  throw notFound(`Player not found in mock catalogue: ${input.id}`);
}

export async function getLeague(
  leagueId: string,
  options: BffCatalogOptions = {},
): Promise<{ league: BffLeague; provider: string }> {
  if (!leagueId) throw badRequest("Query param `id` is required");

  const repos = repositoriesFor(options);
  const payload = await repos.teams.getLeague(leagueId);
  const first = payload?.response[0];
  if (first) {
    return { league: leagueFromApiFootball(first), provider: repos.providerId };
  }
  if (payload && repos.hasResourcePort) {
    throw notFound(`League not found: ${leagueId}`);
  }

  const bundle = await repos.fixtures.getById(DEMO_MATCH_EXTERNAL_ID);
  const league = leagueFromBundle(bundle);
  if (
    league &&
    (league.id === leagueId || league.externalId === leagueId)
  ) {
    return { league, provider: repos.providerId };
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

  const repos = repositoriesFor(options);
  const payload = await repos.statistics.getTeamStatistics(
    input.team,
    input.league,
    input.season,
  );
  if (payload?.response) {
    const statistics = teamStatisticsFromApiFootball(payload.response);
    if (!statistics) {
      throw notFound(
        `Team statistics not found for team=${input.team} league=${input.league} season=${input.season}`,
      );
    }
    return {
      statistics,
      provider: repos.providerId,
    };
  }
  if (payload && repos.hasResourcePort) {
    throw notFound(
      `Team statistics not found for team=${input.team} league=${input.league} season=${input.season}`,
    );
  }

  const bundle = await repos.fixtures.getById(DEMO_MATCH_EXTERNAL_ID);
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

  return { statistics, provider: repos.providerId };
}
