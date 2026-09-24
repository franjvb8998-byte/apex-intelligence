/**
 * GOALS-1C — Offline CLI for G0 league baseline.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1c-g0-baseline.ts --execute
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGoalsG0Baseline } from "@/lib/debug/calibration/goals/g0/evaluate";
import {
  digestGoalsG0Protocol,
  goalsG0Protocol,
  GOALS_G0_REQUIRED_EVIDENCE_DIGEST,
} from "@/lib/debug/calibration/goals/g0/protocol";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";

function main() {
  const execute = process.argv.includes("--execute");
  const protocol = goalsG0Protocol();
  const protocolDigest = digestGoalsG0Protocol(protocol);

  console.log(
    JSON.stringify(
      {
        phase: "PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        developmentSeason: protocol.developmentSeason,
        confirmatorySeason: protocol.confirmatorySeason,
        holdoutSeason: protocol.holdoutSeason,
        eligibility: protocol.eligibility,
        labelProvenanceNote: protocol.labelProvenanceNote,
        note: "Confirmatory 2024 metrics not yet computed",
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log(JSON.stringify({ dryRun: true, hint: "Pass --execute" }));
    return;
  }

  const evidenceDir = path.join(
    process.cwd(),
    CALIBRATION_ARTIFACT_DIR,
    "goals",
  );
  const manifest = JSON.parse(
    readFileSync(path.join(evidenceDir, "goals-evidence-v1.manifest.json"), "utf8"),
  ) as { datasetDigest: string };
  if (manifest.datasetDigest !== GOALS_G0_REQUIRED_EVIDENCE_DIGEST) {
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

  const result = runGoalsG0Baseline({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const result2 = runGoalsG0Baseline({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.metrics2023.distribution?.jointScoreLogLoss ===
      result2.metrics2023.distribution?.jointScoreLogLoss &&
    result.metrics2024.distribution?.jointScoreLogLoss ===
      result2.metrics2024.distribution?.jointScoreLogLoss;

  if (!reproducible) {
    throw new Error("GOALS-1C reproducibility failed — STOP");
  }

  const outDir = path.join(evidenceDir, "g0-v1");
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
  const dig23 = writePred("predictions-2023.jsonl", result.predictions2023);
  const dig24 = writePred("predictions-2024.jsonl", result.predictions2024);
  writeFileSync(
    path.join(outDir, "metrics-2023.json"),
    JSON.stringify(result.metrics2023, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "metrics-2024.json"),
    JSON.stringify(result.metrics2024, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "calibration-2023.json"),
    JSON.stringify(result.metrics2023.calibration, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "calibration-2024.json"),
    JSON.stringify(result.metrics2024.calibration, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        ...result,
        predictionDigests: { "2023": dig23, "2024": dig24 },
        reproducible,
        holdout2025: { predictions: 0, metrics: false },
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        phase: "EVALUATION_COMPLETE",
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        reproducible,
        seasonReset: result.seasonReset,
        development2023: {
          eligibleN: result.metrics2023.eligibleN,
          unavailableN: result.metrics2023.unavailableN,
          jointLL: result.metrics2023.distribution?.jointScoreLogLoss,
          totalLL: result.metrics2023.distribution?.totalGoalLogLoss,
          O25: result.metrics2023.markets.O25,
          O05: result.metrics2023.markets.O05,
          BTTS: result.metrics2023.markets.BTTS_YES,
          dispersion: result.metrics2023.dispersion?.classification,
        },
        confirmatory2024: {
          eligibleN: result.metrics2024.eligibleN,
          unavailableN: result.metrics2024.unavailableN,
          jointLL: result.metrics2024.distribution?.jointScoreLogLoss,
          totalLL: result.metrics2024.distribution?.totalGoalLogLoss,
          O25: result.metrics2024.markets.O25,
          O05: result.metrics2024.markets.O05,
          BTTS: result.metrics2024.markets.BTTS_YES,
          dispersion: result.metrics2024.dispersion?.classification,
          ou05: result.metrics2024.overUnder05,
        },
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
