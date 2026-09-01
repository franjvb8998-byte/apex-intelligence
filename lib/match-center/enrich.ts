/**
 * Optional Match Center extras from the live data layer.
 * Only calls provider endpoints that already exist — never invents stats/H2H/injuries.
 */

import { lineupsCarriedOnBundle } from "@/lib/data-platform/providers/api-football/carried-lineups";
import { adaptApiFootballTeamStatistics } from "@/lib/data-platform/providers/api-football/adapters";
import type { IDataProvider } from "@/lib/data-platform/provider";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  createRepositories,
  isRepositories,
  type ApexRepositories,
} from "@/lib/repositories";
import type {
  MatchAnalysisInjury,
  MatchAnalysisTeamStatSnapshot,
  MatchAnalysisTeamStats,
  MatchAnalysisVenueSplit,
} from "@/lib/match-analysis/analysis-types";
import {
  absencesFromInjuries,
  h2hFromFixtures,
  lineupsFromVendor,
  recentMatchesFromFixtures,
} from "@/lib/match-center/team-context";
import {
  mergeTeamTrends,
  parseStatAverage,
  standingFromTable,
} from "@/lib/match-center/prematch";
import type {
  MatchCenterAbsence,
  MatchCenterH2HMeeting,
  MatchCenterLineup,
  MatchCenterRecentMatch,
  MatchCenterStanding,
  MatchCenterTeamTrends,
} from "@/lib/match-center/types";

export type MatchCenterEnrichment = {
  teamStats?: MatchAnalysisTeamStats;
  h2h: MatchCenterH2HMeeting[];
  injuries: MatchCenterAbsence[];
  suspensions: MatchCenterAbsence[];
  recent: {
    home: MatchCenterRecentMatch[];
    away: MatchCenterRecentMatch[];
  };
  lineups: {
    home: MatchCenterLineup | null;
    away: MatchCenterLineup | null;
  };
  standings: {
    home: MatchCenterStanding | null;
    away: MatchCenterStanding | null;
  };
  trends: {
    home: MatchCenterTeamTrends | null;
    away: MatchCenterTeamTrends | null;
  };
};

export const EMPTY_MATCH_CENTER_ENRICHMENT: MatchCenterEnrichment = {
  h2h: [],
  injuries: [],
  suspensions: [],
  recent: { home: [], away: [] },
  lineups: { home: null, away: null },
  standings: { home: null, away: null },
  trends: { home: null, away: null },
};

export function absencesToAnalysisInjuries(
  absences: MatchCenterAbsence[],
): MatchAnalysisInjury[] {
  return absences.map(({ id, playerName, teamId, detail }) => ({
    id,
    playerName,
    teamId,
    detail,
  }));
}

function externalId(
  refs: Array<{ externalId: string }> | undefined,
): string | null {
  return refs?.[0]?.externalId ?? null;
}

function seasonYear(season: string | null | undefined): string | null {
  if (!season) return null;
  const match = season.match(/^(\d{4})/);
  return match?.[1] ?? season;
}

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

function venueSplitFromTotals(
  played?: number,
  wins?: number,
  draws?: number,
  losses?: number,
  goalsFor?: number,
  goalsAgainst?: number,
): MatchAnalysisVenueSplit | null {
  if (played == null && wins == null && draws == null && losses == null) {
    return null;
  }
  return {
    played: played ?? 0,
    wins: wins ?? 0,
    draws: draws ?? 0,
    losses: losses ?? 0,
    goalsFor: goalsFor ?? null,
    goalsAgainst: goalsAgainst ?? null,
  };
}

function snapshotFromTeamStatistics(
  payload: { response?: unknown } | null,
): MatchAnalysisTeamStatSnapshot | undefined {
  const stats = payload?.response;
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    return undefined;
  }
  const record = stats as {
    team?: { id?: unknown; name?: string };
    fixtures?: unknown;
  };
  if (record.team?.id == null || record.fixtures == null) return undefined;
  try {
    const adapted = adaptApiFootballTeamStatistics(
      stats as Parameters<typeof adaptApiFootballTeamStatistics>[0],
    );
    if (!adapted) return undefined;
    const fixtures = stats as {
      fixtures?: {
        played?: { home?: number; away?: number };
        wins?: { home?: number; away?: number };
        draws?: { home?: number; away?: number };
        loses?: { home?: number; away?: number };
      };
      goals?: {
        for?: {
          total?: { home?: number; away?: number };
          average?: { total?: unknown };
        };
        against?: {
          total?: { home?: number; away?: number };
          average?: { total?: unknown };
        };
      };
      clean_sheet?: { total?: number };
      failed_to_score?: { total?: number };
    };
    return {
      form: adapted.form,
      wins: adapted.wins,
      draws: adapted.draws,
      losses: adapted.losses,
      goalsFor: adapted.goalsFor,
      goalsAgainst: adapted.goalsAgainst,
      goalsForAverage: parseStatAverage(fixtures.goals?.for?.average?.total),
      goalsAgainstAverage: parseStatAverage(
        fixtures.goals?.against?.average?.total,
      ),
      cleanSheets: fixtures.clean_sheet?.total ?? null,
      failedToScore: fixtures.failed_to_score?.total ?? null,
      played: adapted.played,
      teamName: adapted.teamName,
      homeSplit: venueSplitFromTotals(
        fixtures.fixtures?.played?.home,
        fixtures.fixtures?.wins?.home,
        fixtures.fixtures?.draws?.home,
        fixtures.fixtures?.loses?.home,
        fixtures.goals?.for?.total?.home,
        fixtures.goals?.against?.total?.home,
      ),
      awaySplit: venueSplitFromTotals(
        fixtures.fixtures?.played?.away,
        fixtures.fixtures?.wins?.away,
        fixtures.fixtures?.draws?.away,
        fixtures.fixtures?.loses?.away,
        fixtures.goals?.for?.total?.away,
        fixtures.goals?.against?.total?.away,
      ),
    };
  } catch {
    return undefined;
  }
}

function toRepositories(
  access: IDataProvider | ApexRepositories,
): ApexRepositories {
  return isRepositories(access)
    ? access
    : createRepositories({ provider: access });
}

/**
 * Pull team statistics, last-5 form, H2H, standings, injuries, suspensions
 * and lineups when the configured provider exposes them.
 */
export async function enrichMatchCenterContext(
  access: IDataProvider | ApexRepositories,
  bundle: ApexMatchBundle,
): Promise<MatchCenterEnrichment> {
  const repos = toRepositories(access);
  if (!repos.hasResourcePort) {
    return { ...EMPTY_MATCH_CENTER_ENRICHMENT };
  }

  const homeId = externalId(bundle.homeTeam.externalRefs);
  const awayId = externalId(bundle.awayTeam.externalRefs);
  const leagueId = externalId(bundle.league?.externalRefs);
  const season = seasonYear(bundle.league?.season);
  const fixtureId = externalId(bundle.match.externalRefs);

  const carriedLineups = lineupsCarriedOnBundle(bundle);

  const [
    homeStats,
    awayStats,
    h2hPayload,
    injuriesPayload,
    homeRecentPayload,
    awayRecentPayload,
    lineupsPayload,
    standingsPayload,
  ] = await Promise.all([
    homeId && leagueId && season
      ? safe(
          () => repos.statistics.getTeamStatistics(homeId, leagueId, season),
          null,
        )
      : Promise.resolve(null),
    awayId && leagueId && season
      ? safe(
          () => repos.statistics.getTeamStatistics(awayId, leagueId, season),
          null,
        )
      : Promise.resolve(null),
    homeId && awayId
      ? safe(() => repos.fixtures.listHeadToHead(homeId, awayId, 5), null)
      : Promise.resolve(null),
    fixtureId
      ? safe(() => repos.teams.listInjuries({ fixture: fixtureId }), null)
      : Promise.resolve(null),
    homeId
      ? safe(() => repos.teams.listRecentFixtures(homeId, 5), null)
      : Promise.resolve(null),
    awayId
      ? safe(() => repos.teams.listRecentFixtures(awayId, 5), null)
      : Promise.resolve(null),
    // Removed duplicate fixtures.getLineups: getById already loaded lineups
    // onto this bundle (see carryLineupsOnBundle). Only hit the repo when
    // the match snapshot was listed without enrichment.
    carriedLineups
      ? Promise.resolve({ response: carriedLineups })
      : fixtureId
        ? safe(() => repos.fixtures.getLineups(fixtureId), null)
        : Promise.resolve(null),
    leagueId && season
      ? safe(() => repos.standings.getTable(leagueId, season), null)
      : Promise.resolve(null),
  ]);

  const teamStats: MatchAnalysisTeamStats = {};
  const homeSnapshot = snapshotFromTeamStatistics(homeStats);
  const awaySnapshot = snapshotFromTeamStatistics(awayStats);
  if (homeSnapshot) teamStats.home = homeSnapshot;
  if (awaySnapshot) teamStats.away = awaySnapshot;

  const h2hItems = Array.isArray(h2hPayload?.response)
    ? h2hPayload.response
    : [];
  const injuryItems = Array.isArray(injuriesPayload?.response)
    ? injuriesPayload.response
    : [];
  const absences = absencesFromInjuries(injuryItems);
  const homeRecentItems = Array.isArray(homeRecentPayload?.response)
    ? homeRecentPayload.response
    : [];
  const awayRecentItems = Array.isArray(awayRecentPayload?.response)
    ? awayRecentPayload.response
    : [];
  const lineupItems = Array.isArray(lineupsPayload?.response)
    ? lineupsPayload.response
    : [];
  const standings = Array.isArray(standingsPayload?.response)
    ? standingsPayload.response
    : [];
  const recent = {
    home: homeId
      ? recentMatchesFromFixtures(homeRecentItems, homeId, fixtureId)
      : [],
    away: awayId
      ? recentMatchesFromFixtures(awayRecentItems, awayId, fixtureId)
      : [],
  };

  return {
    teamStats: teamStats.home || teamStats.away ? teamStats : undefined,
    h2h: h2hFromFixtures(h2hItems, fixtureId),
    injuries: absences.injuries,
    suspensions: absences.suspensions,
    recent,
    lineups:
      homeId && awayId
        ? lineupsFromVendor(lineupItems, homeId, awayId)
        : { home: null, away: null },
    standings: {
      home: homeId ? standingFromTable(standings, homeId) : null,
      away: awayId ? standingFromTable(standings, awayId) : null,
    },
    trends: {
      home: mergeTeamTrends(recent.home, homeSnapshot),
      away: mergeTeamTrends(recent.away, awaySnapshot),
    },
  };
}
