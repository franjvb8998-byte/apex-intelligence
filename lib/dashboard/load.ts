/**
 * Dashboard data loader — Data Platform only (Sprint 7).
 */

import { getDefaultMatchId, DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform/providers/api-football/fixtures";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  addUtcDays,
  isUpcomingMatch,
  leagueSummaryFromBundle,
  matchSummaryFromBundle,
  startOfUtcDay,
  teamsFromBundle,
  uniqueById,
} from "@/lib/dashboard/map";
import {
  resolveDashboardProvider,
  type DashboardProviderResolveOptions,
  type ResolvedDashboardProvider,
} from "@/lib/dashboard/resolve-provider";
import type {
  DashboardData,
  DashboardMatchSummary,
  DashboardProviderKind,
} from "@/lib/dashboard/types";
import { getMatchCenterData } from "@/lib/match-center/load";
import type { MatchCenterData } from "@/lib/match-center/types";

export type LoadDashboardOptions = DashboardProviderResolveOptions & {
  /** Override "today" (ISO date YYYY-MM-DD) — tests. */
  today?: string;
  /** How many forward days to scan for upcoming fixtures (default 3). */
  upcomingDays?: number;
  now?: Date;
};

async function listForDate(
  listFixtures: NonNullable<
    ReturnType<typeof resolveDashboardProvider>["provider"]["listFixtures"]
  >,
  date: string,
): Promise<ApexMatchBundle[]> {
  try {
    return await listFixtures({ date });
  } catch {
    return [];
  }
}

/**
 * Load Dashboard overview from the resolved Data Platform provider.
 */
export async function getDashboardData(
  options: LoadDashboardOptions = {},
): Promise<DashboardData> {
  const resolved = resolveDashboardProvider(options);
  const { provider, kind, dataMode, hasApiKey, displayName } = resolved;
  const today = options.today ?? startOfUtcDay(options.now ?? new Date());
  const upcomingDays = options.upcomingDays ?? 3;
  const now = options.now ?? new Date();

  const listFixtures =
    provider.listFixtures?.bind(provider) ??
    (async () => {
      const matchId = defaultMatchIdFor(kind, options.env);
      return [await provider.getMatch({ matchId })];
    });

  const todayBundles = await listForDate(listFixtures, today);

  const upcomingBundles: ApexMatchBundle[] = [];
  const seenIds = new Set(todayBundles.map((b) => b.match.id));

  for (let offset = 0; offset <= upcomingDays; offset += 1) {
    const date = addUtcDays(today, offset);
    const bundles = offset === 0 ? todayBundles : await listForDate(listFixtures, date);
    for (const bundle of bundles) {
      if (seenIds.has(bundle.match.id) && offset > 0) continue;
      if (offset > 0) seenIds.add(bundle.match.id);
      upcomingBundles.push(bundle);
    }
  }

  // Seed catalogue when the day is empty (common on live free-tier / off days).
  let seed: ApexMatchBundle | null = null;
  if (todayBundles.length === 0 && upcomingBundles.length === 0) {
    try {
      seed = await provider.getMatch({
        matchId: defaultMatchIdFor(kind, options.env),
      });
    } catch {
      seed = null;
    }
  }

  const catalogue = [
    ...todayBundles,
    ...upcomingBundles.filter(
      (b) => !todayBundles.some((t) => t.match.id === b.match.id),
    ),
    ...(seed ? [seed] : []),
  ];

  const todayMatches = todayBundles.map(matchSummaryFromBundle);
  const upcomingMatches = uniqueById(
    (upcomingBundles.length ? upcomingBundles : catalogue)
      .map(matchSummaryFromBundle)
      .filter((m) => isUpcomingMatch(m, now)),
  ).filter((m) => {
    // Prefer not duplicating finished "today" rows into upcoming.
    if (todayMatches.some((t) => t.id === m.id) && m.status === "finished") {
      return false;
    }
    return true;
  });

  const leagues = uniqueById(
    catalogue
      .map(leagueSummaryFromBundle)
      .filter((l): l is NonNullable<typeof l> => l != null),
  );

  const featuredTeams = uniqueById(catalogue.flatMap(teamsFromBundle)).slice(
    0,
    8,
  );

  const featuredMatchId =
    pickFeaturedExternalId(todayMatches, upcomingMatches, seed) ??
    defaultMatchIdFor(kind, options.env);

  const message = buildStatusMessage({
    kind,
    dataMode,
    hasApiKey,
    todayCount: todayMatches.length,
    upcomingCount: upcomingMatches.length,
  });

  return {
    system: {
      provider: kind,
      dataMode,
      hasApiKey,
      displayName,
      todayCount: todayMatches.length,
      upcomingCount: upcomingMatches.length,
      leagueCount: leagues.length,
      teamCount: featuredTeams.length,
      message,
      checkedAt: (options.now ?? new Date()).toISOString(),
    },
    todayMatches,
    upcomingMatches,
    leagues,
    featuredTeams,
    featuredMatchId,
  };
}

function defaultMatchIdFor(
  kind: DashboardProviderKind,
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string {
  if (kind === "api-football") {
    return (
      env?.API_FOOTBALL_DEFAULT_FIXTURE_ID?.trim() ||
      env?.APEX_DATA_DEFAULT_MATCH_ID?.trim() ||
      RECORDED_API_FOOTBALL_FIXTURE_ID
    );
  }
  return getDefaultMatchId(env) || DEMO_MATCH_EXTERNAL_ID;
}

function pickFeaturedExternalId(
  today: DashboardMatchSummary[],
  upcoming: DashboardMatchSummary[],
  seed: ApexMatchBundle | null,
): string | null {
  const live = today.find((m) => m.status === "live");
  if (live?.externalId) return live.externalId;
  const firstToday = today[0];
  if (firstToday?.externalId) return firstToday.externalId;
  const firstUpcoming = upcoming[0];
  if (firstUpcoming?.externalId) return firstUpcoming.externalId;
  return seed?.match?.externalRefs?.[0]?.externalId ?? null;
}

function buildStatusMessage(input: {
  kind: string;
  dataMode: string;
  hasApiKey: boolean;
  todayCount: number;
  upcomingCount: number;
}): string {
  if (input.kind === "mock" || !input.hasApiKey) {
    return "Sin API key — Dashboard en modo mock (Data Platform).";
  }
  if (input.dataMode === "live") {
    return `API-Football live · ${input.todayCount} hoy · ${input.upcomingCount} próximos.`;
  }
  return "API-Football conectado (modo recorded / fallback).";
}

export function emptyDashboardData(
  resolved: Pick<
    ResolvedDashboardProvider,
    "kind" | "dataMode" | "hasApiKey" | "displayName"
  >,
): DashboardData {
  return {
    system: {
      provider: resolved.kind,
      dataMode: resolved.dataMode,
      hasApiKey: resolved.hasApiKey,
      displayName: resolved.displayName,
      todayCount: 0,
      upcomingCount: 0,
      leagueCount: 0,
      teamCount: 0,
      message: "No se pudieron cargar los partidos. La sesión sigue activa.",
      checkedAt: new Date().toISOString(),
    },
    todayMatches: [],
    upcomingMatches: [],
    leagues: [],
    featuredTeams: [],
    featuredMatchId: "",
  };
}

/**
 * Dashboard workspace: football widgets must not crash an authenticated session.
 */
export async function loadDashboardWorkspace(
  options: LoadDashboardOptions = {},
): Promise<{ dashboard: DashboardData; matchCenter: MatchCenterData | null }> {
  const resolved = resolveDashboardProvider(options);
  let dashboard: DashboardData;
  try {
    dashboard = await getDashboardData({
      ...options,
      provider: resolved.provider,
    });
  } catch {
    dashboard = emptyDashboardData(resolved);
  }

  const featuredId = dashboard.featuredMatchId?.trim();
  let matchCenter: MatchCenterData | null = null;
  try {
    matchCenter = await getMatchCenterData({
      externalMatchId:
        dashboard.system.provider === "api-football" && featuredId
          ? featuredId
          : undefined,
      includeFixtureList: false,
      env: options.env,
    });
  } catch {
    matchCenter = null;
  }

  return { dashboard, matchCenter };
}
