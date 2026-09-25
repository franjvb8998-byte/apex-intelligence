/**
 * PE-4I.5 — Stage-1 live authorization.
 * Requires --execute-live AND --confirm-provider-calls AND --stage schedule
 * AND --max-calls N with 1 <= N <= 50.
 */

import {
  Pe4I2LiveAuthError,
  assertPe4I2LiveAuthorized,
} from "@/lib/debug/calibration/pe4-acquisition/live-auth";
import {
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I2_LIVE_EXECUTE_FLAG,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";

export const PE4I5_STAGE_FLAG = "--stage" as const;
export const PE4I5_STAGE_SCHEDULE = "schedule" as const;
export const PE4I5_STAGE1_HARD_MAX_CALLS = 50 as const;

export class Pe4I5Stage1AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pe4I5Stage1AuthError";
  }
}

export function parseRequiredStage(argv: readonly string[]): string {
  const idx = argv.indexOf(PE4I5_STAGE_FLAG);
  if (idx < 0 || argv[idx + 1] == null) {
    throw new Pe4I5Stage1AuthError(
      `${PE4I5_STAGE_FLAG} ${PE4I5_STAGE_SCHEDULE} is required for Stage-1 live acquisition`,
    );
  }
  return String(argv[idx + 1]).trim();
}

export function assertPe4I5Stage1LiveAuthorized(argv: readonly string[]): {
  maxCalls: number;
  stage: typeof PE4I5_STAGE_SCHEDULE;
} {
  let maxCalls: number;
  try {
    ({ maxCalls } = assertPe4I2LiveAuthorized(argv));
  } catch (err) {
    if (err instanceof Pe4I2LiveAuthError) {
      throw new Pe4I5Stage1AuthError(err.message);
    }
    throw err;
  }
  const stage = parseRequiredStage(argv);
  if (stage !== PE4I5_STAGE_SCHEDULE) {
    throw new Pe4I5Stage1AuthError(
      `PE-4I.5 Stage-1 only authorizes ${PE4I5_STAGE_FLAG} ${PE4I5_STAGE_SCHEDULE}; got "${stage}"`,
    );
  }
  if (maxCalls > PE4I5_STAGE1_HARD_MAX_CALLS) {
    throw new Pe4I5Stage1AuthError(
      `PE-4I.5 Stage-1 refuses maxCalls=${maxCalls}; hard ceiling is ${PE4I5_STAGE1_HARD_MAX_CALLS}`,
    );
  }
  return { maxCalls, stage: PE4I5_STAGE_SCHEDULE };
}

export function isPe4I5Stage1LiveAuthorized(argv: readonly string[]): boolean {
  try {
    assertPe4I5Stage1LiveAuthorized(argv);
    return true;
  } catch {
    return false;
  }
}

export const PE4I5_STAGE1_REQUIRED_FLAGS = [
  PE4I2_LIVE_EXECUTE_FLAG,
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I5_STAGE_FLAG,
  PE4I5_STAGE_SCHEDULE,
] as const;
