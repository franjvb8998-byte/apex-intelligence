/**
 * Live-collection guards. Fail closed unless explicitly opted in.
 */

import {
  MICROCOLLECTION_EXECUTE_FLAG,
  MICROCOLLECTION_FIXTURE_LIST_LOGICAL_CALLS,
  MICROCOLLECTION_LIVE_ENV,
  MICROCOLLECTION_LOGICAL_CALL_CEILING,
  MICROCOLLECTION_TARGET_COUNT,
} from "@/lib/debug/calibration/micro-shape";

export class LiveCollectionGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveCollectionGuardError";
  }
}

export class CallBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallBudgetExceededError";
  }
}

export function assertLiveCollectionAuthorized(
  env: Record<string, string | undefined> = {},
  argv: readonly string[] = [],
): void {
  if (env[MICROCOLLECTION_LIVE_ENV] !== "1") {
    throw new LiveCollectionGuardError(
      `${MICROCOLLECTION_LIVE_ENV}=1 is required before any origin request`,
    );
  }
  if (!argv.includes(MICROCOLLECTION_EXECUTE_FLAG)) {
    throw new LiveCollectionGuardError(
      `${MICROCOLLECTION_EXECUTE_FLAG} is required before any origin request`,
    );
  }
}

export function planMicrocollectionLogicalCalls(input: {
  fixtureListLogicalCalls?: number;
  targetCount?: number;
  includeOdds?: boolean;
  ceiling?: number;
} = {}): { plannedLogicalCalls: number; ceiling: number } {
  const fixtureListLogicalCalls =
    input.fixtureListLogicalCalls ?? MICROCOLLECTION_FIXTURE_LIST_LOGICAL_CALLS;
  const targetCount = input.targetCount ?? MICROCOLLECTION_TARGET_COUNT;
  const oddsCalls = input.includeOdds === false ? 0 : targetCount;
  const plannedLogicalCalls = fixtureListLogicalCalls + oddsCalls;
  const ceiling = input.ceiling ?? MICROCOLLECTION_LOGICAL_CALL_CEILING;
  if (plannedLogicalCalls > ceiling) {
    throw new CallBudgetExceededError(
      `Planned logical calls ${plannedLogicalCalls} exceed microcollection ceiling ${ceiling} (logical lookups, not origin HTTP attempts)`,
    );
  }
  return { plannedLogicalCalls, ceiling };
}

/** @deprecated Use planMicrocollectionLogicalCalls. Same planned-lookup math. */
export const planMicrocollectionOriginCalls = planMicrocollectionLogicalCalls;
