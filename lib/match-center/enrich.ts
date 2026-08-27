/**
 * Optional Match Center extras from the live data layer.
 * Only calls provider endpoints that already exist — never invents stats/H2H/injuries.
 */

import { ApiFootballDataProvider } from "@/lib/data-platform/api-football-provider";
import { adaptApiFootballTeamStatistics } from "@/lib/data-platform/providers/api-football/adapters";
import type { IDataProvider } from "@/lib/data-platform/provider";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type {
  MatchAnalysisInjury,
  MatchAnalysisTeamStats,
} from "@/lib/match-analysis/analysis-types";
import type { MatchCenterH2HMeeting } from "@/lib/match-center/types";

export type MatchCenterEnrichment = {
  teamStats?: MatchAnalysisTeamStats;
  h2h: MatchCenterH2HMeeting[];
  injuries: MatchAnalysisInjury[];
};

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

/**
 * Pull team statistics, H2H and injuries when the configured provider exposes them.
 */
export async function enrichMatchCenterContext(
  provider: IDataProvider,
  bundle: ApexMatchBundle,
): Promise<MatchCenterEnrichment> {
  if (!(provider instanceof ApiFootballDataProvider)) {
    return { h2h: [], injuries: [] };
  }

  const homeId = externalId(bundle.homeTeam.externalRefs);
  const awayId = externalId(bundle.awayTeam.externalRefs);
  const leagueId = externalId(bundle.league?.externalRefs);
  const season = seasonYear(bundle.league?.season);
  const fixtureId = externalId(bundle.match.externalRefs);

  const [homeStats, awayStats, h2hPayload, injuriesPayload] = await Promise.all([
    homeId && leagueId && season
      ? safe(
          () => provider.http.getTeamStatistics(homeId, leagueId, season),
          null,
        )
      : Promise.resolve(null),
    awayId && leagueId && season
      ? safe(
          () => provider.http.getTeamStatistics(awayId, leagueId, season),
          null,
        )
      : Promise.resolve(null),
    homeId && awayId
      ? safe(() => provider.http.getHeadToHead(homeId, awayId, 5), null)
      : Promise.resolve(null),
    fixtureId
      ? safe(() => provider.http.getInjuries({ fixture: fixtureId }), null)
      : Promise.resolve(null),
  ]);

  const teamStats: MatchAnalysisTeamStats = {};
  if (homeStats?.response) {
    const adapted = adaptApiFootballTeamStatistics(homeStats.response);
    teamStats.home = adapted;
  }
  if (awayStats?.response) {
    const adapted = adaptApiFootballTeamStatistics(awayStats.response);
    teamStats.away = adapted;
  }

  const h2h: MatchCenterH2HMeeting[] = (h2hPayload?.response ?? [])
    .filter((item) => String(item.fixture.id) !== fixtureId)
    .slice(0, 5)
    .map((item) => ({
      id: String(item.fixture.id),
      kickoffAt: item.fixture.date,
      homeTeamName: item.teams.home.name,
      awayTeamName: item.teams.away.name,
      homeGoals: item.goals.home,
      awayGoals: item.goals.away,
    }));

  const injuries: MatchAnalysisInjury[] = (injuriesPayload?.response ?? []).map(
    (item, index) => ({
      id: `inj-${item.player.id ?? index}`,
      playerName: item.player.name,
      teamId:
        item.team.id != null
          ? `apex:api-football:team:${item.team.id}`
          : null,
      detail: [item.player.type, item.player.reason].filter(Boolean).join(" · ")
        || "Lesión reportada por el proveedor.",
    }),
  );

  return {
    teamStats:
      teamStats.home || teamStats.away ? teamStats : undefined,
    h2h,
    injuries,
  };
}
