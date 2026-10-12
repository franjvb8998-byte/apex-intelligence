/** Artifact-generating PE-4I.20 runner. Invoke only with explicit authorization. */

import {
  buildPe4I20DatasetFromLocalLedger,
  writePe4I20DatasetArtifacts,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-dataset";

const built = buildPe4I20DatasetFromLocalLedger();
if (built.targetCount !== 969 || built.pathARowCount !== 40_698 || built.pathBRowCount !== 40_698) {
  throw new Error(
    `PE-4I.20 canonical population mismatch targets=${built.targetCount} A=${built.pathARowCount} B=${built.pathBRowCount}`,
  );
}
const written = writePe4I20DatasetArtifacts(built);
process.stdout.write(`${JSON.stringify({
  targetCount: written.targetCount,
  pathARowCount: written.pathARowCount,
  pathBRowCount: written.pathBRowCount,
  pathADigest: written.pathADigest,
  pathBDigest: written.pathBDigest,
  catalogueDigest: written.catalogueDigest,
  strengthCoverage: written.strengthCoverage,
  artifactDirRelative: written.artifactDirRelative,
  artifactsWritten: written.artifactsWritten,
}, null, 2)}\n`);
