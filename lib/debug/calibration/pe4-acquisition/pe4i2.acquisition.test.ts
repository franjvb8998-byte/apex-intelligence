/**
 * PE-4I.2 — Offline acquisition infrastructure tests.
 * Fake transports only. Zero network.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import {
  digestGoalsG1Protocol,
  goalsG1Protocol,
  GOALS_G1_MODEL_VERSION,
} from "@/lib/debug/calibration/goals/g1/protocol";
import {
  Pe4I2BudgetExhaustedError,
  acquireScheduleUnit,
  acquireStatisticsUnit,
  assertNotSameKickoffOrSelf,
  buildPe4I2AcquisitionPlan,
  buildPlanFromShuffledTeams,
  buildRawStatisticRow,
  classifyPe4I2Competition,
  createFakePe4I2Transport,
  createPe4I2AcquisitionCache,
  createPe4I2CallBudget,
  createRefusingTransport,
  dedupeScheduleFixtures,
  digestPe4I2Protocol,
  inventoryStatisticsFields,
  normalizeFixtureStatisticsPayload,
  normalizeTeamSeasonSchedulePayload,
  pe4I2Protocol,
  resolveXgStatus,
  runPe4I2AcquisitionDryRun,
  scheduleIdentityDigest,
  PE4I2_FAIL_CLOSED_MATRIX,
  PE4I2_HOLDOUT_SEASON,
  PE4I2_XG_STATUS,
  PE4I2_PL_TEAMS_2023,
  PE4I2_PL_TEAMS_2024,
} from "@/lib/debug/calibration/pe4-acquisition";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    const d = tempDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tempCache() {
  const root = mkdtempSync(path.join(tmpdir(), "pe4i2-cache-"));
  tempDirs.push(root);
  return createPe4I2AcquisitionCache(root);
}

function schedulePayload(fixtures: unknown[]) {
  return {
    get: "fixtures",
    parameters: {},
    errors: [],
    results: fixtures.length,
    paging: { current: 1, total: 1 },
    response: fixtures,
  };
}

function fixtureItem(partial: {
  id: number;
  date: string;
  leagueId?: number;
  leagueName?: string;
  homeId: number;
  awayId: number;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}) {
  return {
    fixture: {
      id: partial.id,
      date: partial.date,
      status: { short: partial.status ?? "FT", long: "Match Finished" },
    },
    league: {
      id: partial.leagueId ?? 39,
      name: partial.leagueName ?? "Premier League",
      season: 2023,
    },
    teams: {
      home: { id: partial.homeId, name: "H" },
      away: { id: partial.awayId, name: "A" },
    },
    goals: {
      home: partial.homeGoals === undefined ? 1 : partial.homeGoals,
      away: partial.awayGoals === undefined ? 0 : partial.awayGoals,
    },
  };
}

describe("PE-4I.2 safety pins", () => {
  it("keeps PE3 activation false, expectation UNAVAILABLE, G1 k=10", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(
      resolvePe4HistoricalExpectation({
        targetStrengthCommon: 1600,
        opponentStrengthCommon: 1500,
        targetVenueRole: "HOME",
        pairwiseAvailable: true,
        historicalCutoffUtc: "2024-01-01T00:00:00.000Z",
        targetSource: "catalogue",
        opponentSource: "catalogue",
      }).status,
    ).toBe("UNAVAILABLE");
    expect(GOALS_G1_MODEL_VERSION).toBe("goals.g1.attack_defense_poisson.v1");
    expect(goalsG1Protocol(10).selectedShrinkageK).toBe(10);
    expect(digestGoalsG1Protocol(goalsG1Protocol(10))).toBe(
      "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b",
    );
  });

  it("protocol digest is deterministic", () => {
    expect(digestPe4I2Protocol()).toBe(digestPe4I2Protocol(pe4I2Protocol()));
  });

  it("documents fail-closed matrix", () => {
    expect(PE4I2_FAIL_CLOSED_MATRIX.length).toBeGreaterThanOrEqual(10);
  });

  it("has no production wiring imports in module index", () => {
    const src = readFileSync(
      path.join(
        process.cwd(),
        "lib/debug/calibration/pe4-acquisition/index.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/prematch-lifecycle|opportunity-scanner|supabase/i);
  });
});

describe("PE-4I.2 planner", () => {
  it("builds deterministic plan for 2023+2024", () => {
    const a = buildPe4I2AcquisitionPlan({ maxCalls: 5000 });
    const b = buildPe4I2AcquisitionPlan({ maxCalls: 5000 });
    expect(a.planDigest).toBe(b.planDigest);
    expect(a.scheduleUnits.length).toBe(
      PE4I2_PL_TEAMS_2023.length + PE4I2_PL_TEAMS_2024.length,
    );
    expect(a.estimates.scheduleCalls).toBe(40);
    expect(a.liveEnabled).toBe(false);
    expect(a.holdoutRejected).toBe(true);
  });

  it("shuffle invariance of team unit keys", () => {
    const ids = [...PE4I2_PL_TEAMS_2023];
    const forward = buildPlanFromShuffledTeams({
      maxCalls: 100,
      season: "2023",
      teamIds: ids,
    });
    const shuffled = buildPlanFromShuffledTeams({
      maxCalls: 100,
      season: "2023",
      teamIds: [...ids].reverse(),
    });
    expect(forward).toBe(shuffled);
  });

  it("rejects 2025 holdout in plan", () => {
    expect(() =>
      buildPe4I2AcquisitionPlan({
        maxCalls: 10,
        seasons: ["2025"],
      }),
    ).toThrow(/holdout/i);
    expect(PE4I2_HOLDOUT_SEASON).toBe("2025");
  });
});

describe("PE-4I.2 competition registry", () => {
  it("classifies PL 39 and preserves unknown", () => {
    expect(
      classifyPe4I2Competition({
        providerCompetitionId: "39",
        providerCompetitionName: "Premier League",
      }).competitionClass,
    ).toBe("target_domestic_league");
    expect(
      classifyPe4I2Competition({
        providerCompetitionId: "45",
        providerCompetitionName: "FA Cup",
      }).competitionClass,
    ).toBe("domestic_cup");
    expect(
      classifyPe4I2Competition({
        providerCompetitionId: "3",
        providerCompetitionName: "UEFA Europa League",
      }).competitionClass,
    ).toBe("uefa_europa_league");
    const u = classifyPe4I2Competition({
      providerCompetitionId: "99999",
      providerCompetitionName: "Mystery Comp",
    });
    expect(u.competitionClass).toBe("unknown_competition");
  });
});

describe("PE-4I.2 dedupe + normalize", () => {
  it("collapses identical duplicates", () => {
    const row = {
      providerFixtureId: "100",
      providerCompetitionId: "39",
      providerCompetitionName: "Premier League",
      competitionClass: "target_domestic_league" as const,
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      status: "FT",
      homeTeamId: "42",
      awayTeamId: "49",
      homeTeamName: "Arsenal",
      awayTeamName: "Chelsea",
      homeGoals: 1,
      awayGoals: 0,
      identityDigest: scheduleIdentityDigest({
        providerFixtureId: "100",
        kickoffUtc: "2023-08-11T15:00:00.000Z",
        homeTeamId: "42",
        awayTeamId: "49",
        providerCompetitionId: "39",
        status: "FT",
        homeGoals: 1,
        awayGoals: 0,
      }),
    };
    const r = dedupeScheduleFixtures([row, { ...row }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fixtures).toHaveLength(1);
      expect(r.collapsedIdenticalDuplicates).toBe(1);
    }
  });

  it("fails closed on conflicting duplicates", () => {
    const a = {
      providerFixtureId: "100",
      providerCompetitionId: "39",
      providerCompetitionName: "Premier League",
      competitionClass: "target_domestic_league" as const,
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      status: "FT",
      homeTeamId: "42",
      awayTeamId: "49",
      homeTeamName: "Arsenal",
      awayTeamName: "Chelsea",
      homeGoals: 1,
      awayGoals: 0,
      identityDigest: "aaa",
    };
    const b = { ...a, homeGoals: 2, identityDigest: "bbb" };
    const r = dedupeScheduleFixtures([a, b]);
    expect(r.ok).toBe(false);
  });

  it("preserves unknown competition rows", () => {
    const norm = normalizeTeamSeasonSchedulePayload({
      providerTeamId: "42",
      requestedSeason: "2023",
      acquiredAtUtc: "2026-01-01T00:00:00.000Z",
      payload: schedulePayload([
        fixtureItem({
          id: 1,
          date: "2023-09-01T19:00:00+00:00",
          leagueId: 999,
          leagueName: "Mystery Cup",
          homeId: 42,
          awayId: 49,
        }),
      ]),
    });
    expect(norm.ok).toBe(true);
    if (norm.ok) {
      expect(norm.envelope.fixtures[0]!.competitionClass).toBe(
        "unknown_competition",
      );
    }
  });

  it("rejects malformed schedule payload", () => {
    const norm = normalizeTeamSeasonSchedulePayload({
      providerTeamId: "42",
      requestedSeason: "2023",
      acquiredAtUtc: "2026-01-01T00:00:00.000Z",
      payload: { response: "nope" },
    });
    expect(norm.ok).toBe(false);
  });
});

describe("PE-4I.2 statistics + xG", () => {
  it("missing statistic is not zero", () => {
    const missing = buildRawStatisticRow("Total Shots", null);
    const zero = buildRawStatisticRow("Total Shots", 0);
    expect(missing.valuePresence).toBe("missing");
    expect(missing.rawValue).toBeNull();
    expect(missing.parsedNumeric).toBeNull();
    expect(zero.valuePresence).toBe("present");
    expect(zero.parsedNumeric).toBe(0);
  });

  it("xg remains UNKNOWN without observed provider field", () => {
    const report = inventoryStatisticsFields([
      {
        providerFixtureId: "1",
        teamBlocks: [
          {
            statistics: [
              buildRawStatisticRow("Total Shots", 10),
              buildRawStatisticRow("Shots on Goal", 3),
            ],
          },
        ],
      },
    ]);
    expect(report.xgStatus).toBe(PE4I2_XG_STATUS);
    expect(report.vendorXgFieldEverObserved).toBe(false);
    expect(resolveXgStatus(false).status).toBe(PE4I2_XG_STATUS);
  });

  it("normalizes statistics envelopes", () => {
    const norm = normalizeFixtureStatisticsPayload({
      providerFixtureId: "55",
      acquiredAtUtc: "2026-01-01T00:00:00.000Z",
      payload: {
        results: 2,
        response: [
          {
            team: { id: 42, name: "Arsenal" },
            statistics: [
              { type: "Total Shots", value: 12 },
              { type: "Ball Possession", value: "55%" },
              { type: "expected_goals", value: null },
            ],
          },
        ],
      },
    });
    expect(norm.ok).toBe(true);
    if (norm.ok) {
      expect(norm.envelope.vendorXgFieldObserved).toBe(false);
      const xg = norm.envelope.teams[0]!.statistics.find(
        (s) => s.rawName === "expected_goals",
      );
      expect(xg?.valuePresence).toBe("missing");
    }
  });
});

describe("PE-4I.2 temporal", () => {
  it("enforces kickoff identity exclusions", () => {
    expect(
      assertNotSameKickoffOrSelf({
        historicalFixtureId: "1",
        historicalKickoffUtc: "2023-01-01T00:00:00.000Z",
        targetFixtureId: "1",
        targetKickoffUtc: "2023-02-01T00:00:00.000Z",
      }).ok,
    ).toBe(false);
    expect(
      assertNotSameKickoffOrSelf({
        historicalFixtureId: "1",
        historicalKickoffUtc: "2023-02-01T00:00:00.000Z",
        targetFixtureId: "2",
        targetKickoffUtc: "2023-02-01T00:00:00.000Z",
      }).ok,
    ).toBe(false);
    expect(
      assertNotSameKickoffOrSelf({
        historicalFixtureId: "1",
        historicalKickoffUtc: "2023-01-01T00:00:00.000Z",
        targetFixtureId: "2",
        targetKickoffUtc: "2023-02-01T00:00:00.000Z",
      }).ok,
    ).toBe(true);
  });
});

describe("PE-4I.2 cache + budget + transport", () => {
  it("dry-run makes zero provider calls", () => {
    const fake = createFakePe4I2Transport({
      onRequest: () => ({ ok: true, payload: {} }),
    });
    const result = runPe4I2AcquisitionDryRun({
      maxCalls: 100,
      transport: fake,
    });
    expect(result.providerCallsMade).toBe(0);
    expect(fake.calls).toHaveLength(0);
    expect(result.liveEnabled).toBe(false);
  });

  it("refusing transport is the default live barrier", async () => {
    const t = createRefusingTransport();
    const res = await t.request({
      kind: "team_season_schedule",
      providerTeamId: "42",
      season: "2023",
    });
    expect(res.ok).toBe(false);
  });

  it("budget exact boundary and exhaustion", async () => {
    const cache = tempCache();
    const fake = createFakePe4I2Transport({
      onRequest: () => ({
        ok: true,
        payload: schedulePayload([
          fixtureItem({
            id: 10,
            date: "2023-08-12T14:00:00+00:00",
            homeId: 42,
            awayId: 49,
          }),
        ]),
      }),
    });
    const budget = createPe4I2CallBudget(1);
    const first = await acquireScheduleUnit({
      transport: fake,
      budget,
      cache,
      providerTeamId: "42",
      season: "2023",
      acquiredAtUtc: "2026-01-01T00:00:00.000Z",
    });
    expect(first.ok).toBe(true);
    expect(budget.snapshot().attempted).toBe(1);
    await expect(
      acquireScheduleUnit({
        transport: fake,
        budget,
        cache,
        providerTeamId: "49",
        season: "2023",
        acquiredAtUtc: "2026-01-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(Pe4I2BudgetExhaustedError);
  });

  it("cache resume hits and conflict detection", async () => {
    const cache = tempCache();
    const fake = createFakePe4I2Transport({
      onRequest: () => ({
        ok: true,
        payload: schedulePayload([
          fixtureItem({
            id: 11,
            date: "2023-08-12T14:00:00+00:00",
            homeId: 42,
            awayId: 49,
          }),
        ]),
      }),
    });
    const budget = createPe4I2CallBudget(5);
    const a = await acquireScheduleUnit({
      transport: fake,
      budget,
      cache,
      providerTeamId: "42",
      season: "2023",
      acquiredAtUtc: "2026-01-01T00:00:00.000Z",
    });
    expect(a.ok && a.cacheHit).toBe(false);
    const b = await acquireScheduleUnit({
      transport: fake,
      budget,
      cache,
      providerTeamId: "42",
      season: "2023",
      acquiredAtUtc: "2026-01-01T00:00:00.000Z",
    });
    expect(b.ok && b.cacheHit).toBe(true);
    expect(fake.calls).toHaveLength(1);
    expect(budget.snapshot().cacheHits).toBe(1);

    const unit = cache.getUnit(
      a.ok ? a.unitKey : "",
    );
    expect(unit?.status).toBe("completed");
    expect(() =>
      cache.putCompleted({
        unitKey: unit!.unitKey,
        kind: "team_season_schedule",
        contentDigest: "different-digest",
        payload: {},
      }),
    ).toThrow(/conflict/i);
  });

  it("provider error marks retryable", async () => {
    const cache = tempCache();
    const fake = createFakePe4I2Transport({
      onRequest: () => ({
        ok: false,
        reason: "provider_error",
        message: "boom",
      }),
    });
    const budget = createPe4I2CallBudget(2);
    const res = await acquireScheduleUnit({
      transport: fake,
      budget,
      cache,
      providerTeamId: "42",
      season: "2023",
    });
    expect(res.ok).toBe(false);
    expect(cache.getUnit("schedule::team=42::season=2023")?.status).toBe(
      "retryable",
    );
  });

  it("statistics acquire via fake transport", async () => {
    const cache = tempCache();
    const fake = createFakePe4I2Transport({
      onRequest: () => ({
        ok: true,
        payload: {
          results: 1,
          response: [
            {
              team: { id: 42, name: "Arsenal" },
              statistics: [{ type: "Total Shots", value: 8 }],
            },
          ],
        },
      }),
    });
    const budget = createPe4I2CallBudget(1);
    const res = await acquireStatisticsUnit({
      transport: fake,
      budget,
      cache,
      providerFixtureId: "99",
      acquiredAtUtc: "2026-01-01T00:00:00.000Z",
    });
    expect(res.ok).toBe(true);
  });
});
