import type {
  MatchDataProvider,
  ProviderCapabilities,
} from "@/lib/data-platform/contracts/match-data-provider";
import {
  createDemoFixturePayload,
  DEMO_MATCH_EXTERNAL_ID,
  nowIso,
} from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ProviderRawEnvelope } from "@/lib/data-platform/types/provider";

/**
 * API-Football adapter (infrastructure only).
 *
 * TODO(http): replace mock payload with REST client (api-sports.io).
 * Do not import Intelligence Core types here.
 */
export class ApiFootballProvider implements MatchDataProvider {
  readonly id = "api-football" as const;
  readonly displayName = "API-Football";

  capabilities(): ProviderCapabilities {
    return {
      matches: true,
      events: true,
      lineups: true,
      odds: true,
      live: true,
      mockOnly: true,
    };
  }

  async fetchMatch(query: {
    externalMatchId: string;
  }): Promise<ProviderRawEnvelope> {
    // Vendor-shaped wrapper kept intentional — mapper owns translation.
    const fixture = createDemoFixturePayload(this.id);
    if (query.externalMatchId !== DEMO_MATCH_EXTERNAL_ID) {
      fixture.match.id = query.externalMatchId;
    }

    return {
      provider: this.id,
      externalMatchId: fixture.match.id,
      fetchedAt: nowIso(),
      payload: {
        // Mimics a nested API-Football-ish response without calling HTTP.
        response: [fixture],
        results: 1,
      },
      meta: {
        endpoint: "GET /fixtures (mock)",
        notes: ["HTTP client not wired"],
      },
    };
  }

  async fetchFixtures(): Promise<ProviderRawEnvelope[]> {
    return [await this.fetchMatch({ externalMatchId: DEMO_MATCH_EXTERNAL_ID })];
  }
}

export function createApiFootballProvider(): MatchDataProvider {
  return new ApiFootballProvider();
}
