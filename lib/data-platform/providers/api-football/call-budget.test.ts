/**
 * Architectural API-Football call-budget characterization after Sprints 5A.6–5A.8.
 *
 * Distinguishes repository/client operations selected from origin HTTP.
 * Tests use a counting inner client (no live network).
 */
import { afterEach, describe, expect, it } from "vitest";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { resetApexOpportunitiesShareForTests } from "@/lib/apex-opportunities/shared-board";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { createFixtureApiFootballClient } from "@/lib/data-platform/providers/api-football/fixture-client";
import {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballOddsResponse,
} from "@/lib/data-platform/providers/api-football/fixtures";
import type {
  ApiFootballFixtureItem,
  ApiFootballStatusShort,
} from "@/lib/data-platform/providers/api-football/types";
import { getMatchCenterData } from "@/lib/match-center/load";
import { VALUE_SCAN_SAMPLE_SIZE } from "@/lib/copilot/value-scan";
import { loadCopilotValueScanMarkets } from "@/lib/copilot/value-scan";
import { resetApiFootballSingleFlightForTests } from "@/lib/data-platform/providers/api-football/single-flight";
import { resetApiFootballQuotaCircuitForTests } from "@/lib/data-platform/providers/api-football/quota-circuit";

afterEach(() => {
  resetApexOpportunitiesShareForTests();
  resetApiFootballSingleFlightForTests();
  resetApiFootballQuotaCircuitForTests();
});

const ENRICH_METHODS = [
  "getTeamStatistics",
  "getHeadToHead",
  "getInjuries",
  "getTeamLastFixtures",
  "getLineups",
  "getStandings",
  "getEvents",
  "getFixture",
] as const;

function cloneItem(index: number, short: ApiFootballStatusShort): ApiFootballFixtureItem {
  const base = createRecordedApiFootballFixturesResponse().response[0]!;
  return {
    ...base,
    fixture: {
      ...base.fixture,
      id: 8000 + index,
      date: short === "NS" ? "2027-08-15T15:00:00+00:00" : base.fixture.date,
      status: { long: String(short), short, elapsed: short === "NS" ? null : 90 },
    },
  };
}

function withCallLog(
  inner: ApiFootballClient,
  calls: string[],
  overrides: Partial<ApiFootballClient> = {},
): ApiFootballClient {
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop in overrides) {
        const value = overrides[prop as keyof ApiFootballClient];
        if (typeof value === "function") {
          return (...args: unknown[]) => {
            calls.push(String(prop));
            return (value as (...params: unknown[]) => unknown)(...args);
          };
        }
        return value;
      }
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          calls.push(String(prop));
          return (value as (...params: unknown[]) => unknown).apply(target, args);
        };
      }
      return value;
    },
  }) as ApiFootballClient;
}

function countingProvider(options: {
  items: ApiFootballFixtureItem[];
  calls: string[];
  useCache?: boolean;
}): ApiFootballDataProvider {
  const inner = createFixtureApiFootballClient();
  const byId = new Map(options.items.map((item) => [String(item.fixture.id), item]));
  const client = withCallLog(inner, options.calls, {
    getFixturesByDate: async (date) => ({
      ...createRecordedApiFootballFixturesResponse(),
      parameters: { date },
      results: options.items.length,
      response: options.items,
    }),
    getFixture: async (id) => {
      const item = byId.get(String(id)) ?? inner;
      if (typeof item === "object" && "fixture" in item) {
        return {
          ...createRecordedApiFootballFixturesResponse(),
          results: 1,
          response: [item],
        };
      }
      return inner.getFixture(id);
    },
    getFixtureOdds: async () => createRecordedApiFootballOddsResponse(),
  });
  return new ApiFootballDataProvider({
    client,
    enrichMatch: true,
    useCache: options.useCache ?? false,
  });
}

describe("Sprint 5A.8 call-budget characterization", () => {
  const mixed20 = [
    ...Array.from({ length: 5 }, (_, index) => cloneItem(index, "FT")),
    ...Array.from({ length: 15 }, (_, index) => cloneItem(index + 5, "NS")),
  ];

  it("SCENARIO 1 light: Scanner 20/5 terminal + 3 Match Centers (cold)", async () => {
    const coldCalls: string[] = [];
    const board = await getApexOpportunities({
      nowUtc: "2027-08-15T14:00:00.000Z",
      provider: countingProvider({ items: mixed20, calls: coldCalls }),
    });
    expect(board.analyzed).toHaveLength(15);
    expect(coldCalls.filter((name) => name === "getFixturesByDate")).toHaveLength(1);
    expect(coldCalls.filter((name) => name === "getFixtureOdds")).toHaveLength(15);
    expect(
      coldCalls.filter((name) =>
        (ENRICH_METHODS as readonly string[]).includes(name),
      ),
    ).toEqual([]);

    const mcCalls: string[] = [];
    const mcProvider = countingProvider({
      items: mixed20,
      calls: mcCalls,
      useCache: false,
    });
    await getMatchCenterData({
      provider: mcProvider,
      env: {},
      includeFixtureList: false,
      externalMatchId: "8005",
    });
    expect(mcCalls.filter((name) => name === "getFixture").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(mcCalls.filter((name) => name === "getFixtureOdds").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(mcCalls.filter((name) => name === "getTeamStatistics").length).toBeGreaterThanOrEqual(
      1,
    );
  }, 30_000);

  it("warm Scanner within TTL selects no additional inner origin", async () => {
    const calls: string[] = [];
    const provider = countingProvider({
      items: mixed20,
      calls,
      useCache: true,
    });
    await getApexOpportunities({
      nowUtc: "2027-08-15T14:00:00.000Z",
      provider,
    });
    const afterCold = calls.length;
    expect(afterCold).toBeGreaterThan(0);
    await getApexOpportunities({
      nowUtc: "2027-08-15T14:00:00.000Z",
      provider,
    });
    expect(calls.length).toBe(afterCold);
  }, 30_000);

  it("Copilot value_scan uses odds + team stats, not N full Match Centers", async () => {
    const calls: string[] = [];
    const items = Array.from({ length: VALUE_SCAN_SAMPLE_SIZE }, (_, index) =>
      cloneItem(index + 5, "NS"),
    );
    const provider = countingProvider({ items, calls });
    const firstId = String(items[0]!.fixture.id);
    await loadCopilotValueScanMarkets({ provider, env: {} }, firstId);
    expect(calls.filter((name) => name === "getFixtureOdds").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(calls.filter((name) => name === "getEvents")).toEqual([]);
    expect(calls.filter((name) => name === "getInjuries")).toEqual([]);
    expect(calls.filter((name) => name === "getHeadToHead")).toEqual([]);
  }, 30_000);
});

/**
 * Characterized architectural budgets (repository/client selection).
 *
 * SCENARIO 1 LIGHT (20 fixtures, 5 terminal, cold then navigate):
 * - Scanner compute: 1 catalogue + 15 odds. No enrich. Terminal skip saves 5 odds.
 * - Feed / Combos / Lab / Portfolio on the DEFAULT path in one request: 1 compute.
 *   Separate page loads within HTTP TTL: 0 extra origin (process cache), 1 compute each
 *   unless they share a React request.
 * - 3 Match Centers cold, distinct fixtures: up to 3×(getFixture+events+lineups+odds
 *   + stats×2 + h2h + injuries + last5×2 + standings) with standings/team-stats
 *   coalesced when keys match. Warm MC: 0 extra origin inside TTL.
 *   Finished fixture-by-id TTL is 24h after 5A.8 (status-aware).
 *
 * SCENARIO 2 ACTIVE MATCHDAY:
 * - Repeated Scanner: first cold 1+15 origin; later scans warm catalogue/odds (10 min
 *   list/odds TTL). H2H/form/standings only if Match Center is opened.
 * - 10 Match Center opens: first per fixture pays the MC graph; repeats of the same
 *   fixture are cache hits. Terminal fixtures stay cached 24h.
 *
 * SCENARIO 3 HEAVY DEVELOPMENT:
 * - Repeated cold scans if process cache is flushed (dev restart): 1+15 each.
 * - 20 Match Centers: ~11 selected ops each when cold and keys unique; far less with
 *   shared standings/team-stats/single-flight.
 * - Copilot value_scan: 1 catalogue (request-memo in prod) + up to 8 odds + up to
 *   16 team-stats + 1 full MC for the winner — not 8× full MC.
 *
 * Origin vs selected ops: inner client counts above are origin when useCache=false.
 * useCache=true + TTL hit → selected wrapper ops may still run, origin = 0.
 */
describe("documented Free vs Pro envelopes", () => {
  it("keeps odds TTL at the live match window", async () => {
    const { API_FOOTBALL_CACHE_TTL_MS, ttlForCacheKey } = await import(
      "@/lib/data-platform/providers/api-football/cache-policy"
    );
    expect(ttlForCacheKey("af:odds:1")).toBe(API_FOOTBALL_CACHE_TTL_MS.match);
    expect(API_FOOTBALL_CACHE_TTL_MS.match).toBe(10 * 60 * 1000);
  });
});
