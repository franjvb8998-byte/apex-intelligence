/**
 * Sprint 5B.5 — offline Elo × HA factorial experiment.
 * Zero live origin calls.
 */

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCurrentCataloguePolicy,
  createDefaultEloPolicies,
  createSyntheticCalibrationRows,
} from "@/lib/debug/calibration";
import {
  loadFrozenNaturalPopulation,
  persistedNatural380Exists,
  SPRINT_5B5_META_PATH,
  SPRINT_5B5_POPULATION_PATH,
} from "@/lib/debug/calibration/experiment-5b5-dataset";
import {
  evaluateFactorialExperiment,
  homeProbabilityCalibrationBins,
  scoreRowWithHaConfig,
} from "@/lib/debug/calibration/experiment-5b5-evaluate";
import {
  applyEqualizedRolePrior,
  assertProductionHybridConfigUnchanged,
  createExperimentalEngine,
  EXPERIMENT_HA_CONFIGS,
  EQUALIZED_ROLE_ELO,
  NEUTRAL_GOAL_BASELINE_N1,
  NEUTRAL_GOAL_BASELINE_N2,
  productionHaConstants,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import {
  buildExperiment5b5Report,
  writeExperiment5b5Artifact,
} from "@/lib/debug/calibration/experiment-5b5-report";
import { scoreRowWithPolicy } from "@/lib/debug/calibration/evaluate";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import { isValidOneXTwo } from "@/lib/debug/calibration/metrics";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

const HA0 = EXPERIMENT_HA_CONFIGS.find((config) => config.id === "HA0_PRODUCTION")!;

function league39(row: CalibrationRow, index: number): CalibrationRow {
  return {
    ...row,
    fixtureId: `39-${index}-${row.fixtureId}`,
    competitionId: "39",
    competitionName: "Premier League",
    season: "2024",
  };
}

describe("Sprint 5B.5 — offline factorial experiment", () => {
  it("loads the persisted natural 380 with zero network when present", () => {
    expect(persistedNatural380Exists()).toBe(true);
    const frozen = loadFrozenNaturalPopulation(
      SPRINT_5B5_POPULATION_PATH,
      SPRINT_5B5_META_PATH,
    );
    expect(frozen.verification.n).toBe(380);
    expect(frozen.verification.uniqueFixtureIds).toBe(380);
    expect(frozen.verification.leagueId).toBe("39");
    expect(frozen.verification.season).toBe("2024");
    expect(frozen.verification.leakageViolationCount).toBe(0);
    expect(frozen.verification.evidenceBuckets).toEqual({
      "0": 10,
      "1-3": 30,
      "4-9": 60,
      "10+": 280,
    });
    expect(frozen.verification.observedRates.home).toBeCloseTo(0.4079, 3);
    expect(frozen.verification.observedRates.draw).toBeCloseTo(0.2447, 3);
    expect(frozen.verification.observedRates.away).toBeCloseTo(0.3474, 3);
    expect(existsSync(SPRINT_5B5_POPULATION_PATH)).toBe(true);
  });

  it("computes N1/N2 neutrals from production baselines without outcome fitting", () => {
    const constants = productionHaConstants();
    expect(constants.roleHomeElo).toBe(1580);
    expect(constants.roleAwayElo).toBe(1520);
    expect(constants.homeAdvantageElo).toBe(65);
    expect(constants.baseHomeGoals).toBe(1.45);
    expect(constants.baseAwayGoals).toBe(1.15);
    expect(NEUTRAL_GOAL_BASELINE_N1).toBe((1.45 + 1.15) / 2);
    expect(NEUTRAL_GOAL_BASELINE_N2).toBe(Math.sqrt(1.45 * 1.15));
    expect(EQUALIZED_ROLE_ELO).toBe(1550);
    expect(constants.neutralGoalBaselineN1).toBe(NEUTRAL_GOAL_BASELINE_N1);
    expect(constants.neutralGoalBaselineN2).toBe(NEUTRAL_GOAL_BASELINE_N2);
  });

  it("keeps factorial evaluation deterministic", () => {
    const rows = createSyntheticCalibrationRows();
    const first = evaluateFactorialExperiment(rows);
    const second = evaluateFactorialExperiment(rows);
    expect(first.combinationCount).toBe(60);
    expect(JSON.stringify(first.cells)).toBe(JSON.stringify(second.cells));
    expect(JSON.stringify(first.componentDeltas)).toBe(
      JSON.stringify(second.componentDeltas),
    );
  });

  it("cannot mutate production hybrid defaults", () => {
    const before = snapshotDefaultHybridConfig();
    evaluateFactorialExperiment(createSyntheticCalibrationRows());
    assertProductionHybridConfigUnchanged(before);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect(DEFAULT_HYBRID_CONFIG.baseHomeGoals).toBe(1.45);
    expect(DEFAULT_HYBRID_CONFIG.baseAwayGoals).toBe(1.15);
  });

  it("keeps production catalogue 1X2 bit-for-bit before and after the experiment", () => {
    const rows = createSyntheticCalibrationRows();
    const policy = createCurrentCataloguePolicy();
    const before = rows.map((row) => scoreRowWithPolicy(row, policy).oneXTwo);
    const result = evaluateFactorialExperiment(rows, createDefaultEloPolicies());
    const after = rows.map((row) => scoreRowWithPolicy(row, policy).oneXTwo);
    expect(after).toEqual(before);
    expect(result.productionFingerprint).toEqual(before);
    const experimental = rows.map((row) =>
      scoreRowWithHaConfig({
        row,
        policy,
        ha: HA0,
        engine: createExperimentalEngine(HA0),
      }),
    );
    expect(experimental.map((score) => score.oneXTwo)).toEqual(before);
  });

  it("emits valid probability vectors, finite metrics, and consistent N", () => {
    const rows = createSyntheticCalibrationRows();
    const result = evaluateFactorialExperiment(rows);
    const overall = result.cells.filter((cell) => cell.scope === "all");
    expect(overall).toHaveLength(60);
    for (const cell of result.cells) {
      expect(Number.isFinite(cell.logLoss)).toBe(true);
      expect(Number.isFinite(cell.brier)).toBe(true);
      expect(Number.isFinite(cell.ece)).toBe(true);
      expect(isValidOneXTwo(cell.meanPredicted)).toBe(true);
      expect(
        Math.abs(cell.meanPredicted.home + cell.meanPredicted.draw + cell.meanPredicted.away - 1),
      ).toBeLessThan(1e-6);
      if (cell.scope === "all") {
        expect(cell.n).toBe(rows.length);
      }
    }
    for (const policy of createDefaultEloPolicies()) {
      for (const ha of EXPERIMENT_HA_CONFIGS) {
        const scoped = result.cells.filter(
          (cell) => cell.policyId === policy.id && cell.haId === ha.id && cell.scope !== "all",
        );
        const total = scoped.reduce((sum, cell) => sum + cell.n, 0);
        expect(total).toBe(rows.length);
      }
    }
  });

  it("preserves evidence buckets across combinations", () => {
    const rows = createSyntheticCalibrationRows();
    const expected = { "0": 0, "1-3": 0, "4-9": 0, "10+": 0 };
    for (const row of rows) expected[rowEvidenceBucket(row)] += 1;
    const result = evaluateFactorialExperiment(rows);
    for (const ha of EXPERIMENT_HA_CONFIGS) {
      const catalogue = result.cells.filter(
        (cell) => cell.policyId === "current_catalogue" && cell.haId === ha.id,
      );
      expect(catalogue.find((cell) => cell.scope === "0")?.n).toBe(expected["0"]);
      expect(catalogue.find((cell) => cell.scope === "1-3")?.n).toBe(expected["1-3"]);
      expect(catalogue.find((cell) => cell.scope === "4-9")?.n).toBe(expected["4-9"]);
      expect(catalogue.find((cell) => cell.scope === "10+")?.n).toBe(expected["10+"]);
    }
  });

  it("computes component deltas as variant minus production", () => {
    const rows = createSyntheticCalibrationRows();
    const result = evaluateFactorialExperiment(rows);
    const prod = result.cells.find(
      (cell) =>
        cell.policyId === "current_catalogue" &&
        cell.haId === "HA0_PRODUCTION" &&
        cell.scope === "all",
    )!;
    const equal = result.cells.find(
      (cell) =>
        cell.policyId === "current_catalogue" &&
        cell.haId === "HA1_EQUAL_ROLE_PRIORS" &&
        cell.scope === "all",
    )!;
    const delta = result.componentDeltas.find(
      (item) =>
        item.policyId === "current_catalogue" && item.contrastId === "equal_role_priors",
    )!;
    expect(delta.deltaHomePredictionMean).toBeCloseTo(
      equal.meanPredicted.home - prod.meanPredicted.home,
      12,
    );
    expect(delta.deltaHomeBias).toBeCloseTo(
      equal.predictionBias.home - prod.predictionBias.home,
      12,
    );
    expect(delta.deltaLogLoss).toBeCloseTo(equal.logLoss - prod.logLoss, 12);
    expect(delta.deltaBrier).toBeCloseTo(equal.brier - prod.brier, 12);
    expect(delta.deltaEce).toBeCloseTo(equal.ece - prod.ece, 12);
  });

  it("keeps home-probability calibration bins deterministic", () => {
    const rows = createSyntheticCalibrationRows().map(league39);
    const result = evaluateFactorialExperiment(rows);
    const cell = result.cells.find(
      (item) =>
        item.policyId === "current_catalogue" &&
        item.haId === "HA0_PRODUCTION" &&
        item.scope === "all",
    )!;
    expect(cell.homeCalibration).toHaveLength(10);
    const again = evaluateFactorialExperiment(rows).cells.find(
      (item) =>
        item.policyId === "current_catalogue" &&
        item.haId === "HA0_PRODUCTION" &&
        item.scope === "all",
    )!;
    expect(again.homeCalibration).toEqual(cell.homeCalibration);
    const byFixture = new Map(rows.map((row) => [row.fixtureId, row]));
    const scores = rows.map((row) =>
      scoreRowWithHaConfig({
        row,
        policy: createCurrentCataloguePolicy(),
        ha: HA0,
        engine: createExperimentalEngine(HA0),
      }),
    );
    expect(homeProbabilityCalibrationBins(scores, byFixture)).toEqual(cell.homeCalibration);
  });

  it("equalizes role priors by a constant offset and writes no secrets", () => {
    expect(applyEqualizedRolePrior(1725, "home", true)).toBe(1695);
    expect(applyEqualizedRolePrior(1435, "away", true)).toBe(1465);
    expect(applyEqualizedRolePrior(1725, "home", false)).toBe(1725);
    const rows = createSyntheticCalibrationRows().map(league39);
    const report = buildExperiment5b5Report({
      rows,
      generatedAt: "2026-09-19T06:00:00.000Z",
    });
    expect(report.datasetKind).toBe("NATURAL FULL POPULATION");
    expect(report.combinationCount).toBe(60);
    const directory = mkdtempSync(join(tmpdir(), "apex-5b5-"));
    const written = writeExperiment5b5Artifact({
      report,
      directory,
      generatedAt: "2026-09-19T06:00:00.000Z",
    });
    const body = readFileSync(written.path, "utf8");
    expect(body).not.toMatch(/api[_-]?key|x-apisports-key/i);
    expect(written.path).toContain("experiment-5b5-");
  });

  it("does not import live transport or odds helpers", async () => {
    const ha = readFileSync("lib/debug/calibration/experiment-5b5-ha.ts", "utf8");
    const evaluate = readFileSync("lib/debug/calibration/experiment-5b5-evaluate.ts", "utf8");
    const report = readFileSync("lib/debug/calibration/experiment-5b5-report.ts", "utf8");
    const dataset = readFileSync("lib/debug/calibration/experiment-5b5-dataset.ts", "utf8");
    for (const source of [ha, evaluate, report, dataset]) {
      expect(source).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY/);
    }
  });
});
