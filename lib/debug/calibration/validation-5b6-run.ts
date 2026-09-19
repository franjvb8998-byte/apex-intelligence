/**
 * Authorized two-season holdout collection entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 * Eventual command (after live authorization only):
 *   APEX_CALIBRATION_LIVE=1 npm run calibration:validate-5b6
 *
 * Sends exactly:
 *   GET /fixtures?league=39&season=2023
 *   GET /fixtures?league=39&season=2025
 *
 * No odds, pages, H2H, team statistics, standings, injuries, or lineups.
 */

import { assertLiveCollectionAuthorized } from "@/lib/debug/calibration/live-guard";
import { createLiveValidationTransport } from "@/lib/debug/calibration/live-transport";
import { runAuthorizedValidation } from "@/lib/debug/calibration/validation-5b6-collect";

async function main(): Promise<void> {
  assertLiveCollectionAuthorized(process.env, process.argv);
  const result = await runAuthorizedValidation({
    env: process.env,
    argv: process.argv,
    transport: createLiveValidationTransport(process.env),
  });
  console.log(
    JSON.stringify(
      {
        logicalCallCount: result.logicalCallCount,
        seasons: result.seasons.map((season) => ({
          season: season.season,
          populationRowCount: season.population.length,
          logicalCallCount: season.logicalCallCount,
          oddsRequested: season.metadata.oddsRequested,
          populationPath: season.paths?.populationPath ?? null,
          metadataPath: season.paths?.metadataPath ?? null,
        })),
      },
      null,
      2,
    ),
  );
}

const invoked =
  process.argv[1]?.replace(/\\/g, "/").endsWith("validation-5b6-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
