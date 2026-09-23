/**
 * PE-3G — Coordinator lazy production season-universe loader branch.
 * Mocks transport factory. No live API-Football calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  InMemoryFinalFixtureEvidenceStore,
  resetFinalFixtureEvidenceStoreForTests,
} from "@/lib/final-evidence/store";
import {
  InMemoryPrematchDecisionTicketStore,
  resetPrematchDecisionTicketStoreForTests,
} from "@/lib/prematch-decision/store";
import { REGIME_LIFECYCLE_C0_RECON_V1 } from "@/lib/prematch-decision/input-provenance";
import type { PrematchLifecycleConfig } from "@/lib/prematch-lifecycle/config";
import {
  InMemoryPrematchDecisionEvaluationStore,
  resetPrematchDecisionEvaluationStoreForTests,
} from "@/lib/prematch-evaluation/store";
import type { SeasonUniverseLoader } from "@/lib/prematch-lifecycle/season-universe";

const createProductionSeasonUniverseLoader = vi.hoisted(() =>
  vi.fn(
    (
      _env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
    ): SeasonUniverseLoader => {
      throw new Error("lazy loader mock not configured");
    },
  ),
);

vi.mock(
  "@/lib/prematch-lifecycle/season-universe/api-football-paged-transport",
  () => ({
    createProductionSeasonUniverseLoader: (
      env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
    ): SeasonUniverseLoader => createProductionSeasonUniverseLoader(env),
  }),
);

import { runPrematchLifecycle } from "@/lib/prematch-lifecycle/coordinator";

const LEAGUE_EXT = "39";
const COMPETITION = `apex:api-football:league:${LEAGUE_EXT}`;
const SEASON = "2024";
const KICKOFF = "2033-06-01T00:30:00.000Z";
const T60 = "2033-05-31T23:30:00.000Z";
const BEFORE = "2033-05-10T15:00:00.000Z";
const HOME = "apex:api-football:team:33";
const AWAY = "apex:api-football:team:34";

const CONFIG: PrematchLifecycleConfig = {
  leagueIds: [LEAGUE_EXT],
  maxNewTicketsPerRun: 1,
  leagueAllowlistInvalid: false,
};

function lifecycleBundle(
  template: ApexMatchBundle,
  fixtureId: string,
): ApexMatchBundle {
  return {
    ...template,
    odds: template.odds,
    homeTeam: { ...template.homeTeam, id: HOME, name: "Home" },
    awayTeam: { ...template.awayTeam, id: AWAY, name: "Away" },
    league: template.league
      ? {
          ...template.league,
          id: COMPETITION,
          season: SEASON,
          externalRefs: [
            { provider: "api-football", externalId: LEAGUE_EXT },
          ],
        }
      : null,
    match: {
      ...template.match,
      id: `apex:api-football:match:${fixtureId}`,
      kickoffAt: KICKOFF,
      status: "scheduled",
      vendorStatusShort: "NS",
      externalRefs: [
        { provider: "api-football", externalId: fixtureId },
      ],
    },
  };
}

describe("PE-3G coordinator lazy production loader", () => {
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
    template = await createMockDataProvider().getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });
    createProductionSeasonUniverseLoader.mockReset();
  });

  afterEach(() => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
    createProductionSeasonUniverseLoader.mockReset();
  });

  it("omitted seasonUniverseLoader → lazily constructs production loader (mocked)", async () => {
    const loaderCalls: string[] = [];
    const mockLoader: SeasonUniverseLoader = async (key) => {
      loaderCalls.push(`${key.competitionId}::${key.season}`);
      return {
        ok: true,
        key,
        fixtures: [
          {
            fixtureId: "hist-1",
            kickoffUtc: BEFORE,
            homeTeamId: HOME,
            awayTeamId: "apex:api-football:team:99",
            competitionId: COMPETITION,
            season: SEASON,
            status: "FT",
            homeGoals: 2,
            awayGoals: 0,
          },
          {
            fixtureId: "hist-2",
            kickoffUtc: BEFORE,
            homeTeamId: "apex:api-football:team:98",
            awayTeamId: AWAY,
            competitionId: COMPETITION,
            season: SEASON,
            status: "FT",
            homeGoals: 0,
            awayGoals: 2,
          },
        ],
        httpRequests: 2,
      };
    };
    createProductionSeasonUniverseLoader.mockImplementation(() => mockLoader);

    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: CONFIG,
      peInputMode: "c0_recon",
      // seasonUniverseLoader intentionally omitted
      listFixturesByDate: async (date) =>
        date === "2033-05-31"
          ? [lifecycleBundle(template, "14001")]
          : [],
      attachOdds: async (b) => b,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });

    expect(createProductionSeasonUniverseLoader).toHaveBeenCalledTimes(1);
    expect(loaderCalls).toEqual([`${COMPETITION}::${SEASON}`]);
    expect(report.inputRegime).toBe(REGIME_LIFECYCLE_C0_RECON_V1);
    expect(report.c0ReconTicketsCreated).toBe(1);
    expect(report.seasonUniverseAcquisitions).toBe(1);
    expect(report.seasonUniverseHttpRequests).toBe(2);
    expect(await tickets.getByFixtureId("14001")).not.toBeNull();
  });

  it("base_prior mode never constructs production loader", async () => {
    createProductionSeasonUniverseLoader.mockImplementation(() => {
      throw new Error("must not construct");
    });

    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: CONFIG,
      // peInputMode omitted → base_prior
      listFixturesByDate: async (date) =>
        date === "2033-05-31"
          ? [lifecycleBundle(template, "14002")]
          : [],
      attachOdds: async (b) => b,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });

    expect(createProductionSeasonUniverseLoader).not.toHaveBeenCalled();
    expect(report.peInputMode).toBe("base_prior");
    expect(report.c0ReconAttempts).toBe(0);
    expect(report.seasonUniverseHttpRequests).toBe(0);
  });

  it("quota from lazily constructed loader aborts (fail closed)", async () => {
    createProductionSeasonUniverseLoader.mockImplementation(
      () => async () => {
        throw Object.assign(new Error("rate limited"), {
          code: "rate_limited",
          status: 429,
        });
      },
    );

    const report = await runPrematchLifecycle({
      nowUtc: T60,
      config: CONFIG,
      peInputMode: "c0_recon",
      listFixturesByDate: async (date) =>
        date === "2033-05-31"
          ? [lifecycleBundle(template, "14003")]
          : [],
      attachOdds: async (b) => b,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });

    expect(createProductionSeasonUniverseLoader).toHaveBeenCalledTimes(1);
    expect(report.fatalErrorCount).toBeGreaterThan(0);
    expect(report.newTicketsCreated).toBe(0);
    expect(await tickets.getByFixtureId("14003")).toBeNull();
  });
});
