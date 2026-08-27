import { afterEach, describe, expect, it, vi } from "vitest";
import { createTtlCache } from "@/lib/data-platform/cache";
import {
  createHttpClient,
  DataPlatformHttpError,
} from "@/lib/data-platform/http";
import {
  createApiFootballProvider,
  createDataPlatform,
  createRecordedApiFootballFixturesResponse,
  mapApiFootballEnvelopeToApexBundle,
  mapApiFootballStatus,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/data-platform";
import { createRecordedApiFootballOddsResponse } from "@/lib/data-platform/providers/api-football/recorded-fixture";

describe("TTL cache", () => {
  it("returns values within TTL and expires afterward", () => {
    let now = 1_000;
    const cache = createTtlCache({
      defaultTtlMs: 100,
      now: () => now,
    });

    cache.set("a", { ok: true });
    expect(cache.get<{ ok: boolean }>("a")?.ok).toBe(true);

    now = 1_050;
    expect(cache.get("a")).toEqual({ ok: true });

    now = 1_200;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.getStale<{ ok: boolean }>("a")?.ok).toBe(true);
  });
});

describe("HTTP client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("performs GET and parses JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const client = createHttpClient({
      baseUrl: "https://example.test",
      providerId: "api-football",
    });

    const response = await client.get<{ ok: boolean }>("/ping", { q: 1 });
    expect(response.status).toBe(200);
    expect(response.data.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("maps 401 to unauthorized error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "no key" }), {
            status: 401,
          }),
      ),
    );

    const client = createHttpClient({
      baseUrl: "https://example.test",
      providerId: "api-football",
    });

    await expect(client.get("/secure")).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    } satisfies Partial<DataPlatformHttpError>);
  });
});

describe("API-Football mapper", () => {
  it("maps status shorts to Apex statuses", () => {
    expect(mapApiFootballStatus("NS")).toBe("scheduled");
    expect(mapApiFootballStatus("1H")).toBe("live");
    expect(mapApiFootballStatus("FT")).toBe("finished");
    expect(mapApiFootballStatus("PST")).toBe("postponed");
  });

  it("maps recorded fixtures payload to ApexMatchBundle", () => {
    const payload = createRecordedApiFootballFixturesResponse();
    const bundle = mapApiFootballEnvelopeToApexBundle({
      provider: "api-football",
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
      fetchedAt: "2026-08-12T12:00:00.000Z",
      payload,
    });

    expect(bundle.homeTeam.name).toBe("Arsenal");
    expect(bundle.awayTeam.name).toBe("Chelsea");
    expect(bundle.match.status).toBe("finished");
    expect(bundle.match.score.home).toBe(2);
    expect(bundle.match.score.away).toBe(1);
    expect(bundle.league?.name).toBe("Premier League");
    expect(bundle.match.venue?.name).toBe("Emirates Stadium");
    expect(bundle.match.referee).toBe("M. Oliver");
    expect(bundle.match.attendance).toBeNull();
    expect(bundle.match.weather).toBeNull();
    expect(bundle.events.length).toBeGreaterThan(0);
    expect(bundle.players.length).toBeGreaterThan(0);
    expect(bundle.match.id).toContain("api-football");
  });

  it("maps 1X2, O/U 2.5 and BTTS odds from every bookmaker", () => {
    const payload = createRecordedApiFootballFixturesResponse();
    const bundle = mapApiFootballEnvelopeToApexBundle(
      {
        provider: "api-football",
        externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
        fetchedAt: "2026-08-12T12:00:00.000Z",
        payload,
      },
      {
        odds: [
          {
            fixture: { id: Number(RECORDED_API_FOOTBALL_FIXTURE_ID) },
            bookmakers: [
              {
                id: 8,
                name: "Bet365",
                bets: [
                  {
                    id: 1,
                    name: "Match Winner",
                    values: [
                      { value: "Home", odd: "1.80" },
                      { value: "Draw", odd: "3.60" },
                      { value: "Away", odd: "4.20" },
                    ],
                  },
                  {
                    id: 5,
                    name: "Goals Over/Under",
                    values: [
                      { value: "Over 2.5", odd: "1.95" },
                      { value: "Under 2.5", odd: "1.90" },
                    ],
                  },
                  {
                    id: 8,
                    name: "Both Teams Score",
                    values: [
                      { value: "Yes", odd: "1.70" },
                      { value: "No", odd: "2.10" },
                    ],
                  },
                ],
              },
              {
                id: 11,
                name: "1xBet",
                bets: [
                  {
                    id: 1,
                    name: "Match Winner",
                    values: [
                      { value: "Home", odd: "1.90" },
                      { value: "Draw", odd: "3.50" },
                      { value: "Away", odd: "4.00" },
                    ],
                  },
                  {
                    id: 5,
                    name: "Goals Over/Under",
                    values: [
                      { value: "Over 2.5", odd: "2.00" },
                      { value: "Under 2.5", odd: "1.85" },
                    ],
                  },
                  {
                    id: 8,
                    name: "Both Teams Score",
                    values: [
                      { value: "Yes", odd: "1.75" },
                      { value: "No", odd: "2.05" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    );

    expect(bundle.odds).toHaveLength(6);
    expect(bundle.odds.filter((q) => q.market === "1x2")).toHaveLength(2);
    expect(new Set(bundle.odds.map((q) => q.bookmaker))).toEqual(
      new Set(["Bet365", "1xBet"]),
    );
    expect(bundle.odds.find((q) => q.market === "over_under")?.line).toBe(2.5);
    expect(
      bundle.odds.find((q) => q.market === "btts")?.selections[0]?.key,
    ).toBe("yes");
  });

  it("maps the recorded odds payload across Bet365, 1xBet and Pinnacle", () => {
    const bundle = mapApiFootballEnvelopeToApexBundle(
      {
        provider: "api-football",
        externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
        fetchedAt: "2026-08-12T12:00:00.000Z",
        payload: createRecordedApiFootballFixturesResponse(),
      },
      { odds: createRecordedApiFootballOddsResponse().response },
    );

    expect(bundle.odds).toHaveLength(9);
    expect(new Set(bundle.odds.map((q) => q.bookmaker))).toEqual(
      new Set(["Bet365", "1xBet", "Pinnacle"]),
    );
    const home1xBet = bundle.odds.find(
      (q) => q.market === "1x2" && q.bookmaker === "1xBet",
    );
    expect(home1xBet?.selections.find((s) => s.key === "home")?.decimalOdds).toBe(
      1.7,
    );
  });
});

describe("ApiFootballProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves recorded real fixture without API key", async () => {
    const provider = createApiFootballProvider({ fallback: "recorded" });
    expect(provider.capabilities().mockOnly).toBe(true);

    const envelope = await provider.fetchMatch({
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });

    expect(envelope.provider).toBe("api-football");
    expect(envelope.meta?.mode).toBe("recorded");
    expect(envelope.payload).toMatchObject({
      results: 1,
    });
  });

  it("caches fetchMatch results", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify(createRecordedApiFootballFixturesResponse()),
        { status: 200 },
      ),
    );

    const provider = createApiFootballProvider({
      apiKey: "test-key",
      includeEvents: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cacheTtlMs: 60_000,
    });

    await provider.fetchMatch({
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });
    await provider.fetchMatch({
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("ingests through Data Platform into Apex model", async () => {
    const platform = createDataPlatform({
      providers: [createApiFootballProvider({ fallback: "recorded" })],
    });

    const { bundle } = await platform.ingestMatch({
      providerId: "api-football",
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });

    expect(bundle.provenance.primaryProvider).toBe("api-football");
    expect(bundle.homeTeam.name).toBe("Arsenal");
    expect(bundle.trustScore?.value).toBeGreaterThan(0.4);
  });

  it("throws when fallback=error and no client", async () => {
    const provider = createApiFootballProvider({
      apiKey: null,
      fallback: "error",
    });

    await expect(
      provider.fetchMatch({ externalMatchId: "1" }),
    ).rejects.toBeInstanceOf(DataPlatformHttpError);
  });
});
