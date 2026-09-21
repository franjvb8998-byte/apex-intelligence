import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";
import * as probability from "@/lib/intelligence/modules/probability";
import { getMatchAnalysisData } from "@/lib/match-analysis/load";
import { buildPremiumAnalysis } from "@/lib/match-analysis/premium";
import { attachPrematchDecisionTicket } from "@/lib/prematch-decision/attach";
import {
  evaluatePrematchActionability,
  isCurrentlyActionablePrematch,
} from "@/lib/prematch-decision/actionability";
import { createPrematchDecisionTicket } from "@/lib/prematch-decision/create";
import { prematchDecisionTicketId } from "@/lib/prematch-decision/identity";
import {
  clonePrematchDecisionTicket,
  serializePrematchDecisionTicket,
} from "@/lib/prematch-decision/serialize";
import {
  InMemoryPrematchDecisionTicketStore,
  resetPrematchDecisionTicketStoreForTests,
} from "@/lib/prematch-decision/store";
import {
  EMPTY_PREMATCH_EVIDENCE,
  PREMATCH_DECISION_TICKET_SCHEMA_VERSION,
  type PrematchPublishedSnapshot,
  type PrematchPublishedScoring,
} from "@/lib/prematch-decision/ticket";

const KICKOFF = "2026-09-21T15:00:00.000Z";
const BEFORE = "2026-09-21T14:59:59.999Z";
const AT = "2026-09-21T15:00:00.000Z";
const AFTER = "2026-09-21T15:00:00.001Z";

const HOME_P = 0.42;
const DRAW_P = 0.28;
const AWAY_P = 0.3;
const OVER_P = 0.55;
const UNDER_P = 0.45;
const BTTS_YES = 0.52;
const BTTS_NO = 0.48;
const OFFERED_HOME = 2.45;

const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"] as const;
const TERMINAL_STATUSES = ["FT", "AET", "PEN"] as const;

const TICKET_SOURCE_FILES = [
  "ticket.ts",
  "capture.ts",
  "create.ts",
  "store.ts",
  "serialize.ts",
  "identity.ts",
  "from-match-analysis.ts",
  "from-scanner.ts",
  "attach.ts",
  "window.ts",
  "durable-postgres.ts",
] as const;

function scoring(overrides: Partial<PrematchPublishedScoring> = {}): PrematchPublishedScoring {
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
    offeredOdds: OFFERED_HOME,
    impliedProbability: 1 / OFFERED_HOME,
    bookmaker: "Pinnacle",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<PrematchPublishedSnapshot> = {},
): PrematchPublishedSnapshot {
  return {
    fixtureId: "1035089",
    leagueId: "league-39",
    season: "2026",
    homeTeamId: "home-1",
    awayTeamId: "away-1",
    homeTeamName: "Home FC",
    awayTeamName: "Away FC",
    kickoffUtc: KICKOFF,
    vendorStatusShort: "NS",
    sourceMode: "published-snapshot",
    modelVersion: "hybrid-test",
    expectedGoals: { home: 1.4, away: 1.1, total: 2.5 },
    markets: [
      {
        marketId: "1x2",
        marketLine: null,
        selections: [
          { selectionId: "home", selectionLabel: "Home", modelProbability: HOME_P },
          { selectionId: "draw", selectionLabel: "Draw", modelProbability: DRAW_P },
          { selectionId: "away", selectionLabel: "Away", modelProbability: AWAY_P },
        ],
      },
      {
        marketId: "over_under",
        marketLine: 2.5,
        selections: [
          { selectionId: "over", selectionLabel: "Over 2.5", modelProbability: OVER_P },
          { selectionId: "under", selectionLabel: "Under 2.5", modelProbability: UNDER_P },
        ],
      },
      {
        marketId: "btts",
        marketLine: null,
        selections: [
          { selectionId: "yes", selectionLabel: "Yes", modelProbability: BTTS_YES },
          { selectionId: "no", selectionLabel: "No", modelProbability: BTTS_NO },
        ],
      },
    ],
    quotes: [
      {
        marketId: "1x2",
        selectionId: "home",
        bookmaker: "Pinnacle",
        offeredOdds: OFFERED_HOME,
        impliedProbability: 1 / OFFERED_HOME,
        marketAsOfUtc: "2026-09-21T12:00:00.000Z",
      },
    ],
    scoring: scoring(),
    evidence: {
      statistics: true,
      market: true,
      h2h: false,
    },
    ...overrides,
  };
}

async function create(
  published: PrematchPublishedSnapshot,
  clock: string,
  store: InMemoryPrematchDecisionTicketStore,
) {
  return createPrematchDecisionTicket({ published, clock, store });
}

describe("PrematchDecisionTicket", async () => {
  let store: InMemoryPrematchDecisionTicketStore;

  beforeEach(() => {
    resetPrematchDecisionTicketStoreForTests();
    store = new InMemoryPrematchDecisionTicketStore();
  });

  afterEach(() => {
    resetPrematchDecisionTicketStoreForTests();
  });

  it("A. NS before kickoff allows ticket creation", async () => {
    const result = await create(snapshot(), BEFORE, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("created");
    expect(result.ticket.vendorStatusShort).toBe("NS");
    expect(result.ticket.actionability.actionable).toBe(true);
    expect(result.ticket.actionability.reason).toBe("ACTIONABLE_PREMATCH");
    expect(result.ticket.schemaVersion).toBe(PREMATCH_DECISION_TICKET_SCHEMA_VERSION);
    expect(result.ticket.ticketId).toBe(prematchDecisionTicketId("1035089"));
    expect(result.ticket.kickoffUtc).toBe(KICKOFF);
    expect(result.ticket.capturedAtUtc).toBe(BEFORE);
    expect(result.ticket.asOfUtc).toBe(BEFORE);
  });

  it("B. NS at kickoff is rejected", async () => {
    const result = await create(snapshot(), AT, store);
    expect(result).toMatchObject({
      ok: false,
      status: "rejected",
      ticket: null,
      reason: "KICKOFF_REACHED",
    });
    expect(await store.getByFixtureId("1035089")).toBeNull();
  });

  it("C. stale NS after kickoff is rejected", async () => {
    const result = await create(snapshot(), AFTER, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("KICKOFF_REACHED");
    expect(await store.getByFixtureId("1035089")).toBeNull();
  });

  it("D. live fixture is rejected", async () => {
    for (const status of LIVE_STATUSES) {
      const result = await create(
        snapshot({ vendorStatusShort: status }),
        BEFORE,
        store,
      );
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reason).toBe("STATUS_NOT_PREMATCH");
    }
    expect(await store.getByFixtureId("1035089")).toBeNull();
  });

  it("E. FT is rejected", async () => {
    for (const status of TERMINAL_STATUSES) {
      const result = await create(
        snapshot({ vendorStatusShort: status }),
        BEFORE,
        store,
      );
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reason).toBe("STATUS_NOT_PREMATCH");
    }
  });

  it("F. unknown status is rejected", async () => {
    const result = await create(snapshot({ vendorStatusShort: "ZZZ" }), BEFORE, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("STATUS_UNKNOWN");
  });

  it("G. invalid kickoff is rejected", async () => {
    const result = await create(
      snapshot({ kickoffUtc: "not-a-date" }),
      BEFORE,
      store,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("KICKOFF_MISSING_OR_INVALID");
  });

  it("H. injected clock controls the result deterministically", async () => {
    expect((await create(snapshot(), BEFORE, store)).ok).toBe(true);
    store.clear();
    expect((await create(snapshot(), AT, store)).ok).toBe(false);
    expect((await create(snapshot(), AFTER, store)).ok).toBe(false);
  });

  it("I. captures canonical probabilities without changing them", async () => {
    const result = await create(snapshot(), BEFORE, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(
      result.ticket.selections.map((row) => [row.selectionId, row.modelProbability]),
    );
    expect(byId.home).toBe(HOME_P);
    expect(byId.draw).toBe(DRAW_P);
    expect(byId.away).toBe(AWAY_P);
    expect(byId.over).toBe(OVER_P);
    expect(byId.under).toBe(UNDER_P);
    expect(byId.yes).toBe(BTTS_YES);
    expect(byId.no).toBe(BTTS_NO);
  });

  it("J. captures offered odds without changing them", async () => {
    const result = await create(snapshot(), BEFORE, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const home = result.ticket.selections.find((row) => row.selectionId === "home");
    expect(home?.offeredOdds).toBe(OFFERED_HOME);
    expect(home?.bookmaker).toBe("Pinnacle");
    expect(home?.marketAsOfUtc).toBe("2026-09-21T12:00:00.000Z");
  });

  it("K. missing odds remain missing, not zero or default", async () => {
    const result = await create(
      snapshot({
        quotes: [],
        scoring: scoring({
          offeredOdds: null,
          impliedProbability: null,
          bookmaker: null,
          fairOdds: 1 / HOME_P,
        }),
      }),
      BEFORE,
      store,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const row of result.ticket.selections) {
      expect(row.offeredOdds).toBeNull();
      expect(row.impliedProbability).toBeNull();
      expect(row.offeredOdds).not.toBe(0);
      expect(row.impliedProbability).not.toBe(0);
    }
  });

  it("L. missing evidence remains unavailable, not fabricated", async () => {
    const result = await create(snapshot({ evidence: null }), BEFORE, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.evidence).toEqual(EMPTY_PREMATCH_EVIDENCE);
    expect(result.ticket).not.toHaveProperty("injuries");
    expect(result.ticket).not.toHaveProperty("newsItems");
  });

  it("M. repeated identical creation is idempotent", async () => {
    const first = await create(snapshot(), BEFORE, store);
    const second = await create(snapshot(), BEFORE, store);
    expect(first.ok && first.status).toBe("created");
    expect(second.ok && second.status).toBe("idempotent");
    if (!first.ok || !second.ok) return;
    expect(serializePrematchDecisionTicket(first.ticket)).toBe(
      serializePrematchDecisionTicket(second.ticket),
    );
    expect(second.ticket).toBe(first.ticket);
  });

  it("N. later live fixture state cannot overwrite a frozen prematch ticket", async () => {
    const frozen = await create(snapshot(), BEFORE, store);
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) return;

    const liveAttempt = await create(
      snapshot({
        vendorStatusShort: "1H",
        markets: [
          {
            marketId: "1x2",
            marketLine: null,
            selections: [
              { selectionId: "home", selectionLabel: "Home", modelProbability: 0.99 },
            ],
          },
        ],
      }),
      AFTER,
      store,
    );
    expect(liveAttempt.ok).toBe(false);

    const mutated = clonePrematchDecisionTicket(frozen.ticket);
    mutated.vendorStatusShort = "1H";
    mutated.selections[0]!.modelProbability = 0.99;
    const insert = await store.insertIfAbsent(mutated);
    expect(insert.created).toBe(false);

    const kept = await store.getByFixtureId("1035089");
    expect(kept?.vendorStatusShort).toBe("NS");
    expect(
      kept?.selections.find((row) => row.selectionId === "home")?.modelProbability,
    ).toBe(HOME_P);
  });

  it("O. later terminal state cannot overwrite a frozen prematch ticket", async () => {
    const frozen = await create(snapshot(), BEFORE, store);
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) return;

    const ftAttempt = await create(
      snapshot({ vendorStatusShort: "FT" }),
      AFTER,
      store,
    );
    expect(ftAttempt.ok).toBe(false);

    const mutated = clonePrematchDecisionTicket(frozen.ticket);
    mutated.vendorStatusShort = "FT";
    mutated.scoring = {
      ...mutated.scoring!,
      expectedValue: 0.99,
    };
    expect((await store.insertIfAbsent(mutated)).created).toBe(false);
    expect((await store.getByFixtureId("1035089"))?.scoring?.expectedValue).toBe(0.029);
  });

  it("P. serialization and identity are deterministic", async () => {
    const first = await create(snapshot(), BEFORE, store);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const a = serializePrematchDecisionTicket(first.ticket);
    const b = serializePrematchDecisionTicket(clonePrematchDecisionTicket(first.ticket));
    expect(a).toBe(b);
    expect(first.ticket.ticketId).toBe("apex:prematch-decision:v1:1035089");
    expect(prematchDecisionTicketId("apex:api-football:match:1035089")).toBe(
      first.ticket.ticketId,
    );
  });

  it("Q. no result or outcome is required to create a prematch ticket", async () => {
    const result = await create(snapshot(), BEFORE, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket).not.toHaveProperty("outcome");
    expect(result.ticket).not.toHaveProperty("result");
    expect(result.ticket).not.toHaveProperty("finalScore");
    expect(result.ticket).not.toHaveProperty("closingOdds");
  });

  it("R. ticket creation does not invoke or recompute the Probability Engine", async () => {
    const spy = vi.spyOn(probability, "createEloPoissonHybridEngine");
    const result = await create(snapshot(), BEFORE, store);
    expect(result.ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    const dir = join(process.cwd(), "lib/prematch-decision");
    for (const file of TICKET_SOURCE_FILES) {
      const src = readFileSync(join(dir, file), "utf8");
      expect(src).not.toMatch(/createEloPoissonHybridEngine/);
      expect(src).not.toMatch(/EloPoissonHybridEngine/);
    }
  });

  it("S. ticket contains no Vision live score or events", async () => {
    const result = await create(snapshot(), BEFORE, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const json = serializePrematchDecisionTicket(result.ticket).toLowerCase();
    expect(json).not.toMatch(/vision/);
    expect(json).not.toMatch(/livescore/);
    expect(json).not.toMatch(/"events"/);
    expect(result.ticket).not.toHaveProperty("events");
    expect(result.ticket).not.toHaveProperty("live");
    expect(result.ticket).not.toHaveProperty("score");

    const dir = join(process.cwd(), "lib/prematch-decision");
    for (const file of TICKET_SOURCE_FILES) {
      const src = readFileSync(join(dir, file), "utf8");
      expect(src).not.toMatch(/getVisionLiveCoordinator|peekVisionLiveFixture|apex-vision/);
    }
  });

  it("T. Phase 1A actionability behavior remains unchanged", async () => {
    expect(
      evaluatePrematchActionability({
        vendorStatusShort: "NS",
        kickoffUtc: KICKOFF,
        nowUtc: BEFORE,
      }),
    ).toMatchObject({
      isCurrentlyActionable: true,
      reason: "ACTIONABLE_PREMATCH",
    });
    expect(
      isCurrentlyActionablePrematch({
        vendorStatusShort: "NS",
        kickoffUtc: KICKOFF,
        nowUtc: AT,
      }),
    ).toBe(false);
    expect(
      evaluatePrematchActionability({
        vendorStatusShort: "1H",
        kickoffUtc: KICKOFF,
        nowUtc: BEFORE,
      }).reason,
    ).toBe("STATUS_NOT_PREMATCH");
    expect(
      evaluatePrematchActionability({
        vendorStatusShort: "FT",
        kickoffUtc: KICKOFF,
        nowUtc: BEFORE,
      }).reason,
    ).toBe("STATUS_NOT_PREMATCH");
  });

  it("does not invent unpublished markets", async () => {
    const result = await create(
      snapshot({
        markets: [
          {
            marketId: "1x2",
            marketLine: null,
            selections: [
              { selectionId: "home", selectionLabel: "Home", modelProbability: HOME_P },
            ],
          },
        ],
      }),
      BEFORE,
      store,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.selections).toHaveLength(1);
    expect(result.ticket.selections.map((row) => row.marketId)).toEqual(["1x2"]);
  });

  it("captures fair odds as 1/p of the published model probability", async () => {
    const result = await create(snapshot(), BEFORE, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const home = result.ticket.selections.find((row) => row.selectionId === "home");
    expect(home?.fairOdds).toBe(1 / HOME_P);
    expect(home?.modelProbability).toBe(HOME_P);
  });

  it("captures implied probability from offered odds without fabricating zeros", async () => {
    const result = await create(snapshot(), BEFORE, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const home = result.ticket.selections.find((row) => row.selectionId === "home");
    expect(home?.impliedProbability).toBe(1 / OFFERED_HOME);
    const draw = result.ticket.selections.find((row) => row.selectionId === "draw");
    expect(draw?.impliedProbability).toBeNull();
  });

  it("captures APEX Score, confidence, risk, EV, recommendation, and Kelly", async () => {
    const result = await create(snapshot(), BEFORE, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.scoring).toMatchObject({
      apexScore: 71,
      confidence: 64,
      riskScore: 38,
      riskBand: "medium",
      expectedValue: 0.029,
      recommendationTier: "Value Bet",
      kellyFraction: 0.02,
      kellyPct: 2,
      stakePct: 2,
    });
  });

  it("Match Analysis does not freeze a ticket from a finished fixture", async () => {
    const isolated = new InMemoryPrematchDecisionTicketStore();
    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
      ticketStore: isolated,
    });
    expect(data.vendorStatusShort).toBe("FT");
    expect(data.frozenPrematchDecision).toBeNull();
    expect(await isolated.getByFixtureId(RECORDED_API_FOOTBALL_FIXTURE_ID)).toBeNull();
  });

  it("Match Analysis can distinguish a frozen ticket from the current live/post-match view", async () => {
    const isolated = new InMemoryPrematchDecisionTicketStore();
    const created = await create(
      snapshot({ fixtureId: RECORDED_API_FOOTBALL_FIXTURE_ID }),
      BEFORE,
      isolated,
    );
    expect(created.ok).toBe(true);

    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
      ticketStore: isolated,
    });
    expect(data.vendorStatusShort).toBe("FT");
    expect(data.frozenPrematchDecision?.ticketId).toBe(
      prematchDecisionTicketId(RECORDED_API_FOOTBALL_FIXTURE_ID),
    );
    expect(
      data.frozenPrematchDecision?.selections.find((row) => row.selectionId === "home")
        ?.modelProbability,
    ).toBe(HOME_P);

    const premium = buildPremiumAnalysis(data);
    expect(premium.currentlyActionable).toBe(false);
    expect(premium.recommendations).toEqual([]);
    expect(premium.hasFrozenPrematchDecision).toBe(true);
    expect(premium.actionabilityCopyKey).toBe("frozenPrematchDecisionExists");
  });

  it("attach never regenerates a ticket from live data", async () => {
    const created = await create(snapshot(), BEFORE, store);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const liveAnalysis = {
      matchId: "1035089",
      kickoffAt: KICKOFF,
      vendorStatusShort: "1H",
      frozenPrematchDecision: undefined,
    } as unknown as Parameters<typeof attachPrematchDecisionTicket>[0];

    const attached = await attachPrematchDecisionTicket(liveAnalysis, { store });
    expect(attached.frozenPrematchDecision?.selections[0]?.modelProbability).toBe(
      HOME_P,
    );
    expect(attached.frozenPrematchDecision?.vendorStatusShort).toBe("NS");
  });
});
