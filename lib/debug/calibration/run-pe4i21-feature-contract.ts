/**
 * Artifact-generating PE-4I.21 eligibility-contract writer.
 * Invoke only with a separate authorization. Implementation tests must not run this file.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import {
  assertPinnedManifestDigests,
  assertSparseAuditMatchesPinnedPartition,
  assertStructuralReadPath,
  buildPe4I21EligibilityContract,
  competitionRowsFromSparseAudit,
  exclusiveDirectoryDecision,
  manifestDigestsFromPayloads,
  varianceRowsFromDescriptiveStats,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i21-eligibility";
import {
  PE4I21_ARTIFACT_SUBDIR,
  PE4I21_PLANNED_ARTIFACTS,
  pe4I21Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i21-protocol";
import {
  PE4I20_AUDIT_ARTIFACT_SUBDIR,
  PE4I20_DATASET_ARTIFACT_SUBDIR,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-protocol";

function readStructural(filePath: string): unknown {
  assertStructuralReadPath(filePath);
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function writeJson(filePath: string, value: unknown): string {
  if (existsSync(filePath)) {
    throw new Error(`PE-4I.21 refuses to overwrite existing file: ${filePath}`);
  }
  const body = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(filePath, body, "utf8");
  return createHash("sha256").update(body, "utf8").digest("hex");
}

const cwd = process.cwd();
const auditDir = path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I20_AUDIT_ARTIFACT_SUBDIR);
const datasetDir = path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I20_DATASET_ARTIFACT_SUBDIR);
const outDir = path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I21_ARTIFACT_SUBDIR);

const auditManifest = readStructural(path.join(auditDir, "audit-manifest.json"));
const descriptive = readStructural(path.join(auditDir, "descriptive-stats.json"));
const sparse = readStructural(path.join(auditDir, "sparse-history-audit.json"));
const datasetManifest = readStructural(path.join(datasetDir, "dataset-manifest.json"));

assertPinnedManifestDigests(manifestDigestsFromPayloads(auditManifest, datasetManifest));
const varianceEvidence = varianceRowsFromDescriptiveStats(descriptive);
const pass1 = buildPe4I21EligibilityContract({
  varianceEvidence,
  requireCompleteVarianceEvidence: true,
});
const pass2 = buildPe4I21EligibilityContract({
  allowlist: varianceEvidence.map((row) => row.field).reverse(),
  varianceEvidence,
  requireCompleteVarianceEvidence: true,
});
if (pass1.contractDigest !== pass2.contractDigest) {
  throw new Error("PE-4I.21 fail-closed: eligibility contract is not order independent");
}
const population = assertSparseAuditMatchesPinnedPartition(
  competitionRowsFromSparseAudit(sparse),
);
if (
  population.primaryTargets !== pass1.population.primaryTargets ||
  population.separateAuditTargets !== pass1.population.separateAuditTargets
) {
  throw new Error("PE-4I.21 fail-closed: sparse partition disagrees with the contract");
}

exclusiveDirectoryDecision({
  directoryPath: outDir,
  exists: existsSync(outDir),
  entryNames: existsSync(outDir) ? readdirSync(outDir) : [],
});
mkdirSync(outDir, { recursive: true });
for (const name of PE4I21_PLANNED_ARTIFACTS) {
  if (existsSync(path.join(outDir, name))) {
    throw new Error(`PE-4I.21 refuses to overwrite existing file: ${name}`);
  }
}

const fileDigests: Record<string, string> = {};
fileDigests["protocol.json"] = writeJson(path.join(outDir, "protocol.json"), pe4I21Protocol());
fileDigests["eligibility-manifest.json"] = writeJson(
  path.join(outDir, "eligibility-manifest.json"),
  {
    numericCandidateCount: pass1.numericCandidateCount,
    classCounts: pass1.classCounts,
    fields: pass1.fields,
  },
);
fileDigests["alias-groups.json"] = writeJson(
  path.join(outDir, "alias-groups.json"),
  { aliasGroups: pass1.aliasGroups },
);
fileDigests["stratum-manifest.json"] = writeJson(
  path.join(outDir, "stratum-manifest.json"),
  population,
);
fileDigests["design-matrix-rules.json"] = writeJson(
  path.join(outDir, "design-matrix-rules.json"),
  pass1.designMatrixRules,
);
fileDigests["reproducibility-audit.json"] = writeJson(
  path.join(outDir, "reproducibility-audit.json"),
  {
    pass: true,
    pass1Digest: pass1.contractDigest,
    pass2Digest: pass2.contractDigest,
    labelsRead: false,
    providerCallsMade: 0,
  },
);
fileDigests["contract-manifest.json"] = writeJson(
  path.join(outDir, "contract-manifest.json"),
  {
    protocolVersion: pass1.protocolVersion,
    contractDigest: pass1.contractDigest,
    labelsRead: false,
    noFeatureVsOutcomeStats: true,
    providerCallsMade: 0,
    productionWiring: false,
    classCounts: pass1.classCounts,
    population: {
      primaryTargets: population.primaryTargets,
      separateAuditTargets: population.separateAuditTargets,
      totalTargets: population.totalTargets,
      totalRows: population.totalRows,
    },
    fileDigests,
  },
);

process.stdout.write(`${JSON.stringify({
  contractDigest: pass1.contractDigest,
  classCounts: pass1.classCounts,
  primaryTargets: population.primaryTargets,
  separateAuditTargets: population.separateAuditTargets,
  artifactDirRelative: path
    .join(PE4I2_CACHE_ROOT_RELATIVE, PE4I21_ARTIFACT_SUBDIR)
    .replace(/\\/g, "/"),
  artifactsWritten: [...PE4I21_PLANNED_ARTIFACTS],
}, null, 2)}\n`);
