/**
 * PE-3C — Controlled C0 lifecycle activation candidate tests.
 * Injects peInputMode=c0_recon via deps. Default production gate stays OFF.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  InMemoryFinalFixtureEvidenceStore,
  resetFinalFixtureEvidenceStoreForTests,
} from "@/lib/final-evidence/store";
import {
  catalogueEloFromPlayedStats,
  PRODUCTION_AWAY_ELO_BASE,
  PRODUCTION_HOME_ELO_BASE,
} from "@/lib/match-center/catalogue-elo";
import {
  InMemoryPrematchDecisionTicketStore,
  resetPrematchDecisionTicketStoreForTests,
} from "@/lib/prematch-decision/store";
import {
  REGIME_LIFECYCLE_BASE_PRIOR_V1,
  REGIME_LIFECYCLE_C0_RECON_V1,
  assertSameInputRegimeCohort,
  resolveTicketInputRegime,
} from "@/lib/prematch-decision/input-provenance";
import { serializePrematchDecisionTicket } from "@/lib/prematch-decision/serialize";
import { createPrematchDecisionTicket } from "@/lib/prematch-decision/create";
import type { PrematchLifecycleConfig } from "@/lib/prematch-lifecycle/config";
import { runPrematchLifecycle } from "@/lib/prematch-lifecycle/coordinator";
import {
  PE3C_C0_RECON_ACTIVATION,
  resolveLifecyclePeInputMode,
} from "@/lib/prematch-lifecycle/pe3-activation";
import {
  createSeasonUniverseLoaderFromProviderFetch,
  type SeasonUniverseProviderRow,
} from "@/lib/prematch-lifecycle/season-universe";
import {
  InMemoryPrematchDecisionEvaluationStore,
  resetPrematchDecisionEvaluationStoreForTests,
} from "@/lib/prematch-evaluation/store";

const LEAGUE_EXT = "901";
const COMPETITION_ID = `apex:api-football:league:${LEAGUE_EXT}`;
const SEASON = "2026";
const KICKOFF = "2033-06-01T00:30:00.000Z";
const T60 = "2033-05-31T23:30:00.000Z";
const BEFORE = "2033-05-20T15:00:00.000Z";
const SAME = KICKOFF;
const AFTER = "2033-06-10T15:00:00.000Z";

const CONFIG: PrematchLifecycleConfig = {
  leagueIds: [LEAGUE_EXT],
  maxNewTicketsPerRun: 10,
  leagueAllowlistInvalid: false,
};

const STRONG = "team-strong-c0";
const WEAK = "team-weak-c0";

async function templateBundle(): Promise<ApexMatchBundle> {
  return createMockDataProvider().getMatch({ matchId: DEMO_MATCH_EXTERNAL_ID });
}

function lifecycleBundle(
  template: ApexMatchBundle,
  options: {
    fixtureId: string;
    homeTeamId?: string;
    awayTeamId?: string;
    status?: string;
    kickoffAt?: string;
    season?: string | null;
    odds?: ApexMatchBundle["odds"];
  },
): ApexMatchBundle {
  const homeTeamId = options.homeTeamId ?? STRONG;
  const awayTeamId = options.awayTeamId ?? WEAK;
  return {
    ...template,
    odds: options.odds ?? template.odds,
    homeTeam: { ...template.homeTeam, id: homeTeamId, name: "Strong FC" },
    awayTeam: { ...template.awayTeam, id: awayTeamId, name: "Weak FC" },
    league: template.league
      ? {
          ...template.league,
          id: COMPETITION_ID,
          season: options.season === undefined ? SEASON : options.season,
          externalRefs: [
            { provider: "api-football", externalId: LEAGUE_EXT },
          ],
        }
      : null,
    match: {
      ...template.match,
      id: `apex:api-football:match:${options.fixtureId}`,
      kickoffAt: options.kickoffAt ?? KICKOFF,
      status: "scheduled",
      vendorStatusShort: options.status ?? "NS",
      externalRefs: [
        { provider: "api-football", externalId: options.fixtureId },
      ],
    },
  };
}

function histRow(
  partial: Partial<SeasonUniverseProviderRow> &
    Pick<SeasonUniverseProviderRow, "fixtureId">,
): SeasonUniverseProviderRow {
  return {
    kickoffUtc: BEFORE,
    homeTeamId: STRONG,
    awayTeamId: "opp",
    competitionId: COMPETITION_ID,
    season: SEASON,
    status: "FT",
    homeGoals: 2,
    awayGoals: 0,
    ...partial,
  };
}

function buildUniverseRows(): SeasonUniverseProviderRow[] {
  return [
    histRow({
      fixtureId: "h1",
      homeTeamId: STRONG,
      awayTeamId: "opp-a",
      homeGoals: 3,
      awayGoals: 0,
    }),
    histRow({
      fixtureId: "h2",
      homeTeamId: "opp-b",
      awayTeamId: STRONG,
      homeGoals: 0,
      awayGoals: 2,
    }),
    histRow({
      fixtureId: "h3",
      homeTeamId: STRONG,
      awayTeamId: "opp-c",
      homeGoals: 4,
      awayGoals: 1,
    }),
    histRow({
      fixtureId: "h4",
      homeTeamId: WEAK,
      awayTeamId: "opp-d",
      homeGoals: 0,
      awayGoals: 3,
    }),
    histRow({
      fixtureId: "h5",
      homeTeamId: "opp-e",
      awayTeamId: WEAK,
      homeGoals: 2,
      awayGoals: 0,
    }),
    histRow({
      fixtureId: "h6",
      homeTeamId: WEAK,
      awayTeamId: "opp-f",
      homeGoals: 1,
      awayGoals: 4,
    }),
    histRow({
      fixtureId: "future-leak",
      kickoffUtc: AFTER,
      homeTeamId: STRONG,
      awayTeamId: WEAK,
      homeGoals: 9,
      awayGoals: 0,
    }),
    histRow({
      fixtureId: "same-ko-leak",
      kickoffUtc: SAME,
      homeTeamId: STRONG,
      awayTeamId: "opp-z",
      homeGoals: 7,
      awayGoals: 0,
    }),
    histRow({
      fixtureId: "live-leak",
      status: "LIVE",
      homeTeamId: STRONG,
      awayTeamId: "opp-y",
      homeGoals: 5,
      awayGoals: 0,
    }),
  ];
}

describe("PE-3C controlled C0 lifecycle activation candidate", () => {
  let template: ApexMatchBundle;
  let tickets: InMemoryPrematchDecisionTicketStore;
  let evidence: InMemoryFinalFixtureEvidenceStore;
  let evaluations: InMemoryPrematchDecisionEvaluationStore;
  let universeFetches: number;

  beforeEach(async () => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
    template = await templateBundle();
    tickets = new InMemoryPrematchDecisionTicketStore();
    evidence = new InMemoryFinalFixtureEvidenceStore();
    evaluations = new InMemoryPrematchDecisionEvaluationStore();
    universeFetches = 0;
  });

  afterEach(() => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
  });

  function seasonLoader(rows: SeasonUniverseProviderRow[] = buildUniverseRows()) {
    return createSeasonUniverseLoaderFromProviderFetch(async () => {
      universeFetches += 1;
      return rows;
    });
  }

  function runC0(input: {
    fixtures: ApexMatchBundle[];
    rows?: SeasonUniverseProviderRow[];
    attach?: (b: ApexMatchBundle) => Promise<ApexMatchBundle>;
    peInputMode?: "base_prior" | "c0_recon";
  }) {
    return runPrematchLifecycle({
      nowUtc: T60,
      config: CONFIG,
      peInputMode: input.peInputMode ?? "c0_recon",
      seasonUniverseLoader: seasonLoader(input.rows),
      listFixturesByDate: async (date) =>
        date === "2033-05-31" ? input.fixtures : [],
      attachOdds:
        input.attach ??
        (async (bundle) =>
          bundle.odds.length > 0
            ? bundle
            : { ...bundle, odds: template.odds }),
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
  }

  it("default production gate remains OFF / base_prior", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(resolveLifecyclePeInputMode()).toBe("base_prior");
  });

  it("default mode does not acquire season universe", async () => {
    const report = await runC0({
      peInputMode: "base_prior",
      fixtures: [
        lifecycleBundle(template, { fixtureId: "9001" }),
      ],
    });
    expect(report.newTicketsCreated).toBe(1);
    expect(universeFetches).toBe(0);
    expect(report.seasonUniverseRequests).toBe(0);
    expect(report.c0ReconAttempts).toBe(0);
    const ticket = await tickets.getByFixtureId("9001");
    expect(resolveTicketInputRegime(ticket!)).toBe(
      REGIME_LIFECYCLE_BASE_PRIOR_V1,
    );
    expect(ticket!.inputProvenance).toBeUndefined();
  });

  it("golden C0 lifecycle: regime, Elo, provenance, leakage ignored", async () => {
    const report = await runC0({
      fixtures: [lifecycleBundle(template, { fixtureId: "9101" })],
    });
    expect(report.newTicketsCreated).toBe(1);
    expect(report.c0ReconTicketsCreated).toBe(1);
    expect(report.seasonUniverseAcquisitions).toBe(1);
    expect(report.seasonUniverseRequests).toBe(1);
    expect(universeFetches).toBe(1);

    const ticket = await tickets.getByFixtureId("9101");
    expect(ticket).not.toBeNull();
    expect(ticket!.inputProvenance?.inputRegime).toBe(
      REGIME_LIFECYCLE_C0_RECON_V1,
    );
    expect(ticket!.inputProvenance?.contextLayers).toEqual({});
    expect(ticket!.model.version).toMatch(/^elo-poisson-hybrid-0\.1\.0/);
    expect(ticket!.inputProvenance?.modelVersion).toMatch(
      /^elo-poisson-hybrid-0\.1\.0/,
    );

    const expectedHome = catalogueEloFromPlayedStats({
      base: PRODUCTION_HOME_ELO_BASE,
      played: 3,
      wins: 3,
      goalsFor: 9,
      goalsAgainst: 1,
    });
    const expectedAway = catalogueEloFromPlayedStats({
      base: PRODUCTION_AWAY_ELO_BASE,
      played: 3,
      wins: 0,
      goalsFor: 1,
      goalsAgainst: 9,
    });
    expect(ticket!.inputProvenance?.home.elo).toBe(expectedHome);
    expect(ticket!.inputProvenance?.away.elo).toBe(expectedAway);
    expect(ticket!.inputProvenance?.home.played).toBe(3);
    expect(ticket!.inputProvenance?.away.played).toBe(3);
    expect(ticket!.inputProvenance?.fallback).toBe(false);

    const sum = ticket!.selections
      .filter((s) => s.marketId === "1x2")
      .reduce((acc, s) => acc + s.modelProbability, 0);
    expect(sum).toBeCloseTo(1, 10);

    // Provenance survives serialization (JSON payload path)
    const roundTrip = JSON.parse(
      serializePrematchDecisionTicket(ticket!),
    ) as typeof ticket;
    expect(roundTrip!.inputProvenance?.inputRegime).toBe(
      REGIME_LIFECYCLE_C0_RECON_V1,
    );
    expect(roundTrip!.inputProvenance?.contextLayers).toEqual({});
  });

  it("same league+season: 3 fixtures → 1 universe request", async () => {
    const report = await runC0({
      fixtures: [
        lifecycleBundle(template, { fixtureId: "9201" }),
        lifecycleBundle(template, { fixtureId: "9202" }),
        lifecycleBundle(template, { fixtureId: "9203" }),
      ],
    });
    expect(report.newTicketsCreated).toBe(3);
    expect(universeFetches).toBe(1);
    expect(report.seasonUniverseRequests).toBe(1);
    expect(report.seasonUniverseCacheHits).toBe(2);
  });

  it("already-ticketed fixture → zero universe acquisition", async () => {
    await createPrematchDecisionTicket({
      published: {
        fixtureId: "9301",
        leagueId: COMPETITION_ID,
        season: SEASON,
        homeTeamId: STRONG,
        awayTeamId: WEAK,
        homeTeamName: "Strong FC",
        awayTeamName: "Weak FC",
        kickoffUtc: KICKOFF,
        vendorStatusShort: "NS",
        sourceMode: "scanner",
        modelVersion: "elo-poisson-hybrid-0.1.0",
        markets: [
          {
            marketId: "1x2",
            marketLine: null,
            selections: [
              { selectionId: "home", selectionLabel: "Home", modelProbability: 0.5 },
              { selectionId: "draw", selectionLabel: "Draw", modelProbability: 0.25 },
              { selectionId: "away", selectionLabel: "Away", modelProbability: 0.25 },
            ],
          },
        ],
      },
      clock: T60,
      store: tickets,
    });

    const report = await runC0({
      fixtures: [lifecycleBundle(template, { fixtureId: "9301" })],
    });
    expect(report.alreadyTicketedCount + report.newTicketsIdempotent).toBeGreaterThan(0);
    expect(report.newTicketsCreated).toBe(0);
    expect(universeFetches).toBe(0);
    expect(report.c0ReconAttempts).toBe(0);
    const existing = await tickets.getByFixtureId("9301");
    expect(existing!.inputProvenance).toBeUndefined();
  });

  it("future universe mutation does not change frozen C0 ticket probs", async () => {
    const rows = buildUniverseRows();
    await runC0({
      fixtures: [lifecycleBundle(template, { fixtureId: "9401" })],
      rows,
    });
    const first = await tickets.getByFixtureId("9401");
    const firstHome = first!.selections.find(
      (s) => s.marketId === "1x2" && s.selectionId === "home",
    )!.modelProbability;

    // Second run with mutated future row — fixture already ticketed, no recompute
    rows.push(
      histRow({
        fixtureId: "future-extra",
        kickoffUtc: AFTER,
        homeTeamId: STRONG,
        awayTeamId: WEAK,
        homeGoals: 20,
        awayGoals: 0,
      }),
    );
    await runC0({
      fixtures: [lifecycleBundle(template, { fixtureId: "9401" })],
      rows,
    });
    const second = await tickets.getByFixtureId("9401");
    expect(
      second!.selections.find(
        (s) => s.marketId === "1x2" && s.selectionId === "home",
      )!.modelProbability,
    ).toBe(firstHome);
    expect(second!.inputProvenance?.home.elo).toBe(
      first!.inputProvenance?.home.elo,
    );
  });

  it("odds change does not mutate model probability", async () => {
    const lowOdds = structuredClone(template.odds);
    const highOdds = structuredClone(template.odds);
    // Best-effort mutate decimal odds if present
    for (const quote of lowOdds) {
      for (const sel of quote.selections) {
        if (sel.key === "home" || sel.label.toLowerCase().includes("home")) {
          sel.decimalOdds = 1.2;
        }
      }
    }
    for (const quote of highOdds) {
      for (const sel of quote.selections) {
        if (sel.key === "home" || sel.label.toLowerCase().includes("home")) {
          sel.decimalOdds = 3.5;
        }
      }
    }

    await runC0({
      fixtures: [
        lifecycleBundle(template, { fixtureId: "9501", odds: lowOdds }),
      ],
    });
    const a = await tickets.getByFixtureId("9501");

    resetPrematchDecisionTicketStoreForTests();
    tickets = new InMemoryPrematchDecisionTicketStore();

    await runC0({
      fixtures: [
        lifecycleBundle(template, { fixtureId: "9502", odds: highOdds }),
      ],
    });
    const b = await tickets.getByFixtureId("9502");

    const pA = a!.selections
      .filter((s) => s.marketId === "1x2")
      .map((s) => s.modelProbability);
    const pB = b!.selections
      .filter((s) => s.marketId === "1x2")
      .map((s) => s.modelProbability);
    expect(pA).toEqual(pB);
    expect(a!.inputProvenance?.home.elo).toBe(b!.inputProvenance?.home.elo);
  });

  it("missing season → skip ticket (fail-closed)", async () => {
    const report = await runC0({
      fixtures: [
        lifecycleBundle(template, {
          fixtureId: "9601",
          season: null,
        }),
      ],
    });
    expect(report.newTicketsCreated).toBe(0);
    expect(report.c0ReconSkipped).toBe(1);
    expect(await tickets.getByFixtureId("9601")).toBeNull();
  });

  it("zero historical evidence → explicit base_prior under C0 regime", async () => {
    const report = await runC0({
      fixtures: [lifecycleBundle(template, { fixtureId: "9701" })],
      rows: [
        histRow({
          fixtureId: "only-future",
          kickoffUtc: AFTER,
          homeTeamId: STRONG,
          awayTeamId: WEAK,
          homeGoals: 5,
          awayGoals: 0,
        }),
      ],
    });
    expect(report.newTicketsCreated).toBe(1);
    expect(report.c0ReconFallbackBasePrior).toBe(1);
    const ticket = await tickets.getByFixtureId("9701");
    expect(ticket!.inputProvenance?.inputRegime).toBe(
      REGIME_LIFECYCLE_C0_RECON_V1,
    );
    expect(ticket!.inputProvenance?.fallback).toBe(true);
    expect(ticket!.inputProvenance?.home.elo).toBe(PRODUCTION_HOME_ELO_BASE);
    expect(ticket!.inputProvenance?.away.elo).toBe(PRODUCTION_AWAY_ELO_BASE);
  });

  it("quota-class loader failure aborts run", async () => {
    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: CONFIG,
      peInputMode: "c0_recon",
      seasonUniverseLoader: async () => {
        throw Object.assign(new Error("rate limited"), {
          code: "rate_limited",
          status: 429,
        });
      },
      listFixturesByDate: async (date) =>
        date === "2033-05-31"
          ? [lifecycleBundle(template, { fixtureId: "9801" })]
          : [],
      attachOdds: async (b) => b,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    expect(report.fatalErrorCount).toBeGreaterThan(0);
    expect(report.newTicketsCreated).toBe(0);
  });

  it("cohort helper rejects PRE+POST pooling", () => {
    expect(() =>
      assertSameInputRegimeCohort([
        REGIME_LIFECYCLE_BASE_PRIOR_V1,
        REGIME_LIFECYCLE_C0_RECON_V1,
      ]),
    ).toThrow(/mixes input regimes/);
  });

  it("scanner global helper unchanged; coordinator uses lifecycle-specific seam", () => {
    const scanner = readFileSync(
      join(process.cwd(), "lib/apex-opportunities/scanner-canonical.ts"),
      "utf8",
    );
    const coordinator = readFileSync(
      join(process.cwd(), "lib/prematch-lifecycle/coordinator.ts"),
      "utf8",
    );
    expect(scanner).toContain("enrichment: EMPTY_MATCH_CENTER_ENRICHMENT");
    expect(scanner).not.toContain("prepareLifecycleC0MatchCenter");
    expect(coordinator).toContain("prepareLifecycleC0MatchCenter");
    expect(coordinator).toContain("createScannerMatchCenter");
    expect(coordinator).toContain("peInputMode");
  });
});
