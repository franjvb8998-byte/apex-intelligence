/**
 * PE-3B — Controlled lifecycle integration infrastructure tests.
 * Offline only. Does not activate C0 in production coordinator.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import {
  catalogueEloFromPlayedStats,
  PRODUCTION_AWAY_ELO_BASE,
  PRODUCTION_HOME_ELO_BASE,
} from "@/lib/match-center/catalogue-elo";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength";
import {
  assertSameInputRegimeCohort,
  provenanceForBasePriorLifecycle,
  REGIME_LIFECYCLE_BASE_PRIOR_V1,
  REGIME_LIFECYCLE_C0_RECON_V1,
  resolveTicketInputRegime,
} from "@/lib/prematch-decision/input-provenance";
import {
  isC0ReconLifecycleActivated,
  PE3C_C0_RECON_ACTIVATION,
  resolveLifecyclePeInputMode,
} from "@/lib/prematch-lifecycle/pe3-activation";
import { PE3_FAIL_CLOSED_MATRIX } from "@/lib/prematch-lifecycle/pe3-fail-closed";
import { runOfflineC0ReconPipeline } from "@/lib/prematch-lifecycle/c0-recon-offline";
import {
  createRunScopedSeasonUniverseCache,
  createSeasonUniverseLoaderFromProviderFetch,
  normalizeSeasonUniverseRows,
  resolveSeasonUniverseKeyFromBundle,
  type SeasonUniverseProviderRow,
} from "@/lib/prematch-lifecycle/season-universe";

const TARGET_KO = "2026-09-20T15:00:00.000Z";
const BEFORE = "2026-09-10T15:00:00.000Z";
const AFTER = "2026-09-25T15:00:00.000Z";
const AS_OF = "2026-09-19T12:00:00.000Z";

function prior(
  partial: Partial<PrematchStrengthUniverseFixture> &
    Pick<PrematchStrengthUniverseFixture, "fixtureId">,
): PrematchStrengthUniverseFixture {
  return {
    kickoffUtc: BEFORE,
    homeTeamId: "team-strong",
    awayTeamId: "opp",
    competitionId: "comp-1",
    season: "2026",
    status: "FT",
    homeGoals: 2,
    awayGoals: 0,
    ...partial,
  };
}

describe("PE-3B activation gate", () => {
  it("keeps C0 recon deactivated for production", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(resolveLifecyclePeInputMode()).toBe("base_prior");
    expect(isC0ReconLifecycleActivated()).toBe(false);
  });

  it("scanner canonical still hard-wires empty enrichment; default mode is base_prior", () => {
    const scanner = readFileSync(
      join(process.cwd(), "lib/apex-opportunities/scanner-canonical.ts"),
      "utf8",
    );
    const activation = readFileSync(
      join(process.cwd(), "lib/prematch-lifecycle/pe3-activation.ts"),
      "utf8",
    );
    expect(scanner).toContain("EMPTY_MATCH_CENTER_ENRICHMENT");
    expect(scanner).not.toContain("prepareLifecycleC0MatchCenter");
    expect(activation).toMatch(/PE3C_C0_RECON_ACTIVATION:\s*boolean\s*=\s*false/);
  });
});

describe("PE-3B season resolution", () => {
  it("uses authoritative league.season from bundle", async () => {
    const bundle = await createMockDataProvider().getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });
    const withSeason = {
      ...bundle,
      league: bundle.league
        ? { ...bundle.league, id: "apex:league:39", season: "2025" }
        : {
            id: "apex:league:39",
            name: "Test",
            country: null,
            sport: "football",
            season: "2025",
            externalRefs: [],
          },
    };
    const resolved = resolveSeasonUniverseKeyFromBundle(withSeason);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.key.season).toBe("2025");
      expect(resolved.key.competitionId).toBe("apex:league:39");
    }
  });

  it("fails closed when season missing (no calendar guess)", async () => {
    const bundle = await createMockDataProvider().getMatch({
      matchId: DEMO_MATCH_EXTERNAL_ID,
    });
    const noSeason = {
      ...bundle,
      league: bundle.league
        ? { ...bundle.league, id: "apex:league:39", season: null }
        : null,
    };
    const resolved = resolveSeasonUniverseKeyFromBundle(noSeason);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toBe("missing_season");
  });
});

describe("PE-3B run-scope season universe cache / budget", () => {
  it("acquires season universe at most once per league+season for 3 fixtures", async () => {
    let fetchCalls = 0;
    const rowsFor = (key: { competitionId: string; season: string }): SeasonUniverseProviderRow[] => [
      {
        fixtureId: "hist-1",
        kickoffUtc: BEFORE,
        homeTeamId: "t1",
        awayTeamId: "t2",
        competitionId: key.competitionId,
        season: key.season,
        status: "FT",
        homeGoals: 1,
        awayGoals: 0,
      },
    ];

    const loader = createSeasonUniverseLoaderFromProviderFetch(async (key) => {
      fetchCalls += 1;
      return rowsFor(key);
    });
    const cache = createRunScopedSeasonUniverseCache();
    const key = { competitionId: "39", season: "2025" };

    const results = await Promise.all([
      cache.getOrLoad(key, loader),
      cache.getOrLoad(key, loader),
      cache.getOrLoad(key, loader),
    ]);

    expect(fetchCalls).toBe(1);
    expect(cache.loaderInvocations).toBe(1);
    expect(results.every((r) => r.ok)).toBe(true);

    // Different season key may acquire once more
    await cache.getOrLoad({ competitionId: "39", season: "2024" }, loader);
    expect(fetchCalls).toBe(2);
    expect(cache.loaderInvocations).toBe(2);
  });

  it("normalize rejects malformed provider rows", () => {
    const key = { competitionId: "39", season: "2025" };
    const bad = normalizeSeasonUniverseRows(key, [
      {
        fixtureId: "",
        kickoffUtc: BEFORE,
        homeTeamId: "a",
        awayTeamId: "b",
        competitionId: "39",
        season: "2025",
        status: "FT",
        homeGoals: 1,
        awayGoals: 0,
      },
    ]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("malformed_provider_response");
  });
});

describe("PE-3B regime / provenance / calibration cohort", () => {
  it("legacy tickets without provenance map to BASE_PRIOR_V1", () => {
    expect(resolveTicketInputRegime({})).toBe(REGIME_LIFECYCLE_BASE_PRIOR_V1);
    expect(
      resolveTicketInputRegime({
        inputProvenance: provenanceForBasePriorLifecycle({
          modelVersion: "elo-poisson-hybrid-0.1.0",
        }),
      }),
    ).toBe(REGIME_LIFECYCLE_BASE_PRIOR_V1);
  });

  it("refuses mixed-regime calibration cohorts", () => {
    expect(() =>
      assertSameInputRegimeCohort([
        REGIME_LIFECYCLE_BASE_PRIOR_V1,
        REGIME_LIFECYCLE_C0_RECON_V1,
      ]),
    ).toThrow(/mixes input regimes/);
  });

  it("documents fail-closed matrix without silent recovery", () => {
    expect(PE3_FAIL_CLOSED_MATRIX.missing_season.action).toBe("skip_ticket");
    expect(PE3_FAIL_CLOSED_MATRIX.quota_rate_limit.action).toBe("abort_run");
    expect(PE3_FAIL_CLOSED_MATRIX.zero_historical_fixtures.action).toBe(
      "explicit_base_prior",
    );
    expect(PE3_FAIL_CLOSED_MATRIX.one_side_evidence_only.action).toBe(
      "mixed_side_catalogue",
    );
  });
});

describe("PE-3B offline C0 golden end-to-end", () => {
  const universe: PrematchStrengthUniverseFixture[] = [
    prior({
      fixtureId: "p1",
      homeTeamId: "team-strong",
      awayTeamId: "opp-a",
      homeGoals: 3,
      awayGoals: 0,
    }),
    prior({
      fixtureId: "p2",
      homeTeamId: "opp-b",
      awayTeamId: "team-strong",
      homeGoals: 0,
      awayGoals: 2,
    }),
    prior({
      fixtureId: "p3",
      homeTeamId: "team-strong",
      awayTeamId: "opp-c",
      homeGoals: 4,
      awayGoals: 1,
    }),
    prior({
      fixtureId: "p4",
      homeTeamId: "team-weak",
      awayTeamId: "opp-d",
      homeGoals: 0,
      awayGoals: 3,
    }),
    prior({
      fixtureId: "p5",
      homeTeamId: "opp-e",
      awayTeamId: "team-weak",
      homeGoals: 2,
      awayGoals: 0,
    }),
    prior({
      fixtureId: "p6",
      homeTeamId: "team-weak",
      awayTeamId: "opp-f",
      homeGoals: 1,
      awayGoals: 4,
    }),
    // Must be ignored
    prior({
      fixtureId: "future-blowout",
      kickoffUtc: AFTER,
      homeTeamId: "team-strong",
      awayTeamId: "team-weak",
      homeGoals: 9,
      awayGoals: 0,
    }),
  ];

  const target = {
    fixtureId: "fx-target",
    kickoffUtc: TARGET_KO,
    homeTeamId: "team-strong",
    awayTeamId: "team-weak",
    competitionId: "comp-1",
    season: "2026",
  };

  it("reconstructs C0 Elo, runs canonical PE, freezes provenance", () => {
    const result = runOfflineC0ReconPipeline({
      target,
      universe,
      homeTeamName: "Strong FC",
      awayTeamName: "Weak FC",
      evidenceAsOfUtc: AS_OF,
      odds: { home: 1.4, draw: 4.5, away: 7.0, bookmaker: "mock-book" },
    });

    expect(result.strength.home.evidence.played).toBe(3);
    expect(result.strength.home.evidence.wins).toBe(3);
    expect(result.strength.home.evidence.goalsFor).toBe(9);
    expect(result.strength.home.evidence.goalsAgainst).toBe(1);
    expect(result.strength.away.evidence.played).toBe(3);
    expect(result.strength.away.evidence.wins).toBe(0);
    expect(result.strength.away.evidence.goalsFor).toBe(1);
    expect(result.strength.away.evidence.goalsAgainst).toBe(9);

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
    expect(result.strength.homeElo).toBe(expectedHome);
    expect(result.strength.awayElo).toBe(expectedAway);

    expect(result.hybrid.meta.modelVersion).toBe("elo-poisson-hybrid-0.1.0");
    expect(
      result.hybrid.oneXTwo.home +
        result.hybrid.oneXTwo.draw +
        result.hybrid.oneXTwo.away,
    ).toBeCloseTo(1, 12);

    expect(result.provenance.inputRegime).toBe(REGIME_LIFECYCLE_C0_RECON_V1);
    expect(result.provenance.home.source).toBe("catalogue");
    expect(result.provenance.away.source).toBe("catalogue");
    expect(result.provenance.contextLayers).toEqual({});
    expect(result.ticketPayload.inputProvenance?.inputRegime).toBe(
      REGIME_LIFECYCLE_C0_RECON_V1,
    );
    expect(result.ticketPayload.model.version).toBe(
      "elo-poisson-hybrid-0.1.0",
    );

    const homeSel = result.ticketPayload.selections.find(
      (s) => s.marketId === "1x2" && s.selectionId === "home",
    );
    expect(homeSel?.modelProbability).toBe(result.hybrid.oneXTwo.home);
  });

  it("future fixture mutations do not change prediction", () => {
    const base = runOfflineC0ReconPipeline({
      target,
      universe,
      homeTeamName: "Strong FC",
      awayTeamName: "Weak FC",
      evidenceAsOfUtc: AS_OF,
    });
    const mutated = runOfflineC0ReconPipeline({
      target,
      universe: [
        ...universe,
        prior({
          fixtureId: "future-2",
          kickoffUtc: AFTER,
          homeTeamId: "team-strong",
          awayTeamId: "opp-z",
          homeGoals: 20,
          awayGoals: 0,
        }),
      ],
      homeTeamName: "Strong FC",
      awayTeamName: "Weak FC",
      evidenceAsOfUtc: AS_OF,
    });
    expect(mutated.hybrid.oneXTwo).toEqual(base.hybrid.oneXTwo);
    expect(mutated.strength.homeElo).toBe(base.strength.homeElo);
  });

  it("odds change EV but not model probability", () => {
    const low = runOfflineC0ReconPipeline({
      target,
      universe,
      homeTeamName: "Strong FC",
      awayTeamName: "Weak FC",
      evidenceAsOfUtc: AS_OF,
      odds: { home: 1.2, draw: 5, away: 10 },
    });
    const high = runOfflineC0ReconPipeline({
      target,
      universe,
      homeTeamName: "Strong FC",
      awayTeamName: "Weak FC",
      evidenceAsOfUtc: AS_OF,
      odds: { home: 2.5, draw: 3.5, away: 2.8 },
    });
    expect(high.hybrid.oneXTwo).toEqual(low.hybrid.oneXTwo);
    expect(high.ev.home).not.toBe(low.ev.home);
  });
});
