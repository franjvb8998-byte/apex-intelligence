/**
 * PE-4I.2 — Hard provider call budget. No unlimited mode.
 */

export class Pe4I2BudgetExhaustedError extends Error {
  readonly attempted: number;
  readonly maxCalls: number;
  constructor(attempted: number, maxCalls: number) {
    super(
      `PE-4I.2 call budget exhausted: attempted=${attempted} maxCalls=${maxCalls}`,
    );
    this.name = "Pe4I2BudgetExhaustedError";
    this.attempted = attempted;
    this.maxCalls = maxCalls;
  }
}

export type Pe4I2BudgetCounters = {
  attempted: number;
  succeeded: number;
  failed: number;
  cacheHits: number;
  skippedDryRun: number;
};

export type Pe4I2CallBudget = {
  readonly maxCalls: number;
  readonly counters: Pe4I2BudgetCounters;
  remaining(): number;
  /** Reserve one provider attempt; throws if exhausted. */
  beginAttempt(): void;
  recordSuccess(): void;
  recordFailure(): void;
  recordCacheHit(): void;
  recordDryRunSkip(): void;
  snapshot(): Pe4I2BudgetCounters & { maxCalls: number; remaining: number };
};

export function createPe4I2CallBudget(maxCalls: number): Pe4I2CallBudget {
  if (!Number.isInteger(maxCalls) || maxCalls < 0) {
    throw new Error("maxCalls must be a non-negative integer");
  }
  const counters: Pe4I2BudgetCounters = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    cacheHits: 0,
    skippedDryRun: 0,
  };
  return {
    maxCalls,
    counters,
    remaining() {
      return Math.max(0, maxCalls - counters.attempted);
    },
    beginAttempt() {
      if (counters.attempted >= maxCalls) {
        throw new Pe4I2BudgetExhaustedError(counters.attempted, maxCalls);
      }
      counters.attempted += 1;
    },
    recordSuccess() {
      counters.succeeded += 1;
    },
    recordFailure() {
      counters.failed += 1;
    },
    recordCacheHit() {
      counters.cacheHits += 1;
    },
    recordDryRunSkip() {
      counters.skippedDryRun += 1;
    },
    snapshot() {
      return {
        ...counters,
        maxCalls,
        remaining: Math.max(0, maxCalls - counters.attempted),
      };
    },
  };
}
