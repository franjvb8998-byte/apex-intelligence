/**
 * Sprint 5B.6 — multi-season validation preflight.
 * Mocked fixtures only. Zero live origin calls.
 */

import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ApiFootballFixtureItem,
  ApiFootballFixturesResponse,
} from "@/lib/data-platform/providers/api-football/types";
import {
  aggregateHoldoutSeasons,
  collectValidationHoldouts,
  collectValidationSeason,
  createSyntheticCalibrationRows,
  evaluateValidationSeason,
  FROZEN_VALIDATION_CONFIGS,
  interpretReplication,
  loadValidationSeasonArtifacts,
  planValidationLogicalCalls,
  PL_2024_DEVELOPMENT_REFERENCE,
  VALIDATION_DEVELOPMENT_SEASON,
  VALIDATION_HOLDOUT_SEASONS,
  VALIDATION_LEAGUE_ID,
  VALIDATION_LOGICAL_CALL_CEILING,
} from "@/lib/debug/calibration";
import { CallBudgetExceededError } from "@/lib/debug/calibration/live-guard";
import { ReconstructionLeakageError } from "@/lib/debug/calibration/leakage";
import { IncompleteSeasonListError } from "@/lib/debug/calibration/collector-integrity";
import {
  MicrocollectEmptySeasonError,
  MicrocollectVendorEnvelopeError,
} from "@/lib/debug/calibration/season-contract";
import { assertValidationLeakageContract } from "@/lib/debug/calibration/validation-5b6-integrity";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import type { FixtureSeasonTransport } from "@/lib/debug/calibration/fetch-season";
import type { CalibrationRow, ReconstructionFixture } from "@/lib/debug/calibration/types";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";

function vendorItem(input: {
  id: number;
  kickoff: string;
  season: string;
  homeId: number;
  awayId: number;
  goalsHome: number;
  goalsAway: number;
}): ApiFootballFixtureItem {
  return {
    fixture: {
      id: input.id,
      date: input.kickoff,
      status: { short: "FT" },
    },
    league: {
      id: Number(VALIDATION_LEAGUE_ID),
      name: "Premier League",
      season: Number(input.season),
    },
    teams: {
      home: { id: input.homeId, name: `Home ${input.homeId}` },
      away: { id: input.awayId, name: `Away ${input.awayId}` },
    },
    goals: { home: input.goalsHome, away: input.goalsAway },
    score: {
      fulltime: { home: input.goalsHome, away: input.goalsAway },
      penalty: null,
    },
  };
}

function seasonPayload(
  items: ApiFootballFixtureItem[],
  paging = { current: 1, total: 1 },
): ApiFootballFixturesResponse {
  return {
    get: "fixtures",
    results: items.length,
    paging,
    response: items,
  };
}

function compactSeason(season: string, matchdays: number): ApiFootballFixtureItem[] {
  const teamCount = 4;
  const start = Date.parse(`${season}-08-12T15:00:00.000Z`);
  const items: ApiFootballFixtureItem[] = [];
  let id = Number(season) * 1000;
  for (let day = 0; day < matchdays; day += 1) {
    const kickoff = new Date(start + day * 7 * 86_400_000).toISOString();
    for (let pair = 0; pair < teamCount / 2; pair += 1) {
      items.push(
        vendorItem({
          id,
          kickoff,
          season,
          homeId: ((pair * 2 + day) % teamCount) + 1,
          awayId: ((pair * 2 + 1 + day) % teamCount) + 1,
          goalsHome: (day + pair) % 3,
          goalsAway: (day + pair + 1) % 2,
        }),
      );
      id += 1;
    }
  }
  return items;
}

function recordingTransport(
  bySeason: Record<string, ApiFootballFixturesResponse>,
): FixtureSeasonTransport & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async getFixtures(league, season) {
      calls.push(`fixtures:${league}:${season}`);
      const payload = bySeason[season];
      if (!payload) throw new Error(`unexpected season ${season}`);
      return payload;
    },
  };
}

function holdoutRows(season: "2023" | "2025"): CalibrationRow[] {
  return createSyntheticCalibrationRows().map((row, index) => ({
    ...row,
    fixtureId: `${season}-${index}-${row.fixtureId}`,
    competitionId: VALIDATION_LEAGUE_ID,
    competitionName: "Premier League",
    season,
  }));
}

describe("Sprint 5B.6 — frozen validation contract", () => {
  it("freezes V0–V5 exactly and does not search extra HA cells", () => {
    expect(FROZEN_VALIDATION_CONFIGS.map((config) => config.id)).toEqual([
      "V0",
      "V1",
      "V2",
      "V3",
      "V4",
      "V5",
    ]);
    expect(FROZEN_VALIDATION_CONFIGS).toHaveLength(6);
    const v0 = FROZEN_VALIDATION_CONFIGS[0]!;
    expect(v0.roleHomeElo).toBe(1580);
    expect(v0.roleAwayElo).toBe(1520);
    expect(v0.homeAdvantageElo).toBe(65);
    expect(v0.baseHomeGoals).toBe(1.45);
    expect(v0.baseAwayGoals).toBe(1.15);
    const v1 = FROZEN_VALIDATION_CONFIGS[1]!;
    expect(v1.roleHomeElo).toBe(1550);
    expect(v1.roleAwayElo).toBe(1550);
    expect(v1.homeAdvantageElo).toBe(65);
    const v2 = FROZEN_VALIDATION_CONFIGS[2]!;
    expect(v2.homeAdvantageElo).toBe(0);
    expect(v2.roleHomeElo).toBe(1580);
    const v3 = FROZEN_VALIDATION_CONFIGS[3]!;
    expect(v3.baseHomeGoals).toBe(1.3);
    expect(v3.baseAwayGoals).toBe(1.3);
    expect(v3.homeAdvantageElo).toBe(65);
    const v4 = FROZEN_VALIDATION_CONFIGS[4]!;
    expect(v4.equalizeRolePriors).toBe(true);
    expect(v4.homeAdvantageElo).toBe(65);
    expect(v4.baseHomeGoals).toBe(1.3);
    const v5 = FROZEN_VALIDATION_CONFIGS[5]!;
    expect(v5.equalizeRolePriors).toBe(true);
    expect(v5.homeAdvantageElo).toBe(0);
    expect(v5.baseHomeGoals).toBe(1.3);
    expect(VALIDATION_HOLDOUT_SEASONS).toEqual(["2023", "2025"]);
    expect(VALIDATION_DEVELOPMENT_SEASON).toBe("2024");
  });

  it("keeps evaluation deterministic and production PE unchanged", () => {
    const rows = holdoutRows("2023");
    const first = evaluateValidationSeason({ rows, season: "2023" });
    const second = evaluateValidationSeason({ rows, season: "2023" });
    expect(JSON.stringify(first.cells)).toBe(JSON.stringify(second.cells));
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect(DEFAULT_HYBRID_CONFIG.baseHomeGoals).toBe(1.45);
    expect(first.cells).toHaveLength(6 * 6 * 5);
    for (const cell of first.cells.filter((item) => item.scope === "all")) {
      expect(cell.n).toBe(rows.length);
      expect(Number.isFinite(cell.logLoss)).toBe(true);
      const sum = cell.meanPredicted.home + cell.meanPredicted.draw + cell.meanPredicted.away;
      expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
    }
    const expected = { "0": 0, "1-3": 0, "4-9": 0, "10+": 0 };
    for (const row of rows) expected[rowEvidenceBucket(row)] += 1;
    const v0 = first.cells.filter((cell) => cell.policyId === "current_catalogue" && cell.configId === "V0");
    expect(v0.find((cell) => cell.scope === "0")?.n).toBe(expected["0"]);
    expect(v0.find((cell) => cell.scope === "1-3")?.n).toBe(expected["1-3"]);
    expect(v0.find((cell) => cell.scope === "4-9")?.n).toBe(expected["4-9"]);
    expect(v0.find((cell) => cell.scope === "10+")?.n).toBe(expected["10+"]);
  });
});

describe("Sprint 5B.6 — holdout aggregation", () => {
  it("excludes PL 2024 from the holdout aggregate and weights by N", () => {
    const a = evaluateValidationSeason({ rows: holdoutRows("2023").slice(0, 2), season: "2023" });
    const b = evaluateValidationSeason({ rows: holdoutRows("2025").slice(0, 4), season: "2025" });
    const aggregate = aggregateHoldoutSeasons([a, b]);
    expect(aggregate.n).toBe(6);
    expect(aggregate.seasons).toEqual(["2023", "2025"]);
    expect(aggregate.seasons).not.toContain("2024");
    const v0a = a.cells.find((cell) => cell.policyId === "current_catalogue" && cell.configId === "V0" && cell.scope === "all")!;
    const v0b = b.cells.find((cell) => cell.policyId === "current_catalogue" && cell.configId === "V0" && cell.scope === "all")!;
    expect(aggregate.catalogue.V0.logLoss).toBeCloseTo(
      (v0a.logLoss * 2 + v0b.logLoss * 4) / 6,
      12,
    );
    expect(() =>
      aggregateHoldoutSeasons([
        { ...a, season: "2024", role: "DEVELOPMENT" },
        b,
      ]),
    ).toThrow(/DEVELOPMENT/);
    expect(PL_2024_DEVELOPMENT_REFERENCE.role).toBe("DEVELOPMENT");
    expect(PL_2024_DEVELOPMENT_REFERENCE.n).toBe(380);
    const report = interpretReplication([a, b]);
    expect(["YES", "NO", "MIXED"]).toContain(report.homeBiasReplication);
    expect(a.season).toBe("2023");
    expect(b.season).toBe("2025");
  });
});

describe("Sprint 5B.6 — collection fail-closed", () => {
  it("collects each holdout independently with one unpaged fixtures call and no odds", async () => {
    const transport = recordingTransport({
      "2023": seasonPayload(compactSeason("2023", 3)),
      "2025": seasonPayload(compactSeason("2025", 3)),
    });
    const directory = mkdtempSync(join(tmpdir(), "apex-5b6-"));
    const result = await collectValidationHoldouts({
      transport,
      writeArtifacts: true,
      artifactDirectory: directory,
      generatedAt: "2026-09-19T06:10:00.000Z",
    });
    expect(transport.calls).toEqual(["fixtures:39:2023", "fixtures:39:2025"]);
    expect(result.logicalCallCount).toBe(2);
    expect(result.logicalCallCount).toBe(VALIDATION_HOLDOUT_SEASONS.length);
    expect(result.seasons).toHaveLength(2);
    expect(result.seasons[0]!.metadata.oddsRequested).toBe(false);
    expect(result.seasons[0]!.metadata.oddsLogicalCalls).toBe(0);
    expect(result.seasons[0]!.population.length).not.toBe(380);
    expect(result.seasons[0]!.metadata.populationRowCount).toBe(
      result.seasons[0]!.population.length,
    );
    const leftovers = readdirSync(directory).filter((name) => name.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
    const loaded = loadValidationSeasonArtifacts(result.seasons[0]!.paths!.metadataPath);
    expect(loaded.population).toHaveLength(result.seasons[0]!.population.length);
    const body = readFileSync(result.seasons[0]!.paths!.metadataPath, "utf8");
    expect(body).not.toMatch(/api[_-]?key|x-apisports-key/i);
    expect(result.seasons[0]!.paths!.populationPath).toContain("validation-5b6-pl-2023-");
    expect("getFixtureOdds" in transport).toBe(false);
  });

  it("fails closed on empty envelope, vendor errors, and paging.total > 1", async () => {
    await expect(
      collectValidationSeason({
        transport: {
          async getFixtures() {
            return { get: "fixtures", results: 0, paging: { current: 1, total: 1 }, response: [] };
          },
        },
        season: "2023",
      }),
    ).rejects.toBeInstanceOf(MicrocollectEmptySeasonError);

    await expect(
      collectValidationSeason({
        transport: {
          async getFixtures() {
            return {
              get: "fixtures",
              results: 0,
              paging: { current: 1, total: 1 },
              errors: { plan: "This endpoint is not available on your plan" },
              response: [],
            };
          },
        },
        season: "2023",
      }),
    ).rejects.toBeInstanceOf(MicrocollectVendorEnvelopeError);

    const paged = recordingTransport({
      "2023": seasonPayload(compactSeason("2023", 1), { current: 1, total: 2 }),
    });
    await expect(collectValidationSeason({ transport: paged, season: "2023" })).rejects.toBeInstanceOf(
      IncompleteSeasonListError,
    );
    expect(paged.calls).toEqual(["fixtures:39:2023"]);
  });

  it("fails closed when reconstructed playedBefore leaks future priors", () => {
    const target: ReconstructionFixture = {
      fixtureId: "t1",
      kickoff: "2023-08-20T15:00:00.000Z",
      competitionId: "39",
      season: "2023",
      homeTeamId: "1",
      awayTeamId: "2",
      status: "FT",
      goalsHome: 1,
      goalsAway: 0,
      fulltimeHome: 1,
      fulltimeAway: 0,
    };
    const prior: ReconstructionFixture = {
      ...target,
      fixtureId: "t0",
      kickoff: "2023-08-13T15:00:00.000Z",
    };
    const row = holdoutRows("2023")[0]!;
    expect(() =>
      assertValidationLeakageContract({
        target,
        fixtures: [prior, target],
        row: { ...row, homePlayedBefore: 9, awayPlayedBefore: 9 },
      }),
    ).toThrow(ReconstructionLeakageError);
  });

  it("plans exactly two logical fixture-list calls and forbids odds", () => {
    expect(planValidationLogicalCalls()).toEqual({
      plannedLogicalCalls: 2,
      ceiling: VALIDATION_LOGICAL_CALL_CEILING,
    });
    expect(() => planValidationLogicalCalls({ includeOdds: true })).toThrow(CallBudgetExceededError);
    expect(() => planValidationLogicalCalls({ seasonCount: 3 })).toThrow(CallBudgetExceededError);
  });
});

describe("Sprint 5B.6 — no live/odds surface in offline modules", () => {
  it("does not import live transport or odds helpers in evaluator/report/configs", () => {
    const files = [
      "lib/debug/calibration/validation-5b6-configs.ts",
      "lib/debug/calibration/validation-5b6-evaluate.ts",
      "lib/debug/calibration/validation-5b6-report.ts",
      "lib/debug/calibration/validation-5b6-persist.ts",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY/);
    }
    const collect = readFileSync("lib/debug/calibration/validation-5b6-collect.ts", "utf8");
    expect(collect).not.toMatch(/getFixtureOdds/);
    expect(collect).toMatch(/oddsRequested: false/);
  });
});
