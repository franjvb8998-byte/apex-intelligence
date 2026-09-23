/**
 * PE-3G — Read-only C0 live-acceptance CLI.
 *
 * fixtureId → durable ticket read → pure evaluator → sanitized JSON.
 * Never writes. Never calls API-Football. Never runs lifecycle/PE.
 */

import { isNumericLifecycleFixtureId } from "@/lib/prematch-lifecycle/config";
import { evaluatePe3C0LiveAcceptance } from "@/lib/prematch-lifecycle/c0-live-acceptance";
import { lookupPrematchDecisionTicket } from "@/lib/prematch-decision/create";

export type C0AcceptanceCliParseResult =
  | { ok: true; fixtureId: string }
  | { ok: false; code: string; message: string };

/**
 * Require an explicit fixture id. Accepts:
 *   --fixture-id <id>
 *   --fixture-id=<id>
 * Positional bare ids are rejected (fail closed — too easy to mis-invoke).
 */
export function parseC0AcceptanceArgv(
  argv: readonly string[],
): C0AcceptanceCliParseResult {
  let fixtureId: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (token === "--fixture-id") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        return {
          ok: false,
          code: "missing_fixture_id_value",
          message: "Missing value for --fixture-id",
        };
      }
      fixtureId = next.trim();
      i += 1;
      continue;
    }
    if (token.startsWith("--fixture-id=")) {
      fixtureId = token.slice("--fixture-id=".length).trim();
      continue;
    }
    if (token.startsWith("-")) {
      return {
        ok: false,
        code: "unknown_flag",
        message: `Unknown flag: ${token}`,
      };
    }
    return {
      ok: false,
      code: "positional_fixture_id_rejected",
      message:
        "Positional fixture ids are rejected — pass --fixture-id <id>",
    };
  }

  if (!fixtureId) {
    return {
      ok: false,
      code: "missing_fixture_id",
      message: "Required: --fixture-id <numericFixtureId>",
    };
  }
  if (!isNumericLifecycleFixtureId(fixtureId)) {
    return {
      ok: false,
      code: "invalid_fixture_id",
      message:
        "fixtureId must be a positive integer API-Football id (fail closed)",
    };
  }
  return { ok: true, fixtureId };
}

export async function runPe3C0AcceptanceVerification(input: {
  fixtureId: string;
  lookup?: (fixtureId: string) => Promise<
    Awaited<ReturnType<typeof lookupPrematchDecisionTicket>>
  >;
}): Promise<ReturnType<typeof evaluatePe3C0LiveAcceptance>> {
  const lookup = input.lookup ?? lookupPrematchDecisionTicket;
  const ticket = await lookup(input.fixtureId);
  return evaluatePe3C0LiveAcceptance({
    fixtureIdRequested: input.fixtureId,
    ticket,
  });
}
