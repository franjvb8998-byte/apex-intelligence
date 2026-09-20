/**
 * 5C.4 discovery call budget. Tighter than the frozen 5C.3 capture ceiling.
 * Odds and evidence remain zero. No pagination loop.
 */

import {
  DiscoveryBudgetError,
  type DiscoveryCallAccounting,
} from "@/lib/debug/calibration/prospective/live/discovery-types";

export const DISCOVERY_CALL_BUDGET = {
  maxFixtureDiscoveryCalls: 1,
  maxSeasonDiscoveryCalls: 1,
  maxOddsCalls: 0,
  maxEvidenceCalls: 0,
  maxTotalCalls: 2,
  maxPagingLoops: 0,
} as const;

export function emptyDiscoveryAccounting(): DiscoveryCallAccounting {
  return {
    fixtureDiscoveryCalls: 0,
    seasonDiscoveryCalls: 0,
    oddsCalls: 0,
    evidenceCalls: 0,
    totalCalls: 0,
  };
}

export function assertDiscoveryBudget(accounting: DiscoveryCallAccounting): void {
  if (accounting.oddsCalls !== 0) {
    throw new DiscoveryBudgetError("discovery forbids odds calls");
  }
  if (accounting.evidenceCalls !== 0) {
    throw new DiscoveryBudgetError("discovery forbids evidence calls");
  }
  if (accounting.fixtureDiscoveryCalls > DISCOVERY_CALL_BUDGET.maxFixtureDiscoveryCalls) {
    throw new DiscoveryBudgetError(
      `fixture discovery calls ${accounting.fixtureDiscoveryCalls} exceed max ${DISCOVERY_CALL_BUDGET.maxFixtureDiscoveryCalls}`,
    );
  }
  if (accounting.seasonDiscoveryCalls > DISCOVERY_CALL_BUDGET.maxSeasonDiscoveryCalls) {
    throw new DiscoveryBudgetError(
      `season discovery calls ${accounting.seasonDiscoveryCalls} exceed max ${DISCOVERY_CALL_BUDGET.maxSeasonDiscoveryCalls}`,
    );
  }
  if (accounting.totalCalls > DISCOVERY_CALL_BUDGET.maxTotalCalls) {
    throw new DiscoveryBudgetError(
      `total discovery calls ${accounting.totalCalls} exceed max ${DISCOVERY_CALL_BUDGET.maxTotalCalls}`,
    );
  }
  if (accounting.totalCalls !== accounting.fixtureDiscoveryCalls + accounting.seasonDiscoveryCalls) {
    throw new DiscoveryBudgetError("totalCalls must equal fixture plus season discovery calls");
  }
}

export function noteFixtureDiscoveryCall(accounting: DiscoveryCallAccounting): DiscoveryCallAccounting {
  const next: DiscoveryCallAccounting = {
    ...accounting,
    fixtureDiscoveryCalls: accounting.fixtureDiscoveryCalls + 1,
    totalCalls: accounting.totalCalls + 1,
  };
  assertDiscoveryBudget(next);
  return next;
}
