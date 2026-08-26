/**
 * Data Platform v2 — MockDataProvider.
 * Serves current in-memory demo fixtures via the existing mock adapter + normalizer.
 */

import { createDataQualityModule } from "@/lib/data-platform/quality";
import { createMatchDataNormalizer } from "@/lib/data-platform/normalization";
import {
  createMockProvider,
  type MockProviderOptions,
} from "@/lib/data-platform/providers/mock";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { MatchDataProvider } from "@/lib/data-platform/contracts/match-data-provider";
import type { IDataProvider } from "@/lib/data-platform/provider";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type {
  DataProviderFixturesQuery,
  DataProviderMatchQuery,
} from "@/lib/data-platform/types";

export type MockDataProviderOptions = MockProviderOptions;

/**
 * Default application provider — current mock match data, no HTTP.
 */
export class MockDataProvider implements IDataProvider {
  readonly id = "mock" as const;
  readonly displayName = "Mock Data Provider";

  private readonly legacy: MatchDataProvider;
  private readonly normalizer = createMatchDataNormalizer();
  private readonly quality = createDataQualityModule();

  constructor(options: MockDataProviderOptions = {}) {
    this.legacy = createMockProvider(options);
  }

  async getMatch(query: DataProviderMatchQuery): Promise<ApexMatchBundle> {
    const matchId = query.matchId || DEMO_MATCH_EXTERNAL_ID;
    const envelope = await this.legacy.fetchMatch({
      externalMatchId: matchId,
    });
    const bundle = this.normalizer.normalize(envelope);
    bundle.trustScore = this.quality.score(bundle);
    return bundle;
  }

  async listFixtures(
    _query: DataProviderFixturesQuery = {},
  ): Promise<ApexMatchBundle[]> {
    const envelopes = (await this.legacy.fetchFixtures?.({})) ?? [
      await this.legacy.fetchMatch({
        externalMatchId: DEMO_MATCH_EXTERNAL_ID,
      }),
    ];
    return envelopes.map((envelope) => {
      const bundle = this.normalizer.normalize(envelope);
      bundle.trustScore = this.quality.score(bundle);
      return bundle;
    });
  }
}

export function createMockDataProvider(
  options?: MockDataProviderOptions,
): IDataProvider {
  return new MockDataProvider(options);
}

export { DEMO_MATCH_EXTERNAL_ID };
