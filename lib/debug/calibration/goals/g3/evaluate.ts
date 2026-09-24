/**
 * GOALS-1E — Evaluate G3 with development-only beta selection vs frozen G0/G1.
 */

import { createHash } from "node:crypto";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";
import { createPe4HistoricalStrengthMemo } from "@/lib/prematch-decision/pe4-form-schedule/historical-strength";
import type {
  GoalsHistoricalFixture,
  GoalsTargetEvidence,
} from "@/lib/debug/calibration/goals/types";
import {
  assertG0Coherence,
  predictG0FromEvidence,
  type GoalsG0Prediction,
} from "@/lib/debug/calibration/goals/g0/predict";
import {
  assertG1Coherence,
  predictG1FromEvidence,
  type GoalsG1Prediction,
} from "@/lib/debug/calibration/goals/g1/predict";
import { runOpponentQualityAudit } from "@/lib/debug/calibration/goals/g3/audit";
import {
  assertG3Coherence,
  predictG3FromEvidence,
  type GoalsG3Prediction,
} from "@/lib/debug/calibration/goals/g3/predict";
import {
  auditG3Extremes,
  auditOpponentQualityStrata,
  compareTripleCoverage,
  evaluateG3Season,
  lowInfoOpponentAudit,
  type TripleCoverageComparison,
} from "@/lib/debug/calibration/goals/g3/metrics";
import {
  GOALS_G3_BETA_CANDIDATES,
  GOALS_G3_CONFIRMATORY_SEASON,
  GOALS_G3_DEV_SEASON,
  GOALS_G3_FROZEN_SHRINKAGE_K,
  GOALS_G3_HOLDOUT_SEASON,
  GOALS_G3_PROTOCOL_VERSION,
  GOALS_G3_REQUIRED_EVIDENCE_DIGEST,
  digestGoalsG3Protocol,
  goalsG3Protocol,
  type GoalsG3Beta,
} from "@/lib/debug/calibration/goals/g3/protocol";
import type { GoalsG0SeasonMetrics } from "@/lib/debug/calibration/goals/g0/metrics";

function sortPreds<T extends { kickoffUtc: string; fixtureId: string }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );
}

export type GoalsG3BetaCandidate = {
  beta: number;
  eligibleN: number;
  jointScoreLogLoss: number | null;
  totalGoalLogLoss: number | null;
  homeGoalLogLoss: number | null;
  awayGoalLogLoss: number | null;
  O25: number | null;
  BTTS: number | null;
};

export type GoalsG3RunResult = {
  protocolDigest: string;
  protocolVersion: string;
  evidenceDatasetDigest: string;
  selectedBeta: GoalsG3Beta;
  empiricalOpponentCenter: number;
  opponentQualityAudit: ReturnType<typeof runOpponentQualityAudit>;
  betaSelection: {
    season: typeof GOALS_G3_DEV_SEASON;
    candidates: GoalsG3BetaCandidate[];
    selectedBeta: GoalsG3Beta;
    selectionRationale: string;
  };
  predictions2023: GoalsG3Prediction[];
  predictions2024: GoalsG3Prediction[];
  metrics2023: GoalsG0SeasonMetrics;
  metrics2024: GoalsG0SeasonMetrics;
  g0Predictions2023: GoalsG0Prediction[];
  g0Predictions2024: GoalsG0Prediction[];
  g1Predictions2023: GoalsG1Prediction[];
  g1Predictions2024: GoalsG1Prediction[];
  common2023: TripleCoverageComparison;
  common2024: TripleCoverageComparison;
  nullReproduction2023: {
    maxAbsMuHomeDiff: number;
    maxAbsMuAwayDiff: number;
    passes: boolean;
  };
  extremes2023: ReturnType<typeof auditG3Extremes>;
  extremes2024: ReturnType<typeof auditG3Extremes>;
  strata2023: ReturnType<typeof auditOpponentQualityStrata>;
  lowInfo2023: ReturnType<typeof lowInfoOpponentAudit>;
  lowInfo2024: ReturnType<typeof lowInfoOpponentAudit>;
  resultDigest: string;
};

function predictG3Season(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  season: string;
  beta: number;
  center: number;
  targetsById: Map<string, GoalsHistoricalFixture>;
  goalsUniverseBySeason: Map<string, GoalsHistoricalFixture[]>;
  strengthUniverseBySeason: Map<string, PrematchStrengthUniverseFixture[]>;
}): GoalsG3Prediction[] {
  const memo = createPe4HistoricalStrengthMemo();
  const out: GoalsG3Prediction[] = [];
  for (const row of input.evidenceRows) {
    if (row.season !== input.season) continue;
    const target = input.targetsById.get(row.fixtureId);
    if (!target) {
      throw new Error(`Missing target fixture ${row.fixtureId}`);
    }
    const p = predictG3FromEvidence({
      evidence: row,
      targetFixture: target,
      goalsUniverse: input.goalsUniverseBySeason.get(row.season) ?? [],
      strengthUniverse: input.strengthUniverseBySeason.get(row.season) ?? [],
      beta: input.beta,
      empiricalOpponentCenter: input.center,
      memo,
    });
    assertG3Coherence(p);
    out.push(p);
  }
  return sortPreds(out);
}

export function runGoalsG3OpponentAdjusted(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  evidenceDatasetDigest: string;
  targetsById: Map<string, GoalsHistoricalFixture>;
  goalsUniverseBySeason: Map<string, GoalsHistoricalFixture[]>;
  strengthUniverseBySeason: Map<string, PrematchStrengthUniverseFixture[]>;
}): GoalsG3RunResult {
  if (input.evidenceDatasetDigest !== GOALS_G3_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error(
      `Evidence digest mismatch: ${input.evidenceDatasetDigest} vs ${GOALS_G3_REQUIRED_EVIDENCE_DIGEST}`,
    );
  }
  for (const row of input.evidenceRows) {
    if (row.season === GOALS_G3_HOLDOUT_SEASON) {
      throw new Error(`Holdout evidence row leaked: ${row.fixtureId}`);
    }
  }

  const audit = runOpponentQualityAudit({
    evidenceRows: input.evidenceRows,
    targetsById: input.targetsById,
    goalsUniverseBySeason: input.goalsUniverseBySeason,
    strengthUniverseBySeason: input.strengthUniverseBySeason,
  });
  const center = audit.empiricalCenter;

  // Beta selection on 2023 only
  const candidates: GoalsG3BetaCandidate[] = [];
  for (const beta of GOALS_G3_BETA_CANDIDATES) {
    const preds = predictG3Season({
      evidenceRows: input.evidenceRows,
      season: GOALS_G3_DEV_SEASON,
      beta,
      center,
      targetsById: input.targetsById,
      goalsUniverseBySeason: input.goalsUniverseBySeason,
      strengthUniverseBySeason: input.strengthUniverseBySeason,
    });
    const m = evaluateG3Season(preds);
    candidates.push({
      beta,
      eligibleN: m.eligibleN,
      jointScoreLogLoss: m.distribution?.jointScoreLogLoss ?? null,
      totalGoalLogLoss: m.distribution?.totalGoalLogLoss ?? null,
      homeGoalLogLoss: m.distribution?.homeGoalLogLoss ?? null,
      awayGoalLogLoss: m.distribution?.awayGoalLogLoss ?? null,
      O25: m.markets.O25?.logLoss ?? null,
      BTTS: m.markets.BTTS_YES?.logLoss ?? null,
    });
  }

  const scored = [...candidates].sort((a, b) => {
    const dj =
      (a.jointScoreLogLoss ?? Infinity) - (b.jointScoreLogLoss ?? Infinity);
    if (dj !== 0) return dj;
    const dh =
      (a.homeGoalLogLoss ?? Infinity) - (b.homeGoalLogLoss ?? Infinity);
    if (dh !== 0) return dh;
    const da =
      (a.awayGoalLogLoss ?? Infinity) - (b.awayGoalLogLoss ?? Infinity);
    if (da !== 0) return da;
    return a.beta - b.beta;
  });
  const selectedBeta = scored[0]!.beta as GoalsG3Beta;
  const selectionRationale = `Minimize 2023 joint score LL among beta∈{${GOALS_G3_BETA_CANDIDATES.join(",")}} with k=${GOALS_G3_FROZEN_SHRINKAGE_K} frozen; secondary home/away LL; tie-break smaller |beta|. Selected beta=${selectedBeta}. Confirmatory 2024 inaccessible during selection.`;

  const protocol = goalsG3Protocol(selectedBeta);
  const protocolDigest = digestGoalsG3Protocol(protocol);

  const predictions2023 = predictG3Season({
    evidenceRows: input.evidenceRows,
    season: GOALS_G3_DEV_SEASON,
    beta: selectedBeta,
    center,
    targetsById: input.targetsById,
    goalsUniverseBySeason: input.goalsUniverseBySeason,
    strengthUniverseBySeason: input.strengthUniverseBySeason,
  });
  const predictions2024 = predictG3Season({
    evidenceRows: input.evidenceRows,
    season: GOALS_G3_CONFIRMATORY_SEASON,
    beta: selectedBeta,
    center,
    targetsById: input.targetsById,
    goalsUniverseBySeason: input.goalsUniverseBySeason,
    strengthUniverseBySeason: input.strengthUniverseBySeason,
  });

  // Null reproduction: beta=0 vs G1
  const g3Null2023 = predictG3Season({
    evidenceRows: input.evidenceRows,
    season: GOALS_G3_DEV_SEASON,
    beta: 0,
    center,
    targetsById: input.targetsById,
    goalsUniverseBySeason: input.goalsUniverseBySeason,
    strengthUniverseBySeason: input.strengthUniverseBySeason,
  });

  const g0Predictions2023: GoalsG0Prediction[] = [];
  const g0Predictions2024: GoalsG0Prediction[] = [];
  const g1Predictions2023: GoalsG1Prediction[] = [];
  const g1Predictions2024: GoalsG1Prediction[] = [];

  for (const row of input.evidenceRows) {
    const g0 = predictG0FromEvidence(row);
    assertG0Coherence(g0);
    const g1 = predictG1FromEvidence(row, GOALS_G3_FROZEN_SHRINKAGE_K);
    assertG1Coherence(g1);
    if (row.season === GOALS_G3_DEV_SEASON) {
      g0Predictions2023.push(g0);
      g1Predictions2023.push(g1);
    } else if (row.season === GOALS_G3_CONFIRMATORY_SEASON) {
      g0Predictions2024.push(g0);
      g1Predictions2024.push(g1);
    }
  }
  sortPreds(g0Predictions2023);
  sortPreds(g0Predictions2024);
  sortPreds(g1Predictions2023);
  sortPreds(g1Predictions2024);

  let maxAbsMuHomeDiff = 0;
  let maxAbsMuAwayDiff = 0;
  const g1ById = new Map(g1Predictions2023.map((p) => [p.fixtureId, p]));
  for (const p of g3Null2023) {
    const g1 = g1ById.get(p.fixtureId);
    if (!g1 || p.predictionStatus !== "AVAILABLE" || g1.predictionStatus !== "AVAILABLE") {
      continue;
    }
    maxAbsMuHomeDiff = Math.max(
      maxAbsMuHomeDiff,
      Math.abs((p.muHome ?? 0) - (g1.muHome ?? 0)),
    );
    maxAbsMuAwayDiff = Math.max(
      maxAbsMuAwayDiff,
      Math.abs((p.muAway ?? 0) - (g1.muAway ?? 0)),
    );
  }
  const nullReproduction2023 = {
    maxAbsMuHomeDiff,
    maxAbsMuAwayDiff,
    passes: maxAbsMuHomeDiff < 1e-9 && maxAbsMuAwayDiff < 1e-9,
  };

  const metrics2023 = evaluateG3Season(predictions2023);
  const metrics2024 = evaluateG3Season(predictions2024);
  const common2023 = compareTripleCoverage({
    g0: g0Predictions2023,
    g1: g1Predictions2023,
    g3: predictions2023,
  });
  const common2024 = compareTripleCoverage({
    g0: g0Predictions2024,
    g1: g1Predictions2024,
    g3: predictions2024,
  });

  const resultDigest = createHash("sha256")
    .update(
      JSON.stringify({
        protocolDigest,
        selectedBeta,
        center,
        metrics2023: metrics2023.distribution,
        metrics2024: metrics2024.distribution,
        delta2024: common2024.deltaG3MinusG1,
        nullPasses: nullReproduction2023.passes,
      }),
      "utf8",
    )
    .digest("hex");

  return {
    protocolDigest,
    protocolVersion: GOALS_G3_PROTOCOL_VERSION,
    evidenceDatasetDigest: input.evidenceDatasetDigest,
    selectedBeta,
    empiricalOpponentCenter: center,
    opponentQualityAudit: audit,
    betaSelection: {
      season: GOALS_G3_DEV_SEASON,
      candidates,
      selectedBeta,
      selectionRationale,
    },
    predictions2023,
    predictions2024,
    metrics2023,
    metrics2024,
    g0Predictions2023,
    g0Predictions2024,
    g1Predictions2023,
    g1Predictions2024,
    common2023,
    common2024,
    nullReproduction2023,
    extremes2023: auditG3Extremes(predictions2023),
    extremes2024: auditG3Extremes(predictions2024),
    strata2023: auditOpponentQualityStrata(predictions2023, center),
    lowInfo2023: lowInfoOpponentAudit(predictions2023),
    lowInfo2024: lowInfoOpponentAudit(predictions2024),
    resultDigest,
  };
}
