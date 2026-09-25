/**
 * PE-4I.2 — Plan / dry-run CLI. Zero network calls.
 *
 *   npm run calibration:pe4i2-acquisition-plan
 *   npx tsx lib/debug/calibration/run-pe4i2-acquisition-plan.ts --plan-only
 */

import path from "node:path";
import {
  createPe4I2AcquisitionCache,
} from "@/lib/debug/calibration/pe4-acquisition/cache";
import {
  resolvePe4I2Mode,
  runPe4I2AcquisitionDryRun,
} from "@/lib/debug/calibration/pe4-acquisition/dry-run";
import {
  PE4I2_CACHE_ROOT_RELATIVE,
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I2_LIVE_EXECUTE_FLAG,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";

function parseMaxCalls(argv: readonly string[]): number {
  const idx = argv.indexOf("--max-calls");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number(argv[idx + 1]);
    if (!Number.isInteger(n) || n < 0) {
      throw new Error("--max-calls must be a non-negative integer");
    }
    return n;
  }
  // Default hard ceiling for inspectable plan (not an unlimited mode).
  return 10_000;
}

function main(): void {
  if (
    process.argv.includes(PE4I2_LIVE_EXECUTE_FLAG) ||
    process.argv.includes(PE4I2_LIVE_CONFIRM_FLAG)
  ) {
    console.error(
      JSON.stringify({
        error: "PE-4I.2 CLI refuses live flags; infrastructure-only phase",
        refusedFlags: [PE4I2_LIVE_EXECUTE_FLAG, PE4I2_LIVE_CONFIRM_FLAG],
      }),
    );
    process.exitCode = 1;
    return;
  }
  const maxCalls = parseMaxCalls(process.argv);
  const mode = resolvePe4I2Mode(process.argv);
  const cacheRoot = path.join(process.cwd(), PE4I2_CACHE_ROOT_RELATIVE);
  const cache = createPe4I2AcquisitionCache(cacheRoot);
  const result = runPe4I2AcquisitionDryRun({
    maxCalls,
    mode,
    cache,
  });
  console.log(
    JSON.stringify(
      {
        phase: "PE4I2_ACQUISITION_PLAN",
        protocolVersion: result.plan.protocolVersion,
        protocolDigest: result.protocolDigest,
        planDigest: result.plan.planDigest,
        seasons: result.plan.seasons,
        teamsBySeason: Object.fromEntries(
          result.plan.seasons.map((s) => [
            s,
            {
              count: result.plan.teamsBySeason[s].length,
              ids: result.plan.teamsBySeason[s],
            },
          ]),
        ),
        acquisitionUnits: {
          schedule: result.plan.scheduleUnits.length,
          statistics: result.plan.statisticsUnits.length,
        },
        cacheState: result.plan.estimates,
        estimatedCalls: result.plan.estimates.maxPossibleCallsForRun,
        hardMaxCalls: maxCalls,
        liveEnabled: result.liveEnabled,
        mode: result.mode,
        holdoutStatus: result.holdoutStatus,
        xgStatus: result.xgStatus,
        providerCallsMade: result.providerCallsMade,
        budget: result.budget,
        errors: result.errors,
      },
      null,
      2,
    ),
  );
}

const invoked =
  process.argv[1]?.replace(/\\/g, "/").endsWith("run-pe4i2-acquisition-plan.ts") ===
  true;

if (invoked) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
