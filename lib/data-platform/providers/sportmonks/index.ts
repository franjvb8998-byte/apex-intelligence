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
 * SportMonks adapter (infrastructure only).
 *
 * TODO(http): wire SportMonks v3 fixture includes (participants, events, odds).
 */
export class SportMonksProvider implements MatchDataProvider {
  readonly id = "sportmonks" as const;
  readonly displayName = "SportMonks";

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
    const fixture = createDemoFixturePayload(this.id);
    if (query.externalMatchId !== DEMO_MATCH_EXTERNAL_ID) {
      fixture.match.id = query.externalMatchId;
    }

    return {
      provider: this.id,
      externalMatchId: fixture.match.id,
      fetchedAt: nowIso(),
      payload: {
        data: fixture,
      },
      meta: {
        endpoint: "GET /fixtures/{id} (mock)",
        notes: ["HTTP client not wired"],
      },
    };
  }

  async fetchFixtures(): Promise<ProviderRawEnvelope[]> {
    return [await this.fetchMatch({ externalMatchId: DEMO_MATCH_EXTERNAL_ID })];
  }
}

export function createSportMonksProvider(): MatchDataProvider {
  return new SportMonksProvider();
}
