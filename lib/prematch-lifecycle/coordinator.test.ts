import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  InMemoryFinalFixtureEvidenceBackend,
  InMemoryFinalFixtureEvidenceStore,
  LayeredFinalFixtureEvidenceStore,
  resetFinalFixtureEvidenceStoreForTests,
} from "@/lib/final-evidence/store";
import { createPrematchDecisionTicket } from "@/lib/prematch-decision/create";
import {
  InMemoryPrematchDecisionTicketBackend,
  InMemoryPrematchDecisionTicketStore,
  LayeredPrematchDecisionTicketStore,
  UnavailablePrematchDecisionTicketBackend,
  comparePrematchTicketListCursor,
  resetPrematchDecisionTicketStoreForTests,
  type PrematchDecisionTicketStore,
} from "@/lib/prematch-decision/store";
import type { PrematchPublishedSnapshot } from "@/lib/prematch-decision/ticket";
import { CANONICAL_CAPTURE_WINDOW_MINUTES } from "@/lib/prematch-decision/window";
import { prematchDecisionTicketId } from "@/lib/prematch-decision/identity";
import type { PrematchLifecycleConfig } from "@/lib/prematch-lifecycle/config";
import {
  LIFECYCLE_LEAGUE_IDS_ENV,
  PENDING_TICKET_EPOCH_UTC,
} from "@/lib/prematch-lifecycle/config";
import { runPrematchLifecycle } from "@/lib/prematch-lifecycle/coordinator";
import type { FinalFixtureEvidenceStore } from "@/lib/final-evidence/store";
import type { PrematchDecisionEvaluationStore } from "@/lib/prematch-evaluation/store";
import {
  InMemoryPrematchDecisionEvaluationBackend,
  InMemoryPrematchDecisionEvaluationStore,
  LayeredPrematchDecisionEvaluationStore,
  UnavailablePrematchDecisionEvaluationBackend,
  resetPrematchDecisionEvaluationStoreForTests,
} from "@/lib/prematch-evaluation/store";
import { SETTLEMENT_POLICY_REGULATION_90_V1 } from "@/lib/prematch-evaluation/types";

const LEAGUE = "901";
const KICKOFF = "2033-06-01T00:30:00.000Z";
const T60 = "2033-05-31T23:30:00.000Z";
const T121 = "2033-05-31T22:29:00.000Z";
const AFTER = "2033-06-01T00:30:00.001Z";
const HOME_P = 0.42;

function sourceOf(name: string): string {
  return readFileSync(join(process.cwd(), name), "utf8");
}

async function templateBundle(): Promise<ApexMatchBundle> {
  return createMockDataProvider().getMatch({ matchId: DEMO_MATCH_EXTERNAL_ID });
}

function lifecycleBundle(
  template: ApexMatchBundle,
  options: {
    fixtureId: string;
    status?: string;
    kickoffAt?: string;
    leagueId?: string;
    odds?: ApexMatchBundle["odds"];
    fulltime?: { home: number | null; away: number | null } | null;
    goals?: { home: number | null; away: number | null };
  },
): ApexMatchBundle {
  const leagueId = options.leagueId ?? LEAGUE;
  return {
    ...template,
    odds: options.odds ?? [],
    league: template.league
      ? {
          ...template.league,
          id: `apex:api-football:league:${leagueId}`,
          externalRefs: [
            { provider: "api-football", externalId: leagueId },
          ],
        }
      : null,
    match: {
      ...template.match,
      id: `apex:api-football:match:${options.fixtureId}`,
      kickoffAt: options.kickoffAt ?? KICKOFF,
      status:
        options.status === "FT" ||
        options.status === "AET" ||
        options.status === "PEN"
          ? "finished"
          : options.status === "CANC" ||
              options.status === "ABD" ||
              options.status === "AWD" ||
              options.status === "WO"
            ? "cancelled"
            : options.status === "PST"
              ? "postponed"
              : options.status === "SUSP"
                ? "suspended"
                : options.status === "NS" || options.status == null
                  ? "scheduled"
                  : "live",
      vendorStatusShort: options.status ?? "NS",
      score: {
        home: options.goals?.home ?? options.fulltime?.home ?? null,
        away: options.goals?.away ?? options.fulltime?.away ?? null,
        periods:
          options.fulltime === undefined
            ? template.match.score.periods
            : options.fulltime == null
              ? undefined
              : {
                  ft: {
                    home: options.fulltime.home,
                    away: options.fulltime.away,
                  },
                },
      },
      externalRefs: [
        { provider: "api-football", externalId: options.fixtureId },
      ],
    },
  };
}

function ticketSnapshot(
  fixtureId: string,
  overrides: Partial<PrematchPublishedSnapshot> = {},
): PrematchPublishedSnapshot {
  return {
    fixtureId,
    leagueId: `apex:api-football:league:${LEAGUE}`,
    homeTeamId: "home-1",
    awayTeamId: "away-1",
    homeTeamName: "Home FC",
    awayTeamName: "Away FC",
    kickoffUtc: KICKOFF,
    vendorStatusShort: "NS",
    sourceMode: "scanner",
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
      selectionLabel: "Home FC",
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

const CONFIG: PrematchLifecycleConfig = {
  leagueIds: [LEAGUE],
  maxNewTicketsPerRun: 10,
  leagueAllowlistInvalid: false,
};

describe("Phase 1D.2A automatic durable lifecycle coordinator", () => {
  let template: ApexMatchBundle;
  let tickets: InMemoryPrematchDecisionTicketStore;
  let evidence: InMemoryFinalFixtureEvidenceStore;
  let evaluations: InMemoryPrematchDecisionEvaluationStore;
  let oddsCalls: number;
  let discoveryCalls: number;
  let idsCalls: number;
  let idsBatches: string[][];

  beforeEach(async () => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
    template = await templateBundle();
    tickets = new InMemoryPrematchDecisionTicketStore();
    evidence = new InMemoryFinalFixtureEvidenceStore();
    evaluations = new InMemoryPrematchDecisionEvaluationStore();
    oddsCalls = 0;
    discoveryCalls = 0;
    idsCalls = 0;
    idsBatches = [];
  });

  afterEach(() => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
  });

  function discovery(
    byDate: Record<string, ApexMatchBundle[]>,
  ) {
    return async (date: string) => {
      discoveryCalls += 1;
      return byDate[date] ?? [];
    };
  }

  async function attachOdds(bundle: ApexMatchBundle) {
    oddsCalls += 1;
    if (bundle.odds.length > 0) return bundle;
    return { ...bundle, odds: template.odds };
  }

  async function fetchByIds(ids: string[]) {
    idsCalls += 1;
    idsBatches.push([...ids]);
    return [];
  }

  function run(
    options: {
      nowUtc?: string;
      fixturesByDate?: Record<string, ApexMatchBundle[]>;
      attach?: (bundle: ApexMatchBundle) => Promise<ApexMatchBundle>;
      fetchIds?: (ids: string[]) => Promise<ApexMatchBundle[]>;
      config?: PrematchLifecycleConfig;
      ticketStore?: PrematchDecisionTicketStore;
      evidenceStore?: FinalFixtureEvidenceStore;
      evaluationStore?: PrematchDecisionEvaluationStore;
    } = {},
  ) {
    return runPrematchLifecycle({
      nowUtc: options.nowUtc ?? T60,
      config: options.config ?? CONFIG,
      listFixturesByDate: discovery(options.fixturesByDate ?? {}),
      attachOdds: options.attach ?? attachOdds,
      fetchFixturesByIds: options.fetchIds ?? fetchByIds,
      ticketStore: options.ticketStore ?? tickets,
      evidenceStore: options.evidenceStore ?? evidence,
      evaluationStore: options.evaluationStore ?? evaluations,
    });
  }

  it("A. runs without browser/RSC/getApexOpportunities", async () => {
    const src = sourceOf("lib/prematch-lifecycle/coordinator.ts");
    expect(src).not.toMatch(/getApexOpportunities/);
    expect(src).not.toMatch(/from ["']react["']/);
    const report = await run({
      fixturesByDate: {
        "2033-05-31": [
          lifecycleBundle(template, { fixtureId: "8001" }),
        ],
      },
    });
    expect(report.newTicketsCreated).toBe(1);
    expect(report.configuredLeagueCount).toBe(1);
  });

  it("B. unticketed NS inside T-120 gets exactly one durable ticket", async () => {
    const report = await run({
      fixturesByDate: {
        "2033-05-31": [lifecycleBundle(template, { fixtureId: "8001" })],
      },
    });
    expect(report.newTicketsCreated).toBe(1);
    expect(await tickets.getByFixtureId("8001")).not.toBeNull();
  });

  it("C. duplicate coordinator invocation does not create a duplicate ticket", async () => {
    const fixturesByDate = {
      "2033-05-31": [lifecycleBundle(template, { fixtureId: "8001" })],
    };
    await run({ fixturesByDate });
    const second = await run({ fixturesByDate });
    expect(second.newTicketsCreated).toBe(0);
    expect(second.alreadyTicketedCount).toBe(1);
    expect(second.newTicketsIdempotent).toBe(0);
    expect(await tickets.getByFixtureId("8001")).not.toBeNull();
  });

  it("D. concurrent invocation preserves one canonical durable ticket", async () => {
    const fixturesByDate = {
      "2033-05-31": [lifecycleBundle(template, { fixtureId: "8001" })],
    };
    const [first, second] = await Promise.all([
      run({ fixturesByDate }),
      run({ fixturesByDate }),
    ]);
    const created = first.newTicketsCreated + second.newTicketsCreated;
    expect(created).toBeLessThanOrEqual(1);
    expect(await tickets.getByFixtureId("8001")).not.toBeNull();
  });

  it("E. empty L1 recovers from durable truth and does not recapture", async () => {
    const backend = new InMemoryPrematchDecisionTicketBackend();
    const memory = new InMemoryPrematchDecisionTicketStore();
    const store = new LayeredPrematchDecisionTicketStore(memory, backend);
    const fixturesByDate = {
      "2033-05-31": [lifecycleBundle(template, { fixtureId: "8001" })],
    };
    await run({ fixturesByDate, ticketStore: store });
    memory.clear();
    const second = await run({ fixturesByDate, ticketStore: store });
    expect(second.newTicketsCreated).toBe(0);
    expect(second.alreadyTicketedCount).toBe(1);
    expect(second.peComputations).toBe(0);
    expect(second.oddsRequests).toBe(0);
  });

  it("F. after kickoff or non-NS creates no new ticket", async () => {
    const live = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, { fixtureId: "8001", status: "1H" }),
        ],
      },
    });
    const early = await run({
      nowUtc: T121,
      fixturesByDate: {
        "2033-05-31": [lifecycleBundle(template, { fixtureId: "8002" })],
      },
    });
    expect(live.newTicketsCreated).toBe(0);
    expect(early.newTicketsCreated).toBe(0);
    expect(live.peComputations).toBe(0);
    expect(early.peComputations).toBe(0);
  });

  it("G. ticketed FT/AET/PEN with valid fulltime create evidence + evaluation", async () => {
    await createPrematchDecisionTicket({
      published: ticketSnapshot("8001"),
      clock: T60,
      store: tickets,
    });
    for (const status of ["FT", "AET", "PEN"] as const) {
      resetFinalFixtureEvidenceStoreForTests();
      resetPrematchDecisionEvaluationStoreForTests();
      evidence = new InMemoryFinalFixtureEvidenceStore();
      evaluations = new InMemoryPrematchDecisionEvaluationStore();
      const report = await run({
        nowUtc: AFTER,
        fixturesByDate: {
          "2033-06-01": [
            lifecycleBundle(template, {
              fixtureId: "8001",
              status,
              fulltime: { home: 2, away: 1 },
              goals: { home: 2, away: 1 },
            }),
          ],
        },
      });
      expect(report.evidenceCreated).toBe(1);
      expect(report.evaluationsCreated).toBe(1);
      expect(await evidence.getCanonicalByFixtureId("8001")).not.toBeNull();
    }
  });

  it("H. duplicate finalization is idempotent", async () => {
    await createPrematchDecisionTicket({
      published: ticketSnapshot("8001"),
      clock: T60,
      store: tickets,
    });
    const fixturesByDate = {
      "2033-06-01": [
        lifecycleBundle(template, {
          fixtureId: "8001",
          status: "FT",
          fulltime: { home: 2, away: 1 },
          goals: { home: 2, away: 1 },
        }),
      ],
    };
    await run({ nowUtc: AFTER, fixturesByDate });
    const second = await run({ nowUtc: AFTER, fixturesByDate });
    expect(second.evidenceCreated).toBe(0);
    expect(second.evaluationsCreated).toBe(0);
    expect(second.evaluationsIdempotent).toBeGreaterThan(0);
  });

  it("I. CANC/ABD/AWD/WO persist evidence only", async () => {
    for (const status of ["CANC", "ABD", "AWD", "WO"] as const) {
      tickets = new InMemoryPrematchDecisionTicketStore();
      evidence = new InMemoryFinalFixtureEvidenceStore();
      evaluations = new InMemoryPrematchDecisionEvaluationStore();
      await createPrematchDecisionTicket({
        published: ticketSnapshot("8001"),
        clock: T60,
        store: tickets,
      });
      const report = await run({
        nowUtc: AFTER,
        fixturesByDate: {
          "2033-06-01": [
            lifecycleBundle(template, { fixtureId: "8001", status }),
          ],
        },
      });
      expect(report.evidenceCreated).toBe(1);
      expect(report.evaluationsCreated).toBe(0);
      expect(report.voidTerminalCount).toBe(1);
      expect(await evaluations.getByIdentity(
        (await tickets.getByFixtureId("8001"))!.ticketId,
        SETTLEMENT_POLICY_REGULATION_90_V1,
        1,
      )).toBeNull();
    }
  });

  it("J. PST/SUSP do not finalize", async () => {
    await createPrematchDecisionTicket({
      published: ticketSnapshot("8001"),
      clock: T60,
      store: tickets,
    });
    for (const status of ["PST", "SUSP"] as const) {
      const report = await run({
        nowUtc: AFTER,
        fixturesByDate: {
          "2033-06-01": [
            lifecycleBundle(template, { fixtureId: "8001", status }),
          ],
        },
      });
      expect(report.evidenceCreated).toBe(0);
      expect(report.evaluationsCreated).toBe(0);
      expect(await evidence.getCanonicalByFixtureId("8001")).toBeNull();
    }
  });

  it("K. missing odds follow frozen ticket rules and invent none", async () => {
    const report = await run({
      fixturesByDate: {
        "2033-05-31": [lifecycleBundle(template, { fixtureId: "8001" })],
      },
      attach: async (bundle) => bundle,
    });
    expect(report.newTicketsCreated).toBe(1);
    const ticket = await tickets.getByFixtureId("8001");
    expect(ticket).not.toBeNull();
    expect(ticket?.scoring?.bookmaker).not.toBe("MockBook");
  });

  it("L. provider discovery failure creates no fake ticket", async () => {
    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: CONFIG,
      listFixturesByDate: async () => {
        throw new Error("provider down");
      },
      attachOdds,
      fetchFixturesByIds: fetchByIds,
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    expect(report.newTicketsCreated).toBe(0);
    expect(report.errorCount).toBeGreaterThan(0);
    expect(await tickets.getByFixtureId("8001")).toBeNull();
  });

  it("M. durable store unavailable creates no authorized ticket", async () => {
    const store = new LayeredPrematchDecisionTicketStore(
      new InMemoryPrematchDecisionTicketStore(),
      new UnavailablePrematchDecisionTicketBackend(),
    );
    const report = await run({
      fixturesByDate: {
        "2033-05-31": [lifecycleBundle(template, { fixtureId: "8001" })],
      },
      ticketStore: store,
    });
    expect(report.newTicketsCreated).toBe(0);
    expect(report.errorCount).toBeGreaterThan(0);
    expect(await store.getByFixtureId("8001")).toBeNull();
  });

  it("N. no PE or odds after kickoff", async () => {
    await createPrematchDecisionTicket({
      published: ticketSnapshot("8001"),
      clock: T60,
      store: tickets,
    });
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, { fixtureId: "8001", status: "2H" }),
        ],
      },
    });
    expect(report.peComputations).toBe(0);
    expect(report.oddsRequests).toBe(0);
    expect(oddsCalls).toBe(0);
  });

  it("O. odds only for T-120 missing tickets; finalization uses ids batches", async () => {
    await createPrematchDecisionTicket({
      published: ticketSnapshot("8001"),
      clock: T60,
      store: tickets,
    });
    const report = await run({
      fixturesByDate: {
        "2033-05-31": [
          lifecycleBundle(template, { fixtureId: "8001" }),
          lifecycleBundle(template, { fixtureId: "8002" }),
        ],
      },
    });
    expect(report.oddsRequests).toBe(1);
    expect(oddsCalls).toBe(1);
    expect(report.alreadyTicketedCount).toBe(1);
    expect(report.newTicketsCreated).toBe(1);

    await createPrematchDecisionTicket({
      published: ticketSnapshot("8003", {
        kickoffUtc: "2033-05-30T18:00:00.000Z",
      }),
      clock: "2033-05-30T17:00:00.000Z",
      store: tickets,
    });
    idsCalls = 0;
    const finalize = await run({
      nowUtc: AFTER,
      fixturesByDate: { "2033-06-01": [] },
      fetchIds: async (ids) => {
        idsCalls += 1;
        idsBatches.push([...ids]);
        return ids.map((id) =>
          lifecycleBundle(template, {
            fixtureId: id,
            status: "FT",
            kickoffAt: "2033-05-30T18:00:00.000Z",
            fulltime: { home: 1, away: 0 },
            goals: { home: 1, away: 0 },
          }),
        );
      },
    });
    expect(finalize.finalizationBatchRequests).toBeGreaterThanOrEqual(1);
    expect(idsCalls).toBeGreaterThanOrEqual(1);
    expect(idsBatches.every((batch) => batch.length <= 15)).toBe(true);
  });

  it("P/Q/R. does not import calibration, Vision, or product auth", () => {
    const files = [
      "lib/prematch-lifecycle/coordinator.ts",
      "lib/prematch-lifecycle/transport.ts",
      "lib/prematch-lifecycle/auth.ts",
      "lib/prematch-lifecycle/config.ts",
      "app/api/internal/prematch-lifecycle/route.ts",
    ];
    for (const file of files) {
      const src = sourceOf(file);
      expect(src).not.toMatch(/lib\/debug\/calibration/);
      expect(src).not.toMatch(/lib\/apex-vision/);
      expect(src).not.toMatch(/lib\/auth\//);
      expect(src).not.toMatch(/NEXT_PUBLIC_.*SECRET/);
    }
  });

  it("S. production path contains no UPDATE/UPSERT/DELETE", () => {
    const files = [
      "lib/prematch-lifecycle/coordinator.ts",
      "lib/prematch-lifecycle/transport.ts",
      "lib/prematch-decision/durable-postgres.ts",
      "lib/apex-opportunities/scanner-canonical.ts",
      "app/api/internal/prematch-lifecycle/route.ts",
    ];
    for (const file of files) {
      const src = sourceOf(file);
      expect(src).not.toMatch(/\.update\s*\(/);
      expect(src).not.toMatch(/\.upsert\s*\(/);
      expect(src).not.toMatch(/\.delete\s*\(/);
      expect(src).not.toMatch(/\bUPSERT\b/);
    }
  });

  it("covers today/tomorrow UTC boundary and dedupes duplicate dates", async () => {
    const fixture = lifecycleBundle(template, { fixtureId: "8001" });
    const report = await run({
      nowUtc: T60,
      fixturesByDate: {
        "2033-05-31": [fixture],
        "2033-06-01": [fixture],
      },
    });
    expect(discoveryCalls).toBe(2);
    expect(report.discoveredFixtureCount).toBe(1);
    expect(report.newTicketsCreated).toBe(1);
  });

  it("selects nearest kickoff first and respects the new-ticket cap", async () => {
    const report = await run({
      config: { leagueIds: [LEAGUE], maxNewTicketsPerRun: 2, leagueAllowlistInvalid: false },
      fixturesByDate: {
        "2033-05-31": [
          lifecycleBundle(template, {
            fixtureId: "8003",
            kickoffAt: "2033-06-01T00:20:00.000Z",
          }),
          lifecycleBundle(template, {
            fixtureId: "8001",
            kickoffAt: "2033-06-01T00:10:00.000Z",
          }),
          lifecycleBundle(template, {
            fixtureId: "8002",
            kickoffAt: "2033-06-01T00:15:00.000Z",
          }),
        ],
      },
    });
    expect(report.newTicketAttempts).toBe(2);
    expect(report.newTicketsCreated).toBe(2);
    expect(await tickets.getByFixtureId("8001")).not.toBeNull();
    expect(await tickets.getByFixtureId("8002")).not.toBeNull();
    expect(await tickets.getByFixtureId("8003")).toBeNull();
  });

  it("does not capture globally when the allowlist is absent", async () => {
    const report = await run({
      config: { leagueIds: [], maxNewTicketsPerRun: 10, leagueAllowlistInvalid: false },
      fixturesByDate: {
        "2033-05-31": [lifecycleBundle(template, { fixtureId: "8001" })],
      },
    });
    expect(report.newTicketsCreated).toBe(0);
    expect(report.eligibleT120Count).toBe(0);
    expect(oddsCalls).toBe(0);
  });

  it("skips invalid kickoff safely", async () => {
    const report = await run({
      fixturesByDate: {
        "2033-05-31": [
          lifecycleBundle(template, {
            fixtureId: "8001",
            kickoffAt: "not-a-kickoff",
          }),
        ],
      },
    });
    expect(report.newTicketsCreated).toBe(0);
    expect(report.peComputations).toBe(0);
  });

  it("does not convert incomplete FT scores to 0-0", async () => {
    await createPrematchDecisionTicket({
      published: ticketSnapshot("8001"),
      clock: T60,
      store: tickets,
    });
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, {
            fixtureId: "8001",
            status: "FT",
            fulltime: { home: null, away: null },
            goals: { home: null, away: null },
          }),
        ],
      },
    });
    expect(report.evidenceCreated).toBe(0);
    expect(report.evaluationsCreated).toBe(0);
    expect(await evidence.getCanonicalByFixtureId("8001")).toBeNull();
  });

  it("restarts after ticket insert and before finalization", async () => {
    const backend = new InMemoryPrematchDecisionTicketBackend();
    const memory = new InMemoryPrematchDecisionTicketStore();
    const store = new LayeredPrematchDecisionTicketStore(memory, backend);
    await run({
      ticketStore: store,
      fixturesByDate: {
        "2033-05-31": [lifecycleBundle(template, { fixtureId: "8001" })],
      },
    });
    memory.clear();
    const report = await run({
      nowUtc: AFTER,
      ticketStore: store,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, {
            fixtureId: "8001",
            status: "FT",
            fulltime: { home: 2, away: 1 },
            goals: { home: 2, away: 1 },
          }),
        ],
      },
    });
    expect(report.newTicketsCreated).toBe(0);
    expect(report.evidenceCreated).toBe(1);
    expect(report.evaluationsCreated).toBe(1);
  });

  it("restarts after evidence insert and before evaluation", async () => {
    const evBackend = new InMemoryFinalFixtureEvidenceBackend();
    const evMemory = new InMemoryFinalFixtureEvidenceStore();
    const evStore = new LayeredFinalFixtureEvidenceStore(evMemory, evBackend);
    const blockedEval = new LayeredPrematchDecisionEvaluationStore(
      new InMemoryPrematchDecisionEvaluationStore(),
      new UnavailablePrematchDecisionEvaluationBackend(),
    );
    await createPrematchDecisionTicket({
      published: ticketSnapshot("8001"),
      clock: T60,
      store: tickets,
    });
    const first = await run({
      nowUtc: AFTER,
      evidenceStore: evStore,
      evaluationStore: blockedEval,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, {
            fixtureId: "8001",
            status: "FT",
            fulltime: { home: 2, away: 1 },
            goals: { home: 2, away: 1 },
          }),
        ],
      },
    });
    expect(first.evidenceCreated).toBe(1);
    expect(first.evaluationsCreated).toBe(0);
    evMemory.clear();
    const evalStore = new LayeredPrematchDecisionEvaluationStore(
      new InMemoryPrematchDecisionEvaluationStore(),
      new InMemoryPrematchDecisionEvaluationBackend(),
    );
    const report = await run({
      nowUtc: AFTER,
      evidenceStore: evStore,
      evaluationStore: evalStore,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, {
            fixtureId: "8001",
            status: "FT",
            fulltime: { home: 2, away: 1 },
            goals: { home: 2, away: 1 },
          }),
        ],
      },
    });
    expect(report.evidenceCreated).toBe(0);
    expect(report.evaluationsCreated).toBe(1);
  });

  async function seedFrozenTicket(
    fixtureId: string,
    kickoffUtc: string,
    store: PrematchDecisionTicketStore = tickets,
  ) {
    const capture = new Date(
      Date.parse(kickoffUtc) - 60 * 60 * 1000,
    ).toISOString();
    const result = await createPrematchDecisionTicket({
      published: ticketSnapshot(fixtureId, { kickoffUtc }),
      clock: capture,
      store,
    });
    expect(result.ok).toBe(true);
  }

  function daysAgo(nowUtc: string, days: number): string {
    return new Date(Date.parse(nowUtc) - days * 24 * 60 * 60 * 1000).toISOString();
  }

  function ftBundle(
    fixtureId: string,
    kickoffAt: string,
    fulltime: { home: number | null; away: number | null },
    status = "FT",
  ) {
    return lifecycleBundle(template, {
      fixtureId,
      status,
      kickoffAt,
      fulltime,
      goals: { home: fulltime.home, away: fulltime.away },
    });
  }

  it("A. original kickoff 15 days ago is still finalized", async () => {
    const kickoff = daysAgo(AFTER, 15);
    await seedFrozenTicket("8015", kickoff);
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [ftBundle("8015", kickoff, { home: 1, away: 0 })],
      },
    });
    expect(report.finalizationCandidates).toBeGreaterThan(0);
    expect(report.evidenceCreated).toBe(1);
    expect(report.evaluationsCreated).toBe(1);
    expect(await evidence.getCanonicalByFixtureId("8015")).not.toBeNull();
  });

  it("B. original kickoff 60 days ago remains reconcilable after PST", async () => {
    const kickoff = daysAgo(AFTER, 60);
    await seedFrozenTicket("8060", kickoff);
    const waiting = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, {
            fixtureId: "8060",
            status: "PST",
            kickoffAt: kickoff,
          }),
        ],
      },
    });
    expect(waiting.evidenceCreated).toBe(0);
    expect(await evidence.getCanonicalByFixtureId("8060")).toBeNull();
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [ftBundle("8060", kickoff, { home: 2, away: 2 })],
      },
    });
    expect(report.evidenceCreated).toBe(1);
    expect(report.evaluationsCreated).toBe(1);
    expect(report.newTicketsCreated).toBe(0);
  });

  it("C. old ticket later FT finalizes original ticket and creates no new ticket", async () => {
    const kickoff = daysAgo(AFTER, 20);
    await seedFrozenTicket("8020", kickoff);
    const before = await tickets.getByFixtureId("8020");
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [ftBundle("8020", kickoff, { home: 3, away: 1 })],
      },
    });
    expect(report.newTicketsCreated).toBe(0);
    expect(report.evidenceCreated).toBe(1);
    expect((await tickets.getByFixtureId("8020"))?.ticketId).toBe(
      before?.ticketId,
    );
    expect((await tickets.getByFixtureId("8020"))?.kickoffUtc).toBe(kickoff);
  });

  it("D. old ticket later CANC creates evidence only", async () => {
    const kickoff = daysAgo(AFTER, 20);
    await seedFrozenTicket("8021", kickoff);
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, {
            fixtureId: "8021",
            status: "CANC",
            kickoffAt: kickoff,
          }),
        ],
      },
    });
    expect(report.evidenceCreated).toBe(1);
    expect(report.evaluationsCreated).toBe(0);
    expect(report.voidTerminalCount).toBe(1);
    expect(
      await evaluations.getByIdentity(
        (await tickets.getByFixtureId("8021"))!.ticketId,
        SETTLEMENT_POLICY_REGULATION_90_V1,
        1,
      ),
    ).toBeNull();
  });

  it("E. more than 500 unresolved tickets still reach later rows", async () => {
    const kickoffs: string[] = [];
    for (let i = 0; i < 501; i += 1) {
      const kickoff = new Date(
        Date.parse("2033-04-01T00:00:00.000Z") + i * 60_000,
      ).toISOString();
      kickoffs.push(kickoff);
      await seedFrozenTicket(String(12000 + i), kickoff);
    }
    const lastId = "12500";
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          ftBundle(lastId, kickoffs[500], { home: 1, away: 0 }),
        ],
      },
    });
    expect(report.ticketListPages).toBeGreaterThan(1);
    expect(await evidence.getCanonicalByFixtureId(lastId)).not.toBeNull();
    expect(report.evidenceCreated).toBe(1);
  });

  it("F. pagination is deterministic across equal kickoffUtc values", async () => {
    const kickoff = daysAgo(AFTER, 10);
    await seedFrozenTicket("8301", kickoff);
    await seedFrozenTicket("8302", kickoff);
    const to = "2033-06-03T00:00:00.000Z";
    const first = await tickets.listByKickoffRange(
      PENDING_TICKET_EPOCH_UTC,
      to,
      1,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await tickets.listByKickoffRange(
      PENDING_TICKET_EPOCH_UTC,
      to,
      1,
      {
        kickoffUtc: first.tickets[0].kickoffUtc,
        ticketId: first.tickets[0].ticketId,
      },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(first.tickets[0].ticketId).not.toBe(second.tickets[0].ticketId);
    expect(
      comparePrematchTicketListCursor(first.tickets[0], second.tickets[0]),
    ).toBeLessThan(0);
  });

  it("G. restart during pagination needs no mutable cursor", async () => {
    const backend = new InMemoryPrematchDecisionTicketBackend();
    const memory = new InMemoryPrematchDecisionTicketStore();
    const store = new LayeredPrematchDecisionTicketStore(memory, backend);
    const kickoff = daysAgo(AFTER, 15);
    await seedFrozenTicket("8401", kickoff, store);
    memory.clear();
    const first = await run({
      nowUtc: AFTER,
      ticketStore: store,
      fixturesByDate: { "2033-06-01": [] },
    });
    expect(first.newTicketsCreated).toBe(0);
    memory.clear();
    const second = await run({
      nowUtc: AFTER,
      ticketStore: store,
      fixturesByDate: {
        "2033-06-01": [ftBundle("8401", kickoff, { home: 1, away: 0 })],
      },
    });
    expect(second.evidenceCreated).toBe(1);
    expect(second.evaluationsCreated).toBe(1);
  });

  it("H. ids batches split 16/30/31 as 2/2/3", async () => {
    async function batchCount(n: number) {
      tickets = new InMemoryPrematchDecisionTicketStore();
      idsBatches = [];
      idsCalls = 0;
      for (let i = 0; i < n; i += 1) {
        await seedFrozenTicket(
          String(13000 + i),
          daysAgo(AFTER, 16),
        );
      }
      await run({
        nowUtc: AFTER,
        fixturesByDate: { "2033-06-01": [] },
        fetchIds: async (ids) => {
          idsCalls += 1;
          idsBatches.push([...ids]);
          return [];
        },
      });
      return idsBatches.map((batch) => batch.length);
    }
    expect(await batchCount(16)).toEqual([15, 1]);
    expect(await batchCount(30)).toEqual([15, 15]);
    expect(await batchCount(31)).toEqual([15, 15, 1]);
  });

  it("I. one ids batch failure does not prevent later batches", async () => {
    for (let i = 0; i < 16; i += 1) {
      await seedFrozenTicket(String(14000 + i), daysAgo(AFTER, 16));
    }
    let attempts = 0;
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: { "2033-06-01": [] },
      fetchIds: async (ids) => {
        attempts += 1;
        if (attempts === 1) throw new Error("batch 1 down");
        return ids.map((id) =>
          ftBundle(id, daysAgo(AFTER, 16), { home: 1, away: 0 }),
        );
      },
    });
    expect(report.errorCount).toBeGreaterThan(0);
    expect(report.evidenceCreated).toBeGreaterThan(0);
  });

  it("J. one evidence ingest failure does not block another fixture", async () => {
    const kickoff = daysAgo(AFTER, 12);
    await seedFrozenTicket("8501", kickoff);
    await seedFrozenTicket("8502", kickoff);
    const inner = evidence;
    const wrapped: FinalFixtureEvidenceStore = {
      getByEvidenceId: (id) => inner.getByEvidenceId(id),
      getCanonicalByFixtureId: (id) => inner.getCanonicalByFixtureId(id),
      listByFixtureId: (id) => inner.listByFixtureId(id),
      observe: async (observation) => {
        if (String(observation.fixtureId).includes("8501")) {
          throw new Error("ingest 8501");
        }
        return inner.observe(observation);
      },
      clear: () => inner.clear(),
    };
    const report = await run({
      nowUtc: AFTER,
      evidenceStore: wrapped,
      fixturesByDate: {
        "2033-06-01": [
          ftBundle("8501", kickoff, { home: 1, away: 0 }),
          ftBundle("8502", kickoff, { home: 2, away: 0 }),
        ],
      },
    });
    expect(report.errorCount).toBeGreaterThan(0);
    expect(await inner.getCanonicalByFixtureId("8502")).not.toBeNull();
    expect(await inner.getCanonicalByFixtureId("8501")).toBeNull();
  });

  it("K. one evaluation completion failure does not block another fixture", async () => {
    const kickoff = daysAgo(AFTER, 12);
    await seedFrozenTicket("8601", kickoff);
    await seedFrozenTicket("8602", kickoff);
    const failId = prematchDecisionTicketId("8601");
    const inner = evaluations;
    const wrapped: PrematchDecisionEvaluationStore = {
      getByEvaluationId: (id) => inner.getByEvaluationId(id),
      getByIdentity: (ticketId, policy, revision) =>
        inner.getByIdentity(ticketId, policy, revision),
      insertIfAbsent: async (row) => {
        if (row.ticketId === failId) throw new Error("eval 8601");
        return inner.insertIfAbsent(row);
      },
      clear: () => inner.clear(),
    };
    const report = await run({
      nowUtc: AFTER,
      evaluationStore: wrapped,
      fixturesByDate: {
        "2033-06-01": [
          ftBundle("8601", kickoff, { home: 1, away: 0 }),
          ftBundle("8602", kickoff, { home: 2, away: 0 }),
        ],
      },
    });
    expect(report.errorCount).toBeGreaterThan(0);
    expect(
      await inner.getByIdentity(
        prematchDecisionTicketId("8602")!,
        SETTLEMENT_POLICY_REGULATION_90_V1,
        1,
      ),
    ).not.toBeNull();
  });

  it("L. non-numeric fixture id is skipped and never attached to another ticket", async () => {
    const kickoff = daysAgo(AFTER, 12);
    await seedFrozenTicket("not-a-fixture", kickoff);
    await seedFrozenTicket("8701", kickoff);
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: { "2033-06-01": [] },
      fetchIds: async (ids) => {
        expect(ids).not.toContain("not-a-fixture");
        return ids.map((id) =>
          ftBundle(
            id === "8701" ? "not-a-fixture" : id,
            kickoff,
            { home: 9, away: 9 },
          ),
        );
      },
    });
    expect(report.invalidFixtureIdCount).toBe(1);
    expect(await evidence.getCanonicalByFixtureId("not-a-fixture")).toBeNull();
    expect(await evidence.getCanonicalByFixtureId("8701")).toBeNull();
  });

  it("M. genuine 0-0 FT creates evidence and evaluation", async () => {
    await seedFrozenTicket("8801", daysAgo(AFTER, 5));
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          ftBundle("8801", daysAgo(AFTER, 5), { home: 0, away: 0 }),
        ],
      },
    });
    expect(report.evidenceCreated).toBe(1);
    expect(report.evaluationsCreated).toBe(1);
    const row = await evidence.getCanonicalByFixtureId("8801");
    expect(row?.fulltimeHome).toBe(0);
    expect(row?.fulltimeAway).toBe(0);
  });

  it("N. null / one-sided null FT does not create evidence", async () => {
    await seedFrozenTicket("8802", daysAgo(AFTER, 5));
    await seedFrozenTicket("8803", daysAgo(AFTER, 5));
    const report = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          ftBundle("8802", daysAgo(AFTER, 5), { home: null, away: null }),
          ftBundle("8803", daysAgo(AFTER, 5), { home: 1, away: null }),
        ],
      },
    });
    expect(report.evidenceCreated).toBe(0);
    expect(await evidence.getCanonicalByFixtureId("8802")).toBeNull();
    expect(await evidence.getCanonicalByFixtureId("8803")).toBeNull();
  });

  it("O. T-120 millisecond boundaries remain unchanged", async () => {
    const kickoffMs = Date.parse(KICKOFF);
    const windowMs = CANONICAL_CAPTURE_WINDOW_MINUTES * 60 * 1000;
    const cases: Array<[number, number]> = [
      [kickoffMs - windowMs - 1, 0],
      [kickoffMs - windowMs, 1],
      [kickoffMs - windowMs + 1, 1],
      [kickoffMs - 1, 1],
      [kickoffMs, 0],
      [kickoffMs + 1, 0],
    ];
    for (const [nowMs, created] of cases) {
      tickets = new InMemoryPrematchDecisionTicketStore();
      const nowUtc = new Date(nowMs).toISOString();
      const today = nowUtc.slice(0, 10);
      const report = await run({
        nowUtc,
        fixturesByDate: {
          [today]: [lifecycleBundle(template, { fixtureId: "8901" })],
        },
      });
      expect(report.newTicketsCreated, nowUtc).toBe(created);
    }
  });

  it("P/Q. UTC year and leap-day discovery dates are requested", async () => {
    const nyeDates: string[] = [];
    await runPrematchLifecycle({
      nowUtc: "2025-12-31T23:50:00.000Z",
      config: CONFIG,
      listFixturesByDate: async (date) => {
        nyeDates.push(date);
        return [];
      },
      attachOdds,
      fetchFixturesByIds: fetchByIds,
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    expect(nyeDates).toEqual(["2025-12-31", "2026-01-01"]);

    const leapDates: string[] = [];
    await runPrematchLifecycle({
      nowUtc: "2024-02-28T23:00:00.000Z",
      config: CONFIG,
      listFixturesByDate: async (date) => {
        leapDates.push(date);
        return [];
      },
      attachOdds,
      fetchFixturesByIds: fetchByIds,
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    expect(leapDates).toEqual(["2024-02-28", "2024-02-29"]);
  });

  it("R. mixed invalid allowlist disables capture and surfaces error", async () => {
    const report = await runPrematchLifecycle({
      nowUtc: T60,
      env: { [LIFECYCLE_LEAGUE_IDS_ENV]: "901, nope" },
      listFixturesByDate: discovery({
        "2033-05-31": [lifecycleBundle(template, { fixtureId: "8001" })],
      }),
      attachOdds,
      fetchFixturesByIds: fetchByIds,
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    expect(report.leagueAllowlistInvalid).toBe(true);
    expect(report.newTicketsCreated).toBe(0);
    expect(report.eligibleT120Count).toBe(0);
    expect(report.errorCount).toBeGreaterThan(0);
    expect(oddsCalls).toBe(0);
  });

  it("T. counters distinguish created vs this-run idempotent vs existing void", async () => {
    const kickoff = daysAgo(AFTER, 8);
    await seedFrozenTicket("9001", kickoff);
    const first = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, {
            fixtureId: "9001",
            status: "CANC",
            kickoffAt: kickoff,
          }),
        ],
      },
    });
    expect(first.evidenceCreated).toBe(1);
    expect(first.voidTerminalCount).toBe(1);
    expect(first.evaluationsCreated).toBe(0);
    const second = await run({
      nowUtc: AFTER,
      fixturesByDate: {
        "2033-06-01": [
          lifecycleBundle(template, {
            fixtureId: "9001",
            status: "CANC",
            kickoffAt: kickoff,
          }),
        ],
      },
    });
    expect(second.evidenceCreated).toBe(0);
    expect(second.voidTerminalCount).toBe(0);
    expect(second.evaluationsCreated).toBe(0);
  });
});
