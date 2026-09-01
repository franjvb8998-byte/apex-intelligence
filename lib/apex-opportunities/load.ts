/**
 * Load today's fixtures and run each through the APEX Decision Engine.
 * Catalogue + odds come from API-Football (recorded fallback when no key).
 */

import { mapOpportunityFromCenter } from "@/lib/apex-opportunities/map";
import type { ApexOpportunitiesBoard } from "@/lib/apex-opportunities/types";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  EMPTY_MATCH_CENTER_ENRICHMENT,
  enrichMatchCenterContext,
} from "@/lib/match-center/enrich";
import { fixtureIdFromMatch } from "@/lib/match-center/fixture-id";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";
import type { LoadMatchCenterOptions } from "@/lib/match-center/load";
import {
  createRepositories,
  ignoreNonQuotaErrors,
  isQuotaError,
  type ApexRepositories,
} from "@/lib/repositories";

const EVALUATE_CONCURRENCY = 3;
/** Full form/injury enrichment is cheap on recorded catalogues; skip on busy days. */
const ENRICH_WHEN_AT_MOST = 3;

export type LoadApexOpportunitiesOptions = LoadMatchCenterOptions;

async function attachOdds(
  repos: ApexRepositories,
  bundle: ApexMatchBundle,
): Promise<ApexMatchBundle> {
  if (bundle.odds.length > 0) return bundle;
  const matchId = fixtureIdFromMatch({
    id: bundle.match.id,
    externalId: bundle.match.externalRefs[0]?.externalId ?? null,
  });
  if (!matchId) return bundle;
  const full = await ignoreNonQuotaErrors(
    () => repos.fixtures.getById(matchId),
    bundle,
  );
  if (full.odds.length === 0) return bundle;
  return {
    ...bundle,
    odds: full.odds,
    league: full.league ?? bundle.league,
  };
}

async function evaluateBundle(
  repos: ApexRepositories,
  bundle: ApexMatchBundle,
  enrich: boolean,
) {
  const withOdds = await attachOdds(repos, bundle);
  let enrichment = EMPTY_MATCH_CENTER_ENRICHMENT;
  if (enrich) {
    try {
      enrichment = await enrichMatchCenterContext(repos, withOdds);
    } catch {
      // Form/injuries are optional for the scan. Quota here must not blank the board.
      enrichment = EMPTY_MATCH_CENTER_ENRICHMENT;
    }
  }
  const center = createMatchCenterFromApexBundle(withOdds, { enrichment });
  return mapOpportunityFromCenter(center);
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

/**
 * Scan today's (or Premier League fallback) fixtures through the Decision Engine.
 */
export async function getApexOpportunities(
  options: LoadApexOpportunitiesOptions = {},
): Promise<ApexOpportunitiesBoard> {
  const env = options.env ?? process.env;
  const repos = createRepositories({
    provider: options.provider,
    env,
    enrichMatch: true,
  });
  // Same catalogue as listMatchCenterFixtureBundles — reuse this graph
  // instead of constructing a second DAL in the same request (Sprint 2A).
  const bundles = await repos.fixtures.listCatalogue();
  const enrich = bundles.length <= ENRICH_WHEN_AT_MOST;

  const mapped = await mapPool(bundles, EVALUATE_CONCURRENCY, async (bundle) => {
    try {
      return await evaluateBundle(repos, bundle, enrich);
    } catch (error) {
      if (isQuotaError(error)) throw error;
      return null;
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    analyzed: mapped.filter((row): row is NonNullable<typeof row> => row != null),
  };
}
