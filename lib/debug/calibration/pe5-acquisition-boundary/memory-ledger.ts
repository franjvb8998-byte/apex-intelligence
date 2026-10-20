/**
 * PE-5.4C increment 2 — in-memory reservation ledger simulator.
 *
 * One ledger object per approval. Occupancy checks and writes for that object
 * share one queue. This is not a durable, distributed, or production quota
 * system, and it does not prove cross-process atomicity.
 *
 * Operation ids are caller-supplied opaque strings. They are not canonical
 * hashes. Vendor-day rebind is not implemented: daily buckets use the UTC
 * date of the injected clock, and beginSend refuses when that bucket differs
 * from the row's charge day.
 *
 * No network, credentials, process-global registry, or production cache.
 */

import {
  protocolFlagsDeny,
  readRealProtocolFlags,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/authorize";
import {
  PROTOCOL_FLAG_KEYS,
  type AcquisitionApproval,
  type ProtocolFlagKey,
  type ProtocolFlagSnapshot,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/types";

export const PE5_4C_LEDGER_DEFERRED = {
  fetchCount: "no-transport-in-increment-2",
  vendorDayRollover: "increment-4",
  canonicalOperationId: "increment-3",
} as const;

export const PE5_4C_MEMORY_LEDGER_LIMIT = {
  durability: "in-process-only",
  atomicity: "single-process-serialized-queue",
  productionQuota: false,
} as const;

export const RESERVATION_STATES = [
  "reserved",
  "sending",
  "consumed",
  "failed",
  "expired",
  "abandoned",
] as const;

export type ReservationState = (typeof RESERVATION_STATES)[number];

export const LEDGER_DENY_REASONS = [
  "protocol_flag_violation",
  "clock_unavailable",
  "kill_switch_unreadable",
  "kill_switch_engaged",
  "kill_switch_stale",
  "mode_denied",
  "approval_expired",
  "approval_inconsistent",
  "approval_invalid",
  "operation_rejected",
  "daily_ceiling",
  "research_ceiling",
  "rate_ceiling",
  "stale_token",
  "lease_expired",
  "lease_too_short",
  "vendor_day_rebind_deferred",
  "invalid_transition",
  "reservation_missing",
] as const;

export type LedgerDenyReason = (typeof LEDGER_DENY_REASONS)[number];

export type LedgerClock = {
  now(): number;
};

export type MemoryLedger = {
  readonly kind: "pe5-memory-ledger";
  readonly instanceId: string;
  readonly approvalId: string;
  readonly generation: 0;
  readonly allowRegeneration: false;
};

export type TryReserveInput = {
  readonly operationId: string;
  readonly protocolFlags: unknown;
};

export type TryReserveResult =
  | {
      readonly ok: true;
      readonly idempotent: false;
      readonly reservationId: string;
      readonly operationId: string;
      readonly state: "reserved";
      readonly chargeDay: string;
      readonly leaseDeadline: number;
      readonly fencingToken: string;
    }
  | {
      readonly ok: true;
      readonly idempotent: true;
      readonly reservationId: string;
      readonly operationId: string;
      readonly state: ReservationState;
      readonly chargeDay: string;
      readonly leaseDeadline: number;
      readonly fencingToken: string | null;
    }
  | { readonly ok: false; readonly reason: "denied"; readonly denyReason: LedgerDenyReason }
  | { readonly ok: false; readonly reason: "unavailable" }
  | { readonly ok: false; readonly reason: "ambiguous" };

export type BeginSendInput = {
  readonly reservationId: string;
  readonly fencingToken: string;
};

export type BeginSendResult =
  | {
      readonly ok: true;
      readonly reservationId: string;
      readonly sendToken: string;
      readonly sendingCommittedAt: number;
      readonly chargeDay: string;
    }
  | { readonly ok: false; readonly reason: "denied"; readonly denyReason: LedgerDenyReason }
  | { readonly ok: false; readonly reason: "unavailable" }
  | { readonly ok: false; readonly reason: "ambiguous" };

export type OutcomeInput = {
  readonly reservationId: string;
  readonly sendToken: string;
  readonly outcome: "consumed" | "failed";
  readonly failedReason?: string;
};

export type OutcomeResult =
  | {
      readonly ok: true;
      readonly reservationId: string;
      readonly state: "consumed" | "failed";
      readonly chargeDay: string;
      readonly sendingCommittedAt: number;
    }
  | { readonly ok: false; readonly reason: "denied"; readonly denyReason: LedgerDenyReason }
  | { readonly ok: false; readonly reason: "unavailable" };

export type AbandonInput = {
  readonly reservationId: string;
  readonly fencingToken: string;
};

export type AbandonResult =
  | { readonly ok: true; readonly reservationId: string; readonly state: "abandoned" }
  | { readonly ok: false; readonly reason: "denied"; readonly denyReason: LedgerDenyReason }
  | { readonly ok: false; readonly reason: "unavailable" };

export type SweepResult =
  | { readonly ok: true; readonly released: number }
  | { readonly ok: false; readonly reason: "denied"; readonly denyReason: LedgerDenyReason }
  | { readonly ok: false; readonly reason: "unavailable" };

export type LookupResult =
  | { readonly ok: true; readonly found: false }
  | {
      readonly ok: true;
      readonly found: true;
      readonly reservationId: string;
      readonly operationId: string;
      readonly state: ReservationState;
      readonly chargeDay: string;
      readonly consumer: "pe5" | "external";
      readonly leaseDeadline: number;
      readonly sendingCommittedAt: number | null;
      readonly fencingToken: string | null;
      readonly tokenDisclosed: boolean;
    }
  | { readonly ok: false; readonly reason: "denied"; readonly denyReason: LedgerDenyReason }
  | { readonly ok: false; readonly reason: "unavailable" }
  | { readonly ok: false; readonly reason: "ambiguous" };

export type KillSwitchResult =
  | {
      readonly ok: true;
      readonly state: "clear";
      readonly version: number;
      readonly updatedAt: number;
      readonly maxAgeMs: number;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "kill_switch_engaged"
        | "kill_switch_unreadable"
        | "kill_switch_stale"
        | "clock_unavailable"
        | "unavailable";
    };

export type ExternalChargeInput = {
  readonly operationId: string;
  readonly state: "reserved" | "sending" | "consumed" | "failed";
};

export type ExternalChargeResult =
  | { readonly ok: true; readonly inserted: boolean; readonly reservationId: string }
  | { readonly ok: false; readonly reason: "denied"; readonly denyReason: LedgerDenyReason }
  | { readonly ok: false; readonly reason: "unavailable" };

export type LedgerRowView = {
  readonly reservationId: string;
  readonly operationId: string;
  readonly state: ReservationState;
  readonly chargeDay: string;
  readonly consumer: "pe5" | "external";
  readonly approvalId: string;
  readonly credentialId: string;
  readonly leaseDeadline: number;
  readonly sendingCommittedAt: number | null;
  readonly failedReason: string | null;
};

export type LedgerAuditView = {
  readonly at: number;
  readonly action: string;
  readonly operationId?: string;
  readonly reservationId?: string;
  readonly reason?: string;
};

export type LedgerSnapshot = {
  readonly instanceId: string;
  readonly approvalId: string;
  readonly generation: 0;
  readonly allowRegeneration: false;
  readonly unavailable: boolean;
  readonly rowCount: number;
  readonly rows: readonly LedgerRowView[];
  readonly audits: readonly LedgerAuditView[];
  readonly occupancy: {
    readonly research: number;
    readonly daily: number;
    readonly rate: number;
    readonly chargeDay: string;
  };
};

export type SnapshotResult =
  | { readonly ok: true; readonly snapshot: LedgerSnapshot }
  | { readonly ok: false; readonly reason: "denied"; readonly denyReason: LedgerDenyReason }
  | { readonly ok: false; readonly reason: "unavailable" };

type BoundApproval = {
  readonly mode: "offline";
  readonly credentialId: string;
  readonly ledgerInstanceId: string;
  readonly researchCeiling: number;
  readonly dailyCeiling: number;
  readonly rateCeiling: number;
  readonly rateWindowMs: number;
  readonly leaseMs: number;
  readonly fetchTimeoutMs: number;
  readonly maxAgeMs: number;
  readonly expiry: number;
};

type Row = {
  reservationId: string;
  operationId: string;
  approvalId: string;
  credentialId: string;
  consumer: "pe5" | "external";
  state: ReservationState;
  fencingToken: string | null;
  sendToken: string | null;
  chargeDay: string;
  leaseDeadline: number;
  sendingCommittedAt: number | null;
  failedReason: string | null;
  createdAt: number;
};

type Audit = {
  at: number;
  action: string;
  operationId?: string;
  reservationId?: string;
  reason?: string;
};

type LedgerState = {
  readonly kind: "pe5-memory-ledger-state";
  readonly approval: BoundApproval | null;
  readonly approvalId: string;
  readonly configDeny: "approval_invalid" | "mode_denied" | null;
  readonly clock: LedgerClock | null;
  readonly rows: Map<string, Row>;
  kill: unknown;
  unavailable: boolean;
  loseNextReserveAck: boolean;
  loseNextBeginAck: boolean;
  unattestedLookup: boolean;
  nextReservation: number;
  nextFence: number;
  nextSend: number;
  tail: Promise<void>;
  audits: Audit[];
};

const STATE_KEY = Symbol.for("apex.pe5.acquisition-boundary.memory-ledger.state.v1");
const STATE_KIND = "pe5-memory-ledger-state" as const;

const CHARGED: ReadonlySet<ReservationState> = new Set([
  "reserved",
  "sending",
  "consumed",
  "failed",
]);

const CEILING_FIELDS = ["researchCeiling", "dailyCeiling", "rateCeiling"] as const;
const DURATION_FIELDS = ["rateWindowMs", "leaseMs", "fetchTimeoutMs", "maxAgeMs"] as const;

export function createMemoryLedger(config: {
  readonly approval: AcquisitionApproval;
  readonly clock: LedgerClock;
}): MemoryLedger {
  const parsed = parseBoundApproval(config.approval);
  const clock = isClock(config.clock) ? config.clock : null;
  const approval = parsed.ok ? parsed.approval : null;
  const state: LedgerState = {
    kind: STATE_KIND,
    approval,
    approvalId: approval == null ? "approval-unbound" : `approval:${approval.ledgerInstanceId}`,
    configDeny: parsed.ok ? null : parsed.deny,
    clock,
    rows: new Map(),
    kill: null,
    unavailable: false,
    loseNextReserveAck: false,
    loseNextBeginAck: false,
    unattestedLookup: false,
    nextReservation: 1,
    nextFence: 1,
    nextSend: 1,
    tail: Promise.resolve(),
    audits: [],
  };
  const ledger: MemoryLedger = {
    kind: "pe5-memory-ledger",
    instanceId: approval?.ledgerInstanceId ?? "unbound",
    approvalId: state.approvalId,
    generation: 0,
    allowRegeneration: false,
  };
  Object.defineProperty(ledger, STATE_KEY, {
    value: state,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(ledger);
}

export async function tryReserve(
  ledger: MemoryLedger,
  input: TryReserveInput,
): Promise<TryReserveResult> {
  return run(ledger, (state) => reserveBody(state, input));
}

export async function beginSend(
  ledger: MemoryLedger,
  input: BeginSendInput,
): Promise<BeginSendResult> {
  return run(ledger, (state) => commitBeginSend(state, input));
}

export async function recordOutcome(
  ledger: MemoryLedger,
  input: OutcomeInput,
): Promise<OutcomeResult> {
  return run(ledger, (state) => commitOutcome(state, input));
}

export async function abandonReservation(
  ledger: MemoryLedger,
  input: AbandonInput,
): Promise<AbandonResult> {
  return run(ledger, (state) => commitAbandon(state, input));
}

export async function sweepExpired(ledger: MemoryLedger): Promise<SweepResult> {
  return run(ledger, (state) => commitSweep(state));
}

export async function lookupReservation(
  ledger: MemoryLedger,
  operationId: string,
): Promise<LookupResult> {
  return run(ledger, (state) => readReservation(state, operationId));
}

export async function readKillSwitch(ledger: MemoryLedger): Promise<KillSwitchResult> {
  return run(ledger, async (state) => {
    if (state.unavailable) return { ok: false as const, reason: "unavailable" as const };
    const now = readNow(state.clock);
    if (now == null) return { ok: false as const, reason: "clock_unavailable" as const };
    const kill = assessKill(state.kill, now);
    if (!kill.ok) return { ok: false as const, reason: kill.reason };
    return {
      ok: true as const,
      state: "clear" as const,
      version: kill.kill.version,
      updatedAt: kill.kill.updatedAt,
      maxAgeMs: kill.kill.maxAgeMs,
    };
  });
}

export async function replaceKillSwitch(
  ledger: MemoryLedger,
  record: unknown,
): Promise<{ ok: true } | { ok: false; reason: "unavailable" }> {
  return run(ledger, async (state) => {
    if (state.unavailable) return { ok: false as const, reason: "unavailable" as const };
    state.kill = copyKill(record);
    return { ok: true as const };
  });
}

/**
 * Fake product spender for this simulator. The row occupies daily and rate
 * capacity for the ledger credential. It does not occupy the research ceiling
 * and cannot begin a PE-5 send.
 */
export async function insertExternalCharge(
  ledger: MemoryLedger,
  input: ExternalChargeInput,
): Promise<ExternalChargeResult> {
  return run(ledger, (state) => commitExternalCharge(state, input));
}

export async function setLedgerUnavailable(
  ledger: MemoryLedger,
  unavailable: boolean,
): Promise<{ ok: true } | { ok: false; reason: "unavailable" }> {
  return run(ledger, async (state) => {
    state.unavailable = unavailable;
    return { ok: true as const };
  });
}

export async function armLostAcknowledgement(
  ledger: MemoryLedger,
  which: "tryReserve" | "beginSend",
): Promise<{ ok: true } | { ok: false; reason: "unavailable" }> {
  return run(ledger, async (state) => {
    if (state.unavailable) return { ok: false as const, reason: "unavailable" as const };
    if (which === "tryReserve") state.loseNextReserveAck = true;
    else state.loseNextBeginAck = true;
    return { ok: true as const };
  });
}

export async function armUnattestedLookup(
  ledger: MemoryLedger,
): Promise<{ ok: true } | { ok: false; reason: "unavailable" }> {
  return run(ledger, async (state) => {
    if (state.unavailable) return { ok: false as const, reason: "unavailable" as const };
    state.unattestedLookup = true;
    return { ok: true as const };
  });
}

export async function readSnapshot(ledger: MemoryLedger): Promise<SnapshotResult> {
  return run(ledger, async (state) => {
    if (state.unavailable) return { ok: false as const, reason: "unavailable" as const };
    if (state.configDeny != null) return denied(state.configDeny);
    if (state.approval == null) return denied("approval_invalid");
    const now = readNow(state.clock);
    if (now == null) return denied("clock_unavailable");
    const chargeDay = chargeDayOf(now);
    if (chargeDay == null) return denied("clock_unavailable");
    return {
      ok: true as const,
      snapshot: {
        instanceId: state.approval.ledgerInstanceId,
        approvalId: state.approvalId,
        generation: 0 as const,
        allowRegeneration: false as const,
        unavailable: false,
        rowCount: state.rows.size,
        rows: [...state.rows.values()].map(viewRow),
        audits: state.audits.map(viewAudit),
        occupancy: {
          research: researchOccupancy(state),
          daily: dailyOccupancy(state, chargeDay),
          rate: rateOccupancy(state, now),
          chargeDay,
        },
      },
    };
  });
}

async function reserveBody(state: LedgerState, input: TryReserveInput): Promise<TryReserveResult> {
  const first = evaluateReserve(state, input);
  if (first.kind !== "insert") return first.result;
  // Inside the instance queue. This yields so concurrent callers can line up
  // before the write. It does not sleep and it does not wait for quota.
  await interleave();
  const confirmed = evaluateReserve(state, input);
  if (confirmed.kind !== "insert") return confirmed.result;

  const token = `fence-${state.nextFence}`;
  state.nextFence += 1;
  const reservationId = `res-${state.nextReservation}`;
  state.nextReservation += 1;
  const row: Row = {
    reservationId,
    operationId: confirmed.operationId,
    approvalId: state.approvalId,
    credentialId: confirmed.credentialId,
    consumer: "pe5",
    state: "reserved",
    fencingToken: token,
    sendToken: null,
    chargeDay: confirmed.chargeDay,
    leaseDeadline: confirmed.leaseDeadline,
    sendingCommittedAt: null,
    failedReason: null,
    createdAt: confirmed.now,
  };
  state.rows.set(row.operationId, row);
  audit(state, {
    at: confirmed.now,
    action: "reserve",
    operationId: row.operationId,
    reservationId,
  });

  if (state.loseNextReserveAck) {
    state.loseNextReserveAck = false;
    audit(state, {
      at: confirmed.now,
      action: "ack_withheld",
      operationId: row.operationId,
      reservationId,
      reason: "reserve",
    });
    return { ok: false, reason: "ambiguous" };
  }

  return {
    ok: true,
    idempotent: false,
    reservationId,
    operationId: row.operationId,
    state: "reserved",
    chargeDay: row.chargeDay,
    leaseDeadline: row.leaseDeadline,
    fencingToken: token,
  };
}

type ReserveEvaluation =
  | { kind: "insert"; now: number; operationId: string; chargeDay: string; leaseDeadline: number; credentialId: string }
  | { kind: "done"; result: TryReserveResult };

function evaluateReserve(state: LedgerState, input: TryReserveInput): ReserveEvaluation {
  if (state.unavailable) return done(unready());
  if (state.configDeny != null) return done(denied(state.configDeny));
  if (state.approval == null || state.clock == null) return done(denied("approval_invalid"));

  const flags = readSuppliedFlags(input.protocolFlags);
  if (flags == null || protocolFlagsDeny(readRealProtocolFlags(), flags)) {
    return done(deniedAudit(state, "protocol_flag_violation", { operationId: inputOrBlank(input) }));
  }

  const now = readNow(state.clock);
  if (now == null) return done(deniedAudit(state, "clock_unavailable"));
  const chargeDay = chargeDayOf(now);
  if (chargeDay == null) return done(deniedAudit(state, "clock_unavailable", { at: now }));
  if (now >= state.approval.expiry) {
    return done(deniedAudit(state, "approval_expired", { at: now }));
  }

  const kill = assessKill(state.kill, now);
  if (!kill.ok) return done(deniedAudit(state, kill.reason, { at: now }));
  if (kill.kill.maxAgeMs !== state.approval.maxAgeMs) {
    return done(deniedAudit(state, "approval_inconsistent", { at: now }));
  }

  if (!isIdentity(input.operationId)) {
    return done(deniedAudit(state, "operation_rejected", { at: now }));
  }

  const existing = state.rows.get(input.operationId);
  if (existing != null) {
    audit(state, {
      at: now,
      action: "reserve_idempotent",
      operationId: existing.operationId,
      reservationId: existing.reservationId,
    });
    return done({
      ok: true,
      idempotent: true,
      reservationId: existing.reservationId,
      operationId: existing.operationId,
      state: existing.state,
      chargeDay: existing.chargeDay,
      leaseDeadline: existing.leaseDeadline,
      fencingToken: existing.state === "reserved" ? existing.fencingToken : null,
    });
  }

  const leaseDeadline = now + state.approval.leaseMs;
  if (!Number.isSafeInteger(leaseDeadline)) {
    return done(deniedAudit(state, "clock_unavailable", { at: now, operationId: input.operationId }));
  }

  if (dailyOccupancy(state, chargeDay) >= state.approval.dailyCeiling) {
    return done(deniedAudit(state, "daily_ceiling", { at: now, operationId: input.operationId }));
  }
  if (researchOccupancy(state) >= state.approval.researchCeiling) {
    return done(deniedAudit(state, "research_ceiling", { at: now, operationId: input.operationId }));
  }
  if (rateOccupancy(state, now) >= state.approval.rateCeiling) {
    return done(deniedAudit(state, "rate_ceiling", { at: now, operationId: input.operationId }));
  }

  return {
    kind: "insert",
    now,
    operationId: input.operationId,
    chargeDay,
    leaseDeadline,
    credentialId: state.approval.credentialId,
  };
}

async function commitBeginSend(state: LedgerState, input: BeginSendInput): Promise<BeginSendResult> {
  const first = evaluateBeginSend(state, input);
  if (first.kind !== "commit") return first.result;
  await interleave();
  const confirmed = evaluateBeginSend(state, input);
  if (confirmed.kind !== "commit") return confirmed.result;

  const sendToken = `send-${state.nextSend}`;
  state.nextSend += 1;
  confirmed.row.state = "sending";
  confirmed.row.sendingCommittedAt = confirmed.now;
  confirmed.row.fencingToken = null;
  confirmed.row.sendToken = sendToken;
  audit(state, {
    at: confirmed.now,
    action: "begin_send",
    operationId: confirmed.row.operationId,
    reservationId: confirmed.row.reservationId,
  });

  if (state.loseNextBeginAck) {
    state.loseNextBeginAck = false;
    audit(state, {
      at: confirmed.now,
      action: "ack_withheld",
      operationId: confirmed.row.operationId,
      reservationId: confirmed.row.reservationId,
      reason: "begin_send",
    });
    return { ok: false, reason: "ambiguous" };
  }

  return {
    ok: true,
    reservationId: confirmed.row.reservationId,
    sendToken,
    sendingCommittedAt: confirmed.now,
    chargeDay: confirmed.row.chargeDay,
  };
}

type BeginEvaluation =
  | { kind: "commit"; now: number; row: Row }
  | { kind: "done"; result: BeginSendResult };

function evaluateBeginSend(state: LedgerState, input: BeginSendInput): BeginEvaluation {
  if (state.unavailable) return { kind: "done", result: unready() };
  if (state.configDeny != null) return { kind: "done", result: denied(state.configDeny) };
  if (state.approval == null || state.clock == null) {
    return { kind: "done", result: denied("approval_invalid") };
  }

  const now = readNow(state.clock);
  if (now == null) return { kind: "done", result: deniedAudit(state, "clock_unavailable") };
  const sendDay = chargeDayOf(now);
  if (sendDay == null) return { kind: "done", result: deniedAudit(state, "clock_unavailable", { at: now }) };

  const kill = assessKill(state.kill, now);
  if (!kill.ok) return { kind: "done", result: deniedAudit(state, kill.reason, { at: now }) };
  if (kill.kill.maxAgeMs !== state.approval.maxAgeMs) {
    return { kind: "done", result: deniedAudit(state, "approval_inconsistent", { at: now }) };
  }

  const row = findByReservation(state, input.reservationId);
  if (row == null) {
    return { kind: "done", result: deniedAudit(state, "reservation_missing", { at: now }) };
  }
  if (row.consumer !== "pe5" || row.state !== "reserved" || row.fencingToken !== input.fencingToken) {
    return {
      kind: "done",
      result: deniedAudit(state, "stale_token", {
        at: now,
        operationId: row.operationId,
        reservationId: row.reservationId,
      }),
    };
  }
  if (row.leaseDeadline <= now) {
    return {
      kind: "done",
      result: deniedAudit(state, "lease_expired", {
        at: now,
        operationId: row.operationId,
        reservationId: row.reservationId,
      }),
    };
  }
  if (row.leaseDeadline - now <= state.approval.fetchTimeoutMs) {
    return {
      kind: "done",
      result: deniedAudit(state, "lease_too_short", {
        at: now,
        operationId: row.operationId,
        reservationId: row.reservationId,
      }),
    };
  }
  if (row.chargeDay !== sendDay) {
    return {
      kind: "done",
      result: deniedAudit(state, "vendor_day_rebind_deferred", {
        at: now,
        operationId: row.operationId,
        reservationId: row.reservationId,
      }),
    };
  }

  return { kind: "commit", now, row };
}

async function commitOutcome(state: LedgerState, input: OutcomeInput): Promise<OutcomeResult> {
  const first = evaluateOutcome(state, input);
  if (first.kind !== "commit") return first.result;
  await interleave();
  const confirmed = evaluateOutcome(state, input);
  if (confirmed.kind !== "commit") return confirmed.result;

  confirmed.row.state = input.outcome;
  confirmed.row.failedReason = input.outcome === "failed" ? confirmed.failedReason : null;
  audit(state, {
    at: confirmed.now,
    action: input.outcome === "consumed" ? "consume" : "fail",
    operationId: confirmed.row.operationId,
    reservationId: confirmed.row.reservationId,
    reason: input.outcome === "failed" ? confirmed.failedReason : undefined,
  });
  return {
    ok: true,
    reservationId: confirmed.row.reservationId,
    state: input.outcome,
    chargeDay: confirmed.row.chargeDay,
    sendingCommittedAt: confirmed.row.sendingCommittedAt ?? confirmed.now,
  };
}

type OutcomeEvaluation =
  | { kind: "commit"; now: number; row: Row; failedReason: string }
  | { kind: "done"; result: OutcomeResult };

function evaluateOutcome(state: LedgerState, input: OutcomeInput): OutcomeEvaluation {
  if (state.unavailable) return { kind: "done", result: unready() };
  const now = readNow(state.clock);
  if (now == null) return { kind: "done", result: deniedAudit(state, "clock_unavailable") };
  if (input.outcome !== "consumed" && input.outcome !== "failed") {
    return { kind: "done", result: deniedAudit(state, "invalid_transition", { at: now }) };
  }
  const failedReason = input.outcome === "failed" ? input.failedReason : "unused";
  if (input.outcome === "failed" && !isReasonCode(failedReason)) {
    return { kind: "done", result: deniedAudit(state, "operation_rejected", { at: now }) };
  }
  const row = findByReservation(state, input.reservationId);
  if (row == null) {
    return { kind: "done", result: deniedAudit(state, "reservation_missing", { at: now }) };
  }
  if (row.state !== "sending" || row.sendToken == null || row.sendToken !== input.sendToken) {
    return {
      kind: "done",
      result: deniedAudit(state, "invalid_transition", {
        at: now,
        operationId: row.operationId,
        reservationId: row.reservationId,
      }),
    };
  }
  return { kind: "commit", now, row, failedReason: failedReason ?? "unused" };
}

async function commitAbandon(state: LedgerState, input: AbandonInput): Promise<AbandonResult> {
  const first = evaluateAbandon(state, input);
  if (first.kind !== "commit") return first.result;
  await interleave();
  const confirmed = evaluateAbandon(state, input);
  if (confirmed.kind !== "commit") return confirmed.result;

  confirmed.row.state = "abandoned";
  confirmed.row.fencingToken = null;
  audit(state, {
    at: confirmed.now,
    action: "abandon",
    operationId: confirmed.row.operationId,
    reservationId: confirmed.row.reservationId,
  });
  return { ok: true, reservationId: confirmed.row.reservationId, state: "abandoned" };
}

type AbandonEvaluation =
  | { kind: "commit"; now: number; row: Row }
  | { kind: "done"; result: AbandonResult };

function evaluateAbandon(state: LedgerState, input: AbandonInput): AbandonEvaluation {
  if (state.unavailable) return { kind: "done", result: unready() };
  const now = readNow(state.clock);
  if (now == null) return { kind: "done", result: deniedAudit(state, "clock_unavailable") };
  const row = findByReservation(state, input.reservationId);
  if (row == null) {
    return { kind: "done", result: deniedAudit(state, "reservation_missing", { at: now }) };
  }
  if (row.state !== "reserved" || row.fencingToken !== input.fencingToken) {
    return {
      kind: "done",
      result: deniedAudit(state, "stale_token", {
        at: now,
        operationId: row.operationId,
        reservationId: row.reservationId,
      }),
    };
  }
  return { kind: "commit", now, row };
}

async function commitSweep(state: LedgerState): Promise<SweepResult> {
  if (state.unavailable) return unready();
  const now = readNow(state.clock);
  if (now == null) return denied("clock_unavailable");
  const due = [...state.rows.values()].filter(
    (row) => row.state === "reserved" && row.leaseDeadline <= now,
  );
  await interleave();
  if (state.unavailable) return unready();
  const sweptAt = readNow(state.clock);
  if (sweptAt == null) return denied("clock_unavailable");
  let released = 0;
  for (const row of due) {
    if (row.state !== "reserved" || row.leaseDeadline > sweptAt) continue;
    row.state = "expired";
    row.fencingToken = null;
    released += 1;
    audit(state, {
      at: sweptAt,
      action: "expire",
      operationId: row.operationId,
      reservationId: row.reservationId,
    });
  }
  return { ok: true, released };
}

async function readReservation(state: LedgerState, operationId: string): Promise<LookupResult> {
  if (state.unavailable) return unready();
  if (state.unattestedLookup) {
    state.unattestedLookup = false;
    audit(state, { at: readNow(state.clock) ?? 0, action: "lookup_unattested", operationId });
    return { ok: false, reason: "ambiguous" };
  }
  const now = readNow(state.clock);
  if (now == null) return denied("clock_unavailable");
  if (!isIdentity(operationId)) return denied("operation_rejected");
  const row = state.rows.get(operationId);
  audit(state, {
    at: now,
    action: "lookup",
    operationId,
    reservationId: row?.reservationId,
  });
  if (row == null) return { ok: true, found: false };
  const discloseFence = row.state === "reserved" && row.fencingToken != null;
  return {
    ok: true,
    found: true,
    reservationId: row.reservationId,
    operationId: row.operationId,
    state: row.state,
    chargeDay: row.chargeDay,
    consumer: row.consumer,
    leaseDeadline: row.leaseDeadline,
    sendingCommittedAt: row.sendingCommittedAt,
    fencingToken: discloseFence ? row.fencingToken : null,
    tokenDisclosed: discloseFence,
  };
}

async function commitExternalCharge(
  state: LedgerState,
  input: ExternalChargeInput,
): Promise<ExternalChargeResult> {
  if (state.unavailable) return unready();
  if (state.approval == null || state.configDeny != null) return denied("approval_invalid");
  const now = readNow(state.clock);
  if (now == null) return denied("clock_unavailable");
  const chargeDay = chargeDayOf(now);
  if (chargeDay == null) return denied("clock_unavailable");
  if (!isIdentity(input.operationId)) return denied("operation_rejected");
  if (!isExternalState(input.state)) return denied("operation_rejected");

  const existing = state.rows.get(input.operationId);
  if (existing != null) {
    return { ok: true, inserted: false, reservationId: existing.reservationId };
  }

  await interleave();
  if (state.unavailable) return unready();
  const again = state.rows.get(input.operationId);
  if (again != null) {
    return { ok: true, inserted: false, reservationId: again.reservationId };
  }
  const committedNow = readNow(state.clock);
  const committedDay = committedNow == null ? null : chargeDayOf(committedNow);
  if (committedNow == null || committedDay == null || state.approval == null) {
    return denied("clock_unavailable");
  }

  const reservationId = `res-${state.nextReservation}`;
  state.nextReservation += 1;
  const charged = input.state !== "reserved";
  const row: Row = {
    reservationId,
    operationId: input.operationId,
    approvalId: "external-consumer",
    credentialId: state.approval.credentialId,
    consumer: "external",
    state: input.state,
    fencingToken: null,
    sendToken: null,
    chargeDay: committedDay,
    leaseDeadline: committedNow,
    sendingCommittedAt: charged ? committedNow : null,
    failedReason: input.state === "failed" ? "external_charge" : null,
    createdAt: committedNow,
  };
  state.rows.set(row.operationId, row);
  audit(state, {
    at: committedNow,
    action: "external_charge",
    operationId: row.operationId,
    reservationId,
    reason: input.state,
  });
  return { ok: true, inserted: true, reservationId };
}

function researchOccupancy(state: LedgerState): number {
  let count = 0;
  for (const row of state.rows.values()) {
    if (row.consumer === "pe5" && row.approvalId === state.approvalId && CHARGED.has(row.state)) {
      count += 1;
    }
  }
  return count;
}

function dailyOccupancy(state: LedgerState, chargeDay: string): number {
  if (state.approval == null) return 0;
  let count = 0;
  for (const row of state.rows.values()) {
    if (
      row.credentialId === state.approval.credentialId &&
      row.chargeDay === chargeDay &&
      CHARGED.has(row.state)
    ) {
      count += 1;
    }
  }
  return count;
}

function rateOccupancy(state: LedgerState, now: number): number {
  if (state.approval == null) return 0;
  let count = 0;
  for (const row of state.rows.values()) {
    if (!CHARGED.has(row.state)) continue;
    if (row.state === "reserved" || row.sendingCommittedAt == null) {
      count += 1;
      continue;
    }
    if (now - row.sendingCommittedAt < state.approval.rateWindowMs) count += 1;
  }
  return count;
}

function findByReservation(state: LedgerState, reservationId: string): Row | null {
  for (const row of state.rows.values()) {
    if (row.reservationId === reservationId) return row;
  }
  return null;
}

function viewRow(row: Row): LedgerRowView {
  return {
    reservationId: row.reservationId,
    operationId: row.operationId,
    state: row.state,
    chargeDay: row.chargeDay,
    consumer: row.consumer,
    approvalId: row.approvalId,
    credentialId: row.credentialId,
    leaseDeadline: row.leaseDeadline,
    sendingCommittedAt: row.sendingCommittedAt,
    failedReason: row.failedReason,
  };
}

function viewAudit(entry: Audit): LedgerAuditView {
  return {
    at: entry.at,
    action: entry.action,
    operationId: entry.operationId,
    reservationId: entry.reservationId,
    reason: entry.reason,
  };
}

function audit(state: LedgerState, entry: Audit): void {
  state.audits.push(entry);
}

function denied(denyReason: LedgerDenyReason): { ok: false; reason: "denied"; denyReason: LedgerDenyReason } {
  return { ok: false, reason: "denied", denyReason };
}

function deniedAudit(
  state: LedgerState,
  denyReason: LedgerDenyReason,
  fields: { at?: number; operationId?: string; reservationId?: string } = {},
): { ok: false; reason: "denied"; denyReason: LedgerDenyReason } {
  audit(state, {
    at: fields.at ?? 0,
    action: "denied",
    operationId: fields.operationId,
    reservationId: fields.reservationId,
    reason: denyReason,
  });
  return denied(denyReason);
}

function unready(): { ok: false; reason: "unavailable" } {
  return { ok: false, reason: "unavailable" };
}

function done(result: TryReserveResult): ReserveEvaluation {
  return { kind: "done", result };
}

async function run<T>(ledger: MemoryLedger, body: (state: LedgerState) => Promise<T>): Promise<T> {
  const state = readState(ledger);
  if (state == null) return unready() as T;
  try {
    return await exclusive(state, () => body(state));
  } catch {
    return unready() as T;
  }
}

async function exclusive<T>(state: LedgerState, body: () => Promise<T>): Promise<T> {
  const previous = state.tail;
  let release: () => void = () => {};
  state.tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await body();
  } finally {
    release();
  }
}

async function interleave(): Promise<void> {
  await Promise.resolve();
}

type KillAssessment =
  | { ok: true; kill: { version: number; updatedAt: number; maxAgeMs: number } }
  | {
      ok: false;
      reason: "kill_switch_engaged" | "kill_switch_unreadable" | "kill_switch_stale";
    };

function assessKill(kill: unknown, now: number): KillAssessment {
  if (kill == null) return { ok: false, reason: "kill_switch_engaged" };
  if (!isDataRecord(kill)) return { ok: false, reason: "kill_switch_unreadable" };

  const state = readData(kill, "state");
  if (!state.present || typeof state.value !== "string") {
    return { ok: false, reason: "kill_switch_unreadable" };
  }
  if (state.value === "unreadable") return { ok: false, reason: "kill_switch_unreadable" };
  if (state.value !== "clear") return { ok: false, reason: "kill_switch_engaged" };

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
    kill: { version: version.value, updatedAt: updatedAt.value, maxAgeMs: maxAge.value },
  };
}

function copyKill(record: unknown): unknown {
  if (record == null) return null;
  if (!isDataRecord(record)) return { state: "unreadable" };
  const copy: Record<string, unknown> = {};
  for (const key of ["state", "version", "updatedAt", "maxAgeMs"]) {
    const read = readData(record, key);
    if (read.present) copy[key] = read.value;
  }
  return copy;
}

function parseBoundApproval(
  value: unknown,
): { ok: true; approval: BoundApproval } | { ok: false; deny: "approval_invalid" | "mode_denied" } {
  if (!isDataRecord(value) || hasSecretField(value)) return { ok: false, deny: "approval_invalid" };

  const mode = readData(value, "mode");
  if (!mode.present || typeof mode.value !== "string") return { ok: false, deny: "approval_invalid" };
  if (mode.value === "pilot") return { ok: false, deny: "mode_denied" };
  if (mode.value !== "offline") return { ok: false, deny: "approval_invalid" };

  const credential = readData(value, "credentialId");
  const ledgerId = readData(value, "ledgerInstanceId");
  if (!credential.present || !isIdentity(credential.value)) return { ok: false, deny: "approval_invalid" };
  if (!ledgerId.present || !isIdentity(ledgerId.value)) return { ok: false, deny: "approval_invalid" };

  const ceilings = {} as Record<(typeof CEILING_FIELDS)[number], number>;
  for (const field of CEILING_FIELDS) {
    const read = readData(value, field);
    if (!read.present || !isPositiveCount(read.value)) return { ok: false, deny: "approval_invalid" };
    ceilings[field] = read.value;
  }
  const durations = {} as Record<(typeof DURATION_FIELDS)[number], number>;
  for (const field of DURATION_FIELDS) {
    const read = readData(value, field);
    if (!read.present || !isPositiveMillis(read.value)) return { ok: false, deny: "approval_invalid" };
    durations[field] = read.value;
  }
  if (durations.leaseMs <= durations.fetchTimeoutMs) return { ok: false, deny: "approval_invalid" };

  const expiry = readData(value, "expiry");
  if (!expiry.present || !isEpochMillis(expiry.value)) return { ok: false, deny: "approval_invalid" };

  return {
    ok: true,
    approval: {
      mode: "offline",
      credentialId: credential.value,
      ledgerInstanceId: ledgerId.value,
      researchCeiling: ceilings.researchCeiling,
      dailyCeiling: ceilings.dailyCeiling,
      rateCeiling: ceilings.rateCeiling,
      rateWindowMs: durations.rateWindowMs,
      leaseMs: durations.leaseMs,
      fetchTimeoutMs: durations.fetchTimeoutMs,
      maxAgeMs: durations.maxAgeMs,
      expiry: expiry.value,
    },
  };
}

function readSuppliedFlags(value: unknown): ProtocolFlagSnapshot | null {
  if (!isDataRecord(value)) return null;
  const snapshot = {} as { -readonly [Key in ProtocolFlagKey]: boolean };
  for (const key of PROTOCOL_FLAG_KEYS) {
    const read = readData(value, key);
    if (!read.present || typeof read.value !== "boolean") return null;
    snapshot[key] = read.value;
  }
  return snapshot;
}

function readState(ledger: MemoryLedger): LedgerState | null {
  if (ledger == null || ledger.kind !== "pe5-memory-ledger") return null;
  const holder = ledger as unknown as Record<symbol, unknown>;
  const value = holder[STATE_KEY];
  if (!isDataRecord(value)) return null;
  const kind = readData(value, "kind");
  if (!kind.present || kind.value !== STATE_KIND) return null;
  return value as LedgerState;
}

function isClock(value: unknown): value is LedgerClock {
  if (!isDataRecord(value)) return false;
  const now = readData(value, "now");
  return now.present && typeof now.value === "function";
}

function readNow(clock: LedgerClock | null): number | null {
  if (clock == null) return null;
  let value: unknown;
  try {
    value = clock.now();
  } catch {
    return null;
  }
  if (!isEpochMillis(value)) return null;
  if (Math.abs(value) > 8_640_000_000_000_000) return null;
  return value;
}

function chargeDayOf(epochMs: number): string | null {
  try {
    const day = new Date(epochMs).toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  } catch {
    return null;
  }
}

function isExternalState(value: string): value is ExternalChargeInput["state"] {
  return value === "reserved" || value === "sending" || value === "consumed" || value === "failed";
}

function isReasonCode(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value);
}

function isFresh(updatedAt: number, now: number, maxAgeMs: number): boolean {
  if (updatedAt > now) return false;
  const age = now - updatedAt;
  return Number.isSafeInteger(age) && age <= maxAgeMs;
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

function inputOrBlank(input: TryReserveInput): string | undefined {
  return typeof input.operationId === "string" ? input.operationId : undefined;
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
