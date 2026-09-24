/**
 * PE-4G.5 — Offline CLI for expectation refinement.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-pe4g5-expectation-refinement.ts --execute
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertPe4ExpectationPocDatasetIntegrity,
} from "@/lib/debug/calibration/pe4-expectation/eligibility";
import { runPe4ExpectationRefinement } from "@/lib/debug/calibration/pe4-expectation/fit-refinement";
import { PE4_EXPECTATION_REFINEMENT_MODEL_VERSION } from "@/lib/debug/calibration/pe4-expectation/inference-adapter";
import {
  digestPe4ExpectationRefinementProtocol,
  PE4_EXPECTATION_REFINEMENT_CONFIRMATORY_SEASON,
  PE4_EXPECTATION_REFINEMENT_HOLDOUT_SEASON,
  PE4_EXPECTATION_REFINEMENT_TRAIN_SEASON,
  pe4ExpectationRefinementProtocol,
} from "@/lib/debug/calibration/pe4-expectation/refinement-protocol";
import type {
  Pe4ExpectationDatasetManifest,
  Pe4ExpectationDatasetRow,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

function main() {
  const execute = process.argv.includes("--execute");
  const protocol = pe4ExpectationRefinementProtocol();
  const protocolDigest = digestPe4ExpectationRefinementProtocol(protocol);

  console.log(
    JSON.stringify(
      {
        phase: "PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        parentProtocolDigest: protocol.parentProtocolDigest,
        trainSeason: protocol.trainSeason,
        confirmatorySeason: protocol.confirmatorySeason,
        confirmatorySeasonStatus: protocol.confirmatorySeasonStatus,
        holdoutSeason: protocol.holdoutSeason,
        c2FeatureSchema: protocol.c2FeatureSchema,
        lowInfoPolicy: protocol.lowInfoPolicy,
        modelDPolicy: protocol.modelDPolicy,
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

  const holdoutFixtureIds = new Set(
    allRows
      .filter((r) => r.season === PE4_EXPECTATION_REFINEMENT_HOLDOUT_SEASON)
      .map((r) => r.fixtureId),
  );

  const pocRows = allRows.filter(
    (r) =>
      r.season === PE4_EXPECTATION_REFINEMENT_TRAIN_SEASON ||
      r.season === PE4_EXPECTATION_REFINEMENT_CONFIRMATORY_SEASON,
  );
  for (const r of pocRows) {
    if (holdoutFixtureIds.has(r.fixtureId)) {
      throw new Error(`Holdout fixture leaked: ${r.fixtureId}`);
    }
  }

  const result = runPe4ExpectationRefinement({
    rows: pocRows,
    datasetDigest: manifest.datasetDigest,
  });
  const result2 = runPe4ExpectationRefinement({
    rows: pocRows,
    datasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.modelC2.parameterDigest === result2.modelC2.parameterDigest &&
    result.modelC2.l2Lambda === result2.modelC2.l2Lambda;

  if (!reproducible) {
    throw new Error("PE-4G.5 reproducibility check failed — STOP");
  }

  const trainEligible = pocRows.filter(
    (r) =>
      r.season === PE4_EXPECTATION_REFINEMENT_TRAIN_SEASON &&
      r.qualityKind === "catalogue_catalogue",
  );
  const trainingCutoffUtc = [...trainEligible]
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
    .at(-1)!.kickoffUtc;

  const artifact = {
    modelFamily: "MODEL_C2_MAGNITUDE",
    modelVersion: PE4_EXPECTATION_REFINEMENT_MODEL_VERSION,
    protocolDigest: result.protocolDigest,
    parentProtocolDigest: result.parentProtocolDigest,
    datasetDigest: result.datasetDigest,
    trainingSeason: "2023",
    trainingCutoffUtc,
    eligibleRowCount: result.trainEligibleCount,
    featureSchema: result.modelC2.featureSchema,
    scaling: { dMean: result.modelC2.dMean, dStd: result.modelC2.dStd },
    regularization: { l2Lambda: result.modelC2.l2Lambda },
    coefficients: {
      betaHome: result.modelC2.betaHome,
      betaDraw: result.modelC2.betaDraw,
      converged: result.modelC2.converged,
      iterations: result.modelC2.iterations,
    },
    parameterDigest: result.modelC2.parameterDigest,
    qualityFallbackPolicy: protocol.lowInfoPolicy,
    lowInfoPrior: result.lowInfoPrior,
  };
  const artifactDigest = createHash("sha256")
    .update(JSON.stringify(artifact), "utf8")
    .digest("hex");

  const outDir = path.join(root, "refinement-v1");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "model-c2.artifact.json"),
    JSON.stringify({ ...artifact, artifactDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        ...result,
        artifactDigest,
        holdout: {
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
        phase: "CONFIRMATORY_COMPLETE",
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        reproducible,
        modelC2Selection: result.modelC2Selection,
        identifiability: result.identifiability,
        complexity: result.complexity,
        preValidationDrawShape: result.preValidationDrawShape,
        metrics: Object.fromEntries(
          Object.entries(result.confirmatory).map(([k, v]) => [
            k,
            {
              logLoss: v.metricsAll.logLoss,
              brier: v.metricsAll.brier,
              meanDRAW: v.metricsAll.meanPredicted.DRAW,
              actualDRAW: v.metricsAll.actualRates.DRAW,
            },
          ]),
        ),
        artifactDigest,
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
