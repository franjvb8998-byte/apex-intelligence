/**
 * PE-4I.2 — Dry-run / plan execution (zero provider calls by default).
 */

import {
  createPe4I2CallBudget,
  type Pe4I2CallBudget,
} from "@/lib/debug/calibration/pe4-acquisition/budget";
import type { Pe4I2AcquisitionCache } from "@/lib/debug/calibration/pe4-acquisition/cache";
import {
  buildPe4I2AcquisitionPlan,
  type Pe4I2AcquisitionPlan,
} from "@/lib/debug/calibration/pe4-acquisition/planner";
import {
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I2_LIVE_EXECUTE_FLAG,
  PE4I2_XG_STATUS,
  digestPe4I2Protocol,
  pe4I2Protocol,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import type { Pe4I2ProviderTransport } from "@/lib/debug/calibration/pe4-acquisition/transport";

export type Pe4I2RunMode = "plan" | "dry_run" | "execute_live";

export type Pe4I2DryRunResult = {
  mode: Pe4I2RunMode;
  liveEnabled: boolean;
  protocolDigest: string;
  plan: Pe4I2AcquisitionPlan;
  providerCallsMade: number;
  budget: ReturnType<Pe4I2CallBudget["snapshot"]>;
  xgStatus: typeof PE4I2_XG_STATUS;
  holdoutStatus: "SEALED";
  errors: string[];
};

export function resolvePe4I2Mode(argv: readonly string[]): Pe4I2RunMode {
  const live =
    argv.includes(PE4I2_LIVE_EXECUTE_FLAG) &&
    argv.includes(PE4I2_LIVE_CONFIRM_FLAG);
  if (live) return "execute_live";
  if (argv.includes("--plan-only")) return "plan";
  return "dry_run";
}

/**
 * Plan + dry-run. Never calls transport unless mode === execute_live
 * (which PE-4I.2 CLI must not invoke).
 */
export function runPe4I2AcquisitionDryRun(input: {
  maxCalls: number;
  mode?: Pe4I2RunMode;
  cache?: Pe4I2AcquisitionCache | null;
  discoveredFixtureIds?: readonly string[];
  /** Injected only for future live tests; dry-run must not call it. */
  transport?: Pe4I2ProviderTransport;
}): Pe4I2DryRunResult {
  const mode = input.mode ?? "dry_run";
  const errors: string[] = [];
  if (mode === "execute_live") {
    errors.push(
      "PE-4I.2 refuses execute_live in this phase; use plan/dry-run only",
    );
  }
  const plan = buildPe4I2AcquisitionPlan({
    maxCalls: input.maxCalls,
    cache: input.cache ?? null,
    discoveredFixtureIds: input.discoveredFixtureIds,
  });
  const budget = createPe4I2CallBudget(input.maxCalls);
  // Dry-run / plan: count remaining units as skipped, zero attempts.
  for (let i = 0; i < plan.estimates.remainingScheduleCalls; i++) {
    budget.recordDryRunSkip();
  }
  for (let i = 0; i < plan.estimates.remainingStatisticsCalls; i++) {
    budget.recordDryRunSkip();
  }
  void input.transport; // explicitly unused in dry-run
  return {
    mode: mode === "execute_live" ? "dry_run" : mode,
    liveEnabled: false,
    protocolDigest: digestPe4I2Protocol(pe4I2Protocol()),
    plan,
    providerCallsMade: 0,
    budget: budget.snapshot(),
    xgStatus: PE4I2_XG_STATUS,
    holdoutStatus: "SEALED",
    errors,
  };
}
