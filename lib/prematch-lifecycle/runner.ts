/**
 * Server-only CLI runner for the automatic prematch lifecycle.
 * Validates mandatory env, invokes runPrematchLifecycle exactly once,
 * prints a sanitized structured report. No HTTP, no retries, no fake clock.
 */

import {
  LIFECYCLE_LEAGUE_IDS_ENV,
  parseLifecycleLeagueIds,
} from "@/lib/prematch-lifecycle/config";
import { runPrematchLifecycle } from "@/lib/prematch-lifecycle/coordinator";
import type { PrematchLifecycleReport } from "@/lib/prematch-lifecycle/report";
import { hasFootballApiKey } from "@/lib/repositories/source";

export const RUNNER_EXIT = {
  OK: 0,
  CONFIG: 1,
  LIFECYCLE: 2,
  /** Coordinator completed but reported run-level fatal operational failure. */
  OPERATIONAL: 3,
} as const;

export type PrematchLifecycleRunnerEnv = NodeJS.ProcessEnv | Record<
  string,
  string | undefined
>;

export type PrematchLifecycleSanitizedSummary = {
  startedAtUtc: string;
  completedAtUtc: string;
  configuredLeagueCount: number;
  leagueAllowlistInvalid: boolean;
  discoveredFixtureCount: number;
  eligibleT120Count: number;
  alreadyTicketedCount: number;
  newTicketAttempts: number;
  newTicketsCreated: number;
  newTicketsIdempotent: number;
  oddsRequests: number;
  peComputations: number;
  ticketListPages: number;
  finalizationCandidates: number;
  finalizationBatchRequests: number;
  evidenceCreated: number;
  evidenceIdempotent: number;
  evaluationsCreated: number;
  evaluationsIdempotent: number;
  voidTerminalCount: number;
  invalidFixtureIdCount: number;
  skippedCount: number;
  errorCount: number;
  fatalErrorCount: number;
  peInputMode: "base_prior" | "c0_recon";
  inputRegime: string;
  c0ReconAttempts: number;
  c0ReconTicketsCreated: number;
  c0ReconFallbackBasePrior: number;
  c0ReconMixed: number;
  c0ReconSkipped: number;
  seasonUniverseAcquisitions: number;
  seasonUniverseHttpRequests: number;
  seasonUniverseCacheHits: number;
  c0LastSkipReason: string | null;
};

export type PrematchLifecycleRunnerValidation =
  | { ok: true }
  | { ok: false; code: string; message: string };

export type PrematchLifecycleRunnerDeps = {
  runLifecycle?: () => Promise<PrematchLifecycleReport>;
  writeStdout?: (line: string) => void;
  writeStderr?: (line: string) => void;
};

export function sanitizePrematchLifecycleReport(
  report: PrematchLifecycleReport,
): PrematchLifecycleSanitizedSummary {
  return {
    startedAtUtc: report.startedAtUtc,
    completedAtUtc: report.completedAtUtc,
    configuredLeagueCount: report.configuredLeagueCount,
    leagueAllowlistInvalid: report.leagueAllowlistInvalid,
    discoveredFixtureCount: report.discoveredFixtureCount,
    eligibleT120Count: report.eligibleT120Count,
    alreadyTicketedCount: report.alreadyTicketedCount,
    newTicketAttempts: report.newTicketAttempts,
    newTicketsCreated: report.newTicketsCreated,
    newTicketsIdempotent: report.newTicketsIdempotent,
    oddsRequests: report.oddsRequests,
    peComputations: report.peComputations,
    ticketListPages: report.ticketListPages,
    finalizationCandidates: report.finalizationCandidates,
    finalizationBatchRequests: report.finalizationBatchRequests,
    evidenceCreated: report.evidenceCreated,
    evidenceIdempotent: report.evidenceIdempotent,
    evaluationsCreated: report.evaluationsCreated,
    evaluationsIdempotent: report.evaluationsIdempotent,
    voidTerminalCount: report.voidTerminalCount,
    invalidFixtureIdCount: report.invalidFixtureIdCount,
    skippedCount: report.skippedCount,
    errorCount: report.errorCount,
    fatalErrorCount: report.fatalErrorCount,
    peInputMode: report.peInputMode,
    inputRegime: report.inputRegime,
    c0ReconAttempts: report.c0ReconAttempts,
    c0ReconTicketsCreated: report.c0ReconTicketsCreated,
    c0ReconFallbackBasePrior: report.c0ReconFallbackBasePrior,
    c0ReconMixed: report.c0ReconMixed,
    c0ReconSkipped: report.c0ReconSkipped,
    seasonUniverseAcquisitions: report.seasonUniverseAcquisitions,
    seasonUniverseHttpRequests: report.seasonUniverseHttpRequests,
    seasonUniverseCacheHits: report.seasonUniverseCacheHits,
    c0LastSkipReason: report.c0LastSkipReason,
  };
}

/**
 * Fail closed before any lifecycle/provider work when mandatory
 * runtime config is missing or the allowlist is empty/invalid.
 * Cron secret is intentionally not required for direct execution.
 */
export function validatePrematchLifecycleRunnerEnv(
  env: PrematchLifecycleRunnerEnv = process.env,
): PrematchLifecycleRunnerValidation {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    return {
      ok: false,
      code: "missing_supabase_url",
      message: "Missing required configuration: NEXT_PUBLIC_SUPABASE_URL",
    };
  }

  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) {
    return {
      ok: false,
      code: "missing_service_role",
      message: "Missing required configuration: SUPABASE_SERVICE_ROLE_KEY",
    };
  }

  if (!hasFootballApiKey(env)) {
    return {
      ok: false,
      code: "missing_provider_key",
      message:
        "Missing required configuration: API_FOOTBALL_KEY (or APISPORTS_KEY / API_KEY)",
    };
  }

  const leagueRaw = env[LIFECYCLE_LEAGUE_IDS_ENV];
  const allowlist = parseLifecycleLeagueIds(leagueRaw);
  if (allowlist.invalid) {
    return {
      ok: false,
      code: "invalid_league_allowlist",
      message:
        "Invalid APEX_LIFECYCLE_LEAGUE_IDS — fail closed (no capture)",
    };
  }
  if (allowlist.leagueIds.length === 0) {
    return {
      ok: false,
      code: "empty_league_allowlist",
      message:
        "Missing or empty APEX_LIFECYCLE_LEAGUE_IDS — fail closed (no capture)",
    };
  }

  return { ok: true };
}

/**
 * Validate env, run the coordinator exactly once, print sanitized JSON.
 * No retry loop. No fake clock. No HTTP. Cron secret not required.
 */
export async function executePrematchLifecycleRunner(
  env: PrematchLifecycleRunnerEnv = process.env,
  deps: PrematchLifecycleRunnerDeps = {},
): Promise<number> {
  const writeStdout = deps.writeStdout ?? ((line) => console.log(line));
  const writeStderr = deps.writeStderr ?? ((line) => console.error(line));

  const validation = validatePrematchLifecycleRunnerEnv(env);
  if (!validation.ok) {
    writeStderr(
      JSON.stringify({
        ok: false,
        error: { code: validation.code, message: validation.message },
      }),
    );
    return RUNNER_EXIT.CONFIG;
  }

  const runLifecycle = deps.runLifecycle ?? (() => runPrematchLifecycle({ env }));

  try {
    const report = await runLifecycle();
    writeStdout(JSON.stringify(sanitizePrematchLifecycleReport(report)));
    if (report.fatalErrorCount > 0) {
      return RUNNER_EXIT.OPERATIONAL;
    }
    return RUNNER_EXIT.OK;
  } catch (error) {
    writeStderr(
      JSON.stringify({
        ok: false,
        error: {
          code: "lifecycle_uncaught",
          message:
            error instanceof Error
              ? "Uncaught lifecycle failure"
              : "Uncaught lifecycle failure",
        },
      }),
    );
    return RUNNER_EXIT.LIFECYCLE;
  }
}
