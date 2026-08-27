/**
 * Match Center data loader — API-Football (live when API_FOOTBALL_KEY is set).
 * Free-plan flow: today's fixtures, then Premier League 2025 fallback.
 */

import { createApiFootballDataProvider, type IDataProvider } from "@/lib/data-platform";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { matchSummaryFromBundle } from "@/lib/dashboard/map";
import { hasFootballApiKey } from "@/lib/dashboard/resolve-provider";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import { enrichMatchCenterContext } from "@/lib/match-center/enrich";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";
import type { MatchCenterData } from "@/lib/match-center/types";

const PREMIER_LEAGUE_ID = "39";
const PREMIER_LEAGUE_SEASON = "2025";
const FIXTURE_LIMIT = 20;

export type LoadMatchCenterOptions = {
  /** External fixture id (API-Football fixture id or Apex id). */
  externalMatchId?: string;
  /** Kept for callers; Match Center no longer falls back to mock data. */
  requireProvider?: boolean;
  /** Inject Data Platform provider (tests). */
  provider?: IDataProvider;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /**
   * When false, skip the fixture catalogue (dashboard already listed today).
   * Default true for `/match-center`.
   */
  includeFixtureList?: boolean;
};

export function resolveMatchCenterProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): IDataProvider {
  const hasKey = hasFootballApiKey(env);
  return createApiFootballDataProvider({
    env,
    enrichMatch: true,
    fallback: hasKey ? "error" : "recorded",
  });
}

/**
 * Load Match Center from API-Football. Does not use the mock catalogue.
 */
export async function getMatchCenterData(
  options: LoadMatchCenterOptions = {},
): Promise<MatchCenterData> {
  const env = options.env ?? process.env;
  const provider = options.provider ?? resolveMatchCenterProvider(env);
  const requested = options.externalMatchId?.trim();
  const skipCatalogue = options.includeFixtureList === false && Boolean(requested);
  const fixtures = skipCatalogue ? [] : await loadFixtureCatalogue(provider);
  const matchId = resolveSelectedFixtureId(fixtures, requested);

  const bundle = await provider.getMatch({ matchId });
  let enrichment;
  try {
    enrichment = await enrichMatchCenterContext(provider, bundle);
  } catch {
    enrichment = { h2h: [], injuries: [] };
  }
  const data = createMatchCenterFromApexBundle(bundle, { enrichment });
  data.fixtures = withSelectedFixture(fixtures, bundle);
  return data;
}

async function loadFixtureCatalogue(
  provider: IDataProvider,
): Promise<ApexMatchBundle[]> {
  const today = new Date().toISOString().slice(0, 10);
  let list: ApexMatchBundle[] = [];

  try {
    list = (await provider.listFixtures?.({ date: today })) ?? [];
  } catch {
    list = [];
  }

  if (list.length === 0) {
    try {
      list =
        (await provider.listFixtures?.({
          leagueId: PREMIER_LEAGUE_ID,
          season: PREMIER_LEAGUE_SEASON,
          limit: FIXTURE_LIMIT,
        })) ?? [];
    } catch {
      list = [];
    }
  }

  return rankFixtures(list).slice(0, FIXTURE_LIMIT);
}

function rankFixtures(items: ApexMatchBundle[]): ApexMatchBundle[] {
  const rank = (status: ApexMatchBundle["match"]["status"]) => {
    if (status === "live") return 0;
    if (status === "scheduled") return 1;
    if (status === "finished") return 2;
    return 3;
  };
  return [...items].sort(
    (a, b) =>
      rank(a.match.status) - rank(b.match.status) ||
      a.match.kickoffAt.localeCompare(b.match.kickoffAt),
  );
}

function externalId(bundle: ApexMatchBundle): string | null {
  return bundle.match.externalRefs[0]?.externalId ?? null;
}

function resolveSelectedFixtureId(
  fixtures: ApexMatchBundle[],
  requestedId?: string,
): string {
  const requested = requestedId?.trim();
  if (requested) {
    const hit = fixtures.find(
      (bundle) =>
        externalId(bundle) === requested || bundle.match.id === requested,
    );
    if (hit) return externalId(hit) ?? requested;
    return requested;
  }

  const first = fixtures[0];
  if (first) return externalId(first) ?? first.match.id;
  throw new Error(
    "API-Football no devolvió fixtures para hoy ni Premier League 2025.",
  );
}

function withSelectedFixture(
  fixtures: ApexMatchBundle[],
  selected: ApexMatchBundle,
): DashboardMatchSummary[] {
  const summaries = fixtures.map(matchSummaryFromBundle);
  const loaded = matchSummaryFromBundle(selected);
  const alreadyListed = summaries.some(
    (row) =>
      (loaded.externalId && row.externalId === loaded.externalId) ||
      row.id === loaded.id,
  );
  return alreadyListed ? summaries : [loaded, ...summaries];
}

/**
 * Recorded ingest path kept for tests (no live key).
 */
export async function loadMatchCenterFromApiFootball(
  options: LoadMatchCenterOptions = {},
): Promise<MatchCenterData> {
  const env = options.env ?? {};
  const provider = resolveMatchCenterProvider(env);
  return getMatchCenterData({
    ...options,
    provider,
    env,
  });
}
