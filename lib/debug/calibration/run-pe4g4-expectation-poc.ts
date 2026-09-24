/**
 * PE-4G.4 — Offline CLI for expectation POC.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-pe4g4-expectation-poc.ts --execute
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildBaseline0Artifact,
  buildModelCArtifact,
  buildModelDArtifact,
} from "@/lib/debug/calibration/pe4-expectation/artifacts";
import {
  assertPe4ExpectationPocDatasetIntegrity,
} from "@/lib/debug/calibration/pe4-expectation/eligibility";
import { runPe4ExpectationPoc } from "@/lib/debug/calibration/pe4-expectation/fit";
import {
  calibrationBinsForClass,
  probabilityExtrema,
} from "@/lib/debug/calibration/pe4-expectation/metrics";
import { predictBaseline0 } from "@/lib/debug/calibration/pe4-expectation/model-baseline";
import { predictModelC } from "@/lib/debug/calibration/pe4-expectation/model-c";
import { predictModelD } from "@/lib/debug/calibration/pe4-expectation/model-d";
import {
  digestPe4ExpectationPocProtocol,
  PE4_EXPECTATION_POC_HOLDOUT_SEASON,
  PE4_EXPECTATION_POC_TRAIN_SEASON,
  PE4_EXPECTATION_POC_VALIDATION_SEASON,
  pe4ExpectationPocProtocol,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import type {
  Pe4ExpectationDatasetManifest,
  Pe4ExpectationDatasetRow,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

function main() {
  const execute = process.argv.includes("--execute");
  const protocol = pe4ExpectationPocProtocol();
  const protocolDigest = digestPe4ExpectationPocProtocol(protocol);

  // Print protocol digest BEFORE evaluation (anti p-hacking).
  console.log(
    JSON.stringify(
      {
        phase: "PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        trainSeason: protocol.trainSeason,
        validationSeason: protocol.validationSeason,
        holdoutSeason: protocol.holdoutSeason,
        holdoutPolicy: protocol.holdoutPolicy,
        note: "Validation metrics not yet computed",
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log(JSON.stringify({ dryRun: true, hint: "Pass --execute" }));
    return;
  }

  const root = path.join(process.cwd(), "data/calibration/pe4-expectation");
  const manifest = JSON.parse(
    readFileSync(path.join(root, "dataset-v1.manifest.json"), "utf8"),
  ) as Pe4ExpectationDatasetManifest;
  assertPe4ExpectationPocDatasetIntegrity(manifest);

  const allRows = readFileSync(path.join(root, "dataset-v1.jsonl"), "utf8")
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Pe4ExpectationDatasetRow);

  // Integrity: holdout fixture IDs may appear in the split manifest, but POC
  // input rows are restricted to train+validation seasons only — no 2025
  // outcomes/features enter fitting or evaluation.
  const holdoutSplit = manifest.splits.find((s) => s.name === "HOLDOUT_RESERVED");
  const holdoutFixtureIds = new Set(
    allRows
      .filter((r) => r.season === PE4_EXPECTATION_POC_HOLDOUT_SEASON)
      .map((r) => r.fixtureId),
  );

  const pocRows = allRows.filter(
    (r) =>
      r.season === PE4_EXPECTATION_POC_TRAIN_SEASON ||
      r.season === PE4_EXPECTATION_POC_VALIDATION_SEASON,
  );
  for (const r of pocRows) {
    if (holdoutFixtureIds.has(r.fixtureId)) {
      throw new Error(`Holdout fixture leaked into POC rows: ${r.fixtureId}`);
    }
  }

  const result = runPe4ExpectationPoc({
    rows: pocRows,
    datasetDigest: manifest.datasetDigest,
  });

  const result2 = runPe4ExpectationPoc({
    rows: pocRows,
    datasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.modelD.parameterDigest === result2.modelD.parameterDigest &&
    result.modelC.parameterDigest === result2.modelC.parameterDigest;

  if (!reproducible) {
    throw new Error("PE-4G.4 reproducibility check failed — STOP");
  }

  const valRows = pocRows
    .filter((r) => r.season === PE4_EXPECTATION_POC_VALIDATION_SEASON)
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  const yVal = valRows.map((r) => r.actualOutcome);
  const predD = predictModelD(result.modelD, valRows);
  const predC = predictModelC(result.modelC, valRows);
  const predB0 = predictBaseline0(result.baseline0, valRows);

  const calibration = {
    MODEL_D: {
      extrema: probabilityExtrema(predD),
      homeBins: calibrationBinsForClass(predD, yVal, "HOME"),
      drawBins: calibrationBinsForClass(predD, yVal, "DRAW"),
      awayBins: calibrationBinsForClass(predD, yVal, "AWAY"),
    },
    MODEL_C: {
      extrema: probabilityExtrema(predC),
      homeBins: calibrationBinsForClass(predC, yVal, "HOME"),
      drawBins: calibrationBinsForClass(predC, yVal, "DRAW"),
      awayBins: calibrationBinsForClass(predC, yVal, "AWAY"),
    },
    BASELINE_0: {
      extrema: probabilityExtrema(predB0),
    },
  };

  const trainEligible = pocRows.filter(
    (r) =>
      r.season === PE4_EXPECTATION_POC_TRAIN_SEASON &&
      r.qualityKind === "catalogue_catalogue",
  );
  const trainingCutoffUtc = [...trainEligible]
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
    .at(-1)!.kickoffUtc;

  const artB0 = buildBaseline0Artifact({
    protocolDigest: result.protocolDigest,
    datasetDigest: result.datasetDigest,
    trainingCutoffUtc,
    model: result.baseline0,
  });
  const artD = buildModelDArtifact({
    protocolDigest: result.protocolDigest,
    datasetDigest: result.datasetDigest,
    trainingCutoffUtc,
    model: result.modelD,
  });
  const artC = buildModelCArtifact({
    protocolDigest: result.protocolDigest,
    datasetDigest: result.datasetDigest,
    trainingCutoffUtc,
    model: result.modelC,
  });

  const outDir = path.join(root, "poc-v1");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(path.join(outDir, "baseline0.artifact.json"), JSON.stringify(artB0, null, 2) + "\n");
  writeFileSync(path.join(outDir, "model-d.artifact.json"), JSON.stringify(artD, null, 2) + "\n");
  writeFileSync(path.join(outDir, "model-c.artifact.json"), JSON.stringify(artC, null, 2) + "\n");
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        ...result,
        calibration,
        artifacts: {
          baseline0: artB0.artifactDigest,
          modelD: artD.artifactDigest,
          modelC: artC.artifactDigest,
        },
        holdout: {
          fixtureDigestPresentInManifest: holdoutSplit?.fixtureIdDigest ?? null,
          holdoutRowCountInDataset: holdoutFixtureIds.size,
          holdoutOutcomesNotEvaluated: true,
          holdoutFixturesInPocRows: 0,
          pocRowSeasons: ["2023", "2024"],
        },
        reproducible,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        phase: "VALIDATION_COMPLETE",
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        reproducible,
        trainEligibleCount: result.trainEligibleCount,
        validationCount: result.validationCount,
        modelDSelection: result.modelDSelection,
        modelCSelection: result.modelCSelection,
        metrics: {
          BASELINE_0: {
            logLoss: result.validation.BASELINE_0.metricsAll.logLoss,
            brier: result.validation.BASELINE_0.metricsAll.brier,
            meanDRAW: result.validation.BASELINE_0.metricsAll.meanPredicted.DRAW,
          },
          MODEL_D: {
            logLoss: result.validation.MODEL_D.metricsAll.logLoss,
            brier: result.validation.MODEL_D.metricsAll.brier,
            deltaLogLoss: result.validation.MODEL_D.deltaLogLossVsBaseline0,
            deltaBrier: result.validation.MODEL_D.deltaBrierVsBaseline0,
            signal: result.validation.MODEL_D.strengthSignal,
            meanDRAW: result.validation.MODEL_D.metricsAll.meanPredicted.DRAW,
          },
          MODEL_C: {
            logLoss: result.validation.MODEL_C.metricsAll.logLoss,
            brier: result.validation.MODEL_C.metricsAll.brier,
            deltaLogLoss: result.validation.MODEL_C.deltaLogLossVsBaseline0,
            deltaBrier: result.validation.MODEL_C.deltaBrierVsBaseline0,
            signal: result.validation.MODEL_C.strengthSignal,
            meanDRAW: result.validation.MODEL_C.metricsAll.meanPredicted.DRAW,
            converged: result.modelC.converged,
          },
        },
        modelCDrawGrid: result.modelCDrawGrid,
        modelBStatus: result.modelBStatus,
        artifactDigests: {
          baseline0: artB0.artifactDigest,
          modelD: artD.artifactDigest,
          modelC: artC.artifactDigest,
        },
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
