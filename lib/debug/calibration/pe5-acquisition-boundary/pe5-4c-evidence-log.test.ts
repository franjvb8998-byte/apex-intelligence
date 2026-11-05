/**
 * PE-5.4C increment 8 stage 2A — offline evidence-log tests.
 * No provider calls, no environment reads, no sealed 2025 outcome reads.
 *
 * A green run proves same-instance visibility only. It does not prove disk
 * durability, process survival, or that a ledger caller recorded evidence.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  PE5_4C_EVIDENCE_LOG_LIMIT,
  appendEvidence,
  armAmbiguousEvidenceRead,
  armEvidenceAppendFailure,
  armLostEvidenceAcknowledgement,
  createEvidenceLog,
  isRegisteredEvidenceLog,
  readEvidence,
  readEvidenceAudit,
  setEvidenceLogUnavailable,
  type EvidenceObservation,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/evidence-log";
import {
  createMemoryLedger,
  readSnapshot,
  replaceKillSwitch,
  tryReserve,
  type LedgerSnapshot,
  type MemoryLedger,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/memory-ledger";
import { deriveOperationId } from "@/lib/debug/calibration/pe5-acquisition-boundary/operation-id";
import type { Pe5FailReason } from "@/lib/debug/calibration/pe5-availability/protocol";
import type {
  AcquisitionApproval,
  ProtocolFlagSnapshot,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/types";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const CLOCK = "2026-01-15T12:00:00.000Z";
const MAX_AGE_MS = 60_000;
const INSTANCE = "ledger-a";
const CREDENTIAL = "cred-research";
const SECRET = "super-secret-key";
const PLAYER = "Bukayo Saka";
const URL = "https://provider.example/next";
const DIGEST = "ab".repeat(32);
const DIGEST_B = "cd".repeat(32);
const LEGACY_STATE = Symbol.for("apex.pe5.acquisition-boundary.evidence-log.state.v1");

const OFFLINE_UTC_MIDNIGHT = {
  version: 1 as const,
  utcOffsetMs: 0,
  resetOffsetMs: 0,
};

function makeClock(start = NOW) {
  const value = start;
  return {
    now() {
      return value;
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

function clearKill(now = NOW) {
  return { state: "clear" as const, version: 1, updatedAt: now, maxAgeMs: MAX_AGE_MS };
}

function operationFor(fixtureId: string, ledgerInstanceId = INSTANCE): string {
  const derived = deriveOperationId(
    {
      ledgerInstanceId,
      credentialId: CREDENTIAL,
      approvalId: `approval:${ledgerInstanceId}`,
      generation: 0,
    },
    { endpoint: "lineups", fixtureId },
  );
  if (!derived.ok) throw new Error("canonical operation id was rejected");
  return derived.operationId;
}

function identity(fixtureId: string, reservationId = "res-1", contentDigest = DIGEST) {
  const operationId = operationFor(fixtureId);
  const evidenceId = `env-${operationId}`;
  return { operationId, envelopeId: evidenceId, evidenceId, reservationId, contentDigest };
}

function lineup(
  fixtureId: string,
  observedValue = 2,
  substituteCount = 1,
): EvidenceObservation {
  return {
    endpoint: "lineups",
    fixtureId,
    observation: "present",
    observedValue,
    absenceMeansAvailable: false,
    availabilityInference: "forbidden",
    startXiCount: observedValue,
    substituteCount,
  };
}

function missingLineup(fixtureId: string): EvidenceObservation {
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

function eligibleDecision(observedValue: number, targetPrematchEligible = true) {
  return {
    ok: true as const,
    evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT" as const,
    reason: "classified" as const,
    targetPrematchEligible,
    laterTargetHistoryEligible: !targetPrematchEligible,
    numericValue: null,
    retainedObservation: observedValue,
    availability: "classified" as const,
    zeroFilled: false as const,
  };
}

function rejectedDecision(
  reason: Pe5FailReason,
  evidenceClass:
    | "UNSUPPORTED_OR_UNAVAILABLE"
    | "CURRENT_SNAPSHOT_UNPROVEN"
    | "SAME_MATCH_OR_POST_MATCH_EXCLUDED" = "UNSUPPORTED_OR_UNAVAILABLE",
) {
  return {
    ok: false as const,
    evidenceClass,
    reason,
    targetPrematchEligible: false as const,
    laterTargetHistoryEligible: false as const,
    numericValue: null,
    retainedObservation: null,
    availability: "unavailable" as const,
    zeroFilled: false as const,
  };
}

function normalizedInput(
  fixtureId: string,
  observation: EvidenceObservation = lineup(fixtureId),
  extras: Record<string, unknown> = {},
) {
  const observedValue = observation.observedValue ?? 0;
  return {
    ...identity(fixtureId),
    capturedAtUtc: CLOCK,
    captureTimestampVerified: true,
    normalizationStatus: "normalized" as const,
    observation,
    classification: {
      status: "classified" as const,
      provenance: "prospective_snapshot" as const,
      decision: eligibleDecision(observedValue),
    },
    ...extras,
  };
}

function rejectedInput(fixtureId: string, reason = "malformed_response") {
  return {
    ...identity(fixtureId),
    capturedAtUtc: CLOCK,
    captureTimestampVerified: true,
    normalizationStatus: "rejected" as const,
    normalizationReason: reason,
  };
}

function skippedInput(
  fixtureId: string,
  capturedAtUtc: string | null,
  reason: "capture_timestamp_unverified" | "missing_capture_timestamp",
) {
  return {
    ...identity(fixtureId),
    capturedAtUtc,
    captureTimestampVerified: capturedAtUtc == null ? false : false,
    normalizationStatus: "normalized" as const,
    observation: lineup(fixtureId),
    classification: { status: "skipped" as const, reason },
  };
}

function expectNoSentinels(value: unknown) {
  const rendered = JSON.stringify(value);
  expect(rendered).not.toContain(SECRET);
  expect(rendered).not.toContain(PLAYER);
  expect(rendered).not.toContain(URL);
}

async function mustSnapshot(ledger: MemoryLedger): Promise<LedgerSnapshot> {
  const read = await readSnapshot(ledger);
  expect(read.ok).toBe(true);
  if (!read.ok) throw new Error("snapshot unavailable");
  return read.snapshot;
}

async function openLedger(instanceId = INSTANCE) {
  const ledger = createMemoryLedger({
    approval: approval({ ledgerInstanceId: instanceId }),
    clock: makeClock(),
  });
  expect(await replaceKillSwitch(ledger, clearKill())).toEqual({ ok: true });
  return ledger;
}

describe("PE-5.4C increment 8 stage 2A evidence log", () => {
  it("registers only the genuine factory handle", () => {
    const log = createEvidenceLog({});
    expect(isRegisteredEvidenceLog(log)).toBe(true);
    expect(Object.getOwnPropertySymbols(log)).toEqual([]);
    expect(Object.getOwnPropertyDescriptor(log, LEGACY_STATE)).toBeUndefined();
    expect(isRegisteredEvidenceLog({ kind: "pe5-evidence-log" })).toBe(false);
    expect(isRegisteredEvidenceLog(Object.assign({}, log))).toBe(false);
    expect(isRegisteredEvidenceLog(Object.create(log))).toBe(false);
    expect(isRegisteredEvidenceLog(null)).toBe(false);
  });

  it("appends one normalized snapshot and reads a defensive copy", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1001");
    const appended = await appendEvidence(log, input);
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(appended.duplicate).toBe(false);
    expect(appended.record).toMatchObject({
      operationId: input.operationId,
      evidenceId: input.evidenceId,
      envelopeId: input.envelopeId,
      reservationId: "res-1",
      contentDigest: DIGEST,
      capturedAtUtc: CLOCK,
      captureTimestampVerified: true,
      ledgerInstanceId: null,
      approvalId: null,
      normalizationStatus: "normalized",
      observation: lineup("1001"),
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: eligibleDecision(2),
      },
    });
    expect(appended.record).not.toHaveProperty("normalizationReason");
    expect(appended.record).not.toHaveProperty("bodyBytes");
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read).toEqual({ ok: true, record: appended.record });
    const byEvidence = await readEvidence(log, { evidenceId: input.evidenceId });
    expect(byEvidence).toEqual(read);
  });

  it("returns duplicate for the identical canonical snapshot", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1002");
    const first = await appendEvidence(log, input);
    const second = await appendEvidence(log, input);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second).toEqual({ ok: true, duplicate: true, record: first.record });
    const audit = await readEvidenceAudit(log);
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    expect(audit.audits.map((entry) => entry.action)).toEqual(["append", "append_duplicate"]);
  });

  it("keeps the original record when a second snapshot conflicts", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1003");
    const first = await appendEvidence(log, input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const conflict = await appendEvidence(log, {
      ...input,
      contentDigest: DIGEST_B,
    });
    expect(conflict).toEqual({ ok: false, reason: "evidence_conflict" });
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read).toEqual({ ok: true, record: first.record });
    if (!read.ok) return;
    expect(read.record.normalizationStatus === "normalized" && read.record.contentDigest).toBe(DIGEST);
  });

  it("lets one of two identical concurrent appends win and marks the other duplicate", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1004");
    const [left, right] = await Promise.all([
      appendEvidence(log, input),
      appendEvidence(log, input),
    ]);
    const results = [left, right];
    expect(results.filter((result) => result.ok && result.duplicate === false)).toHaveLength(1);
    expect(results.filter((result) => result.ok && result.duplicate === true)).toHaveLength(1);
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok || !left.ok || !right.ok) return;
    expect(left.record).toEqual(right.record);
    expect(read.record).toEqual(left.record);
  });

  it("does not let a concurrent conflicting append replace the winner", async () => {
    const log = createEvidenceLog({});
    const fixtureId = "1005";
    const base = identity(fixtureId);
    const firstInput = normalizedInput(fixtureId, lineup(fixtureId, 2, 0));
    const secondInput = normalizedInput(fixtureId, lineup(fixtureId, 4, 0));
    const [left, right] = await Promise.all([
      appendEvidence(log, firstInput),
      appendEvidence(log, secondInput),
    ]);
    const success = [left, right].filter((result) => result.ok && result.duplicate === false);
    const conflict = [left, right].filter((result) => !result.ok && result.reason === "evidence_conflict");
    expect(success).toHaveLength(1);
    expect(conflict).toHaveLength(1);
    const read = await readEvidence(log, { operationId: base.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok || !success[0]?.ok) return;
    expect(read.record).toEqual(success[0].record);
    const again = await appendEvidence(
      log,
      read.record.normalizationStatus === "normalized" &&
        read.record.observation.observedValue === 2
        ? secondInput
        : firstInput,
    );
    expect(again).toEqual({ ok: false, reason: "evidence_conflict" });
    const after = await readEvidence(log, { evidenceId: base.evidenceId });
    expect(after).toEqual(read);
  });

  it("copies caller input before the append settles", async () => {
    const log = createEvidenceLog({});
    const observation = lineup("1006") as EvidenceObservation & {
      observedValue: number;
      startXiCount: number;
    };
    const input = normalizedInput("1006", observation);
    const pending = appendEvidence(log, input);
    observation.observedValue = 9;
    observation.startXiCount = 9;
    input.contentDigest = DIGEST_B;
    const appended = await pending;
    expect(appended.ok).toBe(true);
    if (!appended.ok || appended.record.normalizationStatus !== "normalized") return;
    expect(appended.record.observation.observedValue).toBe(2);
    expect(appended.record.contentDigest).toBe(DIGEST);
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read).toEqual({ ok: true, record: appended.record });
  });

  it("does not let a returned record or audit mutate stored evidence", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1007");
    const appended = await appendEvidence(log, input);
    expect(appended.ok).toBe(true);
    if (!appended.ok || appended.record.normalizationStatus !== "normalized") return;
    const observation = appended.record.observation;
    expect(() => {
      (observation as { observedValue: number }).observedValue = 8;
    }).toThrow(TypeError);
    const audit = await readEvidenceAudit(log);
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    expect(audit.audits.length).toBeGreaterThan(0);
    expect(() => {
      (audit.audits as unknown as { push: (value: unknown) => number }).push({ action: "append" });
    }).toThrow(TypeError);
    expect(() => {
      (audit.audits[0] as { reason?: string }).reason = SECRET;
    }).toThrow(TypeError);
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok || read.record.normalizationStatus !== "normalized") return;
    expect(read.record.observation.observedValue).toBe(2);
    const reread = await readEvidenceAudit(log);
    expect(reread.ok).toBe(true);
    if (!reread.ok) return;
    expect(reread.audits.some((entry) => JSON.stringify(entry).includes(SECRET))).toBe(false);
  });

  it("reports an attested append failure and leaves no record", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1008");
    expect(await armEvidenceAppendFailure(log)).toEqual({ ok: true });
    expect(await appendEvidence(log, input)).toEqual({ ok: false, reason: "evidence_missing" });
    expect(await readEvidence(log, { operationId: input.operationId })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });
    const stored = await appendEvidence(log, input);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.duplicate).toBe(false);
  });

  it("withholds a lost acknowledgement without treating it as absence", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1009");
    expect(await armLostEvidenceAcknowledgement(log)).toEqual({ ok: true });
    const lost = await appendEvidence(log, input);
    expect(lost).toEqual({ ok: false, reason: "ambiguous" });
    expect(lost).not.toEqual({ ok: false, reason: "evidence_missing" });
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.record.normalizationStatus).toBe("normalized");
    expect(read.record.contentDigest).toBe(DIGEST);
  });

  it("makes one read ambiguous and the next read confirming", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1010");
    const stored = await appendEvidence(log, input);
    expect(stored.ok).toBe(true);
    expect(await armAmbiguousEvidenceRead(log)).toEqual({ ok: true });
    const ambiguous = await readEvidence(log, { operationId: input.operationId });
    expect(ambiguous).toEqual({ ok: false, reason: "ambiguous" });
    const confirmed = await readEvidence(log, { evidenceId: input.evidenceId });
    expect(confirmed.ok).toBe(true);
    if (!stored.ok || !confirmed.ok) return;
    expect(confirmed.record).toEqual(stored.record);
  });

  it("reconciles a lost acknowledgement by an exact read, duplicate, and conflict", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1011");
    expect(await armLostEvidenceAcknowledgement(log)).toEqual({ ok: true });
    expect(await appendEvidence(log, input)).toEqual({ ok: false, reason: "ambiguous" });
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.record).toMatchObject({
      operationId: input.operationId,
      evidenceId: input.evidenceId,
      contentDigest: DIGEST,
      normalizationStatus: "normalized",
    });
    const duplicate = await appendEvidence(log, input);
    expect(duplicate).toEqual({ ok: true, duplicate: true, record: read.record });
    const conflict = await appendEvidence(log, { ...input, reservationId: "res-2" });
    expect(conflict).toEqual({ ok: false, reason: "evidence_conflict" });
    const after = await readEvidence(log, { operationId: input.operationId });
    expect(after).toEqual(read);
  });

  it("stores a rejected normalization as a reason without an observation", async () => {
    const log = createEvidenceLog({});
    const input = rejectedInput("1012", "unexpected_pagination");
    const appended = await appendEvidence(log, input);
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(appended.record.normalizationStatus).toBe("rejected");
    if (appended.record.normalizationStatus !== "rejected") return;
    expect(appended.record.normalizationReason).toBe("unexpected_pagination");
    expect(appended.record).not.toHaveProperty("observation");
    expect(appended.record).not.toHaveProperty("classification");
    const smuggled = await appendEvidence(log, {
      ...input,
      observation: lineup("1012"),
    });
    expect(smuggled).toEqual({ ok: false, reason: "operation_rejected" });
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read).toEqual({ ok: true, record: appended.record });
  });

  it("records a classifier rejection without treating it as eligible evidence", async () => {
    const log = createEvidenceLog({});
    const observation = missingLineup("1013");
    const appended = await appendEvidence(log, {
      ...identity("1013"),
      capturedAtUtc: CLOCK,
      captureTimestampVerified: true,
      normalizationStatus: "normalized",
      observation,
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: rejectedDecision("missing_observation"),
      },
    });
    expect(appended.ok).toBe(true);
    if (!appended.ok || appended.record.normalizationStatus !== "normalized") return;
    expect(appended.record.classification).toEqual({
      status: "classified",
      provenance: "prospective_snapshot",
      decision: rejectedDecision("missing_observation"),
    });
    if (appended.record.classification.status !== "classified") return;
    expect(appended.record.classification.decision.ok).toBe(false);
    expect(appended.record.classification.decision.targetPrematchEligible).toBe(false);
    expect(appended.record.classification.decision.numericValue).toBeNull();
    expect(appended.record.observation).toEqual(observation);
  });

  it("skips classification when the capture clock is unverified and refuses a prospective class", async () => {
    const log = createEvidenceLog({});
    const input = skippedInput("1014", CLOCK, "capture_timestamp_unverified");
    const appended = await appendEvidence(log, input);
    expect(appended.ok).toBe(true);
    if (!appended.ok || appended.record.normalizationStatus !== "normalized") return;
    expect(appended.record.captureTimestampVerified).toBe(false);
    expect(appended.record.classification).toEqual({
      status: "skipped",
      reason: "capture_timestamp_unverified",
    });
    expect(JSON.stringify(appended.record)).not.toContain("PROSPECTIVE_PREMATCH_SNAPSHOT");
    const promoted = await appendEvidence(log, {
      ...normalizedInput("1015"),
      captureTimestampVerified: false,
    });
    expect(promoted).toEqual({ ok: false, reason: "operation_rejected" });
    expect(await readEvidence(log, { operationId: operationFor("1015") })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });
  });

  it("skips classification when the capture timestamp is missing", async () => {
    const log = createEvidenceLog({});
    const input = {
      ...skippedInput("1016", null, "missing_capture_timestamp"),
      captureTimestampVerified: true,
    };
    const appended = await appendEvidence(log, input);
    expect(appended.ok).toBe(true);
    if (!appended.ok || appended.record.normalizationStatus !== "normalized") return;
    expect(appended.record.capturedAtUtc).toBeNull();
    expect(appended.record.classification).toEqual({
      status: "skipped",
      reason: "missing_capture_timestamp",
    });
    const wrongReason = await appendEvidence(log, {
      ...input,
      ...identity("1017"),
      classification: { status: "skipped", reason: "capture_timestamp_unverified" },
    });
    expect(wrongReason).toEqual({ ok: false, reason: "operation_rejected" });
    const current = await appendEvidence(log, {
      ...normalizedInput("1018"),
      classification: {
        status: "classified",
        provenance: "current_snapshot",
        decision: eligibleDecision(2),
      },
    });
    expect(current).toEqual({ ok: false, reason: "operation_rejected" });
    expectNoSentinels(current);
    expect(await readEvidence(log, { operationId: operationFor("1018") })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });
  });

  it("rejects identity mismatches without creating a record", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1019");
    const other = operationFor("1099");
    const cases = [
      { ...input, evidenceId: `env-${other}` },
      { ...input, envelopeId: `env-${other}` },
      { ...input, evidenceId: input.envelopeId, envelopeId: `env-${other}` },
      { ...input, reservationId: " res-1" },
      { ...input, operationId: other, evidenceId: input.evidenceId, envelopeId: input.envelopeId },
    ];
    for (const candidate of cases) {
      expect(await appendEvidence(log, candidate)).toEqual({
        ok: false,
        reason: "operation_rejected",
      });
    }
    expect(await readEvidence(log, { operationId: input.operationId })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });
    expect(await readEvidence(log, {
      operationId: input.operationId,
      evidenceId: `env-${other}`,
    })).toEqual({ ok: false, reason: "operation_rejected" });
  });

  it("rejects an invalid digest without echoing it", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1020");
    for (const contentDigest of ["AB".repeat(32), "ab", PLAYER, `${SECRET}-digest`, ""]) {
      const rejected = await appendEvidence(log, { ...input, contentDigest });
      expect(rejected).toEqual({ ok: false, reason: "invalid_digest" });
      expectNoSentinels(rejected);
    }
    expect(await readEvidence(log, { operationId: input.operationId })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });
  });

  it("rejects reason codes outside the existing allowlists", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1021");
    const badReason = await appendEvidence(log, {
      ...rejectedInput("1021"),
      normalizationReason: `${PLAYER} failed`,
    });
    expect(badReason).toEqual({ ok: false, reason: "operation_rejected" });
    expectNoSentinels(badReason);
    const badDecision = await appendEvidence(log, {
      ...input,
      classification: {
        status: "classified",
        decision: { ...eligibleDecision(2), reason: "player_unavailable", numericValue: 4 },
      },
    });
    expect(badDecision).toEqual({ ok: false, reason: "operation_rejected" });
    expectNoSentinels(badDecision);
    const coerced = await appendEvidence(log, {
      ...input,
      observation: { ...missingLineup("1021"), observedValue: 0 },
    });
    expect(coerced).toEqual({ ok: false, reason: "operation_rejected" });
    const stored = await appendEvidence(log, rejectedInput("1022", "missing_coerced_to_zero"));
    expect(stored.ok).toBe(true);
    if (!stored.ok || stored.record.normalizationStatus !== "rejected") return;
    expect(stored.record.normalizationReason).toBe("missing_coerced_to_zero");
  });

  it("keeps secrets, player names, urls, and header values out of records, audits, and errors", async () => {
    const log = createEvidenceLog({});
    const hits = { count: 0 };
    const observation = lineup("1023");
    Object.defineProperty(observation, "player", {
      enumerable: true,
      get() {
        hits.count += 1;
        return PLAYER;
      },
    });
    Object.defineProperty(observation, "body", {
      enumerable: true,
      value: `${SECRET} ${URL}`,
    });
    const rejected = await appendEvidence(log, {
      ...normalizedInput("1023", observation),
      headers: { "x-ratelimit-requests-remaining": "0" },
      bodyBytes: Uint8Array.of(1, 2, 3),
    });
    expect(rejected).toEqual({ ok: false, reason: "operation_rejected" });
    expect(hits.count).toBe(0);
    expectNoSentinels(rejected);

    const stored = await appendEvidence(log, normalizedInput("1023"));
    expect(stored.ok).toBe(true);
    expectNoSentinels(stored);
    const read = await readEvidence(log, { operationId: operationFor("1023") });
    expectNoSentinels(read);
    const audit = await readEvidenceAudit(log);
    expectNoSentinels(audit);
    expect(hits.count).toBe(0);
  });

  it("keeps independent logs from seeing each other's records", async () => {
    const left = createEvidenceLog({});
    const right = createEvidenceLog({});
    const input = normalizedInput("1024");
    expect((await appendEvidence(left, input)).ok).toBe(true);
    expect(await readEvidence(right, { operationId: input.operationId })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });
    expect((await readEvidence(left, { operationId: input.operationId })).ok).toBe(true);
  });

  it("binds only a registered ledger and keeps those logs apart", async () => {
    const leftLedger = await openLedger("ledger-left");
    const rightLedger = await openLedger("ledger-right");
    const left = createEvidenceLog({ ledger: leftLedger });
    const right = createEvidenceLog({ ledger: rightLedger });
    const beforeLeft = await mustSnapshot(leftLedger);
    const beforeRight = await mustSnapshot(rightLedger);
    const leftId = operationFor("1025", "ledger-left");
    const rightId = operationFor("1025", "ledger-right");
    const leftInput = {
      ...normalizedInput("1025"),
      operationId: leftId,
      envelopeId: `env-${leftId}`,
      evidenceId: `env-${leftId}`,
    };
    const rightInput = {
      ...normalizedInput("1025"),
      operationId: rightId,
      envelopeId: `env-${rightId}`,
      evidenceId: `env-${rightId}`,
      contentDigest: DIGEST_B,
    };
    const leftStored = await appendEvidence(left, leftInput);
    const rightStored = await appendEvidence(right, rightInput);
    expect(leftStored.ok && rightStored.ok).toBe(true);
    if (!leftStored.ok || !rightStored.ok) return;
    expect(leftStored.record.ledgerInstanceId).toBe("ledger-left");
    expect(leftStored.record.approvalId).toBe("approval:ledger-left");
    expect(rightStored.record.ledgerInstanceId).toBe("ledger-right");
    expect(await readEvidence(left, { operationId: rightId })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });
    expect(await readEvidence(right, { operationId: leftId })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });

    const forgedLedger = {
      kind: "pe5-memory-ledger" as const,
      instanceId: leftLedger.instanceId,
      approvalId: leftLedger.approvalId,
      generation: 0 as const,
      allowRegeneration: false as const,
    };
    const copiedLedger = {
      kind: leftLedger.kind,
      instanceId: leftLedger.instanceId,
      approvalId: leftLedger.approvalId,
      generation: leftLedger.generation,
      allowRegeneration: leftLedger.allowRegeneration,
    };
    const hits = { get: 0, desc: 0 };
    const proxyLedger = new Proxy(leftLedger, {
      get() {
        hits.get += 1;
        return "pe5-memory-ledger";
      },
      getOwnPropertyDescriptor() {
        hits.desc += 1;
        return undefined;
      },
    });
    for (const candidate of [forgedLedger, copiedLedger, Object.create(leftLedger), proxyLedger]) {
      const unbound = createEvidenceLog({ ledger: candidate as never });
      expect(isRegisteredEvidenceLog(unbound)).toBe(true);
      expect(await appendEvidence(unbound, leftInput)).toEqual({ ok: false, reason: "unavailable" });
      expect(await readEvidence(unbound, { operationId: leftId })).toEqual({
        ok: false,
        reason: "unavailable",
      });
    }
    expect(hits).toEqual({ get: 0, desc: 0 });
    expect(await mustSnapshot(leftLedger)).toEqual(beforeLeft);
    expect(await mustSnapshot(rightLedger)).toEqual(beforeRight);
    const still = await readEvidence(left, { operationId: leftId });
    expect(still).toEqual({ ok: true, record: leftStored.record });
  });

  it("does not change ledger occupancy, rows, or audits", async () => {
    const ledger = await openLedger();
    const operationId = operationFor("1026");
    const reserved = await tryReserve(ledger, {
      operationId,
      protocolFlags: openFlags(),
      endpoint: "lineups",
      fixtureId: "1026",
    });
    expect(reserved.ok).toBe(true);
    const before = await mustSnapshot(ledger);
    const log = createEvidenceLog({ ledger });
    const input = {
      ...normalizedInput("1026"),
      operationId,
      envelopeId: `env-${operationId}`,
      evidenceId: `env-${operationId}`,
    };
    expect((await appendEvidence(log, input)).ok).toBe(true);
    expect((await appendEvidence(log, input)).ok).toBe(true);
    expect(await appendEvidence(log, { ...input, contentDigest: DIGEST_B })).toEqual({
      ok: false,
      reason: "evidence_conflict",
    });
    expect(await armEvidenceAppendFailure(log)).toEqual({ ok: true });
    expect(await armLostEvidenceAcknowledgement(log)).toEqual({ ok: true });
    expect(await armAmbiguousEvidenceRead(log)).toEqual({ ok: true });
    expect((await readEvidence(log, { operationId })).ok).toBe(false);
    expect(await readEvidenceAudit(log)).toMatchObject({ ok: true });
    expect(await mustSnapshot(ledger)).toEqual(before);
    expect(before.occupancy.research).toBe(1);
    expect(before.rows[0]?.state).toBe("reserved");
  });

  it("fails closed for forged, copied, prototype, proxy, and hostile handles", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1027");
    const stored = await appendEvidence(log, input);
    expect(stored.ok).toBe(true);
    const query = { operationId: input.operationId };
    const forged = { kind: "pe5-evidence-log" };
    const symbolShell = { kind: "pe5-evidence-log" };
    Object.defineProperty(symbolShell, LEGACY_STATE, {
      value: { kind: "pe5-evidence-log-state", records: new Map() },
      enumerable: false,
    });
    const shells = [forged, symbolShell, Object.create(log), Object.assign({}, log)];
    for (const shell of shells) {
      expect(isRegisteredEvidenceLog(shell)).toBe(false);
      expect(await readEvidence(shell as never, query)).toEqual({ ok: false, reason: "unavailable" });
      expect(await appendEvidence(shell as never, input)).toEqual({ ok: false, reason: "unavailable" });
    }

    const hits = { get: 0, desc: 0, keys: 0 };
    const proxy = new Proxy(log, {
      get() {
        hits.get += 1;
        return "pe5-evidence-log";
      },
      getOwnPropertyDescriptor() {
        hits.desc += 1;
        return undefined;
      },
      ownKeys() {
        hits.keys += 1;
        return [];
      },
    });
    expect(await readEvidence(proxy, query)).toEqual({ ok: false, reason: "unavailable" });
    expect(await appendEvidence(proxy, input)).toEqual({ ok: false, reason: "unavailable" });
    expect(isRegisteredEvidenceLog(proxy)).toBe(false);

    const secret = "SECRET-LOG-KIND";
    const revocable = Proxy.revocable(log, {
      get() {
        hits.get += 1;
        throw new Error(secret);
      },
    });
    revocable.revoke();
    let escaped = "";
    let revoked: unknown;
    try {
      revoked = await readEvidence(revocable.proxy, query);
    } catch (error) {
      escaped = error instanceof Error ? error.message : String(error);
    }
    expect(escaped).toBe("");
    expect(revoked).toEqual({ ok: false, reason: "unavailable" });
    expect(JSON.stringify(revoked)).not.toContain(secret);

    const hostile = {};
    Object.defineProperty(hostile, "kind", {
      enumerable: true,
      get() {
        hits.get += 1;
        throw new Error(secret);
      },
    });
    const calls = [
      () => readEvidence(hostile as never, query),
      () => appendEvidence(hostile as never, input),
      () => readEvidenceAudit(hostile as never),
      () => setEvidenceLogUnavailable(hostile as never, true),
      () => armEvidenceAppendFailure(hostile as never),
      () => armLostEvidenceAcknowledgement(hostile as never),
      () => armAmbiguousEvidenceRead(hostile as never),
    ];
    for (const call of calls) {
      let leaked = "";
      let result: unknown;
      try {
        result = await call();
      } catch (error) {
        leaked = error instanceof Error ? error.message : String(error);
      }
      expect(leaked).toBe("");
      expect(result).toEqual({ ok: false, reason: "unavailable" });
      expectNoSentinels(result);
    }
    expect(hits).toEqual({ get: 0, desc: 0, keys: 0 });
    const preserved = await readEvidence(log, query);
    expect(preserved.ok).toBe(true);
    if (!preserved.ok || !stored.ok) return;
    expect(preserved.record).toEqual(stored.record);
  });

  it("rejects hostile input objects without invoking traps", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1028");
    const hits = { count: 0 };
    const live = new Proxy(input, {
      get() {
        hits.count += 1;
        return PLAYER;
      },
    });
    expect(await appendEvidence(log, live)).toEqual({ ok: false, reason: "operation_rejected" });
    const revocable = Proxy.revocable(input, {
      get() {
        hits.count += 1;
        return SECRET;
      },
    });
    revocable.revoke();
    expect(await appendEvidence(log, revocable.proxy)).toEqual({
      ok: false,
      reason: "operation_rejected",
    });
    const reason = {
      toString() {
        hits.count += 1;
        return PLAYER;
      },
      valueOf() {
        hits.count += 1;
        return SECRET;
      },
    };
    expect(await appendEvidence(log, { ...rejectedInput("1028"), normalizationReason: reason })).toEqual({
      ok: false,
      reason: "operation_rejected",
    });
    const proto = {};
    Object.defineProperty(proto, "player", {
      get() {
        hits.count += 1;
        return PLAYER;
      },
    });
    const inherited = Object.assign(Object.create(proto), lineup("1028"));
    expect((await appendEvidence(log, normalizedInput("1028", inherited))).ok).toBe(true);
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read.ok).toBe(true);
    if (!read.ok || read.record.normalizationStatus !== "normalized") return;
    expect(read.record.observation).not.toHaveProperty("player");
    expectNoSentinels(read);
    expect(hits.count).toBe(0);
  });

  it("treats an unavailable log as unavailable rather than absence", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1029");
    expect((await appendEvidence(log, input)).ok).toBe(true);
    expect(await setEvidenceLogUnavailable(log, true)).toEqual({ ok: true });
    expect(await readEvidence(log, { operationId: input.operationId })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await appendEvidence(log, input)).toEqual({ ok: false, reason: "unavailable" });
    expect(await setEvidenceLogUnavailable(log, false)).toEqual({ ok: true });
    const read = await readEvidence(log, { operationId: input.operationId });
    expect(read.ok).toBe(true);
  });

  it("stores injury observations and refuses a present zero injury count", async () => {
    const log = createEvidenceLog({});
    const present: EvidenceObservation = {
      endpoint: "injuries",
      fixtureId: "1040",
      observation: "present",
      observedValue: 3,
      absenceMeansAvailable: false,
      availabilityInference: "forbidden",
      injuryRecordCount: 3,
    };
    const stored = await appendEvidence(log, {
      ...identity("1040"),
      capturedAtUtc: CLOCK,
      captureTimestampVerified: true,
      normalizationStatus: "normalized",
      observation: present,
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: eligibleDecision(3),
      },
    });
    expect(stored.ok).toBe(true);
    if (!stored.ok || stored.record.normalizationStatus !== "normalized") return;
    expect(stored.record.observation).toEqual(present);
    expect(stored.record.classification.status).toBe("classified");
    const missing: EvidenceObservation = {
      endpoint: "injuries",
      fixtureId: "1041",
      observation: "missing",
      observedValue: null,
      absenceMeansAvailable: false,
      availabilityInference: "forbidden",
      injuryRecordCount: null,
    };
    const empty = await appendEvidence(log, {
      ...identity("1041"),
      capturedAtUtc: CLOCK,
      captureTimestampVerified: true,
      normalizationStatus: "normalized",
      observation: missing,
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: rejectedDecision("missing_observation"),
      },
    });
    expect(empty.ok).toBe(true);
    if (!empty.ok || empty.record.normalizationStatus !== "normalized") return;
    expect(empty.record.observation).toEqual(missing);
    expect(await appendEvidence(log, {
      ...identity("1042"),
      capturedAtUtc: CLOCK,
      captureTimestampVerified: true,
      normalizationStatus: "normalized",
      observation: { ...present, fixtureId: "1042", observedValue: 0, injuryRecordCount: 0 },
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: eligibleDecision(0),
      },
    })).toEqual({ ok: false, reason: "operation_rejected" });
  });

  it("states in-process limits and does not touch the network, disk, or ledger outcome writers", async () => {
    expect(PE5_4C_EVIDENCE_LOG_LIMIT).toEqual({
      durability: "in-process-only",
      visibility: "same-genuine-instance-only",
      atomicity: "single-process-serialized-queue",
      diskPersistence: false,
      processSurvival: false,
      crossProcessConsistency: false,
      crashRecovery: false,
      directLedgerCallerGuarantee: false,
      productionReady: false,
    });
    const source = readFileSync(
      path.join(process.cwd(), "lib/debug/calibration/pe5-acquisition-boundary/evidence-log.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/Symbol\.for/);
    expect(source).not.toMatch(/globalThis/);
    expect(source).not.toMatch(/from\s+["']node:fs["']/);
    expect(source).not.toMatch(/from\s+["']node:http["']/);
    expect(source).not.toMatch(/from\s+["']node:https["']/);
    expect(source).not.toMatch(/from\s+["']node:net["']/);
    expect(source).not.toMatch(/recordOutcome|executeOfflineSend|beginSend|tryReserve|createApiFootballClient|API_FOOTBALL|classifyPe5Evidence|classifyHoldout/);
    expect(source).toContain("isRegisteredMemoryLedger");
    expect(source).toContain("same-genuine-instance-only");
    expect(source).toContain("directLedgerCallerGuarantee");

    const now = vi.spyOn(Date, "now");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const log = createEvidenceLog({});
      expect((await appendEvidence(log, normalizedInput("1030"))).ok).toBe(true);
      expect(now).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("does not share registration with a re-evaluated copy of the module", async () => {
    const log = createEvidenceLog({});
    const input = normalizedInput("1031");
    expect((await appendEvidence(log, input)).ok).toBe(true);
    vi.resetModules();
    const second = await import("@/lib/debug/calibration/pe5-acquisition-boundary/evidence-log");
    expect(second.isRegisteredEvidenceLog(log)).toBe(false);
    expect(await second.readEvidence(log, { operationId: input.operationId })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await second.appendEvidence(log, input)).toEqual({ ok: false, reason: "unavailable" });
    const still = await readEvidence(log, { operationId: input.operationId });
    expect(still.ok).toBe(true);
    expect(second.PE5_4C_EVIDENCE_LOG_LIMIT.crossProcessConsistency).toBe(false);
    expect(second.PE5_4C_EVIDENCE_LOG_LIMIT.crashRecovery).toBe(false);
  });

  it("rejects negative zero and keeps an ordinary zero lineup", async () => {
    const log = createEvidenceLog({});
    const zero = lineup("1101", 0, 0);
    const stored = await appendEvidence(log, normalizedInput("1101", zero));
    expect(stored.ok).toBe(true);
    if (!stored.ok || stored.record.normalizationStatus !== "normalized") return;
    expect(stored.record.observation).toEqual(zero);
    if (stored.record.observation.endpoint !== "lineups") return;
    expect(Object.is(stored.record.observation.observedValue, 0)).toBe(true);
    expect(Object.is(stored.record.observation.startXiCount, 0)).toBe(true);
    expect(Object.is(stored.record.observation.substituteCount, 0)).toBe(true);
    if (stored.record.classification.status !== "classified") return;
    expect(Object.is(stored.record.classification.decision.retainedObservation, 0)).toBe(true);

    const negative = lineup("1102", -0, -0);
    const rejected = await appendEvidence(log, normalizedInput("1102", negative, {
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: eligibleDecision(-0),
      },
    }));
    expect(rejected).toEqual({ ok: false, reason: "operation_rejected" });
    expect(await readEvidence(log, { operationId: operationFor("1102") })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });

    const retainedOnly = await appendEvidence(log, normalizedInput("1103", lineup("1103", 0, 0), {
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: eligibleDecision(-0),
      },
    }));
    expect(retainedOnly).toEqual({ ok: false, reason: "operation_rejected" });
    expect(await readEvidence(log, { operationId: operationFor("1103") })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });

    const injury = await appendEvidence(log, {
      ...identity("1104"),
      capturedAtUtc: CLOCK,
      captureTimestampVerified: true,
      normalizationStatus: "normalized",
      observation: {
        endpoint: "injuries",
        fixtureId: "1104",
        observation: "present",
        observedValue: -0,
        absenceMeansAvailable: false,
        availabilityInference: "forbidden",
        injuryRecordCount: -0,
      },
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: eligibleDecision(-0),
      },
    });
    expect(injury).toEqual({ ok: false, reason: "operation_rejected" });
    expect(await readEvidence(log, { operationId: operationFor("1104") })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });

    const overwrite = await appendEvidence(log, normalizedInput("1101", negative, {
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: eligibleDecision(-0),
      },
    }));
    expect(overwrite).toEqual({ ok: false, reason: "operation_rejected" });
    expect(await readEvidence(log, { operationId: operationFor("1101") })).toEqual({
      ok: true,
      record: stored.record,
    });
  });

  it("requires prospective provenance for an eligible decision", async () => {
    const log = createEvidenceLog({});
    const valid = normalizedInput("1110");
    const stored = await appendEvidence(log, valid);
    expect(stored.ok).toBe(true);
    if (!stored.ok || stored.record.normalizationStatus !== "normalized") return;
    expect(stored.record.classification).toEqual({
      status: "classified",
      provenance: "prospective_snapshot",
      decision: eligibleDecision(2),
    });

    const missingProvenance = {
      ...normalizedInput("1111"),
      classification: {
        status: "classified" as const,
        decision: eligibleDecision(2),
      },
    };
    expect(await appendEvidence(log, missingProvenance)).toEqual({
      ok: false,
      reason: "operation_rejected",
    });
    expect(await readEvidence(log, { operationId: operationFor("1111") })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });

    const nullProvenance = {
      ...normalizedInput("1112"),
      classification: {
        status: "classified" as const,
        provenance: null,
        decision: eligibleDecision(2),
      },
    };
    expect(await appendEvidence(log, nullProvenance)).toEqual({
      ok: false,
      reason: "operation_rejected",
    });
    expect(await readEvidence(log, { operationId: operationFor("1112") })).toEqual({
      ok: false,
      reason: "evidence_missing",
    });

    for (const provenance of ["current_snapshot", "realized_matchday"] as const) {
      const fixtureId = provenance === "current_snapshot" ? "1113" : "1114";
      expect(await appendEvidence(log, {
        ...normalizedInput(fixtureId),
        classification: {
          status: "classified" as const,
          provenance,
          decision: eligibleDecision(2),
        },
      })).toEqual({ ok: false, reason: "operation_rejected" });
      expect(await readEvidence(log, { operationId: operationFor(fixtureId) })).toEqual({
        ok: false,
        reason: "evidence_missing",
      });
    }

    const replace = await appendEvidence(log, {
      ...valid,
      classification: {
        status: "classified" as const,
        decision: eligibleDecision(2),
      },
    });
    expect(replace).toEqual({ ok: false, reason: "operation_rejected" });
    expect(await readEvidence(log, { operationId: valid.operationId })).toEqual({
      ok: true,
      record: stored.record,
    });

    const rejection = await appendEvidence(log, {
      ...identity("1115"),
      capturedAtUtc: CLOCK,
      captureTimestampVerified: true,
      normalizationStatus: "normalized",
      observation: missingLineup("1115"),
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: rejectedDecision("missing_observation"),
      },
    });
    expect(rejection.ok).toBe(true);
    if (!rejection.ok || rejection.record.normalizationStatus !== "normalized") return;
    expect(rejection.record.classification).toEqual({
      status: "classified",
      provenance: "prospective_snapshot",
      decision: rejectedDecision("missing_observation"),
    });

    const omittedRejection = await appendEvidence(log, {
      ...identity("1116"),
      capturedAtUtc: CLOCK,
      captureTimestampVerified: true,
      normalizationStatus: "normalized",
      observation: missingLineup("1116"),
      classification: {
        status: "classified",
        decision: rejectedDecision("missing_observation", "CURRENT_SNAPSHOT_UNPROVEN"),
      },
    });
    expect(omittedRejection.ok).toBe(true);
    if (!omittedRejection.ok || omittedRejection.record.normalizationStatus !== "normalized") return;
    expect(omittedRejection.record.classification).toEqual({
      status: "classified",
      provenance: null,
      decision: rejectedDecision("missing_observation", "CURRENT_SNAPSHOT_UNPROVEN"),
    });

    const skipped = await appendEvidence(log, skippedInput("1117", CLOCK, "capture_timestamp_unverified"));
    expect(skipped.ok).toBe(true);
    if (!skipped.ok || skipped.record.normalizationStatus !== "normalized") return;
    expect(skipped.record.classification).toEqual({
      status: "skipped",
      reason: "capture_timestamp_unverified",
    });

    const rejectedNormalization = await appendEvidence(log, rejectedInput("1118", "malformed_response"));
    expect(rejectedNormalization.ok).toBe(true);
    if (!rejectedNormalization.ok || rejectedNormalization.record.normalizationStatus !== "rejected") return;
    expect(rejectedNormalization.record.normalizationReason).toBe("malformed_response");
    expect(rejectedNormalization.record).not.toHaveProperty("observation");
    expect(rejectedNormalization.record).not.toHaveProperty("classification");
  });
});
