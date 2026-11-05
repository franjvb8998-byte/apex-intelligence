/**
 * PE-5.4C increment 7 — offline one-shot transport simulation.
 *
 * Every transport that holds the same registered ledger instance shares one
 * in-process send claim for a committed reservation. The claim follows that
 * instance, not a copied shell and not the reservation string alone. A
 * second ledger instance, or another process that holds the same send proof,
 * is outside this guarantee. Mutable gate state is not a property of the
 * public transport object. The gate does not change ledger occupancy.
 *
 * A complete result may carry one allowlisted quota header. That value lives
 * only in the result. A raw envelope does not store it and cannot rebuild it
 * after a lost acknowledgement, process exit, or replay. A missing header
 * stays missing. Header-dependent classification is not replayable here.
 *
 * A scripted timeout records the duration supplied to createOfflineTransport.
 * The caller copies that duration from the approval. This gate does not read
 * a private approval field or a wall clock, and it does not open a socket.
 */

import { createHash } from "node:crypto";
import { types } from "node:util";

import {
  isRegisteredMemoryLedger,
  matchSendCommit,
  type MatchSendCommitResult,
  type MemoryLedger,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger";
import {
  CANONICAL_OPERATION_PATHS,
  deriveOperationId,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/operation-id";

export const PE5_4C_TRANSPORT_LIMIT = {
  durability: "in-process-only",
  uniqueness: "per-ledger-object-in-process",
  crossProcessUniqueness: false,
  network: false,
  timers: false,
  measuredTimeout: false,
  headerPersistence: false,
  headerReplay: false,
  quotaHeaderInference: false,
  ledgerMutation: false,
  headerReplayNote:
    "Quota headers exist only on a complete in-memory result. A raw envelope does not contain them and cannot rebuild them after a lost acknowledgement, process exit, or replay. Do not invent a missing header, and do not treat a raw envelope as header recovery.",
  timeoutNote:
    "A timeout result is scripted from the supplied duration. It does not measure a network client timeout.",
} as const;

export const TRANSPORT_REASONS = [
  "duplicate_send",
  "redirect_rejected",
  "timeout",
  "cancelled",
  "response_incomplete",
  "outcome_unknown",
  "operation_rejected",
  "invalid_transition",
  "reservation_missing",
  "unavailable",
] as const;

export type TransportReason = (typeof TRANSPORT_REASONS)[number];

export const TRANSPORT_SCRIPTS = [
  "complete",
  "redirect",
  "timeout",
  "cancelled",
  "network_before_bytes",
  "network_after_bytes",
  "incomplete",
  "outcome_unknown",
  "exception",
] as const;

export type TransportScriptName = (typeof TRANSPORT_SCRIPTS)[number];

const QUOTA_HEADER = "x-ratelimit-requests-remaining";
const HEADER_VALUE_LIMIT = 128;

export type TransportQuotaHeader = {
  readonly name: typeof QUOTA_HEADER;
  readonly value: string | number;
};

export type SimulatedRequest = {
  readonly path: (typeof CANONICAL_OPERATION_PATHS)["lineups" | "injuries"];
  readonly query: { readonly fixture: string };
  readonly redirect: "manual";
  readonly fetchTimeoutMs: number;
  readonly signal: AbortSignal;
};

export type ExecuteOfflineSendResult =
  | {
      readonly ok: true;
      readonly outcome: "complete";
      readonly status: number;
      readonly bodyBytes: Uint8Array;
      readonly quotaHeader: TransportQuotaHeader | null;
      readonly request: SimulatedRequest;
    }
  | {
      readonly ok: false;
      readonly reason: TransportReason;
      readonly status?: number;
      readonly request?: SimulatedRequest;
    };

export type TransportAudit = {
  readonly action: "attempt";
  readonly script: TransportScriptName;
  readonly path: SimulatedRequest["path"];
  readonly fixtureId: string;
  readonly redirect: "manual";
  readonly fetchTimeoutMs: number;
  readonly reason?: TransportReason;
  readonly status?: number;
};

export type OfflineTransport = {
  readonly kind: "pe5-offline-transport";
};

const TRANSPORTS = new WeakMap<OfflineTransport, TransportState>();

const INPUT_KEYS = new Set([
  "ledger",
  "reservationId",
  "sendToken",
  "script",
  "request",
  "purpose",
]);

const REQUEST_KEYS = new Set([
  "endpoint",
  "fixtureId",
  "query",
  "url",
  "credentialId",
  "fetchTimeoutMs",
  "baseUrl",
  "headers",
  "purpose",
]);

const COMPLETE_KEYS = new Set(["outcome", "status", "bodyBytes", "headers"]);
const REDIRECT_KEYS = new Set(["outcome", "status", "location", "bodyBytes"]);
const PARTIAL_KEYS = new Set(["outcome", "partialBytes"]);
const EXCEPTION_KEYS = new Set(["outcome", "message"]);
const OPAQUE_KEYS = new Set(["outcome"]);

type OwnRead =
  | { readonly state: "missing" }
  | { readonly state: "unsafe" }
  | { readonly state: "value"; readonly value: unknown };

type SendProof = {
  readonly operationId: string;
  readonly approvalId: string;
  readonly credentialId: string;
  readonly endpoint: "lineups" | "injuries";
  readonly fixtureId: string;
  readonly sendingCommittedAt: number;
};

type Identity = {
  readonly ledger: MemoryLedger;
  readonly reservationId: string;
  readonly sendToken: string;
};

type Prepared =
  | {
      readonly script: "complete";
      readonly status: number;
      readonly bodyBytes: Uint8Array;
      readonly quotaHeader: TransportQuotaHeader | null;
    }
  | { readonly script: "redirect"; readonly status: number }
  | { readonly script: "timeout" | "cancelled" | "outcome_unknown" | "exception" }
  | {
      readonly script: "network_before_bytes" | "network_after_bytes" | "incomplete";
    };

type AuditEntry = {
  action: "attempt";
  script: TransportScriptName;
  path: SimulatedRequest["path"];
  fixtureId: string;
  redirect: "manual";
  fetchTimeoutMs: number;
  reason?: TransportReason;
  status?: number;
};

type TransportState = {
  readonly closed: boolean;
  readonly fetchTimeoutMs: number;
  readonly audits: AuditEntry[];
  tail: Promise<void>;
};

type LedgerClaimGate = {
  readonly claims: Map<string, string>;
  tail: Promise<void>;
};

const LEDGER_CLAIMS = new WeakMap<object, LedgerClaimGate>();

export function createOfflineTransport(config: unknown): OfflineTransport {
  const parsed = parseConfig(config);
  const state: TransportState = {
    closed: !parsed.ok,
    fetchTimeoutMs: parsed.ok ? parsed.fetchTimeoutMs : 0,
    audits: [],
    tail: Promise.resolve(),
  };
  const transport: OfflineTransport = { kind: "pe5-offline-transport" };
  TRANSPORTS.set(transport, state);
  return Object.freeze(transport);
}

export async function executeOfflineSend(
  transport: OfflineTransport,
  input: unknown,
): Promise<ExecuteOfflineSendResult> {
  return enqueue(transport, (state) => runSend(state, input));
}

export async function readTransportAudit(
  transport: OfflineTransport,
): Promise<
  { readonly ok: true; readonly audits: readonly TransportAudit[] } | { readonly ok: false; readonly reason: "unavailable" }
> {
  return enqueue(transport, async (state) => {
    if (state.closed) return { ok: true as const, audits: [] };
    return {
      ok: true as const,
      audits: state.audits.map((entry) => ({ ...entry })),
    };
  });
}

async function runSend(state: TransportState, input: unknown): Promise<ExecuteOfflineSendResult> {
  if (state.closed) return fail("operation_rejected");
  const parsed = parseIdentity(input);
  if (!parsed.ok) return fail("operation_rejected");
  const identity = parsed.value;

  return withLedgerClaims(identity.ledger, async (claims) => {
    const digest = tokenDigest(identity.sendToken);
    const prior = claims.get(identity.reservationId);
    if (prior != null) {
      return fail(prior === digest ? "duplicate_send" : "invalid_transition");
    }

    let proof: MatchSendCommitResult;
    try {
      proof = await matchSendCommit(identity.ledger, {
        reservationId: identity.reservationId,
        sendToken: identity.sendToken,
      });
    } catch {
      return fail("unavailable");
    }
    if (!proof.ok) return mapProof(proof);
    if (!canonicalProof(identity.ledger, proof)) return fail("operation_rejected");
    if (!echoAllowed(input, proof, state.fetchTimeoutMs)) return fail("operation_rejected");

    const prepared = parseScript(input);
    if (!prepared.ok) return fail("operation_rejected");

    claims.set(identity.reservationId, digest);
    try {
      return finish(state, proof, prepared.value);
    } catch {
      return recordAttempt(state, proof, {
        script: "exception",
        reason: "outcome_unknown",
      });
    }
  });
}

function finish(
  state: TransportState,
  proof: SendProof,
  prepared: Prepared,
): ExecuteOfflineSendResult {
  if (prepared.script === "complete") {
    const request = simulatedRequest(state, proof, false);
    state.audits.push({
      action: "attempt",
      script: "complete",
      path: request.path,
      fixtureId: proof.fixtureId,
      redirect: "manual",
      fetchTimeoutMs: request.fetchTimeoutMs,
      status: prepared.status,
    });
    return Object.freeze({
      ok: true as const,
      outcome: "complete" as const,
      status: prepared.status,
      bodyBytes: prepared.bodyBytes,
      quotaHeader: prepared.quotaHeader,
      request,
    });
  }

  if (prepared.script === "redirect") {
    return recordAttempt(state, proof, {
      script: "redirect",
      reason: "redirect_rejected",
      status: prepared.status,
      aborted: false,
    });
  }

  if (prepared.script === "timeout" || prepared.script === "cancelled") {
    return recordAttempt(state, proof, {
      script: prepared.script,
      reason: prepared.script,
    });
  }

  if (
    prepared.script === "network_before_bytes" ||
    prepared.script === "network_after_bytes" ||
    prepared.script === "incomplete"
  ) {
    return recordAttempt(state, proof, {
      script: prepared.script,
      reason: "response_incomplete",
    });
  }

  return recordAttempt(state, proof, {
    script: prepared.script,
    reason: "outcome_unknown",
  });
}

function recordAttempt(
  state: TransportState,
  proof: SendProof,
  outcome: {
    readonly script: TransportScriptName;
    readonly reason: TransportReason;
    readonly status?: number;
    readonly aborted?: boolean;
  },
): ExecuteOfflineSendResult {
  const request = simulatedRequest(state, proof, outcome.aborted !== false);
  const entry: AuditEntry = {
    action: "attempt",
    script: outcome.script,
    path: request.path,
    fixtureId: proof.fixtureId,
    redirect: "manual",
    fetchTimeoutMs: request.fetchTimeoutMs,
    reason: outcome.reason,
  };
  if (outcome.status != null) entry.status = outcome.status;
  state.audits.push(entry);
  const result: {
    ok: false;
    reason: TransportReason;
    request: SimulatedRequest;
    status?: number;
  } = {
    ok: false,
    reason: outcome.reason,
    request,
  };
  if (outcome.status != null) result.status = outcome.status;
  return Object.freeze(result);
}

function simulatedRequest(
  state: TransportState,
  proof: SendProof,
  aborted: boolean,
): SimulatedRequest {
  const controller = new AbortController();
  if (aborted) controller.abort();
  return Object.freeze({
    path: CANONICAL_OPERATION_PATHS[proof.endpoint],
    query: Object.freeze({ fixture: proof.fixtureId }),
    redirect: "manual" as const,
    fetchTimeoutMs: state.fetchTimeoutMs,
    signal: controller.signal,
  });
}

function mapProof(proof: Exclude<MatchSendCommitResult, { ok: true }>): ExecuteOfflineSendResult {
  if (proof.reason === "unavailable") return fail("unavailable");
  if (proof.denyReason === "reservation_missing") return fail("reservation_missing");
  if (proof.denyReason === "invalid_transition") return fail("invalid_transition");
  return fail("operation_rejected");
}

function canonicalProof(ledger: MemoryLedger, proof: SendProof): boolean {
  try {
    const derived = deriveOperationId(
      {
        ledgerInstanceId: ledger.instanceId,
        credentialId: proof.credentialId,
        approvalId: proof.approvalId,
        generation: ledger.generation,
      },
      { endpoint: proof.endpoint, fixtureId: proof.fixtureId },
    );
    return derived.ok && derived.operationId === proof.operationId;
  } catch {
    return false;
  }
}

function parseConfig(
  config: unknown,
): { ok: true; fetchTimeoutMs: number } | { ok: false } {
  if (!isDataObject(config)) return { ok: false };
  const names = ownNames(config);
  if (names == null || names.length !== 1 || names[0] !== "fetchTimeoutMs") return { ok: false };
  const read = readOwn(config, "fetchTimeoutMs");
  if (read.state !== "value" || !isPositiveMillis(read.value)) return { ok: false };
  return { ok: true, fetchTimeoutMs: read.value };
}

function parseIdentity(input: unknown): { ok: true; value: Identity } | { ok: false } {
  if (!isDataObject(input)) return { ok: false };
  const names = ownNames(input);
  if (names == null || names.length === 0) return { ok: false };
  for (const name of names) {
    if (!INPUT_KEYS.has(name)) return { ok: false };
  }
  const ledger = readOwn(input, "ledger");
  const reservationId = readOwn(input, "reservationId");
  const sendToken = readOwn(input, "sendToken");
  const purpose = readOwn(input, "purpose");
  if (ledger.state !== "value" || !isLedger(ledger.value)) return { ok: false };
  if (reservationId.state !== "value" || !isIdentity(reservationId.value)) return { ok: false };
  if (sendToken.state !== "value" || !isIdentity(sendToken.value)) return { ok: false };
  if (purpose.state === "unsafe") return { ok: false };
  if (purpose.state === "value" && typeof purpose.value !== "string") return { ok: false };
  return {
    ok: true,
    value: {
      ledger: ledger.value,
      reservationId: reservationId.value,
      sendToken: sendToken.value,
    },
  };
}

function echoAllowed(input: unknown, proof: SendProof, fetchTimeoutMs: number): boolean {
  if (!isDataObject(input)) return false;
  const request = readOwn(input, "request");
  if (request.state === "unsafe") return false;
  if (request.state === "missing") return true;
  if (!isDataObject(request.value)) return false;
  const names = ownNames(request.value);
  if (names == null) return false;
  for (const name of names) {
    if (!REQUEST_KEYS.has(name)) return false;
  }
  if (names.includes("baseUrl") || names.includes("headers")) return false;

  const endpoint = readOwn(request.value, "endpoint");
  if (endpoint.state === "unsafe") return false;
  if (endpoint.state === "value" && endpoint.value !== proof.endpoint) return false;

  const fixtureId = readOwn(request.value, "fixtureId");
  if (fixtureId.state === "unsafe") return false;
  if (fixtureId.state === "value" && fixtureId.value !== proof.fixtureId) return false;

  const credentialId = readOwn(request.value, "credentialId");
  if (credentialId.state === "unsafe") return false;
  if (credentialId.state === "value" && credentialId.value !== proof.credentialId) return false;

  const timeout = readOwn(request.value, "fetchTimeoutMs");
  if (timeout.state === "unsafe") return false;
  if (timeout.state === "value" && !Object.is(timeout.value, fetchTimeoutMs)) return false;

  const purpose = readOwn(request.value, "purpose");
  if (purpose.state === "unsafe") return false;
  if (purpose.state === "value" && typeof purpose.value !== "string") return false;

  const query = readOwn(request.value, "query");
  if (query.state === "unsafe") return false;
  if (query.state === "value" && !queryMatches(query.value, proof.fixtureId)) return false;

  const url = readOwn(request.value, "url");
  if (url.state === "unsafe") return false;
  if (url.state === "value" && url.value !== expectedUrl(proof)) return false;
  return true;
}

function queryMatches(query: unknown, fixtureId: string): boolean {
  if (!isDataObject(query)) return false;
  const names = ownNames(query);
  if (names == null || names.length !== 1 || names[0] !== "fixture") return false;
  const fixture = readOwn(query, "fixture");
  return fixture.state === "value" && fixture.value === fixtureId;
}

function expectedUrl(proof: SendProof): string {
  return `${CANONICAL_OPERATION_PATHS[proof.endpoint]}?fixture=${proof.fixtureId}`;
}

function parseScript(input: unknown): { ok: true; value: Prepared } | { ok: false } {
  if (!isDataObject(input)) return { ok: false };
  const script = readOwn(input, "script");
  if (script.state !== "value" || typeof script.value === "function" || !isDataObject(script.value)) {
    return { ok: false };
  }
  const names = ownNames(script.value);
  if (names == null || !names.includes("outcome")) return { ok: false };
  const outcome = readOwn(script.value, "outcome");
  if (outcome.state !== "value" || typeof outcome.value !== "string") return { ok: false };

  if (outcome.value === "complete") return parseComplete(script.value, names);
  if (outcome.value === "redirect") return parseRedirect(script.value, names);
  if (outcome.value === "timeout" || outcome.value === "cancelled" || outcome.value === "outcome_unknown") {
    if (!keysWithin(names, OPAQUE_KEYS)) return { ok: false };
    return { ok: true, value: { script: outcome.value } };
  }
  if (
    outcome.value === "network_before_bytes" ||
    outcome.value === "network_after_bytes" ||
    outcome.value === "incomplete"
  ) {
    const allowed = outcome.value === "network_before_bytes" ? OPAQUE_KEYS : PARTIAL_KEYS;
    if (!keysWithin(names, allowed)) return { ok: false };
    return { ok: true, value: { script: outcome.value } };
  }
  if (outcome.value === "exception") {
    if (!keysWithin(names, EXCEPTION_KEYS)) return { ok: false };
    return { ok: true, value: { script: "exception" } };
  }
  return { ok: false };
}

function parseComplete(script: object, names: readonly string[]): { ok: true; value: Prepared } | { ok: false } {
  if (!keysWithin(names, COMPLETE_KEYS)) return { ok: false };
  const status = readStatus(script);
  if (status == null) return { ok: false };
  if (status >= 300 && status <= 399) return { ok: true, value: { script: "redirect", status } };
  const body = readOwn(script, "bodyBytes");
  if (body.state !== "value") return { ok: false };
  const bodyBytes = copyBytes(body.value);
  if (bodyBytes == null) return { ok: false };
  const quota = readQuotaHeader(script);
  if (!quota.ok) return { ok: false };
  return {
    ok: true,
    value: { script: "complete", status, bodyBytes, quotaHeader: quota.header },
  };
}

function parseRedirect(script: object, names: readonly string[]): { ok: true; value: Prepared } | { ok: false } {
  if (!keysWithin(names, REDIRECT_KEYS)) return { ok: false };
  const status = readStatus(script);
  if (status == null || status < 300 || status > 399) return { ok: false };
  return { ok: true, value: { script: "redirect", status } };
}

function readQuotaHeader(
  script: object,
): { ok: true; header: TransportQuotaHeader | null } | { ok: false } {
  const headers = readOwn(script, "headers");
  if (headers.state === "missing") return { ok: true, header: null };
  if (headers.state !== "value" || !isDataObject(headers.value)) return { ok: false };
  const names = ownNames(headers.value);
  if (names == null) return { ok: false };
  if (names.length === 0) return { ok: true, header: null };
  if (names.length !== 1 || names[0] !== QUOTA_HEADER) return { ok: false };
  const value = readOwn(headers.value, QUOTA_HEADER);
  if (value.state !== "value") return { ok: false };
  const copied = copyHeaderValue(value.value);
  if (copied == null) return { ok: false };
  return {
    ok: true,
    header: Object.freeze({ name: QUOTA_HEADER, value: copied }),
  };
}

function copyHeaderValue(value: unknown): string | number | null {
  if (typeof value === "string") {
    return value.length <= HEADER_VALUE_LIMIT ? value : null;
  }
  if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return value;
  return null;
}

function readStatus(script: object): number | null {
  const status = readOwn(script, "status");
  if (status.state !== "value" || typeof status.value !== "number" || !Number.isInteger(status.value)) {
    return null;
  }
  if (status.value < 100 || status.value > 599) return null;
  return status.value;
}

function copyBytes(value: unknown): Uint8Array | null {
  if (!isPlainUint8Array(value)) return null;
  try {
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return copy.byteLength === value.byteLength ? copy : null;
  } catch {
    return null;
  }
}

function isPlainUint8Array(value: unknown): value is Uint8Array {
  try {
    if (types.isProxy(value) === true) return false;
    if (types.isUint8Array(value) !== true) return false;
    if (Object.getOwnPropertyDescriptor(value, "constructor") != null) return false;
    if (Object.getOwnPropertyDescriptor(value, "byteLength") != null) return false;
    return Object.getPrototypeOf(value) === Uint8Array.prototype;
  } catch {
    return false;
  }
}

function keysWithin(names: readonly string[], allowed: ReadonlySet<string>): boolean {
  return names.every((name) => allowed.has(name));
}

function tokenDigest(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function isLedger(value: unknown): value is MemoryLedger {
  return isRegisteredMemoryLedger(value);
}

function isPositiveMillis(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value && !/[\r\n]/.test(value);
}

function isDataObject(value: unknown): value is object {
  if (!isSafeObject(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function isSafeObject(value: unknown): value is object {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    return types.isProxy(value) !== true;
  } catch {
    return false;
  }
}

function ownNames(record: object): string[] | null {
  try {
    if (Object.getOwnPropertySymbols(record).length !== 0) return null;
    return Object.getOwnPropertyNames(record);
  } catch {
    return null;
  }
}

function readOwn(record: object, key: string): OwnRead {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, key);
  } catch {
    return { state: "unsafe" };
  }
  if (descriptor == null) return { state: "missing" };
  if (!Object.hasOwn(descriptor, "value")) return { state: "unsafe" };
  return { state: "value", value: descriptor.value };
}

function ledgerClaimGate(ledger: object): LedgerClaimGate {
  let gate = LEDGER_CLAIMS.get(ledger);
  if (gate == null) {
    gate = { claims: new Map(), tail: Promise.resolve() };
    LEDGER_CLAIMS.set(ledger, gate);
  }
  return gate;
}

async function withLedgerClaims<T>(
  ledger: object,
  body: (claims: Map<string, string>) => Promise<T>,
): Promise<T> {
  const gate = ledgerClaimGate(ledger);
  const previous = gate.tail;
  let release: () => void = () => {};
  gate.tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await body(gate.claims);
  } finally {
    release();
  }
}

function fail(reason: TransportReason): ExecuteOfflineSendResult {
  return { ok: false, reason };
}

async function enqueue<T extends { ok: boolean }>(
  transport: OfflineTransport,
  body: (state: TransportState) => Promise<T>,
): Promise<T> {
  const state = readState(transport);
  if (state == null) return { ok: false, reason: "unavailable" } as unknown as T;
  const previous = state.tail;
  let release: () => void = () => {};
  state.tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await body(state);
  } catch {
    return { ok: false, reason: "unavailable" } as unknown as T;
  } finally {
    release();
  }
}

function readState(transport: OfflineTransport): TransportState | null {
  try {
    if (transport == null || typeof transport !== "object") return null;
    if (types.isProxy(transport) === true) return null;
    const kind = readOwn(transport, "kind");
    if (kind.state !== "value" || kind.value !== "pe5-offline-transport") return null;
    return TRANSPORTS.get(transport) ?? null;
  } catch {
    return null;
  }
}
