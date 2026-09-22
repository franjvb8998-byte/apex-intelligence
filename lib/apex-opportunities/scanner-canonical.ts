/**
 * Shared Scanner-canonical prematch snapshot.
 *
 * Odds-only attach + empty enrichment + PE/scoring inside
 * createMatchCenterFromApexBundle. Used by Scanner pages and the
 * Phase 1D.2A lifecycle coordinator. Does not call Match Analysis enrich.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { isTerminalApexMatchStatus } from "@/lib/data-platform/types/match";
import { EMPTY_MATCH_CENTER_ENRICHMENT } from "@/lib/match-center/enrich";
import { fixtureIdFromMatch } from "@/lib/match-center/fixture-id";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";
import type { MatchCenterData } from "@/lib/match-center/types";
import { ignoreNonQuotaErrors, type ApexRepositories } from "@/lib/repositories";

export async function attachScannerOdds(
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

export function createScannerMatchCenter(
  bundle: ApexMatchBundle,
): MatchCenterData {
  return createMatchCenterFromApexBundle(bundle, {
    enrichment: EMPTY_MATCH_CENTER_ENRICHMENT,
    probabilityDiagnosticContext: "scanner",
  });
}
