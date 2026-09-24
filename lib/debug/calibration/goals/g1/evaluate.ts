/**
 * GOALS-1D — Evaluate G1 with development-only k selection vs frozen G0.
 */

import { createHash } from "node:crypto";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  GOALS_G1_CONFIRMATORY_SEASON,
  GOALS_G1_DEV_SEASON,
  GOALS_G1_HOLDOUT_SEASON,
  GOALS_G1_PROTOCOL_VERSION,
  GOALS_G1_RAW_DIAGNOSTIC_K,
  GOALS_G1_REQUIRED_EVIDENCE_DIGEST,
  GOALS_G1_SHRINKAGE_CANDIDATES,
  digestGoalsG1Protocol,
  goalsG1Protocol,
  type GoalsG1ShrinkageK,
} from "@/lib/debug/calibration/goals/g1/protocol";
import {
  assertG1Coherence,
  predictG1FromEvidence,
  type GoalsG1Prediction,
} from "@/lib/debug/calibration/goals/g1/predict";
import {
  auditExtremePredictions,
  auditLowInformation,
  auditRawRateInstability,
  compareCommonCoverage,
  evaluateG1Season,
  type CommonCoverageComparison,
} from "@/lib/debug/calibration/goals/g1/metrics";
import {
  assertG0Coherence,
  predictG0FromEvidence,
  type GoalsG0Prediction,
} from "@/lib/debug/calibration/goals/g0/predict";
import { evaluateG0Season } from "@/lib/debug/calibration/goals/g0/metrics";
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

function predictSeason(
  rows: readonly GoalsTargetEvidence[],
  season: string,
  k: number,
): GoalsG1Prediction[] {
  const out: GoalsG1Prediction[] = [];
  for (const row of rows) {
    if (row.season !== season) continue;
    const p = predictG1FromEvidence(row, k);
    assertG1Coherence(p);
    out.push(p);
  }
  return sortPreds(out);
}

export type KSelectionCandidate = {
  k: number;
  eligibleN: number;
  unavailableN: number;
  jointScoreLogLoss: number | null;
  totalGoalLogLoss: number | null;
  markets: {
    O05: number | null;
    O25: number | null;
    BTTS_YES: number | null;
  };
  extreme: ReturnType<typeof auditExtremePredictions>;
};

export type GoalsG1RunResult = {
  protocolDigest: string;
  protocolVersion: string;
  evidenceDatasetDigest: string;
  selectedK: GoalsG1ShrinkageK;
  kSelection: {
    season: typeof GOALS_G1_DEV_SEASON;
    primaryMetric: "joint_score_log_loss";
    candidates: KSelectionCandidate[];
    rawDiagnostic: KSelectionCandidate | null;
    selectedK: GoalsG1ShrinkageK;
    selectionRationale: string;
  };
  predictions2023: GoalsG1Prediction[];
  predictions2024: GoalsG1Prediction[];
  metrics2023: GoalsG0SeasonMetrics;
  metrics2024: GoalsG0SeasonMetrics;
  g0Predictions2023: GoalsG0Prediction[];
  g0Predictions2024: GoalsG0Prediction[];
  common2023: CommonCoverageComparison;
  common2024: CommonCoverageComparison;
  rawInstability2023: ReturnType<typeof auditRawRateInstability>;
  extreme2023: ReturnType<typeof auditExtremePredictions>;
  extreme2024: ReturnType<typeof auditExtremePredictions>;
  lowInfo2023: ReturnType<typeof auditLowInformation>;
  lowInfo2024: ReturnType<typeof auditLowInformation>;
  discriminationExamples2023: GoalsG1Prediction[];
  resultDigest: string;
};

function candidateFromPreds(
  k: number,
  preds: GoalsG1Prediction[],
): KSelectionCandidate {
  const m = evaluateG1Season(preds);
  return {
    k,
    eligibleN: m.eligibleN,
    unavailableN: m.unavailableN,
    jointScoreLogLoss: m.distribution?.jointScoreLogLoss ?? null,
    totalGoalLogLoss: m.distribution?.totalGoalLogLoss ?? null,
    markets: {
      O05: m.markets.O05?.logLoss ?? null,
      O25: m.markets.O25?.logLoss ?? null,
      BTTS_YES: m.markets.BTTS_YES?.logLoss ?? null,
    },
    extreme: auditExtremePredictions(preds),
  };
}

export function selectShrinkageKOnDevelopment(
  evidenceRows: readonly GoalsTargetEvidence[],
): {
  selectedK: GoalsG1ShrinkageK;
  candidates: KSelectionCandidate[];
  rawDiagnostic: KSelectionCandidate | null;
  selectionRationale: string;
} {
  // HARD RULE: only 2023 rows may influence selection.
  const devRows = evidenceRows.filter((r) => r.season === GOALS_G1_DEV_SEASON);
  for (const r of evidenceRows) {
    if (r.season === GOALS_G1_HOLDOUT_SEASON) {
      throw new Error(`Holdout row during k-selection: ${r.fixtureId}`);
    }
  }

  const candidates: KSelectionCandidate[] = [];
  for (const k of GOALS_G1_SHRINKAGE_CANDIDATES) {
    const preds = predictSeason(devRows, GOALS_G1_DEV_SEASON, k);
    candidates.push(candidateFromPreds(k, preds));
  }

  let rawDiagnostic: KSelectionCandidate | null = null;
  try {
    const rawPreds = predictSeason(
      devRows,
      GOALS_G1_DEV_SEASON,
      GOALS_G1_RAW_DIAGNOSTIC_K,
    );
    // Only keep raw if every AVAILABLE row has positive finite mu.
    const bad = rawPreds.filter(
      (p) =>
        p.predictionStatus === "AVAILABLE" &&
        (p.muHome == null ||
          p.muAway == null ||
          p.muHome <= 0 ||
          p.muAway <= 0),
    );
    if (bad.length === 0) {
      rawDiagnostic = candidateFromPreds(GOALS_G1_RAW_DIAGNOSTIC_K, rawPreds);
    }
  } catch {
    rawDiagnostic = null;
  }

  const scored = candidates.filter((c) => c.jointScoreLogLoss != null);
  if (scored.length === 0) {
    throw new Error("No valid k candidates on 2023 development");
  }
  scored.sort((a, b) => {
    const dj = (a.jointScoreLogLoss ?? Infinity) - (b.jointScoreLogLoss ?? Infinity);
    if (dj !== 0) return dj;
    const dt =
      (a.totalGoalLogLoss ?? Infinity) - (b.totalGoalLogLoss ?? Infinity);
    if (dt !== 0) return dt;
    return a.k - b.k;
  });
  const selectedK = scored[0]!.k as GoalsG1ShrinkageK;
  const selectionRationale = `Minimize 2023 joint score log loss among k∈{${GOALS_G1_SHRINKAGE_CANDIDATES.join(",")}}; secondary total-goal LL; tie-break smaller k. Selected k=${selectedK} (jointLL=${scored[0]!.jointScoreLogLoss}). Confirmatory 2024 inaccessible during selection.`;

  return { selectedK, candidates, rawDiagnostic, selectionRationale };
}

export function runGoalsG1AttackDefense(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  evidenceDatasetDigest: string;
}): GoalsG1RunResult {
  if (input.evidenceDatasetDigest !== GOALS_G1_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error(
      `Evidence digest mismatch: ${input.evidenceDatasetDigest} vs ${GOALS_G1_REQUIRED_EVIDENCE_DIGEST}`,
    );
  }
  for (const row of input.evidenceRows) {
    if (row.season === GOALS_G1_HOLDOUT_SEASON) {
      throw new Error(`Holdout evidence row leaked: ${row.fixtureId}`);
    }
  }

  const selection = selectShrinkageKOnDevelopment(input.evidenceRows);
  const selectedK = selection.selectedK;

  const protocol = goalsG1Protocol(selectedK);
  const protocolDigest = digestGoalsG1Protocol(protocol);

  const predictions2023 = predictSeason(
    input.evidenceRows,
    GOALS_G1_DEV_SEASON,
    selectedK,
  );
  const predictions2024 = predictSeason(
    input.evidenceRows,
    GOALS_G1_CONFIRMATORY_SEASON,
    selectedK,
  );

  const g0Predictions2023 = sortPreds(
    input.evidenceRows
      .filter((r) => r.season === GOALS_G1_DEV_SEASON)
      .map((r) => {
        const p = predictG0FromEvidence(r);
        assertG0Coherence(p);
        return p;
      }),
  );
  const g0Predictions2024 = sortPreds(
    input.evidenceRows
      .filter((r) => r.season === GOALS_G1_CONFIRMATORY_SEASON)
      .map((r) => {
        const p = predictG0FromEvidence(r);
        assertG0Coherence(p);
        return p;
      }),
  );

  const metrics2023 = evaluateG1Season(predictions2023);
  const metrics2024 = evaluateG1Season(predictions2024);
  const common2023 = compareCommonCoverage({
    g0: g0Predictions2023,
    g1: predictions2023,
  });
  const common2024 = compareCommonCoverage({
    g0: g0Predictions2024,
    g1: predictions2024,
  });

  const rawPreds2023 = predictSeason(
    input.evidenceRows,
    GOALS_G1_DEV_SEASON,
    GOALS_G1_RAW_DIAGNOSTIC_K,
  );
  const rawInstability2023 = auditRawRateInstability(rawPreds2023);

  const extreme2023 = auditExtremePredictions(predictions2023);
  const extreme2024 = auditExtremePredictions(predictions2024);
  const lowInfo2023 = auditLowInformation(predictions2023);
  const lowInfo2024 = auditLowInformation(predictions2024);

  // Discrimination examples: high / median / low predicted total (prediction-only).
  const avail23 = predictions2023
    .filter((p) => p.predictionStatus === "AVAILABLE")
    .sort(
      (a, b) =>
        (b.expectedTotalGoals ?? 0) - (a.expectedTotalGoals ?? 0) ||
        a.fixtureId.localeCompare(b.fixtureId),
    );
  const discriminationExamples2023 =
    avail23.length === 0
      ? []
      : [
          avail23[0]!,
          avail23[Math.floor(avail23.length / 2)]!,
          avail23[avail23.length - 1]!,
        ];

  const resultDigest = createHash("sha256")
    .update(
      JSON.stringify({
        protocolDigest,
        selectedK,
        metrics2023: metrics2023.distribution,
        metrics2024: metrics2024.distribution,
        common2024Delta: common2024.delta,
        n23: predictions2023.length,
        n24: predictions2024.length,
      }),
      "utf8",
    )
    .digest("hex");

  return {
    protocolDigest,
    protocolVersion: GOALS_G1_PROTOCOL_VERSION,
    evidenceDatasetDigest: input.evidenceDatasetDigest,
    selectedK,
    kSelection: {
      season: GOALS_G1_DEV_SEASON,
      primaryMetric: "joint_score_log_loss",
      candidates: selection.candidates,
      rawDiagnostic: selection.rawDiagnostic,
      selectedK,
      selectionRationale: selection.selectionRationale,
    },
    predictions2023,
    predictions2024,
    metrics2023,
    metrics2024,
    g0Predictions2023,
    g0Predictions2024,
    common2023,
    common2024,
    rawInstability2023,
    extreme2023,
    extreme2024,
    lowInfo2023,
    lowInfo2024,
    discriminationExamples2023,
    resultDigest,
  };
}

/** Expose G0 season metrics for report convenience. */
export function g0SeasonMetrics(
  preds: readonly GoalsG0Prediction[],
): GoalsG0SeasonMetrics {
  return evaluateG0Season(preds);
}
