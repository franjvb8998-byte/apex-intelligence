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
import {
  PILOT_FIXTURE_LIST_LOGICAL_CALLS,
  PILOT_LOGICAL_CALL_CEILING,
} from "@/lib/debug/calibration/pilot-shape";
import {
  VALIDATION_LOGICAL_CALL_CEILING,
  VALIDATION_ODDS_LOGICAL_CALLS,
  VALIDATION_SEASON_COUNT,
} from "@/lib/debug/calibration/validation-5b6-shape";

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

/** Pilot budget: one unpaged fixture-list lookup. Odds are forbidden. */
export function planPilotLogicalCalls(input: {
  fixtureListLogicalCalls?: number;
  includeOdds?: boolean;
  ceiling?: number;
} = {}): { plannedLogicalCalls: number; ceiling: number } {
  if (input.includeOdds === true) {
    throw new CallBudgetExceededError(
      "Historical probability pilot forbids odds lookups",
    );
  }
  const plannedLogicalCalls =
    input.fixtureListLogicalCalls ?? PILOT_FIXTURE_LIST_LOGICAL_CALLS;
  const ceiling = input.ceiling ?? PILOT_LOGICAL_CALL_CEILING;
  if (plannedLogicalCalls > ceiling) {
    throw new CallBudgetExceededError(
      `Planned logical calls ${plannedLogicalCalls} exceed pilot ceiling ${ceiling} (logical lookups, not origin HTTP attempts)`,
    );
  }
  return { plannedLogicalCalls, ceiling };
}

/** Two-season holdout: one unpaged fixture-list lookup per season. Odds forbidden. */
export function planValidationLogicalCalls(input: {
  seasonCount?: number;
  includeOdds?: boolean;
  ceiling?: number;
} = {}): { plannedLogicalCalls: number; ceiling: number } {
  if (input.includeOdds === true) {
    throw new CallBudgetExceededError(
      "Multi-season validation forbids odds lookups",
    );
  }
  const plannedLogicalCalls = input.seasonCount ?? VALIDATION_SEASON_COUNT;
  if (plannedLogicalCalls !== VALIDATION_SEASON_COUNT + VALIDATION_ODDS_LOGICAL_CALLS) {
    throw new CallBudgetExceededError(
      `Validation planned logical calls must equal holdout season count ${VALIDATION_SEASON_COUNT}`,
    );
  }
  const ceiling = input.ceiling ?? VALIDATION_LOGICAL_CALL_CEILING;
  if (plannedLogicalCalls > ceiling) {
    throw new CallBudgetExceededError(
      `Planned logical calls ${plannedLogicalCalls} exceed validation ceiling ${ceiling} (logical lookups, not origin HTTP attempts)`,
    );
  }
  return { plannedLogicalCalls, ceiling };
}
