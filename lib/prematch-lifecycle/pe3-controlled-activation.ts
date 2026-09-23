/**
 * Manual-only C0 recon controlled-activation controls (PE-3F).
 *
 * Narrowest safe mechanism for ONE deliberate production C0 smoke:
 * - dual explicit CLI flags (no env enable path)
 * - maxNewTickets forced to 1
 * - never flips PE3C_C0_RECON_ACTIVATION
 * - never reachable from the scheduled lifecycle:prematch workflow
 */

export const MANUAL_C0_ENABLE_FLAG = "--enable-c0-recon-smoke" as const;
export const MANUAL_C0_CONFIRM_FLAG = "--confirm-production-write" as const;

/** Hard cap for the manual C0 smoke (respects existing run ceiling of 1). */
export const MANUAL_C0_SMOKE_MAX_NEW_TICKETS = 1 as const;

export type ManualC0SmokeControls = {
  enabled: true;
  maxNewTicketsPerRun: typeof MANUAL_C0_SMOKE_MAX_NEW_TICKETS;
  peInputMode: "c0_recon";
  mechanism: "manual_cli_dual_ack";
};

export type ManualC0SmokeParseResult =
  | { ok: true; controls: ManualC0SmokeControls }
  | { ok: false; code: string; message: string };

/**
 * Fail closed unless both acknowledgement flags are present.
 * Extra unknown flags are ignored (operators may pass passthrough args later).
 * Missing either required flag → refuse (no C0).
 */
export function parseManualC0SmokeArgv(
  argv: readonly string[],
): ManualC0SmokeParseResult {
  const tokens = new Set(argv.filter((t) => t.startsWith("--")));
  const hasEnable = tokens.has(MANUAL_C0_ENABLE_FLAG);
  const hasConfirm = tokens.has(MANUAL_C0_CONFIRM_FLAG);

  if (!hasEnable && !hasConfirm) {
    return {
      ok: false,
      code: "missing_manual_c0_acknowledgements",
      message:
        `Manual C0 smoke requires ${MANUAL_C0_ENABLE_FLAG} and ${MANUAL_C0_CONFIRM_FLAG}`,
    };
  }
  if (!hasEnable) {
    return {
      ok: false,
      code: "missing_enable_c0_recon_smoke",
      message: `Missing required flag ${MANUAL_C0_ENABLE_FLAG}`,
    };
  }
  if (!hasConfirm) {
    return {
      ok: false,
      code: "missing_confirm_production_write",
      message: `Missing required flag ${MANUAL_C0_CONFIRM_FLAG}`,
    };
  }

  return {
    ok: true,
    controls: {
      enabled: true,
      maxNewTicketsPerRun: MANUAL_C0_SMOKE_MAX_NEW_TICKETS,
      peInputMode: "c0_recon",
      mechanism: "manual_cli_dual_ack",
    },
  };
}

/**
 * Guard: scheduled / default runner must never accept an env-based C0 flip.
 * Returns true only when argv clearly requests the manual smoke path.
 */
export function isManualC0SmokeArgv(argv: readonly string[]): boolean {
  return parseManualC0SmokeArgv(argv).ok;
}
