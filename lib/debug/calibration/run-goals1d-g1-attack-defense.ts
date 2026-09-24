/**
 * GOALS-1D — Offline CLI for G1 attack/defense Poisson POC.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1d-g1-attack-defense.ts --execute
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGoalsG1AttackDefense } from "@/lib/debug/calibration/goals/g1/evaluate";
import {
  digestGoalsG1Protocol,
  goalsG1Protocol,
  GOALS_G1_REQUIRED_EVIDENCE_DIGEST,
  GOALS_G1_PARENT_G0_PROTOCOL_DIGEST,
} from "@/lib/debug/calibration/goals/g1/protocol";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";

function slimPred(p: {
  fixtureId: string;
  kickoffUtc: string;
  expectedTotalGoals: number | null;
  muHome: number | null;
  muAway: number | null;
  homeAttackStrength: number | null;
  homeDefenseStrength: number | null;
  awayAttackStrength: number | null;
  awayDefenseStrength: number | null;
  evidenceSupportBucket: string;
  lowInformationFallbackUsed: boolean;
}) {
  return {
    fixtureId: p.fixtureId,
    kickoffUtc: p.kickoffUtc,
    expectedTotalGoals: p.expectedTotalGoals,
    muHome: p.muHome,
    muAway: p.muAway,
    homeAttackStrength: p.homeAttackStrength,
    homeDefenseStrength: p.homeDefenseStrength,
    awayAttackStrength: p.awayAttackStrength,
    awayDefenseStrength: p.awayDefenseStrength,
    evidenceSupportBucket: p.evidenceSupportBucket,
    lowInformationFallbackUsed: p.lowInformationFallbackUsed,
  };
}

function main() {
  // PROTOCOL_FROZEN before any confirmatory metrics (selectedK still null).
  const protocolPre = goalsG1Protocol(null);
  const protocolDigestPre = digestGoalsG1Protocol(protocolPre);
  console.log(
    JSON.stringify(
      {
        phase: "PROTOCOL_FROZEN",
        protocolVersion: protocolPre.protocolVersion,
        protocolDigest: protocolDigestPre,
        parentG0ProtocolDigest: GOALS_G1_PARENT_G0_PROTOCOL_DIGEST,
        shrinkageCandidates: protocolPre.shrinkageCandidates,
        selectedShrinkageK: null,
        primarySelectionMetric: protocolPre.primarySelectionMetric,
        note: "k selection uses 2023 only; confirmatory 2024 metrics not yet computed",
      },
      null,
      2,
    ),
  );

  if (!process.argv.includes("--execute")) {
    console.log(JSON.stringify({ dryRun: true, hint: "Pass --execute" }));
    return;
  }

  const evidenceDir = path.join(
    process.cwd(),
    CALIBRATION_ARTIFACT_DIR,
    "goals",
  );
  const manifest = JSON.parse(
    readFileSync(
      path.join(evidenceDir, "goals-evidence-v1.manifest.json"),
      "utf8",
    ),
  ) as { datasetDigest: string };
  if (manifest.datasetDigest !== GOALS_G1_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error("GOALS-1B digest mismatch");
  }

  const evidenceRows = readFileSync(
    path.join(evidenceDir, "goals-evidence-v1.jsonl"),
    "utf8",
  )
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoalsTargetEvidence);

  const result = runGoalsG1AttackDefense({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const result2 = runGoalsG1AttackDefense({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });

  const protocol = goalsG1Protocol(result.selectedK);
  const protocolDigest = digestGoalsG1Protocol(protocol);
  if (protocolDigest !== result.protocolDigest) {
    throw new Error("Protocol digest mismatch after k freeze");
  }

  console.log(
    JSON.stringify(
      {
        phase: "SELECTED_K_FROZEN",
        selectedK: result.selectedK,
        protocolDigest,
        kSelection: result.kSelection,
      },
      null,
      2,
    ),
  );

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.selectedK === result2.selectedK &&
    result.resultDigest === result2.resultDigest &&
    result.metrics2023.distribution?.jointScoreLogLoss ===
      result2.metrics2023.distribution?.jointScoreLogLoss &&
    result.metrics2024.distribution?.jointScoreLogLoss ===
      result2.metrics2024.distribution?.jointScoreLogLoss;

  if (!reproducible) {
    throw new Error("GOALS-1D reproducibility failed — STOP");
  }

  const outDir = path.join(evidenceDir, "g1-v1");
  mkdirSync(outDir, { recursive: true });

  const writePred = (name: string, rows: unknown[]) => {
    const text = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
    writeFileSync(path.join(outDir, name), text);
    return createHash("sha256").update(text, "utf8").digest("hex");
  };

  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "development-k-selection.json"),
    JSON.stringify(result.kSelection, null, 2) + "\n",
  );
  const dig23 = writePred("predictions-2023.jsonl", result.predictions2023);
  const dig24 = writePred("predictions-2024.jsonl", result.predictions2024);
  writeFileSync(
    path.join(outDir, "metrics-2023.json"),
    JSON.stringify(
      {
        g1: result.metrics2023,
        commonCoverage: result.common2023,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(outDir, "metrics-2024.json"),
    JSON.stringify(
      {
        g1: result.metrics2024,
        commonCoverage: result.common2024,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(outDir, "calibration-2023.json"),
    JSON.stringify(result.metrics2023.calibration, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "calibration-2024.json"),
    JSON.stringify(result.metrics2024.calibration, null, 2) + "\n",
  );

  const diagnostics = {
    rawInstability2023: result.rawInstability2023,
    extreme2023: result.extreme2023,
    extreme2024: result.extreme2024,
    lowInfo2023: result.lowInfo2023,
    lowInfo2024: result.lowInfo2024,
    discriminationExamples2023: result.discriminationExamples2023.map(slimPred),
    lowScore2023: result.metrics2023.scorelineObservedVsPredicted,
    lowScore2024: result.metrics2024.scorelineObservedVsPredicted,
    totalHistogram2023: result.metrics2023.totalHistogram,
    totalHistogram2024: result.metrics2024.totalHistogram,
    dispersion2023: result.metrics2023.dispersion,
    dispersion2024: result.metrics2024.dispersion,
    g0Dispersion2024: result.common2024.g0.dispersion,
  };
  writeFileSync(
    path.join(outDir, "diagnostics.json"),
    JSON.stringify(diagnostics, null, 2) + "\n",
  );

  const report = {
    protocolDigest: result.protocolDigest,
    resultDigest: result.resultDigest,
    selectedK: result.selectedK,
    reproducible,
    holdout2025: { predictions: 0, metrics: false, parameterChoice: false },
    predictionDigests: { "2023": dig23, "2024": dig24 },
    development2023: {
      eligibleN: result.metrics2023.eligibleN,
      unavailableN: result.metrics2023.unavailableN,
      jointLL: result.metrics2023.distribution?.jointScoreLogLoss,
      totalLL: result.metrics2023.distribution?.totalGoalLogLoss,
      common: {
        n: result.common2023.commonN,
        deltaJointLL: result.common2023.delta.jointScoreLogLoss,
        deltaTotalLL: result.common2023.delta.totalGoalLogLoss,
        g0JointLL: result.common2023.g0.distribution?.jointScoreLogLoss,
        g1JointLL: result.common2023.g1.distribution?.jointScoreLogLoss,
      },
    },
    confirmatory2024: {
      eligibleN: result.metrics2024.eligibleN,
      unavailableN: result.metrics2024.unavailableN,
      jointLL: result.metrics2024.distribution?.jointScoreLogLoss,
      totalLL: result.metrics2024.distribution?.totalGoalLogLoss,
      common: {
        n: result.common2024.commonN,
        deltaJointLL: result.common2024.delta.jointScoreLogLoss,
        deltaTotalLL: result.common2024.delta.totalGoalLogLoss,
        g0JointLL: result.common2024.g0.distribution?.jointScoreLogLoss,
        g1JointLL: result.common2024.g1.distribution?.jointScoreLogLoss,
        g0O25: result.common2024.g0.markets.O25,
        g1O25: result.common2024.g1.markets.O25,
        g0O05: result.common2024.g0.markets.O05,
        g1O05: result.common2024.g1.markets.O05,
        g0BTTS: result.common2024.g0.markets.BTTS_YES,
        g1BTTS: result.common2024.g1.markets.BTTS_YES,
      },
    },
  };
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        phase: "EVALUATION_COMPLETE",
        ...report,
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
