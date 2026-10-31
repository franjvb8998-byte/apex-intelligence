/**
 * PE-5.4C increment 1 — default-deny authorization.
 *
 * Pure function. The caller supplies env, approval, kill, flag snapshot, and
 * the ledger clock. This module does not read the process environment, open
 * a socket, or construct a ledger.
 */

import { PE53B_LIVE_PROVIDER_AUTHORIZED } from "@/lib/debug/calibration/pe5-availability/probe-fixtures";
import { pe5Protocol } from "@/lib/debug/calibration/pe5-availability/protocol";

import {
  AUTHORIZATION_MODES,
  PROTOCOL_FLAG_KEYS,
  type AuthorizationDecision,
  type AuthorizationDenyReason,
  type AuthorizationMode,
  type ProtocolFlagKey,
  type ProtocolFlagSnapshot,
  type VendorDayBoundary,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/types";

/** Length of one version-1 accounting day, and the inclusive offset limit. */
export const VENDOR_DAY_MS = 86_400_000;

const VENDOR_DAY_KEYS = ["version", "utcOffsetMs", "resetOffsetMs"] as const;

const CEILING_FIELDS = [
  "researchCeiling",
  "dailyCeiling",
  "rateCeiling",
] as const;

const DURATION_FIELDS = [
  "rateWindowMs",
  "leaseMs",
  "fetchTimeoutMs",
  "maxAgeMs",
] as const;

const IDENTITY_FIELDS = ["credentialId", "ledgerInstanceId", "operator"] as const;

type ClearKill = {
  readonly version: number;
  readonly updatedAt: number;
  readonly maxAgeMs: number;
};

type KillAssessment =
  | { readonly ok: true; readonly kill: ClearKill }
  | { readonly ok: false; readonly reason: AuthorizationDenyReason };

type ApprovalFields = {
  readonly mode: AuthorizationMode;
  readonly credentialId: string;
  readonly ledgerInstanceId: string;
  readonly operator: string;
  readonly researchCeiling: number;
  readonly dailyCeiling: number;
  readonly rateCeiling: number;
  readonly rateWindowMs: number;
  readonly leaseMs: number;
  readonly fetchTimeoutMs: number;
  readonly maxAgeMs: number;
  readonly expiry: number;
  readonly vendorDayBoundary: VendorDayBoundary | null;
};

export type VendorDayBoundaryParse =
  | { readonly ok: true; readonly boundary: VendorDayBoundary | null }
  | { readonly ok: false; readonly reason: "approval_invalid" | "approval_inconsistent" };

type ApprovalAssessment =
  | { readonly ok: true; readonly approval: ApprovalFields }
  | { readonly ok: false; readonly reason: AuthorizationDenyReason };

export function readRealProtocolFlags(): ProtocolFlagSnapshot {
  const protocol = pe5Protocol();
  return {
    PE5_PRODUCTION_WIRING: protocol.productionWiring,
    acquisitionAuthorized: protocol.acquisitionAuthorized,
    collectorAuthorized: protocol.collectorAuthorized,
    pe53Authorized: protocol.pe53Authorized,
    PE53B_LIVE_PROVIDER_AUTHORIZED,
  };
}

/**
 * Every flag must be the boolean `false`. A supplied `false` does not clear
 * a real `true`, and a missing or non-boolean value is not safe.
 */
export function protocolFlagsDeny(
  real: { readonly [Key in ProtocolFlagKey]: unknown },
  supplied: { readonly [Key in ProtocolFlagKey]: unknown },
): boolean {
  return PROTOCOL_FLAG_KEYS.some(
    (key) => real[key] !== false || supplied[key] !== false,
  );
}

export function evaluateAuthorization(
  env: unknown,
  approval: unknown,
  kill: unknown,
  protocolFlags: unknown,
  now: unknown,
): AuthorizationDecision {
  const supplied = parseFlagSnapshot(protocolFlags);
  if (supplied == null || protocolFlagsDeny(readRealProtocolFlags(), supplied)) {
    return deny("protocol_flag_violation");
  }

  if (!isEpochMillis(now)) {
    return deny("clock_unavailable");
  }

  const killAssessment = assessKill(kill, now);
  if (!killAssessment.ok) {
    return deny(killAssessment.reason);
  }

  const mode = readMode(env);
  if (mode == null) {
    return deny("mode_denied");
  }

  const parsed = parseApproval(approval);
  if (!parsed.ok) {
    return deny(parsed.reason);
  }

  if (now >= parsed.approval.expiry) {
    return deny("approval_expired");
  }

  if (parsed.approval.mode !== mode) {
    return deny("approval_inconsistent");
  }

  if (parsed.approval.maxAgeMs !== killAssessment.kill.maxAgeMs) {
    return deny("approval_inconsistent");
  }

  const configuredLedger = readConfiguredLedger(env);
  if (
    configuredLedger == null ||
    configuredLedger !== parsed.approval.ledgerInstanceId
  ) {
    return deny("ledger_instance_mismatch");
  }

  if (mode === "pilot") {
    return deny("pilot_not_authorized");
  }

  return { decision: "allow-offline" };
}

function deny(reason: AuthorizationDenyReason): AuthorizationDecision {
  return { decision: "deny", reason };
}

function parseFlagSnapshot(value: unknown): ProtocolFlagSnapshot | null {
  if (!isDataRecord(value)) return null;
  const snapshot = {} as { -readonly [Key in ProtocolFlagKey]: boolean };
  for (const key of PROTOCOL_FLAG_KEYS) {
    const read = readData(value, key);
    if (!read.present || typeof read.value !== "boolean") return null;
    snapshot[key] = read.value;
  }
  return snapshot;
}

function assessKill(kill: unknown, now: number): KillAssessment {
  if (kill == null) {
    return { ok: false, reason: "kill_switch_engaged" };
  }
  if (!isDataRecord(kill)) {
    return { ok: false, reason: "kill_switch_unreadable" };
  }

  const state = readData(kill, "state");
  if (!state.present || typeof state.value !== "string") {
    return { ok: false, reason: "kill_switch_unreadable" };
  }
  if (state.value === "unreadable") {
    return { ok: false, reason: "kill_switch_unreadable" };
  }
  if (state.value !== "clear") {
    return { ok: false, reason: "kill_switch_engaged" };
  }

  const version = readData(kill, "version");
  if (!version.present || !isNonNegativeInteger(version.value)) {
    return { ok: false, reason: "kill_switch_engaged" };
  }

  const updatedAt = readData(kill, "updatedAt");
  if (!updatedAt.present || !isEpochMillis(updatedAt.value)) {
    return { ok: false, reason: "kill_switch_engaged" };
  }

  const maxAge = readData(kill, "maxAgeMs");
  if (!maxAge.present || !isPositiveMillis(maxAge.value)) {
    return { ok: false, reason: "kill_switch_engaged" };
  }

  if (!isFresh(updatedAt.value, now, maxAge.value)) {
    return { ok: false, reason: "kill_switch_stale" };
  }

  return {
    ok: true,
    kill: {
      version: version.value,
      updatedAt: updatedAt.value,
      maxAgeMs: maxAge.value,
    },
  };
}

function readMode(env: unknown): AuthorizationMode | null {
  if (!isDataRecord(env)) return null;
  const mode = readData(env, "APEX_PE5_ACQUISITION_MODE");
  if (!mode.present || typeof mode.value !== "string") return null;
  if (!isAuthorizationMode(mode.value)) return null;
  return mode.value;
}

function readConfiguredLedger(env: unknown): string | null {
  if (!isDataRecord(env)) return null;
  const ledger = readData(env, "ledgerInstanceId");
  if (!ledger.present || !isIdentity(ledger.value)) return null;
  return ledger.value;
}

function parseApproval(value: unknown): ApprovalAssessment {
  if (value == null) {
    return { ok: false, reason: "approval_missing" };
  }
  if (!isDataRecord(value)) {
    return { ok: false, reason: "approval_invalid" };
  }
  if (hasSecretField(value)) {
    return { ok: false, reason: "approval_invalid" };
  }

  const mode = readData(value, "mode");
  if (!mode.present) return { ok: false, reason: "approval_missing" };
  if (typeof mode.value !== "string" || !isAuthorizationMode(mode.value)) {
    return { ok: false, reason: "approval_invalid" };
  }

  const identity: Record<(typeof IDENTITY_FIELDS)[number], string> = {
    credentialId: "",
    ledgerInstanceId: "",
    operator: "",
  };
  for (const field of IDENTITY_FIELDS) {
    const read = readData(value, field);
    if (!read.present) return { ok: false, reason: "approval_missing" };
    if (!isIdentity(read.value)) return { ok: false, reason: "approval_invalid" };
    identity[field] = read.value;
  }

  const ceilings: Record<(typeof CEILING_FIELDS)[number], number> = {
    researchCeiling: 0,
    dailyCeiling: 0,
    rateCeiling: 0,
  };
  for (const field of CEILING_FIELDS) {
    const read = readData(value, field);
    if (!read.present) return { ok: false, reason: "approval_missing" };
    if (!isPositiveCount(read.value)) {
      return { ok: false, reason: "approval_invalid" };
    }
    ceilings[field] = read.value;
  }

  const durations: Record<(typeof DURATION_FIELDS)[number], number> = {
    rateWindowMs: 0,
    leaseMs: 0,
    fetchTimeoutMs: 0,
    maxAgeMs: 0,
  };
  for (const field of DURATION_FIELDS) {
    const read = readData(value, field);
    if (!read.present) return { ok: false, reason: "approval_missing" };
    if (!isPositiveMillis(read.value)) {
      return { ok: false, reason: "approval_invalid" };
    }
    durations[field] = read.value;
  }

  if (durations.leaseMs <= durations.fetchTimeoutMs) {
    return { ok: false, reason: "approval_invalid" };
  }

  const expiry = readData(value, "expiry");
  if (!expiry.present) return { ok: false, reason: "approval_missing" };
  if (!isEpochMillis(expiry.value)) {
    return { ok: false, reason: "approval_invalid" };
  }

  const boundary = parseApprovalVendorDayBoundary(value);
  if (!boundary.ok) return { ok: false, reason: boundary.reason };

  return {
    ok: true,
    approval: {
      mode: mode.value,
      credentialId: identity.credentialId,
      ledgerInstanceId: identity.ledgerInstanceId,
      operator: identity.operator,
      researchCeiling: ceilings.researchCeiling,
      dailyCeiling: ceilings.dailyCeiling,
      rateCeiling: ceilings.rateCeiling,
      rateWindowMs: durations.rateWindowMs,
      leaseMs: durations.leaseMs,
      fetchTimeoutMs: durations.fetchTimeoutMs,
      maxAgeMs: durations.maxAgeMs,
      expiry: expiry.value,
      vendorDayBoundary: boundary.boundary,
    },
  };
}

/**
 * Absent and null are allowed. A present value must be a version-1 boundary
 * with exactly the three own data properties. Two disagreeing reads deny
 * as inconsistent. Malformed values are not rewritten.
 */
export function parseApprovalVendorDayBoundary(approval: object): VendorDayBoundaryParse {
  const field = readData(approval, "vendorDayBoundary");
  if (!field.present || field.value === null) return { ok: true, boundary: null };
  if (!isDataRecord(field.value)) return { ok: false, reason: "approval_invalid" };

  const first = readBoundarySnapshot(field.value);
  const second = readBoundarySnapshot(field.value);
  if (first.kind === "invalid" || second.kind === "invalid") {
    return first.kind === second.kind
      ? { ok: false, reason: "approval_invalid" }
      : { ok: false, reason: "approval_inconsistent" };
  }
  if (
    !Object.is(first.version, second.version) ||
    !Object.is(first.utcOffsetMs, second.utcOffsetMs) ||
    !Object.is(first.resetOffsetMs, second.resetOffsetMs)
  ) {
    return { ok: false, reason: "approval_inconsistent" };
  }
  if (!isVendorDayBoundary(first)) return { ok: false, reason: "approval_invalid" };
  return {
    ok: true,
    boundary: Object.freeze({
      version: 1,
      utcOffsetMs: first.utcOffsetMs,
      resetOffsetMs: first.resetOffsetMs,
    }),
  };
}

type BoundarySnapshot =
  | { readonly kind: "invalid" }
  | { readonly kind: "fields"; readonly version: unknown; readonly utcOffsetMs: unknown; readonly resetOffsetMs: unknown };

function readBoundarySnapshot(record: object): BoundarySnapshot {
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(record);
    symbols = Object.getOwnPropertySymbols(record);
  } catch {
    return { kind: "invalid" };
  }
  if (symbols.length !== 0 || names.length !== VENDOR_DAY_KEYS.length) {
    return { kind: "invalid" };
  }
  if (!VENDOR_DAY_KEYS.every((key) => names.includes(key))) return { kind: "invalid" };

  const version = readData(record, "version");
  const utcOffsetMs = readData(record, "utcOffsetMs");
  const resetOffsetMs = readData(record, "resetOffsetMs");
  if (!version.present || !utcOffsetMs.present || !resetOffsetMs.present) {
    return { kind: "invalid" };
  }
  return {
    kind: "fields",
    version: version.value,
    utcOffsetMs: utcOffsetMs.value,
    resetOffsetMs: resetOffsetMs.value,
  };
}

function isVendorDayBoundary(value: {
  readonly version: unknown;
  readonly utcOffsetMs: unknown;
  readonly resetOffsetMs: unknown;
}): value is VendorDayBoundary {
  return value.version === 1 && isUtcOffsetMs(value.utcOffsetMs) && isResetOffsetMs(value.resetOffsetMs);
}

function isUtcOffsetMs(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= -VENDOR_DAY_MS && value <= VENDOR_DAY_MS;
}

function isResetOffsetMs(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < VENDOR_DAY_MS;
}

function isFresh(updatedAt: number, now: number, maxAgeMs: number): boolean {
  if (updatedAt > now) return false;
  const age = now - updatedAt;
  return Number.isSafeInteger(age) && age <= maxAgeMs;
}

function isAuthorizationMode(value: string): value is AuthorizationMode {
  return (AUTHORIZATION_MODES as readonly string[]).includes(value);
}

function isEpochMillis(value: unknown): value is number {
  return isNonNegativeInteger(value);
}

function isPositiveCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isPositiveMillis(value: unknown): value is number {
  return isPositiveCount(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function hasSecretField(record: object): boolean {
  let keys: string[];
  try {
    keys = Object.getOwnPropertyNames(record);
  } catch {
    return true;
  }
  return keys.some((key) =>
    /secret|password|token|api[_-]?key|(?:^|_)key$/i.test(key),
  );
}

function isDataRecord(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readData(
  record: object,
  key: string,
): { present: true; value: unknown } | { present: false } {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, key);
  } catch {
    return { present: false };
  }
  if (descriptor == null || !Object.hasOwn(descriptor, "value")) {
    return { present: false };
  }
  return { present: true, value: descriptor.value };
}
