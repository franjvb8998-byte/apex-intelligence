/**
 * Offline 5B.5 factorial experiment entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 * Command:
 *   npm run calibration:experiment-5b5
 */

import {
  loadFrozenNaturalPopulation,
} from "@/lib/debug/calibration/experiment-5b5-dataset";
import {
  buildExperiment5b5Report,
  writeExperiment5b5Artifact,
} from "@/lib/debug/calibration/experiment-5b5-report";

function main(): void {
  const frozen = loadFrozenNaturalPopulation();
  const report = buildExperiment5b5Report({
    rows: frozen.rows,
    metadata: frozen.metadata,
    populationPath: frozen.path,
    metadataPath: frozen.metadataPath,
  });
  const written = writeExperiment5b5Artifact({ report });
  console.log(
    JSON.stringify(
      {
        datasetKind: report.datasetKind,
        datasetRowCount: report.datasetRowCount,
        combinationCount: report.combinationCount,
        leakageViolationCount: report.verification.leakageViolationCount,
        observedRates: report.observedOutcomeDistribution.rates,
        artifactPath: written.path,
      },
      null,
      2,
    ),
  );
}

const invoked =
  process.argv[1]?.replace(/\\/g, "/").endsWith("experiment-5b5-run.ts") === true;

if (invoked) {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
