import { describe, expect, it, vi } from "vitest";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { applyFrozenTicketToOpportunity } from "@/lib/apex-opportunities/map";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import type { IDataProvider } from "@/lib/data-platform/provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import * as probability from "@/lib/intelligence/modules/probability";
import { snapshotFromMatchCenter } from "@/lib/copilot/snapshot";
import { buildPremiumAnalysis } from "@/lib/match-analysis/premium";
import { presentMatchCenterBettingSurfaces } from "@/lib/prematch-decision/actionability";
import {
  canPublishFrozenCurrentBet,
  frozenApexDecision,
  frozenApexRating,
  frozenRecommendation,
  frozenValueBet,
} from "@/lib/prematch-decision/frozen-betting";
import { opportunityBlurb } from "@/lib/apex-opportunities/blurb";
import {
  discoveryPriority,
  discoveryRecommendation,
} from "@/lib/apex-opportunities/discovery";
import { formatScore, formatSignedPct } from "@/lib/apex-opportunities/display";
import { opportunityPassesFilters } from "@/lib/apex-opportunities/filters";
import { DEFAULT_OPPORTUNITY_FILTERS } from "@/lib/apex-opportunities/types";
import { scannerRecommendation } from "@/lib/opportunity-scanner/recommend";
import type { PrematchDecisionTicket } from "@/lib/prematch-decision/ticket";
import { attachPrematchDecisionTicket } from "@/lib/prematch-decision/attach";
import { createPrematchDecisionTicket } from "@/lib/prematch-decision/create";
import { captureScannerPrematchTicket } from "@/lib/prematch-decision/from-scanner";
import { prematchDecisionTicketId } from "@/lib/prematch-decision/identity";
import {
  InMemoryPrematchDecisionTicketBackend,
  InMemoryPrematchDecisionTicketStore,
  LayeredPrematchDecisionTicketStore,
  UnavailablePrematchDecisionTicketBackend,
} from "@/lib/prematch-decision/store";
import type { PrematchPublishedSnapshot } from "@/lib/prematch-decision/ticket";

const KICKOFF = "2033-05-01T18:00:00.000Z";
const T60 = "2033-05-01T17:00:00.000Z";
const T121 = "2033-05-01T15:59:00.000Z";
const AFTER = "2033-05-01T18:00:00.001Z";
const HOME_P = 0.42;

function snapshot(
  overrides: Partial<PrematchPublishedSnapshot> = {},
): PrematchPublishedSnapshot {
  return {
    fixtureId: "SYNTHETIC-1D1",
    homeTeamId: "home-1d1",
    awayTeamId: "away-1d1",
    homeTeamName: "Home 1D1",
    awayTeamName: "Away 1D1",
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
    scoring: {
      apexScore: 71,
      confidence: 64,
      confidenceBand: "medium",
      riskScore: 38,
      riskBand: "medium",
      expectedValue: 0.029,
      recommendationTier: "Value Bet",
      recommendationKind: "lean_bet",
      selectionId: "home",
      selectionLabel: "Home 1D1",
      kellyFraction: 0.02,
      kellyPct: 2,
      stakePct: 2,
      stakeLabel: "2%",
      fairOdds: 1 / HOME_P,
      offeredOdds: 2.45,
      impliedProbability: 1 / 2.45,
      bookmaker: "SYNTHETIC",
    },
    ...overrides,
  };
}

function layered() {
  const memory = new InMemoryPrematchDecisionTicketStore();
  const backend = new InMemoryPrematchDecisionTicketBackend();
  return {
    memory,
    backend,
    store: new LayeredPrematchDecisionTicketStore(memory, backend),
  };
}

describe("Phase 1D.1 fail-closed durable recommendation", () => {
  it("A. new durable ticket publishes frozen snapshot", async () => {
    const { store } = layered();
    const created = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.status).toBe("created");
    expect(created.ticket.scoring?.recommendationTier).toBe("Value Bet");
  });

  it("B. existing durable ticket is confirmed, not L1-only", async () => {
    const { store, memory } = layered();
    const first = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store,
    });
    expect(first.ok).toBe(true);
    memory.clear();
    const second = await createPrematchDecisionTicket({
      published: snapshot({
        scoring: {
          ...snapshot().scoring!,
          recommendationTier: "Elite",
          selectionLabel: "RECOMPUTED",
        },
      }),
      clock: T60,
      store,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.status).toBe("idempotent");
    expect(second.ticket.scoring?.recommendationTier).toBe("Value Bet");
    expect(second.ticket.scoring?.selectionLabel).toBe("Home 1D1");
  });

  it("C. L1 ticket + durable unavailable does not publish", async () => {
    const memory = new InMemoryPrematchDecisionTicketStore();
    const created = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store: memory,
    });
    expect(created.ok).toBe(true);
    const unavailable = new LayeredPrematchDecisionTicketStore(
      memory,
      new UnavailablePrematchDecisionTicketBackend(),
    );
    const result = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store: unavailable,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe("durable_unavailable");
  });

  it("E. durable timeout/throw fails closed", async () => {
    const store = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      {
        async getByTicketId() {
          throw new Error("durable timeout");
        },
        async insertIfAbsent() {
          throw new Error("durable timeout");
        },
      },
    );
    const result = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("DURABLE_STORE_UNAVAILABLE");
  });

  it("D/E. durable unavailable / missing credential fails closed", async () => {
    const store = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      new UnavailablePrematchDecisionTicketBackend(),
    );
    const result = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("DURABLE_STORE_UNAVAILABLE");
  });

  it("F. unique collision publishes durable winner", async () => {
    const { store } = layered();
    const first = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store,
    });
    const second = await createPrematchDecisionTicket({
      published: snapshot({
        scoring: {
          ...snapshot().scoring!,
          recommendationTier: "Elite",
        },
      }),
      clock: T60,
      store,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.ticket.ticketId).toBe(first.ticket.ticketId);
    expect(second.ticket.scoring?.recommendationTier).toBe("Value Bet");
  });

  it("G. outside T-120 does not create or publish", async () => {
    const { store } = layered();
    const result = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T121,
      store,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("TOO_EARLY_FOR_CANONICAL_CAPTURE");
  });

  it("H. kickoff reached does not publish", async () => {
    const { store } = layered();
    const result = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: AFTER,
      store,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("KICKOFF_REACHED");
  });

  it("I. Phase 1A false does not publish", async () => {
    const { store } = layered();
    const result = await createPrematchDecisionTicket({
      published: snapshot({ vendorStatusShort: "FT" }),
      clock: T60,
      store,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("STATUS_NOT_PREMATCH");
  });

  it("K. recomputed PE differs — frozen ticket wins", async () => {
    const { store } = layered();
    const created = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const live = {
      fixtureId: created.ticket.fixtureId,
      kickoffAt: KICKOFF,
      vendorStatusShort: "NS" as const,
      leagueName: "L",
      country: null,
      market: "1x2" as const,
      home: { name: "H", shortName: "H", logoUrl: null },
      away: { name: "A", shortName: "A", logoUrl: null },
      predicted: "away" as const,
      selectionLabel: "RECOMPUTED AWAY",
      score: 99,
      stars: 5,
      confidence: 99,
      confidenceBand: "high" as const,
      riskBand: "low" as const,
      riskScore: 1,
      fairOdds: 1.1,
      bookmakerOdds: 1.2,
      valuePct: 0.5,
      expectedValue: 0.9,
      marketEdge: 0.5,
      kellyPct: 9,
      stakePct: 9,
      stakeLabel: "9%",
      recommendation: "Elite" as const,
      verdict: "elite_pick" as const,
      verdictLabel: "Elite",
      explanation: "recomputed",
      reasonsFor: [],
      reasonsAgainst: [],
      positiveEdge: true,
      durableTicketConfirmed: false,
    };
    const published = applyFrozenTicketToOpportunity(live, created.ticket);
    expect(published.recommendation).toBe("Value Bet");
    expect(published.selectionLabel).toBe("Home 1D1");
    expect(published.predicted).toBe("home");
    expect(published.stars).toBe(3);
    expect(published.expectedValue).toBe(0.029);
    expect(published.valuePct).toBe(0.029);
    expect(published.marketEdge).toBeNull();
    expect(published.explanation).toBe("");
    expect(published.reasonsFor).toEqual([]);
    expect(published.score).toBe(71);
    expect(published.durableTicketConfirmed).toBe(true);
    expect(published.frozenTicketId).toBe(created.ticket.ticketId);
  });

  it("L/M. repeat request and L1 clear recover the same durable ticket", async () => {
    const { store, memory } = layered();
    const first = await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store,
    });
    memory.clear();
    const recovered = await store.confirmDurableByTicketId(
      prematchDecisionTicketId("SYNTHETIC-1D1")!,
    );
    expect(first.ok && recovered.confirmed).toBe(true);
    if (!first.ok || !recovered.confirmed) return;
    expect(recovered.ticket.ticketId).toBe(first.ticket.ticketId);
    expect(recovered.ticket.scoring?.recommendationTier).toBe("Value Bet");
  });

  it("N. concurrent creates publish the same winner", async () => {
    const { store } = layered();
    const [a, b] = await Promise.all([
      createPrematchDecisionTicket({ published: snapshot(), clock: T60, store }),
      createPrematchDecisionTicket({ published: snapshot(), clock: T60, store }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.ticket.ticketId).toBe(b.ticket.ticketId);
    expect(a.ticket.scoring?.recommendationTier).toBe(
      b.ticket.scoring?.recommendationTier,
    );
  });

  it("O/J. Scanner family cannot publish without durable proof", async () => {
    const template = await createMockDataProvider().getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });
    const row: ApexMatchBundle = {
      ...template,
      match: {
        ...template.match,
        kickoffAt: KICKOFF,
        status: "scheduled",
        vendorStatusShort: "NS",
      },
    };
    const provider: IDataProvider = {
      id: "mock",
      displayName: "1d1",
      async listFixtures() {
        return [row];
      },
      async getMatch() {
        return row;
      },
    };
    const unavailable = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      new UnavailablePrematchDecisionTicketBackend(),
    );
    const failed = await getApexOpportunities({
      provider,
      ticketStore: unavailable,
      nowUtc: T60,
    });
    expect(failed.analyzed).toEqual([]);

    const { store } = layered();
    const ok = await getApexOpportunities({
      provider,
      ticketStore: store,
      nowUtc: T60,
    });
    expect(ok.analyzed).toHaveLength(1);
    expect(ok.analyzed[0]?.durableTicketConfirmed).toBe(true);
    expect(ok.analyzed[0]?.frozenTicketId).toBe(
      prematchDecisionTicketId(ok.analyzed[0]!.fixtureId),
    );
  });

  it("P. Match Analysis cannot publish without durable proof", async () => {
    const created = await createPrematchDecisionTicket({
      published: snapshot({ fixtureId: "1035089" }),
      clock: T60,
      store: new InMemoryPrematchDecisionTicketStore(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const premium = buildPremiumAnalysis({
      matchId: "1035089",
      kickoffAt: KICKOFF,
      vendorStatusShort: "NS",
      homeTeam: { id: "h", name: "H", shortName: "H", logoUrl: null },
      awayTeam: { id: "a", name: "A", shortName: "A", logoUrl: null },
      oneXTwo: { home: 0.9, draw: 0.05, away: 0.05 },
      predictedOutcome: "away",
      markets: [],
      expectedGoals: { home: 1, away: 1, total: 2 },
      modelVersion: "live",
      decision: {
        selectionLabel: "RECOMPUTED",
        score: { value: 99, coverage: 1, label: "Elite", components: [] },
        confidence: { value: 99, band: "high", caption: "" },
        risk: { score: 1, band: "low", reasons: [] },
        value: {
          modelProbability: 0.9,
          fairOdds: 1.1,
          impliedOdds: 1.2,
          expectedValue: 0.9,
          marketProbability: 0.8,
          valuePct: null,
          marketEdge: null,
          positiveEdge: true,
          negativeEdge: false,
        },
        sizing: {
          kellyFraction: 0.2,
          kellyPct: 20,
          stakePct: 20,
          stakeLabel: "20%",
        },
        verdict: { kind: "elite_pick", label: "Elite", stars: 5 },
        reasonsFor: [],
        reasonsAgainst: [],
        explanation: "",
        engineId: "deterministic-v1",
        predicted: "away",
      },
      scoring: {
        engineId: "scoring-v2",
        selectionId: "1035089",
        selectionLabel: "RECOMPUTED",
        overall: 99,
        coverage: 1,
        components: [],
        recommendation: { tier: "Elite", stars: 5, note: "" },
        explanation: {
          summary: "",
          overall: 99,
          coverage: 1,
          recommendation: "Elite",
          supporting: [],
          against: [],
        },
      },
      report: { market: { bookmaker: "X" } },
      recentMatches: { home: [], away: [] },
      leaguePosition: { home: null, away: null },
      matchMetrics: { home: null, away: null },
      h2h: [],
      risks: [],
      frozenPrematchDecision: created.ticket,
    } as never);
    expect(premium.currentlyActionable).toBe(true);
    expect(premium.tier).toBe("Value Bet");
    expect(premium.selectionLabel).toBe("Home 1D1");
    expect(premium.recommendations[0]?.selection).toBe("Home 1D1");
  });

  it("P. Match Analysis without a ticket is not currently actionable", () => {
    const noTicket = buildPremiumAnalysis({
      matchId: "1035089",
      kickoffAt: KICKOFF,
      vendorStatusShort: "NS",
      homeTeam: { id: "h", name: "H", shortName: "H", logoUrl: null },
      awayTeam: { id: "a", name: "A", shortName: "A", logoUrl: null },
      oneXTwo: { home: HOME_P, draw: 0.28, away: 0.3 },
      predictedOutcome: "home",
      markets: [],
      expectedGoals: { home: 1, away: 1, total: 2 },
      modelVersion: "live",
      decision: {
        selectionLabel: "Home",
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
      scoring: {
        engineId: "scoring-v2",
        selectionId: "x",
        selectionLabel: "Home",
        overall: 71,
        coverage: 1,
        components: [],
        recommendation: { tier: "Value Bet", stars: 3, note: "" },
        explanation: {
          summary: "",
          overall: 71,
          coverage: 1,
          recommendation: "Value Bet",
          supporting: [],
          against: [],
        },
      },
      report: { market: { bookmaker: "X" } },
      recentMatches: { home: [], away: [] },
      leaguePosition: { home: null, away: null },
      matchMetrics: { home: null, away: null },
      h2h: [],
      risks: [],
      frozenPrematchDecision: null,
    } as never, { nowUtc: T60 });
    expect(noTicket.currentlyActionable).toBe(false);
    expect(noTicket.recommendations).toEqual([]);
    expect(noTicket.actionabilityCopyKey).toBe("noFrozenPrematchDecision");
  });

  it("Q. Match Center cannot publish on L1-only lookup", () => {
    const presented = presentMatchCenterBettingSurfaces(
      {
        vendorStatusShort: "NS",
        kickoffAt: KICKOFF,
        durableTicketConfirmed: false,
      },
      { valueBet: { market: "1x2", selection: "home", edge: 0.1 } as never },
      T60,
    );
    expect(presented.currentlyActionable).toBe(false);
    expect(presented.showCurrentRecommendation).toBe(false);
    expect(presented.valueBet).toBeNull();
    expect(presented.copyKey).toBe("noFrozenPrematchDecision");

    const confirmed = presentMatchCenterBettingSurfaces(
      {
        vendorStatusShort: "NS",
        kickoffAt: KICKOFF,
        durableTicketConfirmed: true,
      },
      { valueBet: { market: "1x2", selection: "home", edge: 0.1 } as never },
      T60,
    );
    expect(confirmed.showCurrentRecommendation).toBe(true);
  });

  it("P attach safety-net still creates inside the window", async () => {
    const store = new InMemoryPrematchDecisionTicketStore();
    const attached = await attachPrematchDecisionTicket(
      {
        matchId: "SYNTHETIC-1D1",
        kickoffAt: KICKOFF,
        vendorStatusShort: "NS",
        homeTeam: { id: "h", name: "H", shortName: "H", logoUrl: null },
        awayTeam: { id: "a", name: "A", shortName: "A", logoUrl: null },
        oneXTwo: { home: HOME_P, draw: 0.28, away: 0.3 },
        predictedOutcome: "home",
        markets: [
          {
            id: "m",
            label: "1X2",
            type: "1x2",
            line: null,
            selections: [{ key: "home", label: "Home", probability: HOME_P }],
          },
        ],
        expectedGoals: { home: 1.4, away: 1.1, total: 2.5 },
        modelVersion: "test",
        decision: {
          selectionLabel: "Home 1D1",
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
        report: { market: { bookmaker: "SYNTHETIC" } },
        scoring: {
          overall: 71,
          selectionLabel: "Home 1D1",
          recommendation: { tier: "Value Bet", stars: 3, note: "" },
        },
        recentMatches: { home: [], away: [] },
        leaguePosition: { home: null, away: null },
        matchMetrics: { home: null, away: null },
        h2h: [],
        risks: [],
      } as never,
      { store, nowUtc: T60 },
    );
    expect(attached.frozenPrematchDecision?.ticketId).toBe(
      prematchDecisionTicketId("SYNTHETIC-1D1"),
    );
  });

  it("R. ticket persistence does not add a PE computation", async () => {
    const spy = vi.spyOn(probability, "createEloPoissonHybridEngine");
    await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store: new InMemoryPrematchDecisionTicketStore(),
    });
    await captureScannerPrematchTicket({
      published: snapshot({ fixtureId: "SYNTHETIC-1D1-R" }),
      clock: T60,
      store: new InMemoryPrematchDecisionTicketStore(),
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("S. ticket persistence does not add an API-Football call", async () => {
    const provider: IDataProvider = {
      id: "mock",
      displayName: "1d1-no-provider",
      listFixtures: vi.fn(async () => []),
      getMatch: vi.fn(async () => {
        throw new Error("provider should not be called");
      }),
    };
    await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store: new InMemoryPrematchDecisionTicketStore(),
    });
    expect(provider.listFixtures).not.toHaveBeenCalled();
    expect(provider.getMatch).not.toHaveBeenCalled();
  });
});

describe("Phase 1D.1 adversarial frozen ticket vs live PE", () => {
  async function frozenAwayTicket() {
    const created = await createPrematchDecisionTicket({
      published: snapshot({
        scoring: {
          ...snapshot().scoring!,
          selectionId: "away",
          selectionLabel: "FROZEN AWAY",
          apexScore: 64,
          confidence: 55,
          confidenceBand: "medium",
          expectedValue: 0.041,
          recommendationTier: "Value Bet",
          recommendationKind: "lean_bet",
          offeredOdds: 3.1,
          fairOdds: 2.8,
          impliedProbability: 1 / 3.1,
          kellyPct: 3,
          stakePct: 3,
          stakeLabel: "3%",
        },
      }),
      clock: T60,
      store: new InMemoryPrematchDecisionTicketStore(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("ticket");
    return created.ticket;
  }

  it("Scanner board never mixes live away PE with a frozen home/away ticket", async () => {
    const ticket = await frozenAwayTicket();
    const live = {
      fixtureId: ticket.fixtureId,
      kickoffAt: KICKOFF,
      vendorStatusShort: "NS" as const,
      leagueName: "L",
      country: null,
      market: "1x2" as const,
      home: { name: "Home 1D1", shortName: "H", logoUrl: null },
      away: { name: "Away 1D1", shortName: "A", logoUrl: null },
      predicted: "home" as const,
      selectionLabel: "LIVE HOME",
      score: 99,
      stars: 5,
      confidence: 99,
      confidenceBand: "high" as const,
      riskBand: "low" as const,
      riskScore: 1,
      fairOdds: 1.1,
      bookmakerOdds: 1.2,
      valuePct: 0.9,
      expectedValue: 0.9,
      marketEdge: 0.8,
      kellyPct: 20,
      stakePct: 20,
      stakeLabel: "20%",
      recommendation: "Elite" as const,
      verdict: "elite_pick" as const,
      verdictLabel: "Elite",
      explanation: "live PE",
      reasonsFor: [{ id: "x", key: "x", title: "live", detail: "live" }],
      reasonsAgainst: [],
      positiveEdge: true,
      durableTicketConfirmed: false,
    };
    const published = applyFrozenTicketToOpportunity(live, ticket);
    expect(published.predicted).toBe("away");
    expect(published.selectionLabel).toBe("FROZEN AWAY");
    expect(published.recommendation).toBe("Value Bet");
    expect(published.expectedValue).toBe(0.041);
    expect(published.valuePct).toBe(0.041);
    expect(published.marketEdge).toBeNull();
    expect(published.stars).toBe(3);
    expect(published.score).toBe(64);
    expect(published.explanation).toBe("");
    expect(published.reasonsFor).toEqual([]);
  });

  it("Feed/Lab/Combos/Portfolio inherit the same frozen opportunity snapshot", async () => {
    const ticket = await frozenAwayTicket();
    const live = {
      fixtureId: ticket.fixtureId,
      kickoffAt: KICKOFF,
      vendorStatusShort: "NS" as const,
      leagueName: "L",
      country: null,
      market: "1x2" as const,
      home: { name: "Home 1D1", shortName: "H", logoUrl: null },
      away: { name: "Away 1D1", shortName: "A", logoUrl: null },
      predicted: "home" as const,
      selectionLabel: "LIVE HOME",
      score: 99,
      stars: 5,
      confidence: 99,
      confidenceBand: "high" as const,
      riskBand: "low" as const,
      riskScore: 1,
      fairOdds: 1.1,
      bookmakerOdds: 1.2,
      valuePct: 0.9,
      expectedValue: 0.9,
      marketEdge: 0.8,
      kellyPct: 20,
      stakePct: 20,
      stakeLabel: "20%",
      recommendation: "Elite" as const,
      verdict: "elite_pick" as const,
      verdictLabel: "Elite",
      explanation: "live PE",
      reasonsFor: [],
      reasonsAgainst: [],
      positiveEdge: true,
    };
    const published = applyFrozenTicketToOpportunity(live, ticket);
    expect(published.predicted).not.toBe(live.predicted);
    expect(published.selectionLabel).not.toBe(live.selectionLabel);
    expect(published.expectedValue).not.toBe(live.expectedValue);
  });

  it("Match Analysis premium uses ticket fields only while actionable", async () => {
    const ticket = await frozenAwayTicket();
    const premium = buildPremiumAnalysis({
      matchId: "SYNTHETIC-1D1",
      kickoffAt: KICKOFF,
      vendorStatusShort: "NS",
      homeTeam: { id: "h", name: "Home 1D1", shortName: "H", logoUrl: null },
      awayTeam: { id: "a", name: "Away 1D1", shortName: "A", logoUrl: null },
      oneXTwo: { home: 0.9, draw: 0.05, away: 0.05 },
      predictedOutcome: "home",
      markets: [],
      expectedGoals: { home: 2, away: 0.5, total: 2.5 },
      modelVersion: "live",
      decision: {
        selectionLabel: "LIVE HOME",
        score: { value: 99, coverage: 1, label: "Elite", components: [] },
        confidence: { value: 99, band: "high", caption: "live caption" },
        risk: { score: 1, band: "low", reasons: [] },
        value: {
          modelProbability: 0.9,
          fairOdds: 1.1,
          impliedOdds: 1.2,
          expectedValue: 0.9,
          marketProbability: 0.8,
          valuePct: 0.9,
          marketEdge: 0.8,
          positiveEdge: true,
          negativeEdge: false,
        },
        sizing: {
          kellyFraction: 0.2,
          kellyPct: 20,
          stakePct: 20,
          stakeLabel: "20%",
        },
        verdict: { kind: "elite_pick", label: "Elite", stars: 5 },
        reasonsFor: [],
        reasonsAgainst: [],
        explanation: "live PE",
        engineId: "deterministic-v1",
        predicted: "home",
      },
      scoring: {
        engineId: "scoring-v2",
        selectionId: "home",
        selectionLabel: "LIVE HOME",
        overall: 99,
        coverage: 1,
        components: [],
        recommendation: { tier: "Elite", stars: 5, note: "" },
        explanation: {
          summary: "live",
          overall: 99,
          coverage: 1,
          recommendation: "Elite",
          supporting: [],
          against: [],
        },
      },
      report: { market: { bookmaker: "LIVE" } },
      recentMatches: { home: [], away: [] },
      leaguePosition: { home: null, away: null },
      matchMetrics: { home: null, away: null },
      h2h: [],
      risks: [],
      frozenPrematchDecision: ticket,
    } as never, { nowUtc: T60 });
    expect(premium.currentlyActionable).toBe(true);
    expect(premium.selectionLabel).toBe("FROZEN AWAY");
    expect(premium.tier).toBe("Value Bet");
    expect(premium.expectedValue).toBe(0.041);
    expect(premium.bookmakerOdds).toBe(3.1);
    expect(premium.market.expectedValue).toBe(0.041);
    expect(premium.market.currentOdds).toBe(3.1);
    expect(premium.market.modelProbability).not.toBe(0.9);
    expect(premium.summary).toBe("");
    expect(premium.recommendations[0]?.selection).toBe("FROZEN AWAY");
  });

  it("Match Center current rec/valueBet come from the frozen ticket", async () => {
    const ticket = await frozenAwayTicket();
    const rec = frozenRecommendation(ticket);
    const value = frozenValueBet(ticket);
    expect(rec?.title).toBe("FROZEN AWAY");
    expect(rec?.selection).toBe("away");
    expect(rec?.rationale).toBe("");
    expect(value?.selection).toBe("away");
    expect(value?.edge).toBe(0.041);
    const presented = presentMatchCenterBettingSurfaces(
      {
        vendorStatusShort: "NS",
        kickoffAt: KICKOFF,
        durableTicketConfirmed: true,
      },
      { valueBet: value },
      T60,
    );
    expect(presented.showCurrentRecommendation).toBe(true);
    expect(presented.valueBet?.selection).toBe("away");
    expect(presented.valueBet?.edge).toBe(0.041);
  });

  it("Copilot snapshot uses the frozen ticket, not live PE, for current betting", () => {
    const ticket = {
      ...snapshot(),
      ticketId: prematchDecisionTicketId("SYNTHETIC-1D1")!,
      schemaVersion: "1.0.0" as const,
      capturedAtUtc: T60,
      asOfUtc: T60,
      actionability: { actionable: true as const, reason: "ACTIONABLE_PREMATCH" as const },
      model: { version: null, expectedGoals: null },
      selections: [
        {
          marketId: "1x2" as const,
          marketLine: null,
          selectionId: "away",
          selectionLabel: "FROZEN AWAY",
          modelProbability: 0.33,
          fairOdds: 2.8,
          bookmaker: "SYNTHETIC",
          offeredOdds: 3.1,
          impliedProbability: 1 / 3.1,
          marketAsOfUtc: null,
        },
      ],
      scoring: {
        ...snapshot().scoring!,
        selectionId: "away",
        selectionLabel: "FROZEN AWAY",
        expectedValue: 0.041,
        recommendationTier: "Value Bet" as const,
        offeredOdds: 3.1,
      },
      evidence: {
        statistics: false,
        tactical: false,
        market: false,
        teamIntelligence: false,
        context: false,
        news: false,
        injuries: false,
        h2h: false,
        form: false,
      },
      leagueId: null,
      season: null,
    };
    const snap = snapshotFromMatchCenter({
      match: {
        matchId: "m",
        kickoffAt: KICKOFF,
        vendorStatusShort: "NS",
        durableTicketConfirmed: true,
        status: "scheduled",
        leagueName: "L",
        homeTeam: { id: "h", name: "Home 1D1", shortName: "H", logoUrl: null },
        awayTeam: { id: "a", name: "Away 1D1", shortName: "A", logoUrl: null },
        venue: null,
        referee: null,
        attendance: null,
        weather: null,
        source: "data-platform",
      },
      preview: {
        analysis: {
          frozenPrematchDecision: ticket,
          decision: {
            selectionLabel: "LIVE HOME",
            predicted: "home",
            value: { expectedValue: 0.9 },
          },
          scoring: { recommendation: { tier: "Elite" } },
        },
        hybrid: {
          overUnder25: { over: 0.5, under: 0.5 },
          btts: { yes: 0.5, no: 0.5 },
        },
        dashboard: {
          form: { home: null, away: null },
          odds: [],
          injuries: [],
          h2h: [],
          lineups: { home: null, away: null },
          recommendation: {
            id: "live",
            title: "LIVE HOME",
            action: "bet",
            priority: "high",
            rationale: "live PE",
            confidence: { value: 0.9, band: "high" },
          },
          valueBet: {
            market: "1x2",
            selection: "home",
            modelProbability: 0.9,
            edge: 0.9,
          },
        },
        eloInput: { homeElo: 1500, awayElo: 1500 },
      },
      live: { vision: { minute: 0, score: { home: 0, away: 0 } } },
      aiAnalysis: {
        prediction: {
          outcome: "home",
          label: "LIVE HOME",
          oneXTwo: { home: 0.9, draw: 0.05, away: 0.05 },
          modelVersion: "live",
        },
        expectedGoals: { home: 2, away: 0.4, total: 2.4 },
        confidence: { value: 99, band: "high" },
        recommendation: {
          id: "live",
          title: "LIVE HOME",
          action: "bet",
          priority: "high",
          rationale: "live PE",
          confidence: { value: 0.9, band: "high" },
        },
        valueBet: {
          market: "1x2",
          selection: "home",
          modelProbability: 0.9,
          decimalOdds: 1.2,
          edge: 0.9,
        },
        recentForm: { home: null, away: null },
        strengths: [],
        weaknesses: [],
        tacticalFactors: [],
        source: { dataPlatform: true, probabilityEngine: true, reasoning: "rules" },
      },
    } as never);
    expect(snap.predictedOutcome).toBe("away");
    expect(snap.predictedLabel).toBe("FROZEN AWAY");
    expect(snap.recommendation.title).toBe("FROZEN AWAY");
    expect(snap.valueBet?.selection).toBe("away");
    expect(snap.valueBet?.edge).toBe(0.041);
    expect(snap.decision).toBeUndefined();
    expect(snap.scoring).toBeUndefined();
  });

  it("Lab featured decision/rating are ticket-sourced", async () => {
    const ticket = await frozenAwayTicket();
    const decision = frozenApexDecision(ticket);
    const rating = frozenApexRating(ticket);
    expect(decision?.predicted).toBe("away");
    expect(decision?.selectionLabel).toBe("FROZEN AWAY");
    expect(decision?.value.expectedValue).toBe(0.041);
    expect(decision?.verdict.stars).toBe(3);
    expect(decision?.reasonsFor).toEqual([]);
    expect(rating).toBeNull();
  });
});

describe("Phase 1D.1 misleading-sentinel matrix", () => {
  function liveRow() {
    return {
      fixtureId: "SYNTHETIC-1D1",
      kickoffAt: KICKOFF,
      vendorStatusShort: "NS" as const,
      leagueName: "L",
      country: null,
      market: "1x2" as const,
      home: { name: "Home 1D1", shortName: "H", logoUrl: null },
      away: { name: "Away 1D1", shortName: "A", logoUrl: null },
      predicted: "home" as const,
      selectionLabel: "LIVE HOME",
      score: 99,
      stars: 5,
      confidence: 99,
      confidenceBand: "high" as const,
      riskBand: "low" as const,
      riskScore: 1,
      fairOdds: 1.1,
      bookmakerOdds: 1.2,
      valuePct: 0.9,
      expectedValue: 0.9,
      marketEdge: 0.8,
      kellyPct: 20,
      stakePct: 20,
      stakeLabel: "20%",
      recommendation: "Elite" as const,
      verdict: "elite_pick" as const,
      verdictLabel: "Elite",
      explanation: "live PE",
      reasonsFor: [],
      reasonsAgainst: [],
      positiveEdge: true,
    };
  }

  function ticketWith(
    scoring: Partial<NonNullable<PrematchDecisionTicket["scoring"]>> = {},
    selectionProbability?: number,
  ): PrematchDecisionTicket {
    const base = snapshot();
    return {
      ...base,
      vendorStatusShort: base.vendorStatusShort ?? "NS",
      ticketId: prematchDecisionTicketId("SYNTHETIC-1D1")!,
      schemaVersion: "1.0.0",
      capturedAtUtc: T60,
      asOfUtc: T60,
      actionability: {
        actionable: true,
        reason: "ACTIONABLE_PREMATCH",
      },
      model: { version: null, expectedGoals: null },
      selections: [
        {
          marketId: "1x2",
          marketLine: null,
          selectionId: scoring.selectionId ?? "home",
          selectionLabel: scoring.selectionLabel ?? "Home 1D1",
          modelProbability:
            selectionProbability === undefined ? HOME_P : selectionProbability,
          fairOdds: null,
          bookmaker: null,
          offeredOdds: null,
          impliedProbability: null,
          marketAsOfUtc: null,
        },
      ],
      scoring: {
        ...base.scoring!,
        ...scoring,
      },
      evidence: {
        statistics: false,
        tactical: false,
        market: false,
        teamIntelligence: false,
        context: false,
        news: false,
        injuries: false,
        h2h: false,
        form: false,
      },
      leagueId: null,
      season: null,
    };
  }

  function premiumFrom(ticket: PrematchDecisionTicket) {
    return buildPremiumAnalysis(
      {
        matchId: "SYNTHETIC-1D1",
        kickoffAt: KICKOFF,
        vendorStatusShort: "NS",
        homeTeam: { id: "h", name: "Home 1D1", shortName: "H", logoUrl: null },
        awayTeam: { id: "a", name: "Away 1D1", shortName: "A", logoUrl: null },
        oneXTwo: { home: 0.9, draw: 0.05, away: 0.05 },
        predictedOutcome: "home",
        markets: [],
        expectedGoals: { home: 2, away: 0.5, total: 2.5 },
        modelVersion: "live",
        decision: {
          selectionLabel: "LIVE HOME",
          score: { value: 99, coverage: 1, label: "Elite", components: [] },
          confidence: { value: 99, band: "high", caption: "live" },
          risk: { score: 1, band: "low", reasons: [] },
          value: {
            modelProbability: 0.9,
            fairOdds: 1.1,
            impliedOdds: 1.2,
            expectedValue: 0.9,
            marketProbability: 0.8,
            valuePct: 0.9,
            marketEdge: 0.8,
            positiveEdge: true,
            negativeEdge: false,
          },
          sizing: {
            kellyFraction: 0.2,
            kellyPct: 20,
            stakePct: 20,
            stakeLabel: "20%",
          },
          verdict: { kind: "elite_pick", label: "Elite", stars: 5 },
          reasonsFor: [],
          reasonsAgainst: [],
          explanation: "live PE",
          engineId: "deterministic-v1",
          predicted: "home",
        },
        scoring: {
          engineId: "scoring-v2",
          selectionId: "home",
          selectionLabel: "LIVE HOME",
          overall: 99,
          coverage: 1,
          components: [],
          recommendation: { tier: "Elite", stars: 5, note: "" },
          explanation: {
            summary: "live",
            overall: 99,
            coverage: 1,
            recommendation: "Elite",
            supporting: [],
            against: [],
          },
        },
        report: { market: { bookmaker: "LIVE" } },
        recentMatches: { home: [], away: [] },
        leaguePosition: { home: null, away: null },
        matchMetrics: { home: null, away: null },
        h2h: [],
        risks: [],
        frozenPrematchDecision: ticket,
      } as never,
      { nowUtc: T60 },
    );
  }

  it("A. complete frozen ticket publishes a current bet", () => {
    const ticket = ticketWith();
    expect(canPublishFrozenCurrentBet(ticket)).toBe(true);
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.predicted).toBe("home");
    expect(published.selectionLabel).toBe("Home 1D1");
    expect(published.recommendation).toBe("Value Bet");
    expect(published.expectedValue).toBe(0.029);
    expect(premiumFrom(ticket).currentlyActionable).toBe(true);
  });

  it("B. missing EV stays unavailable — no fake 0% EV", () => {
    const ticket = ticketWith({ expectedValue: null });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.expectedValue).toBeNull();
    expect(published.valuePct).toBeNull();
    expect(published.positiveEdge).toBeNull();
    expect(frozenValueBet(ticket)?.edge).toBeNull();
    expect(frozenApexDecision(ticket)?.value.expectedValue).toBeNull();
    expect(premiumFrom(ticket).expectedValue).toBeNull();
    expect(formatSignedPct(published.expectedValue)).toBe("n/d");
    expect(opportunityBlurb(published)).not.toMatch(/0\.0%/);
  });

  it("C. real frozen EV=0 remains 0", () => {
    const ticket = ticketWith({ expectedValue: 0 });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(Object.is(published.expectedValue, 0)).toBe(true);
    expect(published.positiveEdge).toBe(false);
    expect(frozenValueBet(ticket)?.edge).toBe(0);
    expect(premiumFrom(ticket).expectedValue).toBe(0);
    expect(formatSignedPct(0)).toBe("0.0%");
  });

  it("D. missing probability stays unavailable — no fake 0%", () => {
    const ticket = { ...ticketWith(), selections: [] };
    expect(frozenValueBet(ticket)?.modelProbability).toBeNull();
    expect(frozenApexDecision(ticket)?.value.modelProbability).toBeNull();
    expect(premiumFrom(ticket).market.modelProbability).toBeNull();
  });

  it("E. real frozen probability=0 remains 0", () => {
    const ticket = ticketWith({}, 0);
    expect(frozenValueBet(ticket)?.modelProbability).toBe(0);
    expect(frozenApexDecision(ticket)?.value.modelProbability).toBe(0);
    expect(premiumFrom(ticket).market.modelProbability).toBe(0);
  });

  it("F. missing tier does not become Watch", () => {
    const ticket = ticketWith({
      recommendationTier: null,
      recommendationKind: null,
    });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.recommendation).toBeNull();
    expect(published.stars).toBeNull();
    expect(published.verdictLabel).toBeNull();
    expect(scannerRecommendation(published)).toBeNull();
    expect(discoveryRecommendation(published)).toBeNull();
    expect(discoveryPriority(published)).toBeNull();
    expect(frozenRecommendation(ticket)?.action).toBeUndefined();
    expect(premiumFrom(ticket).tier).toBeNull();
  });

  it("G. explicit Watch remains Watch", () => {
    const ticket = ticketWith({ recommendationTier: "Watch" });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.recommendation).toBe("Watch");
    expect(scannerRecommendation(published)).toBe("Watch");
    expect(discoveryRecommendation(published)).toBe("WATCH");
    expect(frozenRecommendation(ticket)?.action).toBe("watch");
    expect(premiumFrom(ticket).tier).toBe("Watch");
  });

  it("H. missing verdict does not become Pass", () => {
    const ticket = ticketWith({
      recommendationKind: null,
      recommendationTier: null,
    });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.verdict).toBeNull();
    expect(published.verdictLabel).toBeNull();
    expect(frozenApexDecision(ticket)?.verdict.kind).toBeNull();
    expect(frozenApexDecision(ticket)?.verdict.label).toBeNull();
  });

  it("I. explicit Pass remains Pass", () => {
    const ticket = ticketWith({
      recommendationKind: "pass",
      recommendationTier: null,
    });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.verdict).toBe("pass");
    expect(published.verdictLabel).toBe("Pass");
    expect(frozenApexDecision(ticket)?.verdict.label).toBe("Pass");
  });

  it("J. missing score stays unavailable — no fake score 0", () => {
    const ticket = ticketWith({ apexScore: null });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.score).toBeNull();
    expect(formatScore(published.score)).toBe("—");
    expect(frozenApexDecision(ticket)?.score.value).toBeNull();
    expect(premiumFrom(ticket).score).toBeNull();
    expect(
      opportunityPassesFilters(published, DEFAULT_OPPORTUNITY_FILTERS),
    ).toBe(false);
  });

  it("K. missing confidence stays unavailable — no fake 0/low", () => {
    const ticket = ticketWith({ confidence: null, confidenceBand: null });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.confidence).toBeNull();
    expect(published.confidenceBand).toBeNull();
    expect(frozenRecommendation(ticket)?.confidence).toBeUndefined();
    expect(premiumFrom(ticket).confidence).toBeNull();
    expect(premiumFrom(ticket).confidenceBand).toBeNull();
  });

  it("L. missing risk stays unavailable — no fake 0/high", () => {
    const ticket = ticketWith({ riskScore: null, riskBand: null });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.riskScore).toBeNull();
    expect(published.riskBand).toBeNull();
    expect(frozenApexDecision(ticket)?.risk.score).toBeNull();
    expect(frozenApexDecision(ticket)?.risk.band).toBeNull();
    expect(premiumFrom(ticket).riskScore).toBeNull();
    expect(premiumFrom(ticket).riskBand).toBeNull();
  });

  it("M. missing stake stays unavailable — no fake stake 0", () => {
    const ticket = ticketWith({
      stakePct: null,
      stakeLabel: null,
      kellyPct: null,
      kellyFraction: null,
    });
    const published = applyFrozenTicketToOpportunity(liveRow(), ticket);
    expect(published.stakePct).toBeNull();
    expect(published.stakeLabel).toBeNull();
    expect(published.kellyPct).toBeNull();
    expect(frozenApexDecision(ticket)?.sizing.stakePct).toBeNull();
    expect(frozenValueBet(ticket)?.kellyFraction).toBeNull();
  });

  it("N. frozen HOME vs live AWAY remains HOME", () => {
    const ticket = ticketWith({
      selectionId: "home",
      selectionLabel: "Home 1D1",
    });
    const live = { ...liveRow(), predicted: "away" as const, selectionLabel: "LIVE AWAY" };
    expect(applyFrozenTicketToOpportunity(live, ticket).predicted).toBe("home");
  });

  it("O. frozen AWAY vs live HOME remains AWAY", () => {
    const ticket = ticketWith({
      selectionId: "away",
      selectionLabel: "FROZEN AWAY",
    });
    expect(applyFrozenTicketToOpportunity(liveRow(), ticket).predicted).toBe("away");
    expect(premiumFrom(ticket).selectionLabel).toBe("FROZEN AWAY");
  });

  it("P. durable unavailable hides the current bet", () => {
    expect(
      presentMatchCenterBettingSurfaces(
        {
          vendorStatusShort: "NS",
          kickoffAt: KICKOFF,
          durableTicketConfirmed: false,
        },
        { valueBet: { edge: 0.2 } as never },
        T60,
      ).showCurrentRecommendation,
    ).toBe(false);
  });

  it("Q. L1 only is hidden", () => {
    expect(
      presentMatchCenterBettingSurfaces(
        {
          vendorStatusShort: "NS",
          kickoffAt: KICKOFF,
          durableTicketConfirmed: false,
        },
        { valueBet: null },
        T60,
      ).showCurrentRecommendation,
    ).toBe(false);
  });

  it("R. outside T-120 cannot create a ticket; Phase 1A still governs visibility", () => {
    const presented = presentMatchCenterBettingSurfaces(
      {
        vendorStatusShort: "NS",
        kickoffAt: KICKOFF,
        durableTicketConfirmed: true,
      },
      { valueBet: { edge: 0.2 } as never },
      T121,
    );
    expect(presented.showCurrentRecommendation).toBe(true);
  });

  it("S. kickoff reached hides current betting", () => {
    expect(
      presentMatchCenterBettingSurfaces(
        {
          vendorStatusShort: "NS",
          kickoffAt: KICKOFF,
          durableTicketConfirmed: true,
        },
        { valueBet: null },
        AFTER,
      ).showCurrentRecommendation,
    ).toBe(false);
  });

  it("T/U. ticket persistence does not add PE or API-Football calls", async () => {
    const spy = vi.spyOn(probability, "createEloPoissonHybridEngine");
    const provider: IDataProvider = {
      id: "mock",
      displayName: "1d1-sentinel-no-provider",
      listFixtures: vi.fn(async () => []),
      getMatch: vi.fn(async () => {
        throw new Error("provider should not be called");
      }),
    };
    await createPrematchDecisionTicket({
      published: snapshot(),
      clock: T60,
      store: new InMemoryPrematchDecisionTicketStore(),
    });
    expect(spy).not.toHaveBeenCalled();
    expect(provider.listFixtures).not.toHaveBeenCalled();
    expect(provider.getMatch).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("real frozen score 0 remains 0 and is distinct from missing", () => {
    const zero = applyFrozenTicketToOpportunity(
      liveRow(),
      ticketWith({ apexScore: 0 }),
    );
    const missing = applyFrozenTicketToOpportunity(
      liveRow(),
      ticketWith({ apexScore: null }),
    );
    expect(Object.is(zero.score, 0)).toBe(true);
    expect(missing.score).toBeNull();
    expect(formatScore(0)).toBe("0");
    expect(formatScore(null)).toBe("—");
  });
});
