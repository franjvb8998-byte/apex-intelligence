/**
 * Manual-only C0 recon production smoke entrypoint (PE-3F).
 *
 * NOT invoked by GitHub Actions / lifecycle:prematch.
 * Does NOT flip PE3C_C0_RECON_ACTIVATION (scheduled runs stay BASE).
 *
 * Requires dual explicit acknowledgements:
 *   --enable-c0-recon-smoke --confirm-production-write
 *
 * Forces maxNewTicketsPerRun = 1 and wires the production paged
 * season-universe loader. Fail closed when flags are absent.
 *
 * DO NOT run until an explicit live-validation phase authorizes it.
 */

import { readPrematchLifecycleConfig } from "@/lib/prematch-lifecycle/config";
import { runPrematchLifecycle } from "@/lib/prematch-lifecycle/coordinator";
import {
  MANUAL_C0_CONFIRM_FLAG,
  MANUAL_C0_ENABLE_FLAG,
  parseManualC0SmokeArgv,
} from "@/lib/prematch-lifecycle/pe3-controlled-activation";
import { executePrematchLifecycleRunner } from "@/lib/prematch-lifecycle/runner";
import { createProductionSeasonUniverseLoader } from "@/lib/prematch-lifecycle/season-universe/api-football-paged-transport";

async function main(): Promise<void> {
  const parsed = parseManualC0SmokeArgv(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: { code: parsed.code, message: parsed.message },
        hint: `Example: npm run lifecycle:prematch:c0-smoke -- ${MANUAL_C0_ENABLE_FLAG} ${MANUAL_C0_CONFIRM_FLAG}`,
      }),
    );
    // Soft exit: hard process.exit() after HTTP keep-alive can trip
    // Windows libuv UV_HANDLE_CLOSING (async.c) during handle teardown.
    process.exitCode = 1;
    return;
  }

  const base = readPrematchLifecycleConfig(process.env);
  const config = {
    ...base,
    maxNewTicketsPerRun: parsed.controls.maxNewTicketsPerRun,
  };

  const code = await executePrematchLifecycleRunner(process.env, {
    runLifecycle: () =>
      runPrematchLifecycle({
        env: process.env,
        config,
        peInputMode: parsed.controls.peInputMode,
        // Explicit production paged loader (same factory coordinator would
        // auto-wire under peInputMode=c0_recon when no loader is injected).
        seasonUniverseLoader: createProductionSeasonUniverseLoader(process.env),
      }),
  });
  process.exitCode = code;
}

void main();
