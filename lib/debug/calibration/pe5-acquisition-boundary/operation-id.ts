/**
 * PE-5.4C increment 3 — canonical operation identity.
 *
 * Offline only. This module hashes the PE-5.4B operation id. It does not
 * reserve a ledger row, open a socket, or read a credential secret.
 * Ledger deduplication remains deferred until tryReserve computes this id.
 */

import { createHash } from "node:crypto";

export const PE5_4C_OPERATION_ID_DEFERRED = {
  ledgerDedup: "tryReserve-still-takes-a-caller-operationId",
  fetchCount: "no-transport-in-increment-3",
} as const;

export const CANONICAL_OPERATION_PATHS = {
  lineups: "fixtures/lineups",
  injuries: "injuries",
} as const;

export const OPERATION_ENDPOINTS = ["lineups", "injuries"] as const;

export type OperationEndpoint = (typeof OPERATION_ENDPOINTS)[number];

export type OperationIdSuccess = {
  readonly ok: true;
  readonly operationId: string;
  readonly endpoint: OperationEndpoint;
  readonly canonicalPath: (typeof CANONICAL_OPERATION_PATHS)[OperationEndpoint];
  readonly canonicalFixtureId: string;
  readonly ledgerInstanceId: string;
  readonly credentialId: string;
  readonly approvalId: string;
  readonly generation: number;
};

export type OperationIdResult =
  | OperationIdSuccess
  | { readonly ok: false; readonly reason: "operation_rejected" };

const FIXTURE_ID = /^[1-9][0-9]{0,11}$/;
const DIGEST = /^[0-9a-f]{64}$/;

/**
 * `ledgerIdentity` is the ledger-owned context. Approval id and generation
 * come from that object. A purpose string on the request is not hashed.
 * A conflicting caller copy of a ledger field is rejected.
 */
export function deriveOperationId(
  ledgerIdentity: unknown,
  request: unknown,
): OperationIdResult {
  if (!isDataRecord(ledgerIdentity) || hasSecretField(ledgerIdentity)) return rejected();
  if (!isDataRecord(request) || hasSecretField(request)) return rejected();

  const ledgerInstanceId = readIdentity(ledgerIdentity, "ledgerInstanceId");
  const credentialId = readIdentity(ledgerIdentity, "credentialId");
  const approvalId = readIdentity(ledgerIdentity, "approvalId");
  const generation = readGeneration(ledgerIdentity);
  if (
    ledgerInstanceId == null ||
    credentialId == null ||
    approvalId == null ||
    generation == null
  ) {
    return rejected();
  }
  if (!matchesLedgerField(request, "ledgerInstanceId", ledgerInstanceId)) return rejected();
  if (!matchesLedgerField(request, "credentialId", credentialId)) return rejected();
  if (!matchesLedgerField(request, "approvalId", approvalId)) return rejected();
  if (!matchesGeneration(request, generation)) return rejected();
  if (readData(request, "operationId").present) return rejected();
  if (readData(request, "query").present || readData(request, "parameters").present) {
    return rejected();
  }

  const endpoint = readEndpoint(request);
  if (endpoint == null) return rejected();
  const canonicalPath = CANONICAL_OPERATION_PATHS[endpoint];

  const fixture = readData(request, "fixtureId");
  if (!fixture.present || !isFixtureId(fixture.value)) return rejected();

  if (!callerPathMatches(request, canonicalPath)) return rejected();
  const echoedPath = readData(request, "canonicalPath");
  if (echoedPath.present && echoedPath.value !== canonicalPath) return rejected();

  const operationId = createHash("sha256")
    .update(
      [
        ledgerInstanceId,
        credentialId,
        canonicalPath,
        fixture.value,
        endpoint,
        approvalId,
        String(generation),
      ].join("\n"),
      "utf8",
    )
    .digest("hex");
  if (!DIGEST.test(operationId)) return rejected();

  return {
    ok: true,
    operationId,
    endpoint,
    canonicalPath,
    canonicalFixtureId: fixture.value,
    ledgerInstanceId,
    credentialId,
    approvalId,
    generation,
  };
}

function rejected(): OperationIdResult {
  return { ok: false, reason: "operation_rejected" };
}

function readEndpoint(request: object): OperationEndpoint | null {
  const endpoint = readData(request, "endpoint");
  if (!endpoint.present || typeof endpoint.value !== "string") return null;
  if (endpoint.value === "lineups" || endpoint.value === "injuries") return endpoint.value;
  return null;
}

function callerPathMatches(request: object, canonicalPath: string): boolean {
  const presented = readData(request, "callerPath");
  if (!presented.present) return true;
  if (typeof presented.value !== "string") return false;
  const normalized = normalizeCallerPath(presented.value);
  return normalized === canonicalPath;
}

function normalizeCallerPath(value: string): string | null {
  const slashed = value.trim().replace(/\\/g, "/");
  const stripped = slashed.replace(/^\/+|\/+$/g, "");
  if (stripped.length === 0) return null;
  if (stripped.includes("//") || stripped.includes("?") || stripped.includes("#")) return null;
  return stripped;
}

function readIdentity(record: object, key: string): string | null {
  const read = readData(record, key);
  if (!read.present || !isLedgerName(read.value)) return null;
  return read.value;
}

function readGeneration(record: object): number | null {
  const read = readData(record, "generation");
  if (!read.present || !isGeneration(read.value)) return null;
  return read.value;
}

function matchesLedgerField(request: object, key: string, expected: string): boolean {
  const read = readData(request, key);
  if (!read.present) return true;
  return read.value === expected;
}

function matchesGeneration(request: object, expected: number): boolean {
  const read = readData(request, "generation");
  if (!read.present) return true;
  return read.value === expected;
}

function isFixtureId(value: unknown): value is string {
  return typeof value === "string" && FIXTURE_ID.test(value);
}

function isLedgerName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !/[\r\n]/.test(value)
  );
}

function isGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hasSecretField(record: object): boolean {
  let keys: string[];
  try {
    keys = Object.getOwnPropertyNames(record);
  } catch {
    return true;
  }
  return keys.some((key) => /secret|password|token|api[_-]?key|(?:^|_)key$/i.test(key));
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
