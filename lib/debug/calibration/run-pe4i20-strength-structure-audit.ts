/** Artifact-generating PE-4I.20 audit runner. Invoke only with explicit authorization. */

import { buildPe4I20DatasetFromLocalLedger } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-dataset";
import {
  buildPe4I20StructuralAuditInMemory,
  writePe4I20StructuralAuditArtifacts,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-structure-audit";

const dataset = buildPe4I20DatasetFromLocalLedger();
const audit = buildPe4I20StructuralAuditInMemory(dataset, {
  targetCount: 969,
  rowCountPerPath: 40_698,
});
const written = writePe4I20StructuralAuditArtifacts(audit);
process.stdout.write(`${JSON.stringify({
  auditDigest: written.auditDigest,
  datasetLineage: written.datasetLineage,
  comparisons: written.comparisons,
  featureFamilyMatrix: written.featureFamilyMatrix,
  artifactDirRelative: written.artifactDirRelative,
  artifactsWritten: written.artifactsWritten,
}, null, 2)}\n`);
