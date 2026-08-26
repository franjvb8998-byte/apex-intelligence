import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiFootballDataProvider } from "@/lib/data-platform/api-football-provider";
import { MockDataProvider } from "@/lib/data-platform/mock-provider";
import {
  ProviderFactory,
  createDataProviderFromEnv,
  readDataProviderConfig,
} from "@/lib/data-platform/provider-factory";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";

describe("Data Platform v2 — ProviderFactory", () => {
  it("defaults to mock when env is empty", () => {
    const config = readDataProviderConfig({});
    expect(config.provider).toBe("mock");

    const provider = ProviderFactory.create({ env: {} });
    expect(provider).toBeInstanceOf(MockDataProvider);
    expect(provider.id).toBe("mock");
  });

  it("selects api-football from APEX_DATA_PROVIDER", () => {
    const config = readDataProviderConfig({
      APEX_DATA_PROVIDER: "api-football",
    });
    expect(config.provider).toBe("api-football");

    const provider = ProviderFactory.create({
      env: { APEX_DATA_PROVIDER: "api-football" },
      apiFootball: {
        apiKey: "test-key",
        enrichMatch: false,
        fetchImpl: vi.fn(
          async () =>
            new Response(JSON.stringify({ response: [] }), { status: 200 }),
        ) as unknown as typeof fetch,
      },
    });
    expect(provider).toBeInstanceOf(ApiFootballDataProvider);
    expect(provider.id).toBe("api-football");
  });

  it("explicit options.provider overrides env", () => {
    const provider = ProviderFactory.create({
      provider: "mock",
      env: { APEX_DATA_PROVIDER: "api-football" },
    });
    expect(provider.id).toBe("mock");
  });

  it("createDataProviderFromEnv returns mock by default", () => {
    const provider = createDataProviderFromEnv({ env: {} });
    expect(provider.id).toBe("mock");
  });
});

describe("Data Platform v2 — MockDataProvider", () => {
  it("returns current demo match as ApexMatchBundle", async () => {
    const provider = new MockDataProvider();
    const bundle = await provider.getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });

    expect(bundle.provenance.primaryProvider).toBe("mock");
    expect(bundle.homeTeam.name).toBe("Northbridge FC");
    expect(bundle.awayTeam.name).toBe("Southport United");
    expect(bundle.match.id.startsWith("apex:mock:")).toBe(true);
    expect(bundle.trustScore?.value).toBeGreaterThan(0);
  });

  it("lists fixtures", async () => {
    const provider = new MockDataProvider();
    const list = await provider.listFixtures();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.homeTeam.name).toBeTruthy();
  });
});

describe("Data Platform v2 — ApiFootballDataProvider requires key", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses recorded fixtures by default without credentials", async () => {
    const provider = new ApiFootballDataProvider({
      apiKey: null,
      env: {},
      useCache: false,
    });
    expect(provider.dataMode).toBe("recorded");
    const bundle = await provider.getMatch({ matchId: "1035089" });
    expect(bundle.homeTeam.name).toBe("Arsenal");
  });

  it("throws missing_api_key when fallback=error", () => {
    expect(
      () =>
        new ApiFootballDataProvider({
          apiKey: null,
          env: {},
          fallback: "error",
        }),
    ).toThrow(/API_FOOTBALL_KEY|API_KEY/i);
  });
});
