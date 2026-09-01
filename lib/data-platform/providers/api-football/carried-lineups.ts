/**
 * Lineups already downloaded by `getMatch` (events + lineups + odds).
 * Enrichment used to call `fixtures.getLineups` again for the same fixture.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ApiFootballLineup } from "@/lib/data-platform/providers/api-football/types";

const lineupsOnBundle = new WeakMap<ApexMatchBundle, ApiFootballLineup[]>();

export function carryLineupsOnBundle(
  bundle: ApexMatchBundle,
  lineups: ApiFootballLineup[] | null | undefined,
): void {
  if (lineups && lineups.length > 0) {
    lineupsOnBundle.set(bundle, lineups);
  }
}

export function lineupsCarriedOnBundle(
  bundle: ApexMatchBundle,
): ApiFootballLineup[] | undefined {
  return lineupsOnBundle.get(bundle);
}
