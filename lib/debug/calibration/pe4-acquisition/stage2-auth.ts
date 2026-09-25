/**
 * PE-4I.6 — Stage-2A live authorization.
 * Requires --execute-live AND --confirm-provider-calls AND --stage statistics
 * AND --max-calls N with 1 <= N <= 150.
 */

import {
  Pe4I2LiveAuthError,
  assertPe4I2LiveAuthorized,
} from "@/lib/debug/calibration/pe4-acquisition/live-auth";
import {
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I2_LIVE_EXECUTE_FLAG,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { PE4I5_STAGE_FLAG } from "@/lib/debug/calibration/pe4-acquisition/stage1-auth";

export const PE4I6_STAGE_STATISTICS = "statistics" as const;
export const PE4I6_STAGE2A_HARD_MAX_CALLS = 150 as const;

export class Pe4I6Stage2AAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pe4I6Stage2AAuthError";
  }
}

export function assertPe4I6Stage2ALiveAuthorized(argv: readonly string[]): {
  maxCalls: number;
  stage: typeof PE4I6_STAGE_STATISTICS;
} {
  let maxCalls: number;
  try {
    ({ maxCalls } = assertPe4I2LiveAuthorized(argv));
  } catch (err) {
    if (err instanceof Pe4I2LiveAuthError) {
      throw new Pe4I6Stage2AAuthError(err.message);
    }
    throw err;
  }
  const idx = argv.indexOf(PE4I5_STAGE_FLAG);
  if (idx < 0 || argv[idx + 1] == null) {
    throw new Pe4I6Stage2AAuthError(
      `${PE4I5_STAGE_FLAG} ${PE4I6_STAGE_STATISTICS} is required for Stage-2A`,
    );
  }
  const stage = String(argv[idx + 1]).trim();
  if (stage !== PE4I6_STAGE_STATISTICS) {
    throw new Pe4I6Stage2AAuthError(
      `PE-4I.6 Stage-2A only authorizes ${PE4I5_STAGE_FLAG} ${PE4I6_STAGE_STATISTICS}; got "${stage}"`,
    );
  }
  if (maxCalls > PE4I6_STAGE2A_HARD_MAX_CALLS) {
    throw new Pe4I6Stage2AAuthError(
      `PE-4I.6 Stage-2A refuses maxCalls=${maxCalls}; hard ceiling is ${PE4I6_STAGE2A_HARD_MAX_CALLS}`,
    );
  }
  return { maxCalls, stage: PE4I6_STAGE_STATISTICS };
}

export function isPe4I6Stage2ALiveAuthorized(argv: readonly string[]): boolean {
  try {
    assertPe4I6Stage2ALiveAuthorized(argv);
    return true;
  } catch {
    return false;
  }
}

export const PE4I6_STAGE2A_REQUIRED_FLAGS = [
  PE4I2_LIVE_EXECUTE_FLAG,
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I5_STAGE_FLAG,
  PE4I6_STAGE_STATISTICS,
] as const;
