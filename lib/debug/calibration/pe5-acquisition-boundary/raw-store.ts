/**
 * PE-5.4C increment 6 — in-memory append-only raw envelopes.
 *
 * A successful append is visible to a later read on this same store instance.
 * It does not persist to disk, survive process exit, or provide cross-process
 * uniqueness or recovery. It does not know a provider's daily reset.
 *
 * `matchSendCommit` and the append are separate queue turns. They are not one
 * crash-atomic transaction. The store does not change ledger occupancy or
 * reservation state, and it does not parse or classify the bytes.
 *
 * The capture clock is the ledger clock at acceptance. This module does not
 * read the process wall clock and does not keep a second clock. `maxCaptureLagMs` is store
 * policy, not an approval field. No production lag threshold is defined here.
 */

import { createHash } from "node:crypto";
import { types } from "node:util";

import { deriveOperationId } from "@/lib/debug/calibration/pe5-acquisition-boundary/operation-id";
import {
  matchSendCommit,
  readLedgerNow,
  type MemoryLedger,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger";

export const PE5_4C_RAW_STORE_LIMIT = {
  durability: "in-process-only",
  visibility: "same-instance-only",
  atomicity: "single-process-serialized-queue",
  ledgerBinding: "match-then-append-not-crash-atomic",
  crossProcessUniqueness: false,
  diskPersistence: false,
  processSurvival: false,
  providerDayBoundary: false,
} as const;

export const RAW_STORE_REASONS = [
  "raw_missing",
  "raw_conflict",
  "clock_unavailable",
  "operation_rejected",
  "invalid_transition",
  "unavailable",
  "ambiguous",
  "integrity_mismatch",
] as const;

export type RawStoreReason = (typeof RAW_STORE_REASONS)[number];

export type RawEnvelopeView = {
  readonly operationId: string;
  readonly envelopeId: string;
  readonly reservationId: string;
  readonly credentialId: string;
  readonly approvalId: string;
  readonly endpoint: "lineups" | "injuries";
  readonly fixtureId: string;
  readonly status: number;
  readonly byteLength: number;
  readonly digest: string;
  readonly capturedAtUtc: string | null;
  readonly captureTimestampVerified: boolean;
};

export type AppendRawResult =
  | { readonly ok: true; readonly duplicate: boolean; readonly envelope: RawEnvelopeView }
  | { readonly ok: false; readonly reason: RawStoreReason };

export type ReadRawResult =
  | { readonly ok: true; readonly envelope: RawEnvelopeView; readonly bodyBytes: Uint8Array }
  | { readonly ok: false; readonly reason: RawStoreReason };

export type RawStoreAudit = {
  readonly action: string;
  readonly operationId?: string;
  readonly envelopeId?: string;
  readonly reservationId?: string;
  readonly reason?: string;
  readonly status?: number;
};

export type RawStore = {
  readonly kind: "pe5-raw-store";
};

const STATE_KEY = Symbol.for("apex.pe5.acquisition-boundary.raw-store.state.v1");
const STATE_KIND = "pe5-raw-store-state" as const;
const OPERATION_ID = /^[0-9a-f]{64}$/;
const CAPTURE_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;

const CLOCK_KEYS = new Set([
  "capturedAtUtc",
  "timestamp",
  "fetchedAt",
  "workerCapturedAtUtc",
  "kickoffUtc",
]);

const APPEND_KEYS = new Set([
  "reservationId",
  "sendToken",
  "status",
  "bodyBytes",
  "operationId",
  "endpoint",
  "fixtureId",
  "approvalId",
  "credentialId",
  "maxCaptureLagMs",
  ...CLOCK_KEYS,
]);

const READ_KEYS = new Set(["envelopeId", "operationId"]);

type LagState =
  | { readonly state: "absent" }
  | { readonly state: "bound"; readonly maxCaptureLagMs: number }
  | { readonly state: "invalid" };

type StoredEnvelope = {
  operationId: string;
  envelopeId: string;
  reservationId: string;
  credentialId: string;
  approvalId: string;
  endpoint: "lineups" | "injuries";
  fixtureId: string;
  status: number;
  byteLength: number;
  digest: string;
  capturedAtUtc: string | null;
  captureTimestampVerified: boolean;
  bytes: Uint8Array;
};

type StoreAuditEntry = {
  action: string;
  operationId?: string;
  envelopeId?: string;
  reservationId?: string;
  reason?: string;
  status?: number;
};

type StoreState = {
  readonly kind: typeof STATE_KIND;
  closed: "unavailable" | null;
  lag: LagState;
  ledger: MemoryLedger | null;
  readonly records: Map<string, StoredEnvelope>;
  readonly byEnvelope: Map<string, string>;
  tail: Promise<void>;
  unavailable: boolean;
  loseNextAck: boolean;
  failNext: boolean;
  partialNext: boolean;
  ambiguousNextRead: boolean;
  audits: StoreAuditEntry[];
};

type AppendFields = {
  reservationId: string;
  sendToken: string;
  status: number;
  bodyBytes: Uint8Array;
  echoes: {
    operationId?: string;
    endpoint?: string;
    fixtureId?: string;
    approvalId?: string;
    credentialId?: string;
  };
  suppliedLag: unknown | undefined;
};

type OwnRead =
  | { readonly state: "missing" }
  | { readonly state: "unsafe" }
  | { readonly state: "value"; readonly value: unknown };

export function createRawStore(config: unknown): RawStore {
  const parsed = parseStoreConfig(config);
  const state: StoreState = {
    kind: STATE_KIND,
    closed: parsed.closed,
    lag: parsed.lag,
    ledger: parsed.ledger,
    records: new Map(),
    byEnvelope: new Map(),
    tail: Promise.resolve(),
    unavailable: false,
    loseNextAck: false,
    failNext: false,
    partialNext: false,
    ambiguousNextRead: false,
    audits: [],
  };
  const store: RawStore = { kind: "pe5-raw-store" };
  Object.defineProperty(store, STATE_KEY, {
    value: state,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(store);
}

export async function appendRaw(store: RawStore, input: unknown): Promise<AppendRawResult> {
  const parsed = parseAppend(input);
  if (!parsed.ok) return parsed;
  return enqueue(store, (state) => commitAppend(state, parsed.fields));
}

export async function readRaw(store: RawStore, query: unknown): Promise<ReadRawResult> {
  const parsed = parseRead(query);
  if (!parsed.ok) return parsed;
  return enqueue(store, (state) => commitRead(state, parsed.query));
}

export async function readRawStoreAudit(
  store: RawStore,
): Promise<{ readonly ok: true; readonly audits: readonly RawStoreAudit[] } | { readonly ok: false; readonly reason: "unavailable" }> {
  return enqueue(store, async (state) => {
    if (state.closed === "unavailable" || state.unavailable) {
      return { ok: false as const, reason: "unavailable" as const };
    }
    return { ok: true as const, audits: state.audits.map(viewAudit) };
  });
}

/** Simulator control. Not a durable-store fault, and not an evidence API. */
export async function setRawStoreUnavailable(
  store: RawStore,
  unavailable: boolean,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return enqueue(store, async (state) => {
    if (state.closed === "unavailable") return { ok: false as const, reason: "unavailable" as const };
    state.unavailable = unavailable;
    return { ok: true as const };
  });
}

/** Next new append fails before any record becomes visible. */
export async function armRawAppendFailure(
  store: RawStore,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return arm(store, (state) => {
    state.failNext = true;
  });
}

/** Next new append stops before publication. No partial record is visible. */
export async function armRawPartialAppend(
  store: RawStore,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return arm(store, (state) => {
    state.partialNext = true;
  });
}

/** Next new append commits, then withholds the acknowledgement. */
export async function armLostAppendAcknowledgement(
  store: RawStore,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return arm(store, (state) => {
    state.loseNextAck = true;
  });
}

/** Next read is ambiguous and is not evidence that a record is absent. */
export async function armAmbiguousRawRead(
  store: RawStore,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return arm(store, (state) => {
    state.ambiguousNextRead = true;
  });
}

/**
 * Simulator fault injection. Flips stored bytes without updating the digest.
 * This is not an overwrite, replace, or delete API.
 */
export async function corruptStoredBytesForTests(
  store: RawStore,
  operationId: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: RawStoreReason }> {
  return enqueue(store, async (state) => {
    if (state.closed === "unavailable" || state.unavailable) {
      return { ok: false as const, reason: "unavailable" as const };
    }
    if (!OPERATION_ID.test(operationId)) return { ok: false as const, reason: "operation_rejected" as const };
    const record = state.records.get(operationId);
    if (record == null) return { ok: false as const, reason: "raw_missing" as const };
    if (record.bytes.byteLength === 0) {
      record.bytes = Uint8Array.of(0xff);
    } else {
      const flipped = new Uint8Array(record.bytes);
      flipped[0] = flipped[0] ^ 0xff;
      record.bytes = flipped;
    }
    return { ok: true as const };
  });
}

async function arm(
  store: RawStore,
  apply: (state: StoreState) => void,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return enqueue(store, async (state) => {
    if (state.closed === "unavailable" || state.unavailable) {
      return { ok: false as const, reason: "unavailable" as const };
    }
    apply(state);
    return { ok: true as const };
  });
}

async function commitAppend(state: StoreState, fields: AppendFields): Promise<AppendRawResult> {
  if (state.closed === "unavailable" || state.unavailable) return fail("unavailable");
  if (state.lag.state === "invalid") return fail("operation_rejected");
  if (state.ledger == null) return fail("unavailable");
  if (!lagEchoAllowed(state.lag, fields.suppliedLag)) return fail("operation_rejected");

  const proof = await matchSendCommit(state.ledger, {
    reservationId: fields.reservationId,
    sendToken: fields.sendToken,
  });
  if (!proof.ok) return fail(mapProofFailure(proof));
  if (!echoesMatch(fields, proof)) return fail("operation_rejected");

  const derived = deriveCanonical(state.ledger, proof);
  if (derived == null || derived !== proof.operationId) return fail("operation_rejected");

  const existing = state.records.get(proof.operationId);
  if (existing != null) return duplicateResult(state, existing, fields.bodyBytes);

  if (state.failNext) {
    state.failNext = false;
    audit(state, {
      action: "append_rejected",
      reason: "raw_missing",
      reservationId: fields.reservationId,
    });
    return fail("raw_missing");
  }

  const nowRead = await readLedgerNow(state.ledger);
  if (!nowRead.ok) {
    return fail(nowRead.reason === "clock_unavailable" ? "clock_unavailable" : "unavailable");
  }
  if (nowRead.now < proof.sendingCommittedAt) return fail("clock_unavailable");
  const clock = sealClock(nowRead.now, proof.sendingCommittedAt, state.lag);
  if (clock == null) return fail("clock_unavailable");

  if (state.partialNext) {
    state.partialNext = false;
    audit(state, {
      action: "append_rejected",
      reason: "raw_missing",
      reservationId: fields.reservationId,
    });
    return fail("raw_missing");
  }

  if (state.records.has(proof.operationId)) {
    const raced = state.records.get(proof.operationId);
    if (raced == null) return fail("unavailable");
    return duplicateResult(state, raced, fields.bodyBytes);
  }

  const digest = digestOf(fields.bodyBytes);
  if (digest == null) return fail("unavailable");
  const envelopeId = `env-${proof.operationId}`;
  const record: StoredEnvelope = {
    operationId: proof.operationId,
    envelopeId,
    reservationId: fields.reservationId,
    credentialId: proof.credentialId,
    approvalId: proof.approvalId,
    endpoint: proof.endpoint,
    fixtureId: proof.fixtureId,
    status: fields.status,
    byteLength: fields.bodyBytes.byteLength,
    digest,
    capturedAtUtc: clock.capturedAtUtc,
    captureTimestampVerified: clock.captureTimestampVerified,
    bytes: fields.bodyBytes,
  };
  state.records.set(record.operationId, record);
  state.byEnvelope.set(record.envelopeId, record.operationId);
  audit(state, {
    action: "append",
    operationId: record.operationId,
    envelopeId: record.envelopeId,
    reservationId: record.reservationId,
    status: record.status,
  });

  if (state.loseNextAck) {
    state.loseNextAck = false;
    audit(state, {
      action: "ack_withheld",
      operationId: record.operationId,
      envelopeId: record.envelopeId,
      reservationId: record.reservationId,
      reason: "ambiguous",
    });
    return fail("ambiguous");
  }
  return { ok: true, duplicate: false, envelope: view(record) };
}

function duplicateResult(
  state: StoreState,
  existing: StoredEnvelope,
  incoming: Uint8Array,
): AppendRawResult {
  if (!integrityOk(existing)) {
    audit(state, {
      action: "append_rejected",
      operationId: existing.operationId,
      envelopeId: existing.envelopeId,
      reason: "integrity_mismatch",
    });
    return fail("integrity_mismatch");
  }
  const incomingDigest = digestOf(incoming);
  if (incomingDigest != null && incomingDigest === existing.digest && sameBytes(existing.bytes, incoming)) {
    audit(state, {
      action: "append_duplicate",
      operationId: existing.operationId,
      envelopeId: existing.envelopeId,
      reservationId: existing.reservationId,
    });
    return { ok: true, duplicate: true, envelope: view(existing) };
  }
  audit(state, {
    action: "append_rejected",
    operationId: existing.operationId,
    envelopeId: existing.envelopeId,
    reservationId: existing.reservationId,
    reason: "raw_conflict",
  });
  return fail("raw_conflict");
}

async function commitRead(
  state: StoreState,
  query: { envelopeId?: string; operationId?: string },
): Promise<ReadRawResult> {
  if (state.closed === "unavailable" || state.unavailable) return fail("unavailable");
  if (state.ambiguousNextRead) {
    state.ambiguousNextRead = false;
    audit(state, { action: "read_unattested", reason: "ambiguous" });
    return fail("ambiguous");
  }
  const located = locate(state, query);
  if (!located.ok) return located;
  if (!integrityOk(located.record)) {
    audit(state, {
      action: "read_rejected",
      operationId: located.record.operationId,
      envelopeId: located.record.envelopeId,
      reason: "integrity_mismatch",
    });
    return fail("integrity_mismatch");
  }
  audit(state, {
    action: "read",
    operationId: located.record.operationId,
    envelopeId: located.record.envelopeId,
    reservationId: located.record.reservationId,
    status: located.record.status,
  });
  return {
    ok: true,
    envelope: view(located.record),
    bodyBytes: new Uint8Array(located.record.bytes),
  };
}

function locate(
  state: StoreState,
  query: { envelopeId?: string; operationId?: string },
): { ok: true; record: StoredEnvelope } | { ok: false; reason: RawStoreReason } {
  if (query.operationId != null && query.envelopeId != null) {
    if (query.envelopeId !== `env-${query.operationId}`) return fail("operation_rejected");
  }
  if (query.operationId != null) {
    const record = state.records.get(query.operationId);
    if (record == null) return fail("raw_missing");
    if (query.envelopeId != null && record.envelopeId !== query.envelopeId) return fail("operation_rejected");
    return { ok: true, record };
  }
  if (query.envelopeId == null) return fail("operation_rejected");
  const operationId = state.byEnvelope.get(query.envelopeId);
  if (operationId == null) return fail("raw_missing");
  const record = state.records.get(operationId);
  if (record == null || record.envelopeId !== query.envelopeId) return fail("integrity_mismatch");
  return { ok: true, record };
}

function sealClock(
  now: number,
  sendingCommittedAt: number,
  lag: LagState,
): { capturedAtUtc: string | null; captureTimestampVerified: boolean } | null {
  if (lag.state === "invalid") return null;
  if (lag.state === "absent") {
    return { capturedAtUtc: null, captureTimestampVerified: false };
  }
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(sendingCommittedAt)) return null;
  if (now < sendingCommittedAt) return null;
  const elapsed = now - sendingCommittedAt;
  if (!Number.isSafeInteger(elapsed)) return null;
  const capturedAtUtc = formatCaptureUtc(now);
  if (capturedAtUtc == null) return null;
  return {
    capturedAtUtc,
    captureTimestampVerified: elapsed <= lag.maxCaptureLagMs,
  };
}

function formatCaptureUtc(epochMs: number): string | null {
  if (!Number.isSafeInteger(epochMs) || epochMs < 0) return null;
  let formatted: string;
  try {
    formatted = new Date(epochMs).toISOString();
  } catch {
    return null;
  }
  const match = CAPTURE_UTC.exec(formatted);
  if (match == null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number(match[7]);
  const instant = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  if (instant !== epochMs) return null;
  const roundTrip = new Date(instant);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day ||
    roundTrip.getUTCHours() !== hour ||
    roundTrip.getUTCMinutes() !== minute ||
    roundTrip.getUTCSeconds() !== second ||
    roundTrip.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }
  return formatted;
}

function deriveCanonical(
  ledger: MemoryLedger,
  proof: {
    operationId: string;
    approvalId: string;
    credentialId: string;
    endpoint: "lineups" | "injuries";
    fixtureId: string;
  },
): string | null {
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
    if (!derived.ok || !OPERATION_ID.test(derived.operationId)) return null;
    return derived.operationId;
  } catch {
    return null;
  }
}

function echoesMatch(
  fields: AppendFields,
  proof: {
    operationId: string;
    approvalId: string;
    credentialId: string;
    endpoint: "lineups" | "injuries";
    fixtureId: string;
  },
): boolean {
  if (fields.echoes.operationId !== undefined && fields.echoes.operationId !== proof.operationId) return false;
  if (fields.echoes.endpoint !== undefined && fields.echoes.endpoint !== proof.endpoint) return false;
  if (fields.echoes.fixtureId !== undefined && fields.echoes.fixtureId !== proof.fixtureId) return false;
  if (fields.echoes.approvalId !== undefined && fields.echoes.approvalId !== proof.approvalId) return false;
  if (fields.echoes.credentialId !== undefined && fields.echoes.credentialId !== proof.credentialId) return false;
  return true;
}

function lagEchoAllowed(lag: LagState, supplied: unknown | undefined): boolean {
  if (supplied === undefined) return true;
  if (lag.state === "absent") return supplied == null;
  if (lag.state === "bound") return supplied === lag.maxCaptureLagMs;
  return false;
}

function mapProofFailure(
  proof: { ok: false; reason: "denied"; denyReason: string } | { ok: false; reason: "unavailable" },
): RawStoreReason {
  if (proof.reason === "unavailable") return "unavailable";
  if (proof.denyReason === "invalid_transition" || proof.denyReason === "stale_token") {
    return "invalid_transition";
  }
  if (proof.denyReason === "clock_unavailable") return "clock_unavailable";
  return "operation_rejected";
}

function integrityOk(record: StoredEnvelope): boolean {
  if (record.bytes.byteLength !== record.byteLength) return false;
  const digest = digestOf(record.bytes);
  return digest != null && digest === record.digest;
}

function digestOf(bytes: Uint8Array): string | null {
  try {
    const hex = createHash("sha256").update(bytes).digest("hex");
    return OPERATION_ID.test(hex) ? hex : null;
  } catch {
    return null;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let diff = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

function view(record: StoredEnvelope): RawEnvelopeView {
  return {
    operationId: record.operationId,
    envelopeId: record.envelopeId,
    reservationId: record.reservationId,
    credentialId: record.credentialId,
    approvalId: record.approvalId,
    endpoint: record.endpoint,
    fixtureId: record.fixtureId,
    status: record.status,
    byteLength: record.byteLength,
    digest: record.digest,
    capturedAtUtc: record.capturedAtUtc,
    captureTimestampVerified: record.captureTimestampVerified,
  };
}

function viewAudit(entry: StoreAuditEntry): RawStoreAudit {
  return {
    action: entry.action,
    operationId: entry.operationId,
    envelopeId: entry.envelopeId,
    reservationId: entry.reservationId,
    reason: entry.reason,
    status: entry.status,
  };
}

function audit(state: StoreState, entry: StoreAuditEntry): void {
  state.audits.push(entry);
}

function fail<Reason extends RawStoreReason>(reason: Reason): { ok: false; reason: Reason } {
  return { ok: false, reason };
}

function parseStoreConfig(config: unknown): {
  closed: "unavailable" | null;
  lag: LagState;
  ledger: MemoryLedger | null;
} {
  if (!isSafeObject(config)) return { closed: "unavailable", lag: { state: "invalid" }, ledger: null };
  let names: string[];
  try {
    names = Object.getOwnPropertyNames(config);
  } catch {
    return { closed: "unavailable", lag: { state: "invalid" }, ledger: null };
  }
  for (const name of names) {
    if (name !== "ledger" && name !== "maxCaptureLagMs") {
      return { closed: "unavailable", lag: { state: "invalid" }, ledger: null };
    }
  }
  const ledgerRead = readOwn(config, "ledger");
  const lag = readLag(config);
  if (ledgerRead.state !== "value" || !isLedgerHandle(ledgerRead.value)) {
    return { closed: "unavailable", lag, ledger: null };
  }
  return { closed: null, lag, ledger: ledgerRead.value };
}

function readLag(config: object): LagState {
  const read = readOwn(config, "maxCaptureLagMs");
  if (read.state === "unsafe") return { state: "invalid" };
  if (read.state === "missing") return { state: "absent" };
  if (read.value == null) return { state: "absent" };
  if (typeof read.value !== "number" || !Number.isSafeInteger(read.value) || read.value < 0) {
    return { state: "invalid" };
  }
  return { state: "bound", maxCaptureLagMs: read.value };
}

function parseAppend(input: unknown): { ok: true; fields: AppendFields } | { ok: false; reason: "operation_rejected" } {
  if (!isSafeObject(input)) return fail("operation_rejected");
  let names: string[];
  try {
    names = Object.getOwnPropertyNames(input);
  } catch {
    return fail("operation_rejected");
  }
  for (const name of names) {
    if (!APPEND_KEYS.has(name)) return fail("operation_rejected");
  }
  const values = new Map<string, unknown>();
  for (const name of names) {
    const read = readOwn(input, name);
    if (read.state !== "value") return fail("operation_rejected");
    if (CLOCK_KEYS.has(name)) continue;
    values.set(name, read.value);
  }
  const reservationId = values.get("reservationId");
  const sendToken = values.get("sendToken");
  const status = readStatus(values.get("status"));
  const bodyBytes = copyBytes(values.get("bodyBytes"));
  if (!isIdentity(reservationId) || !isIdentity(sendToken) || status == null || bodyBytes == null) {
    return fail("operation_rejected");
  }
  const echoes: AppendFields["echoes"] = {};
  if (values.has("operationId")) {
    if (!isIdentity(values.get("operationId"))) return fail("operation_rejected");
    echoes.operationId = values.get("operationId") as string;
  }
  if (values.has("endpoint")) {
    if (typeof values.get("endpoint") !== "string") return fail("operation_rejected");
    echoes.endpoint = values.get("endpoint") as string;
  }
  if (values.has("fixtureId")) {
    if (typeof values.get("fixtureId") !== "string") return fail("operation_rejected");
    echoes.fixtureId = values.get("fixtureId") as string;
  }
  if (values.has("approvalId")) {
    if (!isIdentity(values.get("approvalId"))) return fail("operation_rejected");
    echoes.approvalId = values.get("approvalId") as string;
  }
  if (values.has("credentialId")) {
    if (!isIdentity(values.get("credentialId"))) return fail("operation_rejected");
    echoes.credentialId = values.get("credentialId") as string;
  }
  return {
    ok: true,
    fields: {
      reservationId,
      sendToken,
      status,
      bodyBytes,
      echoes,
      suppliedLag: values.has("maxCaptureLagMs") ? values.get("maxCaptureLagMs") : undefined,
    },
  };
}

function parseRead(
  query: unknown,
): { ok: true; query: { envelopeId?: string; operationId?: string } } | { ok: false; reason: "operation_rejected" } {
  if (!isSafeObject(query)) return fail("operation_rejected");
  let names: string[];
  try {
    names = Object.getOwnPropertyNames(query);
  } catch {
    return fail("operation_rejected");
  }
  if (names.length === 0) return fail("operation_rejected");
  for (const name of names) {
    if (!READ_KEYS.has(name)) return fail("operation_rejected");
  }
  const result: { envelopeId?: string; operationId?: string } = {};
  for (const name of names) {
    const read = readOwn(query, name);
    if (read.state !== "value" || typeof read.value !== "string") return fail("operation_rejected");
    if (name === "operationId") {
      if (!OPERATION_ID.test(read.value)) return fail("operation_rejected");
      result.operationId = read.value;
    } else if (!isEnvelopeId(read.value)) {
      return fail("operation_rejected");
    } else {
      result.envelopeId = read.value;
    }
  }
  return { ok: true, query: result };
}

function isEnvelopeId(value: string): boolean {
  return value.startsWith("env-") && OPERATION_ID.test(value.slice(4));
}

function readStatus(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 100 || value > 599) return null;
  return value;
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

function isLedgerHandle(value: unknown): value is MemoryLedger {
  if (!isSafeObject(value)) return false;
  const kind = readOwn(value, "kind");
  const instanceId = readOwn(value, "instanceId");
  const approvalId = readOwn(value, "approvalId");
  const generation = readOwn(value, "generation");
  return (
    kind.state === "value" &&
    kind.value === "pe5-memory-ledger" &&
    instanceId.state === "value" &&
    typeof instanceId.value === "string" &&
    approvalId.state === "value" &&
    typeof approvalId.value === "string" &&
    generation.state === "value" &&
    generation.value === 0
  );
}

function isSafeObject(value: unknown): value is object {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    return types.isProxy(value) !== true;
  } catch {
    return false;
  }
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value && !/[\r\n]/.test(value);
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

async function enqueue<T extends { ok: boolean }>(
  store: RawStore,
  body: (state: StoreState) => Promise<T>,
): Promise<T> {
  const state = readState(store);
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

function readState(store: RawStore): StoreState | null {
  if (store == null || store.kind !== "pe5-raw-store") return null;
  const holder = store as unknown as Record<symbol, unknown>;
  const value = holder[STATE_KEY];
  if (!isSafeObject(value)) return null;
  const kind = readOwn(value, "kind");
  if (kind.state !== "value" || kind.value !== STATE_KIND) return null;
  return value as StoreState;
}
