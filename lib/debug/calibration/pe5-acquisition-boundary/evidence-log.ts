/**
 * PE-5.4C increment 8 stage 2A — offline in-process evidence log.
 *
 * One canonical snapshot per operationId. State is kept in a module-private
 * WeakMap. A copied shell, prototype wrapper, or proxy is not that log.
 * The private registry is not shared with a re-evaluated copy of this module.
 *
 * This log does not reserve quota, record a ledger outcome, open a socket,
 * or store raw body bytes. A confirmed append is visible to a later read on
 * this same genuine instance. It does not survive process exit and it does
 * not prove that some other caller of the ledger appended evidence.
 *
 * An `ambiguous` result is not success, not an attested failure, and not
 * proof that a record is absent. Reconciliation is a later read.
 */

import { types } from "node:util";

import { isRegisteredMemoryLedger } from "@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger";
import { PE5_NORMALIZE_REASONS } from "@/lib/debug/calibration/pe5-acquisition-boundary/normalize";
import {
  PE5_EVIDENCE_CLASSES,
  PE5_FAIL_REASONS,
  type Pe5EvidenceClass,
  type Pe5FailReason,
} from "@/lib/debug/calibration/pe5-availability/protocol";
import type { Pe5NormalizeReason } from "@/lib/debug/calibration/pe5-acquisition-boundary/normalize";

export const PE5_4C_EVIDENCE_LOG_LIMIT = {
  durability: "in-process-only",
  visibility: "same-genuine-instance-only",
  atomicity: "single-process-serialized-queue",
  diskPersistence: false,
  processSurvival: false,
  crossProcessConsistency: false,
  crashRecovery: false,
  directLedgerCallerGuarantee: false,
  productionReady: false,
} as const;

export const EVIDENCE_LOG_REASONS = [
  "evidence_conflict",
  "evidence_missing",
  "invalid_digest",
  "operation_rejected",
  "unavailable",
  "ambiguous",
] as const;

export type EvidenceLogReason = (typeof EVIDENCE_LOG_REASONS)[number];

export const EVIDENCE_AUDIT_ACTIONS = [
  "append",
  "append_duplicate",
  "append_rejected",
  "ack_withheld",
  "read",
  "read_unattested",
] as const;

export type EvidenceAuditAction = (typeof EVIDENCE_AUDIT_ACTIONS)[number];

export type EvidenceLog = {
  readonly kind: "pe5-evidence-log";
};

type LineupObservation = {
  readonly endpoint: "lineups";
  readonly fixtureId: string;
  readonly observation: "present" | "missing";
  readonly observedValue: number | null;
  readonly absenceMeansAvailable: false;
  readonly availabilityInference: "forbidden";
  readonly startXiCount: number | null;
  readonly substituteCount: number | null;
};

type InjuryObservation = {
  readonly endpoint: "injuries";
  readonly fixtureId: string;
  readonly observation: "present" | "missing";
  readonly observedValue: number | null;
  readonly absenceMeansAvailable: false;
  readonly availabilityInference: "forbidden";
  readonly injuryRecordCount: number | null;
};

export type EvidenceObservation = LineupObservation | InjuryObservation;

export type EvidenceDecisionView = {
  readonly ok: boolean;
  readonly evidenceClass: Pe5EvidenceClass;
  readonly reason: Pe5FailReason | "classified";
  readonly targetPrematchEligible: boolean;
  readonly laterTargetHistoryEligible: boolean;
  readonly numericValue: null;
  readonly retainedObservation: number | null;
  readonly availability: "classified" | "unavailable";
  readonly zeroFilled: false;
};

export type EvidenceClassificationView =
  | {
      readonly status: "skipped";
      readonly reason: "capture_timestamp_unverified" | "missing_capture_timestamp";
    }
  | {
      readonly status: "classified";
      readonly provenance: "prospective_snapshot" | null;
      readonly decision: EvidenceDecisionView;
    };

type RecordBase = {
  readonly operationId: string;
  readonly evidenceId: string;
  readonly reservationId: string;
  readonly envelopeId: string;
  readonly contentDigest: string;
  readonly capturedAtUtc: string | null;
  readonly captureTimestampVerified: boolean;
  readonly ledgerInstanceId: string | null;
  readonly approvalId: string | null;
};

export type EvidenceRecordView =
  | (RecordBase & {
      readonly normalizationStatus: "normalized";
      readonly observation: EvidenceObservation;
      readonly classification: EvidenceClassificationView;
    })
  | (RecordBase & {
      readonly normalizationStatus: "rejected";
      readonly normalizationReason: Pe5NormalizeReason;
    });

export type AppendEvidenceResult =
  | { readonly ok: true; readonly duplicate: boolean; readonly record: EvidenceRecordView }
  | { readonly ok: false; readonly reason: EvidenceLogReason };

export type ReadEvidenceResult =
  | { readonly ok: true; readonly record: EvidenceRecordView }
  | { readonly ok: false; readonly reason: EvidenceLogReason };

export type EvidenceLogAudit = {
  readonly action: EvidenceAuditAction;
  readonly operationId?: string;
  readonly reservationId?: string;
  readonly evidenceId?: string;
  readonly reason?: string;
};

type Snapshot = EvidenceRecordView;

type AuditEntry = {
  action: EvidenceAuditAction;
  operationId?: string;
  reservationId?: string;
  evidenceId?: string;
  reason?: string;
};

type Binding = {
  readonly ledgerInstanceId: string;
  readonly approvalId: string;
};

type LogState = {
  readonly kind: "pe5-evidence-log-state";
  readonly binding: Binding | null;
  closed: "unavailable" | null;
  readonly records: Map<string, Snapshot>;
  tail: Promise<void>;
  unavailable: boolean;
  loseNextAck: boolean;
  failNext: boolean;
  ambiguousNextRead: boolean;
  audits: AuditEntry[];
};

const STATE_KIND = "pe5-evidence-log-state" as const;
const LOGS = new WeakMap<object, LogState>();

const OPERATION_ID = /^[0-9a-f]{64}$/;
const RESERVATION_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const CAPTURE_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;
const DIGEST = /^[0-9a-f]{64}$/;

const NORMALIZE_REASONS = new Set<string>(PE5_NORMALIZE_REASONS);
const EVIDENCE_CLASSES = new Set<string>(PE5_EVIDENCE_CLASSES);
const FAIL_REASONS = new Set<string>(PE5_FAIL_REASONS);
const AUDIT_REASONS = new Set<string>([
  ...EVIDENCE_LOG_REASONS,
  ...PE5_NORMALIZE_REASONS,
  ...PE5_FAIL_REASONS,
  "classified",
]);

const CONFIG_KEYS = new Set(["ledger"]);
const APPEND_KEYS = new Set([
  "operationId",
  "envelopeId",
  "evidenceId",
  "reservationId",
  "contentDigest",
  "capturedAtUtc",
  "captureTimestampVerified",
  "normalizationStatus",
  "normalizationReason",
  "observation",
  "classification",
]);
const LINEUP_KEYS = new Set([
  "endpoint",
  "fixtureId",
  "observation",
  "observedValue",
  "absenceMeansAvailable",
  "availabilityInference",
  "startXiCount",
  "substituteCount",
]);
const INJURY_KEYS = new Set([
  "endpoint",
  "fixtureId",
  "observation",
  "observedValue",
  "absenceMeansAvailable",
  "availabilityInference",
  "injuryRecordCount",
]);
const CLASSIFICATION_KEYS = new Set(["status", "reason", "decision", "provenance"]);
const DECISION_KEYS = new Set([
  "ok",
  "evidenceClass",
  "reason",
  "targetPrematchEligible",
  "laterTargetHistoryEligible",
  "numericValue",
  "retainedObservation",
  "availability",
  "zeroFilled",
]);
const READ_KEYS = new Set(["operationId", "evidenceId"]);

type OwnRead =
  | { readonly state: "missing" }
  | { readonly state: "unsafe" }
  | { readonly state: "value"; readonly value: unknown };

type Parsed =
  | { readonly ok: true; readonly snapshot: Snapshot }
  | { readonly ok: false; readonly reason: EvidenceLogReason };

export function createEvidenceLog(config: unknown): EvidenceLog {
  const parsed = parseConfig(config);
  const state: LogState = {
    kind: STATE_KIND,
    binding: parsed.binding,
    closed: parsed.closed,
    records: new Map(),
    tail: Promise.resolve(),
    unavailable: false,
    loseNextAck: false,
    failNext: false,
    ambiguousNextRead: false,
    audits: [],
  };
  const log: EvidenceLog = { kind: "pe5-evidence-log" };
  LOGS.set(log, state);
  return Object.freeze(log);
}

/** True only for the instance registered by `createEvidenceLog`. */
export function isRegisteredEvidenceLog(value: unknown): value is EvidenceLog {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    if (types.isProxy(value) === true) return false;
    return LOGS.has(value);
  } catch {
    return false;
  }
}

export async function appendEvidence(
  log: EvidenceLog,
  input: unknown,
): Promise<AppendEvidenceResult> {
  const parsed = parseAppend(input);
  if (!parsed.ok) return fail(parsed.reason);
  return enqueue(log, (state) => commitAppend(state, parsed.snapshot), () => fail("unavailable"));
}

export async function readEvidence(
  log: EvidenceLog,
  query: unknown,
): Promise<ReadEvidenceResult> {
  const parsed = parseRead(query);
  if (!parsed.ok) return fail(parsed.reason);
  return enqueue(log, (state) => commitRead(state, parsed.operationId), () => fail("unavailable"));
}

export async function readEvidenceAudit(
  log: EvidenceLog,
): Promise<
  { readonly ok: true; readonly audits: readonly EvidenceLogAudit[] } | { readonly ok: false; readonly reason: "unavailable" }
> {
  return enqueue(
    log,
    async (state) => {
      if (state.closed === "unavailable" || state.unavailable) return fail("unavailable");
      return Object.freeze({
        ok: true as const,
        audits: Object.freeze(state.audits.map(viewAudit)),
      });
    },
    () => fail("unavailable"),
  );
}

/** Simulator control. Not a durable-store fault. */
export async function setEvidenceLogUnavailable(
  log: EvidenceLog,
  unavailable: boolean,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return enqueue(
    log,
    async (state) => {
      if (state.closed === "unavailable") return fail("unavailable");
      if (typeof unavailable !== "boolean") return fail("unavailable");
      state.unavailable = unavailable;
      return Object.freeze({ ok: true as const });
    },
    () => fail("unavailable"),
  );
}

/** Next new append fails before any record becomes visible. */
export async function armEvidenceAppendFailure(
  log: EvidenceLog,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return arm(log, (state) => {
    state.failNext = true;
  });
}

/** Next new append commits, then withholds the acknowledgement. */
export async function armLostEvidenceAcknowledgement(
  log: EvidenceLog,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return arm(log, (state) => {
    state.loseNextAck = true;
  });
}

/** Next read is ambiguous and is not evidence that a record is absent. */
export async function armAmbiguousEvidenceRead(
  log: EvidenceLog,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return arm(log, (state) => {
    state.ambiguousNextRead = true;
  });
}

function commitAppend(state: LogState, incoming: Snapshot): AppendEvidenceResult {
  if (state.closed === "unavailable" || state.unavailable) return fail("unavailable");
  const snapshot = stamp(state, incoming);
  const existing = state.records.get(snapshot.operationId);
  if (existing != null) return duplicateOrConflict(state, existing, snapshot);

  if (state.failNext) {
    state.failNext = false;
    audit(state, {
      action: "append_rejected",
      operationId: snapshot.operationId,
      reservationId: snapshot.reservationId,
      evidenceId: snapshot.evidenceId,
      reason: "evidence_missing",
    });
    return fail("evidence_missing");
  }

  state.records.set(snapshot.operationId, snapshot);
  audit(state, {
    action: "append",
    operationId: snapshot.operationId,
    reservationId: snapshot.reservationId,
    evidenceId: snapshot.evidenceId,
    reason: auditReason(snapshot),
  });

  if (state.loseNextAck) {
    state.loseNextAck = false;
    audit(state, {
      action: "ack_withheld",
      operationId: snapshot.operationId,
      reservationId: snapshot.reservationId,
      evidenceId: snapshot.evidenceId,
      reason: "ambiguous",
    });
    return fail("ambiguous");
  }

  return Object.freeze({
    ok: true as const,
    duplicate: false as const,
    record: view(snapshot),
  });
}

function duplicateOrConflict(
  state: LogState,
  existing: Snapshot,
  incoming: Snapshot,
): AppendEvidenceResult {
  if (sameSnapshot(existing, incoming)) {
    audit(state, {
      action: "append_duplicate",
      operationId: existing.operationId,
      reservationId: existing.reservationId,
      evidenceId: existing.evidenceId,
    });
    return Object.freeze({
      ok: true as const,
      duplicate: true as const,
      record: view(existing),
    });
  }
  audit(state, {
    action: "append_rejected",
    operationId: existing.operationId,
    reservationId: existing.reservationId,
    evidenceId: existing.evidenceId,
    reason: "evidence_conflict",
  });
  return fail("evidence_conflict");
}

function commitRead(state: LogState, operationId: string): ReadEvidenceResult {
  if (state.closed === "unavailable" || state.unavailable) return fail("unavailable");
  if (state.ambiguousNextRead) {
    state.ambiguousNextRead = false;
    audit(state, { action: "read_unattested", operationId, reason: "ambiguous" });
    return fail("ambiguous");
  }
  const record = state.records.get(operationId);
  if (record == null) {
    audit(state, {
      action: "read",
      operationId,
      reason: "evidence_missing",
    });
    return fail("evidence_missing");
  }
  audit(state, {
    action: "read",
    operationId: record.operationId,
    reservationId: record.reservationId,
    evidenceId: record.evidenceId,
  });
  return Object.freeze({ ok: true as const, record: view(record) });
}

function stamp(state: LogState, snapshot: Snapshot): Snapshot {
  const ledgerInstanceId = state.binding?.ledgerInstanceId ?? null;
  const approvalId = state.binding?.approvalId ?? null;
  if (snapshot.normalizationStatus === "rejected") {
    return {
      operationId: snapshot.operationId,
      evidenceId: snapshot.evidenceId,
      reservationId: snapshot.reservationId,
      envelopeId: snapshot.envelopeId,
      contentDigest: snapshot.contentDigest,
      capturedAtUtc: snapshot.capturedAtUtc,
      captureTimestampVerified: snapshot.captureTimestampVerified,
      ledgerInstanceId,
      approvalId,
      normalizationStatus: "rejected",
      normalizationReason: snapshot.normalizationReason,
    };
  }
  return {
    operationId: snapshot.operationId,
    evidenceId: snapshot.evidenceId,
    reservationId: snapshot.reservationId,
    envelopeId: snapshot.envelopeId,
    contentDigest: snapshot.contentDigest,
    capturedAtUtc: snapshot.capturedAtUtc,
    captureTimestampVerified: snapshot.captureTimestampVerified,
    ledgerInstanceId,
    approvalId,
    normalizationStatus: "normalized",
    observation: snapshot.observation,
    classification: snapshot.classification,
  };
}

function auditReason(snapshot: Snapshot): string {
  if (snapshot.normalizationStatus === "rejected") return snapshot.normalizationReason;
  if (snapshot.classification.status === "skipped") return snapshot.classification.reason;
  return snapshot.classification.decision.reason;
}

function sameSnapshot(left: Snapshot, right: Snapshot): boolean {
  if (!sameIdentity(left, right)) return false;
  if (left.normalizationStatus !== right.normalizationStatus) return false;
  if (left.normalizationStatus === "rejected" && right.normalizationStatus === "rejected") {
    return left.normalizationReason === right.normalizationReason;
  }
  if (left.normalizationStatus === "normalized" && right.normalizationStatus === "normalized") {
    return sameObservation(left.observation, right.observation) && sameClassification(left.classification, right.classification);
  }
  return false;
}

function sameIdentity(left: RecordBase, right: RecordBase): boolean {
  return (
    left.operationId === right.operationId &&
    left.evidenceId === right.evidenceId &&
    left.reservationId === right.reservationId &&
    left.envelopeId === right.envelopeId &&
    left.contentDigest === right.contentDigest &&
    left.capturedAtUtc === right.capturedAtUtc &&
    left.captureTimestampVerified === right.captureTimestampVerified &&
    left.ledgerInstanceId === right.ledgerInstanceId &&
    left.approvalId === right.approvalId
  );
}

function sameObservation(left: EvidenceObservation, right: EvidenceObservation): boolean {
  if (left.endpoint !== right.endpoint) return false;
  if (left.fixtureId !== right.fixtureId) return false;
  if (left.observation !== right.observation) return false;
  if (left.observedValue !== right.observedValue) return false;
  if (left.absenceMeansAvailable !== right.absenceMeansAvailable) return false;
  if (left.availabilityInference !== right.availabilityInference) return false;
  if (left.endpoint === "lineups" && right.endpoint === "lineups") {
    return left.startXiCount === right.startXiCount && left.substituteCount === right.substituteCount;
  }
  if (left.endpoint === "injuries" && right.endpoint === "injuries") {
    return left.injuryRecordCount === right.injuryRecordCount;
  }
  return false;
}

function sameClassification(left: EvidenceClassificationView, right: EvidenceClassificationView): boolean {
  if (left.status !== right.status) return false;
  if (left.status === "skipped" && right.status === "skipped") return left.reason === right.reason;
  if (left.status === "classified" && right.status === "classified") {
    return left.provenance === right.provenance && sameDecision(left.decision, right.decision);
  }
  return false;
}

function sameDecision(left: EvidenceDecisionView, right: EvidenceDecisionView): boolean {
  return (
    left.ok === right.ok &&
    left.evidenceClass === right.evidenceClass &&
    left.reason === right.reason &&
    left.targetPrematchEligible === right.targetPrematchEligible &&
    left.laterTargetHistoryEligible === right.laterTargetHistoryEligible &&
    left.numericValue === right.numericValue &&
    left.retainedObservation === right.retainedObservation &&
    left.availability === right.availability &&
    left.zeroFilled === right.zeroFilled
  );
}

function view(snapshot: Snapshot): EvidenceRecordView {
  if (snapshot.normalizationStatus === "rejected") {
    return Object.freeze({
      operationId: snapshot.operationId,
      evidenceId: snapshot.evidenceId,
      reservationId: snapshot.reservationId,
      envelopeId: snapshot.envelopeId,
      contentDigest: snapshot.contentDigest,
      capturedAtUtc: snapshot.capturedAtUtc,
      captureTimestampVerified: snapshot.captureTimestampVerified,
      ledgerInstanceId: snapshot.ledgerInstanceId,
      approvalId: snapshot.approvalId,
      normalizationStatus: "rejected" as const,
      normalizationReason: snapshot.normalizationReason,
    });
  }
  return Object.freeze({
    operationId: snapshot.operationId,
    evidenceId: snapshot.evidenceId,
    reservationId: snapshot.reservationId,
    envelopeId: snapshot.envelopeId,
    contentDigest: snapshot.contentDigest,
    capturedAtUtc: snapshot.capturedAtUtc,
    captureTimestampVerified: snapshot.captureTimestampVerified,
    ledgerInstanceId: snapshot.ledgerInstanceId,
    approvalId: snapshot.approvalId,
    normalizationStatus: "normalized" as const,
    observation: copyObservation(snapshot.observation),
    classification: copyClassification(snapshot.classification),
  });
}

function copyObservation(observation: EvidenceObservation): EvidenceObservation {
  if (observation.endpoint === "lineups") {
    return Object.freeze({
      endpoint: "lineups" as const,
      fixtureId: observation.fixtureId,
      observation: observation.observation,
      observedValue: observation.observedValue,
      absenceMeansAvailable: false as const,
      availabilityInference: "forbidden" as const,
      startXiCount: observation.startXiCount,
      substituteCount: observation.substituteCount,
    });
  }
  return Object.freeze({
    endpoint: "injuries" as const,
    fixtureId: observation.fixtureId,
    observation: observation.observation,
    observedValue: observation.observedValue,
    absenceMeansAvailable: false as const,
    availabilityInference: "forbidden" as const,
    injuryRecordCount: observation.injuryRecordCount,
  });
}

function copyClassification(classification: EvidenceClassificationView): EvidenceClassificationView {
  if (classification.status === "skipped") {
    return Object.freeze({
      status: "skipped" as const,
      reason: classification.reason,
    });
  }
  return Object.freeze({
    status: "classified" as const,
    provenance: classification.provenance,
    decision: Object.freeze({
      ok: classification.decision.ok,
      evidenceClass: classification.decision.evidenceClass,
      reason: classification.decision.reason,
      targetPrematchEligible: classification.decision.targetPrematchEligible,
      laterTargetHistoryEligible: classification.decision.laterTargetHistoryEligible,
      numericValue: null,
      retainedObservation: classification.decision.retainedObservation,
      availability: classification.decision.availability,
      zeroFilled: false as const,
    }),
  });
}

function viewAudit(entry: AuditEntry): EvidenceLogAudit {
  const copy: {
    action: EvidenceAuditAction;
    operationId?: string;
    reservationId?: string;
    evidenceId?: string;
    reason?: string;
  } = { action: entry.action };
  if (entry.operationId != null) copy.operationId = entry.operationId;
  if (entry.reservationId != null) copy.reservationId = entry.reservationId;
  if (entry.evidenceId != null) copy.evidenceId = entry.evidenceId;
  if (entry.reason != null) copy.reason = entry.reason;
  return Object.freeze(copy);
}

function parseConfig(config: unknown): { closed: "unavailable" | null; binding: Binding | null } {
  if (!isSafeObject(config) || hasOwnSymbols(config)) {
    return { closed: "unavailable", binding: null };
  }
  const names = ownNames(config);
  if (names == null) return { closed: "unavailable", binding: null };
  for (const name of names) {
    if (!CONFIG_KEYS.has(name)) return { closed: "unavailable", binding: null };
    if (readOwn(config, name).state === "unsafe") return { closed: "unavailable", binding: null };
  }
  if (!names.includes("ledger")) return { closed: null, binding: null };
  const ledger = readOwn(config, "ledger");
  if (ledger.state !== "value" || !isRegisteredMemoryLedger(ledger.value)) {
    return { closed: "unavailable", binding: null };
  }
  const instanceId = readOwn(ledger.value, "instanceId");
  const approvalId = readOwn(ledger.value, "approvalId");
  const generation = readOwn(ledger.value, "generation");
  const regeneration = readOwn(ledger.value, "allowRegeneration");
  const kind = readOwn(ledger.value, "kind");
  if (
    instanceId.state !== "value" ||
    approvalId.state !== "value" ||
    generation.state !== "value" ||
    regeneration.state !== "value" ||
    kind.state !== "value" ||
    kind.value !== "pe5-memory-ledger" ||
    generation.value !== 0 ||
    regeneration.value !== false ||
    !isPublicId(instanceId.value) ||
    !isPublicId(approvalId.value)
  ) {
    return { closed: "unavailable", binding: null };
  }
  return {
    closed: null,
    binding: { ledgerInstanceId: instanceId.value, approvalId: approvalId.value },
  };
}

function parseAppend(input: unknown): Parsed {
  const fields = readFields(input, APPEND_KEYS);
  if (fields == null) return fail("operation_rejected");

  const operationId = fields.get("operationId");
  const envelopeId = fields.get("envelopeId");
  const evidenceId = fields.get("evidenceId");
  const reservationId = fields.get("reservationId");
  if (
    !isOperationId(operationId) ||
    !isReservationId(reservationId) ||
    typeof envelopeId !== "string" ||
    typeof evidenceId !== "string" ||
    evidenceId !== envelopeId ||
    envelopeId !== `env-${operationId}`
  ) {
    return fail("operation_rejected");
  }

  const contentDigest = fields.get("contentDigest");
  if (typeof contentDigest !== "string" || !DIGEST.test(contentDigest)) return fail("invalid_digest");

  if (!fields.has("capturedAtUtc") || !fields.has("captureTimestampVerified")) {
    return fail("operation_rejected");
  }
  const captured = readClock(fields.get("capturedAtUtc"), fields.get("captureTimestampVerified"));
  if (captured == null) return fail("operation_rejected");

  const status = fields.get("normalizationStatus");
  if (status === "rejected") {
    if (fields.has("observation") || fields.has("classification")) return fail("operation_rejected");
    const reason = fields.get("normalizationReason");
    if (!isNormalizeReason(reason)) return fail("operation_rejected");
    return {
      ok: true,
      snapshot: {
        operationId,
        evidenceId,
        reservationId,
        envelopeId,
        contentDigest,
        capturedAtUtc: captured.capturedAtUtc,
        captureTimestampVerified: captured.captureTimestampVerified,
        ledgerInstanceId: null,
        approvalId: null,
        normalizationStatus: "rejected",
        normalizationReason: reason,
      },
    };
  }

  if (status !== "normalized") return fail("operation_rejected");
  if (fields.has("normalizationReason") || !fields.has("observation") || !fields.has("classification")) {
    return fail("operation_rejected");
  }
  const observation = parseObservation(fields.get("observation"));
  if (observation == null) return fail("operation_rejected");
  const classification = parseClassification(
    fields.get("classification"),
    captured,
    observation,
  );
  if (classification == null) return fail("operation_rejected");

  return {
    ok: true,
    snapshot: {
      operationId,
      evidenceId,
      reservationId,
      envelopeId,
      contentDigest,
      capturedAtUtc: captured.capturedAtUtc,
      captureTimestampVerified: captured.captureTimestampVerified,
      ledgerInstanceId: null,
      approvalId: null,
      normalizationStatus: "normalized",
      observation,
      classification,
    },
  };
}

function parseRead(
  query: unknown,
): { ok: true; operationId: string } | { ok: false; reason: "operation_rejected" } {
  const fields = readFields(query, READ_KEYS);
  if (fields == null || fields.size === 0) return fail("operation_rejected");
  const operationId = fields.get("operationId");
  const evidenceId = fields.get("evidenceId");
  if (operationId != null && !isOperationId(operationId)) return fail("operation_rejected");
  if (evidenceId != null && (typeof evidenceId !== "string" || !isEvidenceId(evidenceId))) {
    return fail("operation_rejected");
  }
  if (isOperationId(operationId) && typeof evidenceId === "string" && evidenceId !== `env-${operationId}`) {
    return fail("operation_rejected");
  }
  if (isOperationId(operationId)) return { ok: true, operationId };
  if (typeof evidenceId === "string" && isEvidenceId(evidenceId)) {
    return { ok: true, operationId: evidenceId.slice(4) };
  }
  return fail("operation_rejected");
}

function parseObservation(value: unknown): EvidenceObservation | null {
  if (!isSafeObject(value)) return null;
  const endpoint = readOwn(value, "endpoint");
  if (endpoint.state !== "value") return null;
  const allowed = endpoint.value === "lineups" ? LINEUP_KEYS : endpoint.value === "injuries" ? INJURY_KEYS : null;
  if (allowed == null) return null;
  const fields = readFields(value, allowed);
  if (fields == null) return null;
  for (const key of allowed) {
    if (!fields.has(key)) return null;
  }
  const fixtureId = fields.get("fixtureId");
  const observation = fields.get("observation");
  const observedValue = fields.get("observedValue");
  if (!isFixtureId(fixtureId)) return null;
  if (observation !== "present" && observation !== "missing") return null;
  if (fields.get("absenceMeansAvailable") !== false) return null;
  if (fields.get("availabilityInference") !== "forbidden") return null;
  if (observation === "missing") {
    if (observedValue !== null) return null;
  } else if (!isCount(observedValue)) {
    return null;
  }

  if (endpoint.value === "lineups") {
    const startXiCount = fields.get("startXiCount");
    const substituteCount = fields.get("substituteCount");
    if (observation === "missing") {
      if (startXiCount !== null || substituteCount !== null) return null;
      return {
        endpoint: "lineups",
        fixtureId,
        observation: "missing",
        observedValue: null,
        absenceMeansAvailable: false,
        availabilityInference: "forbidden",
        startXiCount: null,
        substituteCount: null,
      };
    }
    if (!isCount(observedValue) || !isCount(startXiCount) || startXiCount !== observedValue || !isCount(substituteCount)) {
      return null;
    }
    return {
      endpoint: "lineups",
      fixtureId,
      observation: "present",
      observedValue,
      absenceMeansAvailable: false,
      availabilityInference: "forbidden",
      startXiCount,
      substituteCount,
    };
  }

  const injuryRecordCount = fields.get("injuryRecordCount");
  if (observation === "missing") {
    if (injuryRecordCount !== null) return null;
    return {
      endpoint: "injuries",
      fixtureId,
      observation: "missing",
      observedValue: null,
      absenceMeansAvailable: false,
      availabilityInference: "forbidden",
      injuryRecordCount: null,
    };
  }
  if (!isPositiveCount(observedValue) || !isPositiveCount(injuryRecordCount) || injuryRecordCount !== observedValue) {
    return null;
  }
  return {
    endpoint: "injuries",
    fixtureId,
    observation: "present",
    observedValue,
    absenceMeansAvailable: false,
    availabilityInference: "forbidden",
    injuryRecordCount,
  };
}

function parseClassification(
  value: unknown,
  clock: { capturedAtUtc: string | null; captureTimestampVerified: boolean },
  observation: EvidenceObservation,
): EvidenceClassificationView | null {
  const fields = readFields(value, CLASSIFICATION_KEYS);
  if (fields == null || !fields.has("status")) return null;
  const clockSkipped = clock.capturedAtUtc == null || clock.captureTimestampVerified !== true;
  const status = fields.get("status");

  if (status === "skipped") {
    if (!clockSkipped) return null;
    if (fields.has("decision") || fields.has("provenance")) return null;
    const reason = fields.get("reason");
    const expected = clock.capturedAtUtc == null ? "missing_capture_timestamp" : "capture_timestamp_unverified";
    if (reason !== expected) return null;
    return { status: "skipped", reason: expected };
  }

  if (status !== "classified" || clockSkipped) return null;
  if (fields.has("reason")) return null;
  const provenance = readProvenance(fields);
  if (provenance === "rejected") return null;
  const decision = parseDecision(fields.get("decision"), observation);
  if (decision == null) return null;
  if (decision.ok === true && provenance !== "prospective_snapshot") return null;
  return { status: "classified", provenance, decision };
}

function readProvenance(fields: ReadonlyMap<string, unknown>): "prospective_snapshot" | null | "rejected" {
  if (!fields.has("provenance")) return null;
  const provenance = fields.get("provenance");
  if (provenance === "prospective_snapshot") return provenance;
  return "rejected";
}

function parseDecision(value: unknown, observation: EvidenceObservation): EvidenceDecisionView | null {
  const fields = readFields(value, DECISION_KEYS);
  if (fields == null) return null;
  for (const key of DECISION_KEYS) {
    if (!fields.has(key)) return null;
  }
  const ok = fields.get("ok");
  const evidenceClass = fields.get("evidenceClass");
  const reason = fields.get("reason");
  const targetPrematchEligible = fields.get("targetPrematchEligible");
  const laterTargetHistoryEligible = fields.get("laterTargetHistoryEligible");
  const numericValue = fields.get("numericValue");
  const retainedObservation = fields.get("retainedObservation");
  const availability = fields.get("availability");
  const zeroFilled = fields.get("zeroFilled");
  if (typeof ok !== "boolean") return null;
  if (!isEvidenceClass(evidenceClass)) return null;
  if (numericValue !== null || zeroFilled !== false) return null;
  if (typeof targetPrematchEligible !== "boolean" || typeof laterTargetHistoryEligible !== "boolean") {
    return null;
  }

  if (ok === true) {
    if (reason !== "classified") return null;
    if (evidenceClass !== "PROSPECTIVE_PREMATCH_SNAPSHOT") return null;
    if (availability !== "classified") return null;
    if (observation.observation !== "present" || !isCount(observation.observedValue)) return null;
    if (!isCount(retainedObservation) || retainedObservation !== observation.observedValue) return null;
    if (targetPrematchEligible === laterTargetHistoryEligible) return null;
    return {
      ok: true,
      evidenceClass,
      reason: "classified",
      targetPrematchEligible,
      laterTargetHistoryEligible,
      numericValue: null,
      retainedObservation,
      availability: "classified",
      zeroFilled: false,
    };
  }

  if (!isFailReason(reason)) return null;
  if (evidenceClass === "PROSPECTIVE_PREMATCH_SNAPSHOT") return null;
  if (availability !== "unavailable") return null;
  if (targetPrematchEligible !== false || laterTargetHistoryEligible !== false) return null;
  if (retainedObservation !== null) return null;
  return {
    ok: false,
    evidenceClass,
    reason,
    targetPrematchEligible: false,
    laterTargetHistoryEligible: false,
    numericValue: null,
    retainedObservation: null,
    availability: "unavailable",
    zeroFilled: false,
  };
}

function readClock(
  capturedAtUtc: unknown,
  captureTimestampVerified: unknown,
): { capturedAtUtc: string | null; captureTimestampVerified: boolean } | null {
  if (typeof captureTimestampVerified !== "boolean") return null;
  if (capturedAtUtc === null) {
    return { capturedAtUtc: null, captureTimestampVerified };
  }
  if (typeof capturedAtUtc !== "string" || !isCaptureUtc(capturedAtUtc)) return null;
  return { capturedAtUtc, captureTimestampVerified };
}

function isCaptureUtc(value: string): boolean {
  const match = CAPTURE_UTC.exec(value);
  if (match == null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number(match[7]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    millisecond > 999
  ) {
    return false;
  }
  const instant = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  if (!Number.isSafeInteger(instant) || instant < 0) return false;
  const roundTrip = new Date(instant);
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day &&
    roundTrip.getUTCHours() === hour &&
    roundTrip.getUTCMinutes() === minute &&
    roundTrip.getUTCSeconds() === second &&
    roundTrip.getUTCMilliseconds() === millisecond
  );
}

function readFields(value: unknown, allowed: ReadonlySet<string>): Map<string, unknown> | null {
  if (!isSafeObject(value) || hasOwnSymbols(value)) return null;
  const names = ownNames(value);
  if (names == null) return null;
  const fields = new Map<string, unknown>();
  for (const name of names) {
    if (!allowed.has(name)) return null;
    const read = readOwn(value, name);
    if (read.state !== "value") return null;
    fields.set(name, read.value);
  }
  return fields;
}

async function arm(
  log: EvidenceLog,
  apply: (state: LogState) => void,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "unavailable" }> {
  return enqueue(
    log,
    async (state) => {
      if (state.closed === "unavailable" || state.unavailable) return fail("unavailable");
      apply(state);
      return Object.freeze({ ok: true as const });
    },
    () => fail("unavailable"),
  );
}

async function enqueue<T>(
  log: EvidenceLog,
  body: (state: LogState) => Promise<T> | T,
  unavailable: () => T,
): Promise<T> {
  let state: LogState | null;
  try {
    state = readState(log);
  } catch {
    return unavailable();
  }
  if (state == null) return unavailable();
  const previous = state.tail;
  let release: () => void = () => {};
  state.tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await body(state);
  } catch {
    return unavailable();
  } finally {
    release();
  }
}

function readState(log: unknown): LogState | null {
  try {
    if (typeof log !== "object" || log === null || Array.isArray(log)) return null;
    if (types.isProxy(log) === true) return null;
    if (!LOGS.has(log)) return null;
    const state = LOGS.get(log);
    if (state == null || state.kind !== STATE_KIND) return null;
    const kind = readOwn(log, "kind");
    if (kind.state !== "value" || kind.value !== "pe5-evidence-log") return null;
    return state;
  } catch {
    return null;
  }
}

function audit(state: LogState, entry: AuditEntry): void {
  if (entry.reason != null && !AUDIT_REASONS.has(entry.reason)) return;
  state.audits.push(entry);
}

function fail<Reason extends EvidenceLogReason>(reason: Reason): { ok: false; reason: Reason } {
  return { ok: false, reason };
}

function isOperationId(value: unknown): value is string {
  return typeof value === "string" && OPERATION_ID.test(value);
}

function isEvidenceId(value: string): boolean {
  return value.startsWith("env-") && OPERATION_ID.test(value.slice(4));
}

function isReservationId(value: unknown): value is string {
  return typeof value === "string" && RESERVATION_ID.test(value);
}

function isFixtureId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]{0,11}$/.test(value);
}

function isPublicId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && value.trim() === value && !/[\r\n]/.test(value);
}

function isEvidenceClass(value: unknown): value is Pe5EvidenceClass {
  return typeof value === "string" && EVIDENCE_CLASSES.has(value);
}

function isFailReason(value: unknown): value is Pe5FailReason {
  return typeof value === "string" && FAIL_REASONS.has(value);
}

function isNormalizeReason(value: unknown): value is Pe5NormalizeReason {
  return typeof value === "string" && NORMALIZE_REASONS.has(value);
}

function isCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    !Object.is(value, -0)
  );
}

function isPositiveCount(value: unknown): value is number {
  return isCount(value) && value >= 1;
}

function hasOwnSymbols(record: object): boolean {
  try {
    return Object.getOwnPropertySymbols(record).length > 0;
  } catch {
    return true;
  }
}

function ownNames(record: object): string[] | null {
  try {
    return Object.getOwnPropertyNames(record);
  } catch {
    return null;
  }
}

function isSafeObject(value: unknown): value is object {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    return types.isProxy(value) !== true;
  } catch {
    return false;
  }
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
