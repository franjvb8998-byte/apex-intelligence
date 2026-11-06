/**
 * PE-5.4C increment 8 stage 2B — offline acquisition orchestrator.
 *
 * In-process only. One genuine ledger, transport, raw store, and evidence log
 * are created here and kept private. This does not persist to disk, survive
 * process exit, recover from a crash, or coordinate another process. It does
 * not authorize a live provider and it is not production-ready. A caller who
 * uses the ledger directly is outside this object. Two orchestrators are two
 * contexts, even when their public identity strings match.
 */

import { createHash } from "node:crypto";
import { types } from "node:util";

import {
  evaluateAuthorization,
  protocolFlagsDeny,
  readRealProtocolFlags,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/authorize";
import {
  appendEvidence,
  armAmbiguousEvidenceRead,
  armEvidenceAppendFailure,
  armLostEvidenceAcknowledgement,
  createEvidenceLog,
  readEvidence,
  readEvidenceAudit,
  setEvidenceLogUnavailable,
  type EvidenceClassificationView,
  type EvidenceLog,
  type EvidenceObservation,
  type EvidenceRecordView,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/evidence-log";
import {
  armLostAcknowledgement,
  armUnattestedLookup,
  beginSend,
  createMemoryLedger,
  insertExternalCharge,
  isRegisteredMemoryLedger,
  lookupReservation,
  matchSendCommit,
  readLedgerNow,
  readKillSwitch,
  readSnapshot,
  recordOutcome,
  replaceKillSwitch,
  replaceVendorDayBoundaryForTests,
  setLedgerUnavailable,
  tryReserve,
  type MemoryLedger,
  type ReservationState,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger";
import {
  normalizePe5AcquisitionResponse,
  type Pe5NormalizedObservation,
  type Pe5NormalizeReason,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/normalize";
import {
  CANONICAL_OPERATION_PATHS,
  deriveOperationId,
  type OperationEndpoint,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/operation-id";
import {
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
  type RawEnvelopeView,
  type RawStore,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/raw-store";
import {
  createOfflineTransport,
  executeOfflineSend,
  readTransportAudit,
  type ExecuteOfflineSendResult,
  type OfflineTransport,
  type TransportQuotaHeader,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/transport";
import {
  PROTOCOL_FLAG_KEYS,
  type AcquisitionApproval,
  type ProtocolFlagKey,
  type VendorDayBoundary,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/types";
import { classifyHoldoutForResearch } from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import {
  classifyPe5Evidence,
  type Pe5EvidenceDecision,
  type Pe5EvidenceInput,
} from "@/lib/debug/calibration/pe5-availability/evidence-class";
import {
  PE5_EVIDENCE_KINDS,
  PE5_FAIL_REASONS,
  PE5_PROVENANCE_VALUES,
  type Pe5EvidenceClass,
  type Pe5EvidenceProvenance,
  type Pe5FailReason,
  type Pe5SquadEvidenceKind,
} from "@/lib/debug/calibration/pe5-availability/protocol";

export const PE5_4C_ORCHESTRATOR_LIMIT = {
  durability: "in-process-only",
  visibility: "same-genuine-context-only",
  diskPersistence: false,
  crossProcessConsistency: false,
  crashRecovery: false,
  directLedgerCallerGuarantee: false,
  liveProviderAuthorization: false,
  productionReady: false,
  globalAuthenticity: false,
} as const;

const QUOTA_HEADER = "x-ratelimit-requests-remaining";
const FIXTURE_ID = /^[1-9][0-9]{0,11}$/;
const SEASON_ID = /^(19|20|21)\d{2}$/;
const DIGEST = /^[0-9a-f]{64}$/;

const CONFIG_KEYS = new Set(["approval", "clock", "maxCaptureLagMs"]);
const REQUEST_KEYS = new Set([
  "env",
  "kill",
  "protocolFlags",
  "endpoint",
  "fixtureId",
  "callerPath",
  "credentialId",
  "approvalId",
  "ledgerInstanceId",
  "generation",
  "operationId",
  "canonicalPath",
  "source",
  "target",
  "kind",
  "provenance",
  "script",
]);
const FIXTURE_KEYS = new Set(["fixtureId", "kickoffUtc", "providerSeasonId"]);
const ENV_KEYS = new Set(["APEX_PE5_ACQUISITION_MODE", "ledgerInstanceId"]);
const KILL_KEYS = ["state", "version", "updatedAt", "maxAgeMs"] as const;

const KIND_SET = new Set<string>(PE5_EVIDENCE_KINDS);
const PROVENANCE_SET = new Set<string>(PE5_PROVENANCE_VALUES);
const FAIL_REASONS = new Set<string>(PE5_FAIL_REASONS);
const SECRET_KEY = /secret|password|token|api[_-]?key|(?:^|_)key$/i;

const CONTEXTS = new WeakMap<object, OrchestratorContext>();

export type Pe5OfflineOrchestrator = {
  readonly kind: "pe5-offline-orchestrator";
};

export type Pe5OrchestratorResult =
  | {
      readonly ok: true;
      readonly outcome: "consumed";
      readonly operationId: string;
      readonly reservationId: string;
      readonly normalizationStatus: "normalized";
      readonly classification: "classified";
      readonly reason: Pe5EvidenceDecision["reason"];
      readonly evidenceClass: Pe5EvidenceClass;
      readonly decisionOk: boolean;
      readonly observation: "present" | "missing";
      readonly observedValue: number | null;
    }
  | {
      readonly ok: true;
      readonly outcome: "duplicate";
      readonly reason: "duplicate_reservation";
      readonly operationId: string;
      readonly reservationId: string;
      readonly state: ReservationState;
    }
  | {
      readonly ok: false;
      readonly outcome: "denied" | "failed" | "unknown" | "ambiguous" | "rejected";
      readonly reason: string;
      readonly operationId: string | null;
      readonly reservationId: string | null;
    };

export type Pe5OrchestratorFault =
  | { readonly kind: "lost-ack"; readonly which: "tryReserve" | "beginSend" }
  | { readonly kind: "unattested-lookup" }
  | { readonly kind: "ledger-unavailable"; readonly unavailable: boolean }
  | { readonly kind: "transient-outcome-unavailable" }
  | { readonly kind: "sticky-outcome-unavailable" }
  | { readonly kind: "raw-append-failure" }
  | { readonly kind: "raw-partial-append" }
  | { readonly kind: "lost-raw-ack" }
  | { readonly kind: "ambiguous-raw-read" }
  | { readonly kind: "corrupt-raw-before-read" }
  | { readonly kind: "raw-unavailable"; readonly unavailable: boolean }
  | { readonly kind: "evidence-append-failure" }
  | { readonly kind: "lost-evidence-ack" }
  | { readonly kind: "ambiguous-evidence-read" }
  | { readonly kind: "evidence-unavailable"; readonly unavailable: boolean }
  | {
      readonly kind: "external-charge";
      readonly operationId: string;
      readonly state: "reserved" | "sending" | "consumed" | "failed";
    }
  | { readonly kind: "replace-kill"; readonly record: unknown }
  | { readonly kind: "replace-vendor-day"; readonly boundary: unknown }
  | { readonly kind: "seed-evidence"; readonly input: unknown };

export type Pe5OrchestratorInspection = {
  readonly ledger: Awaited<ReturnType<typeof readSnapshot>>;
  readonly transportAudits: ReadonlyArray<{ readonly script: string; readonly reason?: string; readonly status?: number }>;
  readonly rawAudits: ReadonlyArray<{ readonly action: string; readonly reason?: string; readonly operationId?: string }>;
  readonly evidenceAudits: ReadonlyArray<{ readonly action: string; readonly reason?: string; readonly operationId?: string }>;
  readonly transportAttempts: number;
  readonly outcomeAttempts: number;
};

type OrchestratorContext = {
  readonly ledger: MemoryLedger;
  readonly transport: OfflineTransport;
  readonly raw: RawStore;
  readonly evidence: EvidenceLog;
  readonly approval: AcquisitionApproval;
  readonly fetchTimeoutMs: number;
  readonly credentialId: string;
  readonly ledgerInstanceId: string;
  readonly approvalId: string;
  transportAttempts: number;
  outcomeAttempts: number;
  transientOutcomeUnavailable: boolean;
  stickyOutcomeUnavailable: boolean;
  corruptRawBeforeRead: boolean;
};

type OwnRead =
  | { readonly state: "missing" }
  | { readonly state: "unsafe" }
  | { readonly state: "value"; readonly value: unknown };

type FixtureContext = {
  readonly fixtureId: string;
  readonly kickoffUtc: string;
  readonly providerSeasonId: string;
};

type PreparedRequest = {
  readonly env: object;
  readonly kill: object;
  readonly protocolFlags: object;
  readonly endpoint: OperationEndpoint;
  readonly fixtureId: string;
  readonly canonicalPath: (typeof CANONICAL_OPERATION_PATHS)[OperationEndpoint];
  readonly kind: Pe5SquadEvidenceKind;
  readonly provenance: Pe5EvidenceProvenance;
  readonly source: FixtureContext;
  readonly target: FixtureContext;
  readonly script: object;
  readonly echoes: {
    readonly callerPath?: string;
    readonly credentialId?: string;
    readonly approvalId?: string;
    readonly ledgerInstanceId?: string;
    readonly generation?: number;
    readonly canonicalPath?: string;
    readonly operationId?: string;
  };
};

type ReservationProof = {
  readonly operationId: string;
  readonly reservationId: string;
  readonly fencingToken: string;
};

type SendProof = ReservationProof & {
  readonly sendToken: string;
};

type ClearKill = {
  readonly state: "clear";
  readonly version: number;
  readonly updatedAt: number;
  readonly maxAgeMs: number;
};

export function createPe5OfflineOrchestrator(
  config: unknown,
): { readonly ok: true; readonly orchestrator: Pe5OfflineOrchestrator } | { readonly ok: false; readonly reason: "operation_rejected" } {
  if (!isPlain(config) || hasSecretName(config)) return rejectedFactory();
  const names = ownNames(config);
  if (names == null) return rejectedFactory();
  for (const name of names) {
    if (!CONFIG_KEYS.has(name)) return rejectedFactory();
  }
  const approvalRead = readOwn(config, "approval");
  const clockRead = readOwn(config, "clock");
  if (approvalRead.state !== "value" || clockRead.state !== "value") return rejectedFactory();
  if (!isPlain(approvalRead.value) || hasSecretName(approvalRead.value)) return rejectedFactory();
  if (!isPlain(clockRead.value) || types.isProxy(clockRead.value) === true) return rejectedFactory();
  const now = readOwn(clockRead.value, "now");
  if (now.state !== "value" || typeof now.value !== "function") return rejectedFactory();

  const approval = snapshotApproval(approvalRead.value);
  if (approval == null) return rejectedFactory();
  const lag = readLag(config, names);
  if (lag === "invalid") return rejectedFactory();

  const ledger = createMemoryLedger({ approval, clock: clockRead.value as AcquisitionClock });
  if (!isRegisteredMemoryLedger(ledger)) return rejectedFactory();
  const stamp = readLedgerStamp(ledger);
  if (stamp == null) return rejectedFactory();

  const transport = createOfflineTransport({ fetchTimeoutMs: approval.fetchTimeoutMs });
  const raw = createRawStore(lag == null ? { ledger } : { ledger, maxCaptureLagMs: lag });
  const evidence = createEvidenceLog({ ledger });
  const orchestrator: Pe5OfflineOrchestrator = Object.freeze({ kind: "pe5-offline-orchestrator" });
  CONTEXTS.set(orchestrator, {
    ledger,
    transport,
    raw,
    evidence,
    approval,
    fetchTimeoutMs: approval.fetchTimeoutMs,
    credentialId: approval.credentialId,
    ledgerInstanceId: stamp.ledgerInstanceId,
    approvalId: stamp.approvalId,
    transportAttempts: 0,
    outcomeAttempts: 0,
    transientOutcomeUnavailable: false,
    stickyOutcomeUnavailable: false,
    corruptRawBeforeRead: false,
  });
  return { ok: true, orchestrator };
}

export async function executePe5OfflineOrchestrator(
  orchestrator: Pe5OfflineOrchestrator,
  input: unknown,
): Promise<Pe5OrchestratorResult> {
  const context = readContext(orchestrator);
  if (context == null) return denied("unavailable", null, null);
  try {
    return await run(context, input);
  } catch {
    return unknown(null, null);
  }
}

export async function applyPe5OrchestratorFault(
  orchestrator: Pe5OfflineOrchestrator,
  fault: unknown,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  const context = readContext(orchestrator);
  if (context == null || !isPlain(fault)) return { ok: false, reason: "operation_rejected" };
  const kind = readOwn(fault, "kind");
  if (kind.state !== "value" || typeof kind.value !== "string") {
    return { ok: false, reason: "operation_rejected" };
  }
  try {
    return await applyFault(context, fault, kind.value);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function readPe5OrchestratorInspection(
  orchestrator: Pe5OfflineOrchestrator,
): Promise<{ readonly ok: true; readonly inspection: Pe5OrchestratorInspection } | { readonly ok: false; readonly reason: "unavailable" }> {
  const context = readContext(orchestrator);
  if (context == null) return { ok: false, reason: "unavailable" };
  const ledger = await readSnapshot(context.ledger);
  const transport = await readTransportAudit(context.transport);
  const raw = await readRawStoreAudit(context.raw);
  const evidence = await readEvidenceAudit(context.evidence);
  return {
    ok: true,
    inspection: {
      ledger,
      transportAudits: transport.ok
        ? transport.audits.map((entry) => ({
            script: entry.script,
            reason: entry.reason,
            status: entry.status,
          }))
        : [],
      rawAudits: raw.ok
        ? raw.audits.map((entry) => ({
            action: entry.action,
            reason: entry.reason,
            operationId: entry.operationId,
          }))
        : [],
      evidenceAudits: evidence.ok
        ? evidence.audits.map((entry) => ({
            action: entry.action,
            reason: entry.reason,
            operationId: entry.operationId,
          }))
        : [],
      transportAttempts: context.transportAttempts,
      outcomeAttempts: context.outcomeAttempts,
    },
  };
}

export async function readPe5OrchestratorEvidence(
  orchestrator: Pe5OfflineOrchestrator,
  operationId: string,
): Promise<{ readonly ok: true; readonly record: EvidenceRecordView } | { readonly ok: false; readonly reason: string }> {
  const context = readContext(orchestrator);
  if (context == null) return { ok: false, reason: "unavailable" };
  const read = await readEvidence(context.evidence, { operationId });
  if (!read.ok) return { ok: false, reason: read.reason };
  return { ok: true, record: read.record };
}

async function run(context: OrchestratorContext, input: unknown): Promise<Pe5OrchestratorResult> {
  const prepared = prepareRequest(input);
  if (!prepared.ok) return denied(prepared.reason, null, null);

  const clock = await readLedgerNow(context.ledger);
  if (!clock.ok) return denied(clock.reason, null, null);

  const flags = prepared.request.protocolFlags;
  if (protocolFlagsDeny(readRealProtocolFlags(), flagView(flags))) {
    return denied("protocol_flag_violation", null, null);
  }
  const authorized = evaluateAuthorization(
    prepared.request.env,
    context.approval,
    prepared.request.kill,
    flags,
    clock.now,
  );
  if (authorized.decision !== "allow-offline") return denied(authorized.reason, null, null);

  const kill = await synchronizeKill(context, prepared.request.kill, clock.now);
  if (!kill.ok) return denied(kill.reason, null, null);

  const holdout = holdoutDenial(prepared.request.source, prepared.request.target);
  if (holdout != null) return denied(holdout, null, null);

  const derived = deriveOperationId(
    {
      ledgerInstanceId: context.ledgerInstanceId,
      credentialId: context.credentialId,
      approvalId: context.approvalId,
      generation: 0,
    },
    deriveRequest(prepared.request),
  );
  if (!derived.ok) return denied("operation_rejected", null, null);
  if (derived.endpoint !== prepared.request.endpoint || derived.canonicalFixtureId !== prepared.request.fixtureId) {
    return denied("operation_rejected", null, null);
  }
  if (derived.canonicalPath !== prepared.request.canonicalPath) return denied("operation_rejected", null, null);
  if (prepared.request.echoes.operationId != null && prepared.request.echoes.operationId !== derived.operationId) {
    return denied("operation_rejected", null, null);
  }
  if (prepared.request.source.fixtureId !== derived.canonicalFixtureId) {
    return denied("operation_rejected", null, null);
  }

  const reserved = await obtainReservation(context, prepared.request, derived.operationId);
  if (!reserved.ok) return reserved.result;
  if (reserved.kind === "duplicate") return reserved.result;

  const began = await beginSend(context.ledger, {
    reservationId: reserved.proof.reservationId,
    fencingToken: reserved.proof.fencingToken,
  });
  if (!began.ok) {
    if (began.reason === "ambiguous") return ambiguous(reserved.proof.operationId, reserved.proof.reservationId);
    if (began.reason === "unavailable") {
      return rejected("unavailable", reserved.proof.operationId, reserved.proof.reservationId);
    }
    return denied(began.denyReason, reserved.proof.operationId, reserved.proof.reservationId);
  }
  if (!isIdentity(began.sendToken) || began.reservationId !== reserved.proof.reservationId) {
    return rejected("operation_rejected", reserved.proof.operationId, reserved.proof.reservationId);
  }
  const proof: SendProof = { ...reserved.proof, sendToken: began.sendToken };
  return finishSend(context, prepared.request, proof);
}

async function finishSend(
  context: OrchestratorContext,
  request: PreparedRequest,
  proof: SendProof,
): Promise<Pe5OrchestratorResult> {
  context.transportAttempts += 1;
  let sent: ExecuteOfflineSendResult;
  try {
    sent = await executeOfflineSend(context.transport, {
      ledger: context.ledger,
      reservationId: proof.reservationId,
      sendToken: proof.sendToken,
      script: request.script,
      request: {
        endpoint: request.endpoint,
        fixtureId: request.fixtureId,
        credentialId: context.credentialId,
        fetchTimeoutMs: context.fetchTimeoutMs,
        query: { fixture: request.fixtureId },
        url: `${request.canonicalPath}?fixture=${request.fixtureId}`,
      },
    });
  } catch {
    return unknown(proof.operationId, proof.reservationId);
  }

  if (!sent.ok) {
    if (sent.reason === "outcome_unknown") return unknown(proof.operationId, proof.reservationId);
    if (!confirmedTransportFailure(sent.reason)) {
      return rejected(sent.reason, proof.operationId, proof.reservationId);
    }
    const attested = await attestSend(context, proof, request);
    if (!attested.ok) return attested.result;
    const settled = await settleOutcome(context, proof, "failed", sent.reason);
    if (settled === "accepted") return failed(sent.reason, proof.operationId, proof.reservationId);
    return rejected(settled, proof.operationId, proof.reservationId);
  }

  const bytes = copyBytes(sent.bodyBytes);
  if (bytes == null) return rejected("integrity_mismatch", proof.operationId, proof.reservationId);
  const header = quotaFromResult(sent.quotaHeader);
  if (header === "lost") return rejected("quota_header_lost", proof.operationId, proof.reservationId);

  const stored = await storeRaw(context, proof, request, sent.status, bytes);
  if (!stored.ok) return stored.result;
  const attested = await attestSend(context, proof, request);
  if (!attested.ok) return attested.result;

  const normalized = normalizePe5AcquisitionResponse(normalizerEnvelope(stored.envelope, bytes, header));
  if (!normalized.ok) {
    return storeRejection(context, proof, stored.envelope, normalized.reason);
  }
  return storeObservation(context, request, proof, stored.envelope, normalized.observation);
}

async function storeRejection(
  context: OrchestratorContext,
  proof: SendProof,
  envelope: RawEnvelopeView,
  reason: Pe5NormalizeReason,
): Promise<Pe5OrchestratorResult> {
  const expected = rejectedRecord(context, proof, envelope, reason);
  const recorded = await reconcileEvidence(context, expected);
  if (!recorded.ok) return recorded.result;
  const settled = await settleOutcome(context, proof, "failed", reason);
  if (settled === "accepted") return failed(reason, proof.operationId, proof.reservationId);
  return rejected(settled, proof.operationId, proof.reservationId);
}

async function storeObservation(
  context: OrchestratorContext,
  request: PreparedRequest,
  proof: SendProof,
  envelope: RawEnvelopeView,
  observation: Pe5NormalizedObservation,
): Promise<Pe5OrchestratorResult> {
  const holdout = holdoutDenial(request.source, request.target);
  if (holdout != null) return rejected(holdout, proof.operationId, proof.reservationId);
  if (observation.fixtureId !== request.fixtureId || observation.endpoint !== request.endpoint) {
    return rejected("fixture_id_mismatch", proof.operationId, proof.reservationId);
  }
  if (observation.capturedAtUtc !== envelope.capturedAtUtc) {
    return rejected("integrity_mismatch", proof.operationId, proof.reservationId);
  }
  if (observation.captureTimestampVerified !== envelope.captureTimestampVerified) {
    return rejected("integrity_mismatch", proof.operationId, proof.reservationId);
  }

  const evidenceObservation = toEvidenceObservation(observation);
  if (evidenceObservation == null) return rejected("malformed_response", proof.operationId, proof.reservationId);

  const clockSkipped = envelope.capturedAtUtc == null || envelope.captureTimestampVerified !== true;
  let decision: Pe5EvidenceDecision;
  try {
    decision = classifyPe5Evidence(classifierInput(request, envelope, observation));
  } catch {
    return rejected("unavailable", proof.operationId, proof.reservationId);
  }

  if (clockSkipped && decision.ok === true) {
    return rejected("classification_unrepresentable", proof.operationId, proof.reservationId);
  }

  const classification = clockSkipped
    ? skippedClassification(envelope)
    : stageClassification(decision, request.provenance, evidenceObservation);
  if (classification == null) {
    return rejected("classification_unrepresentable", proof.operationId, proof.reservationId);
  }

  const expected = normalizedRecord(context, proof, envelope, evidenceObservation, classification);
  const recorded = await reconcileEvidence(context, expected);
  if (!recorded.ok) return recorded.result;
  if (classification.status !== "classified") {
    return rejected(classification.reason, proof.operationId, proof.reservationId);
  }

  const settled = await settleOutcome(context, proof, "consumed");
  if (settled !== "accepted") return rejected(settled, proof.operationId, proof.reservationId);
  return {
    ok: true,
    outcome: "consumed",
    operationId: proof.operationId,
    reservationId: proof.reservationId,
    normalizationStatus: "normalized",
    classification: "classified",
    reason: classification.decision.reason,
    evidenceClass: classification.decision.evidenceClass,
    decisionOk: classification.decision.ok,
    observation: evidenceObservation.observation,
    observedValue: evidenceObservation.observedValue,
  };
}

function classifierInput(
  request: PreparedRequest,
  envelope: RawEnvelopeView,
  observation: Pe5NormalizedObservation,
): Pe5EvidenceInput {
  return {
    evidenceId: envelope.envelopeId,
    kind: request.kind,
    provenance: request.provenance,
    sourceFixtureId: request.source.fixtureId,
    sourceKickoffUtc: request.source.kickoffUtc,
    sourceProviderSeasonId: request.source.providerSeasonId,
    capturedAtUtc: envelope.capturedAtUtc,
    captureTimestampVerified: envelope.captureTimestampVerified,
    observation: observation.observation,
    observedValue: observation.observedValue,
    targetFixtureId: request.target.fixtureId,
    targetKickoffUtc: request.target.kickoffUtc,
    targetProviderSeasonId: request.target.providerSeasonId,
  };
}

function skippedClassification(envelope: RawEnvelopeView): EvidenceClassificationView | null {
  if (envelope.capturedAtUtc != null && envelope.captureTimestampVerified === true) return null;
  const reason = envelope.capturedAtUtc == null ? "missing_capture_timestamp" : "capture_timestamp_unverified";
  return { status: "skipped", reason };
}

function stageClassification(
  decision: Pe5EvidenceDecision,
  provenance: Pe5EvidenceProvenance,
  observation: EvidenceObservation,
): EvidenceClassificationView | null {
  if (decision.numericValue !== null || decision.zeroFilled !== false) return null;
  if (decision.ok === true) {
    if (provenance !== "prospective_snapshot") return null;
    if (decision.reason !== "classified") return null;
    if (decision.evidenceClass !== "PROSPECTIVE_PREMATCH_SNAPSHOT") return null;
    if (decision.availability !== "classified") return null;
    if (observation.observation !== "present" || !isCount(observation.observedValue)) return null;
    if (!isCount(decision.retainedObservation) || decision.retainedObservation !== observation.observedValue) {
      return null;
    }
    if (typeof decision.targetPrematchEligible !== "boolean" || typeof decision.laterTargetHistoryEligible !== "boolean") {
      return null;
    }
    if (decision.targetPrematchEligible === decision.laterTargetHistoryEligible) return null;
    return {
      status: "classified",
      provenance: "prospective_snapshot",
      decision: {
        ok: true,
        evidenceClass: decision.evidenceClass,
        reason: "classified",
        targetPrematchEligible: decision.targetPrematchEligible,
        laterTargetHistoryEligible: decision.laterTargetHistoryEligible,
        numericValue: null,
        retainedObservation: decision.retainedObservation,
        availability: "classified",
        zeroFilled: false,
      },
    };
  }
  if (decision.ok !== false) return null;
  if (!isFailReason(decision.reason)) return null;
  if (decision.evidenceClass === "PROSPECTIVE_PREMATCH_SNAPSHOT") return null;
  if (!isEvidenceClass(decision.evidenceClass)) return null;
  if (decision.availability !== "unavailable") return null;
  if (decision.targetPrematchEligible !== false || decision.laterTargetHistoryEligible !== false) return null;
  if (decision.retainedObservation !== null) return null;
  return {
    status: "classified",
    provenance: provenance === "prospective_snapshot" ? "prospective_snapshot" : null,
    decision: {
      ok: false,
      evidenceClass: decision.evidenceClass,
      reason: decision.reason,
      targetPrematchEligible: false,
      laterTargetHistoryEligible: false,
      numericValue: null,
      retainedObservation: null,
      availability: "unavailable",
      zeroFilled: false,
    },
  };
}

async function reconcileEvidence(
  context: OrchestratorContext,
  expected: EvidenceRecordView,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly result: Pe5OrchestratorResult }> {
  const appended = await appendEvidence(context.evidence, evidenceInput(expected));
  if (!appended.ok && appended.reason !== "ambiguous") {
    return { ok: false, result: rejected(appended.reason, expected.operationId, expected.reservationId) };
  }
  const read = await readEvidence(context.evidence, { operationId: expected.operationId });
  if (!read.ok) {
    return { ok: false, result: ambiguous(expected.operationId, expected.reservationId) };
  }
  if (
    read.record.ledgerInstanceId !== context.ledgerInstanceId ||
    read.record.approvalId !== context.approvalId ||
    read.record.reservationId !== expected.reservationId ||
    !sameEvidence(read.record, expected)
  ) {
    return { ok: false, result: rejected("evidence_conflict", expected.operationId, expected.reservationId) };
  }
  return { ok: true };
}

function evidenceInput(record: EvidenceRecordView): object {
  const base: Record<string, unknown> = {
    operationId: record.operationId,
    envelopeId: record.envelopeId,
    evidenceId: record.evidenceId,
    reservationId: record.reservationId,
    contentDigest: record.contentDigest,
    capturedAtUtc: record.capturedAtUtc,
    captureTimestampVerified: record.captureTimestampVerified,
    normalizationStatus: record.normalizationStatus,
  };
  if (record.normalizationStatus === "rejected") {
    base.normalizationReason = record.normalizationReason;
    return base;
  }
  base.observation = record.observation;
  base.classification = classificationInput(record.classification);
  return base;
}

function classificationInput(classification: EvidenceClassificationView): object {
  if (classification.status === "skipped") {
    return { status: "skipped", reason: classification.reason };
  }
  const decision = {
    ok: classification.decision.ok,
    evidenceClass: classification.decision.evidenceClass,
    reason: classification.decision.reason,
    targetPrematchEligible: classification.decision.targetPrematchEligible,
    laterTargetHistoryEligible: classification.decision.laterTargetHistoryEligible,
    numericValue: null,
    retainedObservation: classification.decision.retainedObservation,
    availability: classification.decision.availability,
    zeroFilled: false,
  };
  if (classification.provenance === "prospective_snapshot") {
    return { status: "classified", provenance: "prospective_snapshot", decision };
  }
  return { status: "classified", decision };
}

async function storeRaw(
  context: OrchestratorContext,
  proof: SendProof,
  request: PreparedRequest,
  status: number,
  bytes: Uint8Array,
): Promise<{ readonly ok: true; readonly envelope: RawEnvelopeView } | { readonly ok: false; readonly result: Pe5OrchestratorResult }> {
  const appended = await appendRaw(context.raw, {
    reservationId: proof.reservationId,
    sendToken: proof.sendToken,
    status,
    bodyBytes: bytes,
    operationId: proof.operationId,
    endpoint: request.endpoint,
    fixtureId: request.fixtureId,
    approvalId: context.approvalId,
    credentialId: context.credentialId,
  });
  if (!appended.ok && appended.reason !== "ambiguous") {
    return { ok: false, result: rejected(appended.reason, proof.operationId, proof.reservationId) };
  }
  if (context.corruptRawBeforeRead) {
    context.corruptRawBeforeRead = false;
    await corruptStoredBytesForTests(context.raw, proof.operationId);
  }
  const read = await readRaw(context.raw, { operationId: proof.operationId });
  if (!read.ok) {
    const reason = read.reason === "raw_missing" ? "ambiguous" : read.reason;
    return { ok: false, result: read.reason === "ambiguous" || read.reason === "raw_missing"
      ? ambiguous(proof.operationId, proof.reservationId)
      : rejected(reason, proof.operationId, proof.reservationId) };
  }
  const digest = digestOf(read.bodyBytes);
  if (
    digest == null ||
    digest !== read.envelope.digest ||
    !DIGEST.test(read.envelope.digest) ||
    !sameBytes(read.bodyBytes, bytes) ||
    !rawMatches(read.envelope, proof, request, status, read.bodyBytes.byteLength, context)
  ) {
    return { ok: false, result: rejected("integrity_mismatch", proof.operationId, proof.reservationId) };
  }
  return { ok: true, envelope: read.envelope };
}

function rawMatches(
  envelope: RawEnvelopeView,
  proof: SendProof,
  request: PreparedRequest,
  status: number,
  byteLength: number,
  context: OrchestratorContext,
): boolean {
  return (
    envelope.operationId === proof.operationId &&
    envelope.reservationId === proof.reservationId &&
    envelope.approvalId === context.approvalId &&
    envelope.credentialId === context.credentialId &&
    envelope.endpoint === request.endpoint &&
    envelope.fixtureId === request.fixtureId &&
    envelope.status === status &&
    envelope.byteLength === byteLength &&
    envelope.envelopeId === `env-${proof.operationId}`
  );
}

function normalizerEnvelope(
  envelope: RawEnvelopeView,
  bytes: Uint8Array,
  header: TransportQuotaHeader | null,
): object {
  return {
    envelopeId: envelope.envelopeId,
    status: envelope.status,
    headers: header == null ? null : { [QUOTA_HEADER]: header.value },
    body: decodeBody(bytes),
    endpoint: envelope.endpoint,
    fixtureId: envelope.fixtureId,
    capturedAtUtc: envelope.capturedAtUtc,
    captureTimestampVerified: envelope.captureTimestampVerified,
  };
}

function quotaFromResult(header: TransportQuotaHeader | null): TransportQuotaHeader | null | "lost" {
  if (header == null) return null;
  if (header.name !== QUOTA_HEADER) return "lost";
  if (typeof header.value !== "string" && typeof header.value !== "number") return "lost";
  return { name: QUOTA_HEADER, value: header.value };
}

async function attestSend(
  context: OrchestratorContext,
  proof: SendProof,
  request: PreparedRequest,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly result: Pe5OrchestratorResult }> {
  const looked = await lookupReservation(context.ledger, proof.operationId);
  if (!looked.ok) {
    return { ok: false, result: looked.reason === "ambiguous" || looked.reason === "unavailable"
      ? ambiguous(proof.operationId, proof.reservationId)
      : rejected(looked.denyReason, proof.operationId, proof.reservationId) };
  }
  if (
    looked.found !== true ||
    looked.consumer !== "pe5" ||
    looked.state !== "sending" ||
    looked.reservationId !== proof.reservationId ||
    looked.operationId !== proof.operationId
  ) {
    return { ok: false, result: rejected("operation_rejected", proof.operationId, proof.reservationId) };
  }
  const matched = await matchSendCommit(context.ledger, {
    reservationId: proof.reservationId,
    sendToken: proof.sendToken,
  });
  if (!matched.ok) {
    const reason = matched.reason === "unavailable" ? "unavailable" : matched.denyReason;
    return { ok: false, result: rejected(reason, proof.operationId, proof.reservationId) };
  }
  if (
    matched.approvalId !== context.approvalId ||
    matched.credentialId !== context.credentialId ||
    matched.endpoint !== request.endpoint ||
    matched.fixtureId !== request.fixtureId ||
    matched.operationId !== proof.operationId
  ) {
    return { ok: false, result: rejected("operation_rejected", proof.operationId, proof.reservationId) };
  }
  return { ok: true };
}

async function settleOutcome(
  context: OrchestratorContext,
  proof: SendProof,
  intended: "consumed" | "failed",
  failedReason?: string,
): Promise<"accepted" | string> {
  const input = intended === "failed"
    ? { reservationId: proof.reservationId, sendToken: proof.sendToken, outcome: "failed" as const, failedReason }
    : { reservationId: proof.reservationId, sendToken: proof.sendToken, outcome: "consumed" as const };
  let result = await callOutcome(context, input);
  if (result.ok && result.state === intended) return "accepted";
  if (result.ok) return "invalid_transition";
  if (result.reason === "denied") return result.denyReason;
  const looked = await lookupReservation(context.ledger, proof.operationId);
  if (!looked.ok) return looked.reason === "denied" ? looked.denyReason : looked.reason;
  if (!looked.found) return "reservation_missing";
  if (
    looked.consumer !== "pe5" ||
    looked.reservationId !== proof.reservationId ||
    looked.operationId !== proof.operationId
  ) {
    return "operation_rejected";
  }
  if (looked.state === intended) return "accepted";
  if (looked.state !== "sending") return "invalid_transition";
  result = await callOutcome(context, input);
  if (result.ok && result.state === intended) return "accepted";
  if (result.ok) return "invalid_transition";
  if (result.reason === "denied") return result.denyReason;
  return result.reason;
}

async function callOutcome(
  context: OrchestratorContext,
  input: {
    readonly reservationId: string;
    readonly sendToken: string;
    readonly outcome: "consumed" | "failed";
    readonly failedReason?: string;
  },
): Promise<Awaited<ReturnType<typeof recordOutcome>>> {
  context.outcomeAttempts += 1;
  if (context.transientOutcomeUnavailable) {
    context.transientOutcomeUnavailable = false;
    await setLedgerUnavailable(context.ledger, true);
    const hidden = await recordOutcome(context.ledger, input);
    await setLedgerUnavailable(context.ledger, false);
    return hidden;
  }
  if (context.stickyOutcomeUnavailable) {
    context.stickyOutcomeUnavailable = false;
    await setLedgerUnavailable(context.ledger, true);
    return recordOutcome(context.ledger, input);
  }
  return recordOutcome(context.ledger, input);
}

async function obtainReservation(
  context: OrchestratorContext,
  request: PreparedRequest,
  operationId: string,
): Promise<
  | { readonly ok: true; readonly kind: "reserved"; readonly proof: ReservationProof }
  | { readonly ok: true; readonly kind: "duplicate"; readonly result: Pe5OrchestratorResult }
  | { readonly ok: false; readonly result: Pe5OrchestratorResult }
> {
  const reserved = await tryReserve(context.ledger, reserveInput(context, request, operationId));
  if (!reserved.ok) {
    if (reserved.reason !== "ambiguous") {
      const reason = reserved.reason === "denied" ? reserved.denyReason : reserved.reason;
      return { ok: false, result: denied(reason, operationId, null) };
    }
    const looked = await lookupReservation(context.ledger, operationId);
    if (!looked.ok || looked.found !== true) {
      return { ok: false, result: ambiguous(operationId, null) };
    }
    if (
      looked.consumer !== "pe5" ||
      looked.state !== "reserved" ||
      looked.operationId !== operationId ||
      looked.tokenDisclosed !== true ||
      !isIdentity(looked.fencingToken)
    ) {
      return { ok: false, result: ambiguous(operationId, looked.found ? looked.reservationId : null) };
    }
    return {
      ok: true,
      kind: "reserved",
      proof: {
        operationId,
        reservationId: looked.reservationId,
        fencingToken: looked.fencingToken,
      },
    };
  }
  if (reserved.idempotent === true) {
    return { ok: true, kind: "duplicate", result: await duplicateResult(context, reserved.operationId, reserved.reservationId) };
  }
  if (reserved.state !== "reserved" || reserved.operationId !== operationId || !isIdentity(reserved.fencingToken)) {
    return { ok: false, result: rejected("operation_rejected", operationId, reserved.reservationId) };
  }
  return {
    ok: true,
    kind: "reserved",
    proof: {
      operationId,
      reservationId: reserved.reservationId,
      fencingToken: reserved.fencingToken,
    },
  };
}

async function duplicateResult(
  context: OrchestratorContext,
  operationId: string,
  reservationId: string,
): Promise<Pe5OrchestratorResult> {
  const looked = await lookupReservation(context.ledger, operationId);
  if (!looked.ok) return looked.reason === "denied" ? denied(looked.denyReason, operationId, reservationId) : ambiguous(operationId, reservationId);
  if (!looked.found || looked.consumer !== "pe5" || looked.operationId !== operationId || looked.reservationId !== reservationId) {
    return denied("operation_rejected", operationId, reservationId);
  }
  return {
    ok: true,
    outcome: "duplicate",
    reason: "duplicate_reservation",
    operationId,
    reservationId: looked.reservationId,
    state: looked.state,
  };
}

function reserveInput(context: OrchestratorContext, request: PreparedRequest, operationId: string) {
  return {
    operationId,
    protocolFlags: request.protocolFlags,
    endpoint: request.endpoint,
    fixtureId: request.fixtureId,
    credentialId: context.credentialId,
    approvalId: context.approvalId,
    ledgerInstanceId: context.ledgerInstanceId,
    generation: 0 as const,
    ...(request.echoes.callerPath == null ? {} : { callerPath: request.echoes.callerPath }),
    ...(request.echoes.canonicalPath == null ? {} : { canonicalPath: request.echoes.canonicalPath }),
  };
}

function deriveRequest(request: PreparedRequest): object {
  const derived: Record<string, unknown> = {
    endpoint: request.endpoint,
    fixtureId: request.fixtureId,
  };
  const echoes = request.echoes;
  if (echoes.credentialId != null) derived.credentialId = echoes.credentialId;
  if (echoes.approvalId != null) derived.approvalId = echoes.approvalId;
  if (echoes.ledgerInstanceId != null) derived.ledgerInstanceId = echoes.ledgerInstanceId;
  if (echoes.generation != null) derived.generation = echoes.generation;
  if (echoes.callerPath != null) derived.callerPath = echoes.callerPath;
  if (echoes.canonicalPath != null) derived.canonicalPath = echoes.canonicalPath;
  return derived;
}

async function synchronizeKill(
  context: OrchestratorContext,
  kill: object,
  now: number,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  const first = readClearKill(kill, now);
  const second = readClearKill(kill, now);
  if (!first.ok || !second.ok) return first.ok ? second : first;
  if (
    first.kill.version !== second.kill.version ||
    first.kill.updatedAt !== second.kill.updatedAt ||
    first.kill.maxAgeMs !== second.kill.maxAgeMs
  ) {
    return { ok: false, reason: "approval_inconsistent" };
  }
  if (first.kill.maxAgeMs !== context.approval.maxAgeMs) return { ok: false, reason: "approval_inconsistent" };
  const replaced = await replaceKillSwitch(context.ledger, { ...first.kill });
  if (!replaced.ok) return { ok: false, reason: "unavailable" };
  const seen = await readKillSwitch(context.ledger);
  if (!seen.ok) return { ok: false, reason: seen.reason };
  if (
    seen.state !== "clear" ||
    seen.version !== first.kill.version ||
    seen.updatedAt !== first.kill.updatedAt ||
    seen.maxAgeMs !== first.kill.maxAgeMs
  ) {
    return { ok: false, reason: "kill_switch_unreadable" };
  }
  return { ok: true };
}

function holdoutDenial(source: FixtureContext, target: FixtureContext): string | null {
  const targetClass = classifyHoldoutForResearch({
    kickoffUtc: target.kickoffUtc,
    providerSeasonId: target.providerSeasonId,
  });
  if (targetClass !== "dev_or_conf_eligible") return targetClass;
  const sourceClass = classifyHoldoutForResearch({
    kickoffUtc: source.kickoffUtc,
    providerSeasonId: source.providerSeasonId,
  });
  if (sourceClass !== "dev_or_conf_eligible") return sourceClass;
  return null;
}

function prepareRequest(input: unknown): { readonly ok: true; readonly request: PreparedRequest } | { readonly ok: false; readonly reason: "operation_rejected" } {
  if (!isPlain(input) || hasSecretName(input)) return { ok: false, reason: "operation_rejected" };
  const names = ownNames(input);
  if (names == null || names.length === 0) return { ok: false, reason: "operation_rejected" };
  for (const name of names) {
    if (!REQUEST_KEYS.has(name) || readOwn(input, name).state === "unsafe") {
      return { ok: false, reason: "operation_rejected" };
    }
  }
  const env = readPlain(input, "env", ENV_KEYS);
  const kill = readPlain(input, "kill", new Set(KILL_KEYS));
  const protocolFlags = readPlain(input, "protocolFlags", new Set(PROTOCOL_FLAG_KEYS));
  const script = readOwn(input, "script");
  const endpoint = readOwn(input, "endpoint");
  const fixtureId = readOwn(input, "fixtureId");
  const kind = readOwn(input, "kind");
  const provenance = readOwn(input, "provenance");
  const source = readFixture(input, "source");
  const target = readFixture(input, "target");
  if (
    env == null ||
    kill == null ||
    protocolFlags == null ||
    script.state !== "value" ||
    !isPlain(script.value) ||
    endpoint.state !== "value" ||
    (endpoint.value !== "lineups" && endpoint.value !== "injuries") ||
    fixtureId.state !== "value" ||
    !isFixtureId(fixtureId.value) ||
    kind.state !== "value" ||
    typeof kind.value !== "string" ||
    !KIND_SET.has(kind.value) ||
    provenance.state !== "value" ||
    typeof provenance.value !== "string" ||
    !PROVENANCE_SET.has(provenance.value) ||
    source == null ||
    target == null
  ) {
    return { ok: false, reason: "operation_rejected" };
  }
  const outcome = readOwn(script.value, "outcome");
  if (outcome.state !== "value" || typeof outcome.value !== "string") {
    return { ok: false, reason: "operation_rejected" };
  }
  if (!SEASON_ID.test(source.providerSeasonId) || !SEASON_ID.test(target.providerSeasonId)) {
    return { ok: false, reason: "operation_rejected" };
  }
  const echoes = readEchoes(input);
  if (echoes == null) return { ok: false, reason: "operation_rejected" };
  return {
    ok: true,
    request: {
      env,
      kill,
      protocolFlags,
      endpoint: endpoint.value,
      fixtureId: fixtureId.value,
      canonicalPath: CANONICAL_OPERATION_PATHS[endpoint.value],
      kind: kind.value as Pe5SquadEvidenceKind,
      provenance: provenance.value as Pe5EvidenceProvenance,
      source,
      target,
      script: script.value,
      echoes,
    },
  };
}

function readEchoes(input: object): PreparedRequest["echoes"] | null {
  const echoes: {
    callerPath?: string;
    credentialId?: string;
    approvalId?: string;
    ledgerInstanceId?: string;
    generation?: number;
    canonicalPath?: string;
    operationId?: string;
  } = {};
  const callerPath = optionalString(input, "callerPath");
  const credentialId = optionalString(input, "credentialId");
  const approvalId = optionalString(input, "approvalId");
  const ledgerInstanceId = optionalString(input, "ledgerInstanceId");
  const canonicalPath = optionalString(input, "canonicalPath");
  const operationId = optionalString(input, "operationId");
  const generation = readOwn(input, "generation");
  if (
    callerPath === "invalid" ||
    credentialId === "invalid" ||
    approvalId === "invalid" ||
    ledgerInstanceId === "invalid" ||
    canonicalPath === "invalid" ||
    operationId === "invalid"
  ) {
    return null;
  }
  if (generation.state === "unsafe") return null;
  if (callerPath != null) echoes.callerPath = callerPath;
  if (credentialId != null) echoes.credentialId = credentialId;
  if (approvalId != null) echoes.approvalId = approvalId;
  if (ledgerInstanceId != null) echoes.ledgerInstanceId = ledgerInstanceId;
  if (canonicalPath != null) echoes.canonicalPath = canonicalPath;
  if (operationId != null) echoes.operationId = operationId;
  if (generation.state === "value") {
    if (!isGeneration(generation.value)) return null;
    echoes.generation = generation.value;
  }
  return echoes;
}

function optionalString(record: object, key: string): string | null | "invalid" {
  const read = readOwn(record, key);
  if (read.state === "missing") return null;
  if (read.state !== "value" || typeof read.value !== "string" || !isIdentity(read.value)) return "invalid";
  return read.value;
}

function readFixture(record: object, key: string): FixtureContext | null {
  const read = readOwn(record, key);
  if (read.state !== "value" || !isPlain(read.value) || hasSecretName(read.value)) return null;
  const names = ownNames(read.value);
  if (names == null) return null;
  for (const name of names) {
    if (!FIXTURE_KEYS.has(name)) return null;
  }
  const fixtureId = readOwn(read.value, "fixtureId");
  const kickoffUtc = readOwn(read.value, "kickoffUtc");
  const providerSeasonId = readOwn(read.value, "providerSeasonId");
  if (
    fixtureId.state !== "value" ||
    !isFixtureId(fixtureId.value) ||
    kickoffUtc.state !== "value" ||
    typeof kickoffUtc.value !== "string" ||
    kickoffUtc.value.length === 0 ||
    kickoffUtc.value.trim() !== kickoffUtc.value ||
    providerSeasonId.state !== "value" ||
    typeof providerSeasonId.value !== "string"
  ) {
    return null;
  }
  return {
    fixtureId: fixtureId.value,
    kickoffUtc: kickoffUtc.value,
    providerSeasonId: providerSeasonId.value,
  };
}

function readPlain(record: object, key: string, allowed: ReadonlySet<string>): object | null {
  const read = readOwn(record, key);
  if (read.state !== "value" || !isPlain(read.value) || hasSecretName(read.value)) return null;
  const names = ownNames(read.value);
  if (names == null) return null;
  for (const name of names) {
    if (!allowed.has(name) || readOwn(read.value, name).state === "unsafe") return null;
  }
  return read.value;
}

function flagView(flags: object): { readonly [Key in ProtocolFlagKey]: unknown } {
  const view = {} as { [Key in ProtocolFlagKey]: unknown };
  for (const key of PROTOCOL_FLAG_KEYS) {
    const read = readOwn(flags, key);
    view[key] = read.state === "value" ? read.value : undefined;
  }
  return view;
}

function confirmedTransportFailure(reason: string): boolean {
  return reason === "redirect_rejected" || reason === "timeout" || reason === "cancelled" || reason === "response_incomplete";
}

function toEvidenceObservation(observation: Pe5NormalizedObservation): EvidenceObservation | null {
  if (observation.absenceMeansAvailable !== false || observation.availabilityInference !== "forbidden") return null;
  if (observation.endpoint === "lineups") {
    return {
      endpoint: "lineups",
      fixtureId: observation.fixtureId,
      observation: observation.observation,
      observedValue: observation.observedValue,
      absenceMeansAvailable: false,
      availabilityInference: "forbidden",
      startXiCount: observation.startXiCount,
      substituteCount: observation.substituteCount,
    };
  }
  return {
    endpoint: "injuries",
    fixtureId: observation.fixtureId,
    observation: observation.observation,
    observedValue: observation.observedValue,
    absenceMeansAvailable: false,
    availabilityInference: "forbidden",
    injuryRecordCount: observation.injuryRecordCount,
  };
}

function rejectedRecord(
  context: OrchestratorContext,
  proof: SendProof,
  envelope: RawEnvelopeView,
  reason: Pe5NormalizeReason,
): EvidenceRecordView {
  return {
    operationId: proof.operationId,
    evidenceId: envelope.envelopeId,
    reservationId: proof.reservationId,
    envelopeId: envelope.envelopeId,
    contentDigest: envelope.digest,
    capturedAtUtc: envelope.capturedAtUtc,
    captureTimestampVerified: envelope.captureTimestampVerified,
    ledgerInstanceId: context.ledgerInstanceId,
    approvalId: context.approvalId,
    normalizationStatus: "rejected",
    normalizationReason: reason,
  };
}

function normalizedRecord(
  context: OrchestratorContext,
  proof: SendProof,
  envelope: RawEnvelopeView,
  observation: EvidenceObservation,
  classification: EvidenceClassificationView,
): EvidenceRecordView {
  return {
    operationId: proof.operationId,
    evidenceId: envelope.envelopeId,
    reservationId: proof.reservationId,
    envelopeId: envelope.envelopeId,
    contentDigest: envelope.digest,
    capturedAtUtc: envelope.capturedAtUtc,
    captureTimestampVerified: envelope.captureTimestampVerified,
    ledgerInstanceId: context.ledgerInstanceId,
    approvalId: context.approvalId,
    normalizationStatus: "normalized",
    observation,
    classification,
  };
}

function sameEvidence(left: EvidenceRecordView, right: EvidenceRecordView): boolean {
  if (
    left.operationId !== right.operationId ||
    left.evidenceId !== right.evidenceId ||
    left.reservationId !== right.reservationId ||
    left.envelopeId !== right.envelopeId ||
    left.contentDigest !== right.contentDigest ||
    left.capturedAtUtc !== right.capturedAtUtc ||
    left.captureTimestampVerified !== right.captureTimestampVerified ||
    left.ledgerInstanceId !== right.ledgerInstanceId ||
    left.approvalId !== right.approvalId ||
    left.normalizationStatus !== right.normalizationStatus
  ) {
    return false;
  }
  if (left.normalizationStatus === "rejected" && right.normalizationStatus === "rejected") {
    return left.normalizationReason === right.normalizationReason;
  }
  if (left.normalizationStatus === "normalized" && right.normalizationStatus === "normalized") {
    return sameObservation(left.observation, right.observation) && sameClassification(left.classification, right.classification);
  }
  return false;
}

function sameObservation(left: EvidenceObservation, right: EvidenceObservation): boolean {
  if (
    left.endpoint !== right.endpoint ||
    left.fixtureId !== right.fixtureId ||
    left.observation !== right.observation ||
    left.observedValue !== right.observedValue ||
    left.absenceMeansAvailable !== false ||
    right.absenceMeansAvailable !== false ||
    left.availabilityInference !== "forbidden" ||
    right.availabilityInference !== "forbidden"
  ) {
    return false;
  }
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
    return left.provenance === right.provenance &&
      left.decision.ok === right.decision.ok &&
      left.decision.evidenceClass === right.decision.evidenceClass &&
      left.decision.reason === right.decision.reason &&
      left.decision.targetPrematchEligible === right.decision.targetPrematchEligible &&
      left.decision.laterTargetHistoryEligible === right.decision.laterTargetHistoryEligible &&
      left.decision.numericValue === null &&
      right.decision.numericValue === null &&
      left.decision.retainedObservation === right.decision.retainedObservation &&
      left.decision.availability === right.decision.availability &&
      left.decision.zeroFilled === false &&
      right.decision.zeroFilled === false;
  }
  return false;
}

function readClearKill(
  kill: object,
  now: number,
): { readonly ok: true; readonly kill: ClearKill } | { readonly ok: false; readonly reason: string } {
  const state = readOwn(kill, "state");
  const version = readOwn(kill, "version");
  const updatedAt = readOwn(kill, "updatedAt");
  const maxAgeMs = readOwn(kill, "maxAgeMs");
  if (
    state.state !== "value" ||
    version.state !== "value" ||
    updatedAt.state !== "value" ||
    maxAgeMs.state !== "value"
  ) {
    return { ok: false, reason: "kill_switch_unreadable" };
  }
  if (state.value !== "clear") {
    return { ok: false, reason: state.value === "unreadable" ? "kill_switch_unreadable" : "kill_switch_engaged" };
  }
  if (!isGeneration(version.value) || !isGeneration(updatedAt.value) || !isPositive(maxAgeMs.value)) {
    return { ok: false, reason: "kill_switch_engaged" };
  }
  if (updatedAt.value > now || now - updatedAt.value > maxAgeMs.value) {
    return { ok: false, reason: "kill_switch_stale" };
  }
  return {
    ok: true,
    kill: { state: "clear", version: version.value, updatedAt: updatedAt.value, maxAgeMs: maxAgeMs.value },
  };
}

function snapshotApproval(value: object): AcquisitionApproval | null {
  const mode = readOwn(value, "mode");
  if (mode.state !== "value" || (mode.value !== "offline" && mode.value !== "pilot")) return null;
  const credentialId = readIdentity(value, "credentialId");
  const ledgerInstanceId = readIdentity(value, "ledgerInstanceId");
  const operator = readIdentity(value, "operator");
  if (credentialId == null || ledgerInstanceId == null || operator == null) return null;
  const numbers = {
    researchCeiling: readFinite(value, "researchCeiling"),
    dailyCeiling: readFinite(value, "dailyCeiling"),
    rateCeiling: readFinite(value, "rateCeiling"),
    rateWindowMs: readFinite(value, "rateWindowMs"),
    leaseMs: readFinite(value, "leaseMs"),
    fetchTimeoutMs: readFinite(value, "fetchTimeoutMs"),
    maxAgeMs: readFinite(value, "maxAgeMs"),
    expiry: readFinite(value, "expiry"),
  };
  if (Object.values(numbers).some((item) => item == null)) return null;
  const boundary = readOwn(value, "vendorDayBoundary");
  if (boundary.state !== "value") return null;
  const vendorDayBoundary = snapshotBoundary(boundary.value);
  if (vendorDayBoundary === "invalid") return null;
  if (!isPositive(numbers.fetchTimeoutMs)) return null;
  return Object.freeze({
    mode: mode.value,
    credentialId,
    ledgerInstanceId,
    operator,
    researchCeiling: numbers.researchCeiling as number,
    dailyCeiling: numbers.dailyCeiling as number,
    rateCeiling: numbers.rateCeiling as number,
    rateWindowMs: numbers.rateWindowMs as number,
    leaseMs: numbers.leaseMs as number,
    fetchTimeoutMs: numbers.fetchTimeoutMs as number,
    maxAgeMs: numbers.maxAgeMs as number,
    expiry: numbers.expiry as number,
    vendorDayBoundary,
  });
}

function snapshotBoundary(value: unknown): VendorDayBoundary | null | "invalid" {
  if (value === null) return null;
  if (!isPlain(value)) return "invalid";
  const version = readOwn(value, "version");
  const utcOffsetMs = readOwn(value, "utcOffsetMs");
  const resetOffsetMs = readOwn(value, "resetOffsetMs");
  if (version.state !== "value" || utcOffsetMs.state !== "value" || resetOffsetMs.state !== "value") {
    return "invalid";
  }
  if (version.value !== 1 || typeof utcOffsetMs.value !== "number" || typeof resetOffsetMs.value !== "number") {
    return "invalid";
  }
  return Object.freeze({ version: 1, utcOffsetMs: utcOffsetMs.value, resetOffsetMs: resetOffsetMs.value });
}

function readLag(config: object, names: readonly string[]): number | null | "invalid" {
  if (!names.includes("maxCaptureLagMs")) return null;
  const read = readOwn(config, "maxCaptureLagMs");
  if (read.state !== "value") return "invalid";
  if (read.value == null) return null;
  if (typeof read.value !== "number" || !Number.isSafeInteger(read.value) || read.value < 0) return "invalid";
  return read.value;
}

function readLedgerStamp(
  ledger: MemoryLedger,
): { ledgerInstanceId: string; approvalId: string } | null {
  const kind = readOwn(ledger, "kind");
  const instanceId = readOwn(ledger, "instanceId");
  const approvalId = readOwn(ledger, "approvalId");
  const generation = readOwn(ledger, "generation");
  if (
    kind.state !== "value" ||
    kind.value !== "pe5-memory-ledger" ||
    instanceId.state !== "value" ||
    typeof instanceId.value !== "string" ||
    approvalId.state !== "value" ||
    typeof approvalId.value !== "string" ||
    generation.state !== "value" ||
    generation.value !== 0
  ) {
    return null;
  }
  if (!isIdentity(instanceId.value) || !isIdentity(approvalId.value)) return null;
  return { ledgerInstanceId: instanceId.value, approvalId: approvalId.value };
}

type AcquisitionClock = { now(): number };

async function applyFault(
  context: OrchestratorContext,
  fault: object,
  kind: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  if (kind === "lost-ack") {
    const which = readOwn(fault, "which");
    if (which.state !== "value" || (which.value !== "tryReserve" && which.value !== "beginSend")) {
      return { ok: false, reason: "operation_rejected" };
    }
    const armed = await armLostAcknowledgement(context.ledger, which.value);
    return armed.ok ? { ok: true } : { ok: false, reason: armed.reason };
  }
  if (kind === "unattested-lookup") {
    const armed = await armUnattestedLookup(context.ledger);
    return armed.ok ? { ok: true } : { ok: false, reason: armed.reason };
  }
  if (kind === "ledger-unavailable") return setFlag(fault, (unavailable) => setLedgerUnavailable(context.ledger, unavailable));
  if (kind === "transient-outcome-unavailable") {
    context.transientOutcomeUnavailable = true;
    return { ok: true };
  }
  if (kind === "sticky-outcome-unavailable") {
    context.stickyOutcomeUnavailable = true;
    return { ok: true };
  }
  if (kind === "raw-append-failure") return armRaw(await armRawAppendFailure(context.raw));
  if (kind === "raw-partial-append") return armRaw(await armRawPartialAppend(context.raw));
  if (kind === "lost-raw-ack") return armRaw(await armLostAppendAcknowledgement(context.raw));
  if (kind === "ambiguous-raw-read") return armRaw(await armAmbiguousRawRead(context.raw));
  if (kind === "corrupt-raw-before-read") {
    context.corruptRawBeforeRead = true;
    return { ok: true };
  }
  if (kind === "raw-unavailable") return setFlag(fault, (unavailable) => setRawStoreUnavailable(context.raw, unavailable));
  if (kind === "evidence-append-failure") return armRaw(await armEvidenceAppendFailure(context.evidence));
  if (kind === "lost-evidence-ack") return armRaw(await armLostEvidenceAcknowledgement(context.evidence));
  if (kind === "ambiguous-evidence-read") return armRaw(await armAmbiguousEvidenceRead(context.evidence));
  if (kind === "evidence-unavailable") {
    return setFlag(fault, (unavailable) => setEvidenceLogUnavailable(context.evidence, unavailable));
  }
  if (kind === "external-charge") {
    const operationId = readOwn(fault, "operationId");
    const state = readOwn(fault, "state");
    if (
      operationId.state !== "value" ||
      typeof operationId.value !== "string" ||
      state.state !== "value" ||
      (state.value !== "reserved" && state.value !== "sending" && state.value !== "consumed" && state.value !== "failed")
    ) {
      return { ok: false, reason: "operation_rejected" };
    }
    const inserted = await insertExternalCharge(context.ledger, { operationId: operationId.value, state: state.value });
    if (!inserted.ok) return { ok: false, reason: inserted.reason === "denied" ? inserted.denyReason : inserted.reason };
    return { ok: true };
  }
  if (kind === "replace-kill") {
    const record = readOwn(fault, "record");
    if (record.state !== "value") return { ok: false, reason: "operation_rejected" };
    const replaced = await replaceKillSwitch(context.ledger, record.value);
    return replaced.ok ? { ok: true } : { ok: false, reason: replaced.reason };
  }
  if (kind === "replace-vendor-day") {
    const boundary = readOwn(fault, "boundary");
    if (boundary.state !== "value") return { ok: false, reason: "operation_rejected" };
    const replaced = await replaceVendorDayBoundaryForTests(context.ledger, boundary.value);
    return replaced.ok ? { ok: true } : { ok: false, reason: replaced.reason };
  }
  if (kind === "seed-evidence") {
    const input = readOwn(fault, "input");
    if (input.state !== "value") return { ok: false, reason: "operation_rejected" };
    const seeded = await appendEvidence(context.evidence, input.value);
    return seeded.ok ? { ok: true } : { ok: false, reason: seeded.reason };
  }
  return { ok: false, reason: "operation_rejected" };
}

async function setFlag(
  fault: object,
  apply: (unavailable: boolean) => Promise<{ ok: boolean; reason?: string }>,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  const unavailable = readOwn(fault, "unavailable");
  if (unavailable.state !== "value" || typeof unavailable.value !== "boolean") {
    return { ok: false, reason: "operation_rejected" };
  }
  const result = await apply(unavailable.value);
  return result.ok ? { ok: true } : { ok: false, reason: result.reason ?? "unavailable" };
}

function armRaw(result: { ok: boolean; reason?: string }): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  return result.ok ? { ok: true } : { ok: false, reason: result.reason ?? "unavailable" };
}

function denied(reason: string, operationId: string | null, reservationId: string | null): Pe5OrchestratorResult {
  return { ok: false, outcome: "denied", reason, operationId, reservationId };
}

function rejected(reason: string, operationId: string | null, reservationId: string | null): Pe5OrchestratorResult {
  return { ok: false, outcome: "rejected", reason, operationId, reservationId };
}

function failed(reason: string, operationId: string, reservationId: string): Pe5OrchestratorResult {
  return { ok: false, outcome: "failed", reason, operationId, reservationId };
}

function unknown(operationId: string | null, reservationId: string | null): Pe5OrchestratorResult {
  return { ok: false, outcome: "unknown", reason: "outcome_unknown", operationId, reservationId };
}

function ambiguous(operationId: string | null, reservationId: string | null): Pe5OrchestratorResult {
  return { ok: false, outcome: "ambiguous", reason: "ambiguous", operationId, reservationId };
}

function rejectedFactory(): { readonly ok: false; readonly reason: "operation_rejected" } {
  return { ok: false, reason: "operation_rejected" };
}

function decodeBody(bytes: Uint8Array): unknown {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    return bytes;
  }
}

function digestOf(bytes: Uint8Array): string | null {
  try {
    const digest = createHash("sha256").update(bytes).digest("hex");
    return DIGEST.test(digest) ? digest : null;
  } catch {
    return null;
  }
}

function copyBytes(value: Uint8Array): Uint8Array | null {
  try {
    if (types.isProxy(value) === true || types.isUint8Array(value) !== true) return null;
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return copy.byteLength === value.byteLength ? copy : null;
  } catch {
    return null;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function readContext(value: unknown): OrchestratorContext | null {
  try {
    if (!isPlain(value)) return null;
    const kind = readOwn(value, "kind");
    if (kind.state !== "value" || kind.value !== "pe5-offline-orchestrator") return null;
    return CONTEXTS.get(value) ?? null;
  } catch {
    return null;
  }
}

function readIdentity(record: object, key: string): string | null {
  const read = readOwn(record, key);
  if (read.state !== "value" || !isIdentity(read.value)) return null;
  return read.value;
}

function readFinite(record: object, key: string): number | null {
  const read = readOwn(record, key);
  if (read.state !== "value" || typeof read.value !== "number" || !Number.isFinite(read.value)) return null;
  return read.value;
}

function isFixtureId(value: unknown): value is string {
  return typeof value === "string" && FIXTURE_ID.test(value);
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value && !/[\r\n]/.test(value);
}

function isGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function isFailReason(value: unknown): value is Pe5FailReason {
  return typeof value === "string" && FAIL_REASONS.has(value);
}

function isEvidenceClass(value: unknown): value is Pe5EvidenceClass {
  return (
    value === "PROSPECTIVE_PREMATCH_SNAPSHOT" ||
    value === "REALIZED_MATCHDAY_HISTORY" ||
    value === "CURRENT_SNAPSHOT_UNPROVEN" ||
    value === "SAME_MATCH_OR_POST_MATCH_EXCLUDED" ||
    value === "UNSUPPORTED_OR_UNAVAILABLE"
  );
}

function hasSecretName(record: object): boolean {
  const names = ownNames(record);
  if (names == null) return true;
  return names.some((name) => SECRET_KEY.test(name));
}

function isPlain(value: unknown): value is object {
  try {
    if (typeof value !== "object" || value === null) return false;
    if (types.isProxy(value) === true) return false;
    if (Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownNames(record: object): string[] | null {
  try {
    if (Object.getOwnPropertySymbols(record).length !== 0) return null;
    return Object.getOwnPropertyNames(record);
  } catch {
    return null;
  }
}

function readOwn(record: object, key: string): OwnRead {
  let descriptor: PropertyDescriptor | undefined;
  try {
    if (types.isProxy(record) === true) return { state: "unsafe" };
    descriptor = Object.getOwnPropertyDescriptor(record, key);
  } catch {
    return { state: "unsafe" };
  }
  if (descriptor == null) return { state: "missing" };
  if (!Object.hasOwn(descriptor, "value") || descriptor.get != null || descriptor.set != null) {
    return { state: "unsafe" };
  }
  return { state: "value", value: descriptor.value };
}
