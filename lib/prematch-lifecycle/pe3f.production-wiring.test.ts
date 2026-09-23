/**
 * PE-3F — Production paged-loader wiring + manual C0 activation controls.
 * Offline mocks only. Zero live API-Football / Supabase / production runs.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApiFootballFixtureItem } from "@/lib/data-platform/providers/api-football/types";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { LIVE_PROTOCOL_FINGERPRINT } from "@/lib/debug/calibration/prospective/protocol/protocol-fingerprint";
import {
  InMemoryFinalFixtureEvidenceStore,
  resetFinalFixtureEvidenceStoreForTests,
} from "@/lib/final-evidence/store";
import {
  InMemoryPrematchDecisionTicketStore,
  resetPrematchDecisionTicketStoreForTests,
} from "@/lib/prematch-decision/store";
import {
  REGIME_LIFECYCLE_BASE_PRIOR_V1,
  REGIME_LIFECYCLE_C0_RECON_V1,
} from "@/lib/prematch-decision/input-provenance";
import type { PrematchLifecycleConfig } from "@/lib/prematch-lifecycle/config";
import { runPrematchLifecycle } from "@/lib/prematch-lifecycle/coordinator";
import {
  PE3C_C0_RECON_ACTIVATION,
  resolveLifecyclePeInputMode,
} from "@/lib/prematch-lifecycle/pe3-activation";
import {
  MANUAL_C0_CONFIRM_FLAG,
  MANUAL_C0_ENABLE_FLAG,
  MANUAL_C0_SMOKE_MAX_NEW_TICKETS,
  parseManualC0SmokeArgv,
} from "@/lib/prematch-lifecycle/pe3-controlled-activation";
import { sanitizePrematchLifecycleReport } from "@/lib/prematch-lifecycle/runner";
import {
  SEASON_UNIVERSE_MAX_PAGES,
  createSeasonUniverseLoaderFromPagedTransport,
  createSeasonUniversePageTransportFromApiFootballClient,
  mapApiFootballFixtureItemToSeasonUniverseRow,
} from "@/lib/prematch-lifecycle/season-universe";
import {
  InMemoryPrematchDecisionEvaluationStore,
  resetPrematchDecisionEvaluationStoreForTests,
} from "@/lib/prematch-evaluation/store";

const LEAGUE_EXT = "39";
const COMPETITION = `apex:api-football:league:${LEAGUE_EXT}`;
const SEASON = "2024";
const KICKOFF = "2033-06-01T00:30:00.000Z";
const T60 = "2033-05-31T23:30:00.000Z";
const BEFORE = "2033-05-10T15:00:00.000Z";

const CONFIG: PrematchLifecycleConfig = {
  leagueIds: [LEAGUE_EXT],
  maxNewTicketsPerRun: 1,
  leagueAllowlistInvalid: false,
};

const HOME = "apex:api-football:team:33";
const AWAY = "apex:api-football:team:34";

function fixtureItem(
  overrides: Partial<{
    id: number;
    date: string;
    status: string;
    homeId: number;
    awayId: number;
    homeGoals: number | null;
    awayGoals: number | null;
    leagueId: number;
    season: number;
  }> = {},
): ApiFootballFixtureItem {
  return {
    fixture: {
      id: overrides.id ?? 1001,
      date: overrides.date ?? BEFORE,
      status: {
        short: (overrides.status ?? "FT") as ApiFootballFixtureItem["fixture"]["status"]["short"],
      },
    },
    league: {
      id: overrides.leagueId ?? Number(LEAGUE_EXT),
      name: "Premier League",
      season: overrides.season ?? Number(SEASON),
    },
    teams: {
      home: {
        id: overrides.homeId ?? 33,
        name: "Home",
      },
      away: {
        id: overrides.awayId ?? 34,
        name: "Away",
      },
    },
    goals: {
      home: overrides.homeGoals ?? 2,
      away: overrides.awayGoals ?? 0,
    },
    score: {
      fulltime: {
        home: overrides.homeGoals ?? 2,
        away: overrides.awayGoals ?? 0,
      },
    },
  } as ApiFootballFixtureItem;
}

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
  const homeTeamId = options.homeTeamId ?? HOME;
  const awayTeamId = options.awayTeamId ?? AWAY;
  return {
    ...template,
    odds: options.odds ?? template.odds,
    homeTeam: { ...template.homeTeam, id: homeTeamId, name: "Home FC" },
    awayTeam: { ...template.awayTeam, id: awayTeamId, name: "Away FC" },
    league: template.league
      ? {
          ...template.league,
          id: COMPETITION,
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

describe("PE-3F default-off + activation gate", () => {
  it("PE3C_C0_RECON_ACTIVATION remains false; default mode is base_prior", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(resolveLifecyclePeInputMode()).toBe("base_prior");
  });

  it("workflow still invokes lifecycle:prematch only (not c0-smoke)", () => {
    const yaml = readFileSync(
      resolve(process.cwd(), ".github/workflows/apex-prematch-lifecycle.yml"),
      "utf8",
    );
    expect(yaml).toMatch(/run:\s*npm run lifecycle:prematch\b/);
    expect(yaml).not.toMatch(/c0-smoke/);
    expect(yaml).not.toMatch(/enable-c0-recon/);
  });

  it("fingerprints unchanged", () => {
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(
      "7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c",
    );
    expect(LIVE_PROTOCOL_FINGERPRINT).toBe(
      "825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9",
    );
  });

  it("SEASON_UNIVERSE_MAX_PAGES hard bound preserved", () => {
    expect(SEASON_UNIVERSE_MAX_PAGES).toBe(20);
  });
});

describe("PE-3F manual controlled-activation mechanism", () => {
  it("fails closed without dual acknowledgements", () => {
    expect(parseManualC0SmokeArgv([]).ok).toBe(false);
    expect(parseManualC0SmokeArgv([MANUAL_C0_ENABLE_FLAG]).ok).toBe(false);
    expect(parseManualC0SmokeArgv([MANUAL_C0_CONFIRM_FLAG]).ok).toBe(false);
  });

  it("accepts dual acknowledgements with maxNewTickets=1 and c0_recon", () => {
    const parsed = parseManualC0SmokeArgv([
      MANUAL_C0_ENABLE_FLAG,
      MANUAL_C0_CONFIRM_FLAG,
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.controls.peInputMode).toBe("c0_recon");
    expect(parsed.controls.maxNewTicketsPerRun).toBe(
      MANUAL_C0_SMOKE_MAX_NEW_TICKETS,
    );
    expect(parsed.controls.maxNewTicketsPerRun).toBe(1);
    expect(parsed.controls.mechanism).toBe("manual_cli_dual_ack");
  });

  it("smoke script exists and does not flip PE3C_C0_RECON_ACTIVATION", () => {
    const script = readFileSync(
      resolve(process.cwd(), "scripts/run-prematch-lifecycle-c0-smoke.ts"),
      "utf8",
    );
    expect(script).toContain("parseManualC0SmokeArgv");
    expect(script).toContain("createProductionSeasonUniverseLoader");
    expect(script).toContain('peInputMode: parsed.controls.peInputMode');
    expect(script).not.toMatch(/PE3C_C0_RECON_ACTIVATION\s*=\s*true/);
  });

  it("package.json exposes c0-smoke script without changing scheduled entry", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["lifecycle:prematch"]).toBe(
      "tsx scripts/run-prematch-lifecycle.ts",
    );
    expect(pkg.scripts["lifecycle:prematch:c0-smoke"]).toBe(
      "tsx scripts/run-prematch-lifecycle-c0-smoke.ts",
    );
  });
});

describe("PE-3F paged API-Football transport (mocked client)", () => {
  it("forwards page + preserves paging + maps rows with apex ids", async () => {
    const pages: number[] = [];
    const client = {
      getFixturesByLeague: async (
        league: string | number,
        season: string | number,
        page?: number,
      ) => {
        expect(String(league)).toBe(LEAGUE_EXT);
        expect(String(season)).toBe(SEASON);
        expect(page).toBeDefined();
        pages.push(page!);
        if (page === 1) {
          return {
            response: [
              fixtureItem({ id: 1, homeGoals: 3, awayGoals: 0 }),
              fixtureItem({ id: 2, homeId: 34, awayId: 33, homeGoals: 0, awayGoals: 1 }),
            ],
            paging: { current: 1, total: 2 },
          };
        }
        return {
          response: [fixtureItem({ id: 3, homeGoals: 1, awayGoals: 0 })],
          paging: { current: 2, total: 2 },
        };
      },
    };

    const transport = createSeasonUniversePageTransportFromApiFootballClient(
      client,
    );
    const loader = createSeasonUniverseLoaderFromPagedTransport(transport);
    const acquired = await loader({
      competitionId: COMPETITION,
      season: SEASON,
    });

    expect(pages).toEqual([1, 2]);
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(acquired.httpRequests).toBe(2);
    expect(acquired.fixtures).toHaveLength(3);
    expect(acquired.fixtures[0]!.homeTeamId).toBe(HOME);
    expect(acquired.fixtures[0]!.competitionId).toBe(COMPETITION);
  });

  it("malformed paging fails closed; invalid vendor league never fetches", async () => {
    let fetched = 0;
    const badPaging = createSeasonUniverseLoaderFromPagedTransport({
      fetchPage: async () => {
        fetched += 1;
        return { paging: undefined, rows: [] };
      },
    });
    const malformed = await badPaging({
      competitionId: COMPETITION,
      season: SEASON,
    });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.reason).toBe("malformed_provider_response");
    }

    fetched = 0;
    const loader = createSeasonUniverseLoaderFromPagedTransport({
      fetchPage: async () => {
        fetched += 1;
        return { paging: { current: 1, total: 1 }, rows: [] };
      },
    });
    const badKey = await loader({
      competitionId: "not-canonical",
      season: SEASON,
    });
    expect(badKey.ok).toBe(false);
    if (!badKey.ok) expect(badKey.reason).toBe("invalid_vendor_league_id");
    expect(fetched).toBe(0);
  });

  it("quota errors propagate from paged client transport", async () => {
    const transport = createSeasonUniversePageTransportFromApiFootballClient({
      getFixturesByLeague: async () => {
        throw Object.assign(new Error("rate limited"), {
          code: "rate_limited",
          status: 429,
        });
      },
    });
    const loader = createSeasonUniverseLoaderFromPagedTransport(transport);
    await expect(
      loader({ competitionId: COMPETITION, season: SEASON }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("mapApiFootballFixtureItemToSeasonUniverseRow drops cross-key rows", () => {
    const key = { competitionId: COMPETITION, season: SEASON };
    expect(
      mapApiFootballFixtureItemToSeasonUniverseRow(
        fixtureItem({ leagueId: 140 }),
        key,
      ),
    ).toBeNull();
    const ok = mapApiFootballFixtureItemToSeasonUniverseRow(
      fixtureItem({ id: 99 }),
      key,
    );
    expect(ok?.fixtureId).toBe("99");
    expect(ok?.status).toBe("FT");
  });
});

describe("PE-3F pre-live dry run — exact dependency path", () => {
  let tickets: InMemoryPrematchDecisionTicketStore;
  let evidence: InMemoryFinalFixtureEvidenceStore;
  let evaluations: InMemoryPrematchDecisionEvaluationStore;
  let template: ApexMatchBundle;

  beforeEach(async () => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
    tickets = new InMemoryPrematchDecisionTicketStore();
    evidence = new InMemoryFinalFixtureEvidenceStore();
    evaluations = new InMemoryPrematchDecisionEvaluationStore();
    template = await templateBundle();
  });

  afterEach(() => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
  });

  it("default/scheduled mode → loader never called → BASE regime → zero season HTTP", async () => {
    const fetchPage = vi.fn(async () => ({
      paging: { current: 1, total: 1 },
      rows: [],
    }));
    const loader = createSeasonUniverseLoaderFromPagedTransport({ fetchPage });

    const target = lifecycleBundle(template, { fixtureId: "11001" });

    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: CONFIG,
      // peInputMode omitted → resolveLifecyclePeInputMode() → base_prior
      seasonUniverseLoader: loader,
      listFixturesByDate: async (date) =>
        date === "2033-05-31" ? [target] : [],
      attachOdds: async (b) => b,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });

    expect(report.peInputMode).toBe("base_prior");
    expect(report.inputRegime).toBe(REGIME_LIFECYCLE_BASE_PRIOR_V1);
    expect(report.c0ReconAttempts).toBe(0);
    expect(report.seasonUniverseAcquisitions).toBe(0);
    expect(report.seasonUniverseHttpRequests).toBe(0);
    expect(fetchPage).not.toHaveBeenCalled();
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);

    const summary = sanitizePrematchLifecycleReport(report);
    expect(summary.inputRegime).toBe(REGIME_LIFECYCLE_BASE_PRIOR_V1);
    expect(summary.peInputMode).toBe("base_prior");
    expect(summary.seasonUniverseHttpRequests).toBe(0);
  });

  it("manual C0 mode → paged production-style loader → pages walked → C0 ticket + provenance", async () => {
    const pages: number[] = [];
    const client = {
      getFixturesByLeague: async (
        _league: string | number,
        _season: string | number,
        page?: number,
      ) => {
        pages.push(page ?? -1);
        if (page === 1) {
          return {
            response: [
              fixtureItem({
                id: 5001,
                homeId: 33,
                awayId: 99,
                homeGoals: 4,
                awayGoals: 0,
              }),
              fixtureItem({
                id: 5002,
                homeId: 99,
                awayId: 34,
                homeGoals: 0,
                awayGoals: 3,
              }),
            ],
            paging: { current: 1, total: 2 },
          };
        }
        return {
          response: [
            fixtureItem({
              id: 5003,
              homeId: 33,
              awayId: 34,
              homeGoals: 2,
              awayGoals: 1,
            }),
          ],
          paging: { current: 2, total: 2 },
        };
      },
    };

    // Exact production wiring shape: client → page transport → paged loader.
    const loader = createSeasonUniverseLoaderFromPagedTransport(
      createSeasonUniversePageTransportFromApiFootballClient(client),
    );

    const target = lifecycleBundle(template, {
      fixtureId: "12001",
      homeTeamId: HOME,
      awayTeamId: AWAY,
    });

    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: { ...CONFIG, maxNewTicketsPerRun: 1 },
      peInputMode: "c0_recon",
      seasonUniverseLoader: loader,
      listFixturesByDate: async (date) =>
        date === "2033-05-31" ? [target] : [],
      attachOdds: async (b) => b,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });

    expect(pages).toEqual([1, 2]);
    expect(report.peInputMode).toBe("c0_recon");
    expect(report.inputRegime).toBe(REGIME_LIFECYCLE_C0_RECON_V1);
    expect(report.c0ReconAttempts).toBe(1);
    expect(report.c0ReconTicketsCreated).toBe(1);
    expect(report.newTicketsCreated).toBe(1);
    expect(report.seasonUniverseAcquisitions).toBe(1);
    expect(report.seasonUniverseHttpRequests).toBe(2);
    expect(report.seasonUniverseCacheHits).toBe(0);

    const ticket = await tickets.getByFixtureId("12001");
    expect(ticket).not.toBeNull();
    expect(ticket!.inputProvenance?.inputRegime).toBe(
      REGIME_LIFECYCLE_C0_RECON_V1,
    );
    expect(ticket!.inputProvenance?.modelVersion).toBe(
      "elo-poisson-hybrid-0.1.0",
    );
    expect(ticket!.inputProvenance?.home.elo).toBeTypeOf("number");
    expect(ticket!.inputProvenance?.away.elo).toBeTypeOf("number");
    expect(ticket!.inputProvenance?.evidenceAcquiredAtUtc).toBeTruthy();
    expect(ticket!.inputProvenance?.historicalCutoffUtc).toBeTruthy();
    expect(ticket!.inputProvenance?.contextLayers).toEqual({});

    const summary = sanitizePrematchLifecycleReport(report);
    expect(summary.inputRegime).toBe(REGIME_LIFECYCLE_C0_RECON_V1);
    expect(summary.c0ReconTicketsCreated).toBe(1);
    expect(summary.seasonUniverseAcquisitions).toBe(1);
    expect(summary.seasonUniverseHttpRequests).toBe(2);
  });

  it("manual C0 with two fixtures same league → one logical acquisition (cache)", async () => {
    let httpPages = 0;
    const client = {
      getFixturesByLeague: async (
        _l: string | number,
        _s: string | number,
        page?: number,
      ) => {
        httpPages += 1;
        return {
          response: [
            fixtureItem({
              id: 6001,
              homeId: 33,
              awayId: 50,
              homeGoals: 2,
              awayGoals: 0,
            }),
            fixtureItem({
              id: 6002,
              homeId: 51,
              awayId: 34,
              homeGoals: 0,
              awayGoals: 2,
            }),
          ],
          paging: { current: page ?? 1, total: 1 },
        };
      },
    };
    const loader = createSeasonUniverseLoaderFromPagedTransport(
      createSeasonUniversePageTransportFromApiFootballClient(client),
    );

    const a = lifecycleBundle(template, { fixtureId: "13001" });
    const b = lifecycleBundle(template, {
      fixtureId: "13002",
      kickoffAt: "2033-06-01T01:00:00.000Z",
    });

    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: { ...CONFIG, maxNewTicketsPerRun: 2 },
      peInputMode: "c0_recon",
      seasonUniverseLoader: loader,
      listFixturesByDate: async (date) =>
        date === "2033-05-31" ? [a, b] : [],
      attachOdds: async (bundle) => bundle,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });

    expect(httpPages).toBe(1);
    expect(report.seasonUniverseAcquisitions).toBe(1);
    expect(report.seasonUniverseHttpRequests).toBe(1);
    expect(report.seasonUniverseCacheHits).toBe(1);
    expect(report.c0ReconTicketsCreated).toBe(2);
  });
});
