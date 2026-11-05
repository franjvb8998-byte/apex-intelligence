/**
 * PE-5.4C increment 4 — offline in-memory ledger tests.
 * No provider calls, no environment reads, no sealed 2025 outcome reads.
 *
 * Fetch counts stay deferred. Canonical ids are enforced inside one ledger
 * object. That check is not durable and it is not cross-process.
 * Vendor-day values below are offline simulator configuration, not a
 * verified provider quota reset.
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
  isRegisteredMemoryLedger,
  lookupReservation,
  matchSendCommit,
  readKillSwitch,
  readLedgerNow,
  readSnapshot,
  recordOutcome,
  replaceKillSwitch,
  replaceVendorDayBoundaryForTests,
  setLedgerUnavailable,
  sweepExpired,
  tryReserve,
  type LedgerRowView,
  type LedgerSnapshot,
  type MemoryLedger,
  type TryReserveInput,
  type TryReserveResult,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger";
import { deriveOperationId } from "@/lib/debug/calibration/pe5-acquisition-boundary/operation-id";
import type {
  AcquisitionApproval,
  ProtocolFlagSnapshot,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/types";

const DEFAULT_OPERATION_IDENTITY = {
  ledgerInstanceId: "ledger-a",
  credentialId: "cred-research",
  approvalId: "approval:ledger-a",
  generation: 0,
} as const;

const LABEL_FIXTURE = new Map<string, string>();
let nextFixture = 1;

function fixtureKey(
  label: string,
  ledgerInstanceId: string = DEFAULT_OPERATION_IDENTITY.ledgerInstanceId,
): string {
  return `${ledgerInstanceId}\n${label}`;
}

function fixtureForLabel(label: string, ledgerInstanceId: string): string {
  const key = fixtureKey(label, ledgerInstanceId);
  let fixture = LABEL_FIXTURE.get(key);
  if (fixture == null) {
    fixture = String(nextFixture);
    nextFixture += 1;
    LABEL_FIXTURE.set(key, fixture);
  }
  return fixture;
}

function canonicalFor(
  label: string,
  identity: {
    ledgerInstanceId: string;
    credentialId: string;
    approvalId: string;
    generation: number;
  } = DEFAULT_OPERATION_IDENTITY,
) {
  const fixtureId = fixtureForLabel(label, identity.ledgerInstanceId);
  const derived = deriveOperationId(identity, { endpoint: "lineups", fixtureId });
  if (!derived.ok) throw new Error(`canonical id for ${label}`);
  return { operationId: derived.operationId, endpoint: "lineups" as const, fixtureId };
}

function storedId(label: string): string {
  if (!LABEL_FIXTURE.has(fixtureKey(label))) return label;
  return canonicalFor(label).operationId;
}

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const MAX_AGE_MS = 60_000;

/** Offline test boundary. Not a verified provider quota reset. */
const OFFLINE_UTC_MIDNIGHT = {
  version: 1,
  utcOffsetMs: 0,
  resetOffsetMs: 0,
} as const;

/** Offline test boundary that rolls at 03:00 UTC. Not a verified provider quota reset. */
const OFFLINE_RESET_03_UTC = {
  version: 1,
  utcOffsetMs: 0,
  resetOffsetMs: 10_800_000,
} as const;

/** Same shift as OFFLINE_RESET_03_UTC: 05:00 at a fixed UTC+2. Offline test value only. */
const OFFLINE_RESET_05_UTC_PLUS_2 = {
  version: 1,
  utcOffsetMs: 7_200_000,
  resetOffsetMs: 18_000_000,
} as const;

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
    vendorDayBoundary: OFFLINE_UTC_MIDNIGHT,
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

function reserveInput(
  label: string,
  identity: {
    ledgerInstanceId: string;
    credentialId: string;
    approvalId: string;
    generation: number;
  } = DEFAULT_OPERATION_IDENTITY,
) {
  const canonical = canonicalFor(label, identity);
  return {
    operationId: canonical.operationId,
    protocolFlags: openFlags(),
    endpoint: canonical.endpoint,
    fixtureId: canonical.fixtureId,
  };
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

function row(snapshot: LedgerSnapshot, label: string): LedgerRowView {
  const operationId = storedId(label);
  const found = snapshot.rows.find((candidate) => candidate.operationId === operationId);
  if (found == null) throw new Error(`missing row ${label}`);
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

    const attested = await lookupReservation(ledger, storedId("ambiguous-1"));
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

    const looked = await lookupReservation(ledger, storedId("ack-1"));
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

    const looked = await lookupReservation(ledger, storedId("begin-ack"));
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
    expect(PE5_4C_LEDGER_DEFERRED.canonicalOperationId).toBe("in-process-derived-not-durable");
  });

  it("same-day beginSend does not require a second daily slot", async () => {
    const { ledger } = await setup({ dailyCeiling: 1, researchCeiling: 1, rateCeiling: 1 });
    const reserved = await reserveNew(ledger, "same-day");
    expect(reserved.chargeDay).toBe("2026-01-15");
    const before = await mustSnapshot(ledger);
    expect(before.occupancy.daily).toBe(1);
    expect(before.occupancy.research).toBe(1);
    expect(before.occupancy.rate).toBe(1);

    const sent = await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    });
    expect(sent).toMatchObject({ ok: true, chargeDay: "2026-01-15" });
    const after = await mustSnapshot(ledger);
    expect(row(after, "same-day")).toMatchObject({ state: "sending", chargeDay: "2026-01-15" });
    expect(after.occupancy.daily).toBe(1);
    expect(after.occupancy.research).toBe(1);
    expect(after.occupancy.rate).toBe(1);
    expect(after.rowCount).toBe(1);
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
    expect(Object.getOwnPropertySymbols(secretLedger)).toEqual([]);
    const legacyState = Symbol.for("apex.pe5.acquisition-boundary.memory-ledger.state.v1");
    expect(Object.getOwnPropertyDescriptor(secretLedger, legacyState)).toBeUndefined();

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
    expect(original.rows[0]?.operationId).toBe(storedId("instance-1"));
    expect(separate.rows[0]?.operationId).toBe(storedId("instance-2"));
    expect(PE5_4C_MEMORY_LEDGER_LIMIT).toEqual({
      durability: "in-process-only",
      atomicity: "single-process-serialized-queue",
      productionQuota: false,
      credentialBoundary: "single-ledger-instance-only",
    });
  });

  it("module-reeval cannot reserve on a ledger created by another evaluation", async () => {
    const { ledger } = await setup({ researchCeiling: 1, dailyCeiling: 5, rateCeiling: 5 });
    await reserveNew(ledger, "module-filled");

    vi.resetModules();
    const second = await import("@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger");
    expect(second.isRegisteredMemoryLedger(ledger)).toBe(false);
    expect(await second.tryReserve(ledger, reserveInput("module-second"))).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await second.readSnapshot(ledger)).toEqual({ ok: false, reason: "unavailable" });
    const snapshot = await readSnapshot(ledger);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.snapshot.rowCount).toBe(1);
    expect(snapshot.snapshot.occupancy.research).toBe(1);
    expect(snapshot.snapshot.generation).toBe(0);
    expect(snapshot.snapshot.allowRegeneration).toBe(false);
    expect(second.PE5_4C_LEDGER_DEFERRED.canonicalOperationId).toBe(
      "in-process-derived-not-durable",
    );
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
      canonicalOperationId: "in-process-derived-not-durable",
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

  it("rolls one charge onto a destination day that has room and does not add a second budget", async () => {
    const start = Date.UTC(2026, 0, 15, 23, 0, 0);
    const { ledger, clock } = await setup(
      {
        leaseMs: 12 * 60 * 60 * 1000,
        fetchTimeoutMs: 1_000,
        dailyCeiling: 2,
        researchCeiling: 2,
        rateCeiling: 2,
      },
      start,
    );
    const held = await reserveNew(ledger, "rollover-room");
    expect(held.chargeDay).toBe("2026-01-15");
    clock.advance(2 * 60 * 60 * 1000);
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });

    const before = await mustSnapshot(ledger);
    expect(before.occupancy.chargeDay).toBe("2026-01-16");
    expect(before.occupancy.daily).toBe(0);
    expect(before.occupancy.research).toBe(1);
    expect(before.occupancy.rate).toBe(1);
    expect(row(before, "rollover-room").chargeDay).toBe("2026-01-15");

    const sent = await beginSend(ledger, {
      reservationId: held.reservationId,
      fencingToken: held.fencingToken,
    });
    expect(sent).toMatchObject({ ok: true, chargeDay: "2026-01-16" });
    const after = await mustSnapshot(ledger);
    expect(row(after, "rollover-room")).toMatchObject({
      state: "sending",
      chargeDay: "2026-01-16",
    });
    expect(after.rowCount).toBe(1);
    expect(after.occupancy.daily).toBe(1);
    expect(after.occupancy.research).toBe(1);
    expect(after.occupancy.rate).toBe(1);
    expect(after.occupancy.chargeDay).toBe("2026-01-16");

    expect(await recordOutcome(ledger, {
      reservationId: held.reservationId,
      sendToken: sent.ok ? sent.sendToken : "",
      outcome: "failed",
      failedReason: "outcome_unknown",
    })).toMatchObject({ ok: true, state: "failed", chargeDay: "2026-01-16" });
    expect(await sweepExpired(ledger)).toEqual({ ok: true, released: 0 });
    const kept = await mustSnapshot(ledger);
    expect(row(kept, "rollover-room")).toMatchObject({
      state: "failed",
      chargeDay: "2026-01-16",
    });
    expect(kept.occupancy.daily).toBe(1);
    expect(kept.occupancy.research).toBe(1);
    expect(kept.rowCount).toBe(1);
  });

  it("denies rollover when the destination day is already at the daily ceiling", async () => {
    const start = Date.UTC(2026, 0, 15, 23, 0, 0);
    const { ledger, clock } = await setup(
      {
        leaseMs: 12 * 60 * 60 * 1000,
        fetchTimeoutMs: 1_000,
        dailyCeiling: 1,
        researchCeiling: 2,
        rateCeiling: 5,
      },
      start,
    );
    const held = await reserveNew(ledger, "rollover-full");
    clock.advance(2 * 60 * 60 * 1000);
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
    expect(await insertExternalCharge(ledger, {
      operationId: "destination-full",
      state: "consumed",
    })).toMatchObject({ ok: true, inserted: true });

    expect(await beginSend(ledger, {
      reservationId: held.reservationId,
      fencingToken: held.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "vendor_day_ceiling" });

    const snapshot = await mustSnapshot(ledger);
    expect(row(snapshot, "rollover-full")).toMatchObject({
      state: "reserved",
      chargeDay: "2026-01-15",
    });
    expect(row(snapshot, "destination-full").chargeDay).toBe("2026-01-16");
    expect(snapshot.rowCount).toBe(2);
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expect(snapshot.rows.filter((candidate) => candidate.chargeDay === "2026-01-15")).toHaveLength(1);
    expect(snapshot.rows.filter((candidate) => candidate.chargeDay === "2026-01-16")).toHaveLength(1);
  });

  it("lets one of two beginSend calls take the last destination slot", async () => {
    const start = Date.UTC(2026, 0, 15, 23, 0, 0);
    const { ledger, clock } = await setup(
      {
        leaseMs: 12 * 60 * 60 * 1000,
        fetchTimeoutMs: 1_000,
        dailyCeiling: 2,
        researchCeiling: 2,
        rateCeiling: 5,
      },
      start,
    );
    const first = await reserveNew(ledger, "race-day-a");
    const second = await reserveNew(ledger, "race-day-b");
    clock.advance(2 * 60 * 60 * 1000);
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
    expect(await insertExternalCharge(ledger, {
      operationId: "race-day-external",
      state: "consumed",
    })).toMatchObject({ ok: true, inserted: true });

    const sends = await Promise.all([
      beginSend(ledger, {
        reservationId: first.reservationId,
        fencingToken: first.fencingToken,
      }),
      beginSend(ledger, {
        reservationId: second.reservationId,
        fencingToken: second.fencingToken,
      }),
    ]);
    expect(sends.filter((result) => result.ok)).toHaveLength(1);
    expect(sends.filter((result) => !result.ok && result.reason === "denied" && result.denyReason === "vendor_day_ceiling")).toHaveLength(1);

    const snapshot = await mustSnapshot(ledger);
    const moved = snapshot.rows.filter(
      (candidate) => candidate.consumer === "pe5" && candidate.state === "sending" && candidate.chargeDay === "2026-01-16",
    );
    const held = snapshot.rows.filter(
      (candidate) => candidate.consumer === "pe5" && candidate.state === "reserved" && candidate.chargeDay === "2026-01-15",
    );
    expect(moved).toHaveLength(1);
    expect(held).toHaveLength(1);
    expect(snapshot.rowCount).toBe(3);
    expect(snapshot.occupancy.research).toBe(2);
    expect(snapshot.occupancy.daily).toBe(2);
    expect(snapshot.occupancy.chargeDay).toBe("2026-01-16");
  });

  it("changes the accounting day at the reset instant and not one millisecond earlier", async () => {
    const exact = Date.UTC(2026, 0, 15, 3, 0, 0);
    const before = await setup(
      {
        vendorDayBoundary: OFFLINE_RESET_03_UTC,
        leaseMs: 60_000,
        fetchTimeoutMs: 1_000,
        dailyCeiling: 4,
        researchCeiling: 4,
        rateCeiling: 4,
      },
      exact - 1,
    );
    const early = await reserveNew(before.ledger, "reset-before");
    expect(early.chargeDay).toBe("2026-01-14");
    before.clock.advance(1);
    expect(await replaceKillSwitch(before.ledger, clearKill(before.clock.now()))).toEqual({ ok: true });
    const sent = await beginSend(before.ledger, {
      reservationId: early.reservationId,
      fencingToken: early.fencingToken,
    });
    expect(sent).toMatchObject({ ok: true, chargeDay: "2026-01-15" });
    expect(row(await mustSnapshot(before.ledger), "reset-before")).toMatchObject({
      state: "sending",
      chargeDay: "2026-01-15",
    });

    const atReset = await setup(
      { vendorDayBoundary: OFFLINE_RESET_03_UTC, dailyCeiling: 2, researchCeiling: 2, rateCeiling: 2 },
      exact,
    );
    expect((await reserveNew(atReset.ledger, "reset-at")).chargeDay).toBe("2026-01-15");

    const plusTwo = await setup(
      { vendorDayBoundary: OFFLINE_RESET_05_UTC_PLUS_2, dailyCeiling: 2, researchCeiling: 2, rateCeiling: 2 },
      exact - 1,
    );
    expect((await reserveNew(plusTwo.ledger, "reset-civil")).chargeDay).toBe("2026-01-14");
    plusTwo.clock.advance(1);
    expect(await replaceKillSwitch(plusTwo.ledger, clearKill(plusTwo.clock.now()))).toEqual({ ok: true });
    expect((await reserveNew(plusTwo.ledger, "reset-civil-next")).chargeDay).toBe("2026-01-15");
  });

  it("denies reservation on a ledger bound without a vendor day", async () => {
    const clock = makeClock();
    const ledger = createMemoryLedger({
      approval: approval({ vendorDayBoundary: null }),
      clock,
    });
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
    expect(await tryReserve(ledger, reserveInput("unbound-day"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "vendor_day_unknown",
    });
    expect(await lookupReservation(ledger, "unbound-day")).toEqual({ ok: true, found: false });
    expect(await insertExternalCharge(ledger, {
      operationId: "unbound-external",
      state: "reserved",
    })).toEqual({ ok: false, reason: "denied", denyReason: "vendor_day_unknown" });
  });

  it("denies a new reservation when the vendor day is absent and keeps an existing operation", async () => {
    const { ledger } = await setup();
    const existing = await reserveNew(ledger, "known-op");
    expect(await replaceVendorDayBoundaryForTests(ledger, null)).toEqual({ ok: true });

    expect(await tryReserve(ledger, reserveInput("known-op"))).toMatchObject({
      ok: true,
      idempotent: true,
      reservationId: existing.reservationId,
      chargeDay: "2026-01-15",
      state: "reserved",
    });
    expect(await tryReserve(ledger, reserveInput("missing-day"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "vendor_day_unknown",
    });
    expect(await lookupReservation(ledger, "missing-day")).toEqual({ ok: true, found: false });
    expect(await insertExternalCharge(ledger, {
      operationId: "external-missing-day",
      state: "consumed",
    })).toEqual({ ok: false, reason: "denied", denyReason: "vendor_day_unknown" });

    expect(await replaceVendorDayBoundaryForTests(ledger, OFFLINE_UTC_MIDNIGHT)).toEqual({ ok: true });
    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(1);
    expect(row(snapshot, "known-op")).toMatchObject({ state: "reserved", chargeDay: "2026-01-15" });
    expect(snapshot.audits.some((entry) => entry.action === "denied" && entry.reason === "vendor_day_unknown")).toBe(true);
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
  });

  it("denies beginSend after the test control removes the boundary and leaves the row reserved", async () => {
    const { ledger } = await setup();
    const reserved = await reserveNew(ledger, "send-without-day");
    expect(await replaceVendorDayBoundaryForTests(ledger, null)).toEqual({ ok: true });
    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "vendor_day_unknown" });
    expect(await lookupReservation(ledger, storedId("send-without-day"))).toMatchObject({
      ok: true,
      found: true,
      state: "reserved",
      chargeDay: "2026-01-15",
    });

    expect(await replaceVendorDayBoundaryForTests(ledger, {
      version: 1,
      utcOffsetMs: 0,
      resetOffsetMs: 10_800_000,
    })).toEqual({ ok: false, reason: "approval_inconsistent" });
    expect(await replaceVendorDayBoundaryForTests(ledger, {
      version: 1,
      utcOffsetMs: 0,
      resetOffsetMs: 0,
      extra: true,
    })).toEqual({ ok: false, reason: "approval_invalid" });
    expect(await replaceVendorDayBoundaryForTests(ledger, OFFLINE_UTC_MIDNIGHT)).toEqual({ ok: true });
    const snapshot = await mustSnapshot(ledger);
    expect(row(snapshot, "send-without-day")).toMatchObject({
      state: "reserved",
      chargeDay: "2026-01-15",
    });
    expect(snapshot.rowCount).toBe(1);
  });

  it("fails closed when the day arithmetic cannot produce a label", async () => {
    const epoch = await setup({ vendorDayBoundary: OFFLINE_RESET_03_UTC }, 0);
    expect(await tryReserve(epoch.ledger, reserveInput("epoch-zero"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "vendor_day_unknown",
    });
    expect(await lookupReservation(epoch.ledger, "epoch-zero")).toEqual({ ok: true, found: false });

    let live = true;
    let value = NOW;
    const clock = {
      now() {
        if (!live) throw new Error("secret-clock-failure");
        return value;
      },
      advance(ms: number) {
        value += ms;
      },
    };
    const ledger = createMemoryLedger({ approval: approval(), clock });
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
    const reserved = await reserveNew(ledger, "clock-then-throw");
    live = false;
    const denied = await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    });
    expect(denied).toEqual({ ok: false, reason: "denied", denyReason: "vendor_day_unknown" });
    expect(JSON.stringify(denied)).not.toContain("secret-clock-failure");
    live = true;
    expect(await lookupReservation(ledger, storedId("clock-then-throw"))).toMatchObject({
      ok: true,
      found: true,
      state: "reserved",
      chargeDay: "2026-01-15",
    });
  });

  it("charges an external row on the same vendor day as a reservation", async () => {
    const start = Date.UTC(2026, 0, 15, 2, 30, 0);
    const { ledger, clock } = await setup(
      { vendorDayBoundary: OFFLINE_RESET_03_UTC, dailyCeiling: 2, researchCeiling: 2, rateCeiling: 4 },
      start,
    );
    const reserved = await reserveNew(ledger, "external-same-day");
    expect(await insertExternalCharge(ledger, {
      operationId: "external-same",
      state: "consumed",
    })).toMatchObject({ ok: true, inserted: true });
    const before = await mustSnapshot(ledger);
    expect(row(before, "external-same-day").chargeDay).toBe("2026-01-14");
    expect(row(before, "external-same").chargeDay).toBe("2026-01-14");
    expect(before.occupancy.daily).toBe(2);

    clock.advance(30 * 60 * 1000);
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
    expect((await reserveNew(ledger, "external-next-day")).chargeDay).toBe("2026-01-15");
    expect(reserved.chargeDay).toBe("2026-01-14");
  });

  it("keeps a lost rollover acknowledgement on the destination day without a second row", async () => {
    const start = Date.UTC(2026, 0, 15, 23, 0, 0);
    const { ledger, clock } = await setup(
      {
        leaseMs: 12 * 60 * 60 * 1000,
        fetchTimeoutMs: 1_000,
        dailyCeiling: 2,
        researchCeiling: 2,
        rateCeiling: 2,
      },
      start,
    );
    const reserved = await reserveNew(ledger, "rollover-ack");
    clock.advance(2 * 60 * 60 * 1000);
    expect(await replaceKillSwitch(ledger, clearKill(clock.now()))).toEqual({ ok: true });
    expect(await armLostAcknowledgement(ledger, "beginSend")).toEqual({ ok: true });
    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "ambiguous" });

    const snapshot = await mustSnapshot(ledger);
    expect(row(snapshot, "rollover-ack")).toMatchObject({
      state: "sending",
      chargeDay: "2026-01-16",
    });
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expect(snapshot.occupancy.daily).toBe(1);
    expect(await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "stale_token" });
    expect((await mustSnapshot(ledger)).rowCount).toBe(1);
  });

  it("does not share a credential's vendor day across two ledger objects", async () => {
    const { ledger, clock, approval: record } = await setup({ dailyCeiling: 1, researchCeiling: 2, rateCeiling: 2 });
    await reserveNew(ledger, "cred-a");
    const other = createMemoryLedger({
      approval: approval({
        ...record,
        ledgerInstanceId: "ledger-b",
        vendorDayBoundary: OFFLINE_RESET_03_UTC,
      }),
      clock,
    });
    expect(await replaceKillSwitch(other, clearKill(clock.now()))).toEqual({ ok: true });
    expect(isNewReserve(await tryReserve(other, reserveInput("cred-b", {
      ledgerInstanceId: "ledger-b",
      credentialId: "cred-research",
      approvalId: "approval:ledger-b",
      generation: 0,
    })))).toBe(true);
    expect((await mustSnapshot(ledger)).rowCount).toBe(1);
    expect((await mustSnapshot(other)).rowCount).toBe(1);
    expect(PE5_4C_MEMORY_LEDGER_LIMIT.credentialBoundary).toBe("single-ledger-instance-only");
  });

  it("matchSendCommit returns bound metadata and does not disclose the send token or change occupancy", async () => {
    const { ledger } = await setup();
    const input = reserveInput("bound-op");
    const reserved = await tryReserve(ledger, input);
    expect(reserved.ok).toBe(true);
    if (!reserved.ok || reserved.idempotent) throw new Error("expected a bound reserve");
    const sent = await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) throw new Error("expected beginSend");

    const before = await mustSnapshot(ledger);
    const matched = await matchSendCommit(ledger, {
      reservationId: reserved.reservationId,
      sendToken: sent.sendToken,
    });
    const after = await mustSnapshot(ledger);

    expect(matched).toEqual({
      ok: true,
      operationId: input.operationId,
      approvalId: before.approvalId,
      credentialId: "cred-research",
      endpoint: "lineups",
      fixtureId: input.fixtureId,
      sendingCommittedAt: sent.sendingCommittedAt,
    });
    expect(Object.hasOwn(matched, "sendToken")).toBe(false);
    expect(JSON.stringify(matched)).not.toContain(sent.sendToken);
    expect(after.rows).toEqual(before.rows);
    expect(after.audits).toEqual(before.audits);
    expect(after.occupancy).toEqual(before.occupancy);
    expect(row(after, "bound-op").state).toBe("sending");
  });

  it("matchSendCommit fails closed for missing, wrong, stale, and non-sending proofs", async () => {
    const { ledger } = await setup();
    const reserved = await reserveNew(ledger, "proof-row");
    const beforeSend = await mustSnapshot(ledger);
    expect(await matchSendCommit(ledger, {
      reservationId: reserved.reservationId,
      sendToken: "send-not-issued",
    })).toEqual({ ok: false, reason: "denied", denyReason: "invalid_transition" });
    expect(await mustSnapshot(ledger)).toMatchObject({
      rowCount: beforeSend.rowCount,
      occupancy: beforeSend.occupancy,
    });

    const sent = await beginSend(ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) throw new Error("expected beginSend");

    expect(await matchSendCommit(ledger, {
      reservationId: "res-missing",
      sendToken: sent.sendToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "reservation_missing" });
    expect(await matchSendCommit(ledger, {
      reservationId: reserved.reservationId,
      sendToken: "send-wrong",
    })).toEqual({ ok: false, reason: "denied", denyReason: "invalid_transition" });
    expect(await matchSendCommit(ledger, {
      reservationId: reserved.reservationId,
      sendToken: reserved.fencingToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "invalid_transition" });

    const consumed = await finish(ledger, "proof-consumed", "consumed");
    expect(await matchSendCommit(ledger, {
      reservationId: consumed.reserved.reservationId,
      sendToken: consumed.sent.sendToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "invalid_transition" });
    const failed = await finish(ledger, "proof-failed", "failed");
    expect(await matchSendCommit(ledger, {
      reservationId: failed.reserved.reservationId,
      sendToken: failed.sent.sendToken,
    })).toEqual({ ok: false, reason: "denied", denyReason: "invalid_transition" });

    const held = await mustSnapshot(ledger);
    expect(row(held, "proof-row").state).toBe("sending");
    expect(row(held, "proof-consumed").state).toBe("consumed");
    expect(row(held, "proof-failed").state).toBe("failed");
    expect(held.occupancy.research).toBe(3);
    expect(held.occupancy.daily).toBe(3);
  });

  it("rejects an unbound or invalid evidence identity without inserting a row", async () => {
    const { ledger } = await setup();
    const unbound = canonicalFor("unbound-op");
    expect(await tryReserve(ledger, {
      operationId: unbound.operationId,
      protocolFlags: openFlags(),
    })).toEqual({ ok: false, reason: "denied", denyReason: "operation_rejected" });

    expect(await tryReserve(ledger, {
      ...reserveInput("bad-fixture"),
      fixtureId: "01",
    })).toEqual({ ok: false, reason: "denied", denyReason: "operation_rejected" });
    expect(await tryReserve(ledger, {
      operationId: canonicalFor("half-identity").operationId,
      protocolFlags: openFlags(),
      endpoint: "injuries",
    })).toEqual({ ok: false, reason: "denied", denyReason: "operation_rejected" });

    const hits = { count: 0 };
    const accessor = {
      operationId: canonicalFor("accessor-endpoint").operationId,
      protocolFlags: openFlags(),
      fixtureId: "15",
    };
    Object.defineProperty(accessor, "endpoint", {
      get() {
        hits.count += 1;
        return "lineups";
      },
      enumerable: true,
    });
    expect(await tryReserve(ledger, accessor)).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "operation_rejected",
    });
    expect(hits.count).toBe(0);

    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rows).toEqual([]);
    expect(snapshot.occupancy.research).toBe(0);
    expect(snapshot.occupancy.daily).toBe(0);
    expect(snapshot.occupancy.rate).toBe(0);
  });

  it("accepts one canonical id and rejects a formatted or malformed substitute", async () => {
    const { ledger } = await setup();
    const input = reserveInput("canonical-accept");
    const created = await tryReserve(ledger, input);
    expect(isNewReserve(created)).toBe(true);
    if (!isNewReserve(created)) return;
    expect(created.operationId).toBe(input.operationId);
    expect(created.operationId).toMatch(/^[0-9a-f]{64}$/);

    const before = await mustSnapshot(ledger);
    const unrelated = deriveOperationId(DEFAULT_OPERATION_IDENTITY, {
      endpoint: "injuries",
      fixtureId: input.fixtureId,
    });
    if (!unrelated.ok) throw new Error("expected a different canonical id");
    expect(unrelated.operationId).not.toBe(input.operationId);

    const rejected = { ok: false, reason: "denied", denyReason: "operation_rejected" } as const;
    expect(await tryReserve(ledger, { ...input, operationId: unrelated.operationId })).toEqual(rejected);
    expect(await tryReserve(ledger, { ...input, operationId: "a".repeat(64) })).toEqual(rejected);
    expect(await tryReserve(ledger, { ...input, operationId: "A".repeat(64) })).toEqual(rejected);
    expect(await tryReserve(ledger, { ...input, operationId: "not-a-hash" })).toEqual(rejected);
    expect(await tryReserve(ledger, { ...input, operationId: "" })).toEqual(rejected);
    expect(await tryReserve(ledger, {
      operationId: input.operationId,
      protocolFlags: openFlags(),
      endpoint: "lineups",
      fixtureId: "01",
    })).toEqual(rejected);

    const after = await mustSnapshot(ledger);
    expect(after.rowCount).toBe(1);
    expect(after.occupancy).toEqual(before.occupancy);
    expect(row(after, "canonical-accept").state).toBe("reserved");
  });

  it("collapses path spellings and purpose aliases onto one reservation", async () => {
    const { ledger } = await setup();
    const input = reserveInput("path-alias");
    const first = await tryReserve(ledger, { ...input, callerPath: "/fixtures/lineups", purpose: "scan" });
    expect(isNewReserve(first)).toBe(true);
    if (!isNewReserve(first)) return;

    const spellings = ["fixtures/lineups", "fixtures\\lineups", "  /fixtures/lineups/  "];
    for (const callerPath of spellings) {
      expect(await tryReserve(ledger, {
        ...input,
        callerPath,
        purpose: `alias-${callerPath}`,
      })).toMatchObject({
        ok: true,
        idempotent: true,
        reservationId: first.reservationId,
        operationId: input.operationId,
        state: "reserved",
      });
    }

    const otherPurpose = deriveOperationId(DEFAULT_OPERATION_IDENTITY, {
      endpoint: "lineups",
      fixtureId: "900001",
    });
    if (!otherPurpose.ok) throw new Error("expected another id");
    expect(await tryReserve(ledger, {
      operationId: otherPurpose.operationId,
      protocolFlags: openFlags(),
      endpoint: "lineups",
      fixtureId: input.fixtureId,
      callerPath: "//fixtures/lineups",
      purpose: "retry-with-another-label",
    })).toEqual({ ok: false, reason: "denied", denyReason: "operation_rejected" });

    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expect(snapshot.occupancy.daily).toBe(1);
    expect(snapshot.occupancy.rate).toBe(1);
  });

  it("rejects credential, approval, fixture, and generation substitution", async () => {
    const { ledger } = await setup();
    const input = reserveInput("substitution");
    expect(isNewReserve(await tryReserve(ledger, input))).toBe(true);
    const before = await mustSnapshot(ledger);
    const rejected = { ok: false, reason: "denied", denyReason: "operation_rejected" } as const;

    expect(await tryReserve(ledger, { ...input, credentialId: "cred-other" })).toEqual(rejected);
    expect(await tryReserve(ledger, { ...input, approvalId: "approval:attacker" })).toEqual(rejected);
    expect(await tryReserve(ledger, { ...input, ledgerInstanceId: "ledger-b" })).toEqual(rejected);
    expect(await tryReserve(ledger, { ...input, generation: 1 })).toEqual(rejected);
    expect(await tryReserve(ledger, { ...input, fixtureId: "900002" })).toEqual(rejected);
    expect(await tryReserve(ledger, { ...input, endpoint: "injuries" })).toEqual(rejected);

    const substituted = deriveOperationId(
      { ...DEFAULT_OPERATION_IDENTITY, credentialId: "cred-other" },
      { endpoint: "lineups", fixtureId: input.fixtureId },
    );
    if (!substituted.ok) throw new Error("expected a substituted id");
    expect(await tryReserve(ledger, {
      ...input,
      operationId: substituted.operationId,
      credentialId: "cred-other",
    })).toEqual(rejected);

    const after = await mustSnapshot(ledger);
    expect(after.rowCount).toBe(1);
    expect(after.occupancy).toEqual(before.occupancy);
  });

  it("returns the existing row for a duplicate canonical reserve, including a concurrent burst", async () => {
    const { ledger } = await setup();
    const input = reserveInput("concurrent-canonical");
    const first = await tryReserve(ledger, input);
    expect(isNewReserve(first)).toBe(true);
    if (!isNewReserve(first)) return;
    expect(await tryReserve(ledger, input)).toMatchObject({
      ok: true,
      idempotent: true,
      reservationId: first.reservationId,
      fencingToken: first.fencingToken,
      state: "reserved",
    });

    const burst = await Promise.all(
      Array.from({ length: 8 }, () => tryReserve(ledger, input)),
    );
    expect(burst.filter(isNewReserve)).toHaveLength(0);
    expect(burst.every((result) => result.ok && result.idempotent)).toBe(true);
    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
    expect(row(snapshot, "concurrent-canonical").state).toBe("reserved");
  });

  it("keeps ceilings, vendor-day rollover, lost acks, and terminal rows on canonical ids", async () => {
    const daily = await setup({ dailyCeiling: 1, researchCeiling: 4, rateCeiling: 4 });
    const held = reserveInput("ceiling-held");
    expect(isNewReserve(await tryReserve(daily.ledger, held))).toBe(true);
    const beforeRejects = await mustSnapshot(daily.ledger);
    expect(await tryReserve(daily.ledger, {
      ...held,
      operationId: "b".repeat(64),
    })).toEqual({ ok: false, reason: "denied", denyReason: "operation_rejected" });
    expect(await tryReserve(daily.ledger, reserveInput("ceiling-next"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "daily_ceiling",
    });
    expect((await mustSnapshot(daily.ledger)).occupancy).toEqual(beforeRejects.occupancy);

    const research = await setup({ dailyCeiling: 4, researchCeiling: 1, rateCeiling: 4 });
    expect(isNewReserve(await tryReserve(research.ledger, reserveInput("research-held")))).toBe(true);
    expect(await tryReserve(research.ledger, reserveInput("research-next-canonical"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "research_ceiling",
    });

    const rate = await setup({ dailyCeiling: 4, researchCeiling: 4, rateCeiling: 1 });
    expect(isNewReserve(await tryReserve(rate.ledger, reserveInput("rate-held-canonical")))).toBe(true);
    expect(await tryReserve(rate.ledger, reserveInput("rate-next-canonical"))).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "rate_ceiling",
    });

    const rollover = await setup({
      leaseMs: 12 * 60 * 60 * 1000,
      fetchTimeoutMs: 1_000,
      dailyCeiling: 2,
      researchCeiling: 2,
      rateCeiling: 2,
    }, Date.UTC(2026, 0, 15, 23, 0, 0));
    const reserved = await reserveNew(rollover.ledger, "canonical-rollover");
    rollover.clock.advance(2 * 60 * 60 * 1000);
    expect(await replaceKillSwitch(rollover.ledger, clearKill(rollover.clock.now()))).toEqual({ ok: true });
    const sent = await beginSend(rollover.ledger, {
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(row(await mustSnapshot(rollover.ledger), "canonical-rollover")).toMatchObject({
      state: "sending",
      chargeDay: "2026-01-16",
    });
    expect((await mustSnapshot(rollover.ledger)).rowCount).toBe(1);

    const lost = await setup({ dailyCeiling: 1, researchCeiling: 1, rateCeiling: 1 });
    expect(await armLostAcknowledgement(lost.ledger, "tryReserve")).toEqual({ ok: true });
    const input = reserveInput("canonical-lost-ack");
    expect(await tryReserve(lost.ledger, input)).toEqual({ ok: false, reason: "ambiguous" });
    const looked = await lookupReservation(lost.ledger, input.operationId);
    if (!looked.ok || !looked.found || looked.fencingToken == null) {
      throw new Error("expected the reserved fencing token");
    }
    expect(await tryReserve(lost.ledger, input)).toMatchObject({
      ok: true,
      idempotent: true,
      reservationId: looked.reservationId,
      fencingToken: looked.fencingToken,
    });
    expect((await mustSnapshot(lost.ledger)).rowCount).toBe(1);

    const terminal = await setup();
    const finished = await finish(terminal.ledger, "canonical-terminal", "failed");
    const occupied = await mustSnapshot(terminal.ledger);
    expect(row(occupied, "canonical-terminal").state).toBe("failed");
    expect(await tryReserve(terminal.ledger, reserveInput("canonical-terminal"))).toMatchObject({
      ok: true,
      idempotent: true,
      state: "failed",
      fencingToken: null,
    });
    expect(await recordOutcome(terminal.ledger, {
      reservationId: finished.reserved.reservationId,
      sendToken: finished.sent.sendToken,
      outcome: "failed",
      failedReason: "outcome_unknown",
    })).toEqual({ ok: false, reason: "denied", denyReason: "invalid_transition" });
    const still = await mustSnapshot(terminal.ledger);
    expect(still.occupancy.research).toBe(occupied.occupancy.research);
    expect(still.occupancy.daily).toBe(occupied.occupancy.daily);
    expect(still.rowCount).toBe(1);
  });

  it("does not treat a proxy proof as a send commit and keeps clock errors free of exception text", async () => {
    const { ledger } = await setup();
    const { reserved, sent } = await sendNew(ledger, "proxy-proof");
    const hits = { count: 0 };
    const { proxy, revoke } = Proxy.revocable(
      { reservationId: reserved.reservationId, sendToken: sent.sendToken },
      {
        get() {
          hits.count += 1;
          return "trap";
        },
      },
    );
    expect(await matchSendCommit(ledger, proxy)).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "operation_rejected",
    });
    expect(hits.count).toBe(0);
    revoke();
    expect(await matchSendCommit(ledger, proxy)).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "operation_rejected",
    });
    expect(hits.count).toBe(0);
    expect(row(await mustSnapshot(ledger), "proxy-proof").state).toBe("sending");

    let throwsLeft = 0;
    let value = NOW;
    const clock = {
      now() {
        if (throwsLeft > 0) {
          throwsLeft -= 1;
          throw new Error("secret-clock-failure");
        }
        return value;
      },
    };
    const custom = createMemoryLedger({ approval: approval(), clock });
    expect(await replaceKillSwitch(custom, clearKill(value))).toEqual({ ok: true });
    const customReserved = await reserveNew(custom, "clock-proof");
    const customSent = await beginSend(custom, {
      reservationId: customReserved.reservationId,
      fencingToken: customReserved.fencingToken,
    });
    expect(customSent.ok).toBe(true);
    throwsLeft = 1;
    value += 1;
    const denied = await readLedgerNow(custom);
    expect(denied).toEqual({ ok: false, reason: "clock_unavailable" });
    expect(JSON.stringify(denied)).not.toContain("secret-clock-failure");
    expect(row(await mustSnapshot(custom), "clock-proof").state).toBe("sending");
    expect((await mustSnapshot(custom)).occupancy.research).toBe(1);
  });

  it("rejects a proxy reserve before reading its traps", async () => {
    const { ledger } = await setup();
    const hits = { count: 0 };
    const target = reserveInput("proxy-reserve");
    const live = new Proxy(target, {
      get() {
        hits.count += 1;
        return "trap";
      },
      getOwnPropertyDescriptor() {
        hits.count += 1;
        return undefined;
      },
    });
    const denied = await tryReserve(ledger, live);
    expect(denied).toEqual({ ok: false, reason: "denied", denyReason: "operation_rejected" });
    expect(JSON.stringify(denied)).not.toContain("trap");
    const revocable = Proxy.revocable(target, {
      get() {
        hits.count += 1;
        return "trap";
      },
    });
    revocable.revoke();
    expect(await tryReserve(ledger, revocable.proxy)).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "operation_rejected",
    });
    expect(hits.count).toBe(0);

    const flagHits = { count: 0 };
    const flagged = reserveInput("flag-proxy");
    Object.defineProperty(flagged, "protocolFlags", {
      enumerable: true,
      get() {
        flagHits.count += 1;
        return openFlags();
      },
    });
    expect(await tryReserve(ledger, flagged)).toEqual({
      ok: false,
      reason: "denied",
      denyReason: "protocol_flag_violation",
    });
    expect(flagHits.count).toBe(0);
    expect((await mustSnapshot(ledger)).rowCount).toBe(0);
    expect((await mustSnapshot(ledger)).occupancy.research).toBe(0);
    expect(isNewReserve(await tryReserve(ledger, reserveInput("plain-after-proxy")))).toBe(true);
    const snapshot = await mustSnapshot(ledger);
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.occupancy.research).toBe(1);
  });

  it("does not copy a getter operation id into a denial audit", async () => {
    const { ledger } = await setup();
    const hits = { count: 0 };
    const secret = "secret-op-id";
    const thrown = "secret-op-throw";
    const flags = openFlags();
    const getterInput = {
      protocolFlags: { ...flags, pe53Authorized: true },
      endpoint: "lineups" as const,
      fixtureId: "15",
    };
    Object.defineProperty(getterInput, "operationId", {
      enumerable: true,
      get() {
        hits.count += 1;
        return secret;
      },
    });
    const denied = await tryReserve(ledger, getterInput as TryReserveInput);
    expect(denied).toEqual({ ok: false, reason: "denied", denyReason: "protocol_flag_violation" });
    expect(hits.count).toBe(0);

    const throwingInput = {
      protocolFlags: openFlags(),
      endpoint: "lineups" as const,
      fixtureId: "16",
    };
    Object.defineProperty(throwingInput, "operationId", {
      enumerable: true,
      get() {
        hits.count += 1;
        throw new Error(thrown);
      },
    });
    let escaped = "";
    let thrownResult: unknown;
    try {
      thrownResult = await tryReserve(ledger, throwingInput as TryReserveInput);
    } catch (error) {
      escaped = error instanceof Error ? error.message : String(error);
    }
    expect(escaped).toBe("");
    expect(thrownResult).toEqual({ ok: false, reason: "denied", denyReason: "operation_rejected" });
    expect(hits.count).toBe(0);
    const rendered = JSON.stringify(await mustSnapshot(ledger));
    expect(rendered).not.toContain(secret);
    expect(rendered).not.toContain(thrown);
    expect((await mustSnapshot(ledger)).rowCount).toBe(0);
  });

  it("does not authenticate a copied ledger shell or expose registered state", async () => {
    const { ledger } = await setup();
    const created = await reserveNew(ledger, "registered-shell");
    const before = await mustSnapshot(ledger);
    expect(isRegisteredMemoryLedger(ledger)).toBe(true);
    expect(Object.getOwnPropertySymbols(ledger)).toEqual([]);
    const legacy = Symbol.for("apex.pe5.acquisition-boundary.memory-ledger.state.v1");
    const shell = {
      kind: "pe5-memory-ledger" as const,
      instanceId: ledger.instanceId,
      approvalId: ledger.approvalId,
      generation: 0 as const,
      allowRegeneration: false as const,
    };
    Object.defineProperty(shell, legacy, {
      value: { kind: "pe5-memory-ledger-state", rows: new Map() },
      enumerable: false,
    });
    expect(isRegisteredMemoryLedger(shell)).toBe(false);
    expect(await tryReserve(shell, reserveInput("forged-shell"))).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await beginSend(shell, {
      reservationId: created.reservationId,
      fencingToken: created.fencingToken,
    })).toEqual({ ok: false, reason: "unavailable" });
    expect(await matchSendCommit(shell, {
      reservationId: created.reservationId,
      sendToken: "send-1",
    })).toEqual({ ok: false, reason: "unavailable" });
    expect(await readSnapshot(shell)).toEqual({ ok: false, reason: "unavailable" });
    expect(await mustSnapshot(ledger)).toEqual(before);
  });
});
