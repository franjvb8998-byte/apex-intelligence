/**
 * Sprint 5B.4 — mocked historical probability-calibration pilot.
 * Zero live origin calls. Odds are never requested.
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
  CALIBRATION_AWAY_BASE,
  CALIBRATION_HOME_BASE,
  collectPilotDataset,
  createDefaultEloPolicies,
  evaluatePilotRows,
  loadCalibrationDataset,
  PILOT_LEAGUE_ID,
  PILOT_LOGICAL_CALL_CEILING,
  PILOT_SEASON,
  PILOT_SELECTION_ALGORITHM,
  PILOT_TARGET_COUNT,
  planPilotLogicalCalls,
  reconstructTeamRecord,
  runAuthorizedPilot,
} from "@/lib/debug/calibration";
import { CallBudgetExceededError } from "@/lib/debug/calibration/live-guard";
import { assertLiveCollectionAuthorized } from "@/lib/debug/calibration/live-guard";
import { LiveCollectionGuardError } from "@/lib/debug/calibration/live-guard";
import { contributingPriorFixtures } from "@/lib/debug/calibration/leakage";
import {
  allocatedPilotBucketCounts,
  desiredPilotBucketAllocation,
  selectPilotRows,
} from "@/lib/debug/calibration/select-pilot";
import { reconstructionFixtureFromVendor } from "@/lib/debug/calibration/vendor-map";
import type { FixtureSeasonTransport } from "@/lib/debug/calibration/fetch-season";
import type { ReconstructionFixture } from "@/lib/debug/calibration/types";

function vendorItem(input: {
  id: number;
  kickoff: string;
  status: string;
  homeId: number;
  awayId: number;
  goalsHome: number | null;
  goalsAway: number | null;
  fulltimeHome?: number | null;
  fulltimeAway?: number | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
}): ApiFootballFixtureItem {
  return {
    fixture: {
      id: input.id,
      date: input.kickoff,
      status: { short: input.status },
    },
    league: {
      id: Number(PILOT_LEAGUE_ID),
      name: "Premier League",
      season: Number(PILOT_SEASON),
    },
    teams: {
      home: { id: input.homeId, name: `Home ${input.homeId}` },
      away: { id: input.awayId, name: `Away ${input.awayId}` },
    },
    goals: { home: input.goalsHome, away: input.goalsAway },
    score: {
      fulltime: {
        home: input.fulltimeHome ?? input.goalsHome,
        away: input.fulltimeAway ?? input.goalsAway,
      },
      penalty:
        input.penaltyHome != null && input.penaltyAway != null
          ? { home: input.penaltyHome, away: input.penaltyAway }
          : null,
    },
  };
}

function seasonPayload(
  items: ApiFootballFixtureItem[],
): ApiFootballFixturesResponse {
  return {
    get: "fixtures",
    results: items.length,
    paging: { current: 1, total: 1 },
    response: items,
  };
}

/** 20 teams, one matchday each, 10 matches per day. Day 0 → evidence 0. */
function roundRobinSeason(matchdays: number): ApiFootballFixtureItem[] {
  const teamCount = 20;
  const start = Date.parse("2024-08-16T15:00:00.000Z");
  const items: ApiFootballFixtureItem[] = [];
  let id = 5000;
  for (let day = 0; day < matchdays; day += 1) {
    const kickoff = new Date(start + day * 7 * 86_400_000).toISOString();
    for (let pair = 0; pair < teamCount / 2; pair += 1) {
      const homeId = ((pair * 2 + day) % teamCount) + 1;
      const awayId = ((pair * 2 + 1 + day) % teamCount) + 1;
      items.push(
        vendorItem({
          id: id,
          kickoff,
          status: "FT",
          homeId,
          awayId,
          goalsHome: (day + pair) % 3,
          goalsAway: (day + pair + 1) % 2,
        }),
      );
      id += 1;
    }
  }
  return items;
}

function transportFromSeason(
  payload: ApiFootballFixturesResponse,
): FixtureSeasonTransport & { calls: string[]; oddsCalls: number } {
  const calls: string[] = [];
  return {
    calls,
    oddsCalls: 0,
    async getFixtures(league, season) {
      calls.push(`fixtures:${league}:${season}`);
      return payload;
    },
  };
}

describe("Sprint 5B.4 — live guard and call budget", () => {
  it("cannot run without explicit live opt-in and does not touch the transport", async () => {
    expect(() => assertLiveCollectionAuthorized({}, [])).toThrow(
      LiveCollectionGuardError,
    );
    const transport = transportFromSeason(seasonPayload(roundRobinSeason(4)));
    await expect(
      runAuthorizedPilot({
        env: {},
        argv: [],
        transport,
      }),
    ).rejects.toBeInstanceOf(LiveCollectionGuardError);
    expect(transport.calls).toEqual([]);
  });

  it("plans exactly one fixture-list logical lookup and forbids odds", () => {
    expect(planPilotLogicalCalls().plannedLogicalCalls).toBe(1);
    expect(planPilotLogicalCalls().ceiling).toBe(PILOT_LOGICAL_CALL_CEILING);
    expect(() => planPilotLogicalCalls({ includeOdds: true })).toThrow(
      CallBudgetExceededError,
    );
  });
});

describe("Sprint 5B.4 — stratified selection", () => {
  it("allocates remainder to 0 then 1-3 and redistributes short buckets without duplication", () => {
    expect(desiredPilotBucketAllocation(150)).toEqual({
      "0": 38,
      "1-3": 38,
      "4-9": 37,
      "10+": 37,
    });
    expect(
      allocatedPilotBucketCounts(
        { "0": 10, "1-3": 30, "4-9": 60, "10+": 60 },
        150,
      ),
    ).toEqual({
      "0": 10,
      "1-3": 30,
      "4-9": 60,
      "10+": 50,
    });
  });

  it("selects 150 unique rows across all evidence buckets from a 160-match season", async () => {
    const transport = transportFromSeason(seasonPayload(roundRobinSeason(16)));
    const result = await collectPilotDataset({
      transport,
      generatedAt: "2026-09-19T12:00:00.000Z",
    });
    expect(transport.calls).toEqual(["fixtures:39:2024"]);
    expect(result.logicalCallCount).toBe(1);
    expect(result.population.length).toBe(160);
    expect(result.rows).toHaveLength(PILOT_TARGET_COUNT);
    expect(new Set(result.rows.map((row) => row.fixtureId)).size).toBe(150);
    expect(result.metadata.fullPopulationEvidenceBuckets).toEqual({
      "0": 10,
      "1-3": 30,
      "4-9": 60,
      "10+": 60,
    });
    expect(result.metadata.selectedEvidenceBuckets).toEqual({
      "0": 10,
      "1-3": 30,
      "4-9": 60,
      "10+": 50,
    });
    expect(result.metadata.oddsRequested).toBe(false);
    expect(result.metadata.oddsLogicalCalls).toBe(0);
    expect(result.metadata.selectionAlgorithm).toBe(PILOT_SELECTION_ALGORITHM);
    expect(result.metadata.leakageViolationCount).toBe(0);
  });

  it("is deterministic and invariant to input order", async () => {
    const items = roundRobinSeason(16);
    const first = await collectPilotDataset({
      transport: transportFromSeason(seasonPayload(items)),
      generatedAt: "2026-09-19T12:00:00.000Z",
    });
    const reversed = await collectPilotDataset({
      transport: transportFromSeason(seasonPayload([...items].reverse())),
      generatedAt: "2026-09-19T12:00:00.000Z",
    });
    expect(first.rows.map((row) => row.fixtureId)).toEqual(
      reversed.rows.map((row) => row.fixtureId),
    );
    const again = selectPilotRows(first.population, 150);
    expect(again.selected.map((row) => row.fixtureId)).toEqual(
      first.rows.map((row) => row.fixtureId),
    );
  });
});

describe("Sprint 5B.4 — zero-evidence and leakage", () => {
  it("gives opening-day teams zero priors and role-base Elo only", async () => {
    const result = await collectPilotDataset({
      transport: transportFromSeason(seasonPayload(roundRobinSeason(16))),
    });
    const opening = result.population.filter(
      (row) => row.homePlayedBefore === 0 && row.awayPlayedBefore === 0,
    );
    expect(opening.length).toBe(10);
    const policies = createDefaultEloPolicies();
    expect(policies.map((policy) => policy.id)).toEqual([
      "current_catalogue",
      "base_prior",
      "linear_shrinkage",
      "exponential_shrinkage",
      "pseudo_match_bayesian",
      "shrinkage_plus_cap",
    ]);
    for (const row of opening) {
      expect(row.homeWinsBefore).toBe(0);
      expect(row.homeGfBefore).toBe(0);
      expect(row.homeGaBefore).toBe(0);
      expect(row.awayWinsBefore).toBe(0);
      for (const policy of policies) {
        expect(policy.resolve(row, "home").elo).toBe(CALIBRATION_HOME_BASE);
        expect(policy.resolve(row, "away").elo).toBe(CALIBRATION_AWAY_BASE);
      }
    }
  });

  it("does not let same-kickoff siblings contribute to each other", () => {
    const kickoff = "2025-05-25T15:00:00.000Z";
    const left: ReconstructionFixture = {
      fixtureId: "sk-left",
      kickoff,
      competitionId: PILOT_LEAGUE_ID,
      season: PILOT_SEASON,
      homeTeamId: "1",
      awayTeamId: "2",
      status: "FT",
      goalsHome: 9,
      goalsAway: 0,
      fulltimeHome: 9,
      fulltimeAway: 0,
    };
    const right: ReconstructionFixture = {
      fixtureId: "sk-right",
      kickoff,
      competitionId: PILOT_LEAGUE_ID,
      season: PILOT_SEASON,
      homeTeamId: "1",
      awayTeamId: "3",
      status: "FT",
      goalsHome: 0,
      goalsAway: 8,
      fulltimeHome: 0,
      fulltimeAway: 8,
    };
    const fixtures = [right, left];
    const leftRecord = reconstructTeamRecord({
      teamId: "1",
      kickoff,
      competitionId: PILOT_LEAGUE_ID,
      season: PILOT_SEASON,
      fixtures,
    });
    const rightPriors = contributingPriorFixtures({
      teamId: "1",
      kickoff,
      competitionId: PILOT_LEAGUE_ID,
      season: PILOT_SEASON,
      fixtures,
    });
    expect(leftRecord.played).toBe(0);
    expect(rightPriors.map((row) => row.fixtureId)).toEqual([]);
  });

  it("uses PEN full-time goals, not shootout totals", () => {
    const mapped = reconstructionFixtureFromVendor(
      vendorItem({
        id: 77,
        kickoff: "2024-09-01T15:00:00.000Z",
        status: "PEN",
        homeId: 1,
        awayId: 2,
        goalsHome: 1,
        goalsAway: 1,
        fulltimeHome: 1,
        fulltimeAway: 1,
        penaltyHome: 5,
        penaltyAway: 4,
      }),
    );
    expect(mapped.fulltimeHome).toBe(1);
    expect(mapped.fulltimeAway).toBe(1);
  });
});

describe("Sprint 5B.4 — evaluation diagnostics and artifacts", () => {
  it("evaluates six policies with bucket, home-advantage, confidence, and Elo-gap diagnostics", async () => {
    const result = await collectPilotDataset({
      transport: transportFromSeason(seasonPayload(roundRobinSeason(16))),
    });
    const report = evaluatePilotRows(result.rows);
    expect(report.scores).toHaveLength(result.rows.length * 6);
    expect(report.bookmakerMetrics.n).toBe(0);
    const policyIds = [...new Set(report.scores.map((score) => score.policyId))];
    expect(policyIds).toHaveLength(6);
    const overall = report.diagnostics.slices.filter((slice) => slice.scope === "all");
    expect(overall).toHaveLength(6);
    for (const slice of overall) {
      expect(slice.metrics.n).toBe(result.rows.length);
      expect(Number.isFinite(slice.metrics.logLoss)).toBe(true);
      expect(Number.isFinite(slice.metrics.brier)).toBe(true);
      expect(Number.isFinite(slice.metrics.ece)).toBe(true);
      expect(Number.isFinite(slice.metrics.accuracy)).toBe(true);
      expect(slice.observedRate.n).toBe(result.rows.length);
      expect(Number.isFinite(slice.predictionBias.home)).toBe(true);
      expect(Number.isFinite(slice.meanConfidence)).toBe(true);
      expect(
        slice.confidenceBandCounts.low +
          slice.confidenceBandCounts.medium +
          slice.confidenceBandCounts.high,
      ).toBe(result.rows.length);
      expect(slice.eloGap.n).toBe(result.rows.length);
      expect(slice.eloGap.maxAbs).toBeGreaterThanOrEqual(slice.eloGap.p90Abs);
    }
    const bucketSlices = report.diagnostics.slices.filter((slice) => slice.scope !== "all");
    expect(bucketSlices.some((slice) => slice.n > 0 && slice.scope === "0")).toBe(true);
  });

  it("writes a pilot artifact without secrets and reloads offline", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-pilot-"));
    const collected = await collectPilotDataset({
      transport: transportFromSeason(seasonPayload(roundRobinSeason(16))),
      writeArtifacts: true,
      artifactDirectory: directory,
      generatedAt: "2026-09-19T12:00:00.000Z",
    });
    expect(collected.paths!.samplePath).toContain(".sample.jsonl");
    expect(collected.paths!.populationPath).toContain(".population.jsonl");
    const raw = readFileSync(collected.paths!.metadataPath, "utf8");
    expect(raw).not.toMatch(/api[_-]?key/i);
    expect(raw).toContain("\"oddsRequested\": false");
    const loaded = loadCalibrationDataset(collected.paths!.samplePath);
    expect(loaded).toHaveLength(150);
    const report = evaluatePilotRows(loaded);
    expect(report.scores).toHaveLength(900);
    expect(readdirSync(directory).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("never calls odds and issues a single unpaged fixture lookup", async () => {
    const transport = transportFromSeason(seasonPayload(roundRobinSeason(8)));
    const result = await collectPilotDataset({
      transport,
      requestedTargetCount: 40,
    });
    expect(transport.calls).toEqual(["fixtures:39:2024"]);
    expect(result.logicalCallCount).toBe(1);
    expect(result.metadata.oddsRequested).toBe(false);
    expect(result.rows.every((row) => row.homeOdds == null)).toBe(true);
  });
});
