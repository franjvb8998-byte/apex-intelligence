/**
 * Match Center data loader — API-Football (live when API_FOOTBALL_KEY is set).
 * Free-plan flow: today's fixtures, then Premier League 2025 fallback.
 */

import { createApiFootballDataProvider, type IDataProvider } from "@/lib/data-platform";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { ignoreNonQuotaErrors } from "@/lib/data-platform/providers/api-football/quota";
import { matchSummaryFromBundle } from "@/lib/dashboard/map";
import { hasFootballApiKey } from "@/lib/dashboard/resolve-provider";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import {
  EMPTY_MATCH_CENTER_ENRICHMENT,
  enrichMatchCenterContext,
} from "@/lib/match-center/enrich";
import { vendorFixtureId } from "@/lib/match-center/fixture-id";
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
  const requested = vendorFixtureId(options.externalMatchId);
  const skipCatalogue = options.includeFixtureList === false && Boolean(requested);
  const fixtures = skipCatalogue ? [] : await loadFixtureCatalogue(provider);
  const matchId = resolveSelectedFixtureId(fixtures, requested ?? undefined);

  const bundle = await provider.getMatch({ matchId });
  let enrichment;
  try {
    enrichment = await enrichMatchCenterContext(provider, bundle);
  } catch {
    enrichment = { ...EMPTY_MATCH_CENTER_ENRICHMENT };
  }
  const data = createMatchCenterFromApexBundle(bundle, { enrichment });
  data.fixtures = skipCatalogue ? [] : withSelectedFixture(fixtures, bundle);
  return data;
}

/**
 * Catalogue only — no match analysis, PE, or enrichment.
 * Used by `/match-center` so opening the list does not load a fixture.
 */
export async function listMatchCenterFixtures(
  options: LoadMatchCenterOptions = {},
): Promise<DashboardMatchSummary[]> {
  const env = options.env ?? process.env;
  const provider = options.provider ?? resolveMatchCenterProvider(env);
  const fixtures = await loadFixtureCatalogue(provider);
  return fixtures.map(matchSummaryFromBundle);
}

async function loadFixtureCatalogue(
  provider: IDataProvider,
): Promise<ApexMatchBundle[]> {
  const today = new Date().toISOString().slice(0, 10);
  let list = await ignoreNonQuotaErrors(
    async () => (await provider.listFixtures?.({ date: today })) ?? [],
    [],
  );

  if (list.length === 0) {
    list = await ignoreNonQuotaErrors(
      async () =>
        (await provider.listFixtures?.({
          leagueId: PREMIER_LEAGUE_ID,
          season: PREMIER_LEAGUE_SEASON,
          limit: FIXTURE_LIMIT,
        })) ?? [],
      [],
    );
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
  return vendorFixtureId(bundle.match.externalRefs[0]?.externalId) ??
    vendorFixtureId(bundle.match.id);
}

function bundleLookupIds(bundle: ApexMatchBundle): string[] {
  return [
    ...new Set(
      [bundle.match.id, bundle.match.externalRefs[0]?.externalId]
        .map(vendorFixtureId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

function resolveSelectedFixtureId(
  fixtures: ApexMatchBundle[],
  requestedId?: string,
): string {
  const requested = vendorFixtureId(requestedId);
  if (requested) {
    const hit = fixtures.find((bundle) =>
      bundleLookupIds(bundle).includes(requested),
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
