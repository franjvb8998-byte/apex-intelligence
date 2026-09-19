/**
 * Explicit live microcollection entry point.
 * Importing this file does not collect. Tests must not import it.
 *
 * Command (after authorization):
 *   APEX_CALIBRATION_LIVE=1 npx --yes tsx lib/debug/calibration/run-microcollect.ts --execute
 */

import { assertLiveCollectionAuthorized } from "@/lib/debug/calibration/live-guard";
import { createLiveMicrocollectTransport } from "@/lib/debug/calibration/live-transport";
import {
  reportMicrocollectCliResult,
  runAuthorizedMicrocollection,
} from "@/lib/debug/calibration/microcollect";

async function main(): Promise<void> {
  await reportMicrocollectCliResult(async () => {
    assertLiveCollectionAuthorized(process.env, process.argv);
    return runAuthorizedMicrocollection({
      env: process.env,
      argv: process.argv,
      transport: createLiveMicrocollectTransport(process.env),
    });
  });
}

const invoked =
  process.argv[1]?.replace(/\\/g, "/").endsWith("run-microcollect.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
