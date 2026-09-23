/**
 * PE-3H — Provider paging compatibility remediation (offline mocks only).
 * Zero live API-Football / Supabase / production lifecycle writes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import type {
  ApiFootballFixtureItem,
  ApiFootballFixturesResponse,
} from "@/lib/data-platform/providers/api-football/types";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  InMemoryFinalFixtureEvidenceStore,
  resetFinalFixtureEvidenceStoreForTests,
} from "@/lib/final-evidence/store";
import {
  PrematchUniverseConflictError,
  resolvePrematchStrengthFromUniverse,
} from "@/lib/match-center/prematch-strength";
import {
  InMemoryPrematchDecisionTicketStore,
  resetPrematchDecisionTicketStoreForTests,
} from "@/lib/prematch-decision/store";
import { REGIME_LIFECYCLE_C0_RECON_V1 } from "@/lib/prematch-decision/input-provenance";
import type { PrematchLifecycleConfig } from "@/lib/prematch-lifecycle/config";
import { runPrematchLifecycle } from "@/lib/prematch-lifecycle/coordinator";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import {
  InMemoryPrematchDecisionEvaluationStore,
  resetPrematchDecisionEvaluationStoreForTests,
} from "@/lib/prematch-evaluation/store";
import {
  SEASON_UNIVERSE_MAX_PAGES,
  createSeasonUniverseLoaderFromApiFootballUnpagedClient,
  createSeasonUniverseLoaderFromPagedTransport,
  createSeasonUniversePageTransportFromApiFootballClient,
  evaluateApiFootballUnpagedFixturesCompleteness,
  fetchCompleteSeasonUniversePages,
  isApiFootballSeasonListErrorsEmpty,
  mapApiFootballFixtureItemToSeasonUniverseRow,
} from "@/lib/prematch-lifecycle/season-universe";
import {
  createProductionSeasonUniverseLoader,
} from "@/lib/prematch-lifecycle/season-universe/api-football-paged-transport";
import * as repositories from "@/lib/repositories";

const LEAGUE_EXT = "253";
const COMPETITION = `apex:api-football:league:${LEAGUE_EXT}`;
const SEASON = "2026";
const BEFORE = "2026-05-01T12:00:00.000Z";
const KICKOFF = "2026-09-24T01:30:00.000Z";
const T60 = "2026-09-23T23:30:00.000Z";
const HOME = "apex:api-football:team:1595";
const AWAY = "apex:api-football:team:1606";

const CONFIG: PrematchLifecycleConfig = {
  leagueIds: [LEAGUE_EXT],
  maxNewTicketsPerRun: 1,
  leagueAllowlistInvalid: false,
};

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
        short: (overrides.status ??
          "FT") as ApiFootballFixtureItem["fixture"]["status"]["short"],
      },
    },
    league: {
      id: overrides.leagueId ?? Number(LEAGUE_EXT),
      name: "Major League Soccer",
      season: overrides.season ?? Number(SEASON),
    },
    teams: {
      home: {
        id: overrides.homeId ?? 1595,
        name: "Seattle Sounders",
      },
      away: {
        id: overrides.awayId ?? 1606,
        name: "Real Salt Lake",
      },
    },
    goals: {
      home: overrides.homeGoals ?? 1,
      away: overrides.awayGoals ?? 0,
    },
    score: {
      fulltime: {
        home: overrides.homeGoals ?? 1,
        away: overrides.awayGoals ?? 0,
      },
    },
  };
}

function unpagedOk(
  items: ApiFootballFixtureItem[],
): ApiFootballFixturesResponse {
  return {
    get: "fixtures",
    errors: [],
    results: items.length,
    paging: { current: 1, total: 1 },
    response: items,
  };
}

async function templateBundle(): Promise<ApexMatchBundle> {
  const bundle = await createMockDataProvider().getMatch({
    matchId: DEMO_MATCH_EXTERNAL_ID,
  });
  if (!bundle) throw new Error("missing demo bundle");
  return bundle;
}

function lifecycleBundle(
  template: ApexMatchBundle,
  overrides: {
    fixtureId?: string;
    kickoffAt?: string;
    homeTeamId?: string;
    awayTeamId?: string;
  } = {},
): ApexMatchBundle {
  const fixtureId = overrides.fixtureId ?? "1490209";
  return {
    ...template,
    odds: template.odds,
    homeTeam: {
      ...template.homeTeam,
      id: overrides.homeTeamId ?? HOME,
      name: "Seattle Sounders",
    },
    awayTeam: {
      ...template.awayTeam,
      id: overrides.awayTeamId ?? AWAY,
      name: "Real Salt Lake",
    },
    league: template.league
      ? {
          ...template.league,
          id: COMPETITION,
          season: SEASON,
          name: "Major League Soccer",
          externalRefs: [
            { provider: "api-football", externalId: LEAGUE_EXT },
          ],
        }
      : null,
    match: {
      ...template.match,
      id: `apex:api-football:fixture:${fixtureId}`,
      kickoffAt: overrides.kickoffAt ?? KICKOFF,
      status: "scheduled",
      vendorStatusShort: "NS",
      externalRefs: [
        { provider: "api-football", externalId: fixtureId },
      ],
    },
  };
}

describe("PE-3H unpaged completeness validators", () => {
  it("A: errors.page + empty response + paging 1/1 is NOT complete", () => {
    const payload: ApiFootballFixturesResponse = {
      errors: { page: "The Page field do not exist." },
      results: 0,
      paging: { current: 1, total: 1 },
      response: [],
    };
    expect(isApiFootballSeasonListErrorsEmpty(payload.errors)).toBe(false);
    expect(evaluateApiFootballUnpagedFixturesCompleteness(payload)).toEqual({
      ok: false,
      reason: "malformed_provider_response",
    });
  });

  it("B: valid unpaged envelope is complete", () => {
    const items = [
      fixtureItem({ id: 1 }),
      fixtureItem({ id: 2, homeId: 1606, awayId: 1595 }),
    ];
    const payload = unpagedOk(items);
    expect(isApiFootballSeasonListErrorsEmpty(payload.errors)).toBe(true);
    expect(evaluateApiFootballUnpagedFixturesCompleteness(payload)).toEqual({
      ok: true,
    });
  });

  it("C: results !== response.length fails closed", () => {
    const items = [fixtureItem({ id: 1 })];
    const payload: ApiFootballFixturesResponse = {
      errors: [],
      results: 2,
      paging: { current: 1, total: 1 },
      response: items,
    };
    expect(evaluateApiFootballUnpagedFixturesCompleteness(payload)).toEqual({
      ok: false,
      reason: "incomplete_season_list",
    });
  });

  it("D: paging.total !== 1 fails closed", () => {
    const items = [fixtureItem({ id: 1 })];
    const payload: ApiFootballFixturesResponse = {
      errors: [],
      results: 1,
      paging: { current: 1, total: 2 },
      response: items,
    };
    expect(evaluateApiFootballUnpagedFixturesCompleteness(payload)).toEqual({
      ok: false,
      reason: "incomplete_season_list",
    });
  });
});

describe("PE-3H production unpaged loader (API-Football transport)", () => {
  it("A: proven paged-reject envelope never becomes ok empty universe", async () => {
    const calls: Array<{ page?: number }> = [];
    const loader = createSeasonUniverseLoaderFromApiFootballUnpagedClient({
      getFixturesByLeague: async (_l, _s, page?) => {
        calls.push({ page });
        // Production path must not send page — but if a client returned the
        // proven reject shape, still fail closed.
        return {
          errors: { page: "The Page field do not exist." },
          results: 0,
          paging: { current: 1, total: 1 },
          response: [],
        };
      },
    });
    const acquired = await loader({
      competitionId: COMPETITION,
      season: SEASON,
    });
    expect(calls).toEqual([{ page: undefined }]);
    expect(acquired.ok).toBe(false);
    if (!acquired.ok) {
      expect(acquired.reason).toBe("malformed_provider_response");
      expect(acquired.httpRequests).toBe(1);
    }
  });

  it("B: valid unpaged season is accepted with httpRequests=1", async () => {
    const priors = [
      fixtureItem({ id: 1490001, homeId: 1595, awayId: 1615, homeGoals: 2, awayGoals: 0 }),
      fixtureItem({ id: 1490002, homeId: 1606, awayId: 1616, homeGoals: 1, awayGoals: 1 }),
      fixtureItem({
        id: 1490209,
        date: KICKOFF,
        status: "NS",
        homeGoals: null,
        awayGoals: null,
      }),
    ];
    let pageArg: number | undefined | "absent" = "absent";
    const loader = createSeasonUniverseLoaderFromApiFootballUnpagedClient({
      getFixturesByLeague: async (_l, _s, page?) => {
        pageArg = page;
        return unpagedOk(priors);
      },
    });
    const acquired = await loader({
      competitionId: COMPETITION,
      season: SEASON,
    });
    expect(pageArg).toBeUndefined();
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(acquired.httpRequests).toBe(1);
    expect(acquired.fixtures.length).toBe(3);
  });

  it("C: results mismatch fails closed", async () => {
    const loader = createSeasonUniverseLoaderFromApiFootballUnpagedClient({
      getFixturesByLeague: async () => ({
        errors: [],
        results: 99,
        paging: { current: 1, total: 1 },
        response: [fixtureItem({ id: 1 })],
      }),
    });
    const acquired = await loader({
      competitionId: COMPETITION,
      season: SEASON,
    });
    expect(acquired.ok).toBe(false);
    if (!acquired.ok) expect(acquired.reason).toBe("incomplete_season_list");
  });

  it("D: paging.total !== 1 fails closed", async () => {
    const loader = createSeasonUniverseLoaderFromApiFootballUnpagedClient({
      getFixturesByLeague: async () => ({
        errors: [],
        results: 1,
        paging: { current: 1, total: 3 },
        response: [fixtureItem({ id: 1 })],
      }),
    });
    const acquired = await loader({
      competitionId: COMPETITION,
      season: SEASON,
    });
    expect(acquired.ok).toBe(false);
    if (!acquired.ok) expect(acquired.reason).toBe("incomplete_season_list");
  });

  it("E: quota errors propagate (not malformed)", async () => {
    const loader = createSeasonUniverseLoaderFromApiFootballUnpagedClient({
      getFixturesByLeague: async () => {
        throw Object.assign(new Error("rate limited"), {
          code: "rate_limited",
          status: 429,
        });
      },
    });
    await expect(
      loader({ competitionId: COMPETITION, season: SEASON }),
    ).rejects.toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("architectural paged transport: errors.page fails closed (no false empty ok)", async () => {
    const transport = createSeasonUniversePageTransportFromApiFootballClient({
      getFixturesByLeague: async (_l, _s, page) => {
        expect(page).toBe(1);
        return {
          errors: { page: "The Page field do not exist." },
          results: 0,
          paging: { current: 1, total: 1 },
          response: [],
        };
      },
    });
    const complete = await fetchCompleteSeasonUniversePages({
      key: { competitionId: COMPETITION, season: SEASON },
      transport,
    });
    expect(complete.ok).toBe(false);
    if (!complete.ok) {
      expect(complete.reason).toBe("malformed_provider_response");
    }
    expect(SEASON_UNIVERSE_MAX_PAGES).toBe(20);
  });
});

describe("PE-3H production createProductionSeasonUniverseLoader path", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wires createProductDataProvider → ApiFootballDataProvider.http → unpaged loader", async () => {
    const pagesSeen: Array<number | undefined> = [];
    const mockClient = {
      getFixturesByLeague: async (
        _l: string | number,
        _s: string | number,
        page?: number,
      ) => {
        pagesSeen.push(page);
        return unpagedOk([
          fixtureItem({ id: 1, homeId: 1595, awayId: 1615 }),
          fixtureItem({ id: 2, homeId: 1606, awayId: 1616 }),
        ]);
      },
    };
    const provider = new ApiFootballDataProvider({
      client: mockClient as never,
      useCache: false,
      enrichMatch: false,
    });
    vi.spyOn(repositories, "createProductDataProvider").mockReturnValue(
      provider,
    );

    const loader = createProductionSeasonUniverseLoader({});
    const acquired = await loader({
      competitionId: COMPETITION,
      season: SEASON,
    });

    expect(pagesSeen).toEqual([undefined]);
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(acquired.httpRequests).toBe(1);
    expect(acquired.fixtures).toHaveLength(2);
  });

  it("G: C0 default activation remains OFF", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });

  it("H: smoke script still uses production loader; no activation flip", () => {
    const script = readFileSync(
      resolve(process.cwd(), "scripts/run-prematch-lifecycle-c0-smoke.ts"),
      "utf8",
    );
    expect(script).toContain("createProductionSeasonUniverseLoader");
    expect(script).not.toMatch(/PE3C_C0_RECON_ACTIVATION\s*=\s*true/);
    const transportSrc = readFileSync(
      resolve(
        process.cwd(),
        "lib/prematch-lifecycle/season-universe/api-football-paged-transport.ts",
      ),
      "utf8",
    );
    expect(transportSrc).toContain(
      "createSeasonUniverseLoaderFromApiFootballUnpagedClient",
    );
    expect(transportSrc).toMatch(
      /createProductionSeasonUniverseLoader[\s\S]*createSeasonUniverseLoaderFromApiFootballUnpagedClient/,
    );
  });
});

describe("PE-3H coordinator + unpaged production transport (offline)", () => {
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

  it("smoke→coordinator→unpaged loader creates catalogue C0 ticket; httpRequests=1", async () => {
    const callPages: Array<number | undefined> = [];
    const loader = createSeasonUniverseLoaderFromApiFootballUnpagedClient({
      getFixturesByLeague: async (_l, _s, page?) => {
        callPages.push(page);
        return unpagedOk([
          fixtureItem({
            id: 1490001,
            homeId: 1595,
            awayId: 1615,
            homeGoals: 3,
            awayGoals: 0,
          }),
          fixtureItem({
            id: 1490002,
            homeId: 1617,
            awayId: 1606,
            homeGoals: 0,
            awayGoals: 2,
          }),
          fixtureItem({
            id: 1490209,
            date: KICKOFF,
            status: "NS",
            homeGoals: null,
            awayGoals: null,
          }),
        ]);
      },
    });

    const target = lifecycleBundle(template, { fixtureId: "1490209" });
    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: { ...CONFIG, maxNewTicketsPerRun: 1 },
      peInputMode: "c0_recon",
      seasonUniverseLoader: loader,
      listFixturesByDate: async (date) =>
        date === "2026-09-23" || date === "2026-09-24" ? [target] : [],
      attachOdds: async (b) => b,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });

    expect(callPages).toEqual([undefined]);
    expect(report.c0ReconTicketsCreated).toBe(1);
    expect(report.seasonUniverseHttpRequests).toBe(1);
    expect(report.seasonUniverseAcquisitions).toBe(1);
    expect(report.inputRegime).toBe(REGIME_LIFECYCLE_C0_RECON_V1);

    const ticket = await tickets.getByFixtureId("1490209");
    expect(ticket).not.toBeNull();
    expect(ticket!.inputProvenance?.home.source).toBe("catalogue");
    expect(ticket!.inputProvenance?.away.source).toBe("catalogue");
    expect(ticket!.inputProvenance?.home.played).toBeGreaterThanOrEqual(1);
    expect(ticket!.inputProvenance?.away.played).toBeGreaterThanOrEqual(1);
  });

  it("false-complete paged reject via production unpaged loader → skip, no ticket", async () => {
    const loader = createSeasonUniverseLoaderFromApiFootballUnpagedClient({
      getFixturesByLeague: async () => ({
        errors: { page: "The Page field do not exist." },
        results: 0,
        paging: { current: 1, total: 1 },
        response: [],
      }),
    });
    const target = lifecycleBundle(template, { fixtureId: "1490209" });
    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: { ...CONFIG, maxNewTicketsPerRun: 1 },
      peInputMode: "c0_recon",
      seasonUniverseLoader: loader,
      listFixturesByDate: async (date) =>
        date === "2026-09-23" || date === "2026-09-24" ? [target] : [],
      attachOdds: async (b) => b,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    expect(report.c0ReconSkipped).toBe(1);
    expect(report.c0ReconTicketsCreated).toBe(0);
    expect(report.newTicketsCreated).toBe(0);
    expect(await tickets.getByFixtureId("1490209")).toBeNull();
  });
});

describe("PE-3H F: duplicate conflict still fail-closed", () => {
  it("conflicting duplicate fixtureIds throw PrematchUniverseConflictError", () => {
    const row = mapApiFootballFixtureItemToSeasonUniverseRow(
      fixtureItem({ id: 42, homeGoals: 1, awayGoals: 0 }),
      { competitionId: COMPETITION, season: SEASON },
    );
    expect(row).not.toBeNull();
    const conflict = {
      ...row!,
      homeGoals: 9,
      awayGoals: 9,
    };
    expect(() =>
      resolvePrematchStrengthFromUniverse({
        target: {
          fixtureId: "1490209",
          kickoffUtc: KICKOFF,
          homeTeamId: HOME,
          awayTeamId: AWAY,
          competitionId: COMPETITION,
          season: SEASON,
        },
        universe: [row!, conflict],
        evidenceAcquiredAtUtc: T60,
      }),
    ).toThrow(PrematchUniverseConflictError);
  });

  it("paged architectural path still walks pages under SEASON_UNIVERSE_MAX_PAGES", async () => {
    const pages: number[] = [];
    const loader = createSeasonUniverseLoaderFromPagedTransport(
      createSeasonUniversePageTransportFromApiFootballClient({
        getFixturesByLeague: async (_l, _s, page?) => {
          pages.push(page!);
          if (page === 1) {
            return {
              errors: [],
              results: 1,
              response: [fixtureItem({ id: 1 })],
              paging: { current: 1, total: 2 },
            };
          }
          return {
            errors: [],
            results: 1,
            response: [fixtureItem({ id: 2, homeId: 1606, awayId: 1595 })],
            paging: { current: 2, total: 2 },
          };
        },
      }),
    );
    const acquired = await loader({
      competitionId: COMPETITION,
      season: SEASON,
    });
    expect(pages).toEqual([1, 2]);
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(acquired.httpRequests).toBe(2);
    expect(acquired.fixtures).toHaveLength(2);
  });
});
