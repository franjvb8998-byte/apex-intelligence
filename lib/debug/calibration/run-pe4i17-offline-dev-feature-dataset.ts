/**
 * PE-4I.17 — CLI: offline DEV feature dataset emission + coverage audit.
 * Zero provider / HTTP / Supabase. No fitting / metrics / 2025 unsealing.
 */

import {
  emitOfflineDevFeatureDataset,
  inspectRecordStructure,
  buildDevFeatureDatasetInMemory,
  loadOrMaterializeLedger,
} from "@/lib/debug/calibration/pe4-as-of-t-features/dataset-emit";
import {
  digestPe4I17Protocol,
  pe4I17Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i17-protocol";
import { eligibleTargetRows } from "@/lib/debug/calibration/pe4-as-of-t-features/target-eligibility";

async function main(): Promise<void> {
  try {
    const result = await emitOfflineDevFeatureDataset({
      writeArtifacts: true,
    });

    // Representative offline inspection: ~3 NON-2025 records, structure only.
    const { rows } = loadOrMaterializeLedger();
    const targets = eligibleTargetRows(rows).slice(0, 3);
    const sample = buildDevFeatureDatasetInMemory({
      ledger: rows,
      targetLimit: 3,
      // Labels still separated; not used for features.
    });
    const structures = sample.pathARecords
      .filter((r) => r.venueMode === "all" && r.windowId === "last_5")
      .slice(0, 6)
      .map(inspectRecordStructure);

    const summary = {
      phase: "PE-4I.17",
      protocol: pe4I17Protocol(),
      protocolDigest: digestPe4I17Protocol(),
      providerCallsMade: result.providerCallsMade,
      noMetricsComputed: result.noMetricsComputed,
      ledgerRowCount: result.ledgerRowCount,
      ledgerDigest: result.ledgerDigest,
      targetCount: result.targetCount,
      exclusionCounts: result.eligibility.exclusionCounts,
      pathARowCount: result.pathARowCount,
      pathBRowCount: result.pathBRowCount,
      pathADigest: result.pathADigest,
      pathBDigest: result.pathBDigest,
      labelsDigest: result.labels.digest,
      pathBPreservesPathAPopulation:
        result.coverage.xgCoverage.pathBPreservesPathAPopulation,
      holdoutFirewall: result.coverage.holdoutFirewall,
      aetPen: result.coverage.aetPen,
      reproducibility: result.reproducibility,
      artifactDirRelative: result.artifactDirRelative,
      datasetManifestDigest: result.datasetManifestDigest,
      venueModesEmitted: result.venueModesEmitted,
      windowIdsEmitted: result.windowIdsEmitted,
      representativeFixtureIds: result.representativeFixtureIds.length
        ? result.representativeFixtureIds
        : targets.map((t) => t.fixtureId),
      representativeRecordStructures: structures,
      note: "Offline DEV feature dataset only — no metrics, fitting, weights, odds/EV, or predictive comparison. Labels separated from feature construction.",
    };
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          phase: "PE-4I.17",
          error: err instanceof Error ? err.message : String(err),
          providerCallsMade: 0,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
