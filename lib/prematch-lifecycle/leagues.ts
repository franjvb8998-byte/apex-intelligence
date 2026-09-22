import { vendorFixtureId } from "@/lib/match-center/fixture-id";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";

export function bundleLeagueVendorId(
  bundle: ApexMatchBundle,
): string | null {
  const fromRef = bundle.league?.externalRefs?.[0]?.externalId?.trim();
  if (fromRef) {
    const canonical = vendorFixtureId(fromRef) ?? fromRef;
    if (canonical) return canonical;
  }
  return vendorFixtureId(bundle.league?.id ?? null);
}

export function bundleMatchesLifecycleLeagues(
  bundle: ApexMatchBundle,
  leagueIds: readonly string[],
): boolean {
  if (leagueIds.length === 0) return false;
  const vendorId = bundleLeagueVendorId(bundle);
  if (!vendorId) return false;
  return leagueIds.includes(vendorId);
}
