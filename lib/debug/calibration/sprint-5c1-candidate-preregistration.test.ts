/**
 * Sprint 5C.1 — prospective candidate pre-registration.
 * Synthetic fixtures only. Zero live origin calls. No historical scoring.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EloPoissonHybridEngine } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { createCurrentCataloguePolicy } from "@/lib/debug/calibration/policies";
import { resolveMatchElos } from "@/lib/debug/calibration/ig-5b11-formula";
import {
  applyHighEqualTransfer,
  buildControlGrid,
  summarizeCells,
} from "@/lib/debug/calibration/lm-5b16-formula";
import { TRANSFER_HIGH_EQUAL_RELATIVE } from "@/lib/debug/calibration/lm-5b16-shape";
import { createSyntheticCalibrationRows } from "@/lib/debug/calibration/synthetic";
import {
  CANDIDATE_ARMS,
  CANDIDATE_MANIFEST,
  CANDIDATE_MANIFEST_FINGERPRINT,
  HistoricalFirewallError,
  PRIMARY_PROSPECTIVE_METRICS,
  PRODUCTION_BASE_COMMIT,
  PROSPECTIVE_CANDIDATE_IDS,
  PROSPECTIVE_CHECKPOINTS,
  PROSPECTIVE_PROMOTION_RULES,
  USED_HISTORICAL_SEASONS,
  assertExactlyFiveArms,
  assertNotHistoricalOutcomeDataset,
  assertNotUsedHistoricalSeason,
  capturePrediction,
  candidateArm,
  predictCandidate,
  resolveCandidateElos,
  sortDeterministic,
} from "@/lib/debug/calibration";
import type { ProspectiveEvidence } from "@/lib/debug/calibration/prospective/candidate-types";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

function evidenceFromSynthetic(row: CalibrationRow, fixtureId = row.fixtureId): ProspectiveEvidence {
  return {
    fixtureId,
    competitionId: "unseen-test",
    season: "UNSEEN-TEST",
    kickoff: "2099-08-17T15:00:00.000Z",
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    homePlayedBefore: row.homePlayedBefore,
    homeWinsBefore: row.homeWinsBefore,
    homeGfBefore: row.homeGfBefore,
    homeGaBefore: row.homeGaBefore,
    awayPlayedBefore: row.awayPlayedBefore,
    awayWinsBefore: row.awayWinsBefore,
    awayGfBefore: row.awayGfBefore,
    awayGaBefore: row.awayGaBefore,
    evidenceAsOf: "2099-08-16T12:00:00.000Z",
  };
}

function readSources(): string {
  return [
    "lib/debug/calibration/prospective/candidate-config.ts",
    "lib/debug/calibration/prospective/candidate-engine.ts",
    "lib/debug/calibration/prospective/candidate-record.ts",
    "lib/debug/calibration/prospective/candidate-integrity.ts",
    "lib/debug/calibration/prospective/candidate-input.ts",
    "lib/debug/calibration/prospective/candidate-transform.ts",
    "lib/debug/calibration/prospective/candidate-high-equal.ts",
    "lib/debug/calibration/prospective/candidate-types.ts",
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("Sprint 5C.1 — candidate pre-registration", () => {
  it("freezes production, five arms, and the historical firewall", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(PRODUCTION_BASE_COMMIT).toBe("967b541f3947a4f9cfe0d1fe5eea57f3de880f62");
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect(DEFAULT_HYBRID_CONFIG.poissonBlendWeight).toBe(0.7);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect(DEFAULT_HYBRID_CONFIG.baseHomeGoals).toBe(1.45);
    expect(DEFAULT_HYBRID_CONFIG.baseAwayGoals).toBe(1.15);
    expect([...PROSPECTIVE_CANDIDATE_IDS]).toEqual([
      "CONTROL_PRODUCTION",
      "CANDIDATE_A_INPUT",
      "CANDIDATE_B_TRANSFORM",
      "CANDIDATE_C_COMBINED",
      "CANDIDATE_D_COMBINED_HIGH_EQUAL",
    ]);
    assertExactlyFiveArms();
    expect(CANDIDATE_ARMS).toHaveLength(5);
    expect([...USED_HISTORICAL_SEASONS]).toEqual(["2023", "2024", "2025"]);
    expect([...PROSPECTIVE_CHECKPOINTS]).toEqual([100, 250, 500]);
    expect([...PRIMARY_PROSPECTIVE_METRICS]).toEqual(["logLoss", "brier", "ece"]);
    expect(PROSPECTIVE_PROMOTION_RULES.noCombinedWinnerScore).toBe(true);
    expect(CANDIDATE_MANIFEST.productionBaseCommit).toBe(PRODUCTION_BASE_COMMIT);
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toMatch(/^[a-f0-9]{64}$/);
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(CANDIDATE_MANIFEST_FINGERPRINT);
  });

  it("reproduces CONTROL parity and exact A/B/C/D differences on synthetic fixtures", () => {
    const row = createSyntheticCalibrationRows()[1]!;
    const evidence = evidenceFromSynthetic(row);
    const policy = createCurrentCataloguePolicy();
    const productionElos = {
      homeElo: policy.resolve(row, "home").elo,
      awayElo: policy.resolve(row, "away").elo,
    };
    const production = new EloPoissonHybridEngine().predict({
      homeElo: productionElos.homeElo,
      awayElo: productionElos.awayElo,
      matchId: evidence.fixtureId,
    });
    const control = predictCandidate("CONTROL_PRODUCTION", evidence);
    expect(control.homeElo).toBe(productionElos.homeElo);
    expect(control.awayElo).toBe(productionElos.awayElo);
    expect(control.lambdaHome).toBe(production.expectedGoals.home);
    expect(control.lambdaAway).toBe(production.expectedGoals.away);
    expect(control.oneXTwo.home).toBeCloseTo(production.oneXTwo.home, 12);
    expect(control.oneXTwo.draw).toBeCloseTo(production.oneXTwo.draw, 12);
    expect(control.oneXTwo.away).toBeCloseTo(production.oneXTwo.away, 12);
    expect(control.eloGoalScale).toBe(400);
    expect(resolveCandidateElos("PRODUCTION_C0", evidence)).toEqual(resolveMatchElos("C0", row));

    const a = predictCandidate("CANDIDATE_A_INPUT", evidence);
    expect(resolveCandidateElos("C7_EQUAL_BASE_SHRINKAGE_GD_RATE", evidence)).toEqual(
      resolveMatchElos("C7", row),
    );
    expect(a.homeElo).toBe(resolveMatchElos("C7", row).homeElo);
    expect(a.awayElo).toBe(resolveMatchElos("C7", row).awayElo);
    expect(a.eloGoalScale).toBe(400);
    expect(a.highEqualPolicy).toBe("NONE");
    expect(a.homeElo !== control.homeElo || a.awayElo !== control.awayElo).toBe(true);

    const b = predictCandidate("CANDIDATE_B_TRANSFORM", evidence);
    expect(b.homeElo).toBe(control.homeElo);
    expect(b.awayElo).toBe(control.awayElo);
    expect(b.eloGoalScale).toBe(600);
    expect(b.inputPolicy).toBe("PRODUCTION_C0");
    const s600 = new EloPoissonHybridEngine({ eloGoalScale: 600 }).predict({
      homeElo: productionElos.homeElo,
      awayElo: productionElos.awayElo,
    });
    expect(b.lambdaHome).toBe(s600.expectedGoals.home);
    expect(b.oneXTwo.home).toBeCloseTo(s600.oneXTwo.home, 12);

    const c = predictCandidate("CANDIDATE_C_COMBINED", evidence);
    expect(c.homeElo).toBe(a.homeElo);
    expect(c.awayElo).toBe(a.awayElo);
    expect(c.eloGoalScale).toBe(b.eloGoalScale);
    expect(c.highEqualPolicy).toBe("NONE");

    const d = predictCandidate("CANDIDATE_D_COMBINED_HIGH_EQUAL", evidence);
    expect(d.homeElo).toBe(c.homeElo);
    expect(d.awayElo).toBe(c.awayElo);
    expect(d.eloGoalScale).toBe(600);
    expect(d.highEqualPolicy).toBe("T1_PLUS_10_PERCENT_FROM_NON_DRAW");
    expect(TRANSFER_HIGH_EQUAL_RELATIVE).toBe(0.1);
    const grid = buildControlGrid(c.lambdaHome, c.lambdaAway);
    const transferred = applyHighEqualTransfer(grid);
    expect(Math.abs(transferred.cells[0]![0]! - grid.cells[0]![0]!)).toBeLessThan(1e-12);
    expect(Math.abs(transferred.cells[1]![1]! - grid.cells[1]![1]!)).toBeLessThan(1e-12);
    const t1 = summarizeCells(transferred.cells);
    expect(d.oneXTwo.draw).not.toBeCloseTo(c.oneXTwo.draw, 12);
    expect(t1.p00).toBeGreaterThan(0);
    expect(candidateArm("CANDIDATE_B_TRANSFORM").eloGoalScale).toBe(600);
    expect(candidateArm("CANDIDATE_A_INPUT").inputPolicy).toBe("C7_EQUAL_BASE_SHRINKAGE_GD_RATE");
  });

  it("captures immutable unscored records with leakage and firewall guards", () => {
    const row = createSyntheticCalibrationRows()[1]!;
    const evidence = evidenceFromSynthetic(row, "unseen-a");
    const seen = new Set<string>();
    const record = capturePrediction({
      evidence,
      capturedAt: "2099-08-16T18:00:00.000Z",
      candidateId: "CONTROL_PRODUCTION",
    });
    expect(record.resultStatus).toBe("PENDING");
    expect(record.finalHomeGoals).toBeNull();
    expect(record.finalAwayGoals).toBeNull();
    expect(record.scoredAt).toBeNull();
    expect(record.odds).toBeNull();
    expect(record.marketImpliedProbabilities).toBeNull();
    expect(record.candidateFingerprint).toBe(CANDIDATE_MANIFEST_FINGERPRINT);
    expect(record.probHome + record.probDraw + record.probAway).toBeCloseTo(1, 12);
    expect([record.probHome, record.probDraw, record.probAway].every(Number.isFinite)).toBe(true);

    const withOdds = capturePrediction({
      evidence: evidenceFromSynthetic(row, "unseen-b"),
      capturedAt: "2099-08-16T18:00:00.000Z",
      candidateId: "CANDIDATE_A_INPUT",
      odds: { home: 2.1, draw: 3.4, away: 3.6 },
    });
    expect(withOdds.odds).toEqual({ home: 2.1, draw: 3.4, away: 3.6 });
    expect(withOdds.marketImpliedProbabilities).not.toBeNull();

    expect(() =>
      capturePrediction({
        evidence,
        capturedAt: "2099-08-16T18:00:00.000Z",
        candidateId: "CONTROL_PRODUCTION",
      }, seen),
    ).not.toThrow();
    expect(() =>
      capturePrediction({
        evidence,
        capturedAt: "2099-08-16T18:00:00.000Z",
        candidateId: "CONTROL_PRODUCTION",
      }, seen),
    ).toThrow(/duplicate/);

    expect(() =>
      capturePrediction({
        evidence: { ...evidence, kickoff: "2099-08-16T10:00:00.000Z" },
        capturedAt: "2099-08-16T18:00:00.000Z",
        candidateId: "CANDIDATE_B_TRANSFORM",
      }),
    ).toThrow(/kickoff/);
    expect(() =>
      capturePrediction({
        evidence: { ...evidence, evidenceAsOf: "2099-08-18T00:00:00.000Z" },
        capturedAt: "2099-08-16T18:00:00.000Z",
        candidateId: "CANDIDATE_C_COMBINED",
      }),
    ).toThrow(/evidenceAsOf/);

    expect(() => assertNotUsedHistoricalSeason("2024")).toThrow(HistoricalFirewallError);
    expect(() =>
      assertNotHistoricalOutcomeDataset("data/calibration/validation-5b6-pl-2023-x.population.jsonl"),
    ).toThrow(HistoricalFirewallError);

    const sorted = sortDeterministic([
      { ...evidence, fixtureId: "b", kickoff: "2099-08-17T15:00:00.000Z" },
      { ...evidence, fixtureId: "a", kickoff: "2099-08-17T15:00:00.000Z" },
      { ...evidence, fixtureId: "c", kickoff: "2099-08-16T15:00:00.000Z" },
    ]);
    expect(sorted.map((item) => item.fixtureId)).toEqual(["c", "a", "b"]);
  });

  it("contains no network, odds collector, ranking, or historical-scoring helpers", () => {
    const source = readSources();
    expect(source).not.toMatch(/fetch\(|axios|API_FOOTBALL_KEY|createLive|getFixtureOdds/);
    expect(source).not.toMatch(/loadDrawForensics|evaluateSeasonLocalMass|evaluateSeasonTemporal/);
    expect(source).not.toMatch(/rankCandidates|pickWinner|bestCandidate|optimizeCandidate|gridSearch/);
    expect(source).not.toMatch(/winner helper|ranking helper/);
    expect(CANDIDATE_ARMS.every((arm) => arm.productionBaseCommit === PRODUCTION_BASE_COMMIT)).toBe(
      true,
    );
    const ids = CANDIDATE_ARMS.map((arm) => arm.candidateId);
    expect(new Set(ids).size).toBe(5);
  });
});
