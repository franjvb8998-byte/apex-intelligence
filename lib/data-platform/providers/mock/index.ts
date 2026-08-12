import type {
  MatchDataProvider,
  ProviderCapabilities,
} from "@/lib/data-platform/contracts/match-data-provider";
import {
  createDemoFixturePayload,
  DEMO_MATCH_EXTERNAL_ID,
  nowIso,
  type MockFixturePayload,
} from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ProviderRawEnvelope } from "@/lib/data-platform/types/provider";

export type MockProviderOptions = {
  /** Override demo fixture for tests. */
  fixture?: MockFixturePayload;
};

/**
 * First-party mock provider for local development and unit tests.
 * Canonical payload shape (no vendor nesting).
 */
export class MockProvider implements MatchDataProvider {
  readonly id = "mock" as const;
  readonly displayName = "MockProvider";
  private readonly fixture: MockFixturePayload;

  constructor(options: MockProviderOptions = {}) {
    this.fixture = options.fixture ?? createDemoFixturePayload(this.id);
  }

  capabilities(): ProviderCapabilities {
    return {
      matches: true,
      events: true,
      lineups: true,
      odds: true,
      live: false,
      mockOnly: true,
    };
  }

  async fetchMatch(query: {
    externalMatchId: string;
  }): Promise<ProviderRawEnvelope<MockFixturePayload>> {
    const payload: MockFixturePayload = structuredClone(this.fixture);
    payload.match.id = query.externalMatchId || DEMO_MATCH_EXTERNAL_ID;

    return {
      provider: this.id,
      externalMatchId: payload.match.id,
      fetchedAt: nowIso(),
      payload,
      meta: {
        endpoint: "mock://match",
        notes: ["In-memory fixture"],
      },
    };
  }

  async fetchFixtures(): Promise<ProviderRawEnvelope[]> {
    return [await this.fetchMatch({ externalMatchId: DEMO_MATCH_EXTERNAL_ID })];
  }
}

export function createMockProvider(
  options?: MockProviderOptions,
): MatchDataProvider {
  return new MockProvider(options);
}
