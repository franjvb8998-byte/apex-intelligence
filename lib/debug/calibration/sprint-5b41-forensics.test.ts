/**
 * Sprint 5B.4.1 — dual artifacts and home-advantage forensics.
 * Zero live origin calls.
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
  decomposeCatalogueElo,
  decomposeZeroEvidenceHomeAdvantage,
  evaluateNaturalFullPopulation,
  evaluateStratifiedDiagnosticSample,
  loadPilotArtifacts,
  NATURAL_FULL_POPULATION_LABEL,
  PILOT_LEAGUE_ID,
  PILOT_SEASON,
  productionHomeAdvantageComponents,
  reconstructTeamRecord,
  STRATIFIED_DIAGNOSTIC_SAMPLE_LABEL,
} from "@/lib/debug/calibration";
import { contributingPriorFixtures } from "@/lib/debug/calibration/leakage";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import type { FixtureSeasonTransport } from "@/lib/debug/calibration/fetch-season";
import type { ReconstructionFixture } from "@/lib/debug/calibration/types";

function vendorItem(input: {
  id: number;
  kickoff: string;
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
      fulltime: { home: input.goalsHome, away: input.goalsAway },
      penalty: null,
    },
  };
}

function roundRobinSeason(matchdays: number): ApiFootballFixtureItem[] {
  const teamCount = 20;
  const start = Date.parse("2024-08-16T15:00:00.000Z");
  const items: ApiFootballFixtureItem[] = [];
  let id = 7000;
  for (let day = 0; day < matchdays; day += 1) {
    const kickoff = new Date(start + day * 7 * 86_400_000).toISOString();
    for (let pair = 0; pair < teamCount / 2; pair += 1) {
      items.push(
        vendorItem({
          id,
          kickoff,
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

function transportFromSeason(
  items: ApiFootballFixtureItem[],
): FixtureSeasonTransport & { calls: string[] } {
  const payload: ApiFootballFixturesResponse = {
    get: "fixtures",
    results: items.length,
    paging: { current: 1, total: 1 },
    response: items,
  };
  const calls: string[] = [];
  return {
    calls,
    async getFixtures(league, season) {
      calls.push(`fixtures:${league}:${season}`);
      return payload;
    },
  };
}

describe("Sprint 5B.4.1 — dual population/sample artifacts", () => {
  it("persists full population and stratified sample separately and reloads both", async () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-pilot-dual-"));
    const transport = transportFromSeason(roundRobinSeason(16));
    const collected = await collectPilotDataset({
      transport,
      writeArtifacts: true,
      artifactDirectory: directory,
      generatedAt: "2026-09-19T13:00:00.000Z",
    });
    expect(transport.calls).toEqual(["fixtures:39:2024"]);
    expect(collected.paths!.populationPath).toContain(".population.jsonl");
    expect(collected.paths!.samplePath).toContain(".sample.jsonl");
    expect(collected.metadata.populationArtifact).toContain(".population.jsonl");
    expect(collected.metadata.sampleArtifact).toContain(".sample.jsonl");
    expect(collected.metadata.populationRowCount).toBe(collected.population.length);
    expect(collected.metadata.sampleRowCount).toBe(collected.rows.length);
    const loaded = loadPilotArtifacts(collected.paths!.metadataPath);
    expect(loaded.population).toHaveLength(collected.population.length);
    expect(loaded.sample).toHaveLength(150);
    expect(loaded.population.length).toBeGreaterThan(loaded.sample.length);
    const natural = evaluateNaturalFullPopulation(loaded.population);
    const stratified = evaluateStratifiedDiagnosticSample(loaded.sample);
    expect(natural.datasetKind).toBe(NATURAL_FULL_POPULATION_LABEL);
    expect(stratified.datasetKind).toBe(STRATIFIED_DIAGNOSTIC_SAMPLE_LABEL);
    expect(natural.datasetKind).not.toBe(stratified.datasetKind);
    expect(natural.diagnostics.slices[0]!.n).toBe(loaded.population.length);
    expect(stratified.diagnostics.slices[0]!.n).toBe(150);
    expect(readdirSync(directory).some((name) => name.endsWith(".tmp"))).toBe(false);
    expect(readFileSync(collected.paths!.metadataPath, "utf8")).not.toMatch(/api[_-]?key/i);
    expect(collected.metadata.oddsRequested).toBe(false);
  });

  it("is deterministic and never requests odds", async () => {
    const items = roundRobinSeason(16);
    const first = await collectPilotDataset({
      transport: transportFromSeason(items),
      generatedAt: "2026-09-19T13:00:00.000Z",
    });
    const second = await collectPilotDataset({
      transport: transportFromSeason([...items].reverse()),
      generatedAt: "2026-09-19T13:00:00.000Z",
    });
    expect(first.rows.map((row) => row.fixtureId)).toEqual(
      second.rows.map((row) => row.fixtureId),
    );
    expect(first.metadata.oddsLogicalCalls).toBe(0);
  });
});

describe("Sprint 5B.4.1 — leakage and zero-evidence remain protected", () => {
  it("keeps same-kickoff siblings out of priors", () => {
    const kickoff = "2025-05-25T15:00:00.000Z";
    const left: ReconstructionFixture = {
      fixtureId: "sk-a",
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
      fixtureId: "sk-b",
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
    expect(
      reconstructTeamRecord({
        teamId: "1",
        kickoff,
        competitionId: PILOT_LEAGUE_ID,
        season: PILOT_SEASON,
        fixtures: [right, left],
      }).played,
    ).toBe(0);
    expect(
      contributingPriorFixtures({
        teamId: "1",
        kickoff,
        competitionId: PILOT_LEAGUE_ID,
        season: PILOT_SEASON,
        fixtures: [left, right],
      }),
    ).toEqual([]);
  });

  it("resolves opening-day rows through role bases only", async () => {
    const result = await collectPilotDataset({
      transport: transportFromSeason(roundRobinSeason(16)),
    });
    const opening = result.population.filter(
      (row) => row.homePlayedBefore === 0 && row.awayPlayedBefore === 0,
    );
    expect(opening.length).toBeGreaterThan(0);
    const policies = createDefaultEloPolicies();
    for (const row of opening) {
      for (const policy of policies) {
        expect(policy.resolve(row, "home").elo).toBe(CALIBRATION_HOME_BASE);
        expect(policy.resolve(row, "away").elo).toBe(CALIBRATION_AWAY_BASE);
      }
    }
  });
});

describe("Sprint 5B.4.1 — home-advantage counterfactuals", () => {
  it("reads production HA components and does not mutate PE config", () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const components = productionHomeAdvantageComponents();
    expect(components).toEqual({
      roleHomeElo: 1580,
      roleAwayElo: 1520,
      roleEloGap: 60,
      homeAdvantageElo: 65,
      baseHomeGoals: 1.45,
      baseAwayGoals: 1.15,
      homeGoalsAdvantage: 1.0,
    });
    const table = decomposeZeroEvidenceHomeAdvantage();
    expect(table.production.homeElo).toBe(1580);
    expect(table.production.awayElo).toBe(1520);
    expect(table.CF2.config.homeAdvantageElo).toBe(0);
    expect(table.CF3.config.baseHomeGoals).toBe(table.CF3.config.baseAwayGoals);
    expect(table.CF5.homeElo).toBe(table.CF5.awayElo);
    expect(table.CF5.config.homeAdvantageElo).toBe(0);
    expect(table.CF5.config.baseHomeGoals).toBe(table.CF5.config.baseAwayGoals);
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
    expect(table.production.config.homeAdvantageElo).toBe(65);
  });

  it("decomposes the catalogue formula without changing it", () => {
    const oneWin = decomposeCatalogueElo({
      base: 1580,
      played: 1,
      wins: 1,
      goalsFor: 2,
      goalsAgainst: 0,
    });
    expect(oneWin.roleBase).toBe(1580);
    expect(oneWin.minus80).toBe(-80);
    expect(oneWin.winRateTerm).toBe(220);
    expect(oneWin.gdTerm).toBe(5);
    expect(oneWin.elo).toBe(1725);
    const oneLoss = decomposeCatalogueElo({
      base: 1520,
      played: 1,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 2,
    });
    expect(oneLoss.winRateTerm).toBe(0);
    expect(oneLoss.gdTerm).toBe(-5);
    expect(oneLoss.elo).toBe(1435);
  });
});
