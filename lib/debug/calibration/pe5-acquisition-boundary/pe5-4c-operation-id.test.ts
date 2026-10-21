/**
 * PE-5.4C increment 3 — canonical operation identity tests.
 * No provider calls, no ledger writes, no sealed 2025 outcome reads.
 *
 * Identical ids are not ledger deduplication. tryReserve still accepts a
 * caller-supplied operation id until a later integration.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CANONICAL_OPERATION_PATHS,
  PE5_4C_OPERATION_ID_DEFERRED,
  deriveOperationId,
  type OperationIdSuccess,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/operation-id";

const CONTEXT = {
  ledgerInstanceId: "ledger-a",
  credentialId: "cred-research",
  approvalId: "approval:ledger-a",
  generation: 0,
};

const REJECTED = { ok: false, reason: "operation_rejected" } as const;

function request(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: "lineups",
    fixtureId: "1035037",
    callerPath: "fixtures/lineups",
    ...overrides,
  };
}

function expectId(
  ledgerIdentity: unknown = CONTEXT,
  operationRequest: unknown = request(),
): OperationIdSuccess {
  const result = deriveOperationId(ledgerIdentity, operationRequest);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected an operation id");
  return result;
}

function specDigest(fields: {
  ledgerInstanceId: string;
  credentialId: string;
  canonicalPath: string;
  canonicalFixtureId: string;
  endpoint: string;
  approvalId: string;
  generation: number;
}): string {
  return createHash("sha256")
    .update(
      [
        fields.ledgerInstanceId,
        fields.credentialId,
        fields.canonicalPath,
        fields.canonicalFixtureId,
        fields.endpoint,
        fields.approvalId,
        String(fields.generation),
      ].join("\n"),
      "utf8",
    )
    .digest("hex");
}

describe("PE-5.4C increment 3 operation identity", () => {
  it("purpose-alias keeps one id when only the purpose string changes", () => {
    const first = expectId(CONTEXT, request({ purpose: "availability-scan" }));
    const second = expectId(
      CONTEXT,
      request({ purpose: "retry-with-another-label", runId: "run-9", processId: "pid-2" }),
    );
    expect(first.operationId).toBe(second.operationId);
    expect(first.canonicalPath).toBe("fixtures/lineups");
    expect(Object.keys(first).sort()).toEqual([
      "approvalId",
      "canonicalFixtureId",
      "canonicalPath",
      "credentialId",
      "endpoint",
      "generation",
      "ledgerInstanceId",
      "ok",
      "operationId",
    ]);
    expect(PE5_4C_OPERATION_ID_DEFERRED.fetchCount).toBe("no-transport-in-increment-3");
  });

  it("equivalent-path-identity collapses the permitted lineups spellings", () => {
    const spellings = [
      "/fixtures/lineups",
      "fixtures/lineups",
      "//fixtures/lineups",
      "fixtures\\lineups",
      "  /fixtures/lineups/  ",
    ];
    const ids = spellings.map((callerPath) => expectId(CONTEXT, request({ callerPath })).operationId);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(
      expectId(CONTEXT, { endpoint: "lineups", fixtureId: "1035037" }).operationId,
    );

    const injurySpellings = ["/injuries", "injuries", "//injuries", "injuries\\"];
    const injuryIds = injurySpellings.map(
      (callerPath) =>
        expectId(
          CONTEXT,
          request({ endpoint: "injuries", callerPath, fixtureId: "1035037" }),
        ).operationId,
    );
    expect(new Set(injuryIds).size).toBe(1);
    expect(injuryIds[0]).not.toBe(ids[0]);
    expect(PE5_4C_OPERATION_ID_DEFERRED.ledgerDedup).toBe(
      "tryReserve-still-takes-a-caller-operationId",
    );
  });

  it("idempotent-duplicate returns the same id for the same canonical operation", () => {
    const first = expectId();
    const second = expectId();
    expect(first.operationId).toBe(second.operationId);
    expect(first.operationId).toMatch(/^[0-9a-f]{64}$/);
    expect(PE5_4C_OPERATION_ID_DEFERRED.ledgerDedup).toBe(
      "tryReserve-still-takes-a-caller-operationId",
    );
  });

  it("rejects invalid fixture ids without trimming or coercing them", () => {
    for (const fixtureId of [
      "",
      "0",
      "01",
      "1.2",
      "-1",
      " 12",
      "12 ",
      "1e5",
      "+1",
      "1000000000000",
      "9999999999999",
    ]) {
      expect(deriveOperationId(CONTEXT, request({ fixtureId }))).toEqual(REJECTED);
    }
    expect(deriveOperationId(CONTEXT, request({ fixtureId: 1035037 }))).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, request({ fixtureId: null }))).toEqual(REJECTED);
    expect(expectId(CONTEXT, request({ fixtureId: "1" })).canonicalFixtureId).toBe("1");
    expect(expectId(CONTEXT, request({ fixtureId: "999999999999" })).canonicalFixtureId).toBe(
      "999999999999",
    );
  });

  it("rejects missing or inconsistent ledger-owned identity fields", () => {
    expect(deriveOperationId({}, request())).toEqual(REJECTED);
    for (const field of ["ledgerInstanceId", "credentialId", "approvalId", "generation"]) {
      const incomplete = { ...CONTEXT } as Record<string, unknown>;
      delete incomplete[field];
      expect(deriveOperationId(incomplete, request())).toEqual(REJECTED);
    }
    expect(deriveOperationId({ ...CONTEXT, ledgerInstanceId: " ledger-a" }, request())).toEqual(
      REJECTED,
    );
    expect(deriveOperationId({ ...CONTEXT, approvalId: "approval:ledger-a\nextra" }, request())).toEqual(
      REJECTED,
    );
    expect(deriveOperationId({ ...CONTEXT, generation: -1 }, request())).toEqual(REJECTED);
    expect(deriveOperationId({ ...CONTEXT, generation: 1.5 }, request())).toEqual(REJECTED);
    expect(deriveOperationId({ ...CONTEXT, generation: "0" }, request())).toEqual(REJECTED);
    expect(
      deriveOperationId(CONTEXT, request({ endpoint: "lineups", callerPath: "injuries" })),
    ).toEqual(REJECTED);
  });

  it("rejects unsupported endpoints and endpoint aliases", () => {
    for (const endpoint of [
      "lineup",
      "fixtures/lineups",
      "LINEUPS",
      "injuries ",
      " lineups",
      "players",
      "fixtures",
      "",
    ]) {
      expect(deriveOperationId(CONTEXT, request({ endpoint }))).toEqual(REJECTED);
    }
    const lineups = expectId();
    const injuries = expectId(CONTEXT, request({ endpoint: "injuries", callerPath: "injuries" }));
    expect(lineups.endpoint).toBe("lineups");
    expect(lineups.canonicalPath).toBe(CANONICAL_OPERATION_PATHS.lineups);
    expect(injuries.endpoint).toBe("injuries");
    expect(injuries.canonicalPath).toBe(CANONICAL_OPERATION_PATHS.injuries);
  });

  it("rejects unknown query parameters and fragments", () => {
    expect(deriveOperationId(CONTEXT, request({ callerPath: "fixtures/lineups?page=2" }))).toEqual(
      REJECTED,
    );
    expect(
      deriveOperationId(CONTEXT, request({ callerPath: "fixtures/lineups?fixture=1035037" })),
    ).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, request({ callerPath: "fixtures/lineups#players" }))).toEqual(
      REJECTED,
    );
    expect(deriveOperationId(CONTEXT, request({ query: { page: "2" } }))).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, request({ query: { fixture: "1035037" } }))).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, request({ parameters: { fixture: "1035037" } }))).toEqual(
      REJECTED,
    );
    expect(deriveOperationId(CONTEXT, request({ query: {} }))).toEqual(REJECTED);
  });

  it("rejects path traversal and malformed path variants", () => {
    for (const callerPath of [
      "../fixtures/lineups",
      "fixtures/lineups/../../secrets",
      "..\\fixtures\\lineups",
      "fixtures//lineups",
      "//fixtures//lineups",
      "fixtures/./lineups",
      "fixtures/lineups/extra",
      "lineups",
      "",
      "///",
      "fixtures/lineups/../lineups",
    ]) {
      expect(deriveOperationId(CONTEXT, request({ callerPath }))).toEqual(REJECTED);
    }
    expect(deriveOperationId(CONTEXT, request({ callerPath: 1 }))).toEqual(REJECTED);
  });

  it("matches the SHA-256 payload from the approved field order", () => {
    const derived = expectId();
    const expected = specDigest({
      ledgerInstanceId: "ledger-a",
      credentialId: "cred-research",
      canonicalPath: "fixtures/lineups",
      canonicalFixtureId: "1035037",
      endpoint: "lineups",
      approvalId: "approval:ledger-a",
      generation: 0,
    });
    expect(derived.operationId).toBe(expected);
    expect(expectId().operationId).toBe(derived.operationId);
  });

  it("matches the independent SHA-256 reference vector", () => {
    const derived = deriveOperationId(
      {
        ledgerInstanceId: "ledger-a",
        credentialId: "cred-research",
        approvalId: "approval:ledger-a",
        generation: 0,
      },
      {
        endpoint: "lineups",
        fixtureId: "1035037",
        callerPath: "fixtures/lineups",
      },
    );
    expect(derived.ok).toBe(true);
    if (!derived.ok) throw new Error("expected the reference operation id");
    expect(derived.operationId).toBe(
      "82ecbcf74d5773b1eb008cc0ed0fdf63ddb168a00e3d7bdd63221d2d5fa16679",
    );
  });

  it("separates genuinely distinct canonical operations", () => {
    const base = expectId().operationId;
    expect(expectId(CONTEXT, request({ fixtureId: "1035553" })).operationId).not.toBe(base);
    expect(
      expectId(CONTEXT, request({ endpoint: "injuries", callerPath: "injuries" })).operationId,
    ).not.toBe(base);
    expect(expectId({ ...CONTEXT, approvalId: "approval:renewed" }, request()).operationId).not.toBe(
      base,
    );
    expect(expectId({ ...CONTEXT, generation: 1 }, request()).operationId).not.toBe(base);
    expect(expectId({ ...CONTEXT, credentialId: "cred-other" }, request()).operationId).not.toBe(
      base,
    );
    expect(expectId({ ...CONTEXT, ledgerInstanceId: "ledger-b" }, request()).operationId).not.toBe(
      base,
    );
  });

  it("rejects malformed runtime values and does not call accessors", () => {
    expect(deriveOperationId(null, request())).toEqual(REJECTED);
    expect(deriveOperationId([], request())).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, null)).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, [])).toEqual(REJECTED);
    expect(deriveOperationId("ledger-a", request())).toEqual(REJECTED);

    let reads = 0;
    const accessorRequest = request();
    Object.defineProperty(accessorRequest, "fixtureId", {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return "1035037";
      },
    });
    expect(deriveOperationId(CONTEXT, accessorRequest)).toEqual(REJECTED);
    expect(reads).toBe(0);

    const inherited = Object.create({ endpoint: "lineups", fixtureId: "1035037" });
    expect(deriveOperationId(CONTEXT, inherited)).toEqual(REJECTED);
  });

  it("resists caller-controlled identity overrides", () => {
    const canonical = expectId().operationId;
    expect(deriveOperationId(CONTEXT, request({ approvalId: "attacker" }))).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, request({ generation: 4 }))).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, request({ ledgerInstanceId: "ledger-b" }))).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, request({ credentialId: "cred-other" }))).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, request({ operationId: canonical }))).toEqual(REJECTED);
    expect(deriveOperationId(CONTEXT, request({ canonicalPath: "injuries" }))).toEqual(REJECTED);

    const echoed = expectId(
      CONTEXT,
      request({
        approvalId: CONTEXT.approvalId,
        generation: CONTEXT.generation,
        canonicalPath: "fixtures/lineups",
        ledgerInstanceId: CONTEXT.ledgerInstanceId,
        credentialId: CONTEXT.credentialId,
      }),
    );
    expect(echoed.operationId).toBe(canonical);
  });

  it("ignores expiry and allowRegeneration when the generation stays the same", () => {
    const base = expectId().operationId;
    const stamped = expectId(
      {
        ...CONTEXT,
        expiry: 1_700_000_000_000,
        allowRegeneration: true,
        operator: "research-operator",
        mode: "offline",
      },
      request({ timestamp: 1_700_000_000_000, retry: "second" }),
    );
    expect(stamped.operationId).toBe(base);
    expect(stamped.generation).toBe(0);
  });

  it("rejects a secret-like field without echoing its value", () => {
    const secret = "not-a-real-secret";
    const poisoned = { ...CONTEXT, api_key: secret };
    const result = deriveOperationId(poisoned, request());
    expect(result).toEqual(REJECTED);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("stays offline and does not import the ledger or a provider client", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/debug/calibration/pe5-acquisition-boundary/operation-id.ts"),
      "utf8",
    );
    expect(source.includes("fetch(")).toBe(false);
    expect(source.includes("process.env")).toBe(false);
    expect(source.includes("createApiFootballClient")).toBe(false);
    expect(source.includes("memory-ledger")).toBe(false);
    expect(source.includes("Date.now")).toBe(false);
    expect(source.includes("Math.random")).toBe(false);
    expect(source.includes("node:crypto")).toBe(true);
  });
});
