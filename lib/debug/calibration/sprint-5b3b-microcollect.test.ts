/**
 * Sprint 5B.3B / 5B.3B.2 — mocked unpaged microcollector tests.
 * Zero live origin calls.
 */

import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";
import { resetApiFootballQuotaCircuitForTests } from "@/lib/data-platform/providers/api-football/quota-circuit";
import { createLiveMicrocollectTransport } from "@/lib/debug/calibration/live-transport";
import type {
  ApiFootballFixtureItem,
  ApiFootballFixturesResponse,
  ApiFootballOddsResponse,
} from "@/lib/data-platform/providers/api-football/types";
import {
  evaluateCalibrationRows,
  IncompleteSeasonListError,
  MICROCOLLECTION_LOGICAL_CALL_CEILING,
  MICROCOLLECTION_TARGET_COUNT,
  planMicrocollectionLogicalCalls,
} from "@/lib/debug/calibration";
import {
  MicrocollectOddsLookupError,
  reportMicrocollectCliResult,
} from "@/lib/debug/calibration/microcollect";
import {
  MicrocollectEmptySeasonError,
  MicrocollectNoEligibleTargetsError,
  MicrocollectTargetShortfallError,
  MicrocollectVendorEnvelopeError,
} from "@/lib/debug/calibration/season-contract";
import { CallBudgetExceededError } from "@/lib/debug/calibration/live-guard";
import { assertLiveCollectionAuthorized } from "@/lib/debug/calibration/live-guard";
import { LiveCollectionGuardError } from "@/lib/debug/calibration/live-guard";
import { collectMicrodataset } from "@/lib/debug/calibration/microcollect";
import { runAuthorizedMicrocollection } from "@/lib/debug/calibration/microcollect";
import type { MicrocollectTransport } from "@/lib/debug/calibration/microcollect";
import {
  MICROCOLLECTION_LEAGUE_ID,
  MICROCOLLECTION_SEASON,
} from "@/lib/debug/calibration/micro-shape";
import { loadCalibrationDataset } from "@/lib/debug/calibration/persist";
import { writeCalibrationArtifacts } from "@/lib/debug/calibration/persist";
import { assertReconstructionHasNoFuturePriors } from "@/lib/debug/calibration/leakage";
import { reconstructionFixtureFromVendor } from "@/lib/debug/calibration/vendor-map";
import { fetchCompleteSeasonFixtures } from "@/lib/debug/calibration/fetch-season";

function vendorItem(input: {
  id: number;
  kickoff: string;
  status: string;
  homeId?: number;
  awayId?: number;
  goalsHome: number | null;
  goalsAway: number | null;
  fulltimeHome?: number | null;
  fulltimeAway?: number | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
}): ApiFootballFixtureItem {
  return {
    fixture: {
      id: input.id,
      date: input.kickoff,
      status: { short: input.status },
    },
    league: {
      id: Number(MICROCOLLECTION_LEAGUE_ID),
      name: "Premier League",
      season: Number(MICROCOLLECTION_SEASON),
    },
    teams: {
      home: { id: input.homeId ?? 1, name: `Home ${input.homeId ?? 1}` },
      away: { id: input.awayId ?? 2, name: `Away ${input.awayId ?? 2}` },
    },
    goals: { home: input.goalsHome, away: input.goalsAway },
    score: {
      fulltime: {
        home: input.fulltimeHome ?? input.goalsHome,
        away: input.fulltimeAway ?? input.goalsAway,
      },
      penalty:
        input.penaltyHome != null && input.penaltyAway != null
          ? { home: input.penaltyHome, away: input.penaltyAway }
          : null,
    },
  };
}

function seasonPayload(
  items: ApiFootballFixtureItem[],
  paging: { current: number; total: number } = { current: 1, total: 1 },
): ApiFootballFixturesResponse {
  return {
    get: "fixtures",
    results: items.length,
    paging,
    response: items,
  };
}

function seasonItems(count: number): ApiFootballFixtureItem[] {
  const start = Date.parse("2024-08-16T15:00:00.000Z");
  const items: ApiFootballFixtureItem[] = [];
  for (let i = 0; i < count; i += 1) {
    items.push(
      vendorItem({
        id: 1000 + i,
        kickoff: new Date(start + i * 86_400_000).toISOString(),
        status: i === 3 ? "CANC" : "FT",
        homeId: (i % 10) + 1,
        awayId: ((i + 3) % 10) + 1,
        goalsHome: i === 3 ? 9 : i % 3,
        goalsAway: i === 3 ? 0 : (i + 1) % 2,
      }),
    );
  }
  return items;
}

function transportFromSeason(
  payload: ApiFootballFixturesResponse,
  odds?: Record<string, ApiFootballOddsResponse>,
): MicrocollectTransport & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async getFixtures(league, season) {
      calls.push(`fixtures:${league}:${season}`);
      return payload;
    },
    async getFixtureOdds(fixtureId) {
      calls.push(`odds:${fixtureId}`);
      return (
        odds?.[fixtureId] ?? {
          get: "odds",
          results: 0,
          paging: { current: 1, total: 1 },
          response: [],
        }
      );
    },
  };
}

function oddsPayload(home: string, draw: string, away: string): ApiFootballOddsResponse {
  return {
    get: "odds",
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: { id: 1 },
        bookmakers: [
          {
            id: 4,
            name: "Pinnacle",
            bets: [
              {
                id: 1,
                name: "Match Winner",
                values: [
                  { value: "Home", odd: home },
                  { value: "Draw", odd: draw },
                  { value: "Away", odd: away },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function completedOnlyItems(count: number): ApiFootballFixtureItem[] {
  const start = Date.parse("2024-09-01T15:00:00.000Z");
  const items: ApiFootballFixtureItem[] = [];
  for (let i = 0; i < count; i += 1) {
    items.push(
      vendorItem({
        id: 3000 + i,
        kickoff: new Date(start + i * 86_400_000).toISOString(),
        status: "FT",
        homeId: (i % 8) + 1,
        awayId: ((i + 3) % 8) + 1,
        goalsHome: 1,
        goalsAway: 0,
      }),
    );
  }
  return items;
}

function cancelledOnlyItems(count: number): ApiFootballFixtureItem[] {
  return completedOnlyItems(count).map((item, index) =>
    vendorItem({
      id: 4000 + index,
      kickoff: item.fixture.date,
      status: "CANC",
      homeId: item.teams.home.id,
      awayId: item.teams.away.id,
      goalsHome: null,
      goalsAway: null,
    }),
  );
}

describe("Sprint 5B.3B.2 — unpaged season fetch", () => {
  it("fetches the season exactly once without a page argument", async () => {
    const items = seasonItems(25);
    const transport = transportFromSeason(seasonPayload(items));
    const result = await fetchCompleteSeasonFixtures({
      transport,
      leagueId: MICROCOLLECTION_LEAGUE_ID,
      season: MICROCOLLECTION_SEASON,
    });
    expect(transport.calls).toEqual(["fixtures:39:2024"]);
    expect(result.pageCount).toBe(1);
    expect(result.afterCount).toBe(25);
  });

  it("normalizes a large unpaged season in one lookup without treating size as a rule", async () => {
    const largeSeasonSize = 80;
    const items = seasonItems(largeSeasonSize);
    const transport = transportFromSeason(seasonPayload(items));
    const result = await fetchCompleteSeasonFixtures({
      transport,
      leagueId: MICROCOLLECTION_LEAGUE_ID,
      season: MICROCOLLECTION_SEASON,
    });
    expect(transport.calls).toEqual(["fixtures:39:2024"]);
    expect(result.afterCount).toBe(largeSeasonSize);
    expect(result.pageCount).toBe(1);
  });

  it("refuses paging.total > 1 without a second lookup", async () => {
    const transport = transportFromSeason(
      seasonPayload(seasonItems(20), { current: 1, total: 2 }),
    );
    await expect(
      fetchCompleteSeasonFixtures({
        transport,
        leagueId: MICROCOLLECTION_LEAGUE_ID,
        season: MICROCOLLECTION_SEASON,
      }),
    ).rejects.toBeInstanceOf(IncompleteSeasonListError);
    expect(transport.calls).toEqual(["fixtures:39:2024"]);
  });

  it("fails on missing paging", async () => {
    await expect(
      fetchCompleteSeasonFixtures({
        transport: {
          async getFixtures() {
            return { get: "fixtures", results: 1, response: seasonItems(1) };
          },
        },
        leagueId: MICROCOLLECTION_LEAGUE_ID,
        season: MICROCOLLECTION_SEASON,
      }),
    ).rejects.toBeInstanceOf(IncompleteSeasonListError);
  });

  it("dedupes identical IDs and fails on conflicting duplicates", async () => {
    const items = seasonItems(4);
    const clone = { ...items[0]!, fixture: { ...items[0]!.fixture } };
    const same = await fetchCompleteSeasonFixtures({
      transport: transportFromSeason(seasonPayload([...items, clone])),
      leagueId: MICROCOLLECTION_LEAGUE_ID,
      season: MICROCOLLECTION_SEASON,
    });
    expect(same.afterCount).toBe(4);

    const conflict = vendorItem({
      id: items[0]!.fixture.id,
      kickoff: items[0]!.fixture.date,
      status: "FT",
      goalsHome: 8,
      goalsAway: 0,
    });
    await expect(
      fetchCompleteSeasonFixtures({
        transport: transportFromSeason(seasonPayload([...items, conflict])),
        leagueId: MICROCOLLECTION_LEAGUE_ID,
        season: MICROCOLLECTION_SEASON,
      }),
    ).rejects.toThrow(/Conflicting duplicate fixture/);
  });
});

describe("Sprint 5B.3B — selection, reconstruction, odds", () => {
  it("selects targets deterministically and excludes cancelled rows", async () => {
    const transport = transportFromSeason(seasonPayload(seasonItems(25)));
    const first = await collectMicrodataset({
      transport,
      includeOdds: false,
      collectionTimestamp: "2026-09-18T00:00:00.000Z",
    });
    const second = await collectMicrodataset({
      transport,
      includeOdds: false,
      collectionTimestamp: "2026-09-18T00:00:00.000Z",
    });
    expect(first.rows.map((row) => row.fixtureId)).toEqual(
      second.rows.map((row) => row.fixtureId),
    );
    expect(first.rows).toHaveLength(MICROCOLLECTION_TARGET_COUNT);
    expect(first.rows.some((row) => row.fixtureId === "1003")).toBe(false);
    expect(first.metadata.selectionRule).toContain("evenly spaced");
    expect(first.metadata.pageCounts).toEqual([1]);
  });

  it("asserts no contributing prior kickoff is at or after the target", () => {
    const items = seasonItems(12);
    const fixtures = items.map(reconstructionFixtureFromVendor);
    const target = fixtures[10]!;
    expect(() =>
      assertReconstructionHasNoFuturePriors({ target, fixtures }),
    ).not.toThrow();
  });

  it("uses full-time goals for PEN and does not treat shootout as regulation", () => {
    const mapped = reconstructionFixtureFromVendor(
      vendorItem({
        id: 77,
        kickoff: "2024-09-01T15:00:00.000Z",
        status: "PEN",
        goalsHome: 1,
        goalsAway: 1,
        fulltimeHome: 1,
        fulltimeAway: 1,
        penaltyHome: 5,
        penaltyAway: 4,
      }),
    );
    expect(mapped.fulltimeHome).toBe(1);
    expect(mapped.fulltimeAway).toBe(1);
    expect(mapped.goalsHome).toBe(1);
  });

  it("keeps missing odds as null with unknown not-prematch timing", async () => {
    const transport = transportFromSeason(seasonPayload(seasonItems(25)));
    const result = await collectMicrodataset({
      transport,
      includeOdds: true,
      collectionTimestamp: "2026-09-18T00:00:00.000Z",
    });
    expect(result.rows.every((row) => row.oddsTiming === "unknown")).toBe(true);
    expect(result.rows.every((row) => row.homeOdds == null)).toBe(true);
    expect(result.metadata.oddsTimingClassification.unknown).toBe(result.rows.length);
  });

  it("records decimal odds when present without claiming pre-match timing", async () => {
    const items = seasonItems(25);
    const odds: Record<string, ApiFootballOddsResponse> = {
      [String(items[24]!.fixture.id)]: oddsPayload("1.80", "3.50", "4.20"),
    };
    const transport = transportFromSeason(seasonPayload(items), odds);
    const result = await collectMicrodataset({
      transport,
      includeOdds: true,
      collectionTimestamp: "2026-09-18T00:00:00.000Z",
    });
    expect(result.rows.every((row) => row.oddsTiming === "unknown")).toBe(true);
  });
});

describe("Sprint 5B.3B — live guards, budget, artifacts", () => {
  it("fails closed without live opt-in and does not touch the transport", async () => {
    expect(() => assertLiveCollectionAuthorized({}, [])).toThrow(
      LiveCollectionGuardError,
    );
    const transport = transportFromSeason(seasonPayload(seasonItems(5)));
    await expect(
      runAuthorizedMicrocollection({
        env: {},
        argv: [],
        transport,
      }),
    ).rejects.toBeInstanceOf(LiveCollectionGuardError);
    expect(transport.calls).toEqual([]);
  });

  it("enforces the hard logical budget before any lookup", async () => {
    const transport = transportFromSeason(seasonPayload(seasonItems(25)));
    await expect(
      collectMicrodataset({
        transport,
        includeOdds: true,
        expectedTargetCount: 40,
      }),
    ).rejects.toBeInstanceOf(CallBudgetExceededError);
    expect(transport.calls).toEqual([]);
  });

  it("writes artifacts without secrets and reloads into the frozen evaluator", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-cal-"));
    const transport = transportFromSeason(seasonPayload(seasonItems(25)));
    const collected = await collectMicrodataset({
      transport,
      includeOdds: false,
      writeArtifacts: true,
      artifactDirectory: directory,
      collectionTimestamp: "2026-09-18T12:00:00.000Z",
    });
    const raw = readFileSync(collected.paths!.metadataPath, "utf8");
    expect(raw).not.toMatch(/api[_-]?key/i);
    const loaded = loadCalibrationDataset(collected.paths!.datasetPath);
    expect(loaded).toHaveLength(collected.rows.length);
    const report = evaluateCalibrationRows(loaded);
    expect(report.scores.length).toBe(loaded.length * 6);
    expect(report.peModelVersion).toBeTruthy();
    expect(collected.metadata.callBudgetKind).toBe(
      "logical_lookups_not_origin_http_attempts",
    );
    expect(collected.metadata.requestedTargetCount).toBe(MICROCOLLECTION_TARGET_COUNT);
    expect(collected.metadata.targetRowCount).toBe(collected.rows.length);
    expect(collected.metadata.fixtureListLogicalCalls).toBe(1);
    expect(collected.metadata.oddsLogicalCalls).toBe(0);
    expect(collected.logicalCallCount).toBe(1);
    expect(collected.originCallCount).toBe(1);
    expect(readdirSync(directory).some((name) => name.endsWith(".tmp"))).toBe(
      false,
    );
  });

  it("refuses metadata that looks like it contains an API key", () => {
    expect(() =>
      writeCalibrationArtifacts({
        rows: [],
        metadata: {
          datasetSchemaVersion: "x",
          reconstructionVersion: "x",
          collectorVersion: "x",
          collectionTimestamp: "t",
          selectedLeagueSeasons: [],
          pageCounts: [],
          fixtureCountBeforeDedupe: 0,
          fixtureCountAfterDedupe: 0,
          targetRowCount: 0,
          oddsCoverageCount: 0,
          oddsTimingClassification: { unknown: 0, vendor_update: 0, fetch_time: 0 },
          leagueName: "api_key=secret",
        },
      }),
    ).toThrow(/API key/);
  });

  it("does not write artifacts when the season envelope is incomplete", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-cal-pagefail-"));
    await expect(
      collectMicrodataset({
        transport: {
          async getFixtures() {
            return { get: "fixtures", results: 1, response: seasonItems(1) };
          },
        },
        writeArtifacts: true,
        artifactDirectory: directory,
      }),
    ).rejects.toBeInstanceOf(IncompleteSeasonListError);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("treats empty odds payloads as null odds but aborts on thrown provider errors", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-cal-odds-"));
    const empty = await collectMicrodataset({
      transport: transportFromSeason(seasonPayload(seasonItems(25))),
      includeOdds: true,
      collectionTimestamp: "2026-09-18T00:00:00.000Z",
    });
    expect(empty.rows.every((row) => row.homeOdds == null)).toBe(true);
    expect(empty.metadata.oddsCoverageCount).toBe(0);
    expect(empty.metadata.oddsLogicalCalls).toBe(empty.rows.length);
    expect(empty.logicalCallCount).toBe(1 + empty.rows.length);
    const emptyOddsReport = evaluateCalibrationRows(empty.rows);
    expect(emptyOddsReport.scores).toHaveLength(empty.rows.length * 6);
    expect(emptyOddsReport.bookmakerMetrics.n).toBe(0);

    const throwing: MicrocollectTransport & { oddsCalls: number } = {
      oddsCalls: 0,
      async getFixtures() {
        return seasonPayload(seasonItems(25));
      },
      async getFixtureOdds() {
        this.oddsCalls += 1;
        throw new ApiFootballError({
          message: "Too many requests",
          code: "rate_limited",
          status: 429,
        });
      },
    };
    await expect(
      collectMicrodataset({
        transport: throwing,
        includeOdds: true,
        writeArtifacts: true,
        artifactDirectory: directory,
      }),
    ).rejects.toBeInstanceOf(MicrocollectOddsLookupError);
    expect(throwing.oddsCalls).toBe(1);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("aborts when an odds envelope contains vendor errors even if bookmakers are present", async () => {
    const items = seasonItems(25);
    const targetId = String(items[24]!.fixture.id);
    const transport = transportFromSeason(seasonPayload(items), {
      [targetId]: {
        get: "odds",
        errors: { plan: "This endpoint is not available on your plan" },
        results: 1,
        paging: { current: 1, total: 1 },
        response: oddsPayload("1.80", "3.50", "4.20").response,
      },
    });
    await expect(
      collectMicrodataset({
        transport,
        includeOdds: true,
      }),
    ).rejects.toBeInstanceOf(MicrocollectOddsLookupError);
  });

  it("stops collection when a fixture list throws quota/rate-limit and writes nothing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-cal-quota-"));
    const transport: MicrocollectTransport = {
      async getFixtures() {
        throw new ApiFootballError({
          message: "API-Football daily request quota is exhausted",
          code: "rate_limited",
          status: 429,
        });
      },
      async getFixtureOdds() {
        throw new Error("odds must not run after quota failure");
      },
    };
    await expect(
      collectMicrodataset({
        transport,
        includeOdds: true,
        writeArtifacts: true,
        artifactDirectory: directory,
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(readdirSync(directory)).toEqual([]);
  });
});

describe("Sprint 5B.3B.2 — logical call budget", () => {
  it("plans 16 logical lookups for 15 targets and still enforces the 30 ceiling", () => {
    expect(
      planMicrocollectionLogicalCalls({
        targetCount: MICROCOLLECTION_TARGET_COUNT,
      }).plannedLogicalCalls,
    ).toBe(16);
    expect(
      planMicrocollectionLogicalCalls({
        includeOdds: false,
      }).plannedLogicalCalls,
    ).toBe(1);
    expect(() =>
      planMicrocollectionLogicalCalls({
        targetCount: MICROCOLLECTION_LOGICAL_CALL_CEILING,
      }),
    ).toThrow(CallBudgetExceededError);
  });
});

describe("Sprint 5B.3B.2 — live transport is unpaged", () => {
  afterEach(() => {
    resetApiFootballQuotaCircuitForTests();
  });

  it("issues GET /fixtures without page and GET /odds with fixture", async () => {
    const fakeKey = "test-not-a-real-key";
    const seen: Array<{ path: string; params: string; headerNames: string[] }> =
      [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);
      seen.push({
        path: url.pathname,
        params: url.searchParams.toString(),
        headerNames: [...headers.keys()].map((name) => name.toLowerCase()).sort(),
      });
      if (url.pathname.endsWith("/odds")) {
        return new Response(
          JSON.stringify({
            get: "odds",
            results: 0,
            paging: { current: 1, total: 1 },
            response: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(seasonPayload(seasonItems(2))), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const transport = createLiveMicrocollectTransport(
      { API_FOOTBALL_KEY: fakeKey },
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        retry: false,
        rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
      },
    );
    await transport.getFixtures("39", "2024");
    expect(transport.getFixtureOdds).toBeTypeOf("function");
    await transport.getFixtureOdds!("1035089");
    expect(seen.map((entry) => `${entry.path}?${entry.params}`)).toEqual([
      "/fixtures?league=39&season=2024",
      "/odds?fixture=1035089",
    ]);
    expect(seen[0] && new URL(`https://x${seen[0].path}?${seen[0].params}`).searchParams.has("page")).toBe(
      false,
    );
    expect(seen.every((entry) => entry.headerNames.includes("x-apisports-key"))).toBe(
      true,
    );
    expect(JSON.stringify(seen)).not.toContain(fakeKey);
  });

  it("keeps production two-arg getFixturesByLeague unpaged", async () => {
    resetApiFootballQuotaCircuitForTests();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(seasonPayload([])), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = createApiFootballClient({
      apiKey: "test-not-a-real-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: false,
      rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
    });
    await client.getFixturesByLeague("39", "2024");
    const firstCall = fetchImpl.mock.calls[0] as unknown as [RequestInfo | URL];
    const url = new URL(String(firstCall[0]));
    expect(url.searchParams.has("page")).toBe(false);
    expect([...url.searchParams.keys()].sort()).toEqual(["league", "season"]);
  });
});

describe("Sprint 5B.3B.1 — empty-season fail-closed contract", () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  it("fails closed on response=[] and writes no artifacts or odds lookups", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-cal-empty-resp-"));
    const transport = transportFromSeason({
      get: "fixtures",
      paging: { current: 1, total: 1 },
      response: [],
    });
    await expect(
      collectMicrodataset({
        transport,
        includeOdds: true,
        writeArtifacts: true,
        artifactDirectory: directory,
      }),
    ).rejects.toBeInstanceOf(MicrocollectEmptySeasonError);
    expect(transport.calls).toEqual(["fixtures:39:2024"]);
    expect(transport.calls.some((call) => call.startsWith("odds:"))).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("fails closed on results=0", async () => {
    const transport = transportFromSeason(seasonPayload([]));
    await expect(
      collectMicrodataset({ transport, includeOdds: true }),
    ).rejects.toBeInstanceOf(MicrocollectEmptySeasonError);
    expect(transport.calls.some((call) => call.startsWith("odds:"))).toBe(false);
  });

  it("fails closed on non-empty API envelope errors", async () => {
    const transport = transportFromSeason({
      get: "fixtures",
      parameters: { league: "39", season: "2024" },
      errors: { page: "The Page field is not valid" },
      results: 0,
      paging: { current: 1, total: 1 },
      response: [],
    });
    await expect(
      collectMicrodataset({ transport, includeOdds: true }),
    ).rejects.toBeInstanceOf(MicrocollectVendorEnvelopeError);
    expect(transport.calls).toEqual(["fixtures:39:2024"]);
    expect(transport.calls.some((call) => call.startsWith("odds:"))).toBe(false);
  });

  it("fails when every returned fixture is ineligible", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-cal-noelig-"));
    const transport = transportFromSeason(seasonPayload(cancelledOnlyItems(8)));
    await expect(
      collectMicrodataset({
        transport,
        includeOdds: true,
        writeArtifacts: true,
        artifactDirectory: directory,
      }),
    ).rejects.toBeInstanceOf(MicrocollectNoEligibleTargetsError);
    expect(transport.calls.some((call) => call.startsWith("odds:"))).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("fails when fewer than 15 eligible targets exist", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-cal-short-"));
    const transport = transportFromSeason(seasonPayload(completedOnlyItems(10)));
    await expect(
      collectMicrodataset({
        transport,
        includeOdds: true,
        writeArtifacts: true,
        artifactDirectory: directory,
      }),
    ).rejects.toBeInstanceOf(MicrocollectTargetShortfallError);
    expect(transport.calls).toEqual(["fixtures:39:2024"]);
    expect(transport.calls.some((call) => call.startsWith("odds:"))).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("propagates a non-zero CLI exit code and writes nothing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-cal-cli-"));
    const transport = transportFromSeason(seasonPayload([]));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = 0;
    await reportMicrocollectCliResult(() =>
      collectMicrodataset({
        transport,
        includeOdds: true,
        writeArtifacts: true,
        artifactDirectory: directory,
      }),
    );
    expect(process.exitCode).toBe(1);
    expect(readdirSync(directory)).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("keeps the normal 15-target path and requests one odds lookup per selected target", async () => {
    const transport = transportFromSeason(seasonPayload(seasonItems(25)));
    const result = await collectMicrodataset({
      transport,
      includeOdds: true,
      collectionTimestamp: "2026-09-18T00:00:00.000Z",
    });
    expect(result.rows).toHaveLength(MICROCOLLECTION_TARGET_COUNT);
    expect(result.logicalCallCount).toBe(1 + MICROCOLLECTION_TARGET_COUNT);
    expect(
      transport.calls.filter((call) => call.startsWith("odds:")).length,
    ).toBe(MICROCOLLECTION_TARGET_COUNT);
    expect(transport.calls[0]).toBe("fixtures:39:2024");
  });
});
