/**
 * PE-5.4C increment 5 — strict offline response normalization.
 *
 * One aggregate observation or one reason code. Counts are returned entries,
 * not independently verified unique players. No network, credential, ledger,
 * clock, or evidence-classification work belongs in this module.
 */

import { types } from "node:util";

export const PE5_NORMALIZE_REASONS = [
  "malformed_response",
  "unauthorized",
  "unexpected_provider_behavior",
  "quota_exhausted",
  "rate_limited",
  "unexpected_pagination",
  "fixture_id_mismatch",
  "identity_incomplete",
  "missing_coerced_to_zero",
] as const;

export type Pe5NormalizeReason = (typeof PE5_NORMALIZE_REASONS)[number];

export type Pe5AcquisitionEndpoint = "lineups" | "injuries";

/**
 * Shape of a sealed envelope. The function accepts `unknown` and checks
 * every field. A worker clock on the object is not part of this contract.
 */
export type Pe5AcquisitionEnvelope = {
  readonly envelopeId: string;
  readonly status: unknown;
  readonly headers: unknown;
  readonly body: unknown;
  readonly endpoint: Pe5AcquisitionEndpoint;
  readonly fixtureId: string;
  readonly capturedAtUtc: string | null;
  readonly captureTimestampVerified: boolean;
};

type ObservationBase = {
  readonly envelopeId: string;
  readonly fixtureId: string;
  readonly observation: "present" | "missing";
  readonly observedValue: number | null;
  readonly absenceMeansAvailable: false;
  readonly availabilityInference: "forbidden";
  readonly capturedAtUtc: string | null;
  readonly captureTimestampVerified: boolean;
};

export type Pe5LineupObservation = ObservationBase & {
  readonly endpoint: "lineups";
  /** Returned canonical starter entries. Not a unique-player total. */
  readonly startXiCount: number | null;
  /** Returned canonical substitute entries. Not a unique-player total. */
  readonly substituteCount: number | null;
};

export type Pe5InjuryObservation = ObservationBase & {
  readonly endpoint: "injuries";
  /** Returned injury records (`response.length`). Not players ruled out. */
  readonly injuryRecordCount: number | null;
};

export type Pe5NormalizedObservation = Pe5LineupObservation | Pe5InjuryObservation;

export type Pe5NormalizeResult =
  | { readonly ok: true; readonly observation: Pe5NormalizedObservation }
  | { readonly ok: false; readonly reason: Pe5NormalizeReason };

const CANONICAL_ID = /^[1-9][0-9]{0,11}$/;
const ENVELOPE_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const DAILY_HEADER = "x-ratelimit-requests-remaining";
const DAILY_PHRASE = /request limit for the day|daily request quota/i;
const LINEUPS_PATH = "fixtures/lineups";
const INJURIES_PATH = "injuries";

type OwnRead =
  | { readonly state: "missing" }
  | { readonly state: "unsafe" }
  | { readonly state: "threw" }
  | { readonly state: "value"; readonly value: unknown };

type HeaderState = "absent" | "exhausted" | "malformed";
type PhraseState = "match" | "none" | "unsafe_shape" | "threw";
type ProxyProbe = "proxy" | "clear" | "threw";
type PhraseText = string[] | "unsafe_shape" | "threw";

function fail(reason: Pe5NormalizeReason): Pe5NormalizeResult {
  return { ok: false, reason };
}

function probeProxy(value: unknown): ProxyProbe {
  try {
    if (typeof value === "object" && value !== null && types.isProxy(value) === true) {
      return "proxy";
    }
    return "clear";
  } catch {
    return "threw";
  }
}

function isProxyValue(value: unknown): boolean {
  return probeProxy(value) !== "clear";
}

function blockedRead(
  read: OwnRead,
): read is { readonly state: "unsafe" } | { readonly state: "threw" } {
  return read.state === "unsafe" || read.state === "threw";
}

function isSafeObject(value: unknown): value is object {
  try {
    if (typeof value !== "object" || value === null) return false;
    if (types.isProxy(value) === true) return false;
    if (Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  } catch {
    return false;
  }
}

function asSafeArray(value: unknown): unknown[] | null {
  try {
    if (typeof value !== "object" || value === null) return null;
    if (types.isProxy(value) === true) return null;
    if (!Array.isArray(value)) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const length = readOwn(value, "length");
    if (length.state !== "value") return null;
    if (!isNonNegativeInteger(length.value)) return null;
    if (value.length !== length.value) return null;
    return value;
  } catch {
    return null;
  }
}

function readOwn(target: object, key: string): OwnRead {
  try {
    if (types.isProxy(target) === true) return { state: "unsafe" };
    if (!Object.hasOwn(target, key)) return { state: "missing" };
    const description = Object.getOwnPropertyDescriptor(target, key);
    if (
      description == null ||
      description.get != null ||
      description.set != null ||
      !("value" in description)
    ) {
      return { state: "unsafe" };
    }
    return { state: "value", value: description.value };
  } catch {
    return { state: "threw" };
  }
}

function inheritsKey(target: object, key: string): boolean {
  try {
    let proto = Object.getPrototypeOf(target);
    while (proto && proto !== Object.prototype) {
      if (isProxyValue(proto)) return true;
      if (Object.hasOwn(proto, key)) return true;
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  } catch {
    return true;
  }
}

function ownStringKeys(target: object): string[] | null {
  try {
    if (types.isProxy(target) === true) return null;
    return Reflect.ownKeys(target).filter((key): key is string => typeof key === "string");
  } catch {
    return null;
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    !Object.is(value, -0)
  );
}

function isPositivePage(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isEndpoint(value: unknown): value is Pe5AcquisitionEndpoint {
  return value === "lineups" || value === "injuries";
}

function readStatus(envelope: object): number | "malformed" {
  const status = readOwn(envelope, "status");
  if (status.state !== "value") return "malformed";
  if (typeof status.value !== "number" || !Number.isInteger(status.value)) return "malformed";
  if (status.value < 100 || status.value > 599) return "malformed";
  return status.value;
}

/**
 * Header steps follow the approved order: exhaustion stops the run, a daily
 * phrase stops before a malformed header, and a positive remaining count
 * does not. Only this header name is consulted. Accessors are not called.
 */
function readQuotaHeader(envelope: object): HeaderState {
  const headers = readOwn(envelope, "headers");
  if (headers.state === "missing") return "absent";
  if (headers.state !== "value") return "malformed";
  if (headers.value == null) return "absent";
  if (!isSafeObject(headers.value)) return "malformed";

  const keys = ownStringKeys(headers.value);
  if (keys == null) return "malformed";

  let sawHeader = false;
  let exhausted = false;
  for (const key of keys) {
    if (key.toLowerCase() !== DAILY_HEADER) continue;
    const owned = readOwn(headers.value, key);
    if (owned.state !== "value") return "malformed";
    sawHeader = true;
    const parsed = parseQuotaRemaining(owned.value);
    if (parsed === "malformed") return "malformed";
    if (parsed === "exhausted") exhausted = true;
  }
  if (!sawHeader) return "absent";
  return exhausted ? "exhausted" : "absent";
}

function parseQuotaRemaining(value: unknown): "exhausted" | "available" | "malformed" {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return "malformed";
    if (value === 0) return "exhausted";
    if (Number.isSafeInteger(value) && value > 0) return "available";
    return "malformed";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^0+$/.test(trimmed)) return "exhausted";
    if (/^[1-9][0-9]*$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (!Number.isSafeInteger(parsed)) return "malformed";
      return "available";
    }
    return "malformed";
  }
  return "malformed";
}

/**
 * Proxy and accessor detections are unsafe shapes. A thrown reflection
 * failure is the only phrase result that keeps the status-dependent mapping.
 */
function readDailyPhrase(envelope: object): PhraseState {
  const body = readOwn(envelope, "body");
  if (body.state === "threw") return "threw";
  if (body.state === "unsafe") return "unsafe_shape";
  if (body.state === "missing" || body.value == null) return "none";
  const host = phraseHost(body.value);
  if (host === "threw" || host === "unsafe_shape") return host;
  if (host === "none" || !isSafeObject(body.value)) return "none";

  const parts: string[] = [];
  for (const key of ["message", "error"] as const) {
    const read = readOwn(body.value, key);
    if (read.state === "threw") return "threw";
    if (read.state === "unsafe") return "unsafe_shape";
    if (read.state === "missing") continue;
    const text = collectPlainText(read.value);
    if (text === "threw" || text === "unsafe_shape") return text;
    parts.push(...text);
  }

  const errors = readOwn(body.value, "errors");
  if (errors.state === "threw") return "threw";
  if (errors.state === "unsafe") return "unsafe_shape";
  if (errors.state === "value") {
    const text = collectErrors(errors.value);
    if (text === "threw" || text === "unsafe_shape") return text;
    parts.push(...text);
  }

  if (parts.length === 0) return "none";
  return DAILY_PHRASE.test(parts.join("\n")) ? "match" : "none";
}

function phraseHost(value: unknown): "safe" | "unsafe_shape" | "threw" | "none" {
  try {
    if (typeof value !== "object" || value === null) return "none";
    if (types.isProxy(value) === true) return "unsafe_shape";
    if (Array.isArray(value)) return "none";
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) return "safe";
    return "none";
  } catch {
    return "threw";
  }
}

function collectPlainText(value: unknown): PhraseText {
  const probed = probeProxy(value);
  if (probed === "proxy") return "unsafe_shape";
  if (probed === "threw") return "threw";
  if (typeof value === "string") return value.trim() === "" ? [] : [value];
  return [];
}

function collectErrors(value: unknown): PhraseText {
  const probed = probeProxy(value);
  if (probed === "proxy") return "unsafe_shape";
  if (probed === "threw") return "threw";
  if (typeof value === "string") return value.trim() === "" ? [] : [value];
  const list = asSafeArray(value);
  if (list) return collectErrorEntries(list);
  if (isSafeObject(value)) return collectErrorObject(value);
  return [];
}

function collectErrorEntries(list: unknown[]): PhraseText {
  const parts: string[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const entry = readOwn(list, String(index));
    if (entry.state === "threw") return "threw";
    if (entry.state === "unsafe") return "unsafe_shape";
    if (entry.state !== "value") continue;
    const probed = probeProxy(entry.value);
    if (probed === "proxy") return "unsafe_shape";
    if (probed === "threw") return "threw";
    if (typeof entry.value === "string" && entry.value.trim() !== "") parts.push(entry.value);
  }
  return parts;
}

function collectErrorObject(value: object): PhraseText {
  const probed = probeProxy(value);
  if (probed === "proxy") return "unsafe_shape";
  if (probed === "threw") return "threw";
  const keys = ownStringKeys(value);
  if (keys == null) return "threw";
  const parts: string[] = [];
  for (const key of keys) {
    const entry = readOwn(value, key);
    if (entry.state === "threw") return "threw";
    if (entry.state !== "value") return "unsafe_shape";
    const valueProbe = probeProxy(entry.value);
    if (valueProbe === "proxy") return "unsafe_shape";
    if (valueProbe === "threw") return "threw";
    if (typeof entry.value === "string") {
      if (entry.value.trim() !== "") parts.push(entry.value);
      continue;
    }
    const nested = asSafeArray(entry.value);
    if (nested) {
      const inner = collectErrorEntries(nested);
      if (inner === "unsafe_shape" || inner === "threw") return inner;
      parts.push(...inner);
    }
  }
  return parts;
}

function compareId(
  value: unknown,
  expected: string,
): "match" | "fixture_id_mismatch" | "malformed_response" {
  if (typeof value === "string") {
    return value === expected ? "match" : "fixture_id_mismatch";
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0 || Object.is(value, -0)) {
      return "malformed_response";
    }
    const decimal = String(value);
    if (!CANONICAL_ID.test(decimal)) return "fixture_id_mismatch";
    return decimal === expected ? "match" : "fixture_id_mismatch";
  }
  return "malformed_response";
}

function isCanonicalPlayerId(value: unknown): boolean {
  if (typeof value === "string") return CANONICAL_ID.test(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0 || Object.is(value, -0)) return false;
    return CANONICAL_ID.test(String(value));
  }
  return false;
}

type NestedObject =
  | { readonly state: "absent" }
  | { readonly state: "malformed" }
  | { readonly state: "object"; readonly value: object };

function readNestedObject(owner: object, key: string): NestedObject {
  const read = readOwn(owner, key);
  if (blockedRead(read)) return { state: "malformed" };
  if (read.state === "missing") {
    return inheritsKey(owner, key) ? { state: "malformed" } : { state: "absent" };
  }
  if (!isSafeObject(read.value)) return { state: "malformed" };
  return { state: "object", value: read.value };
}

function checkRowFixture(
  row: object,
  expected: string,
): "ok" | "fixture_id_mismatch" | "identity_incomplete" | "malformed_response" {
  const fixture = readNestedObject(row, "fixture");
  if (fixture.state === "malformed") return "malformed_response";
  if (fixture.state === "absent") return "ok";
  const id = readOwn(fixture.value, "id");
  if (blockedRead(id)) return "malformed_response";
  if (id.state === "missing") {
    return inheritsKey(fixture.value, "id") ? "malformed_response" : "identity_incomplete";
  }
  const compared = compareId(id.value, expected);
  return compared === "match" ? "ok" : compared;
}

function inspectIdentifierHost(host: object): "ok" | "malformed_response" {
  const id = readOwn(host, "id");
  if (blockedRead(id)) return "malformed_response";
  if (id.state === "missing") {
    return inheritsKey(host, "id") ? "malformed_response" : "ok";
  }
  if (probeProxy(id.value) !== "clear") return "malformed_response";
  return "ok";
}

function inspectOptionalHost(owner: object, key: string): "ok" | "malformed_response" {
  const nested = readNestedObject(owner, key);
  if (nested.state === "malformed") return "malformed_response";
  if (nested.state === "absent") return "ok";
  return inspectIdentifierHost(nested.value);
}

/**
 * True when this returned entry carries a canonical player id.
 * False when the id is absent or noncanonical. Unsafe shapes reject the body.
 */
function entryIsCanonical(entry: unknown): boolean | "malformed_response" {
  if (!isSafeObject(entry)) return "malformed_response";
  const player = readNestedObject(entry, "player");
  if (player.state === "malformed") return "malformed_response";
  const team = inspectOptionalHost(entry, "team");
  if (team === "malformed_response") return "malformed_response";
  if (player.state === "absent") return false;
  const id = readOwn(player.value, "id");
  if (blockedRead(id)) return "malformed_response";
  if (id.state === "missing") {
    return inheritsKey(player.value, "id") ? "malformed_response" : false;
  }
  if (probeProxy(id.value) !== "clear") return "malformed_response";
  return isCanonicalPlayerId(id.value);
}

function countEntryList(
  row: object,
  key: "startXI" | "substitutes",
  required: boolean,
): number | "malformed_response" {
  const read = readOwn(row, key);
  if (blockedRead(read)) return "malformed_response";
  if (read.state === "missing") {
    if (inheritsKey(row, key) || required) return "malformed_response";
    return 0;
  }
  const list = asSafeArray(read.value);
  if (list == null) return "malformed_response";
  let count = 0;
  for (let index = 0; index < list.length; index += 1) {
    const entry = readOwn(list, String(index));
    if (entry.state !== "value") return "malformed_response";
    const canonical = entryIsCanonical(entry.value);
    if (canonical === "malformed_response") return "malformed_response";
    if (canonical) count += 1;
  }
  return count;
}

type RowCounts =
  | { readonly ok: true; readonly startXiCount: number; readonly substituteCount: number }
  | {
      readonly ok: false;
      readonly reason: "malformed_response" | "fixture_id_mismatch" | "identity_incomplete";
    };

function walkRows(
  rows: unknown[],
  endpoint: Pe5AcquisitionEndpoint,
  fixtureId: string,
): RowCounts {
  let startXiCount = 0;
  let substituteCount = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const item = readOwn(rows, String(index));
    if (item.state !== "value" || !isSafeObject(item.value)) {
      return { ok: false, reason: "malformed_response" };
    }
    const row = item.value;
    const fixture = checkRowFixture(row, fixtureId);
    if (fixture !== "ok") return { ok: false, reason: fixture };
    if (inspectOptionalHost(row, "team") === "malformed_response") {
      return { ok: false, reason: "malformed_response" };
    }
    if (inspectOptionalHost(row, "player") === "malformed_response") {
      return { ok: false, reason: "malformed_response" };
    }
    const starters = countEntryList(row, "startXI", endpoint === "lineups");
    if (starters === "malformed_response") return { ok: false, reason: "malformed_response" };
    const substitutes = countEntryList(row, "substitutes", endpoint === "lineups");
    if (substitutes === "malformed_response") {
      return { ok: false, reason: "malformed_response" };
    }
    if (endpoint === "lineups") {
      startXiCount += starters;
      substituteCount += substitutes;
    }
  }
  return { ok: true, startXiCount, substituteCount };
}

function readEmptyErrors(body: object): "ok" | "malformed_response" {
  const errors = readOwn(body, "errors");
  if (errors.state !== "value") return "malformed_response";
  const list = asSafeArray(errors.value);
  if (list == null || list.length !== 0) return "malformed_response";
  return "ok";
}

function readResponseRows(body: object): unknown[] | "malformed_response" {
  const response = readOwn(body, "response");
  if (response.state !== "value") return "malformed_response";
  const rows = asSafeArray(response.value);
  if (rows == null) return "malformed_response";
  const results = readOwn(body, "results");
  if (results.state !== "value" || !isNonNegativeInteger(results.value)) {
    return "malformed_response";
  }
  if (results.value !== rows.length) return "malformed_response";
  return rows;
}

function readPaging(body: object): "ok" | "malformed_response" | "unexpected_pagination" {
  const paging = readOwn(body, "paging");
  if (paging.state !== "value" || !isSafeObject(paging.value)) return "malformed_response";
  const current = readOwn(paging.value, "current");
  const total = readOwn(paging.value, "total");
  if (current.state === "missing" || total.state === "missing") return "malformed_response";
  if (current.state !== "value" || total.state !== "value") return "malformed_response";
  if (!isPositivePage(current.value) || !isPositivePage(total.value)) return "malformed_response";
  if (current.value !== 1 || total.value !== 1) return "unexpected_pagination";
  return "ok";
}

function pathFor(endpoint: Pe5AcquisitionEndpoint): string {
  return endpoint === "lineups" ? LINEUPS_PATH : INJURIES_PATH;
}

function readGet(
  body: object,
  endpoint: Pe5AcquisitionEndpoint,
): "ok" | "malformed_response" {
  const get = readOwn(body, "get");
  if (get.state !== "value" || typeof get.value !== "string") return "malformed_response";
  const normalized = get.value.startsWith("/") ? get.value.slice(1) : get.value;
  return normalized === pathFor(endpoint) ? "ok" : "malformed_response";
}

function readRequestedFixture(
  envelope: object,
): { readonly ok: true; readonly fixtureId: string } | { readonly ok: false; readonly reason: Pe5NormalizeReason } {
  const fixtureId = readOwn(envelope, "fixtureId");
  if (fixtureId.state !== "value") return { ok: false, reason: "malformed_response" };
  if (typeof fixtureId.value !== "string" || !CANONICAL_ID.test(fixtureId.value)) {
    return { ok: false, reason: "fixture_id_mismatch" };
  }
  return { ok: true, fixtureId: fixtureId.value };
}

function readFixtureEcho(
  body: object,
  fixtureId: string,
): "ok" | "fixture_id_mismatch" | "malformed_response" {
  const parameters = readOwn(body, "parameters");
  if (blockedRead(parameters)) return "malformed_response";
  if (parameters.state === "missing") return "fixture_id_mismatch";
  if (!isSafeObject(parameters.value)) return "malformed_response";
  const echoed = readOwn(parameters.value, "fixture");
  if (blockedRead(echoed)) return "malformed_response";
  if (echoed.state === "missing") {
    return inheritsKey(parameters.value, "fixture") ? "malformed_response" : "fixture_id_mismatch";
  }
  const compared = compareId(echoed.value, fixtureId);
  if (compared === "match") return "ok";
  return compared;
}

function readEndpoint(
  envelope: object,
): { readonly ok: true; readonly endpoint: Pe5AcquisitionEndpoint } | { readonly ok: false; readonly reason: "malformed_response" } {
  const endpoint = readOwn(envelope, "endpoint");
  if (endpoint.state !== "value" || !isEndpoint(endpoint.value)) {
    return { ok: false, reason: "malformed_response" };
  }
  return { ok: true, endpoint: endpoint.value };
}

function readProvenance(envelope: object):
  | {
      readonly ok: true;
      readonly envelopeId: string;
      readonly capturedAtUtc: string | null;
      readonly captureTimestampVerified: boolean;
    }
  | { readonly ok: false; readonly reason: "malformed_response" } {
  const envelopeId = readOwn(envelope, "envelopeId");
  if (
    envelopeId.state !== "value" ||
    typeof envelopeId.value !== "string" ||
    !ENVELOPE_ID.test(envelopeId.value)
  ) {
    return { ok: false, reason: "malformed_response" };
  }
  const capturedAtUtc = readOwn(envelope, "capturedAtUtc");
  if (capturedAtUtc.state !== "value") return { ok: false, reason: "malformed_response" };
  if (capturedAtUtc.value !== null && typeof capturedAtUtc.value !== "string") {
    return { ok: false, reason: "malformed_response" };
  }
  const verified = readOwn(envelope, "captureTimestampVerified");
  if (verified.state !== "value" || typeof verified.value !== "boolean") {
    return { ok: false, reason: "malformed_response" };
  }
  return {
    ok: true,
    envelopeId: envelopeId.value,
    capturedAtUtc: capturedAtUtc.value,
    captureTimestampVerified: verified.value,
  };
}

function guard(observation: Pe5NormalizedObservation): Pe5NormalizeResult {
  if (observation.observation === "missing") {
    if (observation.observedValue === 0) return fail("missing_coerced_to_zero");
    if (observation.observedValue !== null) return fail("malformed_response");
    if (observation.endpoint === "lineups") {
      if (observation.startXiCount !== null || observation.substituteCount !== null) {
        return fail("malformed_response");
      }
    } else if (observation.injuryRecordCount !== null) {
      return fail("malformed_response");
    }
    return { ok: true, observation };
  }
  if (!isNonNegativeInteger(observation.observedValue)) return fail("malformed_response");
  if (observation.endpoint === "lineups") {
    if (
      observation.observedValue !== observation.startXiCount ||
      !isNonNegativeInteger(observation.startXiCount) ||
      !isNonNegativeInteger(observation.substituteCount)
    ) {
      return fail("malformed_response");
    }
    return { ok: true, observation };
  }
  if (
    !isNonNegativeInteger(observation.injuryRecordCount) ||
    observation.injuryRecordCount < 1 ||
    observation.injuryRecordCount !== observation.observedValue
  ) {
    return fail("malformed_response");
  }
  return { ok: true, observation };
}

function sharedFields(
  provenance: {
    readonly envelopeId: string;
    readonly capturedAtUtc: string | null;
    readonly captureTimestampVerified: boolean;
  },
  fixtureId: string,
): Omit<ObservationBase, "observation" | "observedValue"> {
  return {
    envelopeId: provenance.envelopeId,
    fixtureId,
    absenceMeansAvailable: false,
    availabilityInference: "forbidden",
    capturedAtUtc: provenance.capturedAtUtc,
    captureTimestampVerified: provenance.captureTimestampVerified,
  };
}

/**
 * Normalize one sealed lineup or injury envelope.
 * The argument is the envelope only. No separate clock is accepted.
 */
export function normalizePe5AcquisitionResponse(envelope: unknown): Pe5NormalizeResult {
  if (!isSafeObject(envelope)) return fail("malformed_response");

  const status = readStatus(envelope);
  if (status === "malformed") return fail("malformed_response");
  if (status === 401 || status === 403) return fail("unauthorized");
  if (status >= 500) return fail("unexpected_provider_behavior");

  const header = readQuotaHeader(envelope);
  if (header === "exhausted") return fail("quota_exhausted");

  const phrase = readDailyPhrase(envelope);
  if (phrase === "threw") {
    return fail(status === 429 ? "rate_limited" : "unexpected_provider_behavior");
  }
  if (phrase === "unsafe_shape") return fail("malformed_response");
  if (phrase === "match") return fail("quota_exhausted");
  if (header === "malformed") return fail("malformed_response");
  if (status === 429) return fail("rate_limited");
  if (status !== 200) return fail("malformed_response");

  const body = readOwn(envelope, "body");
  if (body.state !== "value" || !isSafeObject(body.value)) return fail("malformed_response");

  if (readEmptyErrors(body.value) !== "ok") return fail("malformed_response");
  const rows = readResponseRows(body.value);
  if (rows === "malformed_response") return fail("malformed_response");
  const paging = readPaging(body.value);
  if (paging !== "ok") return fail(paging);

  const endpoint = readEndpoint(envelope);
  if (!endpoint.ok) return fail(endpoint.reason);
  if (readGet(body.value, endpoint.endpoint) !== "ok") return fail("malformed_response");

  const requested = readRequestedFixture(envelope);
  if (!requested.ok) return fail(requested.reason);
  const echo = readFixtureEcho(body.value, requested.fixtureId);
  if (echo !== "ok") return fail(echo);

  const walked = walkRows(rows, endpoint.endpoint, requested.fixtureId);
  if (!walked.ok) return fail(walked.reason);

  const provenance = readProvenance(envelope);
  if (!provenance.ok) return fail(provenance.reason);
  const base = sharedFields(provenance, requested.fixtureId);

  if (rows.length === 0) {
    if (endpoint.endpoint === "lineups") {
      return guard({
        ...base,
        endpoint: "lineups",
        observation: "missing",
        observedValue: null,
        startXiCount: null,
        substituteCount: null,
      });
    }
    return guard({
      ...base,
      endpoint: "injuries",
      observation: "missing",
      observedValue: null,
      injuryRecordCount: null,
    });
  }

  if (endpoint.endpoint === "lineups") {
    return guard({
      ...base,
      endpoint: "lineups",
      observation: "present",
      observedValue: walked.startXiCount,
      startXiCount: walked.startXiCount,
      substituteCount: walked.substituteCount,
    });
  }
  return guard({
    ...base,
    endpoint: "injuries",
    observation: "present",
    observedValue: rows.length,
    injuryRecordCount: rows.length,
  });
}
