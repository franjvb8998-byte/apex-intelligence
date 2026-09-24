/**
 * GOALS-1G.2 — Offline CLI for constrained market calibration POC.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1g2-market-calibration-poc.ts
 *   npx tsx lib/debug/calibration/run-goals1g2-market-calibration-poc.ts --execute
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGoalsMarketCalibrationPoc } from "@/lib/debug/calibration/goals/market-calibration-poc/evaluate";
import {
  digestGoalsMcalPocProtocol,
  goalsMcalPocProtocol,
  GOALS_MCAL_POC_O05_POLICY,
  GOALS_MCAL_POC_PARENT_G1_K,
  GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";

function slimSelection(sel: {
  selectedFamily: string;
  reason: string;
  meanFoldLlImprovement: number;
  meanFoldBrierDelta: number;
  meanFoldO05LlWorsen: number | null;
  meanFoldLlCal0: number;
  meanFoldLlCal1: number;
  meanFoldBrierCal0: number;
  meanFoldBrierCal1: number;
  parameterStability: string;
  fullDevFit: {
    intercept: number;
    slope: number;
    converged: boolean;
    fitN: number;
    positiveN: number;
    negativeN: number;
    parameterDigest: string;
  } | null;
  folds: unknown[];
}) {
  return {
    selectedFamily: sel.selectedFamily,
    reason: sel.reason,
    meanFoldLlImprovement: sel.meanFoldLlImprovement,
    meanFoldBrierDelta: sel.meanFoldBrierDelta,
    meanFoldO05LlWorsen: sel.meanFoldO05LlWorsen,
    meanFoldLlCal0: sel.meanFoldLlCal0,
    meanFoldLlCal1: sel.meanFoldLlCal1,
    meanFoldBrierCal0: sel.meanFoldBrierCal0,
    meanFoldBrierCal1: sel.meanFoldBrierCal1,
    parameterStability: sel.parameterStability,
    fullDevFit: sel.fullDevFit
      ? {
          intercept: sel.fullDevFit.intercept,
          slope: sel.fullDevFit.slope,
          converged: sel.fullDevFit.converged,
          fitN: sel.fullDevFit.fitN,
          positiveN: sel.fullDevFit.positiveN,
          negativeN: sel.fullDevFit.negativeN,
          parameterDigest: sel.fullDevFit.parameterDigest,
        }
      : null,
    folds: sel.folds.map((f) => {
      const fold = f as {
        foldId: string;
        cal0: unknown;
        cal1: unknown;
        o05Cal0?: unknown;
        o05Cal1?: unknown;
        fit: { intercept: number; slope: number; converged: boolean };
      };
      return {
        foldId: fold.foldId,
        cal0: fold.cal0,
        cal1: fold.cal1,
        o05Cal0: fold.o05Cal0,
        o05Cal1: fold.o05Cal1,
        fit: {
          intercept: fold.fit.intercept,
          slope: fold.fit.slope,
          converged: fold.fit.converged,
        },
      };
    }),
  };
}

function main() {
  const protocol = goalsMcalPocProtocol();
  const protocolDigest = digestGoalsMcalPocProtocol(protocol);
  console.log(
    JSON.stringify(
      {
        phase: "GOALS1G2_PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        parentG1K: GOALS_MCAL_POC_PARENT_G1_K,
        o05Policy: GOALS_MCAL_POC_O05_POLICY,
        candidateFamilies: protocol.candidateFamilies,
        noIsotonic: true,
        noProductionWiring: true,
        note: "Confirmatory 2024 metrics not yet computed",
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
  if (manifest.datasetDigest !== GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST) {
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

  const result = runGoalsMarketCalibrationPoc({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const result2 = runGoalsMarketCalibrationPoc({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const resultShuffle = runGoalsMarketCalibrationPoc({
    evidenceRows: shuffled,
    evidenceDatasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.finalVerdict === result2.finalVerdict &&
    result.resultDigest === resultShuffle.resultDigest &&
    result.artifactBundleDigest === resultShuffle.artifactBundleDigest;

  if (!reproducible) {
    throw new Error("GOALS-1G.2 reproducibility failed — STOP");
  }

  const outDir = path.join(evidenceDir, "market-calibration-poc-v1");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "development-selection.json"),
    JSON.stringify(
      Object.fromEntries(
        Object.entries(result.selections).map(([k, v]) => [
          k,
          slimSelection(v),
        ]),
      ),
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(outDir, "artifacts.json"),
    JSON.stringify(result.artifacts, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "confirmatory-2024.json"),
    JSON.stringify(result.confirmatory2024, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "ou05-confirmatory.json"),
    JSON.stringify(result.ou05Confirmatory, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "bootstrap-2024.json"),
    JSON.stringify(result.bootstrap2024, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "generalization.json"),
    JSON.stringify(result.generalization, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        artifactBundleDigest: result.artifactBundleDigest,
        finalVerdict: result.finalVerdict,
        selections: Object.fromEntries(
          Object.entries(result.selections).map(([k, v]) => [
            k,
            {
              selectedFamily: v.selectedFamily,
              reason: v.reason,
              intercept: v.fullDevFit?.intercept ?? null,
              slope: v.fullDevFit?.slope ?? null,
              parameterStability: v.parameterStability,
            },
          ]),
        ),
        generalization: result.generalization,
        ou05Classification: result.ou05Confirmatory.classification,
        reproducible,
        productionWired: false,
        holdout2025: result.holdout2025,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        phase: "POC_COMPLETE",
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        artifactBundleDigest: result.artifactBundleDigest,
        finalVerdict: result.finalVerdict,
        selections: Object.fromEntries(
          Object.entries(result.selections).map(([k, v]) => [
            k,
            v.selectedFamily,
          ]),
        ),
        generalization: result.generalization,
        ou05: result.ou05Confirmatory.classification,
        reproducible,
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
