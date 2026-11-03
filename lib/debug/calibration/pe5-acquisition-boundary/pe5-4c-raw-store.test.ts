/**
 * PE-5.4C increment 6 — offline raw-envelope tests.
 * No provider calls, no environment reads, no sealed 2025 outcome reads.
 *
 * A green run proves same-instance visibility only. It does not prove disk
 * durability, process survival, or a provider quota reset.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

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
  PE5_4C_RAW_STORE_LIMIT,
  appendRaw,
  armAmbiguousRawRead,
  armLostAppendAcknowledgement,
  armRawAppendFailure,
  armRawPartialAppend,
  corruptStoredBytesForTests,
  createRawStore,
  readRaw,
  readRawStoreAudit,
  setRawStoreUnavailable,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/raw-store";
import type {
  AcquisitionApproval,
  ProtocolFlagSnapshot,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/types";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const MAX_AGE_MS = 60_000;
const INSTANCE = "ledger-a";
const CREDENTIAL = "cred-research";
const APPROVAL = "approval:ledger-a";
const SECRET = "super-secret-key";
const PLAYER = "Bukayo Saka";
const BODY_TOKEN = "body-token-9f3a";

const OFFLINE_UTC_MIDNIGHT = {
  version: 1 as const,
  utcOffsetMs: 0,
  resetOffsetMs: 0,
};

type TestClock = {
  now(): number;
  advance(ms: number): void;
  set(ms: number): void;
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
    set(ms: number) {
      value = ms;
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
    fetchTimeoutMs: 1_000,
    maxAgeMs: MAX_AGE_MS,
    expiry: NOW + 86_400_000,
    vendorDayBoundary: OFFLINE_UTC_MIDNIGHT,
    ...overrides,
  };
}

function clearKill(now: number) {
  return { state: "clear", version: 1, updatedAt: now, maxAgeMs: MAX_AGE_MS };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function operationFor(endpoint: "lineups" | "injuries", fixtureId: string): string {
  const derived = deriveOperationId(
    {
      ledgerInstanceId: INSTANCE,
      credentialId: CREDENTIAL,
      approvalId: APPROVAL,
      generation: 0,
    },
    { endpoint, fixtureId },
  );
  if (!derived.ok) throw new Error("canonical operation id was rejected");
  return derived.operationId;
}

function bytesOf(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function setup(maxCaptureLagMs?: number | null, start = NOW) {
  const clock = makeClock(start);
  const ledger = createMemoryLedger({
    approval: approval({ expiry: start + 86_400_000 }),
    clock,
  });
  expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
  const store = createRawStore(
    maxCaptureLagMs === undefined ? { ledger } : { ledger, maxCaptureLagMs },
  );
  return { clock, ledger, store };
}

async function mustSnapshot(ledger: MemoryLedger): Promise<LedgerSnapshot> {
  const read = await readSnapshot(ledger);
  expect(read.ok).toBe(true);
  if (!read.ok) throw new Error("snapshot unavailable");
  return read.snapshot;
}

async function sendBound(
  ledger: MemoryLedger,
  endpoint: "lineups" | "injuries",
  fixtureId: string,
  operationId = operationFor(endpoint, fixtureId),
) {
  const reserved = await tryReserve(ledger, {
    operationId,
    protocolFlags: openFlags(),
    endpoint,
    fixtureId,
  });
  expect(reserved.ok).toBe(true);
  if (!reserved.ok || reserved.idempotent) throw new Error("expected a new reserve");
  const sent = await beginSend(ledger, {
    reservationId: reserved.reservationId,
    fencingToken: reserved.fencingToken,
  });
  expect(sent.ok).toBe(true);
  if (!sent.ok) throw new Error("expected beginSend");
  return { operationId, reserved, sent };
}

function appendInput(
  sent: { reservationId: string; sendToken: string },
  bodyBytes: Uint8Array,
  extras: Record<string, unknown> = {},
) {
  return {
    reservationId: sent.reservationId,
    sendToken: sent.sendToken,
    status: 200,
    bodyBytes,
    ...extras,
  };
}

async function expectSendingUnchanged(ledger: MemoryLedger, operationId: string, occupancy: number) {
  const snapshot = await mustSnapshot(ledger);
  expect(snapshot.rows.find((item) => item.operationId === operationId)?.state).toBe("sending");
  expect(snapshot.occupancy.research).toBe(occupancy);
  expect(snapshot.occupancy.daily).toBe(occupancy);
  return snapshot;
}

describe("PE-5.4C increment 6 raw envelopes", () => {
  it("stores an isolated copy with the canonical envelope id and digest", async () => {
    const { ledger, store } = await setup(5_000);
    const fixtureId = "42";
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", fixtureId);
    const body = bytesOf(`{"ok":true,"note":"${BODY_TOKEN}"}`);
    const before = await mustSnapshot(ledger);

    const appended = await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, body),
    );
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(appended.duplicate).toBe(false);
    expect(appended.envelope).toMatchObject({
      operationId,
      envelopeId: `env-${operationId}`,
      reservationId: reserved.reservationId,
      credentialId: CREDENTIAL,
      approvalId: APPROVAL,
      endpoint: "lineups",
      fixtureId,
      status: 200,
      byteLength: body.byteLength,
      digest: sha256(body),
      captureTimestampVerified: true,
    });
    expect(appended.envelope.capturedAtUtc).toBe(new Date(NOW).toISOString());
    expect(appended.envelope.digest).not.toBe(operationId);

    const read = await readRaw(store, { envelopeId: appended.envelope.envelopeId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(sameBytes(read.bodyBytes, body)).toBe(true);
    expect(read.bodyBytes).not.toBe(body);
    expect(read.envelope).toEqual(appended.envelope);

    const after = await mustSnapshot(ledger);
    expect(after.occupancy).toEqual(before.occupancy);
    expect(after.rows).toEqual(before.rows);
    expect(after.rows[0]?.state).toBe("sending");
  });

  it("keeps the stored bytes when the caller buffer and the returned values change", async () => {
    const { ledger, store } = await setup(5_000);
    const { operationId, reserved, sent } = await sendBound(ledger, "injuries", "7");
    const body = Uint8Array.of(9, 8, 7, 6);
    const pending = appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, body),
    );
    body[0] = 1;
    const appended = await pending;
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;

    const first = await readRaw(store, { operationId });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    first.bodyBytes[0] = 0;
    const mutable = first.envelope as { capturedAtUtc: string | null; fixtureId: string };
    mutable.capturedAtUtc = "1999-01-01T00:00:00.000Z";
    mutable.fixtureId = "99";

    const second = await readRaw(store, { operationId });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(Array.from(second.bodyBytes)).toEqual([9, 8, 7, 6]);
    expect(second.envelope.fixtureId).toBe("7");
    expect(second.envelope.capturedAtUtc).toBe(appended.envelope.capturedAtUtc);
    expect(second.envelope.digest).toBe(sha256(Uint8Array.of(9, 8, 7, 6)));
  });

  it("returns the original envelope for identical bytes and raw_conflict for different bytes", async () => {
    const { clock, ledger, store } = await setup(5_000);
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "11");
    const body = Uint8Array.of(4, 5, 6);
    const proof = { reservationId: reserved.reservationId, sendToken: sent.sendToken };
    const first = await appendRaw(store, appendInput(proof, body));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    clock.advance(1_000);

    const duplicate = await appendRaw(store, appendInput(proof, Uint8Array.of(4, 5, 6)));
    expect(duplicate).toEqual({ ok: true, duplicate: true, envelope: first.envelope });

    const conflict = await appendRaw(store, appendInput(proof, Uint8Array.of(4, 5, 7)));
    expect(conflict).toEqual({ ok: false, reason: "raw_conflict" });
    const read = await readRaw(store, { operationId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(Array.from(read.bodyBytes)).toEqual([4, 5, 6]);
    expect(read.envelope.capturedAtUtc).toBe(first.envelope.capturedAtUtc);
    expect(read.envelope.digest).toBe(first.envelope.digest);
    await expectSendingUnchanged(ledger, operationId, 1);
    expect((await mustSnapshot(ledger)).rowCount).toBe(1);
  });

  it("serializes concurrent identical and conflicting appends into one record", async () => {
    const { ledger, store } = await setup(5_000);
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "12");
    const proof = { reservationId: reserved.reservationId, sendToken: sent.sendToken };
    const body = Uint8Array.of(1, 1, 1);
    const [left, right] = await Promise.all([
      appendRaw(store, appendInput(proof, body)),
      appendRaw(store, appendInput(proof, Uint8Array.of(1, 1, 1))),
    ]);
    expect(left.ok && right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    expect(left.envelope.envelopeId).toBe(right.envelope.envelopeId);
    expect(left.envelope.capturedAtUtc).toBe(right.envelope.capturedAtUtc);
    expect([left.duplicate, right.duplicate].sort()).toEqual([false, true]);

    const other = await sendBound(ledger, "injuries", "13");
    const otherProof = {
      reservationId: other.reserved.reservationId,
      sendToken: other.sent.sendToken,
    };
    const [winner, loser] = await Promise.all([
      appendRaw(store, appendInput(otherProof, Uint8Array.of(2, 2))),
      appendRaw(store, appendInput(otherProof, Uint8Array.of(3, 3))),
    ]);
    const results = [winner, loser];
    const stored = results.find((result) => result.ok);
    const rejected = results.find((result) => !result.ok);
    expect(stored?.ok).toBe(true);
    expect(rejected).toEqual({ ok: false, reason: "raw_conflict" });
    const read = await readRaw(store, { operationId: other.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok || !stored?.ok) return;
    expect(read.envelope.digest).toBe(stored.envelope.digest);
    expect(read.envelope.byteLength).toBe(2);
    expect(sha256(read.bodyBytes)).toBe(read.envelope.digest);
    expect((await mustSnapshot(ledger)).occupancy.research).toBe(2);
    expect((await mustSnapshot(ledger)).rows.every((item) => item.state === "sending")).toBe(true);
    const firstRead = await readRaw(store, { operationId });
    expect(firstRead.ok).toBe(true);
    if (!firstRead.ok) return;
    expect(Array.from(firstRead.bodyBytes)).toEqual([1, 1, 1]);
  });

  it("stores null unverified metadata when the lag policy is absent", async () => {
    const { clock, ledger, store } = await setup();
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "21");
    clock.advance(50);
    const appended = await appendRaw(
      store,
      appendInput(
        { reservationId: reserved.reservationId, sendToken: sent.sendToken },
        Uint8Array.of(1),
        { capturedAtUtc: "1999-01-01T00:00:00.000Z", timestamp: clock.now() },
      ),
    );
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(appended.envelope.capturedAtUtc).toBeNull();
    expect(appended.envelope.captureTimestampVerified).toBe(false);
    expect(JSON.stringify(appended)).not.toContain("1999-01-01");
    const read = await readRaw(store, { operationId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(Array.from(read.bodyBytes)).toEqual([1]);
    expect(read.envelope.capturedAtUtc).toBeNull();
    expect(read.envelope.captureTimestampVerified).toBe(false);
    await expectSendingUnchanged(ledger, operationId, 1);
  });

  it("verifies a ledger timestamp inside the lag bound and keeps it unverified when the lag is exceeded", async () => {
    const within = await setup(1_000);
    const early = await sendBound(within.ledger, "lineups", "31");
    within.clock.advance(1_000);
    const verified = await appendRaw(
      within.store,
      appendInput(
        { reservationId: early.reserved.reservationId, sendToken: early.sent.sendToken },
        Uint8Array.of(8),
        { capturedAtUtc: "2000-01-01T00:00:00.000Z" },
      ),
    );
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.envelope.captureTimestampVerified).toBe(true);
    expect(verified.envelope.capturedAtUtc).toBe(new Date(NOW + 1_000).toISOString());
    expect(verified.envelope.capturedAtUtc).not.toBe(new Date(early.sent.sendingCommittedAt).toISOString());

    const late = await setup(1_000);
    const delayed = await sendBound(late.ledger, "lineups", "32");
    late.clock.advance(1_001);
    const unverified = await appendRaw(
      late.store,
      appendInput(
        { reservationId: delayed.reserved.reservationId, sendToken: delayed.sent.sendToken },
        Uint8Array.of(8),
      ),
    );
    expect(unverified.ok).toBe(true);
    if (!unverified.ok) return;
    expect(unverified.envelope.captureTimestampVerified).toBe(false);
    expect(unverified.envelope.capturedAtUtc).toBe(new Date(NOW + 1_001).toISOString());
    const replay = await appendRaw(
      late.store,
      appendInput(
        { reservationId: delayed.reserved.reservationId, sendToken: delayed.sent.sendToken },
        Uint8Array.of(8),
      ),
    );
    expect(replay).toEqual({ ok: true, duplicate: true, envelope: unverified.envelope });
  });

  it("creates no envelope when the ledger clock is unusable", async () => {
    let throwsLeft = 0;
    let value = NOW;
    const clock = {
      now() {
        if (throwsLeft > 0) {
          throwsLeft -= 1;
          throw new Error(`clock blew up ${SECRET}`);
        }
        return value;
      },
    };
    const ledger = createMemoryLedger({ approval: approval(), clock });
    expect(await replaceKillSwitch(ledger, clearKill(value))).toEqual({ ok: true });
    const store = createRawStore({ ledger, maxCaptureLagMs: 5_000 });
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "41");
    throwsLeft = 1;
    value += 10;
    const appended = await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, Uint8Array.of(1)),
    );
    expect(appended).toEqual({ ok: false, reason: "clock_unavailable" });
    expect(JSON.stringify(appended)).not.toContain(SECRET);
    expect(await readRaw(store, { operationId })).toEqual({ ok: false, reason: "raw_missing" });
    await expectSendingUnchanged(ledger, operationId, 1);

    const backwards = await setup(5_000);
    const bound = await sendBound(backwards.ledger, "injuries", "42");
    backwards.clock.set(bound.sent.sendingCommittedAt - 1);
    expect(await appendRaw(
      backwards.store,
      appendInput(
        { reservationId: bound.reserved.reservationId, sendToken: bound.sent.sendToken },
        Uint8Array.of(2),
      ),
    )).toEqual({ ok: false, reason: "clock_unavailable" });
    expect(await readRaw(backwards.store, { operationId: bound.operationId })).toEqual({
      ok: false,
      reason: "raw_missing",
    });
    await expectSendingUnchanged(backwards.ledger, bound.operationId, 1);

    let absentThrows = 0;
    const absentClock = {
      now() {
        if (absentThrows > 0) {
          absentThrows -= 1;
          throw new Error(`absent clock ${SECRET}`);
        }
        return NOW;
      },
    };
    const absentLedger = createMemoryLedger({ approval: approval(), clock: absentClock });
    expect(await replaceKillSwitch(absentLedger, clearKill(NOW))).toEqual({ ok: true });
    const absentStore = createRawStore({ ledger: absentLedger });
    const absent = await sendBound(absentLedger, "lineups", "43");
    absentThrows = 1;
    const rejected = await appendRaw(
      absentStore,
      appendInput(
        { reservationId: absent.reserved.reservationId, sendToken: absent.sent.sendToken },
        Uint8Array.of(9),
      ),
    );
    expect(rejected).toEqual({ ok: false, reason: "clock_unavailable" });
    expect(JSON.stringify(rejected)).not.toContain(SECRET);
    expect(await readRaw(absentStore, { operationId: absent.operationId })).toEqual({
      ok: false,
      reason: "raw_missing",
    });
    await expectSendingUnchanged(absentLedger, absent.operationId, 1);
  });

  it("rejects an unreadable or backwards ledger clock when no lag policy is set", async () => {
    const cases: { fixtureId: string; value?: unknown; throws?: boolean }[] = [
      { fixtureId: "44", throws: true },
      { fixtureId: "45", value: Number.NaN },
      { fixtureId: "46", value: undefined },
      { fixtureId: "47", value: `not-a-clock ${SECRET}` },
      { fixtureId: "48", value: -1 },
      { fixtureId: "49", value: NOW + 0.5 },
      { fixtureId: "50", value: NOW - 1 },
    ];
    for (const item of cases) {
      let badReads = 0;
      const clock = {
        now() {
          if (badReads > 0) {
            badReads -= 1;
            if (item.throws) throw new Error(`absent clock ${SECRET}`);
            return item.value;
          }
          return NOW;
        },
      };
      const ledger = createMemoryLedger({
        approval: approval(),
        clock: clock as { now(): number },
      });
      expect(await replaceKillSwitch(ledger, clearKill(NOW))).toEqual({ ok: true });
      const store = createRawStore({ ledger });
      const bound = await sendBound(ledger, "lineups", item.fixtureId);
      badReads = 1;
      const appended = await appendRaw(
        store,
        appendInput(
          { reservationId: bound.reserved.reservationId, sendToken: bound.sent.sendToken },
          Uint8Array.of(9),
        ),
      );
      expect(appended).toEqual({ ok: false, reason: "clock_unavailable" });
      expect(JSON.stringify(appended)).not.toContain(SECRET);
      expect(await readRaw(store, { operationId: bound.operationId })).toEqual({
        ok: false,
        reason: "raw_missing",
      });
      await expectSendingUnchanged(ledger, bound.operationId, 1);
    }
  });

  it("rejects a caller clock accessor and an invalid lag policy without a record", async () => {
    const { ledger, store } = await setup(5_000);
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "51");
    const hits = { count: 0 };
    const input = appendInput(
      { reservationId: reserved.reservationId, sendToken: sent.sendToken },
      Uint8Array.of(3),
    );
    Object.defineProperty(input, "capturedAtUtc", {
      get() {
        hits.count += 1;
        return "1999-01-01T00:00:00.000Z";
      },
      enumerable: true,
    });
    expect(await appendRaw(store, input)).toEqual({ ok: false, reason: "operation_rejected" });
    expect(hits.count).toBe(0);
    expect(await readRaw(store, { operationId })).toEqual({ ok: false, reason: "raw_missing" });

    for (const maxCaptureLagMs of [-1, 1.5, Number.NaN, "1000", true]) {
      const { ledger: nextLedger, store: nextStore } = await setup();
      const bound = await sendBound(nextLedger, "lineups", "52");
      const rejectedStore = createRawStore({ ledger: nextLedger, maxCaptureLagMs: maxCaptureLagMs as never });
      expect(await appendRaw(
        rejectedStore,
        appendInput(
          { reservationId: bound.reserved.reservationId, sendToken: bound.sent.sendToken },
          Uint8Array.of(1),
        ),
      )).toEqual({ ok: false, reason: "operation_rejected" });
      expect(await readRaw(rejectedStore, { operationId: bound.operationId })).toEqual({
        ok: false,
        reason: "raw_missing",
      });
      void nextStore;
    }

    const lagHits = { count: 0 };
    const config = { ledger };
    Object.defineProperty(config, "maxCaptureLagMs", {
      get() {
        lagHits.count += 1;
        return 5;
      },
    });
    const accessorStore = createRawStore(config);
    expect(await appendRaw(
      accessorStore,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, Uint8Array.of(1)),
    )).toEqual({ ok: false, reason: "operation_rejected" });
    expect(lagHits.count).toBe(0);
    await expectSendingUnchanged(ledger, operationId, 1);
  });

  it("fails closed for a proof that is missing, wrong, stale, or no longer sending", async () => {
    const { ledger, store } = await setup(5_000);
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "61");
    const body = Uint8Array.of(1);
    expect(await appendRaw(store, appendInput({ reservationId: "res-missing", sendToken: sent.sendToken }, body)))
      .toEqual({ ok: false, reason: "operation_rejected" });
    expect(await appendRaw(store, appendInput({ reservationId: reserved.reservationId, sendToken: "send-wrong" }, body)))
      .toEqual({ ok: false, reason: "invalid_transition" });
    expect(await appendRaw(store, appendInput(
      { reservationId: reserved.reservationId, sendToken: reserved.fencingToken },
      body,
    ))).toEqual({ ok: false, reason: "invalid_transition" });

    const reservedOnly = await tryReserve(ledger, {
      operationId: operationFor("injuries", "62"),
      protocolFlags: openFlags(),
      endpoint: "injuries",
      fixtureId: "62",
    });
    expect(reservedOnly.ok).toBe(true);
    if (!reservedOnly.ok || reservedOnly.idempotent) return;
    expect(await appendRaw(store, appendInput(
      { reservationId: reservedOnly.reservationId, sendToken: "send-0" },
      body,
    ))).toEqual({ ok: false, reason: "invalid_transition" });

    const consumed = await sendBound(ledger, "lineups", "63");
    expect(await recordOutcome(ledger, {
      reservationId: consumed.reserved.reservationId,
      sendToken: consumed.sent.sendToken,
      outcome: "consumed",
    })).toMatchObject({ ok: true, state: "consumed" });
    expect(await appendRaw(store, appendInput(
      { reservationId: consumed.reserved.reservationId, sendToken: consumed.sent.sendToken },
      body,
    ))).toEqual({ ok: false, reason: "invalid_transition" });

    const failed = await sendBound(ledger, "injuries", "64");
    expect(await recordOutcome(ledger, {
      reservationId: failed.reserved.reservationId,
      sendToken: failed.sent.sendToken,
      outcome: "failed",
      failedReason: "outcome_unknown",
    })).toMatchObject({ ok: true, state: "failed" });
    expect(await appendRaw(store, appendInput(
      { reservationId: failed.reserved.reservationId, sendToken: failed.sent.sendToken },
      body,
    ))).toEqual({ ok: false, reason: "invalid_transition" });

    expect(await readRaw(store, { operationId })).toEqual({ ok: false, reason: "raw_missing" });
    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rows.find((item) => item.operationId === operationId)?.state).toBe("sending");
    expect(snapshot.occupancy.research).toBe(4);
    expect(snapshot.occupancy.daily).toBe(4);
  });

  it("does not publish a record when the append fails or is interrupted, and a lost ack stays readable", async () => {
    const { ledger, store } = await setup(5_000);
    const failed = await sendBound(ledger, "lineups", "71");
    expect(await armRawAppendFailure(store)).toEqual({ ok: true });
    const body = bytesOf(`failure ${SECRET}`);
    expect(await appendRaw(store, appendInput(
      { reservationId: failed.reserved.reservationId, sendToken: failed.sent.sendToken },
      body,
    ))).toEqual({ ok: false, reason: "raw_missing" });
    expect(await readRaw(store, { operationId: failed.operationId })).toEqual({
      ok: false,
      reason: "raw_missing",
    });
    expect(await recordOutcome(ledger, {
      reservationId: failed.reserved.reservationId,
      sendToken: failed.sent.sendToken,
      outcome: "failed",
      failedReason: "raw_missing",
    })).toMatchObject({ ok: true, state: "failed" });
    expect((await mustSnapshot(ledger)).occupancy.research).toBe(1);

    const partial = await sendBound(ledger, "lineups", "72");
    expect(await armRawPartialAppend(store)).toEqual({ ok: true });
    expect(await appendRaw(store, appendInput(
      { reservationId: partial.reserved.reservationId, sendToken: partial.sent.sendToken },
      Uint8Array.of(5),
    ))).toEqual({ ok: false, reason: "raw_missing" });
    expect(await readRaw(store, { operationId: partial.operationId })).toEqual({
      ok: false,
      reason: "raw_missing",
    });
    const recovered = await appendRaw(store, appendInput(
      { reservationId: partial.reserved.reservationId, sendToken: partial.sent.sendToken },
      Uint8Array.of(5),
    ));
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;

    const lost = await sendBound(ledger, "injuries", "73");
    const lostBody = Uint8Array.of(6, 7);
    expect(await armLostAppendAcknowledgement(store)).toEqual({ ok: true });
    expect(await appendRaw(store, appendInput(
      { reservationId: lost.reserved.reservationId, sendToken: lost.sent.sendToken },
      lostBody,
    ))).toEqual({ ok: false, reason: "ambiguous" });
    const read = await readRaw(store, { operationId: lost.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(Array.from(read.bodyBytes)).toEqual([6, 7]);
    expect(read.envelope.capturedAtUtc).toBe(new Date(NOW).toISOString());
    const replay = await appendRaw(store, appendInput(
      { reservationId: lost.reserved.reservationId, sendToken: lost.sent.sendToken },
      Uint8Array.of(6, 7),
    ));
    expect(replay).toEqual({ ok: true, duplicate: true, envelope: read.envelope });

    expect(await armAmbiguousRawRead(store)).toEqual({ ok: true });
    expect(await readRaw(store, { operationId: lost.operationId })).toEqual({
      ok: false,
      reason: "ambiguous",
    });
    const afterAmbiguous = await readRaw(store, { envelopeId: read.envelope.envelopeId });
    expect(afterAmbiguous.ok).toBe(true);
    if (!afterAmbiguous.ok) return;
    expect(afterAmbiguous.envelope.capturedAtUtc).toBe(read.envelope.capturedAtUtc);
    expect(Array.from(afterAmbiguous.bodyBytes)).toEqual([6, 7]);

    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rows.find((item) => item.operationId === partial.operationId)?.state).toBe("sending");
    expect(snapshot.rows.find((item) => item.operationId === lost.operationId)?.state).toBe("sending");
    expect(snapshot.occupancy.research).toBe(3);
    expect(snapshot.occupancy.daily).toBe(3);
  });

  it("reports integrity mismatch for tampered bytes and does not repair them", async () => {
    const { ledger, store } = await setup(5_000);
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "81");
    const body = Uint8Array.of(4, 4, 4);
    const appended = await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, body),
    );
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(await corruptStoredBytesForTests(store, operationId)).toEqual({ ok: true });
    expect(await readRaw(store, { operationId })).toEqual({ ok: false, reason: "integrity_mismatch" });
    expect(await readRaw(store, { envelopeId: appended.envelope.envelopeId })).toEqual({
      ok: false,
      reason: "integrity_mismatch",
    });
    expect(await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, body),
    )).toEqual({ ok: false, reason: "integrity_mismatch" });
    expect(await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, Uint8Array.of(1)),
    )).toEqual({ ok: false, reason: "integrity_mismatch" });
    await expectSendingUnchanged(ledger, operationId, 1);
  });

  it("rejects hostile inputs without invoking traps or leaving a record", async () => {
    const { ledger, store } = await setup(5_000);
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "91");
    const proof = { reservationId: reserved.reservationId, sendToken: sent.sendToken };
    const hits = { count: 0 };
    const target = appendInput(proof, Uint8Array.of(1));
    const live = new Proxy(target, {
      get() {
        hits.count += 1;
        return "trap";
      },
    });
    expect(await appendRaw(store, live)).toEqual({ ok: false, reason: "operation_rejected" });
    const revocable = Proxy.revocable(target, {
      get() {
        hits.count += 1;
        return "trap";
      },
    });
    revocable.revoke();
    expect(await appendRaw(store, revocable.proxy)).toEqual({ ok: false, reason: "operation_rejected" });
    expect(hits.count).toBe(0);

    const player = appendInput(proof, bytesOf(PLAYER));
    Object.defineProperty(player, "player", {
      get() {
        hits.count += 1;
        return PLAYER;
      },
    });
    expect(await appendRaw(store, player)).toEqual({ ok: false, reason: "operation_rejected" });
    expect(hits.count).toBe(0);

    const byteCases: unknown[] = [
      [1, 2, 3],
      new ArrayBuffer(2),
      new DataView(new ArrayBuffer(2)),
      Buffer.from([1, 2, 3]),
      new Proxy(Uint8Array.of(1), { get: () => 1 }),
    ];
    for (const bodyBytes of byteCases) {
      expect(await appendRaw(store, { ...proof, status: 200, bodyBytes })).toEqual({
        ok: false,
        reason: "operation_rejected",
      });
    }
    for (const status of [99, 600, 200.5, Number.NaN, "200"]) {
      expect(await appendRaw(store, { ...proof, status, bodyBytes: Uint8Array.of(1) })).toEqual({
        ok: false,
        reason: "operation_rejected",
      });
    }

    const mismatched = operationFor("lineups", "99");
    const reservedMismatch = await tryReserve(ledger, {
      operationId: mismatched,
      protocolFlags: openFlags(),
      endpoint: "lineups",
      fixtureId: "91",
    });
    expect(reservedMismatch.ok).toBe(true);
    if (!reservedMismatch.ok || reservedMismatch.idempotent) return;
    const sentMismatch = await beginSend(ledger, {
      reservationId: reservedMismatch.reservationId,
      fencingToken: reservedMismatch.fencingToken,
    });
    expect(sentMismatch.ok).toBe(true);
    if (!sentMismatch.ok) return;
    expect(await appendRaw(store, appendInput(
      { reservationId: reservedMismatch.reservationId, sendToken: sentMismatch.sendToken },
      Uint8Array.of(1),
    ))).toEqual({ ok: false, reason: "operation_rejected" });

    expect(await readRaw(store, { operationId })).toEqual({ ok: false, reason: "raw_missing" });
    expect(await readRaw(store, { operationId: mismatched })).toEqual({ ok: false, reason: "raw_missing" });
    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rows.every((item) => item.state === "sending")).toBe(true);
    expect(snapshot.occupancy.research).toBe(2);
  });

  it("keeps secrets, body text, player names, and the send token out of errors and audits", async () => {
    const { ledger, store } = await setup(5_000);
    const { reserved, sent } = await sendBound(ledger, "lineups", "101");
    const body = bytesOf(`${SECRET} ${PLAYER} ${BODY_TOKEN}`);
    const appended = await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, body, {
        endpoint: "injuries",
      }),
    );
    expect(appended).toEqual({ ok: false, reason: "operation_rejected" });
    expect(JSON.stringify(appended)).not.toContain(SECRET);
    expect(JSON.stringify(appended)).not.toContain(PLAYER);
    expect(JSON.stringify(appended)).not.toContain(sent.sendToken);

    const stored = await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, body),
    );
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(JSON.stringify(stored)).not.toContain(SECRET);
    expect(JSON.stringify(stored)).not.toContain(PLAYER);
    expect(JSON.stringify(stored)).not.toContain(BODY_TOKEN);
    expect(JSON.stringify(stored)).not.toContain(sent.sendToken);
    expect(stored.envelope).not.toHaveProperty("player");
    expect(stored.envelope).not.toHaveProperty("sendToken");

    const audit = await readRawStoreAudit(store);
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    const rendered = JSON.stringify(audit.audits);
    expect(rendered).not.toContain(SECRET);
    expect(rendered).not.toContain(PLAYER);
    expect(rendered).not.toContain(BODY_TOKEN);
    expect(rendered).not.toContain(sent.sendToken);
    const read = await readRaw(store, { operationId: stored.envelope.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(sameBytes(read.bodyBytes, body)).toBe(true);
  });

  it("does not erase raw bytes when normalization rejects, and a second store does not see them", async () => {
    const { ledger, store } = await setup(5_000);
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "111");
    const body = bytesOf("{not-json");
    const appended = await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, body, {
        status: 500,
      }),
    );
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(normalizePe5AcquisitionResponse(null)).toEqual({ ok: false, reason: "malformed_response" });
    const read = await readRaw(store, { operationId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(sameBytes(read.bodyBytes, body)).toBe(true);
    expect(read.envelope.status).toBe(500);
    expect((await mustSnapshot(ledger)).rows[0]?.state).toBe("sending");

    const other = createRawStore({ ledger, maxCaptureLagMs: 5_000 });
    expect(await readRaw(other, { operationId })).toEqual({ ok: false, reason: "raw_missing" });
    expect(PE5_4C_RAW_STORE_LIMIT).toEqual({
      durability: "in-process-only",
      visibility: "same-instance-only",
      atomicity: "single-process-serialized-queue",
      ledgerBinding: "match-then-append-not-crash-atomic",
      crossProcessUniqueness: false,
      diskPersistence: false,
      processSurvival: false,
      providerDayBoundary: false,
    });
  });

  it("stays inside the offline store boundary", async () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/debug/calibration/pe5-acquisition-boundary/raw-store.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/createApiFootballClient|API_FOOTBALL|classifyPe5Evidence|normalizePe5/);
    expect(source).not.toMatch(/abandonReservation|sweepExpired|recordOutcome|tryReserve|beginSend/);
    expect(source).not.toMatch(/from\s+["']node:fs["']|from\s+["']node:http["']/);
    expect(source).toContain("match-then-append-not-crash-atomic");

    const now = vi.spyOn(Date, "now");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const { ledger, store } = await setup(5_000);
      const { reserved, sent } = await sendBound(ledger, "lineups", "121");
      const appended = await appendRaw(
        store,
        appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, Uint8Array.of(1, 2)),
      );
      expect(appended.ok).toBe(true);
      expect(now).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("treats an unavailable store or ledger as unavailable rather than absence", async () => {
    const { ledger, store } = await setup(5_000);
    const { operationId, reserved, sent } = await sendBound(ledger, "lineups", "131");
    expect(await setLedgerUnavailable(ledger, true)).toEqual({ ok: true });
    expect(await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, Uint8Array.of(1)),
    )).toEqual({ ok: false, reason: "unavailable" });
    expect(await setLedgerUnavailable(ledger, false)).toEqual({ ok: true });
    expect(await readRaw(store, { operationId })).toEqual({ ok: false, reason: "raw_missing" });

    const stored = await appendRaw(
      store,
      appendInput({ reservationId: reserved.reservationId, sendToken: sent.sendToken }, Uint8Array.of(1)),
    );
    expect(stored.ok).toBe(true);
    expect(await setRawStoreUnavailable(store, true)).toEqual({ ok: true });
    expect(await readRaw(store, { operationId })).toEqual({ ok: false, reason: "unavailable" });
    expect(await setRawStoreUnavailable(store, false)).toEqual({ ok: true });
    const read = await readRaw(store, { operationId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(Array.from(read.bodyBytes)).toEqual([1]);
    await expectSendingUnchanged(ledger, operationId, 1);
  });
});
