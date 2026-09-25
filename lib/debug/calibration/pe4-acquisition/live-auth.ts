/**
 * PE-4I.3 — Live authorization for research acquisition.
 * Requires --execute-live AND --confirm-provider-calls AND --max-calls N>0.
 */

import {
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I2_LIVE_EXECUTE_FLAG,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";

export class Pe4I2LiveAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pe4I2LiveAuthError";
  }
}

export function parseRequiredMaxCalls(argv: readonly string[]): number {
  const idx = argv.indexOf("--max-calls");
  if (idx < 0 || argv[idx + 1] == null) {
    throw new Pe4I2LiveAuthError(
      "--max-calls <positive integer> is required for live acquisition",
    );
  }
  const n = Number(argv[idx + 1]);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Pe4I2LiveAuthError(
      "--max-calls must be a positive integer for live acquisition",
    );
  }
  return n;
}

export function assertPe4I2LiveAuthorized(argv: readonly string[]): {
  maxCalls: number;
} {
  if (!argv.includes(PE4I2_LIVE_EXECUTE_FLAG)) {
    throw new Pe4I2LiveAuthError(
      `${PE4I2_LIVE_EXECUTE_FLAG} is required for live acquisition`,
    );
  }
  if (!argv.includes(PE4I2_LIVE_CONFIRM_FLAG)) {
    throw new Pe4I2LiveAuthError(
      `${PE4I2_LIVE_CONFIRM_FLAG} is required for live acquisition`,
    );
  }
  return { maxCalls: parseRequiredMaxCalls(argv) };
}

export function isPe4I2LiveAuthorized(argv: readonly string[]): boolean {
  try {
    assertPe4I2LiveAuthorized(argv);
    return true;
  } catch {
    return false;
  }
}
