/**
 * Server-only automatic prematch lifecycle configuration.
 * Never expose these values via NEXT_PUBLIC_*.
 */

export const LIFECYCLE_LEAGUE_IDS_ENV = "APEX_LIFECYCLE_LEAGUE_IDS";
export const LIFECYCLE_MAX_NEW_TICKETS_ENV =
  "APEX_LIFECYCLE_MAX_NEW_TICKETS_PER_RUN";
export const LIFECYCLE_CRON_SECRET_ENV = "APEX_LIFECYCLE_CRON_SECRET";

export const DEFAULT_MAX_NEW_TICKETS_PER_RUN = 10;
export const MAX_NEW_TICKETS_PER_RUN_CEILING = 50;

/** Inclusive lower bound for pending-ticket SELECT. Not a rolling age-out. */
export const PENDING_TICKET_EPOCH_UTC = "1970-01-01T00:00:00.000Z";
export const TICKET_LIST_PAGE_SIZE = 100;
export const MAX_TICKET_LIST_PAGES_PER_RUN = 20;
/** Provider ids-batch cap: 3 * MAX_FIXTURES_PER_BATCH (15). */
export const MAX_IDS_RECONCILE_PER_RUN = 45;

export type PrematchLifecycleConfig = {
  leagueIds: string[];
  maxNewTicketsPerRun: number;
  leagueAllowlistInvalid: boolean;
};

export type LifecycleLeagueAllowlist = {
  leagueIds: string[];
  invalid: boolean;
};

function parsePositiveIntegerId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Strict allowlist. Any non-empty invalid token fail-closes the entire
 * list so automatic capture cannot silently ignore operator typos.
 * Missing/empty remains zero capture (not worldwide).
 */
export function parseLifecycleLeagueIds(
  raw: string | null | undefined,
): LifecycleLeagueAllowlist {
  if (raw == null || !raw.trim()) {
    return { leagueIds: [], invalid: false };
  }
  const unique = new Set<string>();
  let invalid = false;
  for (const part of raw.split(/[,\s]+/)) {
    if (!part) continue;
    const id = parsePositiveIntegerId(part);
    if (!id) {
      invalid = true;
      continue;
    }
    unique.add(id);
  }
  if (invalid) {
    return { leagueIds: [], invalid: true };
  }
  return {
    leagueIds: [...unique].sort((a, b) => Number(a) - Number(b)),
    invalid: false,
  };
}

/**
 * Positive integer 1..50. Values above 50 clamp to 50.
 * Missing, decimal, zero, negative, or non-integer → default 10.
 */
export function parseMaxNewTicketsPerRun(
  raw: string | null | undefined,
): number {
  if (raw == null || !raw.trim()) return DEFAULT_MAX_NEW_TICKETS_PER_RUN;
  const trimmed = raw.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return DEFAULT_MAX_NEW_TICKETS_PER_RUN;
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return DEFAULT_MAX_NEW_TICKETS_PER_RUN;
  }
  return Math.min(parsed, MAX_NEW_TICKETS_PER_RUN_CEILING);
}

export function readPrematchLifecycleConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): PrematchLifecycleConfig {
  const allowlist = parseLifecycleLeagueIds(env[LIFECYCLE_LEAGUE_IDS_ENV]);
  return {
    leagueIds: allowlist.leagueIds,
    maxNewTicketsPerRun: parseMaxNewTicketsPerRun(
      env[LIFECYCLE_MAX_NEW_TICKETS_ENV],
    ),
    leagueAllowlistInvalid: allowlist.invalid,
  };
}

export function readPrematchLifecycleCronSecret(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | null {
  const secret = env[LIFECYCLE_CRON_SECRET_ENV]?.trim();
  return secret ? secret : null;
}

/** API-Football fixture ids are positive integers. Synthetic tests may inject others. */
export function isNumericLifecycleFixtureId(
  fixtureId: string | null | undefined,
): boolean {
  return Boolean(fixtureId && /^[1-9]\d*$/.test(fixtureId));
}
