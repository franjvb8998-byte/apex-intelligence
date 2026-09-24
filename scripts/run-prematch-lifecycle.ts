/**
 * Production CLI entrypoint for the automatic prematch lifecycle.
 * Invoked by `npm run lifecycle:prematch` (GitHub Actions / operators).
 * Server-only. No HTTP route. No browser. No retries.
 */

import { executePrematchLifecycleRunner } from "@/lib/prematch-lifecycle/runner";

async function main(): Promise<void> {
  const code = await executePrematchLifecycleRunner(process.env);
  // Soft exit avoids Windows libuv UV_HANDLE_CLOSING after HTTP keep-alive teardown.
  process.exitCode = code;
}

void main();
