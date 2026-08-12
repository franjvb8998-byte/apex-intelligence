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
 * Football-Data.org adapter (infrastructure only).
 *
 * TODO(http): wire api.football-data.org matches + odds when licensed.
 */
export class FootballDataProvider implements MatchDataProvider {
  readonly id = "football-data" as const;
  readonly displayName = "Football-Data";

  capabilities(): ProviderCapabilities {
    return {
      matches: true,
      events: true,
      lineups: false,
      odds: false,
      live: false,
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

    // Intentionally thinner payload to exercise Data Trust Score gaps.
    return {
      provider: this.id,
      externalMatchId: fixture.match.id,
      fetchedAt: nowIso(),
      payload: {
        match: fixture.match,
        // No odds / limited lineups in this mock — quality module should notice.
        players: fixture.players.slice(0, 1),
        events: fixture.events,
        odds: [],
      },
      meta: {
        endpoint: "GET /v4/matches/{id} (mock)",
        notes: ["HTTP client not wired", "odds not included in mock"],
      },
    };
  }

  async fetchFixtures(): Promise<ProviderRawEnvelope[]> {
    return [await this.fetchMatch({ externalMatchId: DEMO_MATCH_EXTERNAL_ID })];
  }
}

export function createFootballDataProvider(): MatchDataProvider {
  return new FootballDataProvider();
}
