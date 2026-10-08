/** PE-4I.19 offline-only catalogue materialization. No provider/network calls. */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { materializeOfflineLedger } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger-materialize";
import { expandTeamPerspectiveHistory } from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import {
  materializePe4I19StrengthCatalogue,
  pe4I19StrengthJoinKey,
} from "@/lib/debug/calibration/pe4-as-of-t-features/strength-catalogue";

const ledger = materializeOfflineLedger({ writeArtifacts: false });
const catalogue = materializePe4I19StrengthCatalogue(ledger.rows);
const devPerspectiveRows = expandTeamPerspectiveHistory(ledger.rows).filter(
  (row) => row.holdoutClassification === "dev_or_conf_eligible",
);
const missingDevPerspectiveKeys = devPerspectiveRows.filter(
  (row) =>
    !catalogue.strengthByTeamAndKickoffM.has(
      pe4I19StrengthJoinKey(row.opponentTeamId, row.kickoffUtc),
    ),
);
const artifactDir = path.join(
  process.cwd(),
  "data",
  "calibration",
  "pe4-acquisition-v1",
  "stage2i19-strength-catalogue",
);
mkdirSync(artifactDir, { recursive: true });

const rowsBody =
  catalogue.rows.map((row) => JSON.stringify(row)).join("\n") +
  (catalogue.rows.length > 0 ? "\n" : "");
const rowsFileDigest = createHash("sha256").update(rowsBody, "utf8").digest("hex");
writeFileSync(path.join(artifactDir, "strength-catalogue.jsonl"), rowsBody, "utf8");

export const PE4I19_OFFLINE_REPORT = {
  protocolVersion: catalogue.rows[0]?.protocolVersion ?? "PE4I19_AS_OF_M_STRENGTH_CATALOGUE_V1",
  ledgerDigest: ledger.report.ledgerDigest,
  catalogueDigest: catalogue.digest,
  rowsFileDigest,
  ledgerRowCount: ledger.rows.length,
  catalogueRowCount: catalogue.rows.length,
  strengthKeyCount: catalogue.strengthByTeamAndKickoffM.size,
  devPerspectiveJoinCandidateCount: devPerspectiveRows.length,
  devPerspectiveJoinMatchedCount:
    devPerspectiveRows.length - missingDevPerspectiveKeys.length,
  devPerspectiveJoinMissingCount: missingDevPerspectiveKeys.length,
  excludedHoldoutCounts: catalogue.excludedHoldoutCounts,
  identicalDuplicateFixtureCount: catalogue.identicalDuplicateFixtureCount,
  conflictedStrengthKeyCount: catalogue.conflictedStrengthKeyCount,
  targetRegulationAmbiguityCount: catalogue.targetRegulationAmbiguityCount,
  priorRegulationAmbiguityCandidateCount:
    catalogue.priorRegulationAmbiguityCandidateCount,
  providerCallsMade: catalogue.providerCallsMade,
  productionWiring: catalogue.productionWiring,
  artifactDirRelative:
    "data/calibration/pe4-acquisition-v1/stage2i19-strength-catalogue",
};
writeFileSync(
  path.join(artifactDir, "catalogue-report.json"),
  `${JSON.stringify(PE4I19_OFFLINE_REPORT, null, 2)}\n`,
  "utf8",
);

process.stdout.write(`${JSON.stringify(PE4I19_OFFLINE_REPORT, null, 2)}\n`);
