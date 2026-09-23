/**
 * Read-only PE-3 C0 live-acceptance verifier CLI.
 *
 * Usage:
 *   npm run lifecycle:verify-c0-acceptance -- --fixture-id <id>
 *
 * READ ONLY. No API-Football. No lifecycle. No ticket writes.
 */

import {
  parseC0AcceptanceArgv,
  runPe3C0AcceptanceVerification,
} from "@/lib/prematch-lifecycle/c0-live-acceptance-cli";

async function main(): Promise<void> {
  const parsed = parseC0AcceptanceArgv(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: { code: parsed.code, message: parsed.message },
        hint: "Example: npm run lifecycle:verify-c0-acceptance -- --fixture-id 1234567",
      }),
    );
    process.exit(1);
  }

  try {
    const result = await runPe3C0AcceptanceVerification({
      fixtureId: parsed.fixtureId,
    });
    console.log(JSON.stringify(result));
    process.exit(result.PE3_C0_LIVE_ACCEPTANCE === "PASS" ? 0 : 2);
  } catch {
    console.error(
      JSON.stringify({
        ok: false,
        error: {
          code: "durable_read_failed",
          message: "Read-only durable ticket lookup failed",
        },
      }),
    );
    process.exit(1);
  }
}

void main();
