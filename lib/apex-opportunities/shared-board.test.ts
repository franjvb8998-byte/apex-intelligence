import { afterEach, describe, expect, it } from "vitest";
import {
  getApexOpportunities,
  getApexOpportunitiesComputeCountForTests,
  resetApexOpportunitiesComputeCountForTests,
} from "@/lib/apex-opportunities/load";
import {
  resetApexOpportunitiesShareForTests,
  shareApexOpportunitiesBoard,
  snapshotApexOpportunitiesBoard,
} from "@/lib/apex-opportunities/shared-board";
import type { ApexOpportunitiesBoard } from "@/lib/apex-opportunities/types";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { IDataProvider } from "@/lib/data-platform/provider";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";

afterEach(() => {
  resetApexOpportunitiesShareForTests();
  resetApexOpportunitiesComputeCountForTests();
});

function quotaError() {
  return new ApiFootballError({
    message: "Your rate limit is 10 requests per minute.",
    code: "rate_limited",
    status: 429,
  });
}

function board(partial: Partial<ApexOpportunitiesBoard> = {}): ApexOpportunitiesBoard {
  return {
    generatedAt: "2026-09-18T12:00:00.000Z",
    analyzed: [],
    quotaExhausted: false,
    ...partial,
  };
}

describe("shareApexOpportunitiesBoard", () => {
  it("runs the loader once for concurrent identical keys", async () => {
    let loads = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = async () => {
      loads += 1;
      await gate;
      return board({ generatedAt: `n-${loads}` });
    };
    const pending = Promise.all([
      shareApexOpportunitiesBoard("apex:scan:day", load),
      shareApexOpportunitiesBoard("apex:scan:day", load),
    ]);
    release();
    const [a, b] = await pending;
    expect(loads).toBe(1);
    expect(a.generatedAt).toBe("n-1");
    expect(b.generatedAt).toBe("n-1");
  });

  it("does not share different keys", async () => {
    let loads = 0;
    await Promise.all([
      shareApexOpportunitiesBoard("day-a", async () => {
        loads += 1;
        return board({ generatedAt: "a" });
      }),
      shareApexOpportunitiesBoard("day-b", async () => {
        loads += 1;
        return board({ generatedAt: "b" });
      }),
    ]);
    expect(loads).toBe(2);
  });

  it("propagates quotaExhausted to every waiter of the shared promise", async () => {
    const loaded = board({ quotaExhausted: true });
    const [a, b] = await Promise.all([
      shareApexOpportunitiesBoard("quota", async () => loaded),
      shareApexOpportunitiesBoard("quota", async () => loaded),
    ]);
    expect(a.quotaExhausted).toBe(true);
    expect(b.quotaExhausted).toBe(true);
    a.quotaExhausted = false;
    expect(b.quotaExhausted).toBe(true);
  });

  it("clones so one consumer cannot corrupt another", async () => {
    const shared = await shareApexOpportunitiesBoard("mutate", async () =>
      board({
        analyzed: [
          {
            fixtureId: "1",
            kickoffAt: "2026-09-18T15:00:00.000Z",
            leagueName: "Premier League",
            country: "England",
            market: "1x2",
            home: { name: "A", shortName: "A", logoUrl: null },
            away: { name: "B", shortName: "B", logoUrl: null },
            predicted: "home",
            selectionLabel: "A",
            score: 80,
            stars: 4,
            confidence: 70,
            confidenceBand: "high",
            riskBand: "low",
            riskScore: 10,
            fairOdds: 1.8,
            bookmakerOdds: 2,
            valuePct: 0.1,
            expectedValue: 0.1,
            marketEdge: 0.1,
            kellyPct: 0.05,
            stakePct: 0.02,
            stakeLabel: "2%",
            recommendation: "Elite",
            verdict: "elite_pick",
            verdictLabel: "Elite",
            explanation: "test",
            reasonsFor: [],
            reasonsAgainst: [],
            positiveEdge: true,
          },
        ],
      }),
    );
    const copy = snapshotApexOpportunitiesBoard(shared);
    shared.analyzed.pop();
    expect(copy.analyzed).toHaveLength(1);
    expect(shared.analyzed).toHaveLength(0);
  });
});

describe("getApexOpportunities default sharing", () => {
  it("computes once for two default product consumers", async () => {
    const [a, b] = await Promise.all([
      getApexOpportunities(),
      getApexOpportunities(),
    ]);
    expect(getApexOpportunitiesComputeCountForTests()).toBe(1);
    expect(a.analyzed.map((row) => row.fixtureId)).toEqual(
      b.analyzed.map((row) => row.fixtureId),
    );
    expect(a.quotaExhausted).toBe(b.quotaExhausted);
    expect(a.analyzed[0]?.score).toBe(b.analyzed[0]?.score);
    expect(a.analyzed[0]?.expectedValue).toBe(b.analyzed[0]?.expectedValue);
  }, 30_000);

  it("does not share an injected provider with the default board", async () => {
    const template = await createMockDataProvider().getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });
    const provider: IDataProvider = {
      id: "mock",
      displayName: "isolated",
      async listFixtures() {
        return [template];
      },
      async getMatch() {
        return template;
      },
    };
    await Promise.all([
      getApexOpportunities(),
      getApexOpportunities({ provider }),
    ]);
    expect(getApexOpportunitiesComputeCountForTests()).toBe(2);
  }, 30_000);

  it("does not share custom env with the default board", async () => {
    await Promise.all([
      getApexOpportunities(),
      getApexOpportunities({ env: {} }),
    ]);
    expect(getApexOpportunitiesComputeCountForTests()).toBe(2);
  }, 30_000);

  it("propagates partial quotaExhausted to every waiter", async () => {
    const template = await createMockDataProvider().getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });
    const row: ApexMatchBundle = {
      ...template,
      odds: [],
      match: {
        ...template.match,
        status: "scheduled",
        externalRefs: [{ provider: "mock", externalId: "q-1" }],
      },
    };
    const provider: IDataProvider = {
      id: "mock",
      displayName: "quota",
      async listFixtures() {
        return [row];
      },
      async getMatch() {
        throw quotaError();
      },
    };
    const [a, b] = await Promise.all([
      getApexOpportunities({ provider }),
      getApexOpportunities({ provider }),
    ]);
    expect(a.quotaExhausted).toBe(true);
    expect(b.quotaExhausted).toBe(true);
    expect(a.analyzed).toEqual(b.analyzed);
  }, 30_000);

  it("returns isolated clones from the default share", async () => {
    const [a, b] = await Promise.all([
      getApexOpportunities(),
      getApexOpportunities(),
    ]);
    const before = b.analyzed.length;
    a.analyzed.splice(0, a.analyzed.length);
    expect(b.analyzed.length).toBe(before);
  }, 30_000);
});
