import { describe, expect, it } from "vitest";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { DEFAULT_OPPORTUNITY_FILTERS, filterOpportunities } from "@/lib/apex-opportunities";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import type { IDataProvider } from "@/lib/data-platform/provider";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { loadUnlessQuota } from "@/lib/repositories";

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

function catalogueRow(
  template: ApexMatchBundle,
  index: number,
): ApexMatchBundle {
  const externalId = `scan-${index}`;
  return {
    ...template,
    odds: [],
    match: {
      ...template.match,
      id: `apex:mock:match:${externalId}`,
      kickoffAt: `2026-08-15T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
      status: "scheduled",
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
  it("evaluates the recorded catalogue through the Decision Engine", async () => {
    const board = await getApexOpportunities({ env: {} });
    expect(board.quotaExhausted).toBe(false);
    expect(board.analyzed.length).toBeGreaterThanOrEqual(1);
    expect(
      board.analyzed.some((row) => row.fixtureId === RECORDED_API_FOOTBALL_FIXTURE_ID),
    ).toBe(true);
    const first = board.analyzed[0]!;
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(first.score).toBeLessThanOrEqual(100);
    expect(first.confidence).toBeGreaterThanOrEqual(0);
    expect(first.market).toBe("1x2");
    expect(first.verdict).toBeTruthy();

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
    expect(emptyOdds.bookmakerOdds).toBeNull();
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
    expect(board.analyzed[0]?.bookmakerOdds).toBeNull();
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
