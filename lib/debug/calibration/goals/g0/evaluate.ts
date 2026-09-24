/**
 * GOALS-1C — Evaluate G0 on GOALS-1B evidence dataset.
 */

import { createHash } from "node:crypto";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  GOALS_G0_CONFIRMATORY_SEASON,
  GOALS_G0_DEV_SEASON,
  GOALS_G0_HOLDOUT_SEASON,
  GOALS_G0_PROTOCOL_VERSION,
  GOALS_G0_REQUIRED_EVIDENCE_DIGEST,
  digestGoalsG0Protocol,
  goalsG0Protocol,
} from "@/lib/debug/calibration/goals/g0/protocol";
import {
  assertG0Coherence,
  predictG0FromEvidence,
  type GoalsG0Prediction,
} from "@/lib/debug/calibration/goals/g0/predict";
import {
  evaluateG0Season,
  type GoalsG0SeasonMetrics,
} from "@/lib/debug/calibration/goals/g0/metrics";

export function runGoalsG0Baseline(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  evidenceDatasetDigest: string;
}): {
  protocolDigest: string;
  protocolVersion: string;
  evidenceDatasetDigest: string;
  predictions2023: GoalsG0Prediction[];
  predictions2024: GoalsG0Prediction[];
  metrics2023: GoalsG0SeasonMetrics;
  metrics2024: GoalsG0SeasonMetrics;
  seasonReset: {
    unavailable2023: number;
    unavailable2024: number;
    thinLeagueHistory2023: number;
    thinLeagueHistory2024: number;
  };
  resultDigest: string;
} {
  if (input.evidenceDatasetDigest !== GOALS_G0_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error(
      `Evidence digest mismatch: ${input.evidenceDatasetDigest} vs ${GOALS_G0_REQUIRED_EVIDENCE_DIGEST}`,
    );
  }
  for (const row of input.evidenceRows) {
    if (row.season === GOALS_G0_HOLDOUT_SEASON) {
      throw new Error(`Holdout evidence row leaked: ${row.fixtureId}`);
    }
  }

  const protocol = goalsG0Protocol();
  const protocolDigest = digestGoalsG0Protocol(protocol);

  const predictions2023: GoalsG0Prediction[] = [];
  const predictions2024: GoalsG0Prediction[] = [];

  for (const row of input.evidenceRows) {
    if (row.season === GOALS_G0_DEV_SEASON) {
      const p = predictG0FromEvidence(row);
      assertG0Coherence(p);
      predictions2023.push(p);
    } else if (row.season === GOALS_G0_CONFIRMATORY_SEASON) {
      const p = predictG0FromEvidence(row);
      assertG0Coherence(p);
      predictions2024.push(p);
    }
  }

  predictions2023.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );
  predictions2024.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );

  const metrics2023 = evaluateG0Season(predictions2023);
  const metrics2024 = evaluateG0Season(predictions2024);

  const resultDigest = createHash("sha256")
    .update(
      JSON.stringify({
        protocolDigest,
        metrics2023: metrics2023.distribution,
        metrics2024: metrics2024.distribution,
        n23: predictions2023.length,
        n24: predictions2024.length,
      }),
      "utf8",
    )
    .digest("hex");

  return {
    protocolDigest,
    protocolVersion: GOALS_G0_PROTOCOL_VERSION,
    evidenceDatasetDigest: input.evidenceDatasetDigest,
    predictions2023,
    predictions2024,
    metrics2023,
    metrics2024,
    seasonReset: {
      unavailable2023: metrics2023.unavailableN,
      unavailable2024: metrics2024.unavailableN,
      thinLeagueHistory2023: predictions2023.filter(
        (p) => p.trainingCoverageClass === "thin_league_history",
      ).length,
      thinLeagueHistory2024: predictions2024.filter(
        (p) => p.trainingCoverageClass === "thin_league_history",
      ).length,
    },
    resultDigest,
  };
}
