/**
 * PE-3E — C0 activation blocker remediation (offline mocks only).
 * Does not activate C0. Does not call live API-Football / Supabase.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  InMemoryFinalFixtureEvidenceStore,
  resetFinalFixtureEvidenceStoreForTests,
} from "@/lib/final-evidence/store";
import {
  digestAcceptedPrematchEvidence,
  PrematchUniverseConflictError,
  dedupeUniverseByFixtureId,
  resolvePrematchStrengthFromUniverse,
  type PrematchStrengthUniverseFixture,
} from "@/lib/match-center/prematch-strength";
import {
  InMemoryPrematchDecisionTicketStore,
  resetPrematchDecisionTicketStoreForTests,
} from "@/lib/prematch-decision/store";
import {
  assertCohortFromTicketResolutions,
  isPrematchInputProvenance,
  provenanceFromC0Strength,
  REGIME_LIFECYCLE_BASE_PRIOR_V1,
  REGIME_LIFECYCLE_C0_RECON_V1,
  resolveTicketInputRegime,
  resolveTicketInputRegimeResolution,
} from "@/lib/prematch-decision/input-provenance";
import type { PrematchLifecycleConfig } from "@/lib/prematch-lifecycle/config";
import { runPrematchLifecycle } from "@/lib/prematch-lifecycle/coordinator";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { sanitizePrematchLifecycleReport } from "@/lib/prematch-lifecycle/runner";
import { emptyPrematchLifecycleReport } from "@/lib/prematch-lifecycle/report";
import {
  createRunScopedSeasonUniverseCache,
  createSeasonUniverseLoaderFromCompletePages,
  createSeasonUniverseLoaderFromPagedTransport,
  createSeasonUniverseLoaderFromProviderFetch,
  fetchCompleteSeasonUniversePages,
  SEASON_UNIVERSE_MAX_PAGES,
  vendorLeagueIdFromCompetitionId,
  type SeasonUniverseKey,
  type SeasonUniverseProviderRow,
} from "@/lib/prematch-lifecycle/season-universe";
import {
  InMemoryPrematchDecisionEvaluationStore,
  resetPrematchDecisionEvaluationStoreForTests,
} from "@/lib/prematch-evaluation/store";
import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { LIVE_PROTOCOL_FINGERPRINT } from "@/lib/debug/calibration/prospective/protocol/protocol-fingerprint";

const LEAGUE_EXT = "901";
const COMPETITION = `apex:api-football:league:${LEAGUE_EXT}`;
const SEASON = "2033";
const KEY: SeasonUniverseKey = {
  competitionId: COMPETITION,
  season: SEASON,
};

const CONFIG: PrematchLifecycleConfig = {
  leagueIds: [LEAGUE_EXT],
  maxNewTicketsPerRun: 3,
  leagueAllowlistInvalid: false,
};

function row(
  overrides: Partial<SeasonUniverseProviderRow> & { fixtureId: string },
): SeasonUniverseProviderRow {
  return {
    kickoffUtc: "2033-05-01T12:00:00.000Z",
    homeTeamId: "h1",
    awayTeamId: "a1",
    competitionId: COMPETITION,
    season: SEASON,
    status: "FT",
    homeGoals: 1,
    awayGoals: 0,
    ...overrides,
  };
}

function universeRow(
  overrides: Partial<PrematchStrengthUniverseFixture> & { fixtureId: string },
): PrematchStrengthUniverseFixture {
  return {
    kickoffUtc: "2033-05-01T12:00:00.000Z",
    homeTeamId: "h1",
    awayTeamId: "a1",
    competitionId: COMPETITION,
    season: SEASON,
    status: "FT",
    homeGoals: 1,
    awayGoals: 0,
    ...overrides,
  };
}

describe("PE-3E season universe completeness / pagination", () => {
  it("paging 1/1 → accepted complete", async () => {
    const result = await fetchCompleteSeasonUniversePages({
      key: KEY,
      transport: {
        fetchPage: async (_k, page) => ({
          paging: { current: page, total: 1 },
          rows: [row({ fixtureId: "1" })],
        }),
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.httpRequests).toBe(1);
      expect(result.pagesFetched).toBe(1);
      expect(result.rows).toHaveLength(1);
    }
  });

  it("paging 1/2 + page 2/2 → merged complete", async () => {
    const pages: Record<number, SeasonUniverseProviderRow[]> = {
      1: [row({ fixtureId: "1" })],
      2: [row({ fixtureId: "2", kickoffUtc: "2033-05-02T12:00:00.000Z" })],
    };
    const result = await fetchCompleteSeasonUniversePages({
      key: KEY,
      transport: {
        fetchPage: async (_k, page) => ({
          paging: { current: page, total: 2 },
          rows: pages[page] ?? [],
        }),
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.httpRequests).toBe(2);
      expect(result.rows.map((r) => r.fixtureId)).toEqual(["1", "2"]);
    }
  });

  it("duplicate fixture across pages → deduped when identical", () => {
    const dup = universeRow({ fixtureId: "dup" });
    const deduped = dedupeUniverseByFixtureId([dup, { ...dup }]);
    expect(deduped.ok).toBe(true);
    if (deduped.ok) expect(deduped.fixtures).toHaveLength(1);
  });

  it("missing page / mismatched paging → fail closed", async () => {
    const result = await fetchCompleteSeasonUniversePages({
      key: KEY,
      transport: {
        fetchPage: async (_k, page) => ({
          paging: { current: page, total: page === 1 ? 2 : 1 },
          rows: [row({ fixtureId: String(page) })],
        }),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("incomplete_season_list");
  });

  it("malformed paging → fail closed", async () => {
    const result = await fetchCompleteSeasonUniversePages({
      key: KEY,
      transport: {
        fetchPage: async () => ({
          paging: null,
          rows: [row({ fixtureId: "1" })],
        }),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed_provider_response");
  });

  it("paging.total above hard bound → fail closed", async () => {
    const result = await fetchCompleteSeasonUniversePages({
      key: KEY,
      maxPages: 2,
      transport: {
        fetchPage: async () => ({
          paging: { current: 1, total: 3 },
          rows: [row({ fixtureId: "1" })],
        }),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("pagination_bound_exceeded");
    expect(SEASON_UNIVERSE_MAX_PAGES).toBe(20);
  });

  it("page request failure → fail closed via loader", async () => {
    const loader = createSeasonUniverseLoaderFromCompletePages({
      fetchPage: async (_k, page) => {
        if (page === 2) throw new Error("network boom");
        return {
          paging: { current: 1, total: 2 },
          rows: [row({ fixtureId: "1" })],
        };
      },
    });
    const acquired = await loader(KEY);
    expect(acquired.ok).toBe(false);
    if (!acquired.ok) expect(acquired.reason).toBe("provider_failure");
  });

  it("same league+season × 3 targets → one logical acquisition; HTTP = pages", async () => {
    let pageFetches = 0;
    const loader = createSeasonUniverseLoaderFromCompletePages({
      fetchPage: async (_k, page) => {
        pageFetches += 1;
        return {
          paging: { current: page, total: 2 },
          rows: [row({ fixtureId: `p${page}` })],
        };
      },
    });
    const cache = createRunScopedSeasonUniverseCache();
    await cache.getOrLoad(KEY, loader);
    await cache.getOrLoad(KEY, loader);
    await cache.getOrLoad(KEY, loader);
    expect(cache.acquisitions).toBe(1);
    expect(cache.httpRequests).toBe(2);
    expect(pageFetches).toBe(2);
  });

  it("no team-statistics endpoint used in complete-fetch module", () => {
    const src = readFileSync(
      "lib/prematch-lifecycle/season-universe/complete-fetch.ts",
      "utf8",
    );
    expect(src).not.toMatch(/teams\/statistics|getTeamStatistics/);
  });
});

describe("PE-3E quota propagation through production-intended factory", () => {
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
  });

  afterEach(() => {
    resetPrematchDecisionTicketStoreForTests();
    resetFinalFixtureEvidenceStoreForTests();
    resetPrematchDecisionEvaluationStoreForTests();
  });

  function lifecycleBundle(fixtureId: string): ApexMatchBundle {
    return {
      ...template,
      homeTeam: { ...template.homeTeam, id: "team-h", name: "Home" },
      awayTeam: { ...template.awayTeam, id: "team-a", name: "Away" },
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
        id: `apex:api-football:fixture:${fixtureId}`,
        kickoffAt: "2033-05-31T18:00:00.000Z",
        status: "scheduled",
        vendorStatusShort: "NS",
        externalRefs: [{ provider: "api-football", externalId: fixtureId }],
      },
      odds: template.odds,
    };
  }

  it("429/quota through createSeasonUniverseLoaderFromProviderFetch aborts run", async () => {
    const loader = createSeasonUniverseLoaderFromProviderFetch(async () => {
      throw Object.assign(new Error("rate limited"), {
        code: "rate_limited",
        status: 429,
      });
    });

    const report = await runPrematchLifecycle({
      nowUtc: "2033-05-31T16:00:00.000Z",
      config: CONFIG,
      peInputMode: "c0_recon",
      seasonUniverseLoader: loader,
      listFixturesByDate: async (date) =>
        date === "2033-05-31" ? [lifecycleBundle("9801")] : [],
      attachOdds: async (b) => b,
      fetchFixturesByIds: async () => [],
      ticketStore: tickets,
      evidenceStore: evidence,
      evaluationStore: evaluations,
    });
    expect(report.fatalErrorCount).toBeGreaterThan(0);
    expect(report.newTicketsCreated).toBe(0);
  });

  it("ordinary network error through factory → provider_failure (not quota)", async () => {
    const loader = createSeasonUniverseLoaderFromProviderFetch(async () => {
      throw new Error("ECONNRESET");
    });
    const acquired = await loader(KEY);
    expect(acquired.ok).toBe(false);
    if (!acquired.ok) expect(acquired.reason).toBe("provider_failure");
  });

  it("malformed payload through factory → malformed_provider_response", async () => {
    const loader = createSeasonUniverseLoaderFromProviderFetch(async () => {
      return [{ bad: true }] as unknown as SeasonUniverseProviderRow[];
    });
    const acquired = await loader(KEY);
    expect(acquired.ok).toBe(false);
    if (!acquired.ok) expect(acquired.reason).toBe("malformed_provider_response");
  });

  it("quota through paged complete loader aborts (propagates)", async () => {
    const loader = createSeasonUniverseLoaderFromCompletePages({
      fetchPage: async () => {
        throw Object.assign(new Error("rate limited"), {
          code: "rate_limited",
          status: 429,
        });
      },
    });
    await expect(loader(KEY)).rejects.toMatchObject({ status: 429 });
  });
});

describe("PE-3E provider id mapping", () => {
  it("maps apex:api-football:league:N → N", () => {
    expect(vendorLeagueIdFromCompetitionId("apex:api-football:league:39")).toBe(
      "39",
    );
    expect(
      vendorLeagueIdFromCompetitionId("apex:api-football:league:901"),
    ).toBe("901");
  });

  it("rejects non-canonical / missing vendor ids (fail closed)", async () => {
    expect(vendorLeagueIdFromCompetitionId("39")).toBeNull();
    expect(vendorLeagueIdFromCompetitionId("apex:other:league:39")).toBeNull();
    expect(vendorLeagueIdFromCompetitionId("")).toBeNull();

    let fetched = 0;
    const loader = createSeasonUniverseLoaderFromPagedTransport({
      fetchPage: async () => {
        fetched += 1;
        return { paging: { current: 1, total: 1 }, rows: [] };
      },
    });
    const bad = await loader({
      competitionId: "not-a-valid-id",
      season: "2024",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("invalid_vendor_league_id");
    expect(fetched).toBe(0);
  });
});

describe("PE-3E regime fail-closed + provenance validation", () => {
  it("absent → legacy BASE; valid C0 → C0; malformed → invalid; unknown → unknown", () => {
    expect(resolveTicketInputRegimeResolution({}).kind).toBe("legacy_absent");
    expect(resolveTicketInputRegime({})).toBe(REGIME_LIFECYCLE_BASE_PRIOR_V1);

    const strength = resolvePrematchStrengthFromUniverse({
      target: {
        fixtureId: "t1",
        kickoffUtc: "2033-06-01T12:00:00.000Z",
        homeTeamId: "h",
        awayTeamId: "a",
        competitionId: COMPETITION,
        season: SEASON,
      },
      universe: [],
      evidenceAcquiredAtUtc: "2033-05-31T12:00:00.000Z",
    });
    const prov = provenanceFromC0Strength({
      strength,
      modelVersion: "elo-poisson-hybrid-0.1.0",
    });
    expect(isPrematchInputProvenance(prov)).toBe(true);
    expect(prov.evidenceAcquiredAtUtc).toBe("2033-05-31T12:00:00.000Z");
    expect(prov.evidenceAsOfUtc).toBe(prov.evidenceAcquiredAtUtc);
    expect(
      resolveTicketInputRegimeResolution({ inputProvenance: prov }).kind,
    ).toBe("valid");

    expect(
      resolveTicketInputRegimeResolution({
        inputProvenance: {
          provenanceVersion: "1.0.0",
          inputRegime: REGIME_LIFECYCLE_C0_RECON_V1,
        },
      }).kind,
    ).toBe("invalid");

    expect(
      resolveTicketInputRegimeResolution({
        inputProvenance: {
          provenanceVersion: "1.0.0",
          inputRegime: "REGIME_FUTURE_X",
          home: {},
          away: {},
        },
      }),
    ).toEqual({ kind: "unknown", regimeLabel: "REGIME_FUTURE_X" });

    expect(() =>
      resolveTicketInputRegime({
        inputProvenance: {
          provenanceVersion: "1.0.0",
          inputRegime: "REGIME_FUTURE_X",
        },
      }),
    ).toThrow(/unknown regime/);

    expect(() =>
      assertCohortFromTicketResolutions([{ kind: "invalid" }]),
    ).toThrow(/INVALID/);
  });
});

describe("PE-3E evidence time + digest + duplicate conflict", () => {
  it("evidenceAcquiredAtUtc is acquisition clock; digest is deterministic", () => {
    const prior = universeRow({
      fixtureId: "p1",
      kickoffUtc: "2033-05-01T12:00:00.000Z",
      homeTeamId: "h",
      awayTeamId: "x",
    });
    const result = resolvePrematchStrengthFromUniverse({
      target: {
        fixtureId: "t1",
        kickoffUtc: "2033-06-01T12:00:00.000Z",
        homeTeamId: "h",
        awayTeamId: "a",
        competitionId: COMPETITION,
        season: SEASON,
      },
      universe: [prior],
      evidenceAcquiredAtUtc: "2033-05-30T10:00:00.000Z",
    });
    expect(result.evidenceAcquiredAtUtc).toBe("2033-05-30T10:00:00.000Z");
    expect(result.evidenceAsOfUtc).toBe(result.evidenceAcquiredAtUtc);
    expect(result.historicalCutoffUtc).toBe("2033-06-01T12:00:00.000Z");
    expect(result.acceptedEvidenceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.acceptedEvidenceDigest).toBe(
      digestAcceptedPrematchEvidence([prior]),
    );
    expect(digestAcceptedPrematchEvidence([prior])).toBe(
      digestAcceptedPrematchEvidence([{ ...prior }]),
    );
  });

  it("conflicting duplicate fixture ids fail closed", () => {
    const a = universeRow({ fixtureId: "same", homeGoals: 1, awayGoals: 0 });
    const b = universeRow({ fixtureId: "same", homeGoals: 9, awayGoals: 0 });
    const deduped = dedupeUniverseByFixtureId([a, b]);
    expect(deduped.ok).toBe(false);
    expect(() =>
      resolvePrematchStrengthFromUniverse({
        target: {
          fixtureId: "t1",
          kickoffUtc: "2033-06-01T12:00:00.000Z",
          homeTeamId: "h1",
          awayTeamId: "a1",
          competitionId: COMPETITION,
          season: SEASON,
        },
        universe: [a, b],
        evidenceAcquiredAtUtc: "2033-05-30T10:00:00.000Z",
      }),
    ).toThrow(PrematchUniverseConflictError);
  });
});

describe("PE-3E runner observability + activation gate + fingerprints", () => {
  it("sanitize retains C0 counters", () => {
    const report = emptyPrematchLifecycleReport("2026-01-01T00:00:00.000Z", 1);
    report.c0ReconAttempts = 2;
    report.seasonUniverseAcquisitions = 1;
    report.seasonUniverseHttpRequests = 3;
    report.c0LastSkipReason = "provider_failure";
    const summary = sanitizePrematchLifecycleReport(report);
    expect(summary.c0ReconAttempts).toBe(2);
    expect(summary.seasonUniverseAcquisitions).toBe(1);
    expect(summary.seasonUniverseHttpRequests).toBe(3);
    expect(summary.c0LastSkipReason).toBe("provider_failure");
    expect(summary).not.toHaveProperty("seasonUniverseRequests");
  });

  it("activation remains OFF; fingerprints unchanged", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(
      "7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c",
    );
    expect(LIVE_PROTOCOL_FINGERPRINT).toBe(
      "825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9",
    );
  });
});
