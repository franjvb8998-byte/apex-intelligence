/**
 * PE-5.4C increment 2 — offline in-memory ledger tests.
 * No provider calls, no environment reads, no sealed 2025 outcome reads.
 *
 * Fetch counts, canonical operation-id hashing, and vendor-day rebind are
 * later increments. Those portions are asserted as deferred.
 *
 * Promise.all races check one-winner occupancy. They stay green if the
 * in-memory queue is removed: after each yield the transition rechecks, then
 * commits synchronously, so the public API cannot show a torn write.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  PE5_4C_LEDGER_DEFERRED,
  PE5_4C_MEMORY_LEDGER_LIMIT,
  abandonReservation,
  armLostAcknowledgement,
  armUnattestedLookup,
  beginSend,
  createMemoryLedger,
  insertExternalCharge,
  lookupReservation,
  readKillSwitch,
  readSnapshot,
  recordOutcome,
  replaceKillSwitch,
  setLedgerUnavailable,
  sweepExpired,
  tryReserve,
  type LedgerRowView,
  type LedgerSnapshot,
  type MemoryLedger,
  type TryReserveResult,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger";
import type {
  AcquisitionApproval,
  ProtocolFlagSnapshot,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/types";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const MAX_AGE_MS = 60_000;

type TestClock = {
  now(): number;
  advance(ms: number): void;
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
    credentialId: "cred-research",
    ledgerInstanceId: "ledger-a",
    operator: "research-operator",
    researchCeiling: 8,
    dailyCeiling: 8,
    rateCeiling: 8,
    rateWindowMs: 10_000,
    leaseMs: 5_000,
    fetchTimeoutMs: 1_000,
    maxAgeMs: MAX_AGE_MS,
    expiry: NOW + 86_400_000,
    ...overrides,
  };
}

function clearKill(now: number, overrides: Record<string, unknown> = {}) {
  return {
    state: "clear",
    version: 1,
    updatedAt: now,
    maxAgeMs: MAX_AGE_MS,
    ...overrides,
  };
}

function reserveInput(operationId: string) {
  return { operationId, protocolFlags: openFlags() };
}

async function setup(overrides: Partial<AcquisitionApproval> = {}, start = NOW) {
  const clock = makeClock(start);
  const record = approval({ expiry: start + 86_400_000, ...overrides });
  const ledger = createMemoryLedger({ approval: record, clock });
  expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
  return { clock, ledger, approval: record };
}

function isCharged(state: string): boolean {
  return state === "reserved" || state === "sending" || state === "consumed" || state === "failed";
}

function isNewReserve(
  result: TryReserveResult,
): result is Extract<TryReserveResult, { ok: true; idempotent: false }> {
  return result.ok === true && result.idempotent === false;
}

function expectTransportDeferred(): void {
  expect(PE5_4C_LEDGER_DEFERRED.fetchCount).toBe("no-transport-in-increment-2");
}

async function mustSnapshot(ledger: MemoryLedger): Promise<LedgerSnapshot> {
  const read = await readSnapshot(ledger);
  expect(read.ok).toBe(true);
  if (!read.ok) throw new Error("snapshot unavailable");
  return read.snapshot;
}

async function reserveNew(ledger: MemoryLedger, operationId: string) {
  const result = await tryReserve(ledger, reserveInput(operationId));
  expect(result.ok).toBe(true);
  if (!result.ok || result.idempotent) throw new Error(`expected a new reserve for ${operationId}`);
  return result;
}

async function sendNew(ledger: MemoryLedger, operationId: string) {
  const reserved = await reserveNew(ledger, operationId);
  const sent = await beginSend(ledger, {
    reservationId: reserved.reservationId,
    fencingToken: reserved.fencingToken,
  });
  expect(sent.ok).toBe(true);
  if (!sent.ok) throw new Error(`expected beginSend for ${operationId}`);
  return { reserved, sent };
}

async function finish(
  ledger: MemoryLedger,
  operationId: string,
  outcome: "consumed" | "failed",
) {
  const { reserved, sent } = await sendNew(ledger, operationId);
  const recorded = await recordOutcome(ledger, {
    reservationId: reserved.reservationId,
    sendToken: sent.sendToken,
    outcome,
    failedReason: outcome === "failed" ? "outcome_unknown" : undefined,
  });
  expect(recorded.ok).toBe(true);
  if (!recorded.ok) throw new Error(`expected ${outcome} for ${operationId}`);
  return { reserved, sent, recorded };
}

function row(snapshot: LedgerSnapshot, operationId: string): LedgerRowView {
  const found = snapshot.rows.find((candidate) => candidate.operationId === operationId);
  if (found == null) throw new Error(`missing row ${operationId}`);
  return found;
}

describe("PE-5.4C increment 2 memory ledger", () => {
  it("daily-ceiling-held denies the next reserve after consumed and failed rows", async () => {
    const { ledger } = await setup({ dailyCeiling: 5, researchCeiling: 8, rateCeiling: 8 });
    await finish(ledger, "day-1", "consumed");
    await finish(ledger, "day-2", "consumed");
    await finish(ledger, "day-3", "consumed");
    await finish(ledger, "day-4", "failed");
    await finish(ledger, "day-5", "failed");

    expect(await tryReserve(ledger, reserveInput("day-6"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "daily_ceiling",
    });

    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(5);
    expect(snapshot.occupancy.daily).toBe(5);
    expect(snapshot.occupancy.research).toBe(5);
    expect(snapshot.rows.filter((candidate) => candidate.state === "consumed")).toHaveLength(3);
    expect(snapshot.rows.filter((candidate) => candidate.state === "failed")).toHaveLength(2);
    expect(snapshot.rows.every((candidate) => isCharged(candidate.state))).toBe(true);
    expectTransportDeferred();
  });

  it("sending-occupancy keeps daily and research charges after failed and consumed outcomes", async () => {
    const { ledger, clock } = await setup({
      dailyCeiling: 5,
      researchCeiling: 8,
      rateCeiling: 8,
    });
    const sent: Array<Awaited<ReturnType<typeof sendNew>>> = [];
    for (const operationId of ["send-1", "send-2", "send-3", "send-4", "send-5"]) {
      sent.push(await sendNew(ledger, operationId));
    }

    expect(await tryReserve(ledger, reserveInput("send-6"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "daily_ceiling",
    });

    const before = await mustSnapshot(ledger);
    const stamp = row(before, "send-1").sendingCommittedAt;
    const chargeDay = row(before, "send-1").chargeDay;
    expect(await recordOutcome(ledger, {
      reservationId: sent[0].reserved.reservationId,
      sendToken: sent[0].sent.sendToken,
      outcome: "failed",
      failedReason: "outcome_unknown",
    })).toMatchObject({ ok: true, state: "failed" });

    expect(await tryReserve(ledger, reserveInput("send-7"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "daily_ceiling",
    });

    const failedRow = row(await mustSnapshot(ledger), "send-1");
    expect(failedRow.state).toBe("failed");
    expect(failedRow.sendingCommittedAt).toBe(stamp);
    expect(failedRow.chargeDay).toBe(chargeDay);

    expect(await recordOutcome(ledger, {
      reservationId: sent[1].reserved.reservationId,
      sendToken: sent[1].sent.sendToken,
      outcome: "consumed",
    })).toMatchObject({ ok: true, state: "consumed", sendingCommittedAt: sent[1].sent.sendingCommittedAt });

    expect(await tryReserve(ledger, reserveInput("send-8"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "daily_ceiling",
    });

    const raced = sent[2];
    const [consumed, failed] = await Promise.all([
      recordOutcome(ledger, {
        reservationId: raced.reserved.reservationId,
        sendToken: raced.sent.sendToken,
        outcome: "consumed",
      }),
      recordOutcome(ledger, {
        reservationId: raced.reserved.reservationId,
        sendToken: raced.sent.sendToken,
        outcome: "failed",
        failedReason: "outcome_unknown",
      }),
    ]);
    expect([consumed, failed].filter((result) => result.ok)).toHaveLength(1);
    expect([consumed, failed].filter((result) => !result.ok)).toHaveLength(1);

    clock.advance(5_000);
    expect(await sweepExpired(ledger)).toEqual({ ok: true, released: 0 });
    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(5);
    expect(snapshot.occupancy.daily).toBe(5);
    expect(snapshot.occupancy.research).toBe(5);
    expect(snapshot.rows.every((candidate) => isCharged(candidate.state))).toBe(true);
    expect(snapshot.rows.some((candidate) => candidate.state === "expired")).toBe(false);
  });

  it("research-cap-held denies another reserve when failed and consumed rows fill the ceiling", async () => {
    const record = approval({ researchCeiling: 2, dailyCeiling: 8, rateCeiling: 8 });
    const clock = makeClock();
    const ledger = createMemoryLedger({ approval: record, clock });
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });

    await finish(ledger, "research-failed", "failed");
    await finish(ledger, "research-consumed", "consumed");
    expect(await tryReserve(ledger, reserveInput("research-next"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "research_ceiling",
    });

    (record as { researchCeiling: number }).researchCeiling = 50;
    expect(await tryReserve(ledger, reserveInput("research-mutated"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "research_ceiling",
    });

    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.occupancy.research).toBe(2);
    expect(snapshot.rows.map((candidate) => candidate.state).sort()).toEqual(["consumed", "failed"]);
    expect(snapshot.rows.every((candidate) => isCharged(candidate.state))).toBe(true);
  });

  it("rate-window-held denies without sleeping and allows a reserve after the window ages out", async () => {
    const { ledger, clock } = await setup({
      rateCeiling: 2,
      rateWindowMs: 1_000,
      dailyCeiling: 8,
      researchCeiling: 8,
    });
    await finish(ledger, "rate-1", "consumed");
    await finish(ledger, "rate-2", "consumed");

    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    try {
      expect(await tryReserve(ledger, reserveInput("rate-3"))).toEqual({
        ok: false,
        reason: "denied",
        denyReason: "rate_ceiling",
      });
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    } finally {
      setTimeoutSpy.mockRestore();
    }

    clock.advance(999);
    expect(await tryReserve(ledger, reserveInput("rate-3"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "rate_ceiling",
    });

    clock.advance(1);
    const allowed = await reserveNew(ledger, "rate-3");
    expect(allowed.state).toBe("reserved");

    const held = await setup({
      rateCeiling: 1,
      rateWindowMs: 1_000,
      leaseMs: 5_000,
      dailyCeiling: 8,
      researchCeiling: 8,
    });
    await reserveNew(held.ledger, "rate-hold");
    held.clock.advance(1_000);
    expect(await tryReserve(held.ledger, reserveInput("rate-after-window"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "rate_ceiling",
    });
    const snapshot = await mustSnapshot(held.ledger);
    expect(row(snapshot, "rate-hold").state).toBe("reserved");
    expect(snapshot.occupancy.rate).toBe(1);
  });

  it("quota-race lets one caller reserve and one beginSend win on a shared ledger", async () => {
    const { ledger } = await setup({ dailyCeiling: 1, researchCeiling: 5, rateCeiling: 5 });
    const [first, second] = await Promise.all([
      tryReserve(ledger, reserveInput("race-a")),
      tryReserve(ledger, reserveInput("race-b")),
    ]);
    const wins = [first, second].filter(isNewReserve);
    const denials = [first, second].filter(
      (result) => !result.ok && result.reason === "denied" && result.denyReason === "daily_ceiling",
    );
    expect(wins).toHaveLength(1);
    expect(denials).toHaveLength(1);

    const winner = wins[0];
    const sends = await Promise.all([
      beginSend(ledger, {
        reservationId: winner.reservationId,
        fencingToken: winner.fencingToken,
      }),
      beginSend(ledger, {
        reservationId: winner.reservationId,
        fencingToken: winner.fencingToken,
      }),
    ]);
    expect(sends.filter((result) => result.ok)).toHaveLength(1);
    expect(sends.filter((result) => !result.ok && result.reason === "denied")).toHaveLength(1);

    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.rows[0]?.state).toBe("sending");
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expectTransportDeferred();

    const many = await setup({ dailyCeiling: 2, researchCeiling: 8, rateCeiling: 8 });
    const results = await Promise.all(
      ["c1", "c2", "c3", "c4", "c5"].map((operationId) =>
        tryReserve(many.ledger, reserveInput(operationId)),
      ),
    );
    expect(results.filter(isNewReserve)).toHaveLength(2);
    expect(results.filter((result) => !result.ok)).toHaveLength(3);
    const manySnapshot = await mustSnapshot(many.ledger);
    expect(manySnapshot.rowCount).toBe(2);
    expect(manySnapshot.occupancy.daily).toBe(2);
  });

  it("stale-token rejects beginSend after the sweeper expires the reservation", async () => {
    const { ledger, clock } = await setup();
    const reserved = await reserveNew(ledger, "stale-1");
    clock.advance(5_000);
    expect(await sweepExpired(ledger)).toEqual({ ok: true, released: 1 });

    const sent = await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    });
    expect(sent).toEqual({ ok: false, reason: "denied", denyReason: "stale_token" });

    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rows.some((candidate) => candidate.state === "sending")).toBe(false);
    expect(row(snapshot, "stale-1").state).toBe("expired");
    expect(snapshot.occupancy.daily).toBe(0);
    expect(snapshot.occupancy.research).toBe(0);
    expectTransportDeferred();
  });

  it("lease-too-short refuses beginSend when the remaining lease is not greater than the timeout", async () => {
    const tooShort = await setup();
    const reserved = await reserveNew(tooShort.ledger, "lease-short");
    tooShort.clock.advance(4_000);
    expect(await beginSend(tooShort.ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "lease_too_short" });

    const snapshot = await mustSnapshot(tooShort.ledger);
    expect(row(snapshot, "lease-short").state).toBe("reserved");
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expectTransportDeferred();

    const boundary = await setup();
    const held = await reserveNew(boundary.ledger, "lease-ok");
    boundary.clock.advance(3_999);
    const sent = await beginSend(boundary.ledger, {
      reservationId: held.reservationId,
      fencingToken: held.fencingToken,
    });
    expect(sent.ok).toBe(true);
    expect(row(await mustSnapshot(boundary.ledger), "lease-ok").state).toBe("sending");
  });

  it("crash-before-send releases the charge on sweep and rejects the old token", async () => {
    const { ledger, clock } = await setup({
      dailyCeiling: 1,
      researchCeiling: 1,
      rateCeiling: 1,
    });
    const reserved = await reserveNew(ledger, "crash-1");
    clock.advance(5_000);
    expect(await sweepExpired(ledger)).toEqual({ ok: true, released: 1 });

    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "stale_token" });

    const expired = await tryReserve(ledger, reserveInput("crash-1"));
    expect(expired).toMatchObject({
      ok: true,
      idempotent: true,
      state: "expired",
      fencingToken: null,
    });
    expect((await mustSnapshot(ledger)).rowCount).toBe(1);

    const replacement = await reserveNew(ledger, "crash-2");
    expect(replacement.state).toBe("reserved");
    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(2);
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expect(row(snapshot, "crash-1").state).toBe("expired");
  });

  it("kill-before-send rejects beginSend when the switch is engaged and leaves the row reserved", async () => {
    const { ledger } = await setup();
    const reserved = await reserveNew(ledger, "kill-send");
    expect(await replaceKillSwitch(ledger, { state: "engaged", version: 2 })).toEqual({ ok: true });

    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "kill_switch_engaged" });

    const snapshot = await mustSnapshot(ledger);
    expect(row(snapshot, "kill-send").state).toBe("reserved");
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expectTransportDeferred();
  });

  it("kill-while-running fails the next beginSend after the ledger record changes", async () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/debug/calibration/pe5-acquisition-boundary/memory-ledger.ts"),
      "utf8",
    );
    expect(source.includes("process.env")).toBe(false);

    const { ledger, clock } = await setup();
    const reserved = await reserveNew(ledger, "kill-running");
    const mutable = clearKill(clock.now());
    expect(await replaceKillSwitch(ledger, mutable)).toEqual({ ok: true });
    mutable.state = "engaged";
    expect(await readKillSwitch(ledger)).toMatchObject({ ok: true, state: "clear" });

    expect(await replaceKillSwitch(ledger, { state: "engaged" })).toEqual({ ok: true });
    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "kill_switch_engaged" });
    expect(row(await mustSnapshot(ledger), "kill-running").state).toBe("reserved");
  });

  it("kill-stale denies beginSend when a clear record is outside maxAgeMs", async () => {
    const { ledger, clock } = await setup();
    const reserved = await reserveNew(ledger, "kill-stale");
    expect(await replaceKillSwitch(ledger, clearKill(clock.now() - MAX_AGE_MS - 1))).toEqual({
      ok: true,
    });
    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "kill_switch_stale" });
    expect(row(await mustSnapshot(ledger), "kill-stale").state).toBe("reserved");

    expect(await replaceKillSwitch(ledger, clearKill(clock.now() + 1))).toEqual({ ok: true });
    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "kill_switch_stale" });
  });

  it("kill-before-reserve denies when the switch is missing or engaged", async () => {
    const clock = makeClock();
    const ledger = createMemoryLedger({ approval: approval(), clock });
    expect(await tryReserve(ledger, reserveInput("kill-missing"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "kill_switch_engaged",
    });
    expect(await replaceKillSwitch(ledger, { state: "engaged" })).toEqual({ ok: true });
    expect(await tryReserve(ledger, reserveInput("kill-engaged"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "kill_switch_engaged",
    });
    expect((await mustSnapshot(ledger)).rowCount).toBe(0);
  });

  it("ledger-down fails closed without inserting and does not treat a failed read as an empty ledger", async () => {
    const { ledger } = await setup();
    expect(await setLedgerUnavailable(ledger, true)).toEqual({ ok: true });
    expect(await tryReserve(ledger, reserveInput("down-1"))).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await lookupReservation(ledger, "down-1")).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await readSnapshot(ledger)).toEqual({ ok: false, reason: "unavailable" });

    expect(await setLedgerUnavailable(ledger, false)).toEqual({ ok: true });
    expect(await lookupReservation(ledger, "down-1")).toEqual({ ok: true, found: false });
    await reserveNew(ledger, "down-1");

    expect(await setLedgerUnavailable(ledger, true)).toEqual({ ok: true });
    expect(await sweepExpired(ledger)).toEqual({ ok: false, reason: "unavailable" });
    expect(await tryReserve(ledger, reserveInput("down-2"))).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await setLedgerUnavailable(ledger, false)).toEqual({ ok: true });

    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(1);
    expect(row(snapshot, "down-1").state).toBe("reserved");
    expect(snapshot.occupancy.daily).toBe(1);
    expectTransportDeferred();
  });

  it("an unattested lookup is not an empty ledger and does not clear a charge", async () => {
    const { ledger } = await setup();
    await reserveNew(ledger, "ambiguous-1");
    expect(await armUnattestedLookup(ledger)).toEqual({ ok: true });
    expect(await lookupReservation(ledger, "ambiguous-1")).toEqual({
      ok: false,
      reason: "ambiguous",
    });

    const attested = await lookupReservation(ledger, "ambiguous-1");
    expect(attested).toMatchObject({ ok: true, found: true, state: "reserved" });
    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expect(snapshot.occupancy.daily).toBe(1);
  });

  it("reserve-ack-lost keeps one charged row and discloses the token only on a later attested read", async () => {
    const { ledger } = await setup({ dailyCeiling: 1, researchCeiling: 1, rateCeiling: 1 });
    expect(await armLostAcknowledgement(ledger, "tryReserve")).toEqual({ ok: true });

    const lost = await tryReserve(ledger, reserveInput("ack-1"));
    expect(lost).toEqual({ ok: false, reason: "ambiguous" });
    expect(Object.keys(lost).sort()).toEqual(["ok", "reason"]);

    const hidden = await mustSnapshot(ledger);
    expect(hidden.rowCount).toBe(1);
    expect(row(hidden, "ack-1").state).toBe("reserved");
    expect(hidden.occupancy.daily).toBe(1);
    expect(hidden.occupancy.research).toBe(1);

    const looked = await lookupReservation(ledger, "ack-1");
    expect(looked.ok).toBe(true);
    if (!looked.ok || !looked.found || looked.fencingToken == null) {
      throw new Error("expected the reserved fencing token");
    }
    expect(JSON.stringify(hidden)).not.toContain(looked.fencingToken);
    expect(JSON.stringify(hidden.audits)).not.toContain(looked.fencingToken);

    const retry = await tryReserve(ledger, reserveInput("ack-1"));
    expect(retry).toMatchObject({
      ok: true,
      idempotent: true,
      fencingToken: looked.fencingToken,
      state: "reserved",
    });
    expect((await mustSnapshot(ledger)).rowCount).toBe(1);

    expect(await beginSend(ledger, {
      reservationId: looked.reservationId,
      fencingToken: "not-the-token",
    })).toEqual({ ok: false, reason: "denied", denyReason: "stale_token" });
    expect(row(await mustSnapshot(ledger), "ack-1").state).toBe("reserved");

    const sent = await beginSend(ledger, {
      reservationId: looked.reservationId,
      fencingToken: looked.fencingToken,
    });
    expect(sent.ok).toBe(true);
    expect(row(await mustSnapshot(ledger), "ack-1").state).toBe("sending");
    expectTransportDeferred();
  });

  it("a lost beginSend acknowledgement stays sending and does not insert another row", async () => {
    const { ledger } = await setup();
    const reserved = await reserveNew(ledger, "begin-ack");
    expect(await armLostAcknowledgement(ledger, "beginSend")).toEqual({ ok: true });
    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "ambiguous" });

    const snapshot = await mustSnapshot(ledger);
    expect(row(snapshot, "begin-ack").state).toBe("sending");
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain("send-");

    const looked = await lookupReservation(ledger, "begin-ack");
    expect(looked).toMatchObject({
      ok: true,
      found: true,
      state: "sending",
      fencingToken: null,
      tokenDisclosed: false,
    });

    expect(await tryReserve(ledger, reserveInput("begin-ack"))).toMatchObject({
      ok: true,
      idempotent: true,
      state: "sending",
      fencingToken: null,
    });
    expect((await mustSnapshot(ledger)).rowCount).toBe(1);
    expect(await recordOutcome(ledger, {
      reservationId: reserved.reservationId,
      sendToken: "missing-token",
      outcome: "failed",
      failedReason: "outcome_unknown",
    })).toEqual({ ok: false, reason: "denied", denyReason: "invalid_transition" });
    expect(row(await mustSnapshot(ledger), "begin-ack").state).toBe("sending");
    expectTransportDeferred();
  });

  it("cross-consumer contention counts a fake product charge against the daily ceiling only", async () => {
    const { ledger } = await setup({ dailyCeiling: 1, researchCeiling: 5, rateCeiling: 5 });
    const externalPromise = insertExternalCharge(ledger, {
      operationId: "product-1",
      state: "consumed",
    });
    const reservePromise = tryReserve(ledger, reserveInput("pe5-1"));
    const [external, reserve] = await Promise.all([externalPromise, reservePromise]);

    expect(external).toMatchObject({ ok: true, inserted: true });
    expect(reserve).toEqual({ ok: false, reason: "denied", denyReason: "daily_ceiling" });
    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.rows[0]?.consumer).toBe("external");
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(0);

    const research = await setup({ dailyCeiling: 5, researchCeiling: 1, rateCeiling: 5 });
    expect(await insertExternalCharge(research.ledger, {
      operationId: "product-2",
      state: "failed",
    })).toMatchObject({ ok: true, inserted: true });
    expect((await reserveNew(research.ledger, "pe5-2")).state).toBe("reserved");
    expect(await tryReserve(research.ledger, reserveInput("pe5-3"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "research_ceiling",
    });
    const shared = await mustSnapshot(research.ledger);
    expect(shared.rows.filter((candidate) => candidate.consumer === "external")).toHaveLength(1);
    expect(
      shared.rows.filter(
        (candidate) => candidate.consumer === "pe5" && isCharged(candidate.state),
      ),
    ).toHaveLength(1);
  });

  it("duplicate opaque operation ids do not insert a second row", async () => {
    const { ledger } = await setup();
    const first = await reserveNew(ledger, "opaque-1");
    const second = await tryReserve(ledger, reserveInput("opaque-1"));
    expect(second).toMatchObject({
      ok: true,
      idempotent: true,
      reservationId: first.reservationId,
      fencingToken: first.fencingToken,
      state: "reserved",
    });
    expect((await mustSnapshot(ledger)).rowCount).toBe(1);
    expect(PE5_4C_LEDGER_DEFERRED.canonicalOperationId).toBe("increment-3");
  });

  it("vendor-day rebind is deferred and beginSend does not move the charge day", async () => {
    const start = Date.UTC(2026, 0, 15, 23, 0, 0);
    const { ledger, clock } = await setup(
      {
        leaseMs: 12 * 60 * 60 * 1000,
        fetchTimeoutMs: 1_000,
        dailyCeiling: 1,
        researchCeiling: 5,
        rateCeiling: 5,
      },
      start,
    );
    const held = await reserveNew(ledger, "rollover-hold");
    expect(held.chargeDay).toBe("2026-01-15");

    clock.advance(2 * 60 * 60 * 1000);
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
    expect(await beginSend(ledger, {
      reservationId: held.reservationId,
      fencingToken: held.fencingToken,
    })).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "vendor_day_rebind_deferred",
    });

    const before = await mustSnapshot(ledger);
    expect(row(before, "rollover-hold")).toMatchObject({
      state: "reserved",
      chargeDay: "2026-01-15",
    });
    expect(before.occupancy.chargeDay).toBe("2026-01-16");
    expect(before.occupancy.daily).toBe(0);
    expect(before.occupancy.research).toBe(1);
    expect(before.rowCount).toBe(1);

    const next = await reserveNew(ledger, "rollover-next");
    expect(next.chargeDay).toBe("2026-01-16");
    const after = await mustSnapshot(ledger);
    expect(after.rowCount).toBe(2);
    expect(after.occupancy.daily).toBe(1);
    expect(after.occupancy.research).toBe(2);
    expect(row(after, "rollover-hold").chargeDay).toBe("2026-01-15");
    expect(PE5_4C_LEDGER_DEFERRED.vendorDayRollover).toBe("increment-4");
  });

  it("abandon releases reserved capacity and does not release a sending row", async () => {
    const { ledger } = await setup({ dailyCeiling: 1, researchCeiling: 2, rateCeiling: 1 });
    const reserved = await reserveNew(ledger, "abandon-1");
    expect(await tryReserve(ledger, reserveInput("abandon-2"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "daily_ceiling",
    });

    expect(await abandonReservation(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: true, reservationId: reserved.reservationId, state: "abandoned" });
    const released = await mustSnapshot(ledger);
    expect(released.occupancy.daily).toBe(0);
    expect(released.occupancy.research).toBe(0);
    expect(released.occupancy.rate).toBe(0);

    const replacement = await reserveNew(ledger, "abandon-2");
    const sent = await beginSend(ledger, {
      reservationId: replacement.reservationId,
      fencingToken: replacement.fencingToken,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(await abandonReservation(ledger, {
      reservationId: replacement.reservationId,
      fencingToken: replacement.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "stale_token" });
    const snapshot = await mustSnapshot(ledger);
    expect(row(snapshot, "abandon-2").state).toBe("sending");
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
  });

  it("tryReserve denies protocol flags before an insert", async () => {
    const { ledger } = await setup();
    const flags = openFlags();
    expect(await tryReserve(ledger, {
      operationId: "flag-true",
      protocolFlags: { ...flags, pe53Authorized: true },
    })).toEqual({ ok: false, reason: "denied", denyReason: "protocol_flag_violation" });

    let reads = 0;
    const accessorFlags = openFlags();
    Object.defineProperty(accessorFlags, "pe53Authorized", {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return false;
      },
    });
    expect(await tryReserve(ledger, {
      operationId: "flag-getter",
      protocolFlags: accessorFlags,
    })).toEqual({ ok: false, reason: "denied", denyReason: "protocol_flag_violation" });
    expect(reads).toBe(0);
    expect((await mustSnapshot(ledger)).rowCount).toBe(0);
  });

  it("fails closed on a bad clock, a secret approval field, and pilot mode", async () => {
    const badClock = createMemoryLedger({
      approval: approval(),
      clock: {
        now() {
          return Number.NaN;
        },
      },
    });
    expect(await tryReserve(badClock, reserveInput("clock-bad"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "clock_unavailable",
    });

    const throwing = createMemoryLedger({
      approval: approval(),
      clock: {
        now() {
          throw new Error("secret-clock-failure");
        },
      },
    });
    const thrown = await tryReserve(throwing, reserveInput("clock-throw"));
    expect(thrown).toEqual({ ok: false, reason: "denied", denyReason: "clock_unavailable" });
    expect(JSON.stringify(thrown)).not.toContain("secret-clock-failure");

    const poisoned = approval() as AcquisitionApproval & { api_key: string };
    poisoned.api_key = "not-a-real-secret";
    const secretLedger = createMemoryLedger({ approval: poisoned, clock: makeClock() });
    expect(await tryReserve(secretLedger, reserveInput("secret-approval"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "approval_invalid",
    });
    expect(JSON.stringify(secretLedger)).not.toContain("not-a-real-secret");
    const symbol = Object.getOwnPropertySymbols(secretLedger)[0];
    const state = (secretLedger as unknown as Record<symbol, unknown>)[symbol];
    expect(JSON.stringify(state)).not.toContain("not-a-real-secret");

    const pilot = createMemoryLedger({
      approval: approval({ mode: "pilot" }),
      clock: makeClock(),
    });
    expect(await tryReserve(pilot, reserveInput("pilot-mode"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "mode_denied",
    });
  });

  it("known limitation: a second ledger object does not share occupancy", async () => {
    const { ledger, clock, approval: record } = await setup({ researchCeiling: 1 });
    await reserveNew(ledger, "instance-1");
    const other = createMemoryLedger({ approval: record, clock });
    expect(await replaceKillSwitch(other, clearKill(clock.now()))).toEqual({ ok: true });
    expect(isNewReserve(await tryReserve(other, reserveInput("instance-2")))).toBe(true);

    const original = await mustSnapshot(ledger);
    const separate = await mustSnapshot(other);
    expect(original.rowCount).toBe(1);
    expect(separate.rowCount).toBe(1);
    expect(original.rows[0]?.operationId).toBe("instance-1");
    expect(separate.rows[0]?.operationId).toBe("instance-2");
    expect(PE5_4C_MEMORY_LEDGER_LIMIT).toEqual({
      durability: "in-process-only",
      atomicity: "single-process-serialized-queue",
      productionQuota: false,
    });
  });

  it("module-reeval does not give a second module evaluation a new ceiling", async () => {
    const { ledger } = await setup({ researchCeiling: 1, dailyCeiling: 5, rateCeiling: 5 });
    await reserveNew(ledger, "module-filled");

    vi.resetModules();
    const second = await import("@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger");
    expect(await second.tryReserve(ledger, reserveInput("module-second"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "research_ceiling",
    });
    const snapshot = await second.readSnapshot(ledger);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.snapshot.rowCount).toBe(1);
    expect(snapshot.snapshot.occupancy.research).toBe(1);
    expect(snapshot.snapshot.generation).toBe(0);
    expect(snapshot.snapshot.allowRegeneration).toBe(false);
    expect(second.PE5_4C_LEDGER_DEFERRED.canonicalOperationId).toBe("increment-3");
  });

  it("keeps simulator limits visible and does not import transport or product clients", async () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/debug/calibration/pe5-acquisition-boundary/memory-ledger.ts"),
      "utf8",
    );
    const preamble = source.slice(0, source.indexOf("export function createMemoryLedger"));
    expect(preamble.includes("new Map")).toBe(false);
    expect(source.includes("globalThis")).toBe(false);
    expect(source.includes("process.env")).toBe(false);
    expect(source.includes("fetch(")).toBe(false);
    expect(source.includes("createApiFootballClient")).toBe(false);
    expect(source.includes("withApiFootballClientCache")).toBe(false);
    expect(source.includes("API_FOOTBALL")).toBe(false);
    expect(source.includes("setTimeout")).toBe(false);
    expect(source.includes("setInterval")).toBe(false);
    expect(source.includes("Date.now")).toBe(false);
    expect(source.includes("Math.random")).toBe(false);
    expect(source.includes("createHash")).toBe(false);
    expect(source.includes("node:crypto")).toBe(false);
    expect(source.includes("node:fs")).toBe(false);
    expect(source.includes("SHA-256")).toBe(false);
    expect(source.includes("sha256")).toBe(false);

    const begin = source.slice(
      source.indexOf("async function commitBeginSend"),
      source.indexOf("async function commitOutcome"),
    );
    expect(begin.includes("readRealProtocolFlags")).toBe(false);
    expect(begin.includes("protocolFlags")).toBe(false);

    const nowSpy = vi.spyOn(Date, "now");
    try {
      const { ledger } = await setup();
      const reserved = await reserveNew(ledger, "limits-1");
      const snapshot = await mustSnapshot(ledger);
      expect(snapshot.generation).toBe(0);
      expect(snapshot.allowRegeneration).toBe(false);
      expect(JSON.stringify(ledger)).not.toContain(reserved.fencingToken);
      expect(JSON.stringify(snapshot)).not.toContain(reserved.fencingToken);
      expect(Object.keys(ledger).sort()).toEqual([
        "allowRegeneration",
        "approvalId",
        "generation",
        "instanceId",
        "kind",
      ]);
      expect(nowSpy).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }

    expect(PE5_4C_MEMORY_LEDGER_LIMIT.productionQuota).toBe(false);
    expect(PE5_4C_LEDGER_DEFERRED).toEqual({
      fetchCount: "no-transport-in-increment-2",
      vendorDayRollover: "increment-4",
      canonicalOperationId: "increment-3",
    });
  });

  it("lease-expiry-boundary refuses beginSend when the clock equals leaseDeadline", async () => {
    const { ledger, clock } = await setup();
    const reserved = await reserveNew(ledger, "lease-exact");
    const deadline = reserved.leaseDeadline;
    clock.advance(deadline - clock.now());
    expect(clock.now()).toBe(deadline);

    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "lease_expired" });

    const held = await mustSnapshot(ledger);
    expect(row(held, "lease-exact").state).toBe("reserved");
    expect(held.occupancy.daily).toBe(1);
    expect(held.occupancy.research).toBe(1);
    expect(held.rowCount).toBe(1);

    expect(await sweepExpired(ledger)).toEqual({ ok: true, released: 1 });
    const released = await mustSnapshot(ledger);
    expect(row(released, "lease-exact").state).toBe("expired");
    expect(released.occupancy.daily).toBe(0);
    expect(released.occupancy.research).toBe(0);

    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "stale_token" });
  });

  it("kill-freshness-boundary allows beginSend at age equal to maxAgeMs", async () => {
    const { ledger, clock } = await setup();
    const reserved = await reserveNew(ledger, "kill-exact");
    const updatedAt = clock.now() - MAX_AGE_MS;
    expect(await replaceKillSwitch(ledger, clearKill(updatedAt))).toEqual({ ok: true });
    expect(await readKillSwitch(ledger)).toEqual({
      ok: true,
      state: "clear",
      version: 1,
      updatedAt,
      maxAgeMs: MAX_AGE_MS,
    });

    const sent = await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    });
    expect(sent.ok).toBe(true);
    expect(row(await mustSnapshot(ledger), "kill-exact").state).toBe("sending");

    clock.advance(1);
    expect(await readKillSwitch(ledger)).toEqual({
      ok: false,
      reason: "kill_switch_stale",
    });
    expect(await tryReserve(ledger, reserveInput("kill-exact-next"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "kill_switch_stale",
    });
    const snapshot = await mustSnapshot(ledger);
    expect(row(snapshot, "kill-exact").state).toBe("sending");
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expect(snapshot.rowCount).toBe(1);
  });

  it("abandon-versus-beginSend commits exactly one transition and aligns occupancy", async () => {
    async function contend(first: "abandon" | "send", operationId: string) {
      const { ledger } = await setup({ dailyCeiling: 1, researchCeiling: 1, rateCeiling: 1 });
      const reserved = await reserveNew(ledger, operationId);
      const abandon = () =>
        abandonReservation(ledger, {
          reservationId: reserved.reservationId,
          fencingToken: reserved.fencingToken,
        });
      const send = () =>
        beginSend(ledger, {
          reservationId: reserved.reservationId,
          fencingToken: reserved.fencingToken,
        });
      const [abandoned, sent] =
        first === "abandon"
          ? await Promise.all([abandon(), send()])
          : await Promise.all([send(), abandon()]).then(([sentFirst, abandonedSecond]) => [
              abandonedSecond,
              sentFirst,
            ] as const);
      const snapshot = await mustSnapshot(ledger);
      return { reserved, abandoned, sent, snapshot };
    }

    const abandonFirst = await contend("abandon", "contend-abandon");
    expect(abandonFirst.abandoned).toEqual({
      ok: true,
      reservationId: abandonFirst.reserved.reservationId,
      state: "abandoned",
    });
    expect(abandonFirst.sent).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "stale_token",
    });
    expect(abandonFirst.snapshot.rowCount).toBe(1);
    expect(row(abandonFirst.snapshot, "contend-abandon").state).toBe("abandoned");
    expect(abandonFirst.snapshot.occupancy.daily).toBe(0);
    expect(abandonFirst.snapshot.occupancy.research).toBe(0);
    expect(abandonFirst.snapshot.occupancy.rate).toBe(0);

    const sendFirst = await contend("send", "contend-send");
    expect(sendFirst.sent.ok).toBe(true);
    expect(sendFirst.abandoned).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "stale_token",
    });
    expect(sendFirst.snapshot.rowCount).toBe(1);
    expect(row(sendFirst.snapshot, "contend-send").state).toBe("sending");
    expect(sendFirst.snapshot.occupancy.daily).toBe(1);
    expect(sendFirst.snapshot.occupancy.research).toBe(1);
    expect(sendFirst.snapshot.rows.some((candidate) => candidate.state === "abandoned")).toBe(false);
  });

  it("approval-expiry-boundary denies a reserve when the clock equals expiry", async () => {
    const start = NOW;
    const clock = makeClock(start);
    const record = approval({ expiry: start + 1 });
    const ledger = createMemoryLedger({ approval: record, clock });
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });

    await reserveNew(ledger, "expiry-hold");
    clock.advance(1);
    expect(clock.now()).toBe(record.expiry);
    expect(await tryReserve(ledger, reserveInput("expiry-at"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "approval_expired",
    });

    const held = await mustSnapshot(ledger);
    expect(held.rowCount).toBe(1);
    expect(row(held, "expiry-hold").state).toBe("reserved");
    expect(held.occupancy.daily).toBe(1);
    expect(held.occupancy.research).toBe(1);

    const atExpiryClock = makeClock(start);
    const atExpiry = createMemoryLedger({
      approval: approval({ expiry: start }),
      clock: atExpiryClock,
    });
    expect(await replaceKillSwitch(atExpiry, clearKill(atExpiryClock.now()))).toEqual({
      ok: true,
    });
    expect(atExpiryClock.now()).toBe(start);
    expect(await tryReserve(atExpiry, reserveInput("expiry-empty"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "approval_expired",
    });
    expect((await mustSnapshot(atExpiry)).rowCount).toBe(0);
  });
});
