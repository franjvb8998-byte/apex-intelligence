/**
 * PE-5.4C increment 7 — offline transport simulation tests.
 * No provider calls, no environment reads, no sealed 2025 outcome reads.
 *
 * A green run proves one in-memory gate. It does not prove a measured
 * network timeout, header replay from a raw envelope, or cross-process
 * uniqueness.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { evaluateAuthorization } from "@/lib/debug/calibration/pe5-acquisition-boundary/authorize";
import {
  beginSend,
  createMemoryLedger,
  readSnapshot,
  recordOutcome,
  replaceKillSwitch,
  setLedgerUnavailable,
  tryReserve,
  type LedgerSnapshot,
  type MemoryLedger,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger";
import { normalizePe5AcquisitionResponse } from "@/lib/debug/calibration/pe5-acquisition-boundary/normalize";
import { deriveOperationId } from "@/lib/debug/calibration/pe5-acquisition-boundary/operation-id";
import {
  appendRaw,
  armLostAppendAcknowledgement,
  createRawStore,
  readRaw,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/raw-store";
import type {
  AcquisitionApproval,
  ProtocolFlagSnapshot,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/types";
import {
  PE5_4C_TRANSPORT_LIMIT,
  createOfflineTransport,
  executeOfflineSend,
  readTransportAudit,
  type OfflineTransport,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/transport";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const MAX_AGE_MS = 60_000;
const FETCH_TIMEOUT_MS = 1_000;
const INSTANCE = "ledger-a";
const CREDENTIAL = "cred-research";
const SECRET = "pe54c-secret-value";
const PLAYER = "pe54c-player-token";
const BODY_TOKEN = "pe54c-body-token";
const LOCATION = "https://evil.example/redirect-target";

const OFFLINE_UTC_MIDNIGHT = {
  version: 1 as const,
  utcOffsetMs: 0,
  resetOffsetMs: 0,
};

type TestClock = {
  now(): number;
  advance(ms: number): void;
};

type Sent = {
  operationId: string;
  reservationId: string;
  sendToken: string;
  fencingToken: string;
};

function makeClock(start = NOW): TestClock {
  let value = start;
  return {
    now() {
      return value;
    },
    advance(ms: number) {
      value += ms;
    },
  };
}

function openFlags(): ProtocolFlagSnapshot {
  return {
    PE5_PRODUCTION_WIRING: false,
    acquisitionAuthorized: false,
    collectorAuthorized: false,
    pe53Authorized: false,
    PE53B_LIVE_PROVIDER_AUTHORIZED: false,
  };
}

function approval(overrides: Partial<AcquisitionApproval> = {}): AcquisitionApproval {
  return {
    mode: "offline",
    credentialId: CREDENTIAL,
    ledgerInstanceId: INSTANCE,
    operator: "research-operator",
    researchCeiling: 8,
    dailyCeiling: 8,
    rateCeiling: 8,
    rateWindowMs: 10_000,
    leaseMs: 5_000,
    fetchTimeoutMs: FETCH_TIMEOUT_MS,
    maxAgeMs: MAX_AGE_MS,
    expiry: NOW + 86_400_000,
    vendorDayBoundary: OFFLINE_UTC_MIDNIGHT,
    ...overrides,
  };
}

function clearKill(now = NOW) {
  return { state: "clear" as const, version: 1, updatedAt: now, maxAgeMs: MAX_AGE_MS };
}

function operationFor(
  endpoint: "lineups" | "injuries",
  fixtureId: string,
  ledgerInstanceId = INSTANCE,
): string {
  const derived = deriveOperationId(
    {
      ledgerInstanceId,
      credentialId: CREDENTIAL,
      approvalId: `approval:${ledgerInstanceId}`,
      generation: 0,
    },
    { endpoint, fixtureId },
  );
  if (!derived.ok) throw new Error("canonical operation id was rejected");
  return derived.operationId;
}

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function lineupsBody(fixtureId: string) {
  return {
    get: "fixtures/lineups",
    parameters: { fixture: fixtureId },
    errors: [] as unknown[],
    results: 0,
    paging: { current: 1, total: 1 },
    response: [] as unknown[],
  };
}

async function setup(start = NOW) {
  const clock = makeClock(start);
  const ledger = createMemoryLedger({
    approval: approval({ expiry: start + 86_400_000 }),
    clock,
  });
  expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
  const store = createRawStore({ ledger, maxCaptureLagMs: 5_000 });
  const transport = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
  return { clock, ledger, store, transport };
}

async function openLedger(instanceId: string) {
  const clock = makeClock();
  const ledger = createMemoryLedger({
    approval: approval({ ledgerInstanceId: instanceId }),
    clock,
  });
  expect(await replaceKillSwitch(ledger, clearKill())).toEqual({ ok: true });
  return ledger;
}

async function mustSnapshot(ledger: MemoryLedger): Promise<LedgerSnapshot> {
  const read = await readSnapshot(ledger);
  expect(read.ok).toBe(true);
  if (!read.ok) throw new Error("snapshot unavailable");
  return read.snapshot;
}

async function ledgerView(ledger: MemoryLedger) {
  const snapshot = await mustSnapshot(ledger);
  return {
    occupancy: snapshot.occupancy,
    auditCount: snapshot.audits.length,
    rows: snapshot.rows.map((row) => ({
      reservationId: row.reservationId,
      operationId: row.operationId,
      state: row.state,
      chargeDay: row.chargeDay,
      failedReason: row.failedReason,
      sendingCommittedAt: row.sendingCommittedAt,
    })),
  };
}

async function sendBound(
  ledger: MemoryLedger,
  endpoint: "lineups" | "injuries",
  fixtureId: string,
  operationId = operationFor(endpoint, fixtureId),
  identity?: { endpoint?: "lineups" | "injuries"; fixtureId?: string },
): Promise<Sent> {
  const reserved = await tryReserve(ledger, {
    operationId,
    protocolFlags: openFlags(),
    ...(identity ?? { endpoint, fixtureId }),
  });
  expect(reserved.ok).toBe(true);
  if (!reserved.ok || reserved.idempotent) throw new Error("expected a new reserve");
  const sent = await beginSend(ledger, {
    reservationId: reserved.reservationId,
    fencingToken: reserved.fencingToken,
  });
  expect(sent.ok).toBe(true);
  if (!sent.ok) throw new Error("expected beginSend");
  return {
    operationId,
    reservationId: reserved.reservationId,
    sendToken: sent.sendToken,
    fencingToken: reserved.fencingToken,
  };
}

function gateInput(sent: Pick<Sent, "reservationId" | "sendToken">, script: unknown, extra: Record<string, unknown> = {}) {
  return {
    ledger: extra.ledger,
    reservationId: sent.reservationId,
    sendToken: sent.sendToken,
    script,
    ...extra,
  };
}

function withLedger(
  ledger: MemoryLedger,
  sent: Pick<Sent, "reservationId" | "sendToken">,
  script: unknown,
  extra: Record<string, unknown> = {},
) {
  return gateInput(sent, script, { ledger, ...extra });
}

function completeScript(bodyBytes: Uint8Array, status = 200, headers?: Record<string, unknown>) {
  return headers === undefined
    ? { outcome: "complete", status, bodyBytes }
    : { outcome: "complete", status, bodyBytes, headers };
}

async function attemptCount(transport: OfflineTransport): Promise<number> {
  const audit = await readTransportAudit(transport);
  expect(audit.ok).toBe(true);
  if (!audit.ok) return -1;
  return audit.audits.length;
}

function assertNoLeak(value: unknown) {
  const rendered = JSON.stringify(value);
  expect(rendered).not.toContain(SECRET);
  expect(rendered).not.toContain(PLAYER);
  expect(rendered).not.toContain(BODY_TOKEN);
  expect(rendered).not.toContain("evil.example");
  expect(rendered).not.toContain(LOCATION);
}

describe("PE-5.4C increment 7 offline transport", () => {
  it("runs one script after a visible sending commit and keeps the ledger unchanged", async () => {
    const { ledger, transport } = await setup();
    const decision = evaluateAuthorization(
      { APEX_PE5_ACQUISITION_MODE: "offline", ledgerInstanceId: INSTANCE },
      approval(),
      clearKill(),
      openFlags(),
      NOW,
    );
    expect(decision).toEqual({ decision: "allow-offline" });
    const sent = await sendBound(ledger, "lineups", "15");
    const before = await ledgerView(ledger);
    const body = Uint8Array.of(1, 2, 3, 4);
    const result = await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(body, 200, { "x-ratelimit-requests-remaining": " 15 " })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBe("complete");
    expect(result.status).toBe(200);
    expect(sameBytes(result.bodyBytes, body)).toBe(true);
    expect(result.quotaHeader).toEqual({
      name: "x-ratelimit-requests-remaining",
      value: " 15 ",
    });
    expect(result.request).toMatchObject({
      path: "fixtures/lineups",
      query: { fixture: "15" },
      redirect: "manual",
      fetchTimeoutMs: FETCH_TIMEOUT_MS,
    });
    expect(result.request.signal.aborted).toBe(false);
    expect(result).not.toHaveProperty("capturedAtUtc");
    expect(result.request).not.toHaveProperty("url");
    expect(await attemptCount(transport)).toBe(1);
    expect(await ledgerView(ledger)).toEqual(before);
    assertNoLeak(result);
  });

  it("rejects proof failures without running a script", async () => {
    const { ledger, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "16");
    const before = await ledgerView(ledger);
    const script = completeScript(Uint8Array.of(1));
    const hits = { count: 0 };
    const trapped = completeScript(Uint8Array.of(1));
    Object.defineProperty(trapped, "note", {
      get() {
        hits.count += 1;
        return SECRET;
      },
    });

    expect(await executeOfflineSend(transport, withLedger(ledger, sent, trapped, {
      reservationId: "res-missing",
    }))).toEqual({ ok: false, reason: "reservation_missing" });
    expect(await executeOfflineSend(transport, withLedger(ledger, sent, trapped, {
      sendToken: "send-wrong",
    }))).toEqual({ ok: false, reason: "invalid_transition" });
    expect(await executeOfflineSend(transport, withLedger(ledger, sent, trapped, {
      sendToken: sent.fencingToken,
    }))).toEqual({ ok: false, reason: "invalid_transition" });

    const reservedOnly = await tryReserve(ledger, {
      operationId: operationFor("lineups", "17"),
      protocolFlags: openFlags(),
      endpoint: "lineups",
      fixtureId: "17",
    });
    expect(reservedOnly.ok).toBe(true);
    if (!reservedOnly.ok || reservedOnly.idempotent) return;
    expect(await executeOfflineSend(transport, {
      ledger,
      reservationId: reservedOnly.reservationId,
      sendToken: reservedOnly.fencingToken,
      script,
    })).toEqual({ ok: false, reason: "invalid_transition" });

    const consumed = await sendBound(ledger, "lineups", "18");
    expect(await recordOutcome(ledger, {
      reservationId: consumed.reservationId,
      sendToken: consumed.sendToken,
      outcome: "consumed",
    })).toMatchObject({ ok: true, state: "consumed" });
    expect(await executeOfflineSend(transport, withLedger(ledger, consumed, script))).toEqual({
      ok: false,
      reason: "invalid_transition",
    });

    const failed = await sendBound(ledger, "lineups", "19");
    expect(await recordOutcome(ledger, {
      reservationId: failed.reservationId,
      sendToken: failed.sendToken,
      outcome: "failed",
      failedReason: "outcome_unknown",
    })).toMatchObject({ ok: true, state: "failed" });
    expect(await executeOfflineSend(transport, withLedger(ledger, failed, script))).toEqual({
      ok: false,
      reason: "invalid_transition",
    });

    expect(await tryReserve(ledger, {
      operationId: operationFor("lineups", "20"),
      protocolFlags: openFlags(),
    })).toEqual({ ok: false, reason: "denied", denyReason: "operation_rejected" });
    expect(await tryReserve(ledger, {
      operationId: "purpose-alias",
      protocolFlags: openFlags(),
      endpoint: "lineups",
      fixtureId: "21",
    })).toEqual({ ok: false, reason: "denied", denyReason: "operation_rejected" });

    expect(hits.count).toBe(0);
    expect(await attemptCount(transport)).toBe(0);
    const after = await ledgerView(ledger);
    expect(after.rows.find((row) => row.operationId === sent.operationId)?.state).toBe("sending");
    expect(after.occupancy.research).toBe(before.occupancy.research + 3);
  });

  it("does not run a script when authorization or the kill switch blocks the caller", async () => {
    const missing = evaluateAuthorization(
      { ledgerInstanceId: INSTANCE },
      approval(),
      clearKill(),
      openFlags(),
      NOW,
    );
    expect(missing).toEqual({ decision: "deny", reason: "mode_denied" });
    const pilot = evaluateAuthorization(
      { APEX_PE5_ACQUISITION_MODE: "pilot", ledgerInstanceId: INSTANCE },
      { ...approval(), mode: "pilot" },
      clearKill(),
      openFlags(),
      NOW,
    );
    expect(pilot).toEqual({ decision: "deny", reason: "pilot_not_authorized" });

    const blocked = await setup();
    expect(await replaceKillSwitch(blocked.ledger, {
      state: "engaged",
      version: 2,
      updatedAt: NOW,
      maxAgeMs: MAX_AGE_MS,
    })).toEqual({ ok: true });
    expect(await tryReserve(blocked.ledger, {
      operationId: operationFor("lineups", "22"),
      protocolFlags: openFlags(),
      endpoint: "lineups",
      fixtureId: "22",
    })).toMatchObject({ ok: false, reason: "denied", denyReason: "kill_switch_engaged" });
    expect(await attemptCount(blocked.transport)).toBe(0);

    const reserved = await setup();
    const hold = await tryReserve(reserved.ledger, {
      operationId: operationFor("lineups", "23"),
      protocolFlags: openFlags(),
      endpoint: "lineups",
      fixtureId: "23",
    });
    expect(hold.ok).toBe(true);
    if (!hold.ok || hold.idempotent) return;
    expect(await replaceKillSwitch(reserved.ledger, {
      state: "engaged",
      version: 2,
      updatedAt: NOW,
      maxAgeMs: MAX_AGE_MS,
    })).toEqual({ ok: true });
    expect(await beginSend(reserved.ledger, {
      reservationId: hold.reservationId,
      fencingToken: hold.fencingToken,
    })).toMatchObject({ ok: false, reason: "denied", denyReason: "kill_switch_engaged" });
    expect(await attemptCount(reserved.transport)).toBe(0);
  });

  it("rejects caller substitution before claiming the send", async () => {
    const { ledger, transport, clock } = await setup();
    const sent = await sendBound(ledger, "injuries", "31");
    const body = Uint8Array.of(7);
    const script = completeScript(body);
    const cases: Record<string, unknown>[] = [
      { request: { endpoint: "lineups" } },
      { request: { fixtureId: "32" } },
      { request: { fixtureId: "01" } },
      { request: { query: { fixture: "31", page: "2" } } },
      { request: { query: { team: "31" } } },
      { request: { url: `https://evil.example/injuries?fixture=31` } },
      { request: { url: `//evil.example/injuries?fixture=31` } },
      { request: { url: "injuries?fixture=31&season=2026" } },
      { request: { credentialId: "cred-other" } },
      { request: { credentialId: SECRET } },
      { request: { baseUrl: "https://evil.example" } },
      { request: { headers: { Authorization: SECRET } } },
      { request: { fetchTimeoutMs: 5 } },
      { apiKey: SECRET },
    ];
    for (const extra of cases) {
      const result = await executeOfflineSend(transport, withLedger(ledger, sent, script, extra));
      expect(result).toEqual({ ok: false, reason: "operation_rejected" });
      assertNoLeak(result);
    }
    expect(await attemptCount(transport)).toBe(0);

    clock.advance(5_000);
    const late = await beginSend(ledger, {
      reservationId: sent.reservationId,
      fencingToken: sent.fencingToken,
    });
    expect(late.ok).toBe(false);
    const afterLate = await ledgerView(ledger);
    expect(await executeOfflineSend(transport, withLedger(ledger, sent, script, {
      sendToken: sent.fencingToken,
    }))).toEqual({ ok: false, reason: "invalid_transition" });
    expect(await ledgerView(ledger)).toEqual(afterLate);

    const accepted = await executeOfflineSend(
      transport,
      withLedger(ledger, sent, script, {
        request: {
          endpoint: "injuries",
          fixtureId: "31",
          query: { fixture: "31" },
          url: "injuries?fixture=31",
          credentialId: CREDENTIAL,
          fetchTimeoutMs: FETCH_TIMEOUT_MS,
        },
      }),
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.request.path).toBe("injuries");
    expect(accepted.request.query).toEqual({ fixture: "31" });
    expect(await attemptCount(transport)).toBe(1);
  });

  it("returns duplicate_send for every finished outcome and ignores a purpose alias", async () => {
    const cases: { script: Record<string, unknown>; reason: string; aborted: boolean }[] = [
      { script: { outcome: "timeout" }, reason: "timeout", aborted: true },
      { script: { outcome: "cancelled" }, reason: "cancelled", aborted: true },
      { script: { outcome: "network_before_bytes" }, reason: "response_incomplete", aborted: true },
      {
        script: { outcome: "network_after_bytes", partialBytes: bytesOf(SECRET) },
        reason: "response_incomplete",
        aborted: true,
      },
      {
        script: { outcome: "incomplete", partialBytes: Uint8Array.of(1, 2, 3) },
        reason: "response_incomplete",
        aborted: true,
      },
      { script: { outcome: "outcome_unknown" }, reason: "outcome_unknown", aborted: true },
      {
        script: { outcome: "exception", message: `${SECRET} ${PLAYER} ${LOCATION}` },
        reason: "outcome_unknown",
        aborted: true,
      },
    ];
    for (const [index, item] of cases.entries()) {
      const { ledger, transport } = await setup();
      const fixtureId = String(40 + index);
      const sent = await sendBound(ledger, "lineups", fixtureId);
      const before = await ledgerView(ledger);
      const first = await executeOfflineSend(
        transport,
        withLedger(ledger, sent, item.script, { purpose: "scout-a" }),
      );
      expect(first.ok).toBe(false);
      if (first.ok) continue;
      expect(first.reason).toBe(item.reason);
      expect(first.request?.redirect).toBe("manual");
      expect(first.request?.fetchTimeoutMs).toBe(FETCH_TIMEOUT_MS);
      expect(first.request?.signal.aborted).toBe(item.aborted);
      expect(first).not.toHaveProperty("bodyBytes");
      expect(String(first.request?.signal.reason ?? "")).not.toContain(SECRET);
      assertNoLeak(first);
      const audit = await readTransportAudit(transport);
      expect(audit.ok).toBe(true);
      if (!audit.ok) continue;
      assertNoLeak(audit.audits);
      expect(audit.audits).toHaveLength(1);
      const second = await executeOfflineSend(
        transport,
        withLedger(ledger, sent, completeScript(Uint8Array.of(9)), { purpose: "scout-b" }),
      );
      expect(second).toEqual({ ok: false, reason: "duplicate_send" });
      assertNoLeak(second);
      expect(await attemptCount(transport)).toBe(1);
      expect(await ledgerView(ledger)).toEqual(before);
      expect((await mustSnapshot(ledger)).rowCount).toBe(1);
    }
  });

  it("treats scripted redirects as terminal and does not expose location or body", async () => {
    for (const status of [301, 302, 307, 308, 300, 399]) {
      const { ledger, store, transport } = await setup();
      const sent = await sendBound(ledger, "lineups", "51");
      const hits = { count: 0 };
      const script: Record<string, unknown> = { outcome: "redirect", status };
      Object.defineProperty(script, "location", {
        get() {
          hits.count += 1;
          return LOCATION;
        },
      });
      Object.defineProperty(script, "bodyBytes", {
        get() {
          hits.count += 1;
          return bytesOf(PLAYER);
        },
      });
      const result = await executeOfflineSend(transport, withLedger(ledger, sent, script));
      expect(result).toMatchObject({
        ok: false,
        reason: "redirect_rejected",
        status,
        request: {
          path: "fixtures/lineups",
          query: { fixture: "51" },
          redirect: "manual",
          fetchTimeoutMs: FETCH_TIMEOUT_MS,
        },
      });
      expect(result).not.toHaveProperty("bodyBytes");
      expect(result).not.toHaveProperty("location");
      expect(hits.count).toBe(0);
      assertNoLeak(result);
      const audit = await readTransportAudit(transport);
      expect(audit.ok).toBe(true);
      if (!audit.ok) continue;
      assertNoLeak(audit.audits);
      expect(await readRaw(store, { operationId: sent.operationId })).toEqual({
        ok: false,
        reason: "raw_missing",
      });
      expect(await executeOfflineSend(transport, withLedger(ledger, sent, {
        outcome: "redirect",
        status: 302,
        location: LOCATION,
      }))).toEqual({ ok: false, reason: "duplicate_send" });
      expect((await mustSnapshot(ledger)).rows[0]?.state).toBe("sending");
    }
  });

  it("returns a complete error status without choosing a normalizer reason", async () => {
    const cases = [401, 403, 429, 500];
    for (const status of cases) {
      const { ledger, transport } = await setup();
      const sent = await sendBound(ledger, "lineups", "61");
      const body = bytesOf(`{"message":"daily request quota","token":"${BODY_TOKEN}"}`);
      const headers = status === 429
        ? { "x-ratelimit-requests-remaining": 15 }
        : undefined;
      const result = await executeOfflineSend(
        transport,
        withLedger(ledger, sent, completeScript(body, status, headers)),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.status).toBe(status);
      expect(sameBytes(result.bodyBytes, body)).toBe(true);
      expect(result).not.toHaveProperty("reason");
      const audit = await readTransportAudit(transport);
      expect(audit.ok).toBe(true);
      if (!audit.ok) continue;
      expect(JSON.stringify(audit.audits)).not.toContain(BODY_TOKEN);
    }
  });

  it("isolates buffers and preserves only the allowlisted quota header", async () => {
    const { ledger, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "71");
    const source = Uint8Array.of(9, 8, 7);
    const headers: Record<string, unknown> = { "x-ratelimit-requests-remaining": 15 };
    const result = await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(source, 200, headers)),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    source[0] = 1;
    headers["x-ratelimit-requests-remaining"] = 0;
    headers.Authorization = SECRET;
    expect(Array.from(result.bodyBytes)).toEqual([9, 8, 7]);
    expect(result.quotaHeader).toEqual({ name: "x-ratelimit-requests-remaining", value: 15 });
    result.bodyBytes[0] = 2;
    expect(source[0]).toBe(1);

    const rejected = await setup();
    const again = await sendBound(rejected.ledger, "lineups", "72");
    const sensitive = [
      { Authorization: SECRET },
      { "Set-Cookie": SECRET },
      { "x-api-key": SECRET },
      { "X-RateLimit-Requests-Remaining": 15 },
      { "x-ratelimit-requests-remaining": SECRET.repeat(20) },
    ];
    for (const header of sensitive) {
      const denied = await executeOfflineSend(
        rejected.transport,
        withLedger(rejected.ledger, again, completeScript(Uint8Array.of(1), 200, header)),
      );
      expect(denied).toEqual({ ok: false, reason: "operation_rejected" });
      assertNoLeak(denied);
    }
    expect(await attemptCount(rejected.transport)).toBe(0);
    const clean = await executeOfflineSend(
      rejected.transport,
      withLedger(rejected.ledger, again, completeScript(Uint8Array.of(4), 200)),
    );
    expect(clean.ok).toBe(true);
    if (!clean.ok) return;
    expect(clean.quotaHeader).toBeNull();
    expect(Array.from(clean.bodyBytes)).toEqual([4]);
  });

  it("appends only a complete non-redirect buffer and normalizes after the acknowledgement", async () => {
    const { ledger, store, transport } = await setup();
    const fixtureId = "81";
    const sent = await sendBound(ledger, "lineups", fixtureId);
    const body = bytesOf(JSON.stringify(lineupsBody(fixtureId)));
    const result = await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(body, 200, { "x-ratelimit-requests-remaining": 15 })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.quotaHeader == null) return;
    const appended = await appendRaw(store, {
      reservationId: sent.reservationId,
      sendToken: sent.sendToken,
      status: result.status,
      bodyBytes: result.bodyBytes,
    });
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(JSON.stringify(appended.envelope)).not.toContain("x-ratelimit-requests-remaining");
    const normalized = normalizePe5AcquisitionResponse({
      envelopeId: appended.envelope.envelopeId,
      status: appended.envelope.status,
      headers: { "x-ratelimit-requests-remaining": result.quotaHeader.value },
      endpoint: appended.envelope.endpoint,
      fixtureId: appended.envelope.fixtureId,
      capturedAtUtc: appended.envelope.capturedAtUtc,
      captureTimestampVerified: appended.envelope.captureTimestampVerified,
      body: JSON.parse(new TextDecoder().decode(result.bodyBytes)),
    });
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.observation.observation).toBe("missing");
    expect(normalized.observation.observedValue).toBeNull();
    expect(normalized.observation.availabilityInference).toBe("forbidden");
    expect(normalized.observation.capturedAtUtc).toBe(appended.envelope.capturedAtUtc);
    expect(normalized.observation.captureTimestampVerified).toBe(true);
    const beforeOutcome = await ledgerView(ledger);
    expect(await recordOutcome(ledger, {
      reservationId: sent.reservationId,
      sendToken: sent.sendToken,
      outcome: "consumed",
    })).toMatchObject({ ok: true, state: "consumed" });
    const after = await mustSnapshot(ledger);
    expect(after.rows[0]?.state).toBe("consumed");
    expect(after.occupancy.research).toBe(beforeOutcome.occupancy.research);
    expect(after.occupancy.daily).toBe(beforeOutcome.occupancy.daily);
    expect(after.occupancy.rate).toBe(beforeOutcome.occupancy.rate);
  });

  it("does not replay headers from a raw envelope after a lost acknowledgement", async () => {
    const { ledger, store, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "82");
    const body = bytesOf(JSON.stringify(lineupsBody("82")));
    const result = await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(body, 200, { "x-ratelimit-requests-remaining": 0 })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quotaHeader?.value).toBe(0);
    expect(await armLostAppendAcknowledgement(store)).toEqual({ ok: true });
    expect(await appendRaw(store, {
      reservationId: sent.reservationId,
      sendToken: sent.sendToken,
      status: result.status,
      bodyBytes: result.bodyBytes,
    })).toEqual({ ok: false, reason: "ambiguous" });
    const read = await readRaw(store, { operationId: sent.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.envelope).not.toHaveProperty("headers");
    expect(read.envelope).not.toHaveProperty("quotaHeader");
    expect(JSON.stringify(read.envelope)).not.toContain("x-ratelimit");
    expect(sameBytes(read.bodyBytes, body)).toBe(true);
    expect(PE5_4C_TRANSPORT_LIMIT.headerReplay).toBe(false);
    expect(PE5_4C_TRANSPORT_LIMIT.quotaHeaderInference).toBe(false);
    expect(PE5_4C_TRANSPORT_LIMIT.headerPersistence).toBe(false);
    expect(PE5_4C_TRANSPORT_LIMIT.headerReplayNote).toContain("cannot rebuild");
    expect((await mustSnapshot(ledger)).rows[0]?.state).toBe("sending");
  });

  it("keeps the charge after a terminal failure and after the kill switch engages", async () => {
    const failed = await setup();
    const sent = await sendBound(failed.ledger, "lineups", "91");
    const before = await ledgerView(failed.ledger);
    const result = await executeOfflineSend(
      failed.transport,
      withLedger(failed.ledger, sent, { outcome: "timeout" }),
    );
    expect(result).toMatchObject({ ok: false, reason: "timeout" });
    expect(await ledgerView(failed.ledger)).toEqual(before);
    expect(await recordOutcome(failed.ledger, {
      reservationId: sent.reservationId,
      sendToken: sent.sendToken,
      outcome: "failed",
      failedReason: "timeout",
    })).toMatchObject({ ok: true, state: "failed" });
    const after = await mustSnapshot(failed.ledger);
    expect(after.rows[0]?.failedReason).toBe("timeout");
    expect(after.occupancy.research).toBe(before.occupancy.research);
    expect(after.occupancy.daily).toBe(before.occupancy.daily);
    expect(after.occupancy.rate).toBe(before.occupancy.rate);
    expect(await executeOfflineSend(
      failed.transport,
      withLedger(failed.ledger, sent, { outcome: "complete", status: 200, bodyBytes: Uint8Array.of(1) }),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    const other = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
    expect(await executeOfflineSend(
      other,
      withLedger(failed.ledger, sent, { outcome: "timeout" }),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await attemptCount(other)).toBe(0);

    const killed = await setup();
    const live = await sendBound(killed.ledger, "lineups", "92");
    expect(await replaceKillSwitch(killed.ledger, {
      state: "engaged",
      version: 4,
      updatedAt: NOW,
      maxAgeMs: MAX_AGE_MS,
    })).toEqual({ ok: true });
    const engaged = await ledgerView(killed.ledger);
    const finished = await executeOfflineSend(
      killed.transport,
      withLedger(killed.ledger, live, completeScript(Uint8Array.of(5))),
    );
    expect(finished.ok).toBe(true);
    expect(await ledgerView(killed.ledger)).toEqual(engaged);
    expect(await executeOfflineSend(
      killed.transport,
      withLedger(killed.ledger, live, { outcome: "timeout" }),
    )).toEqual({ ok: false, reason: "duplicate_send" });
  });

  it("lets one of two concurrent calls execute and shares the claim across transports", async () => {
    const { ledger, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "101");
    const other = await sendBound(ledger, "injuries", "102");
    const first = executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(Uint8Array.of(1, 2, 3))),
    );
    const second = executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(Uint8Array.of(4, 5, 6))),
    );
    const [winner, loser] = await Promise.all([first, second]);
    expect(winner.ok).toBe(true);
    if (!winner.ok) return;
    expect(Array.from(winner.bodyBytes)).toEqual([1, 2, 3]);
    expect(loser).toEqual({ ok: false, reason: "duplicate_send" });
    const sibling = executeOfflineSend(
      transport,
      withLedger(ledger, other, completeScript(Uint8Array.of(7))),
    );
    const conflict = executeOfflineSend(
      transport,
      withLedger(ledger, other, completeScript(Uint8Array.of(8))),
    );
    const [left, right] = await Promise.all([sibling, conflict]);
    const oks = [left, right].filter((item) => item.ok);
    const dups = [left, right].filter((item) => !item.ok && item.reason === "duplicate_send");
    expect(oks).toHaveLength(1);
    expect(dups).toHaveLength(1);
    expect(await attemptCount(transport)).toBe(2);
    expect((await mustSnapshot(ledger)).occupancy.research).toBe(2);

    const separate = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
    const repeated = await executeOfflineSend(
      separate,
      withLedger(ledger, sent, completeScript(Uint8Array.of(9))),
    );
    expect(repeated).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await attemptCount(separate)).toBe(0);
    expect(await attemptCount(transport)).toBe(2);
    expect(PE5_4C_TRANSPORT_LIMIT.uniqueness).toBe("per-ledger-object-in-process");
    expect(PE5_4C_TRANSPORT_LIMIT.crossProcessUniqueness).toBe(false);
  });

  it("rejects hostile scripts and proofs without invoking traps", async () => {
    const { ledger, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "111");
    const hits = { count: 0 };
    const target = withLedger(ledger, sent, completeScript(Uint8Array.of(1)));
    const live = new Proxy(target, {
      get() {
        hits.count += 1;
        return SECRET;
      },
    });
    expect(await executeOfflineSend(transport, live)).toEqual({ ok: false, reason: "operation_rejected" });
    const revoked = Proxy.revocable(target, {
      get() {
        hits.count += 1;
        return SECRET;
      },
    });
    revoked.revoke();
    expect(await executeOfflineSend(transport, revoked.proxy)).toEqual({
      ok: false,
      reason: "operation_rejected",
    });

    const accessor = withLedger(ledger, sent, completeScript(Uint8Array.of(1)));
    Object.defineProperty(accessor, "reservationId", {
      get() {
        hits.count += 1;
        return sent.reservationId;
      },
    });
    expect(await executeOfflineSend(transport, accessor)).toEqual({ ok: false, reason: "operation_rejected" });

    const script = { outcome: "complete", status: 200 };
    Object.defineProperty(script, "bodyBytes", {
      get() {
        hits.count += 1;
        return Uint8Array.of(1);
      },
    });
    expect(await executeOfflineSend(transport, withLedger(ledger, sent, script))).toEqual({
      ok: false,
      reason: "operation_rejected",
    });

    const partial = { outcome: "network_after_bytes" };
    Object.defineProperty(partial, "partialBytes", {
      get() {
        hits.count += 1;
        return bytesOf(SECRET);
      },
    });
    const partialResult = await executeOfflineSend(transport, withLedger(ledger, sent, partial));
    expect(partialResult).toMatchObject({ ok: false, reason: "response_incomplete" });
    expect(hits.count).toBe(0);
    assertNoLeak(partialResult);

    const proto = {};
    Object.defineProperty(proto, "fixtureId", {
      get() {
        hits.count += 1;
        return "1";
      },
    });
    const inherited = Object.assign(Object.create(proto), withLedger(
      ledger,
      sent,
      { outcome: "timeout" },
    ));
    expect(await executeOfflineSend(transport, inherited)).toEqual({
      ok: false,
      reason: "operation_rejected",
    });
    expect(hits.count).toBe(0);
    expect(await executeOfflineSend(transport, withLedger(ledger, sent, { outcome: "timeout" }))).toEqual({
      ok: false,
      reason: "duplicate_send",
    });

    const fresh = await setup();
    const next = await sendBound(fresh.ledger, "lineups", "112");
    const byteCases: unknown[] = [
      [1, 2, 3],
      new ArrayBuffer(2),
      new DataView(new ArrayBuffer(2)),
      Buffer.from([1, 2, 3]),
      new Proxy(Uint8Array.of(1), { get: () => 1 }),
    ];
    for (const bodyBytes of byteCases) {
      expect(await executeOfflineSend(fresh.transport, withLedger(fresh.ledger, next, {
        outcome: "complete",
        status: 200,
        bodyBytes,
      }))).toEqual({ ok: false, reason: "operation_rejected" });
    }
    for (const status of [99, 600, 200.5, Number.NaN, "200"]) {
      expect(await executeOfflineSend(fresh.transport, withLedger(fresh.ledger, next, {
        outcome: "complete",
        status,
        bodyBytes: Uint8Array.of(1),
      }))).toEqual({ ok: false, reason: "operation_rejected" });
    }
    for (const outcome of ["retry", "follow", "canceled", ""]) {
      expect(await executeOfflineSend(fresh.transport, withLedger(fresh.ledger, next, { outcome }))).toEqual({
        ok: false,
        reason: "operation_rejected",
      });
    }
    const callback = vi.fn(() => ({ outcome: "complete" }));
    expect(await executeOfflineSend(fresh.transport, withLedger(fresh.ledger, next, callback))).toEqual({
      ok: false,
      reason: "operation_rejected",
    });
    expect(callback).not.toHaveBeenCalled();
    expect(await attemptCount(fresh.transport)).toBe(0);
    const recovered = await executeOfflineSend(
      fresh.transport,
      withLedger(fresh.ledger, next, completeScript(Uint8Array.of(3))),
    );
    expect(recovered.ok).toBe(true);
  });

  it("does not claim a send when the ledger cannot prove it, and a later proof can run once", async () => {
    const { ledger, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "121");
    expect(await setLedgerUnavailable(ledger, true)).toEqual({ ok: true });
    expect(await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(Uint8Array.of(1))),
    )).toEqual({ ok: false, reason: "unavailable" });
    expect(await setLedgerUnavailable(ledger, false)).toEqual({ ok: true });
    expect(await attemptCount(transport)).toBe(0);
    const result = await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(Uint8Array.of(1))),
    );
    expect(result.ok).toBe(true);
    expect(await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(Uint8Array.of(1))),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await setLedgerUnavailable(ledger, true)).toEqual({ ok: true });
    expect(await executeOfflineSend(
      transport,
      withLedger(ledger, sent, { outcome: "timeout" }),
    )).toEqual({ ok: false, reason: "duplicate_send" });
  });

  it("rejects executable adapters and stays off the network", async () => {
    const adapter = vi.fn();
    const closed = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS, fetch: adapter });
    const { ledger } = await setup();
    const sent = await sendBound(ledger, "lineups", "131");
    expect(await executeOfflineSend(
      closed,
      withLedger(ledger, sent, completeScript(Uint8Array.of(1))),
    )).toEqual({ ok: false, reason: "operation_rejected" });
    expect(adapter).not.toHaveBeenCalled();
    expect(await executeOfflineSend(
      createOfflineTransport({ fetchTimeoutMs: 0 }),
      withLedger(ledger, sent, completeScript(Uint8Array.of(1))),
    )).toEqual({ ok: false, reason: "operation_rejected" });
    expect(await executeOfflineSend({ kind: "pe5-offline-transport" }, {})).toEqual({
      ok: false,
      reason: "unavailable",
    });

    const now = vi.spyOn(Date, "now");
    const fetchSpy = vi.fn();
    const timeout = vi.spyOn(globalThis, "setTimeout");
    const interval = vi.spyOn(globalThis, "setInterval");
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const live = await setup();
      const proof = await sendBound(live.ledger, "lineups", "132");
      const result = await executeOfflineSend(
        live.transport,
        withLedger(live.ledger, proof, { outcome: "timeout" }),
      );
      expect(result).toMatchObject({
        ok: false,
        reason: "timeout",
        request: { redirect: "manual", fetchTimeoutMs: FETCH_TIMEOUT_MS },
      });
      expect(now).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(timeout).not.toHaveBeenCalled();
      expect(interval).not.toHaveBeenCalled();
      expect(PE5_4C_TRANSPORT_LIMIT.network).toBe(false);
      expect(PE5_4C_TRANSPORT_LIMIT.timers).toBe(false);
      expect(PE5_4C_TRANSPORT_LIMIT.measuredTimeout).toBe(false);
      expect(PE5_4C_TRANSPORT_LIMIT.timeoutNote).toContain("does not measure");
    } finally {
      now.mockRestore();
      timeout.mockRestore();
      interval.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("stays inside the offline transport boundary", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/debug/calibration/pe5-acquisition-boundary/transport.ts"),
      "utf8",
    );
    expect(source).toContain("matchSendCommit");
    expect(source).toContain('redirect: "manual"');
    const forbidden = [
      /Date\.now/,
      /setTimeout/,
      /setInterval/,
      /process\.env/,
      /\bfetch\s*\(/,
      /JSON\.parse/,
      /appendRaw|readRaw|recordOutcome|tryReserve|beginSend/,
      /evaluateAuthorization|normalizePe5|classifyPe5/,
      /abandonReservation|sweepExpired/,
      /createApiFootballClient|API_FOOTBALL|undici|axios/,
      /node:fs|node:http|node:https|node:net|node:timers/,
      /globalThis/,
      /calendar-2025/,
      /Symbol\.for/,
    ];
    for (const pattern of forbidden) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("lets two ledgers with the same reservation strings each send once", async () => {
    const left = await openLedger("ledger-a");
    const right = await openLedger("ledger-b");
    const shared = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
    const first = await sendBound(left, "lineups", "15", operationFor("lineups", "15", "ledger-a"));
    const second = await sendBound(right, "lineups", "16", operationFor("lineups", "16", "ledger-b"));
    expect(first.reservationId).toBe(second.reservationId);
    expect(first.sendToken).toBe(second.sendToken);
    const leftBefore = await ledgerView(left);
    const rightBefore = await ledgerView(right);
    const leftResult = await executeOfflineSend(
      shared,
      withLedger(left, first, completeScript(Uint8Array.of(1))),
    );
    const rightResult = await executeOfflineSend(
      shared,
      withLedger(right, second, completeScript(Uint8Array.of(2))),
    );
    expect(leftResult.ok).toBe(true);
    expect(rightResult.ok).toBe(true);
    if (!leftResult.ok || !rightResult.ok) return;
    expect(Array.from(leftResult.bodyBytes)).toEqual([1]);
    expect(Array.from(rightResult.bodyBytes)).toEqual([2]);
    expect(await attemptCount(shared)).toBe(2);
    expect(await executeOfflineSend(
      shared,
      withLedger(left, first, completeScript(Uint8Array.of(3))),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await executeOfflineSend(
      shared,
      withLedger(right, second, completeScript(Uint8Array.of(4))),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await ledgerView(left)).toEqual(leftBefore);
    expect(await ledgerView(right)).toEqual(rightBefore);
    expect(await attemptCount(shared)).toBe(2);
  });

  it("keeps one ledger's repeated token and a mismatched token one-shot", async () => {
    const { ledger, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "141");
    const before = await ledgerView(ledger);
    const first = await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(Uint8Array.of(1, 2))),
    );
    expect(first.ok).toBe(true);
    const hits = { count: 0 };
    const script = {};
    Object.defineProperty(script, "outcome", {
      get() {
        hits.count += 1;
        return "timeout";
      },
    });
    expect(await executeOfflineSend(
      transport,
      withLedger(ledger, sent, script),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await executeOfflineSend(
      transport,
      withLedger(ledger, sent, script, { sendToken: "send-other" }),
    )).toEqual({ ok: false, reason: "invalid_transition" });
    expect(hits.count).toBe(0);
    expect(await attemptCount(transport)).toBe(1);
    expect(await ledgerView(ledger)).toEqual(before);
  });

  it("treats two ledger objects with the same instance id as different sends", async () => {
    const left = await openLedger(INSTANCE);
    const right = await openLedger(INSTANCE);
    expect(left).not.toBe(right);
    expect(left.instanceId).toBe(right.instanceId);
    const shared = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
    const first = await sendBound(left, "lineups", "151");
    const second = await sendBound(right, "lineups", "152");
    expect(first.reservationId).toBe("res-1");
    expect(second.reservationId).toBe("res-1");
    expect(first.sendToken).toBe(second.sendToken);
    const leftResult = await executeOfflineSend(
      shared,
      withLedger(left, first, completeScript(Uint8Array.of(5))),
    );
    const rightResult = await executeOfflineSend(
      shared,
      withLedger(right, second, completeScript(Uint8Array.of(6))),
    );
    expect(leftResult.ok).toBe(true);
    expect(rightResult.ok).toBe(true);
    expect(await executeOfflineSend(
      shared,
      withLedger(left, first, { outcome: "timeout" }),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await executeOfflineSend(
      shared,
      withLedger(right, second, { outcome: "timeout" }),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await attemptCount(shared)).toBe(2);
    expect((await mustSnapshot(left)).occupancy.research).toBe(1);
    expect((await mustSnapshot(right)).occupancy.research).toBe(1);
  });

  it("executes one of twenty concurrent calls for one committed send", async () => {
    const { ledger, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "161");
    const calls = Array.from({ length: 20 }, (_, index) => executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(Uint8Array.of(index + 1))),
    ));
    const results = await Promise.all(calls);
    const winners = results.filter((item) => item.ok);
    expect(winners).toHaveLength(1);
    expect(results.filter((item) => !item.ok && item.reason === "duplicate_send")).toHaveLength(19);
    if (!winners[0]?.ok) return;
    expect(winners[0].bodyBytes).toHaveLength(1);
    expect(winners[0].bodyBytes[0]).toBeGreaterThanOrEqual(1);
    expect(winners[0].bodyBytes[0]).toBeLessThanOrEqual(20);
    expect(await attemptCount(transport)).toBe(1);
    expect((await mustSnapshot(ledger)).occupancy.research).toBe(1);
  });

  it("shares one in-process claim across transports for the same ledger object", async () => {
    const { ledger } = await setup();
    const sent = await sendBound(ledger, "lineups", "261");
    const before = await ledgerView(ledger);
    const transports = Array.from({ length: 20 }, () =>
      createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS }),
    );
    const results = await Promise.all(transports.map((gate, index) => executeOfflineSend(
      gate,
      withLedger(ledger, sent, completeScript(Uint8Array.of(index + 1))),
    )));
    const winners = results.filter((item) => item.ok);
    expect(winners).toHaveLength(1);
    expect(results.filter((item) => !item.ok && item.reason === "duplicate_send")).toHaveLength(19);
    expect(winners[0]?.ok).toBe(true);
    if (!winners[0]?.ok) return;
    expect(winners[0].bodyBytes).toHaveLength(1);
    const executed = await Promise.all(transports.map((gate) => attemptCount(gate)));
    expect(executed.reduce((sum, count) => sum + count, 0)).toBe(1);
    expect(await ledgerView(ledger)).toEqual(before);

    const again = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
    const hits = { count: 0 };
    const trapped = {};
    Object.defineProperty(trapped, "outcome", {
      get() {
        hits.count += 1;
        return "timeout";
      },
    });
    expect(await executeOfflineSend(again, withLedger(ledger, sent, trapped, {
      purpose: "retry-with-another-label",
    }))).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await executeOfflineSend(again, withLedger(ledger, sent, trapped, {
      sendToken: "send-other",
    }))).toEqual({ ok: false, reason: "invalid_transition" });
    expect(hits.count).toBe(0);
    expect(await attemptCount(again)).toBe(0);
    expect(await ledgerView(ledger)).toEqual(before);

    const firstGate = transports[0];
    if (firstGate == null) throw new Error("expected a transport");
    const published = await readTransportAudit(firstGate);
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(JSON.stringify(published)).not.toContain("claims");
    expect(findCollection(published)).toBe(false);
    for (const gate of [again, ...transports]) {
      expect(Object.getOwnPropertyNames(gate)).toEqual(["kind"]);
      expect(Object.getOwnPropertySymbols(gate)).toEqual([]);
      expect(findCollection(gate)).toBe(false);
    }
  });

  it("does not let a second transport retry after timeout, redirect, cancel, partial, or success", async () => {
    const cases: { script: Record<string, unknown>; reason?: string; complete: boolean }[] = [
      { script: { outcome: "timeout" }, reason: "timeout", complete: false },
      { script: { outcome: "cancelled" }, reason: "cancelled", complete: false },
      { script: { outcome: "redirect", status: 302, location: LOCATION }, reason: "redirect_rejected", complete: false },
      { script: { outcome: "incomplete" }, reason: "response_incomplete", complete: false },
      { script: completeScript(Uint8Array.of(4)), complete: true },
    ];
    for (const [index, item] of cases.entries()) {
      const { ledger } = await setup();
      const first = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
      const second = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
      const sent = await sendBound(ledger, "injuries", String(270 + index));
      const before = await ledgerView(ledger);
      const opened = await executeOfflineSend(first, withLedger(ledger, sent, item.script));
      if (item.complete) {
        expect(opened.ok).toBe(true);
      } else {
        expect(opened).toMatchObject({ ok: false, reason: item.reason });
      }
      const hits = { count: 0 };
      const trapped = completeScript(Uint8Array.of(9));
      Object.defineProperty(trapped, "note", {
        get() {
          hits.count += 1;
          return "alias";
        },
      });
      expect(await executeOfflineSend(second, withLedger(ledger, sent, trapped, {
        purpose: "purpose-alias",
      }))).toEqual({ ok: false, reason: "duplicate_send" });
      expect(hits.count).toBe(0);
      expect(await attemptCount(first)).toBe(1);
      expect(await attemptCount(second)).toBe(0);
      expect(await ledgerView(ledger)).toEqual(before);
    }
  });

  it("does not expose the claim map on the public transport object", async () => {
    const { ledger, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "171");
    expect((await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(Uint8Array.of(7))),
    )).ok).toBe(true);
    expect(Object.getOwnPropertyNames(transport)).toEqual(["kind"]);
    expect(Object.getOwnPropertySymbols(transport)).toEqual([]);
    expect(findCollection(transport)).toBe(false);
    expect(() => {
      Object.defineProperty(transport, "claimed", { value: new Map() });
    }).toThrow();
    const audit = await readTransportAudit(transport);
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    const published = audit.audits[0] as { script: string } | undefined;
    expect(published).toBeDefined();
    if (published == null) return;
    published.script = "timeout";
    const reread = await readTransportAudit(transport);
    expect(reread.ok).toBe(true);
    if (!reread.ok) return;
    expect(reread.audits[0]?.script).toBe("complete");
    expect(await executeOfflineSend(
      transport,
      withLedger(ledger, sent, { outcome: "timeout" }),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await attemptCount(transport)).toBe(1);
  });

  it("hides thrown transport-handle text and does not consume the real send", async () => {
    const { ledger, transport } = await setup();
    const sent = await sendBound(ledger, "lineups", "181");
    const before = await ledgerView(ledger);
    const sentinel = "pe54c-kind-throw-sentinel";
    const hits = { count: 0 };
    const script = {};
    Object.defineProperty(script, "outcome", {
      get() {
        hits.count += 1;
        return "complete";
      },
    });
    const evil = {};
    Object.defineProperty(evil, "kind", {
      get() {
        throw new Error(`${sentinel} ${SECRET}`);
      },
    });
    let escaped = "";
    let rejected: unknown;
    try {
      rejected = await executeOfflineSend(evil as never, withLedger(ledger, sent, script));
    } catch (error) {
      escaped = error instanceof Error ? error.message : String(error);
    }
    expect(escaped).toBe("");
    expect(rejected).toEqual({ ok: false, reason: "unavailable" });
    expect(JSON.stringify(rejected)).not.toContain(sentinel);
    expect(JSON.stringify(rejected)).not.toContain(SECRET);
    expect(hits.count).toBe(0);
    expect(await ledgerView(ledger)).toEqual(before);
    const audit = await readTransportAudit(transport);
    expect(JSON.stringify(audit)).not.toContain(sentinel);
    expect(await attemptCount(transport)).toBe(0);

    const revokedSentinel = "pe54c-revoked-proxy-sentinel";
    const revocable = Proxy.revocable({ kind: "pe5-offline-transport" }, {
      get() {
        throw new Error(revokedSentinel);
      },
    });
    revocable.revoke();
    let proxyEscaped = "";
    let proxyResult: unknown;
    try {
      proxyResult = await executeOfflineSend(revocable.proxy as never, withLedger(ledger, sent, script));
    } catch (error) {
      proxyEscaped = error instanceof Error ? error.message : String(error);
    }
    expect(proxyEscaped).toBe("");
    expect(proxyResult).toEqual({ ok: false, reason: "unavailable" });
    expect(JSON.stringify(proxyResult)).not.toContain(revokedSentinel);
    expect(hits.count).toBe(0);
    expect(await ledgerView(ledger)).toEqual(before);

    const real = await executeOfflineSend(
      transport,
      withLedger(ledger, sent, completeScript(Uint8Array.of(8))),
    );
    expect(real.ok).toBe(true);
    expect(await attemptCount(transport)).toBe(1);
    expect((await mustSnapshot(ledger)).occupancy.research).toBe(before.occupancy.research);
  });

  it("keeps timeout, cancellation, redirect, partial, and complete results one-shot", async () => {
    const cases: { script: Record<string, unknown>; reason?: string; complete: boolean }[] = [
      { script: { outcome: "timeout" }, reason: "timeout", complete: false },
      { script: { outcome: "cancelled" }, reason: "cancelled", complete: false },
      { script: { outcome: "redirect", status: 302, location: LOCATION }, reason: "redirect_rejected", complete: false },
      {
        script: { outcome: "incomplete", partialBytes: bytesOf(SECRET) },
        reason: "response_incomplete",
        complete: false,
      },
      { script: completeScript(Uint8Array.of(4, 5)), complete: true },
    ];
    for (const [index, item] of cases.entries()) {
      const { ledger, transport } = await setup();
      const sent = await sendBound(ledger, "lineups", String(190 + index));
      const before = await ledgerView(ledger);
      const first = await executeOfflineSend(transport, withLedger(ledger, sent, item.script));
      if (item.complete) {
        expect(first.ok).toBe(true);
      } else {
        expect(first.ok).toBe(false);
        if (!first.ok) expect(first.reason).toBe(item.reason);
        expect(first).not.toHaveProperty("bodyBytes");
        expect(first).not.toHaveProperty("location");
        assertNoLeak(first);
      }
      expect(await executeOfflineSend(
        transport,
        withLedger(ledger, sent, completeScript(Uint8Array.of(9))),
      )).toEqual({ ok: false, reason: "duplicate_send" });
      expect(await attemptCount(transport)).toBe(1);
      expect(await ledgerView(ledger)).toEqual(before);
      const audit = await readTransportAudit(transport);
      expect(audit.ok).toBe(true);
      if (!audit.ok) continue;
      assertNoLeak(audit.audits);
    }
  });

  it("rejects symbol-copied and forged ledger shells without a second script", async () => {
    const { ledger } = await setup();
    const other = await openLedger(INSTANCE);
    const sent = await sendBound(ledger, "lineups", "301");
    const otherSent = await sendBound(other, "lineups", "302");
    const before = await ledgerView(ledger);
    const otherBefore = await ledgerView(other);
    const first = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
    const second = createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS });
    expect((await executeOfflineSend(
      first,
      withLedger(ledger, sent, completeScript(Uint8Array.of(1))),
    )).ok).toBe(true);

    const legacy = Symbol.for("apex.pe5.acquisition-boundary.memory-ledger.state.v1");
    const hits = { count: 0 };
    function trappedScript(byte: number) {
      const script = completeScript(Uint8Array.of(byte));
      Object.defineProperty(script, "note", {
        get() {
          hits.count += 1;
          return "alias";
        },
      });
      return script;
    }
    function copiedShell(): MemoryLedger {
      const shell = {
        kind: ledger.kind,
        instanceId: ledger.instanceId,
        approvalId: ledger.approvalId,
        generation: ledger.generation,
        allowRegeneration: ledger.allowRegeneration,
      };
      for (const symbol of Object.getOwnPropertySymbols(ledger)) {
        const descriptor = Object.getOwnPropertyDescriptor(ledger, symbol);
        if (descriptor != null) Object.defineProperty(shell, symbol, descriptor);
      }
      Object.defineProperty(shell, legacy, {
        value: { kind: "pe5-memory-ledger-state", rows: new Map() },
        enumerable: false,
      });
      return shell;
    }

    const alias = copiedShell();
    expect(await executeOfflineSend(
      second,
      withLedger(alias, sent, trappedScript(2)),
    )).toEqual({ ok: false, reason: "operation_rejected" });
    for (let index = 0; index < 5; index += 1) {
      expect(await executeOfflineSend(
        createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS }),
        withLedger(copiedShell(), sent, trappedScript(10 + index)),
      )).toEqual({ ok: false, reason: "operation_rejected" });
    }
    expect(await executeOfflineSend(
      second,
      withLedger(Object.create(ledger) as MemoryLedger, sent, trappedScript(3)),
    )).toEqual({ ok: false, reason: "operation_rejected" });
    expect(await executeOfflineSend(
      second,
      withLedger(Object.assign({}, ledger), sent, trappedScript(4)),
    )).toEqual({ ok: false, reason: "operation_rejected" });
    const forged = {
      kind: "pe5-memory-ledger" as const,
      generation: 0 as const,
      instanceId: ledger.instanceId,
      approvalId: ledger.approvalId,
      allowRegeneration: false as const,
    };
    expect(await executeOfflineSend(
      second,
      withLedger(forged, sent, trappedScript(5)),
    )).toEqual({ ok: false, reason: "operation_rejected" });
    expect(hits.count).toBe(0);
    expect(await attemptCount(first)).toBe(1);
    expect(await attemptCount(second)).toBe(0);
    expect(await executeOfflineSend(
      second,
      withLedger(ledger, sent, { outcome: "timeout" }),
    )).toEqual({ ok: false, reason: "duplicate_send" });
    expect(await executeOfflineSend(
      second,
      withLedger(ledger, sent, { outcome: "timeout" }, { sendToken: "send-other" }),
    )).toEqual({ ok: false, reason: "invalid_transition" });
    expect((await executeOfflineSend(
      createOfflineTransport({ fetchTimeoutMs: FETCH_TIMEOUT_MS }),
      withLedger(other, otherSent, completeScript(Uint8Array.of(6))),
    )).ok).toBe(true);
    expect(await ledgerView(ledger)).toEqual(before);
    expect(await ledgerView(other)).toEqual(otherBefore);
  });
});

function findCollection(value: unknown, seen = new Set<object>()): boolean {
  if (value instanceof Map || value instanceof WeakMap) return true;
  if (value == null || typeof value !== "object") return false;
  if (seen.has(value) || value === Object.prototype) return false;
  seen.add(value);
  const keys = [...Object.getOwnPropertyNames(value), ...Object.getOwnPropertySymbols(value)];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor != null && "value" in descriptor && findCollection(descriptor.value, seen)) return true;
  }
  return false;
}
