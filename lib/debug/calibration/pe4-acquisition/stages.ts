/**
 * PE-4I.4 — Two-stage bulk acquisition separation (offline planning helpers).
 * Live Stage-1 / Stage-2 execution is forbidden in PE-4I.4.
 */

export const PE4I4_STAGE1_NAME = "SCHEDULE_DISCOVERY" as const;
export const PE4I4_STAGE2_NAME = "STATISTICS_ACQUISITION" as const;

export type Pe4I4Stage2GateResult =
  | {
      ok: true;
      stage: typeof PE4I4_STAGE2_NAME;
      queueDigest: string;
      fixtureCount: number;
    }
  | { ok: false; reason: string };

/**
 * Validate that Stage-2 inputs are structurally ready (offline check).
 * Does not authorize live HTTP.
 */
export function validateStage2QueueReady(input: {
  stage1Complete: boolean;
  statisticsQueueDigest: string | null;
  fixtureIds: readonly string[] | null;
}): Pe4I4Stage2GateResult {
  if (!input.stage1Complete) {
    return {
      ok: false,
      reason: "Stage-2 requires Stage-1 schedule discovery complete",
    };
  }
  if (!input.statisticsQueueDigest || !input.fixtureIds) {
    return {
      ok: false,
      reason: "Stage-2 requires exact unique statistics queue from Stage-1",
    };
  }
  return {
    ok: true,
    stage: PE4I4_STAGE2_NAME,
    queueDigest: input.statisticsQueueDigest,
    fixtureCount: input.fixtureIds.length,
  };
}

/** Explicit: PE-4I.4 refuses to authorize live bulk stages. */
export function refusePe4I4LiveBulkExecution(): {
  authorized: false;
  providerCallsMade: 0;
  reason: string;
} {
  return {
    authorized: false,
    providerCallsMade: 0,
    reason:
      "PE-4I.4 is planning + offline validation only; authorize a later phase for Stage-1",
  };
}

/**
 * Live Stage-2 is never authorized from PE-4I.4 even if queue is ready.
 */
export function authorizeLiveStage2(_queueReady: Pe4I4Stage2GateResult): {
  authorized: false;
  reason: string;
} {
  void _queueReady;
  return {
    authorized: false,
    reason: "PE-4I.4 forbids live Stage-2; planning architecture only",
  };
}

export type Pe4I4BatchBudgetReport = {
  dryRun: boolean;
  plannedCalls: number;
  attempted: number;
  succeeded: number;
  failed: number;
  cacheHits: number;
  remaining: number;
  maxCalls: number;
};

export function emptyBatchBudgetReport(input: {
  dryRun: boolean;
  plannedCalls: number;
  maxCalls: number;
}): Pe4I4BatchBudgetReport {
  if (!Number.isInteger(input.maxCalls) || input.maxCalls < 0) {
    throw new Error(
      "maxCalls must be explicitly supplied as non-negative integer",
    );
  }
  return {
    dryRun: input.dryRun,
    plannedCalls: input.plannedCalls,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    cacheHits: 0,
    remaining: input.maxCalls,
    maxCalls: input.maxCalls,
  };
}
