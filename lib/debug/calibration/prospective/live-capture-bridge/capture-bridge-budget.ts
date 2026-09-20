/**
 * Planned remaining-budget check. 5C.5B.2 does not spend provider calls.
 */

import { LIVE_PROTOCOL_API_BUDGET } from "@/lib/debug/calibration/prospective/protocol/protocol-config";
import {
  CaptureBridgeRejectedError,
  emptyBridgeReport,
  type CaptureBridgeBudgetPlan,
  type CaptureBridgeCallAccounting,
} from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";

export function planCaptureBridgeBudget(input: {
  priorDiscoveryCalls?: number;
  plannedEvidenceCalls?: number;
  plannedOddsCalls?: number;
}): CaptureBridgeBudgetPlan {
  const priorDiscoveryCalls = input.priorDiscoveryCalls ?? 1;
  const plannedEvidenceCalls = input.plannedEvidenceCalls ?? 1;
  const plannedOddsCalls = input.plannedOddsCalls ?? 0;
  return {
    priorDiscoveryCalls,
    plannedEvidenceCalls,
    plannedOddsCalls,
    plannedTotalCalls: priorDiscoveryCalls + plannedEvidenceCalls + plannedOddsCalls,
  };
}

export function assertCaptureBridgeBudget(plan: CaptureBridgeBudgetPlan, fixtureId: string): void {
  if (plan.priorDiscoveryCalls < 0 || plan.plannedEvidenceCalls < 0 || plan.plannedOddsCalls < 0) {
    throw new CaptureBridgeRejectedError("budget values must be non-negative", emptyBridgeReport({ fixtureId }));
  }
  if (plan.plannedEvidenceCalls > LIVE_PROTOCOL_API_BUDGET.maxEvidenceCalls) {
    throw new CaptureBridgeRejectedError("budget overflow rejected", emptyBridgeReport({ fixtureId }));
  }
  if (plan.plannedOddsCalls > LIVE_PROTOCOL_API_BUDGET.maxOddsCalls) {
    throw new CaptureBridgeRejectedError("budget overflow rejected", emptyBridgeReport({ fixtureId }));
  }
  if (plan.plannedTotalCalls > LIVE_PROTOCOL_API_BUDGET.maxTotalCalls) {
    throw new CaptureBridgeRejectedError("budget overflow rejected", emptyBridgeReport({ fixtureId }));
  }
}

export function unspentBridgeAccounting(plan: CaptureBridgeBudgetPlan): CaptureBridgeCallAccounting {
  return {
    priorDiscoveryCalls: plan.priorDiscoveryCalls,
    evidenceCalls: 0,
    oddsCalls: 0,
    outcomeCalls: 0,
    totalCalls: 0,
    plannedTotalCalls: plan.plannedTotalCalls,
  };
}
