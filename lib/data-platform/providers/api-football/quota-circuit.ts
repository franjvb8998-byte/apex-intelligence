/**
 * Process-wide API-Football daily-quota circuit.
 *
 * Daily exhaustion fail-fasts later origin calls in this Node process.
 * Per-minute 429 / "too many requests" does NOT open the daily circuit.
 * 5xx / network never open it.
 */

import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import {
  apiFootballVendorErrorText,
  isApiFootballRateLimitError,
  isApiFootballRateLimitMessage,
} from "@/lib/data-platform/providers/api-football/cache-policy";

export type ApiFootballQuotaKind = "daily" | "rate_limit";

const CIRCUIT_SLOT = Symbol.for("apex.apiFootball.dailyQuotaCircuit");

const DEFAULT_DAILY_MESSAGE =
  "API-Football daily request quota is exhausted";

type QuotaCircuitState = {
  dailyExhausted: boolean;
  message: string;
  originCalls: number;
};

type CircuitGlobal = typeof globalThis & {
  [CIRCUIT_SLOT]?: QuotaCircuitState;
};

function emptyState(): QuotaCircuitState {
  return {
    dailyExhausted: false,
    message: DEFAULT_DAILY_MESSAGE,
    originCalls: 0,
  };
}

function circuitState(): QuotaCircuitState {
  const g = globalThis as CircuitGlobal;
  if (!g[CIRCUIT_SLOT]) g[CIRCUIT_SLOT] = emptyState();
  return g[CIRCUIT_SLOT];
}

const DAILY_QUOTA_RE =
  /for the day|daily (?:quota|limit)|upgrade your plan/i;

function headerValue(
  headers: Headers | null | undefined,
  name: string,
): string | null {
  if (!headers || typeof headers.get !== "function") return null;
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

function remainingHeader(
  headers: Headers | null | undefined,
  names: string[],
): number | null {
  for (const name of names) {
    const raw = headerValue(headers, name);
    if (raw == null || raw === "") continue;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Classify a vendor failure as daily quota vs temporary per-minute limit.
 * Returns null when the signal is not a quota/rate-limit event.
 */
export function classifyApiFootballQuotaSignal(input: {
  message?: string | null;
  status?: number | null;
  headers?: Headers | null;
  payload?: unknown;
}): ApiFootballQuotaKind | null {
  const dailyRemaining = remainingHeader(input.headers, [
    "x-ratelimit-requests-remaining",
    "X-RateLimit-Requests-Remaining",
  ]);
  if (dailyRemaining === 0) return "daily";

  const payloadText = apiFootballVendorErrorText(input.payload);
  const message = [input.message, payloadText].filter(Boolean).join(" ");

  if (message && DAILY_QUOTA_RE.test(message)) return "daily";

  const minuteRemaining = remainingHeader(input.headers, [
    "x-ratelimit-remaining",
    "X-RateLimit-Remaining",
  ]);
  if (input.status === 429 && minuteRemaining === 0) return "rate_limit";

  if (message && isApiFootballRateLimitMessage(message)) return "rate_limit";
  if (input.status === 429) return "rate_limit";
  return null;
}

export function isApiFootballDailyQuotaExhausted(): boolean {
  return circuitState().dailyExhausted;
}

export function noteApiFootballQuotaSignal(input: {
  message?: string | null;
  status?: number | null;
  headers?: Headers | null;
  payload?: unknown;
  error?: unknown;
}): ApiFootballQuotaKind | null {
  const error = input.error;
  const fromError =
    error && typeof error === "object"
      ? (error as { message?: unknown; status?: unknown; details?: unknown })
      : null;
  const kind = classifyApiFootballQuotaSignal({
    message:
      input.message ??
      (typeof fromError?.message === "string" ? fromError.message : null),
    status:
      input.status ??
      (typeof fromError?.status === "number" ? fromError.status : null),
    headers: input.headers,
    payload: input.payload ?? fromError?.details,
  });
  if (kind === "daily") {
    const state = circuitState();
    state.dailyExhausted = true;
    const text =
      input.message ??
      (typeof fromError?.message === "string" ? fromError.message : null) ??
      apiFootballVendorErrorText(input.payload ?? fromError?.details);
    if (text && text.trim()) state.message = text;
  }
  return kind;
}

export function noteApiFootballQuotaFromError(error: unknown): void {
  noteApiFootballQuotaSignal({ error });
}

/**
 * Fail fast with an identifiable ApiFootballError. Does not touch origin.
 */
export function throwIfApiFootballDailyQuotaExhausted(): void {
  const state = circuitState();
  if (!state.dailyExhausted) return;
  throw new ApiFootballError({
    message: state.message,
    code: "rate_limited",
    status: 429,
  });
}

export function noteApiFootballOriginCall(): void {
  circuitState().originCalls += 1;
}

export function getApiFootballOriginCallCountForTests(): number {
  return circuitState().originCalls;
}

export function resetApiFootballQuotaCircuitForTests(): void {
  (globalThis as CircuitGlobal)[CIRCUIT_SLOT] = emptyState();
}

export function isQuotaErrorStillIdentifiable(error: unknown): boolean {
  return isApiFootballRateLimitError(error);
}
