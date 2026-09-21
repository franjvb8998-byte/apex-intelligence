import { describe, expect, it } from "vitest";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { DEFAULT_OPPORTUNITY_FILTERS, filterOpportunities } from "@/lib/apex-opportunities";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import type { IDataProvider } from "@/lib/data-platform/provider";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";
import type { ApexMatchStatus } from "@/lib/data-platform/types/match";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { loadUnlessQuota } from "@/lib/repositories";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import { createFixtureApiFootballClient } from "@/lib/data-platform/providers/api-football/fixture-client";
import {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballOddsResponse,
} from "@/lib/data-platform/providers/api-football/fixtures";
import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import type {
  ApiFootballFixtureItem,
  ApiFootballStatusShort,
} from "@/lib/data-platform/providers/api-football/types";

function quotaError() {
  return new ApiFootballError({
    message: "Your rate limit is 10 requests per minute.",
    code: "rate_limited",
    status: 429,
  });
}

async function templateBundle(): Promise<ApexMatchBundle> {
  return createMockDataProvider().getMatch({ matchId: DEMO_MATCH_EXTERNAL_ID });
}

function vendorShortForApex(status: ApexMatchStatus): string {
  if (status === "scheduled") return "NS";
  if (status === "live") return "LIVE";
  if (status === "finished") return "FT";
  if (status === "postponed") return "PST";
  if (status === "cancelled") return "CANC";
  if (status === "suspended") return "SUSP";
  return "UNKNOWN";
}

function catalogueRow(
  template: ApexMatchBundle,
  index: number,
  status: ApexMatchStatus = "scheduled",
): ApexMatchBundle {
  const externalId = `scan-${index}`;
  return {
    ...template,
    odds: [],
    match: {
      ...template.match,
      id: `apex:mock:match:${externalId}`,
      kickoffAt: `2027-08-15T${String(10 + (index % 10)).padStart(2, "0")}:00:00.000Z`,
      status,
      vendorStatusShort: vendorShortForApex(status),
      externalRefs: [{ provider: "mock", externalId }],
    },
  };
}

function oddsProvider(options: {
  rows: ApexMatchBundle[];
  getOdds: (externalId: string) => Promise<ApexMatchBundle["odds"]>;
  calls: string[];
}): IDataProvider {
  const byId = new Map(
    options.rows.map((row) => [row.match.externalRefs[0]!.externalId, row]),
  );
  return {
    id: "mock",
    displayName: "sprint-4-quota",
    async listFixtures() {
      return options.rows;
    },
    async getMatch(query) {
      const id = query.matchId;
      options.calls.push(id);
      const row = byId.get(id);
      if (!row) {
        throw new Error(`unknown fixture ${id}`);
      }
      return {
        ...row,
        odds: await options.getOdds(id),
      };
    },
  };
}

describe("APEX Opportunities loader", () => {
  it("does not publish the recorded finished fixture as a current opportunity", async () => {
    const board = await getApexOpportunities({ env: {} });
    expect(board.quotaExhausted).toBe(false);
    expect(
      board.analyzed.some((row) => row.fixtureId === RECORDED_API_FOOTBALL_FIXTURE_ID),
    ).toBe(false);
    expect(
      board.analyzed.every((row) => row.vendorStatusShort === "NS"),
    ).toBe(true);

    const quality = filterOpportunities(board.analyzed, DEFAULT_OPPORTUNITY_FILTERS);
    expect(Array.isArray(quality)).toBe(true);
  }, 30_000);
});

describe("APEX Opportunities quota partial results", () => {
  it("preserves completed rows in catalogue order after a later quota error", async () => {
    const template = await templateBundle();
    const rows = Array.from({ length: 7 }, (_, index) =>
      catalogueRow(template, index),
    );
    const complete = await getApexOpportunities({
      provider: oddsProvider({
        rows,
        calls: [],
        getOdds: async () => template.odds,
      }),
    });
    expect(complete.quotaExhausted).toBe(false);
    expect(complete.analyzed.map((row) => row.fixtureId)).toEqual(
      rows.map((row) => row.match.externalRefs[0]!.externalId),
    );

    let releaseSlow: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    const calls: string[] = [];
    const partial = await getApexOpportunities({
      provider: oddsProvider({
        rows,
        calls,
        getOdds: async (id) => {
          if (id === "scan-4") {
            queueMicrotask(() => releaseSlow());
            throw quotaError();
          }
          if (id === "scan-5") {
            await slow;
            return template.odds;
          }
          return template.odds;
        },
      }),
    });

    expect(partial.quotaExhausted).toBe(true);
    expect(partial.analyzed.map((row) => row.fixtureId)).toEqual([
      "scan-0",
      "scan-1",
      "scan-2",
      "scan-3",
      "scan-5",
    ]);
    expect(calls).toHaveLength(6);
    expect(calls).not.toContain("scan-6");

    for (const id of ["scan-0", "scan-1", "scan-2", "scan-3", "scan-5"] as const) {
      const kept = partial.analyzed.find((row) => row.fixtureId === id);
      const control = complete.analyzed.find((row) => row.fixtureId === id);
      expect(kept?.score).toBe(control?.score);
      expect(kept?.expectedValue).toBe(control?.expectedValue);
      expect(kept?.bookmakerOdds).toBe(control?.bookmakerOdds);
    }

    const loaded = await loadUnlessQuota(async () => partial);
    expect(loaded).toEqual({ ok: true, data: partial });
  }, 30_000);

  it("returns unavailable when the first wave has no successful workers", async () => {
    const template = await templateBundle();
    const rows = Array.from({ length: 6 }, (_, index) =>
      catalogueRow(template, index),
    );
    const calls: string[] = [];
    const board = await getApexOpportunities({
      provider: oddsProvider({
        rows,
        calls,
        getOdds: async () => {
          throw quotaError();
        },
      }),
    });

    expect(board.quotaExhausted).toBe(true);
    expect(board.analyzed).toEqual([]);
    expect(new Set(calls)).toEqual(new Set(["scan-0", "scan-1", "scan-2"]));
    expect(calls).not.toContain("scan-3");
  }, 30_000);

  it("publishes a normal row when odds are a legitimate empty list", async () => {
    const template = await templateBundle();
    const rows = Array.from({ length: 4 }, (_, index) =>
      catalogueRow(template, index),
    );
    const board = await getApexOpportunities({
      provider: oddsProvider({
        rows,
        calls: [],
        getOdds: async (id) => (id === "scan-0" ? [] : template.odds),
      }),
    });

    expect(board.quotaExhausted).toBe(false);
    expect(board.analyzed.map((row) => row.fixtureId)).toEqual([
      "scan-0",
      "scan-1",
      "scan-2",
      "scan-3",
    ]);
    const emptyOdds = board.analyzed[0]!;
    // Vendor returned no book; impliedOdds may still be model fair odds.
    expect(
      emptyOdds.bookmakerOdds == null ||
        emptyOdds.bookmakerOdds === emptyOdds.fairOdds,
    ).toBe(true);
  }, 30_000);

  it("swallows non-quota odds errors into empty odds without marking quota", async () => {
    const template = await templateBundle();
    const rows = Array.from({ length: 4 }, (_, index) =>
      catalogueRow(template, index),
    );
    const board = await getApexOpportunities({
      provider: oddsProvider({
        rows,
        calls: [],
        getOdds: async (id) => {
          if (id === "scan-0") throw new Error("timeout");
          return template.odds;
        },
      }),
    });

    expect(board.quotaExhausted).toBe(false);
    expect(board.analyzed.map((row) => row.fixtureId)).toEqual([
      "scan-0",
      "scan-1",
      "scan-2",
      "scan-3",
    ]);
    expect(
      board.analyzed[0]?.bookmakerOdds == null ||
        board.analyzed[0]?.bookmakerOdds === board.analyzed[0]?.fairOdds,
    ).toBe(true);
  }, 30_000);

  it("still throws when catalogue loading itself hits quota", async () => {
    const quota = quotaError();
    const provider: IDataProvider = {
      id: "api-football",
      displayName: "API-Football",
      async getMatch() {
        throw quota;
      },
      async listFixtures() {
        throw quota;
      },
    };

    await expect(getApexOpportunities({ provider })).rejects.toSatisfy(
      (error: unknown) => error === quota,
    );
    const loaded = await loadUnlessQuota(() =>
      getApexOpportunities({ provider }),
    );
    expect(loaded).toEqual({ ok: false, quota: true });
  });
});

const ENRICHMENT_CLIENT_METHODS = [
  "getTeamStatistics",
  "getHeadToHead",
  "getInjuries",
  "getTeamLastFixtures",
  "getLineups",
  "getStandings",
  "getEvents",
  "getFixture",
  "getFixtureById",
] as const;

function cloneCatalogueItem(
  index: number,
  short: ApiFootballStatusShort,
): ApiFootballFixtureItem {
  const base = createRecordedApiFootballFixturesResponse().response[0]!;
  return {
    ...base,
    fixture: {
      ...base.fixture,
      id: 7000 + index,
      date: `2027-08-15T${String(12 + (index % 10)).padStart(2, "0")}:00:00+00:00`,
      status: {
        long: String(short),
        short,
        elapsed: short === "NS" || short === "TBD" ? null : 45,
      },
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

function extrasCatalogueProvider(options: {
  items: ApiFootballFixtureItem[];
  calls: string[];
}): ApiFootballDataProvider {
  const inner = createFixtureApiFootballClient();
  const client = withCallLog(inner, options.calls, {
    getFixturesByDate: async (date) => ({
      ...createRecordedApiFootballFixturesResponse(),
      parameters: { date },
      results: options.items.length,
      response: options.items,
    }),
    getFixtureOdds: async () => createRecordedApiFootballOddsResponse(),
  });
  return new ApiFootballDataProvider({
    client,
    enrichMatch: true,
    useCache: false,
  });
}

describe("APEX Opportunities terminal odds skip", () => {
  it("does not request odds for a finished fixture and does not publish it as current", async () => {
    const template = await templateBundle();
    const rows = [catalogueRow(template, 0, "finished")];
    const calls: string[] = [];
    const board = await getApexOpportunities({
      provider: oddsProvider({
        rows,
        calls,
        getOdds: async () => template.odds,
      }),
    });

    expect(calls).toEqual([]);
    expect(board.quotaExhausted).toBe(false);
    expect(board.analyzed).toEqual([]);
  }, 30_000);

  it("still requests odds for scheduled and live fixtures but only publishes actionable prematch", async () => {
    const template = await templateBundle();
    const rows = [
      catalogueRow(template, 0, "scheduled"),
      catalogueRow(template, 1, "live"),
    ];
    const calls: string[] = [];
    const board = await getApexOpportunities({
      provider: oddsProvider({
        rows,
        calls,
        getOdds: async () => template.odds,
      }),
    });

    expect(calls.sort()).toEqual(["scan-0", "scan-1"]);
    expect(board.quotaExhausted).toBe(false);
    expect(board.analyzed.map((row) => row.fixtureId)).toEqual(["scan-0"]);
    expect(board.analyzed[0]?.bookmakerOdds).not.toBeNull();
  }, 30_000);

  it("does not skip postponed, suspended, or unknown fixtures", async () => {
    const template = await templateBundle();
    const rows = [
      catalogueRow(template, 0, "postponed"),
      catalogueRow(template, 1, "suspended"),
      catalogueRow(template, 2, "unknown"),
    ];
    const calls: string[] = [];
    await getApexOpportunities({
      provider: oddsProvider({
        rows,
        calls,
        getOdds: async () => template.odds,
      }),
    });
    expect(calls.sort()).toEqual(["scan-0", "scan-1", "scan-2"]);
  }, 30_000);

  it("requests odds only for non-terminal rows in a mixed catalogue of 20", async () => {
    const template = await templateBundle();
    const rows = Array.from({ length: 20 }, (_, index) =>
      catalogueRow(
        template,
        index,
        index < 5 ? "finished" : "scheduled",
      ),
    );
    const eligibleRows = rows.filter((row) => row.match.status === "scheduled");
    const complete = await getApexOpportunities({
      provider: oddsProvider({
        rows: eligibleRows,
        calls: [],
        getOdds: async () => template.odds,
      }),
    });

    const calls: string[] = [];
    const mixed = await getApexOpportunities({
      provider: oddsProvider({
        rows,
        calls,
        getOdds: async () => template.odds,
      }),
    });

    expect(calls).toHaveLength(15);
    expect(calls).not.toContain("scan-0");
    expect(calls).not.toContain("scan-4");
    expect(calls).toContain("scan-5");
    expect(mixed.quotaExhausted).toBe(false);
    expect(mixed.analyzed).toHaveLength(15);

    for (const control of complete.analyzed) {
      const kept = mixed.analyzed.find((row) => row.fixtureId === control.fixtureId);
      expect(kept?.score).toBe(control.score);
      expect(kept?.expectedValue).toBe(control.expectedValue);
      expect(kept?.bookmakerOdds).toBe(control.bookmakerOdds);
    }
  }, 30_000);
});

describe("APEX Opportunities call-budget characterization", () => {
  async function scanCatalogue(
    items: ApiFootballFixtureItem[],
  ): Promise<{ calls: string[]; odds: string[]; enrich: string[] }> {
    const calls: string[] = [];
    await getApexOpportunities({
      provider: extrasCatalogueProvider({ items, calls }),
    });
    return {
      calls,
      odds: calls.filter((name) => name === "getFixtureOdds"),
      enrich: calls.filter((name) =>
        (ENRICHMENT_CLIENT_METHODS as readonly string[]).includes(name),
      ),
    };
  }

  it("CASE 1: 20 non-terminal fixtures → 1 catalogue + 20 odds, no full enrich", async () => {
    const items = Array.from({ length: 20 }, (_, index) =>
      cloneCatalogueItem(index, "NS"),
    );
    const { calls, odds, enrich } = await scanCatalogue(items);
    expect(calls.filter((name) => name === "getFixturesByDate")).toHaveLength(1);
    expect(odds).toHaveLength(20);
    expect(enrich).toEqual([]);
  }, 30_000);

  it("CASE 2: 20 fixtures with 5 terminal → 1 catalogue + 15 odds", async () => {
    const items = [
      ...Array.from({ length: 5 }, (_, index) =>
        cloneCatalogueItem(index, "FT"),
      ),
      ...Array.from({ length: 15 }, (_, index) =>
        cloneCatalogueItem(index + 5, "NS"),
      ),
    ];
    const { calls, odds, enrich } = await scanCatalogue(items);
    expect(calls.filter((name) => name === "getFixturesByDate")).toHaveLength(1);
    expect(odds).toHaveLength(15);
    expect(enrich).toEqual([]);
  }, 30_000);

  it("CASE 3: 1/2/3 scheduled fixtures stay on the odds-only path", async () => {
    for (const count of [1, 2, 3, 4] as const) {
      const items = Array.from({ length: count }, (_, index) =>
        cloneCatalogueItem(index, "NS"),
      );
      const { calls, odds, enrich } = await scanCatalogue(items);
      expect(calls.filter((name) => name === "getFixturesByDate")).toHaveLength(
        1,
      );
      expect(odds).toHaveLength(count);
      expect(enrich).toEqual([]);
    }
  }, 30_000);

  it("CASE 4: 3 terminal fixtures → catalogue only", async () => {
    const items = [
      cloneCatalogueItem(0, "FT"),
      cloneCatalogueItem(1, "AET"),
      cloneCatalogueItem(2, "CANC"),
    ];
    const { calls, odds, enrich } = await scanCatalogue(items);
    expect(calls.filter((name) => name === "getFixturesByDate")).toHaveLength(1);
    expect(odds).toEqual([]);
    expect(enrich).toEqual([]);
  }, 30_000);

  it("keeps Scanner scores equivalent for the same scheduled inputs at 3 vs 4 fixtures", async () => {
    const three = Array.from({ length: 3 }, (_, index) =>
      cloneCatalogueItem(index, "NS"),
    );
    const four = [
      ...three,
      cloneCatalogueItem(3, "NS"),
    ];
    const board3 = await getApexOpportunities({
      provider: extrasCatalogueProvider({ items: three, calls: [] }),
    });
    const board4 = await getApexOpportunities({
      provider: extrasCatalogueProvider({ items: four, calls: [] }),
    });
    const shared = board3.analyzed.map((row) => row.fixtureId);
    expect(shared).toHaveLength(3);
    for (const id of shared) {
      const a = board3.analyzed.find((row) => row.fixtureId === id);
      const b = board4.analyzed.find((row) => row.fixtureId === id);
      expect(a?.score).toBe(b?.score);
      expect(a?.expectedValue).toBe(b?.expectedValue);
      expect(a?.bookmakerOdds).toBe(b?.bookmakerOdds);
    }
  }, 30_000);
});
