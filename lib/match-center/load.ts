/**
 * Match Center data loader — fixtures and match payloads via the DAL.
 * Free-plan flow: today's fixtures, then Premier League 2025 fallback.
 */

import type { IDataProvider } from "@/lib/data-platform";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { matchSummaryFromBundle } from "@/lib/dashboard/map";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import {
  EMPTY_MATCH_CENTER_ENRICHMENT,
  enrichMatchCenterContext,
} from "@/lib/match-center/enrich";
import { vendorFixtureId } from "@/lib/match-center/fixture-id";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";
import type { MatchCenterData } from "@/lib/match-center/types";
import {
  createProductDataProvider,
  createRepositories,
} from "@/lib/repositories";

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
  return createProductDataProvider(env);
}

function repositoriesFor(options: LoadMatchCenterOptions) {
  const env = options.env ?? process.env;
  return createRepositories({
    provider: options.provider,
    env,
    enrichMatch: true,
  });
}

/**
 * Load Match Center from the DAL. Does not use the mock catalogue.
 */
export async function getMatchCenterData(
  options: LoadMatchCenterOptions = {},
): Promise<MatchCenterData> {
  const repos = repositoriesFor(options);
  const requested = vendorFixtureId(options.externalMatchId);
  const skipCatalogue = options.includeFixtureList === false && Boolean(requested);
  const fixtures = skipCatalogue ? [] : await repos.fixtures.listCatalogue();
  const matchId = resolveSelectedFixtureId(fixtures, requested ?? undefined);

  const bundle = await repos.fixtures.getById(matchId);
  let enrichment;
  try {
    enrichment = await enrichMatchCenterContext(repos, bundle);
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
  const fixtures = await listMatchCenterFixtureBundles(options);
  return fixtures.map(matchSummaryFromBundle);
}

/**
 * Same catalogue as {@link listMatchCenterFixtures}, as Apex bundles
 * (odds + league logo available for Bankroll).
 */
export async function listMatchCenterFixtureBundles(
  options: LoadMatchCenterOptions = {},
): Promise<ApexMatchBundle[]> {
  return repositoriesFor(options).fixtures.listCatalogue();
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
