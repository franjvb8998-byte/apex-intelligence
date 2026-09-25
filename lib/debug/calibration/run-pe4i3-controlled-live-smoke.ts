/**
 * PE-4I.3 — Controlled live provider smoke (MAX 3 provider calls).
 *
 *   npx tsx lib/debug/calibration/run-pe4i3-controlled-live-smoke.ts \
 *     --execute-live --confirm-provider-calls --max-calls 3
 *
 * Importing this file does not fetch.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertPe4I2LiveAuthorized } from "@/lib/debug/calibration/pe4-acquisition/live-auth";
import { createPe4I2LiveTransportFromEnv } from "@/lib/debug/calibration/pe4-acquisition/live-transport";
import {
  PE4I3_SMOKE_MAX_CALLS,
  runPe4I3ControlledLiveSmoke,
  selectPe4I3SmokeTeamId,
} from "@/lib/debug/calibration/pe4-acquisition/smoke";
import {
  PE4I2_CACHE_ROOT_RELATIVE,
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I2_LIVE_EXECUTE_FLAG,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { createPe4I2AcquisitionCache } from "@/lib/debug/calibration/pe4-acquisition/cache";

function loadDotEnvFiles(): void {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  }
}

function teamNameFromCachedSchedule(
  cacheRoot: string,
  teamId: string,
  season: string,
): string | null {
  const cache = createPe4I2AcquisitionCache(cacheRoot);
  const unitKey = `schedule::team=${teamId}::season=${season}`;
  const raw = cache.readRawJson(unitKey) as {
    payload?: { fixtures?: unknown[] };
  } | null;
  // Prefer vendor response names if present in stored envelope — envelope rows lack names.
  // Fall back: null (report will use providerTeamId only unless enrich below).
  void raw;
  void unitKey;
  return null;
}

async function main(): Promise<void> {
  loadDotEnvFiles();
  const { maxCalls } = assertPe4I2LiveAuthorized(process.argv);
  if (maxCalls > PE4I3_SMOKE_MAX_CALLS) {
    throw new Error(
      `PE-4I.3 refuses maxCalls=${maxCalls}; hard smoke ceiling is ${PE4I3_SMOKE_MAX_CALLS}`,
    );
  }

  const teamId = selectPe4I3SmokeTeamId();
  const cacheRoot = path.join(
    process.cwd(),
    PE4I2_CACHE_ROOT_RELATIVE,
    "smoke-i3",
  );
  mkdirSync(cacheRoot, { recursive: true });
  const cache = createPe4I2AcquisitionCache(cacheRoot);
  const transport = createPe4I2LiveTransportFromEnv(process.env);

  console.log(
    JSON.stringify(
      {
        phase: "PE4I3_SMOKE_START",
        teamId,
        season: "2024",
        maxCalls,
        liveFlags: [PE4I2_LIVE_EXECUTE_FLAG, PE4I2_LIVE_CONFIRM_FLAG],
        cacheRoot: PE4I2_CACHE_ROOT_RELATIVE + "/smoke-i3",
      },
      null,
      2,
    ),
  );

  const report = await runPe4I3ControlledLiveSmoke({
    transport,
    maxCalls,
    cache,
    teamId,
  });

  // Best-effort team name from first raw provider payload if still on disk via
  // reading underlying API response is not stored; leave null unless we find it.
  const teamName = teamNameFromCachedSchedule(cacheRoot, teamId, "2024");

  const out = {
    phase: "PE4I3_SMOKE_COMPLETE",
    teamName,
    ...report,
  };

  const reportPath = path.join(cacheRoot, "smoke-report.json");
  writeFileSync(reportPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ smokeReportPath: reportPath }, null, 2));
}

const invoked =
  process.argv[1]
    ?.replace(/\\/g, "/")
    .endsWith("run-pe4i3-controlled-live-smoke.ts") === true;

if (invoked) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
