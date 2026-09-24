/**
 * GOALS-1F.1 — Distributional audit tests (no model fitting).
 */

import { describe, expect, it } from "vitest";
import {
  digestGoalsDistAuditProtocol,
  GOALS_DIST_AUDIT_PARENT_G1_K,
  GOALS_DIST_AUDIT_PARENT_G1_PROTOCOL_DIGEST,
  GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST,
  goalsDistAuditProtocol,
} from "@/lib/debug/calibration/goals/distributional-audit/protocol";
import {
  exactScoreProb,
  lowScoreAudit,
  pearsonDispersion,
  homeAwayDependence,
  tailAudit,
  toLabeledRows,
  type LabeledG1Row,
} from "@/lib/debug/calibration/goals/distributional-audit/diagnostics";
import { bootstrapDiagnostics, mulberry32 } from "@/lib/debug/calibration/goals/distributional-audit/bootstrap";
import {
  assignExpectedTotalStratum,
  computeExpectedTotalCutsFrom2023,
} from "@/lib/debug/calibration/goals/distributional-audit/strata";
import { digestGoalsG1Protocol, goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { deriveAnalyticMarkets } from "@/lib/debug/calibration/goals/g0/poisson-markets";
import { poissonPmf } from "@/lib/intelligence/modules/probability/math/poisson";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { runGoalsDistributionalAudit } from "@/lib/debug/calibration/goals/distributional-audit/evaluate";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";

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

function fakeRow(
  partial: Partial<LabeledG1Row> &
    Pick<LabeledG1Row, "fixtureId" | "muHome" | "muAway" | "actualHome" | "actualAway">,
): LabeledG1Row {
  const mh = partial.muHome;
  const ma = partial.muAway;
  const markets = deriveAnalyticMarkets(mh, ma);
  return {
    season: "2023",
    kickoffUtc: "2023-08-11T15:00:00.000Z",
    muTotal: mh + ma,
    actualTotal: partial.actualHome + partial.actualAway,
    evidenceSupportBucket: "ESTABLISHED",
    markets,
    p00: Math.exp(-(mh + ma)),
    ...partial,
  };
}

describe("GOALS-1F.1 protocol", () => {
  it("has deterministic digest and pins G1 k=10", () => {
    expect(digestGoalsDistAuditProtocol()).toBe(
      digestGoalsDistAuditProtocol(goalsDistAuditProtocol()),
    );
    expect(GOALS_DIST_AUDIT_PARENT_G1_K).toBe(10);
    expect(GOALS_DIST_AUDIT_PARENT_G1_PROTOCOL_DIGEST).toBe(
      digestGoalsG1Protocol(goalsG1Protocol(10)),
    );
    expect(GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST).toBe(
      "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95",
    );
    expect(goalsDistAuditProtocol().noDixonColesFit).toBe(true);
    expect(goalsDistAuditProtocol().noNegativeBinomialFit).toBe(true);
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });
});

describe("GOALS-1F.1 diagnostic math", () => {
  it("exact Poisson cell and 0-0 == U0.5", () => {
    const mh = 1.4;
    const ma = 1.1;
    const p00 = exactScoreProb(0, 0, mh, ma);
    expect(p00).toBeCloseTo(Math.exp(-(mh + ma)), 12);
    const m = deriveAnalyticMarkets(mh, ma);
    expect(m.matchTotals.under05).toBeCloseTo(p00, 12);
    expect(poissonPmf(0, mh) * poissonPmf(0, ma)).toBeCloseTo(p00, 12);
  });

  it("low-score expected counts and pearson dispersion", () => {
    const rows = [
      fakeRow({
        fixtureId: "a",
        muHome: 1,
        muAway: 1,
        actualHome: 0,
        actualAway: 0,
      }),
      fakeRow({
        fixtureId: "b",
        muHome: 1,
        muAway: 1,
        actualHome: 1,
        actualAway: 1,
      }),
    ];
    const low = lowScoreAudit(rows);
    expect(low.zeroZero.expected).toBeCloseTo(2 * Math.exp(-2), 10);
    expect(low.zeroZero.observed).toBe(1);
    const pd = pearsonDispersion([0, 2], [1, 1]);
    expect(pd.statistic).toBeCloseTo((1 + 1) / 2, 10);
  });

  it("residual correlation and tail probabilities", () => {
    const rows = [
      fakeRow({
        fixtureId: "1",
        muHome: 2,
        muAway: 1,
        actualHome: 3,
        actualAway: 0,
      }),
      fakeRow({
        fixtureId: "2",
        muHome: 1,
        muAway: 2,
        actualHome: 0,
        actualAway: 3,
      }),
    ];
    const dep = homeAwayDependence(rows);
    expect(dep.corrResidualHomeAway).not.toBeNull();
    const tail = tailAudit(rows);
    expect(tail.regions.find((r) => r.bucket === "0")!.expected).toBeGreaterThan(
      0,
    );
  });

  it("2023 tertile strata frozen for assignment", () => {
    const rows23 = [
      fakeRow({ fixtureId: "1", muHome: 0.5, muAway: 0.5, actualHome: 1, actualAway: 0 }),
      fakeRow({ fixtureId: "2", muHome: 1, muAway: 1, actualHome: 1, actualAway: 1 }),
      fakeRow({ fixtureId: "3", muHome: 2, muAway: 2, actualHome: 2, actualAway: 2 }),
    ];
    // muTotal = 1, 2, 4
    const cuts = computeExpectedTotalCutsFrom2023(rows23);
    expect(cuts.sourceSeason).toBe("2023");
    expect(assignExpectedTotalStratum(1.0, cuts)).toBe("low");
    expect(assignExpectedTotalStratum(4.0, cuts)).toBe("high");
  });

  it("bootstrap is deterministic with fixed seed", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      fakeRow({
        fixtureId: String(i),
        muHome: 1.2 + (i % 3) * 0.1,
        muAway: 1.0,
        actualHome: i % 4,
        actualAway: (i + 1) % 3,
      }),
    );
    const a = bootstrapDiagnostics(rows, 20240924, 50);
    const b = bootstrapDiagnostics(rows, 20240924, 50);
    expect(a.zeroZeroRateDiff.mean).toBe(b.zeroZeroRateDiff.mean);
    expect(a.pearsonTotalDispersion.p50).toBe(b.pearsonTotalDispersion.p50);
    const r1 = mulberry32(1)();
    const r2 = mulberry32(1)();
    expect(r1).toBe(r2);
  });
});

describe("GOALS-1F.1 holdout and no fitting", () => {
  it("rejects 2025 evidence rows", () => {
    const holdout = fx({
      fixtureId: "h",
      kickoffUtc: "2025-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
      season: "2025",
    });
    const evidence = buildGoalsTargetEvidence({
      target: holdout,
      universe: [holdout],
    });
    expect(() =>
      runGoalsDistributionalAudit({
        evidenceRows: [evidence],
        evidenceDatasetDigest: GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST,
      }),
    ).toThrow(/Holdout/);
  });

  it("toLabeledRows only uses AVAILABLE predictions", () => {
    expect(toLabeledRows([])).toEqual([]);
  });
});
