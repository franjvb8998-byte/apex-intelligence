import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import type { IDataProvider } from "@/lib/data-platform/provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import * as probability from "@/lib/intelligence/modules/probability";
import {
  InMemoryFinalFixtureEvidenceBackend,
  InMemoryFinalFixtureEvidenceStore,
  LayeredFinalFixtureEvidenceStore,
  UnavailableFinalFixtureEvidenceBackend,
  resetFinalFixtureEvidenceStoreForTests,
  serializeFinalFixtureEvidence,
} from "@/lib/final-evidence";
import type { FinalFixtureObservation } from "@/lib/final-evidence/types";
import { createPrematchDecisionTicket } from "@/lib/prematch-decision/create";
import { serializePrematchDecisionTicket } from "@/lib/prematch-decision/serialize";
import {
  InMemoryPrematchDecisionTicketBackend,
  InMemoryPrematchDecisionTicketStore,
  LayeredPrematchDecisionTicketStore,
  resetPrematchDecisionTicketStoreForTests,
} from "@/lib/prematch-decision/store";
import type { PrematchPublishedSnapshot } from "@/lib/prematch-decision/ticket";
import { CANONICAL_CAPTURE_WINDOW_MINUTES } from "@/lib/prematch-decision/window";
import { buildHistoricalPrematchView } from "@/lib/prematch-evaluation/historical";
import {
  LOG_LOSS_EPS,
  brierOneXTwo,
  logLoss,
  logLossOneXTwo,
  twoClassBrier,
} from "@/lib/prematch-evaluation/metrics";
import {
  ingestAlreadyFetchedFinalObservation,
  ingestCatalogueFinalBundle,
  ingestVisionTerminalFinal,
} from "@/lib/prematch-evaluation/opportunistic";
import {
  registerMarketSettlementAdapter,
  resetMarketSettlementAdaptersForTests,
  settleBtts,
  settleMarket,
  settleOneXTwoFromScore,
  settleOverUnder25,
} from "@/lib/prematch-evaluation/settlement";
import {
  InMemoryPrematchDecisionEvaluationBackend,
  InMemoryPrematchDecisionEvaluationStore,
  LayeredPrematchDecisionEvaluationStore,
  UnavailablePrematchDecisionEvaluationBackend,
  resetPrematchDecisionEvaluationStoreForTests,
} from "@/lib/prematch-evaluation/store";
import { SETTLEMENT_POLICY_REGULATION_90_V1 } from "@/lib/prematch-evaluation/types";

const KICKOFF = "2030-01-15T18:00:00.000Z";
const T60 = new Date(
  Date.parse(KICKOFF) - CANONICAL_CAPTURE_WINDOW_MINUTES * 30 * 1000,
).toISOString();
const HOME_P = 0.42;
const DRAW_P = 0.28;
const AWAY_P = 0.3;
const OVER_P = 0.55;
const UNDER_P = 0.45;
const BTTS_YES = 0.52;
const BTTS_NO = 0.48;

function snapshot(
  fixtureId: string,
  overrides: Partial<PrematchPublishedSnapshot> = {},
): PrematchPublishedSnapshot {
  return {
    fixtureId,
    homeTeamId: "synthetic-home",
    awayTeamId: "synthetic-away",
    homeTeamName: "SYNTHETIC Home",
    awayTeamName: "SYNTHETIC Away",
    kickoffUtc: KICKOFF,
    vendorStatusShort: "NS",
    sourceMode: "published-snapshot",
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
      selectionLabel: "SYNTHETIC Home",
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

function observation(
  fixtureId: string,
  overrides: Partial<FinalFixtureObservation> = {},
): FinalFixtureObservation {
  return {
    fixtureId,
    source: "catalogue",
    vendorStatusShort: "FT",
    goalsHome: 2,
    goalsAway: 1,
    fulltimeHome: 2,
    fulltimeAway: 1,
    extratimeHome: null,
    extratimeAway: null,
    penaltyHome: null,
    penaltyAway: null,
    winnerHome: true,
    winnerAway: false,
    ...overrides,
  };
}

async function freezeTicket(
  fixtureId: string,
  store: InMemoryPrematchDecisionTicketStore | LayeredPrematchDecisionTicketStore,
) {
  const created = await createPrematchDecisionTicket({
    published: snapshot(fixtureId),
    clock: T60,
    store,
  });
  if (!created.ok) throw new Error(`ticket not created: ${created.reason}`);
  return created.ticket;
}

describe("Phase 1C final evidence + evaluation", () => {
  let tickets: InMemoryPrematchDecisionTicketStore;
  let evidence: InMemoryFinalFixtureEvidenceStore;
  let evaluations: InMemoryPrematchDecisionEvaluationStore;

  beforeEach(() => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
    resetMarketSettlementAdaptersForTests();
    tickets = new InMemoryPrematchDecisionTicketStore();
    evidence = new InMemoryFinalFixtureEvidenceStore();
    evaluations = new InMemoryPrematchDecisionEvaluationStore();
  });

  afterEach(() => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
    resetMarketSettlementAdaptersForTests();
  });

  async function ingest(fixtureId: string, obs: FinalFixtureObservation) {
    await freezeTicket(fixtureId, tickets);
    return ingestAlreadyFetchedFinalObservation(obs, {
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
      clock: "2030-01-15T20:00:00.000Z",
    });
  }

  it("A. FT home win", async () => {
    const result = await ingest("ft-home", observation("ft-home"));
    expect(result.result.ok).toBe(true);
    if (!result.result.ok) return;
    expect(result.result.evaluation.settlementScore).toEqual({ home: 2, away: 1 });
    expect(settleOneXTwoFromScore({ home: 2, away: 1 })).toBe("home");
    expect(
      result.result.evaluation.markets.find((row) => row.marketId === "1x2")
        ?.realizedSelection,
    ).toBe("home");
    expect(result.result.evaluation.recommendation.hit).toBe(true);
  });

  it("B. FT draw", async () => {
    const result = await ingest(
      "ft-draw",
      observation("ft-draw", {
        goalsHome: 1,
        goalsAway: 1,
        fulltimeHome: 1,
        fulltimeAway: 1,
        winnerHome: null,
        winnerAway: null,
      }),
    );
    expect(result.result.ok).toBe(true);
    if (!result.result.ok) return;
    expect(
      result.result.evaluation.markets.find((row) => row.marketId === "1x2")
        ?.realizedSelection,
    ).toBe("draw");
    expect(result.result.evaluation.recommendation.hit).toBe(false);
  });

  it("C. FT away win", async () => {
    const result = await ingest(
      "ft-away",
      observation("ft-away", {
        goalsHome: 0,
        goalsAway: 2,
        fulltimeHome: 0,
        fulltimeAway: 2,
        winnerHome: false,
        winnerAway: true,
      }),
    );
    expect(result.result.ok).toBe(true);
    if (!result.result.ok) return;
    expect(
      result.result.evaluation.markets.find((row) => row.marketId === "1x2")
        ?.realizedSelection,
    ).toBe("away");
  });

  it("D/E. Over and Under 2.5", async () => {
    const over = await ingest("ou-over", observation("ou-over"));
    const under = await ingest(
      "ou-under",
      observation("ou-under", {
        goalsHome: 1,
        goalsAway: 0,
        fulltimeHome: 1,
        fulltimeAway: 0,
      }),
    );
    expect(settleOverUnder25({ home: 2, away: 1 })).toBe("over");
    expect(settleOverUnder25({ home: 1, away: 0 })).toBe("under");
    expect(
      over.result.ok &&
        over.result.evaluation.markets.find((row) => row.marketId === "over_under")
          ?.realizedSelection,
    ).toBe("over");
    expect(
      under.result.ok &&
        under.result.evaluation.markets.find((row) => row.marketId === "over_under")
          ?.realizedSelection,
    ).toBe("under");
  });

  it("F/G. BTTS yes and no", async () => {
    const yes = await ingest("btts-yes", observation("btts-yes"));
    const no = await ingest(
      "btts-no",
      observation("btts-no", {
        goalsHome: 2,
        goalsAway: 0,
        fulltimeHome: 2,
        fulltimeAway: 0,
      }),
    );
    expect(settleBtts({ home: 2, away: 1 })).toBe("yes");
    expect(settleBtts({ home: 2, away: 0 })).toBe("no");
    expect(
      yes.result.ok &&
        yes.result.evaluation.markets.find((row) => row.marketId === "btts")
          ?.realizedSelection,
    ).toBe("yes");
    expect(
      no.result.ok &&
        no.result.evaluation.markets.find((row) => row.marketId === "btts")
          ?.realizedSelection,
    ).toBe("no");
  });

  it("H. AET uses regulation fulltime, not extra-time goals", async () => {
    const result = await ingest(
      "aet-reg",
      observation("aet-reg", {
        vendorStatusShort: "AET",
        goalsHome: 2,
        goalsAway: 1,
        fulltimeHome: 1,
        fulltimeAway: 1,
        extratimeHome: 1,
        extratimeAway: 0,
      }),
    );
    expect(result.result.ok).toBe(true);
    if (!result.result.ok) return;
    expect(result.result.evaluation.settlementScore).toEqual({ home: 1, away: 1 });
    expect(
      result.result.evaluation.markets.find((row) => row.marketId === "1x2")
        ?.realizedSelection,
    ).toBe("draw");
    expect(
      result.result.evaluation.markets.find((row) => row.marketId === "over_under")
        ?.realizedSelection,
    ).toBe("under");
  });

  it("I. PEN ignores shootout score", async () => {
    const result = await ingest(
      "pen-reg",
      observation("pen-reg", {
        vendorStatusShort: "PEN",
        goalsHome: 1,
        goalsAway: 1,
        fulltimeHome: 1,
        fulltimeAway: 1,
        extratimeHome: 0,
        extratimeAway: 0,
        penaltyHome: 5,
        penaltyAway: 4,
      }),
    );
    expect(result.result.ok).toBe(true);
    if (!result.result.ok) return;
    expect(result.result.evaluation.settlementScore).toEqual({ home: 1, away: 1 });
    expect(
      result.result.evaluation.markets.find((row) => row.marketId === "1x2")
        ?.realizedSelection,
    ).toBe("draw");
    expect(
      result.result.evaluation.markets.find((row) => row.marketId === "btts")
        ?.realizedSelection,
    ).toBe("yes");
  });

  it("J. PST is not evaluated or persisted as final", async () => {
    await freezeTicket("pst-1", tickets);
    const result = await ingestAlreadyFetchedFinalObservation(
      observation("pst-1", { vendorStatusShort: "PST" }),
      {
        ticketStore: tickets,
        evidenceStore: evidence,
        evaluationStore: evaluations,
      },
    );
    expect(result.result.state).toBe("rejected_not_final");
    expect(await evidence.getCanonicalByFixtureId("pst-1")).toBeNull();
  });

  it("K/L/M. CANC ABD AWD/WO are non-scoreable", async () => {
    for (const [fixtureId, status] of [
      ["canc-1", "CANC"],
      ["abd-1", "ABD"],
      ["awd-1", "AWD"],
      ["wo-1", "WO"],
    ] as const) {
      await freezeTicket(fixtureId, tickets);
      const result = await ingestAlreadyFetchedFinalObservation(
        observation(fixtureId, { vendorStatusShort: status }),
        {
          ticketStore: tickets,
          evidenceStore: evidence,
          evaluationStore: evaluations,
        },
      );
      expect(result.result.state).toBe("void_non_scoreable");
      expect(result.result.ok).toBe(false);
      expect(await evidence.getCanonicalByFixtureId(fixtureId)).not.toBeNull();
      expect(
        await evaluations.getByIdentity(
          `apex:prematch-decision:v1:${fixtureId}`,
          SETTLEMENT_POLICY_REGULATION_90_V1,
          1,
        ),
      ).toBeNull();
    }
  });

  it("N. INT and SUSP are not final", async () => {
    for (const status of ["INT", "SUSP"] as const) {
      const result = await ingestAlreadyFetchedFinalObservation(
        observation(`live-${status}`, { vendorStatusShort: status }),
        {
          ticketStore: tickets,
          evidenceStore: evidence,
          evaluationStore: evaluations,
        },
      );
      expect(result.result.state).toBe("rejected_not_final");
    }
  });

  it("O. unknown fail closed", async () => {
    const result = await ingestAlreadyFetchedFinalObservation(
      observation("unk-1", { vendorStatusShort: "ZZZ" }),
      {
        ticketStore: tickets,
        evidenceStore: evidence,
        evaluationStore: evaluations,
      },
    );
    expect(result.result.state).toBe("rejected_not_final");
  });

  it("P. duplicate evidence is idempotent", async () => {
    await freezeTicket("dup-ev", tickets);
    const first = await ingestAlreadyFetchedFinalObservation(
      observation("dup-ev"),
      { ticketStore: tickets, evidenceStore: evidence, evaluationStore: evaluations },
    );
    const second = await ingestAlreadyFetchedFinalObservation(
      observation("dup-ev"),
      { ticketStore: tickets, evidenceStore: evidence, evaluationStore: evaluations },
    );
    expect(first.evidenceCreated).toBe(true);
    expect(second.evidenceCreated).toBe(false);
    expect((await evidence.listByFixtureId("dup-ev")).length).toBe(1);
  });

  it("Q/R. mutated later evidence cannot overwrite revision 1 and revision 2 coexists", async () => {
    await freezeTicket("rev-ev", tickets);
    const first = await ingestAlreadyFetchedFinalObservation(
      observation("rev-ev"),
      { ticketStore: tickets, evidenceStore: evidence, evaluationStore: evaluations },
    );
    const second = await ingestAlreadyFetchedFinalObservation(
      observation("rev-ev", { fulltimeHome: 3, goalsHome: 3 }),
      { ticketStore: tickets, evidenceStore: evidence, evaluationStore: evaluations },
    );
    const rows = await evidence.listByFixtureId("rev-ev");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.observationRevision).toBe(1);
    expect(rows[0]?.fulltimeHome).toBe(2);
    expect(rows[1]?.observationRevision).toBe(2);
    expect(rows[1]?.fulltimeHome).toBe(3);
    expect(first.result.ok && first.result.evaluation.evidenceRevision).toBe(1);
    expect(second.result.ok && second.result.evaluation.evidenceRevision).toBe(2);
    expect(
      serializeFinalFixtureEvidence(rows[0]),
    ).not.toBe(serializeFinalFixtureEvidence(rows[1]));
  });

  it("S/T. duplicate evaluation is idempotent and mutation cannot overwrite", async () => {
    await freezeTicket("dup-eval", tickets);
    const first = await ingestAlreadyFetchedFinalObservation(
      observation("dup-eval"),
      { ticketStore: tickets, evidenceStore: evidence, evaluationStore: evaluations },
    );
    const second = await ingestAlreadyFetchedFinalObservation(
      observation("dup-eval"),
      { ticketStore: tickets, evidenceStore: evidence, evaluationStore: evaluations },
    );
    expect(first.evaluationCreated).toBe(true);
    expect(second.evaluationCreated).toBe(false);
    if (!first.result.ok || !second.result.ok) return;
    expect(second.result.evaluation.settlementScore).toEqual(
      first.result.evaluation.settlementScore,
    );
  });

  it("U. missing ticket persists evidence and does not backfill PE", async () => {
    const spy = vi.spyOn(probability, "createEloPoissonHybridEngine");
    const result = await ingestAlreadyFetchedFinalObservation(
      observation("missing-ticket"),
      { ticketStore: tickets, evidenceStore: evidence, evaluationStore: evaluations },
    );
    expect(result.result.state).toBe("rejected_missing_ticket");
    expect(await evidence.getCanonicalByFixtureId("missing-ticket")).not.toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("V/W. missing/invalid score fails closed and never becomes 0-0", async () => {
    await freezeTicket("bad-score", tickets);
    const missing = await ingestAlreadyFetchedFinalObservation(
      observation("bad-score", { fulltimeHome: null, fulltimeAway: null }),
      { ticketStore: tickets, evidenceStore: evidence, evaluationStore: evaluations },
    );
    expect(missing.result.state).toBe("rejected_invalid_score");
    const stored = await evidence.getCanonicalByFixtureId("bad-score");
    expect(stored?.fulltimeHome).toBeNull();
    expect(stored?.goalsHome).toBe(2);
    expect(JSON.stringify(stored)).not.toMatch(/"fulltimeHome":0/);
  });

  it("X/Y. process restart recovery and two-instance first-write-wins", async () => {
    const durableTickets = new InMemoryPrematchDecisionTicketBackend();
    const durableEvidence = new InMemoryFinalFixtureEvidenceBackend();
    const durableEval = new InMemoryPrematchDecisionEvaluationBackend();
    const writerA = {
      tickets: new LayeredPrematchDecisionTicketStore(
        new InMemoryPrematchDecisionTicketStore(),
        durableTickets,
      ),
      evidence: new LayeredFinalFixtureEvidenceStore(
        new InMemoryFinalFixtureEvidenceStore(),
        durableEvidence,
      ),
      evaluations: new LayeredPrematchDecisionEvaluationStore(
        new InMemoryPrematchDecisionEvaluationStore(),
        durableEval,
      ),
    };
    await freezeTicket("restart-1", writerA.tickets);
    const first = await ingestAlreadyFetchedFinalObservation(
      observation("restart-1"),
      {
        ticketStore: writerA.tickets,
        evidenceStore: writerA.evidence,
        evaluationStore: writerA.evaluations,
      },
    );
    expect(first.result.ok).toBe(true);
    writerA.evidence.clear();
    writerA.evaluations.clear();
    const recovered = await writerA.evidence.getCanonicalByFixtureId("restart-1");
    expect(recovered?.fulltimeHome).toBe(2);

    const writerB = {
      tickets: new LayeredPrematchDecisionTicketStore(
        new InMemoryPrematchDecisionTicketStore(),
        durableTickets,
      ),
      evidence: new LayeredFinalFixtureEvidenceStore(
        new InMemoryFinalFixtureEvidenceStore(),
        durableEvidence,
      ),
      evaluations: new LayeredPrematchDecisionEvaluationStore(
        new InMemoryPrematchDecisionEvaluationStore(),
        durableEval,
      ),
    };
    const duplicate = await ingestAlreadyFetchedFinalObservation(
      observation("restart-1", { fulltimeHome: 9, goalsHome: 9 }),
      {
        ticketStore: writerB.tickets,
        evidenceStore: writerB.evidence,
        evaluationStore: writerB.evaluations,
      },
    );
    const rows = await durableEvidence.listByFixtureId("restart-1");
    expect(rows.ok).toBe(true);
    if (!rows.ok) return;
    expect(rows.rows[0]?.fulltimeHome).toBe(2);
    expect(duplicate.result.ok && duplicate.result.evaluation.evidenceRevision).toBe(2);
  });

  it("Z. frozen ticket is unchanged byte-for-byte", async () => {
    const ticket = await freezeTicket("byte-1", tickets);
    const before = serializePrematchDecisionTicket(ticket);
    await ingestAlreadyFetchedFinalObservation(observation("byte-1"), {
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    const after = serializePrematchDecisionTicket(
      (await tickets.getByFixtureId("byte-1"))!,
    );
    expect(after).toBe(before);
  });

  it("AA. evaluation does not recompute PE", async () => {
    const spy = vi.spyOn(probability, "createEloPoissonHybridEngine");
    await ingest("no-pe", observation("no-pe"));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("AB/AH. catalogue opportunistic path makes zero extra provider calls", async () => {
    const template = await createMockDataProvider().getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });
    const fixtureId = "scan-1c";
    const ticket = await freezeTicket(fixtureId, tickets);
    const bundle: ApexMatchBundle = {
      ...template,
      odds: [],
      match: {
        ...template.match,
        id: `apex:mock:match:${fixtureId}`,
        status: "finished",
        vendorStatusShort: "FT",
        score: {
          home: 2,
          away: 1,
          periods: { ft: { home: 2, away: 1 } },
        },
        externalRefs: [{ provider: "mock", externalId: fixtureId }],
      },
    };
    const calls = { getMatch: 0, listFixtures: 0 };
    const provider: IDataProvider = {
      id: "mock",
      displayName: "phase-1c",
      async listFixtures() {
        calls.listFixtures += 1;
        return [bundle];
      },
      async getMatch() {
        calls.getMatch += 1;
        throw new Error("no extra fixture call");
      },
    };
    const pe = vi.spyOn(probability, "createEloPoissonHybridEngine");
    const board = await getApexOpportunities({
      provider,
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    expect(board.analyzed).toEqual([]);
    expect(calls.getMatch).toBe(0);
    expect(pe).not.toHaveBeenCalled();
    const stored = await evidence.getCanonicalByFixtureId(fixtureId);
    expect(stored?.fulltimeHome).toBe(2);
    const evalRow = await evaluations.getByIdentity(
      ticket.ticketId,
      SETTLEMENT_POLICY_REGULATION_90_V1,
      1,
    );
    expect(evalRow?.settlementScore).toEqual({ home: 2, away: 1 });
    pe.mockRestore();
  });

  it("AC. future market adapter registers without SQL schema change", async () => {
    registerMarketSettlementAdapter({
      marketId: "corners",
      settle(market, score) {
        return {
          marketId: "corners",
          marketLine: market.marketLine,
          realizedSelection: score.home + score.away > 8 ? "over" : "under",
          probabilityAssignedToRealizedOutcome: 0.4,
          logLoss: logLoss(0.4),
          brierScore: twoClassBrier(0.4, score.home + score.away > 8),
          hit: true,
          voidReason: null,
        };
      },
    });
    const ticket = await freezeTicket("corners-1", tickets);
    const ev = observation("corners-1");
    await evidence.observe(ev);
    const evidenceRow = (await evidence.getCanonicalByFixtureId("corners-1"))!;
    const settled = settleMarket(
      {
        marketId: "corners",
        marketLine: 8.5,
        selections: [{ selectionId: "over", modelProbability: 0.4 }],
      },
      evidenceRow,
    );
    expect(settled.marketId).toBe("corners");
    expect(settled.voidReason).toBeNull();
    expect(
      ticket.selections.some((row) => String(row.marketId) === "corners"),
    ).toBe(false);
  });

  it("AD/AE/AF/AG. exact probability, log loss, Brier, and recommendation hit", async () => {
    const result = await ingest("metrics-1", observation("metrics-1"));
    expect(result.result.ok).toBe(true);
    if (!result.result.ok) return;
    const oneXTwo = result.result.evaluation.markets.find(
      (row) => row.marketId === "1x2",
    );
    const predicted = { home: HOME_P, draw: DRAW_P, away: AWAY_P };
    expect(oneXTwo?.probabilityAssignedToRealizedOutcome).toBe(HOME_P);
    expect(oneXTwo?.logLoss).toBe(logLossOneXTwo(predicted, "home"));
    expect(oneXTwo?.brierScore).toBe(brierOneXTwo(predicted, "home"));
    expect(oneXTwo?.logLoss).toBe(-Math.log(HOME_P));
    expect(result.result.evaluation.recommendation.hit).toBe(true);
    expect(LOG_LOSS_EPS).toBe(1e-15);
  });

  it("durable unavailable does not claim persistence", async () => {
    await freezeTicket("down-1", tickets);
    const result = await ingestAlreadyFetchedFinalObservation(
      observation("down-1"),
      {
        ticketStore: tickets,
        evidenceStore: new LayeredFinalFixtureEvidenceStore(
          new InMemoryFinalFixtureEvidenceStore(),
          new UnavailableFinalFixtureEvidenceBackend(),
        ),
        evaluationStore: new LayeredPrematchDecisionEvaluationStore(
          new InMemoryPrematchDecisionEvaluationStore(),
          new UnavailablePrematchDecisionEvaluationBackend(),
        ),
      },
    );
    expect(result.result.state).toBe("durable_unavailable");
  });

  it("historical read model uses ticket + evidence + evaluation only", async () => {
    const ticket = await freezeTicket("hist-1", tickets);
    await ingestAlreadyFetchedFinalObservation(observation("hist-1"), {
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    const view = buildHistoricalPrematchView({
      ticket,
      evidence: await evidence.getCanonicalByFixtureId("hist-1"),
      evaluation: await evaluations.getByIdentity(
        ticket.ticketId,
        SETTLEMENT_POLICY_REGULATION_90_V1,
        1,
      ),
    });
    expect(view.label).toBe("HISTORICAL_PREMATCH_SNAPSHOT");
    expect(view.showCurrentRecommendation).toBe(false);
    expect(view.snapshot?.ticketId).toBe(ticket.ticketId);
    expect(view.actualResult?.fulltimeHome).toBe(2);
    expect(view.evaluation?.settlementPolicyVersion).toBe(
      SETTLEMENT_POLICY_REGULATION_90_V1,
    );
    expect(view.defaultRevisionPolicy).toBe("original_revision_1");
  });

  it("vision helper fails closed without regulation score", async () => {
    await freezeTicket("vision-1", tickets);
    const result = await ingestVisionTerminalFinal(
      {
        fixtureId: "vision-1",
        vendorStatusShort: "FT",
        goalsHome: 2,
        goalsAway: 1,
      },
      { ticketStore: tickets, evidenceStore: evidence, evaluationStore: evaluations },
    );
    expect(result?.result.state).toBe("rejected_invalid_score");
  });

  it("catalogue helper reads already-fetched bundle periods.ft", async () => {
    const template = await createMockDataProvider().getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });
    await freezeTicket(DEMO_MATCH_EXTERNAL_ID, tickets);
    const bundle: ApexMatchBundle = {
      ...template,
      match: {
        ...template.match,
        status: "finished",
        vendorStatusShort: "FT",
        score: {
          home: 3,
          away: 0,
          periods: { ft: { home: 3, away: 0 } },
        },
      },
    };
    const result = await ingestCatalogueFinalBundle(bundle, {
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    expect(result?.result.ok).toBe(true);
    if (!result?.result.ok) return;
    expect(result.result.evaluation.settlementScore).toEqual({ home: 3, away: 0 });
  });
});
