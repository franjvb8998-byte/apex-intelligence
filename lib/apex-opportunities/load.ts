/**
 * Load today's fixtures and run each through the APEX Decision Engine.
 * Catalogue + odds come from API-Football (recorded fallback when no key).
 */

import { mapOpportunityFromCenter } from "@/lib/apex-opportunities/map";
import type { ApexOpportunitiesBoard } from "@/lib/apex-opportunities/types";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { isTerminalApexMatchStatus } from "@/lib/data-platform/types/match";
import {
  bindScannerProfile,
  instrumentRepositories,
  measurePhase,
  measurePhaseSync,
  noteScannerFixtureCount,
  noteScannerFixtures,
  noteScannerOddsAttached,
  noteScannerQuotaExhausted,
  type ScannerProfileSession,
} from "@/lib/debug/scanner-profile";
import { EMPTY_MATCH_CENTER_ENRICHMENT } from "@/lib/match-center/enrich";
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

export type LoadApexOpportunitiesOptions = LoadMatchCenterOptions & {
  /** Sprint 2.5 — removable profile session. Does not change board output. */
  scannerProfile?: ScannerProfileSession;
};

async function attachOdds(
  repos: ApexRepositories,
  bundle: ApexMatchBundle,
): Promise<ApexMatchBundle> {
  if (bundle.odds.length > 0) return bundle;
  // Finished / cancelled cannot become a betting opportunity. Keep the
  // catalogue row and skip /odds. This is not an empty-odds error fallback
  // and must not set quotaExhausted.
  if (isTerminalApexMatchStatus(bundle.match.status)) return bundle;
  const matchId = fixtureIdFromMatch({
    id: bundle.match.id,
    externalId: bundle.match.externalRefs[0]?.externalId ?? null,
  });
  if (!matchId) return bundle;
  const odds = await ignoreNonQuotaErrors(
    () => repos.odds.listForFixture(matchId),
    [],
  );
  if (odds.length === 0) return bundle;
  return {
    ...bundle,
    odds,
  };
}

/**
 * Sprint 3 odds-only path for every catalogue size.
 *
 * A previous `bundles.length <= 3` branch called enrichMatchCenterContext
 * (team stats, H2H, injuries, last-5, lineups, standings). Those extras can
 * change Elo and scoring vs the 4+ fixture path, but they are not required
 * to emit a Scanner row — busy days already use EMPTY_MATCH_CENTER_ENRICHMENT.
 * Quiet-day full hydration is removed here only. Match Center is unchanged.
 */
async function evaluateBundle(
  repos: ApexRepositories,
  bundle: ApexMatchBundle,
) {
  const withOdds = await measurePhase(
    "attachOdds",
    () => attachOdds(repos, bundle),
    { fixtures: 1 },
  );
  if (withOdds.odds.length > 0) noteScannerOddsAttached();
  noteScannerFixtures("decisionEngine", 1);
  noteScannerFixtures("scoring", 1);
  const center = createMatchCenterFromApexBundle(withOdds, {
    enrichment: EMPTY_MATCH_CENTER_ENRICHMENT,
    probabilityDiagnosticContext: "scanner",
  });
  return measurePhaseSync(
    "serialization",
    () => mapOpportunityFromCenter(center),
    { fixtures: 1 },
  );
}

type MapPoolResult<R> = {
  items: R[];
  quotaExhausted: boolean;
};

/**
 * Drain each wave with allSettled so fulfilled catalogue rows are kept
 * even when a sibling hits quota. Stop scheduling after a quota rejection.
 */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<MapPoolResult<R>> {
  const out: R[] = [];
  let quotaExhausted = false;
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map(fn));
    let unexpected: unknown;
    for (const result of settled) {
      if (result.status === "fulfilled") {
        out.push(result.value);
        continue;
      }
      if (isQuotaError(result.reason)) {
        quotaExhausted = true;
        continue;
      }
      unexpected ??= result.reason;
    }
    if (unexpected !== undefined) throw unexpected;
    if (quotaExhausted) break;
  }
  return { items: out, quotaExhausted };
}

/**
 * Scan today's (or Premier League fallback) fixtures through the Decision Engine.
 */
export async function getApexOpportunities(
  options: LoadApexOpportunitiesOptions = {},
): Promise<ApexOpportunitiesBoard> {
  if (options.scannerProfile) bindScannerProfile(options.scannerProfile);
  const env = options.env ?? process.env;
  const repos = instrumentRepositories(
    createRepositories({
      provider: options.provider,
      env,
      enrichMatch: true,
    }),
  );
  // Same catalogue as listMatchCenterFixtureBundles — reuse this graph
  // instead of constructing a second DAL in the same request (Sprint 2A).
  const bundles = await measurePhase(
    "catalogue",
    () => repos.fixtures.listCatalogue(),
  );
  noteScannerFixtureCount(bundles.length);
  noteScannerFixtures("catalogue", bundles.length);

  const mapped = await mapPool(bundles, EVALUATE_CONCURRENCY, async (bundle) => {
    try {
      return await evaluateBundle(repos, bundle);
    } catch (error) {
      if (isQuotaError(error)) throw error;
      return null;
    }
  });

  if (mapped.quotaExhausted) noteScannerQuotaExhausted();

  return {
    generatedAt: new Date().toISOString(),
    analyzed: mapped.items.filter(
      (row): row is NonNullable<typeof row> => row != null,
    ),
    quotaExhausted: mapped.quotaExhausted,
  };
}
