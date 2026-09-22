import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import type { IDataProvider } from "@/lib/data-platform/provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import * as probability from "@/lib/intelligence/modules/probability";
import { getMatchAnalysisData } from "@/lib/match-analysis/load";
import { attachPrematchDecisionTicket } from "@/lib/prematch-decision/attach";
import { createPrematchDecisionTicket } from "@/lib/prematch-decision/create";
import { captureScannerPrematchTicket } from "@/lib/prematch-decision/from-scanner";
import { prematchDecisionTicketId } from "@/lib/prematch-decision/identity";
import { clonePrematchDecisionTicket } from "@/lib/prematch-decision/serialize";
import {
  InMemoryPrematchDecisionTicketBackend,
  InMemoryPrematchDecisionTicketStore,
  LayeredPrematchDecisionTicketStore,
  UnavailablePrematchDecisionTicketBackend,
  resetPrematchDecisionTicketStoreForTests,
} from "@/lib/prematch-decision/store";
import type {
  PrematchPublishedSnapshot,
  PrematchPublishedScoring,
} from "@/lib/prematch-decision/ticket";
import { CANONICAL_CAPTURE_WINDOW_MINUTES } from "@/lib/prematch-decision/window";

const KICKOFF = "2026-09-21T15:00:00.000Z";
const HOME_P = 0.42;

function minutesBeforeKickoff(minutes: number): string {
  return new Date(Date.parse(KICKOFF) - minutes * 60 * 1000).toISOString();
}

const T121 = minutesBeforeKickoff(CANONICAL_CAPTURE_WINDOW_MINUTES + 1);
const T120 = minutesBeforeKickoff(CANONICAL_CAPTURE_WINDOW_MINUTES);
const T60 = minutesBeforeKickoff(60);
const T1 = minutesBeforeKickoff(1);
const AT = KICKOFF;
const AFTER = "2026-09-21T15:00:00.001Z";

function scoring(
  overrides: Partial<PrematchPublishedScoring> = {},
): PrematchPublishedScoring {
  return {
    apexScore: 71,
    confidence: 64,
    confidenceBand: "medium",
    riskScore: 38,
    riskBand: "medium",
    expectedValue: 0.029,
    recommendationTier: "Value Bet",
    recommendationKind: "lean_bet",
    selectionId: "home",
    selectionLabel: "Home FC",
    kellyFraction: 0.02,
    kellyPct: 2,
    stakePct: 2,
    stakeLabel: "2%",
    fairOdds: 1 / HOME_P,
    offeredOdds: 2.45,
    impliedProbability: 1 / 2.45,
    bookmaker: "Pinnacle",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<PrematchPublishedSnapshot> = {},
): PrematchPublishedSnapshot {
  return {
    fixtureId: "1035089",
    homeTeamId: "home-1",
    awayTeamId: "away-1",
    homeTeamName: "Home FC",
    awayTeamName: "Away FC",
    kickoffUtc: KICKOFF,
    vendorStatusShort: "NS",
    sourceMode: "published-snapshot",
    markets: [
      {
        marketId: "1x2",
        marketLine: null,
        selections: [
          { selectionId: "home", selectionLabel: "Home", modelProbability: HOME_P },
          { selectionId: "draw", selectionLabel: "Draw", modelProbability: 0.28 },
          { selectionId: "away", selectionLabel: "Away", modelProbability: 0.3 },
        ],
      },
    ],
    quotes: [
      {
        marketId: "1x2",
        selectionId: "home",
        bookmaker: "Pinnacle",
        offeredOdds: 2.45,
        impliedProbability: 1 / 2.45,
      },
    ],
    scoring: scoring(),
    ...overrides,
  };
}

async function create(
  published: PrematchPublishedSnapshot,
  clock: string,
  store: InMemoryPrematchDecisionTicketStore | LayeredPrematchDecisionTicketStore,
) {
  return createPrematchDecisionTicket({ published, clock, store });
}

describe("PrematchDecisionTicket durability + capture window", () => {
  let memory: InMemoryPrematchDecisionTicketStore;

  beforeEach(() => {
    resetPrematchDecisionTicketStoreForTests();
    memory = new InMemoryPrematchDecisionTicketStore();
  });

  afterEach(() => {
    resetPrematchDecisionTicketStoreForTests();
  });

  it("A. T-121 does not capture", async () => {
    const result = await create(snapshot(), T121, memory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("TOO_EARLY_FOR_CANONICAL_CAPTURE");
    expect(await memory.getByFixtureId("1035089")).toBeNull();
  });

  it("B. T-120 allows capture", async () => {
    const result = await create(snapshot(), T120, memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("created");
  });

  it("C. T-60 allows capture", async () => {
    const result = await create(snapshot(), T60, memory);
    expect(result.ok).toBe(true);
  });

  it("D. T-1 allows capture", async () => {
    const result = await create(snapshot(), T1, memory);
    expect(result.ok).toBe(true);
  });

  it("E. exact kickoff is rejected", async () => {
    const result = await create(snapshot(), AT, memory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("KICKOFF_REACHED");
  });

  it("F. stale NS after kickoff is rejected", async () => {
    const result = await create(snapshot(), AFTER, memory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("KICKOFF_REACHED");
  });

  it("G. live is rejected", async () => {
    const result = await create(snapshot({ vendorStatusShort: "1H" }), T60, memory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("STATUS_NOT_PREMATCH");
  });

  it("H. FT is rejected", async () => {
    const result = await create(snapshot({ vendorStatusShort: "FT" }), T60, memory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("STATUS_NOT_PREMATCH");
  });

  it("I. unknown status is rejected", async () => {
    const result = await create(snapshot({ vendorStatusShort: "ZZZ" }), T60, memory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("STATUS_UNKNOWN");
  });

  it("J. invalid kickoff is rejected", async () => {
    const result = await create(snapshot({ kickoffUtc: "nope" }), T60, memory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("KICKOFF_MISSING_OR_INVALID");
  });

  it("K. durable insert succeeds", async () => {
    const durable = new InMemoryPrematchDecisionTicketBackend();
    const store = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      durable,
    );
    const result = await create(snapshot(), T60, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("created");
    const stored = await durable.getByTicketId(result.ticket.ticketId);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.ticket?.fixtureId).toBe("1035089");
  });

  it("L. duplicate insert returns existing canonical ticket", async () => {
    const first = await create(snapshot(), T60, memory);
    const second = await create(snapshot(), T60, memory);
    expect(first.ok && first.status).toBe("created");
    expect(second.ok && second.status).toBe("idempotent");
    if (!first.ok || !second.ok) return;
    expect(second.ticket).toBe(first.ticket);
  });

  it("M. duplicate with changed probability cannot overwrite", async () => {
    const first = await create(snapshot(), T60, memory);
    expect(first.ok).toBe(true);
    const second = await create(
      snapshot({
        markets: [
          {
            marketId: "1x2",
            marketLine: null,
            selections: [
              { selectionId: "home", selectionLabel: "Home", modelProbability: 0.91 },
            ],
          },
        ],
      }),
      T60,
      memory,
    );
    expect(second.ok && second.status).toBe("idempotent");
    if (!first.ok || !second.ok) return;
    expect(
      second.ticket.selections.find((row) => row.selectionId === "home")
        ?.modelProbability,
    ).toBe(HOME_P);
  });

  it("N. duplicate with changed odds cannot overwrite", async () => {
    await create(snapshot(), T60, memory);
    const second = await create(
      snapshot({
        quotes: [
          {
            marketId: "1x2",
            selectionId: "home",
            bookmaker: "Bet365",
            offeredOdds: 9.9,
            impliedProbability: 1 / 9.9,
          },
        ],
      }),
      T60,
      memory,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(
      second.ticket.selections.find((row) => row.selectionId === "home")?.offeredOdds,
    ).toBe(2.45);
  });

  it("O. duplicate with changed recommendation cannot overwrite", async () => {
    await create(snapshot(), T60, memory);
    const second = await create(
      snapshot({
        scoring: scoring({ recommendationTier: "Avoid", apexScore: 1 }),
      }),
      T60,
      memory,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.ticket.scoring?.recommendationTier).toBe("Value Bet");
    expect(second.ticket.scoring?.apexScore).toBe(71);
  });

  it("P. process-memory loss + durable read recovers ticket", async () => {
    const durable = new InMemoryPrematchDecisionTicketBackend();
    const first = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      durable,
    );
    const created = await create(snapshot(), T60, first);
    expect(created.ok).toBe(true);
    const recovered = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      durable,
    );
    const found = await recovered.getByFixtureId("1035089");
    expect(found?.ticketId).toBe(prematchDecisionTicketId("1035089"));
    expect(
      found?.selections.find((row) => row.selectionId === "home")?.modelProbability,
    ).toBe(HOME_P);
  });

  it("Q. two simulated writers produce one canonical winner", async () => {
    const durable = new InMemoryPrematchDecisionTicketBackend();
    const writerA = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      durable,
    );
    const writerB = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      durable,
    );
    const a = await create(snapshot(), T60, writerA);
    const mutated = snapshot({
      markets: [
        {
          marketId: "1x2",
          marketLine: null,
          selections: [
            { selectionId: "home", selectionLabel: "Home", modelProbability: 0.11 },
          ],
        },
      ],
    });
    const b = await create(mutated, T60, writerB);
    expect(a.ok && a.status).toBe("created");
    expect(b.ok && b.status).toBe("idempotent");
    if (!a.ok || !b.ok) return;
    expect(
      b.ticket.selections.find((row) => row.selectionId === "home")?.modelProbability,
    ).toBe(HOME_P);
    const durableRow = await durable.getByTicketId(a.ticket.ticketId);
    expect(durableRow.ok).toBe(true);
    if (!durableRow.ok) return;
    expect(durableRow.ticket?.ticketId).toBe(a.ticket.ticketId);
  });

  it("R. durable failure is not reported as durable success", async () => {
    const store = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      new UnavailablePrematchDecisionTicketBackend(),
    );
    const result = await create(snapshot(), T60, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe("durable_unavailable");
    expect(result.reason).toBe("DURABLE_STORE_UNAVAILABLE");
    expect(result.ticket).toBeNull();
    expect(await store.getByFixtureId("1035089")).toBeNull();
  });

  it("S. Scanner capture does not invoke PE a second time", async () => {
    const spy = vi.spyOn(probability, "createEloPoissonHybridEngine");
    const result = await captureScannerPrematchTicket({
      published: snapshot(),
      clock: T60,
      store: memory,
    });
    expect(result?.ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("T. Scanner capture causes zero provider calls", async () => {
    const provider: IDataProvider = {
      id: "mock",
      displayName: "capture-spy",
      listFixtures: vi.fn(async () => []),
      getMatch: vi.fn(async () => {
        throw new Error("provider should not be called");
      }),
    };
    await captureScannerPrematchTicket({
      published: snapshot(),
      clock: T60,
      store: memory,
    });
    expect(provider.listFixtures).not.toHaveBeenCalled();
    expect(provider.getMatch).not.toHaveBeenCalled();
  });

  it("U. Scanner board does not publish if ticket persistence fails", async () => {
    const template = await createMockDataProvider().getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });
    const kickoffAt = "2027-08-15T15:00:00.000Z";
    const nowUtc = "2027-08-15T14:00:00.000Z";
    const row: ApexMatchBundle = {
      ...template,
      match: {
        ...template.match,
        kickoffAt,
        status: "scheduled",
        vendorStatusShort: "NS",
      },
    };
    const throwing = {
      async getByTicketId() {
        throw new Error("ticket store down");
      },
      async getByFixtureId() {
        throw new Error("ticket store down");
      },
      async insertIfAbsent() {
        throw new Error("ticket store down");
      },
      async confirmDurableByTicketId() {
        throw new Error("ticket store down");
      },
      async listByKickoffRange() {
        throw new Error("ticket store down");
      },
      clear() {},
    };
    const board = await getApexOpportunities({
      provider: {
        id: "mock",
        displayName: "persist-fail",
        async listFixtures() {
          return [row];
        },
        async getMatch() {
          return row;
        },
      },
      ticketStore: throwing,
      nowUtc,
    });
    expect(board.analyzed).toEqual([]);
  });

  it("V. Match Analysis lookup finds frozen ticket after kickoff", async () => {
    const created = await create(
      snapshot({ fixtureId: RECORDED_API_FOOTBALL_FIXTURE_ID }),
      T60,
      memory,
    );
    expect(created.ok).toBe(true);
    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
      ticketStore: memory,
    });
    expect(data.vendorStatusShort).toBe("FT");
    expect(data.frozenPrematchDecision?.ticketId).toBe(
      prematchDecisionTicketId(RECORDED_API_FOOTBALL_FIXTURE_ID),
    );
  });

  it("W. Match Analysis cannot recreate a missing ticket after kickoff", async () => {
    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
      ticketStore: memory,
    });
    expect(data.frozenPrematchDecision).toBeNull();
    expect(await memory.getByFixtureId(RECORDED_API_FOOTBALL_FIXTURE_ID)).toBeNull();
  });

  it("X. Match Analysis safety-net works in window", async () => {
    const liveAnalysis = {
      matchId: "1035089",
      kickoffAt: KICKOFF,
      vendorStatusShort: "NS",
      homeTeam: { id: "home-1", name: "Home FC", shortName: "H", logoUrl: null },
      awayTeam: { id: "away-1", name: "Away FC", shortName: "A", logoUrl: null },
      oneXTwo: { home: HOME_P, draw: 0.28, away: 0.3 },
      predictedOutcome: "home",
      markets: [
        {
          id: "m-1x2",
          label: "1X2",
          type: "1x2",
          line: null,
          selections: [
            { key: "home", label: "Home", probability: HOME_P },
          ],
        },
      ],
      expectedGoals: { home: 1.4, away: 1.1, total: 2.5 },
      modelVersion: "test",
      decision: {
        selectionLabel: "Home FC",
        score: { value: 71, coverage: 1, label: "Value Bet", components: [] },
        confidence: { value: 64, band: "medium", caption: "" },
        risk: { score: 38, band: "medium", reasons: [] },
        value: {
          modelProbability: HOME_P,
          fairOdds: 1 / HOME_P,
          impliedOdds: 2.45,
          expectedValue: 0.029,
          marketProbability: 1 / 2.45,
          valuePct: null,
          marketEdge: null,
          positiveEdge: true,
          negativeEdge: false,
        },
        sizing: {
          kellyFraction: 0.02,
          kellyPct: 2,
          stakePct: 2,
          stakeLabel: "2%",
        },
        verdict: { kind: "lean_bet", label: "Value Bet", stars: 3 },
        reasonsFor: [],
        reasonsAgainst: [],
        explanation: "",
        engineId: "deterministic-v1",
        predicted: "home",
      },
      report: { market: { bookmaker: "Pinnacle" } },
      scoring: {
        overall: 71,
        selectionLabel: "Home FC",
        recommendation: { tier: "Value Bet", stars: 3, note: "" },
      },
      recentMatches: { home: [], away: [] },
      leaguePosition: { home: null, away: null },
      matchMetrics: { home: null, away: null },
      h2h: [],
      risks: [],
    };
    const attached = await attachPrematchDecisionTicket(
      liveAnalysis as never,
      { store: memory, nowUtc: T60 },
    );
    expect(attached.frozenPrematchDecision?.fixtureId).toBe("1035089");
    expect(
      attached.frozenPrematchDecision?.selections.find((row) => row.selectionId === "home")
        ?.modelProbability,
    ).toBe(HOME_P);
  });

  it("Y. missing odds remain missing", async () => {
    const result = await create(
      snapshot({
        quotes: [],
        scoring: scoring({
          offeredOdds: null,
          impliedProbability: null,
          bookmaker: null,
        }),
      }),
      T60,
      memory,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const row of result.ticket.selections) {
      expect(row.offeredOdds).toBeNull();
      expect(row.impliedProbability).toBeNull();
    }
  });

  it("Z. no live score or events enter the ticket", async () => {
    const result = await create(snapshot(), T60, memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket).not.toHaveProperty("events");
    expect(result.ticket).not.toHaveProperty("live");
    expect(JSON.stringify(result.ticket).toLowerCase()).not.toMatch(/vision/);
    const mutated = clonePrematchDecisionTicket(result.ticket);
    expect(await memory.insertIfAbsent(mutated)).toMatchObject({ created: false });
  });

  it("AC. calibration fingerprints/files are not referenced by ticket modules", () => {
    const dir = join(process.cwd(), "lib/prematch-decision");
    const files = [
      "ticket.ts",
      "capture.ts",
      "create.ts",
      "store.ts",
      "window.ts",
      "durable-postgres.ts",
      "from-scanner.ts",
      "attach.ts",
    ];
    for (const file of files) {
      const src = readFileSync(join(dir, file), "utf8");
      expect(src).not.toMatch(/data\/prospective/);
      expect(src).not.toMatch(/CANDIDATE_MANIFEST_FINGERPRINT/);
      expect(src).not.toMatch(/LIVE_CAPTURE_WINDOW/);
    }
  });
});
