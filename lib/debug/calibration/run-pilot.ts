/**
 * Authorized historical probability-calibration pilot entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 * Command (after authorization only):
 *   APEX_CALIBRATION_LIVE=1 npm run calibration:pilot
 *
 * Sends GET /fixtures?league=39&season=2024 only.
 * Does not request odds, pages, H2H, team statistics, standings, injuries, or lineups.
 */

import { assertLiveCollectionAuthorized } from "@/lib/debug/calibration/live-guard";
import { createLivePilotTransport } from "@/lib/debug/calibration/live-transport";
import {
  reportPilotCliResult,
  runAuthorizedPilot,
} from "@/lib/debug/calibration/pilot-collect";

async function main(): Promise<void> {
  await reportPilotCliResult(async () => {
    assertLiveCollectionAuthorized(process.env, process.argv);
    return runAuthorizedPilot({
      env: process.env,
      argv: process.argv,
      transport: createLivePilotTransport(process.env),
    });
  });
}

const invoked =
  process.argv[1]?.replace(/\\/g, "/").endsWith("run-pilot.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
