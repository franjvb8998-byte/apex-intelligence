/**
 * GOALS-1G.1 — Market calibration audit tests (no calibrator fitting).
 */

import { describe, expect, it } from "vitest";
import {
  digestGoalsMcalProtocol,
  GOALS_MCAL_CANONICAL_MARKETS,
  GOALS_MCAL_PARENT_G1_K,
  GOALS_MCAL_PARENT_G1_PROTOCOL_DIGEST,
  GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST,
  goalsMcalProtocol,
} from "@/lib/debug/calibration/goals/market-calibration/protocol";
import {
  assertG1MarketCoherence,
  buildCanonicalObservations,
  deriveUnder05,
} from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  clipLogitP,
  ece,
  logisticCalibrationDiagnostic,
  logit,
  marketCalibrationMetrics,
  reliabilityDiagram,
} from "@/lib/debug/calibration/goals/market-calibration/metrics";
import { bootstrapCitlByMarket } from "@/lib/debug/calibration/goals/market-calibration/bootstrap";
import { classifyTemporalStability } from "@/lib/debug/calibration/goals/market-calibration/temporal";
import { runGoalsMarketCalibrationAudit } from "@/lib/debug/calibration/goals/market-calibration/evaluate";
import { digestGoalsG1Protocol, goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { predictG1FromEvidence } from "@/lib/debug/calibration/goals/g1/predict";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { binaryBrier } from "@/lib/debug/calibration/goals/g0/metrics";

function fx(
  partial: Partial<GoalsHistoricalFixture> &
    Pick<
      GoalsHistoricalFixture,
      "fixtureId" | "kickoffUtc" | "homeTeamId" | "awayTeamId"
    >,
): GoalsHistoricalFixture {
  return applyRegulationToFixture({
    status: "FT",
    competitionId: "39",
    season: "2023",
    sourceGoalsHome: 1,
    sourceGoalsAway: 1,
    sourceFulltimeHome: 1,
    sourceFulltimeAway: 1,
    ...partial,
  });
}

describe("GOALS-1G.1 protocol", () => {
  it("deterministic digest and G1 k=10 pin", () => {
    expect(digestGoalsMcalProtocol()).toBe(
      digestGoalsMcalProtocol(goalsMcalProtocol()),
    );
    expect(GOALS_MCAL_PARENT_G1_K).toBe(10);
    expect(GOALS_MCAL_PARENT_G1_PROTOCOL_DIGEST).toBe(
      digestGoalsG1Protocol(goalsG1Protocol(10)),
    );
    expect(GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST).toBe(
      "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95",
    );
    expect(goalsMcalProtocol().noCalibratorFitting).toBe(true);
    expect(goalsMcalProtocol().noDixonColes).toBe(true);
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(GOALS_MCAL_CANONICAL_MARKETS).toHaveLength(12);
  });
});

describe("GOALS-1G.1 observations and coherence", () => {
  it("unique observations, complements, monotonicity, O/U0.5==0-0", () => {
    const f1 = fx({
      fixtureId: "1",
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
      sourceFulltimeHome: 2,
      sourceFulltimeAway: 1,
      sourceGoalsHome: 2,
      sourceGoalsAway: 1,
    });
    const f2 = fx({
      fixtureId: "2",
      kickoffUtc: "2023-08-18T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "B",
    });
    const evidence = buildGoalsTargetEvidence({
      target: f2,
      universe: [f1, f2],
    });
    const pred = predictG1FromEvidence(evidence, 10);
    assertG1MarketCoherence(pred);
    const obs = buildCanonicalObservations([pred]);
    expect(obs).toHaveLength(12);
    const keys = new Set(obs.map((o) => `${o.fixtureId}|${o.market}`));
    expect(keys.size).toBe(12);
    const o05 = obs.find((o) => o.market === "MATCH_TOTAL_OVER_0_5")!;
    const u = deriveUnder05(o05);
    expect(u.rawProbability).toBeCloseTo(1 - o05.rawProbability, 12);
    expect(u.rawProbability).toBeCloseTo(
      Math.exp(-(pred.muHome! + pred.muAway!)),
      10,
    );
    expect(Math.abs(o05.rawProbability + o05.complementProbability - 1)).toBeLessThan(
      1e-12,
    );
  });
});

describe("GOALS-1G.1 metrics", () => {
  it("reliability bins, CITL, Brier, ECE, logit clip, logistic diagnostic", () => {
    const f1 = fx({
      fixtureId: "1",
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
    });
    const rows = [];
    for (let i = 0; i < 12; i += 1) {
      rows.push(
        fx({
          fixtureId: `m${i}`,
          kickoffUtc: `2023-08-${String(12 + i).padStart(2, "0")}T15:00:00.000Z`,
          homeTeamId: i % 2 === 0 ? "H" : "A",
          awayTeamId: i % 2 === 0 ? "A" : "H",
          sourceFulltimeHome: i % 3,
          sourceFulltimeAway: (i + 1) % 2,
          sourceGoalsHome: i % 3,
          sourceGoalsAway: (i + 1) % 2,
        }),
      );
    }
    const universe = [f1, ...rows];
    const preds = rows.map((t) =>
      predictG1FromEvidence(
        buildGoalsTargetEvidence({ target: t, universe }),
        10,
      ),
    );
    const obs = buildCanonicalObservations(preds);
    const m = marketCalibrationMetrics("MATCH_TOTAL_OVER_2_5", obs);
    expect(m.n).toBeGreaterThan(0);
    expect(m.calibrationInTheLarge).toBeCloseTo(
      m.actualRate - m.meanPredicted,
      12,
    );
    expect(binaryBrier(0.25, 0)).toBeCloseTo(0.0625, 10);
    const bins = reliabilityDiagram(
      obs.filter((o) => o.market === "MATCH_TOTAL_OVER_2_5"),
    );
    expect(bins).toHaveLength(10);
    expect(ece(bins, m.n)).toBeGreaterThanOrEqual(0);
    expect(clipLogitP(0)).toBeGreaterThan(0);
    expect(logit(0.5)).toBeCloseTo(0, 10);
    const diag = logisticCalibrationDiagnostic(
      obs.filter((o) => o.market === "MATCH_TOTAL_OVER_2_5"),
    );
    expect(diag.note).toContain("diagnostic_only");
  });

  it("bootstrap and temporal classification deterministic", () => {
    const f1 = fx({
      fixtureId: "1",
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
      sourceFulltimeHome: 1,
      sourceFulltimeAway: 0,
      sourceGoalsHome: 1,
      sourceGoalsAway: 0,
    });
    const preds = [];
    for (let i = 0; i < 20; i += 1) {
      const t = fx({
        fixtureId: `t${i}`,
        kickoffUtc: `2023-08-${String(12 + (i % 18)).padStart(2, "0")}T15:00:00.000Z`,
        homeTeamId: "H",
        awayTeamId: "A",
        sourceFulltimeHome: i % 4,
        sourceFulltimeAway: i % 3,
        sourceGoalsHome: i % 4,
        sourceGoalsAway: i % 3,
      });
      preds.push(
        predictG1FromEvidence(
          buildGoalsTargetEvidence({ target: t, universe: [f1, t] }),
          10,
        ),
      );
    }
    const obs = buildCanonicalObservations(preds);
    const a = bootstrapCitlByMarket(obs, undefined, 20240924, 30);
    const b = bootstrapCitlByMarket(obs, undefined, 20240924, 30);
    expect(a.markets[0]!.mean).toBe(b.markets[0]!.mean);

    const support = {
      market: "MATCH_TOTAL_OVER_2_5" as const,
      n: 100,
      positives: 50,
      negatives: 50,
      positiveRate: 0.5,
      meanPredicted: 0.5,
      minPredicted: 0.2,
      maxPredicted: 0.8,
      p05: 0.2,
      p25: 0.4,
      p50: 0.5,
      p75: 0.6,
      p95: 0.8,
      uniqueProbabilityCount: 10,
      rareEvent: false,
    };
    const mGood = {
      market: "MATCH_TOTAL_OVER_2_5" as const,
      n: 100,
      logLoss: 0.6,
      brier: 0.2,
      meanPredicted: 0.5,
      actualRate: 0.51,
      calibrationInTheLarge: 0.01,
      ece: 0.02,
      maxAbsBinGap: 0.05,
      maxAbsBinGapN: 20,
      reliability: [],
    };
    const t = classifyTemporalStability(support, support, mGood, mGood);
    expect(t.classification).toBe("STABLE_GOOD");
  });
});

describe("GOALS-1G.1 holdout", () => {
  it("rejects 2025", () => {
    const holdout = fx({
      fixtureId: "h",
      kickoffUtc: "2025-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
      season: "2025",
    });
    expect(() =>
      runGoalsMarketCalibrationAudit({
        evidenceRows: [
          buildGoalsTargetEvidence({ target: holdout, universe: [holdout] }),
        ],
        evidenceDatasetDigest: GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST,
      }),
    ).toThrow(/Holdout/);
  });
});
