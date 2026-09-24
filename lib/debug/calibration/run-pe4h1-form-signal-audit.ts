/**
 * PE-4H.1 — Offline CLI residual-form signal audit.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-pe4h1-form-signal-audit.ts --execute
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runPe4FormSignalAudit } from "@/lib/debug/calibration/pe4-form/audit";
import {
  digestPe4FormSignalProtocol,
  PE4_FORM_SIGNAL_CONFIRMATORY_SEASON,
  PE4_FORM_SIGNAL_DEV_SEASON,
  PE4_FORM_SIGNAL_HOLDOUT_SEASON,
  PE4_FORM_SIGNAL_PRIMARY_HISTORY_FOR_TABLE,
  pe4FormSignalProtocol,
} from "@/lib/debug/calibration/pe4-form/protocol";
import { assertPe4ExpectationPocDatasetIntegrity } from "@/lib/debug/calibration/pe4-expectation/eligibility";
import type {
  Pe4ExpectationDatasetManifest,
  Pe4ExpectationDatasetRow,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

function main() {
  const execute = process.argv.includes("--execute");
  const protocol = pe4FormSignalProtocol();
  const protocolDigest = digestPe4FormSignalProtocol(protocol);

  console.log(
    JSON.stringify(
      {
        phase: "PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        parentPocProtocolDigest: protocol.parentPocProtocolDigest,
        parentRefinementProtocolDigest: protocol.parentRefinementProtocolDigest,
        expectationFamily: protocol.expectationFamily,
        lowInfoPolicy: protocol.lowInfoPolicy,
        developmentSeason: protocol.developmentSeason,
        confirmatorySeason: protocol.confirmatorySeason,
        holdoutSeason: protocol.holdoutSeason,
        note: "Signal metrics not yet computed",
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

  const holdoutIds = new Set(
    allRows
      .filter((r) => r.season === PE4_FORM_SIGNAL_HOLDOUT_SEASON)
      .map((r) => r.fixtureId),
  );

  const auditRows = allRows.filter(
    (r) =>
      r.season === PE4_FORM_SIGNAL_DEV_SEASON ||
      r.season === PE4_FORM_SIGNAL_CONFIRMATORY_SEASON,
  );
  for (const r of auditRows) {
    if (holdoutIds.has(r.fixtureId)) {
      throw new Error(`Holdout fixture leaked: ${r.fixtureId}`);
    }
  }

  const result = runPe4FormSignalAudit({
    rows: auditRows,
    datasetDigest: manifest.datasetDigest,
  });
  const result2 = runPe4FormSignalAudit({
    rows: auditRows,
    datasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.development.observationDigest ===
      result2.development.observationDigest &&
    result.confirmatory.observationDigest ===
      result2.confirmatory.observationDigest;

  if (!reproducible) {
    throw new Error("PE-4H.1 reproducibility failed — STOP");
  }

  const outDir = path.join(root, "form-signal-v1");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "development-2023.json"),
    JSON.stringify(result.development, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "confirmatory-2024.json"),
    JSON.stringify(result.confirmatory, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        ...result,
        holdout: {
          holdoutRowCountInDataset: holdoutIds.size,
          holdoutInAuditRows: 0,
          holdoutOutcomesNotEvaluated: true,
        },
        reproducible,
      },
      null,
      2,
    ) + "\n",
  );

  const w = PE4_FORM_SIGNAL_PRIMARY_HISTORY_FOR_TABLE;
  console.log(
    JSON.stringify(
      {
        phase: "AUDIT_COMPLETE",
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        reproducible,
        expectationModelParameterDigest:
          result.expectationModelParameterDigest,
        primaryWindow: w,
        development2023: result.development.windowAssociations[w]?.mean,
        classification2023:
          result.development.windowAssociations[w]?.classification,
        confirmatory2024: result.confirmatory.windowAssociations[w]?.mean,
        classification2024:
          result.confirmatory.windowAssociations[w]?.classification,
        shuffle2023: result.development.primaryShuffle,
        shuffle2024: result.confirmatory.primaryShuffle,
        horizons2023: result.development.horizons,
        horizons2024: result.confirmatory.horizons,
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
