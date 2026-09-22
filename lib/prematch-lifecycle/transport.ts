/**
 * Production transport for the prematch lifecycle coordinator.
 * Discovery uses date catalogues (not listCatalogue's 20-row slice).
 * Finalization batches use existing GET /fixtures?ids= (max 15).
 */

import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import { MAX_FIXTURES_PER_BATCH } from "@/lib/data-platform/providers/api-football/live-query";
import { mapApiFootballFixtureItemToApexBundle } from "@/lib/data-platform/providers/api-football/mapper";
import type { ApiFootballFixturesResponse } from "@/lib/data-platform/providers/api-football/types";
import { nowIso } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { canonicalPrematchFixtureId } from "@/lib/prematch-decision/identity";
import {
  attachScannerOdds,
} from "@/lib/apex-opportunities/scanner-canonical";
import {
  createProductDataProvider,
  createRepositories,
  isQuotaError,
} from "@/lib/repositories";

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

function numericFixtureIds(ids: string[]): string[] {
  const unique = new Set<string>();
  for (const raw of ids) {
    const canonical = canonicalPrematchFixtureId(raw);
    if (!canonical || !/^[1-9]\d*$/.test(canonical)) continue;
    unique.add(canonical);
  }
  return [...unique].sort((a, b) => Number(a) - Number(b));
}

export function createPrematchLifecycleTransport(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const repos = createRepositories({ env, enrichMatch: false });

  return {
    async listFixturesByDate(date: string): Promise<ApexMatchBundle[]> {
      return repos.fixtures.list({ date });
    },

    attachOdds(bundle: ApexMatchBundle): Promise<ApexMatchBundle> {
      return attachScannerOdds(repos, bundle);
    },

    async fetchFixturesByIds(ids: string[]): Promise<ApexMatchBundle[]> {
      const fixtureIds = numericFixtureIds(ids);
      if (fixtureIds.length === 0) return [];
      const provider = createProductDataProvider(env, { enrichMatch: false });
      if (!(provider instanceof ApiFootballDataProvider)) {
        const rows: ApexMatchBundle[] = [];
        for (const id of fixtureIds) {
          try {
            rows.push(await provider.getMatch({ matchId: id }));
          } catch (error) {
            if (isQuotaError(error)) throw error;
          }
        }
        return rows;
      }
      const rows: ApexMatchBundle[] = [];
      for (const batch of chunkIds(fixtureIds, MAX_FIXTURES_PER_BATCH)) {
        const payload = await provider.http.getFixturesByIds(batch);
        const items = payload.response ?? [];
        for (const item of items) {
          const single: ApiFootballFixturesResponse = {
            ...payload,
            results: 1,
            response: [item],
          };
          rows.push(
            mapApiFootballFixtureItemToApexBundle(
              {
                provider: "api-football",
                externalMatchId: String(item.fixture.id),
                fetchedAt: nowIso(),
                payload: single,
                meta: {
                  endpoint: "GET /fixtures",
                  mode: provider.dataMode,
                },
              },
              item,
            ),
          );
        }
      }
      return rows;
    },
  };
}
