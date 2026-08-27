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
  MatchAnalysisTeamStatSnapshot,
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
    return {
      form: adapted.form,
      wins: adapted.wins,
      draws: adapted.draws,
      losses: adapted.losses,
      goalsFor: adapted.goalsFor,
      goalsAgainst: adapted.goalsAgainst,
      played: adapted.played,
      teamName: adapted.teamName,
    };
  } catch {
    return undefined;
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
  const homeSnapshot = snapshotFromTeamStatistics(homeStats);
  const awaySnapshot = snapshotFromTeamStatistics(awayStats);
  if (homeSnapshot) teamStats.home = homeSnapshot;
  if (awaySnapshot) teamStats.away = awaySnapshot;

  const h2hItems = Array.isArray(h2hPayload?.response)
    ? h2hPayload.response
    : [];
  const h2h: MatchCenterH2HMeeting[] = h2hItems
    .filter((item) => item?.fixture?.id != null && String(item.fixture.id) !== fixtureId)
    .slice(0, 5)
    .map((item) => ({
      id: String(item.fixture.id),
      kickoffAt: item.fixture.date,
      homeTeamName: item.teams?.home?.name ?? "Local",
      awayTeamName: item.teams?.away?.name ?? "Visitante",
      homeGoals: item.goals?.home ?? null,
      awayGoals: item.goals?.away ?? null,
    }));

  const injuryItems = Array.isArray(injuriesPayload?.response)
    ? injuriesPayload.response
    : [];
  const injuries: MatchAnalysisInjury[] = injuryItems.map((item, index) => ({
    id: `inj-${item.player?.id ?? index}`,
    playerName: item.player?.name ?? "Jugador",
    teamId:
      item.team?.id != null
        ? `apex:api-football:team:${item.team.id}`
        : null,
    detail:
      [item.player?.type, item.player?.reason].filter(Boolean).join(" · ") ||
      "Lesión reportada por el proveedor.",
  }));

  return {
    teamStats:
      teamStats.home || teamStats.away ? teamStats : undefined,
    h2h,
    injuries,
  };
}
