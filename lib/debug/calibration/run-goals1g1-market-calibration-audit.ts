/**
 * GOALS-1G.1 — Offline CLI for market-calibration audit (no fitting).
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1g1-market-calibration-audit.ts --execute
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGoalsMarketCalibrationAudit } from "@/lib/debug/calibration/goals/market-calibration/evaluate";
import {
  digestGoalsMcalProtocol,
  goalsMcalProtocol,
  GOALS_MCAL_PARENT_G1_K,
  GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST,
} from "@/lib/debug/calibration/goals/market-calibration/protocol";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";

function slimMetrics(bundle: {
  support: Record<string, unknown>;
  metrics: Record<string, { reliability?: unknown; [k: string]: unknown }>;
  logistic: Record<string, unknown>;
}) {
  const metrics: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bundle.metrics)) {
    const { reliability, ...rest } = v;
    metrics[k] = { ...rest, reliability };
  }
  return {
    support: bundle.support,
    metrics,
    logistic: bundle.logistic,
  };
}

function main() {
  const protocol = goalsMcalProtocol();
  const protocolDigest = digestGoalsMcalProtocol(protocol);
  console.log(
    JSON.stringify(
      {
        phase: "GOALS1G1_PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        parentG1K: GOALS_MCAL_PARENT_G1_K,
        noCalibratorFitting: true,
        note: "Confirmatory 2024 conclusions not yet computed",
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
  if (manifest.datasetDigest !== GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST) {
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

  const shuffled = [...evidenceRows].sort((a, b) =>
    b.fixtureId.localeCompare(a.fixtureId),
  );

  const result = runGoalsMarketCalibrationAudit({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const result2 = runGoalsMarketCalibrationAudit({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const resultShuffle = runGoalsMarketCalibrationAudit({
    evidenceRows: shuffled,
    evidenceDatasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.finalVerdict === result2.finalVerdict &&
    result.resultDigest === resultShuffle.resultDigest;

  if (!reproducible) {
    throw new Error("GOALS-1G.1 reproducibility failed — STOP");
  }

  const outDir = path.join(evidenceDir, "market-calibration-audit-v1");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "metrics-2023.json"),
    JSON.stringify(slimMetrics(result.development2023), null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "metrics-2024.json"),
    JSON.stringify(slimMetrics(result.confirmatory2024), null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "temporal-stability.json"),
    JSON.stringify(result.temporalStability, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "ou05-special.json"),
    JSON.stringify(result.ou05Special, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "bootstrap-2024.json"),
    JSON.stringify(result.bootstrap2024, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "candidates.json"),
    JSON.stringify(
      {
        calibratorCandidates: result.calibratorCandidates,
        coherenceRequirements: result.coherenceRequirements,
        sharedVsSpecific: result.sharedVsSpecific,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        finalVerdict: result.finalVerdict,
        observationCount: result.observationCount,
        uniqueFixtureMarketKeys: result.uniqueFixtureMarketKeys,
        sharedVsSpecific: result.sharedVsSpecific,
        temporalStability: Object.fromEntries(
          Object.entries(result.temporalStability).map(([k, v]) => [
            k,
            v.classification,
          ]),
        ),
        reproducible,
        holdout2025: { predictions: 0, calibration: false, fitting: false },
        noCalibratorFitted: true,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        phase: "AUDIT_COMPLETE",
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        finalVerdict: result.finalVerdict,
        sharedVsSpecific: result.sharedVsSpecific,
        temporalStability: Object.fromEntries(
          Object.entries(result.temporalStability).map(([k, v]) => [
            k,
            v.classification,
          ]),
        ),
        observationCount: result.observationCount,
        reproducible,
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
