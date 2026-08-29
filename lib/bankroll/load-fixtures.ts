/**
 * Match Center fixtures for Add Bet (logos + suggested odds).
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { matchSummaryFromBundle } from "@/lib/dashboard/map";
import { suggestedOddsFromQuotes } from "@/lib/bankroll/odds-from-fixture";
import type { BankrollFixture } from "@/lib/bankroll/types";
import { fixtureIdFromMatch } from "@/lib/match-center/fixture-id";
import { listMatchCenterFixtureBundles } from "@/lib/match-center";
import {
  createRecordedDataProvider,
  createRepositories,
  loadUnlessQuota,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
  type ApexRepositories,
} from "@/lib/repositories";

function toBankrollFixture(bundle: ApexMatchBundle): BankrollFixture {
  return {
    ...matchSummaryFromBundle(bundle),
    leagueLogoUrl: bundle.league?.logoUrl ?? null,
    suggestedOdds: suggestedOddsFromQuotes(bundle.odds),
  };
}

function recordedOddsRepos(): ApexRepositories {
  return createRepositories({
    provider: createRecordedDataProvider({ enrichMatch: true }),
  });
}

async function attachOdds(
  repos: ApexRepositories,
  bundle: ApexMatchBundle,
): Promise<ApexMatchBundle> {
  const matchId = fixtureIdFromMatch({
    id: bundle.match.id,
    externalId: bundle.match.externalRefs[0]?.externalId ?? null,
  });
  if (!matchId) return bundle;
  try {
    const full = await repos.fixtures.getById(matchId);
    if (full.odds.length === 0) return bundle;
    return {
      ...bundle,
      odds: full.odds,
      league: full.league ?? bundle.league,
    };
  } catch {
    return bundle;
  }
}

async function enrichOdds(
  repos: ApexRepositories,
  bundles: ApexMatchBundle[],
): Promise<ApexMatchBundle[]> {
  if (bundles.length !== 1 || bundles[0]!.odds.length > 0) return bundles;
  const first = bundles[0]!;
  let next = await attachOdds(repos, first);
  const vendorId = fixtureIdFromMatch({
    id: first.match.id,
    externalId: first.match.externalRefs[0]?.externalId ?? null,
  });
  if (
    next.odds.length === 0 &&
    vendorId === RECORDED_API_FOOTBALL_FIXTURE_ID
  ) {
    next = await attachOdds(recordedOddsRepos(), first);
  }
  return [next];
}

async function recordedFixtures(): Promise<BankrollFixture[]> {
  const repos = recordedOddsRepos();
  const bundles = await enrichOdds(
    repos,
    await listMatchCenterFixtureBundles({ provider: createRecordedDataProvider() }),
  );
  return bundles.map(toBankrollFixture);
}

export async function loadBankrollFixtures(): Promise<BankrollFixture[]> {
  const repos = createRepositories();
  const live = await loadUnlessQuota(() =>
    listMatchCenterFixtureBundles(),
  );
  if (live.ok && live.data.length > 0) {
    const bundles = await enrichOdds(repos, live.data);
    return bundles.map(toBankrollFixture);
  }
  try {
    const recorded = await recordedFixtures();
    if (recorded.length > 0) return recorded;
  } catch {
    /* keep live result */
  }
  return live.ok ? live.data.map(toBankrollFixture) : [];
}
