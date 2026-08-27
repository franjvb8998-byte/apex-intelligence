/**
 * Match Center fixtures for Add Bet (logos + suggested odds).
 */

import { createApiFootballDataProvider, type IDataProvider } from "@/lib/data-platform";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform/providers/api-football/fixtures";
import { loadUnlessQuota } from "@/lib/data-platform/providers/api-football/quota";
import { matchSummaryFromBundle } from "@/lib/dashboard/map";
import { suggestedOddsFromQuotes } from "@/lib/bankroll/odds-from-fixture";
import type { BankrollFixture } from "@/lib/bankroll/types";
import { fixtureIdFromMatch } from "@/lib/match-center/fixture-id";
import {
  listMatchCenterFixtureBundles,
  resolveMatchCenterProvider,
} from "@/lib/match-center";

function toBankrollFixture(bundle: ApexMatchBundle): BankrollFixture {
  return {
    ...matchSummaryFromBundle(bundle),
    leagueLogoUrl: bundle.league?.logoUrl ?? null,
    suggestedOdds: suggestedOddsFromQuotes(bundle.odds),
  };
}

function recordedOddsProvider(): IDataProvider {
  return createApiFootballDataProvider({
    apiKey: null,
    fallback: "recorded",
    enrichMatch: true,
  });
}

async function attachOdds(
  provider: IDataProvider,
  bundle: ApexMatchBundle,
): Promise<ApexMatchBundle> {
  const matchId = fixtureIdFromMatch({
    id: bundle.match.id,
    externalId: bundle.match.externalRefs[0]?.externalId ?? null,
  });
  if (!matchId) return bundle;
  try {
    const full = await provider.getMatch({ matchId });
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
  provider: IDataProvider,
  bundles: ApexMatchBundle[],
): Promise<ApexMatchBundle[]> {
  if (bundles.length !== 1 || bundles[0]!.odds.length > 0) return bundles;
  const first = bundles[0]!;
  let next = await attachOdds(provider, first);
  const vendorId = fixtureIdFromMatch({
    id: first.match.id,
    externalId: first.match.externalRefs[0]?.externalId ?? null,
  });
  if (
    next.odds.length === 0 &&
    vendorId === RECORDED_API_FOOTBALL_FIXTURE_ID
  ) {
    next = await attachOdds(recordedOddsProvider(), first);
  }
  return [next];
}

async function recordedFixtures(): Promise<BankrollFixture[]> {
  const provider = recordedOddsProvider();
  const bundles = await enrichOdds(
    provider,
    await listMatchCenterFixtureBundles({ provider }),
  );
  return bundles.map(toBankrollFixture);
}

export async function loadBankrollFixtures(): Promise<BankrollFixture[]> {
  const provider = resolveMatchCenterProvider();
  const live = await loadUnlessQuota(() =>
    listMatchCenterFixtureBundles({ provider }),
  );
  if (live.ok && live.data.length > 0) {
    const bundles = await enrichOdds(provider, live.data);
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
