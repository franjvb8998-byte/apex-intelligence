/**
 * PE-5.4C increment 8 stage 2B — offline orchestrator integration tests.
 * Synthetic fixtures only. No network, credentials, or sealed 2025 reads.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  protocolFlagsDeny,
  readRealProtocolFlags,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/authorize";
import { deriveOperationId } from "@/lib/debug/calibration/pe5-acquisition-boundary/operation-id";
import {
  applyPe5OrchestratorFault,
  createPe5OfflineOrchestrator,
  executePe5OfflineOrchestrator,
  PE5_4C_ORCHESTRATOR_LIMIT,
  readPe5OrchestratorEvidence,
  readPe5OrchestratorInspection,
  type Pe5OrchestratorInspection,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/orchestrator";
import type { AcquisitionApproval, ProtocolFlagSnapshot } from "@/lib/debug/calibration/pe5-acquisition-boundary/types";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const MAX_AGE_MS = 60_000;
const FIXTURE = "1035037";
const OTHER = "999001";
const KICKOFF = "2026-02-01T15:00:00.000Z";
const EARLIER = "2024-05-01T15:00:00.000Z";
const LATER = "2024-05-08T15:00:00.000Z";
const PLAYER = "pe54c-player-token";
const SECRET = "pe54c-secret-token";
const TEAM = "pe54c-team-token";
const LOCATION = "https://evil.example/redirect-target";

const BOUNDARY = Object.freeze({ version: 1 as const, utcOffsetMs: 0, resetOffsetMs: 0 });

function frozen(start = NOW) {
  return { now: () => start };
}

function ticking(start = NOW) {
  let current = start;
  return {
    now() {
      const value = current;
      current += 1;
      return value;
    },
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
    vendorDayBoundary: BOUNDARY,
    ...overrides,
  };
}

function flags(overrides: Partial<ProtocolFlagSnapshot> = {}): ProtocolFlagSnapshot {
  return {
    PE5_PRODUCTION_WIRING: false,
    acquisitionAuthorized: false,
    collectorAuthorized: false,
    pe53Authorized: false,
    PE53B_LIVE_PROVIDER_AUTHORIZED: false,
    ...overrides,
  };
}

function clearKill(now = NOW, overrides: Record<string, unknown> = {}) {
  return { state: "clear", version: 1, updatedAt: now, maxAgeMs: MAX_AGE_MS, ...overrides };
}

function lineupBody(fixture = FIXTURE, starters: number[] = [15], substitutes: number[] = []) {
  return {
    get: "fixtures/lineups",
    parameters: { fixture },
    errors: [] as unknown[],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        team: { id: 33, name: TEAM },
        fixture: { id: Number(fixture) },
        startXI: starters.map((id) => ({ player: { id, name: PLAYER } })),
        substitutes: substitutes.map((id) => ({ player: { id, name: PLAYER } })),
      },
    ],
    note: SECRET,
    link: LOCATION,
  };
}

function emptyBody(endpoint: "lineups" | "injuries", fixture = FIXTURE) {
  return {
    get: endpoint === "lineups" ? "fixtures/lineups" : "injuries",
    parameters: { fixture },
    errors: [] as unknown[],
    results: 0,
    paging: { current: 1, total: 1 },
    response: [] as unknown[],
  };
}

function injuryBody(fixture = FIXTURE) {
  return {
    get: "injuries",
    parameters: { fixture },
    errors: [] as unknown[],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [{ player: { id: 15, name: PLAYER }, team: { id: 33, name: TEAM }, fixture: { id: Number(fixture) } }],
  };
}

function complete(body: unknown, status = 200, header: number | string | null = 15) {
  const script: Record<string, unknown> = {
    outcome: "complete",
    status,
    bodyBytes: new TextEncoder().encode(typeof body === "string" ? body : JSON.stringify(body)),
  };
  if (header != null) script.headers = { "x-ratelimit-requests-remaining": header };
  return script;
}

function request(script: object, overrides: Record<string, unknown> = {}) {
  return {
    env: { APEX_PE5_ACQUISITION_MODE: "offline", ledgerInstanceId: "ledger-a" },
    kill: clearKill(),
    protocolFlags: flags(),
    endpoint: "lineups",
    fixtureId: FIXTURE,
    source: { fixtureId: FIXTURE, kickoffUtc: KICKOFF, providerSeasonId: "2024" },
    target: { fixtureId: FIXTURE, kickoffUtc: KICKOFF, providerSeasonId: "2024" },
    kind: "confirmed_starting_xi",
    provenance: "prospective_snapshot",
    script,
    ...overrides,
  };
}

function open(
  overrides: Partial<AcquisitionApproval> = {},
  clock: { now(): number } = frozen(),
  lag: number | null = 60_000,
) {
  const record = approval(overrides);
  const config: Record<string, unknown> = { approval: record, clock };
  if (lag != null) config.maxCaptureLagMs = lag;
  const created = createPe5OfflineOrchestrator(config);
  if (!created.ok) throw new Error("orchestrator factory rejected a fixture");
  return { orchestrator: created.orchestrator, approval: record, clock };
}

async function inspection(orchestrator: ReturnType<typeof open>["orchestrator"]) {
  const read = await readPe5OrchestratorInspection(orchestrator);
  if (!read.ok) throw new Error("inspection unavailable");
  return read.inspection;
}

function outcomeCalls(report: Pe5OrchestratorInspection): number {
  return report.outcomeAttempts;
}

function transportCount(report: Pe5OrchestratorInspection): number {
  return report.transportAttempts;
}

function ledgerActions(report: Pe5OrchestratorInspection, action: string): number {
  if (!report.ledger.ok) return -1;
  return report.ledger.snapshot.audits.filter((entry) => entry.action === action).length;
}

function rawAppends(report: Pe5OrchestratorInspection): number {
  return report.rawAudits.filter((entry) => entry.action === "append").length;
}

function evidenceAppends(report: Pe5OrchestratorInspection): number {
  return report.evidenceAudits.filter((entry) => entry.action === "append" || entry.action === "append_duplicate").length;
}

async function run(script: object = complete(lineupBody()), overrides: Partial<AcquisitionApproval> = {}, requestOverrides: Record<string, unknown> = {}) {
  const session = open(overrides);
  const result = await executePe5OfflineOrchestrator(session.orchestrator, request(script, requestOverrides));
  const report = await inspection(session.orchestrator);
  return { ...session, result, report };
}

function assertClosed(value: unknown) {
  const encoded = JSON.stringify(value);
  expect(encoded).not.toContain(PLAYER);
  expect(encoded).not.toContain(SECRET);
  expect(encoded).not.toContain(TEAM);
  expect(encoded).not.toContain(LOCATION);
  expect(encoded).not.toContain("x-ratelimit");
}

describe("PE-5.4C increment 8 stage 2B offline orchestrator", () => {
  it("documents the in-process limits and keeps real protocol flags false", () => {
    expect(PE5_4C_ORCHESTRATOR_LIMIT).toEqual({
      durability: "in-process-only",
      visibility: "same-genuine-context-only",
      diskPersistence: false,
      crossProcessConsistency: false,
      crashRecovery: false,
      directLedgerCallerGuarantee: false,
      liveProviderAuthorization: false,
      productionReady: false,
      globalAuthenticity: false,
    });
    const real = readRealProtocolFlags();
    expect(real).toEqual(flags());
    expect(protocolFlagsDeny(real, flags())).toBe(false);
    const source = readFileSync(path.join(process.cwd(), "lib/debug/calibration/pe5-acquisition-boundary/orchestrator.ts"), "utf8");
    expect(source).not.toMatch(/process\.env|fetch\(|createApiFootballClient|readFileSync|API_FOOTBALL|node:fs|from "fs"/);
    expect(source).not.toMatch(/res-\\d|fence-|send-/);
  });

  it("consumes one verified prospective lineup and reconciles the evidence snapshot", async () => {
    const session = await run();
    expect(session.result.ok).toBe(true);
    if (!session.result.ok || session.result.outcome !== "consumed") throw new Error("expected consumption");
    expect(session.result).toMatchObject({
      outcome: "consumed",
      normalizationStatus: "normalized",
      classification: "classified",
      reason: "classified",
      evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT",
      decisionOk: true,
      observation: "present",
      observedValue: 1,
    });
    expect(session.report.ledger.ok).toBe(true);
    if (!session.report.ledger.ok) return;
    expect(session.report.ledger.snapshot.rows).toEqual([
      expect.objectContaining({
        reservationId: session.result.reservationId,
        operationId: session.result.operationId,
        state: "consumed",
        consumer: "pe5",
        failedReason: null,
      }),
    ]);
    expect(session.report.ledger.snapshot.occupancy.research).toBe(1);
    expect(transportCount(session.report)).toBe(1);
    expect(rawAppends(session.report)).toBe(1);
    expect(evidenceAppends(session.report)).toBe(1);
    expect(outcomeCalls(session.report)).toBe(1);
    expect(ledgerActions(session.report, "consume")).toBe(1);
    const evidence = await readPe5OrchestratorEvidence(session.orchestrator, session.result.operationId);
    expect(evidence.ok).toBe(true);
    if (!evidence.ok) return;
    expect(evidence.record).toMatchObject({
      reservationId: session.result.reservationId,
      ledgerInstanceId: session.report.ledger.snapshot.instanceId,
      approvalId: session.report.ledger.snapshot.approvalId,
      normalizationStatus: "normalized",
      captureTimestampVerified: true,
      classification: {
        status: "classified",
        provenance: "prospective_snapshot",
        decision: { ok: true, evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT", numericValue: null, zeroFilled: false, retainedObservation: 1 },
      },
    });
    assertClosed(session.result);
  });

  it("preserves a legitimate zero lineup and a positive injury count", async () => {
    const zero = await run(complete(lineupBody(FIXTURE, [], [])));
    expect(zero.result).toMatchObject({ ok: true, outcome: "consumed", observation: "present", observedValue: 0, decisionOk: true });

    const injury = open();
    const result = await executePe5OfflineOrchestrator(
      injury.orchestrator,
      request(complete(injuryBody()), {
        endpoint: "injuries",
        kind: "injury_unavailability",
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      outcome: "consumed",
      observation: "present",
      observedValue: 1,
      decisionOk: true,
      evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT",
    });
  });

  it("returns a stable duplicate and does not send again", async () => {
    const session = open();
    const first = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    const second = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(first).toMatchObject({ ok: true, outcome: "consumed" });
    if (!first.ok || first.outcome !== "consumed") return;
    expect(second).toEqual({
      ok: true,
      outcome: "duplicate",
      reason: "duplicate_reservation",
      operationId: first.operationId,
      reservationId: first.reservationId,
      state: "consumed",
    });
    expect(Object.hasOwn(second, "fencingToken")).toBe(false);
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(rawAppends(report)).toBe(1);
    expect(evidenceAppends(report)).toBe(1);
    expect(ledgerActions(report, "consume")).toBe(1);
    expect(ledgerActions(report, "begin_send")).toBe(1);
  });

  it("lets one of twenty concurrent attempts send", async () => {
    const session = open();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())))),
    );
    const consumed = results.filter((result) => result.ok && result.outcome === "consumed");
    const duplicates = results.filter((result) => result.ok && result.outcome === "duplicate");
    expect(consumed).toHaveLength(1);
    expect(duplicates).toHaveLength(19);
    const winner = consumed[0];
    if (!winner.ok || winner.outcome !== "consumed") return;
    for (const duplicate of duplicates) {
      if (!duplicate.ok || duplicate.outcome !== "duplicate") continue;
      expect(duplicate.operationId).toBe(winner.operationId);
      expect(duplicate.reservationId).toBe(winner.reservationId);
      expect(["reserved", "sending", "consumed"]).toContain(duplicate.state);
    }
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(rawAppends(report)).toBe(1);
    expect(evidenceAppends(report)).toBe(1);
    expect(ledgerActions(report, "consume")).toBe(1);
    expect(report.ledger.ok && report.ledger.snapshot.occupancy.research).toBe(1);
  });

  it("does not share quota or send claims across two genuine contexts", async () => {
    const left = open({ researchCeiling: 1 });
    const right = open({ researchCeiling: 1 });
    const first = await executePe5OfflineOrchestrator(left.orchestrator, request(complete(lineupBody())));
    const second = await executePe5OfflineOrchestrator(right.orchestrator, request(complete(lineupBody())));
    expect(first).toMatchObject({ ok: true, outcome: "consumed" });
    expect(second).toMatchObject({ ok: true, outcome: "consumed" });
    const leftReport = await inspection(left.orchestrator);
    const rightReport = await inspection(right.orchestrator);
    expect(leftReport.ledger.ok && leftReport.ledger.snapshot.occupancy.research).toBe(1);
    expect(rightReport.ledger.ok && rightReport.ledger.snapshot.occupancy.research).toBe(1);
    expect(leftReport.ledger.ok && leftReport.ledger.snapshot.rowCount).toBe(1);
    expect(rightReport.ledger.ok && rightReport.ledger.snapshot.rowCount).toBe(1);
    expect(transportCount(leftReport)).toBe(1);
    expect(transportCount(rightReport)).toBe(1);
    const again = await executePe5OfflineOrchestrator(
      left.orchestrator,
      request(complete(lineupBody(OTHER)), {
        fixtureId: OTHER,
        source: { fixtureId: OTHER, kickoffUtc: KICKOFF, providerSeasonId: "2024" },
        target: { fixtureId: OTHER, kickoffUtc: KICKOFF, providerSeasonId: "2024" },
      }),
    );
    expect(again).toMatchObject({ ok: false, outcome: "denied", reason: "research_ceiling" });
    const rightAfter = await inspection(right.orchestrator);
    expect(rightAfter.ledger.ok && rightAfter.ledger.snapshot.occupancy.research).toBe(1);
    expect(transportCount(rightAfter)).toBe(1);
  });

  it("rejects an injected store and hostile input before calling traps", async () => {
    expect(createPe5OfflineOrchestrator({ approval: approval(), clock: frozen(), maxCaptureLagMs: 1, rawStore: {} })).toEqual({
      ok: false,
      reason: "operation_rejected",
    });
    let proxyReads = 0;
    const proxied = new Proxy({ approval: approval(), clock: frozen() }, {
      get() {
        proxyReads += 1;
        return undefined;
      },
    });
    expect(createPe5OfflineOrchestrator(proxied)).toEqual({ ok: false, reason: "operation_rejected" });
    expect(proxyReads).toBe(0);

    const session = open();
    let inputReads = 0;
    const input = new Proxy({ endpoint: "lineups" }, {
      get() {
        inputReads += 1;
        return "lineups";
      },
    });
    const proxiedResult = await executePe5OfflineOrchestrator(session.orchestrator, input);
    expect(proxiedResult).toEqual({ ok: false, outcome: "denied", reason: "operation_rejected", operationId: null, reservationId: null });
    expect(inputReads).toBe(0);

    let getterReads = 0;
    const hostile: Record<string, unknown> = request(complete(lineupBody()));
    Object.defineProperty(hostile, "endpoint", {
      enumerable: true,
      get() {
        getterReads += 1;
        return "lineups";
      },
    });
    const getterResult = await executePe5OfflineOrchestrator(session.orchestrator, hostile);
    expect(getterResult).toEqual({ ok: false, outcome: "denied", reason: "operation_rejected", operationId: null, reservationId: null });
    expect(getterReads).toBe(0);
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(0);
    expect(report.ledger.ok && report.ledger.snapshot.rowCount).toBe(0);
  });

  it.each([
    ["protocol flag", request(complete(lineupBody()), { protocolFlags: flags({ acquisitionAuthorized: true }) }), "protocol_flag_violation"],
    ["missing mode", request(complete(lineupBody()), { env: { ledgerInstanceId: "ledger-a" } }), "mode_denied"],
    ["pilot mode", request(complete(lineupBody()), { env: { APEX_PE5_ACQUISITION_MODE: "pilot", ledgerInstanceId: "ledger-a" } }), "approval_inconsistent"],
    ["engaged kill", request(complete(lineupBody()), { kill: { state: "engaged", version: 1, updatedAt: NOW, maxAgeMs: MAX_AGE_MS } }), "kill_switch_engaged"],
    ["stale kill", request(complete(lineupBody()), { kill: clearKill(0) }), "kill_switch_stale"],
    ["unreadable kill", request(complete(lineupBody()), { kill: { state: "unreadable", version: 1, updatedAt: NOW, maxAgeMs: MAX_AGE_MS } }), "kill_switch_unreadable"],
    ["sealed kickoff", request(complete(lineupBody()), { source: { fixtureId: FIXTURE, kickoffUtc: "2025-06-01T15:00:00.000Z", providerSeasonId: "2024" }, target: { fixtureId: FIXTURE, kickoffUtc: "2025-06-01T15:00:00.000Z", providerSeasonId: "2024" } }), "calendar_2025_sealed_outcome"],
    ["provider season 2025", request(complete(lineupBody()), { target: { fixtureId: FIXTURE, kickoffUtc: KICKOFF, providerSeasonId: "2025" } }), "provider_season_2025_forbidden"],
    ["unknown kickoff", request(complete(lineupBody()), { source: { fixtureId: FIXTURE, kickoffUtc: "not-a-kickoff", providerSeasonId: "2024" } }), "unknown_kickoff"],
  ] as const)("denies %s before transport", async (_label, input, reason) => {
    const session = open();
    const result = await executePe5OfflineOrchestrator(session.orchestrator, input);
    expect(result).toEqual({ ok: false, outcome: "denied", reason, operationId: null, reservationId: null });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(0);
    expect(outcomeCalls(report)).toBe(0);
    expect(report.ledger.ok && report.ledger.snapshot.rowCount).toBe(0);
    assertClosed(result);
  });

  it("denies pilot approval through the authorization contract", async () => {
    const session = open({ mode: "pilot" });
    const result = await executePe5OfflineOrchestrator(
      session.orchestrator,
      request(complete(lineupBody()), { env: { APEX_PE5_ACQUISITION_MODE: "pilot", ledgerInstanceId: "ledger-a" } }),
    );
    expect(result).toEqual({ ok: false, outcome: "denied", reason: "pilot_not_authorized", operationId: null, reservationId: null });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(0);
  });

  it("denies an unavailable ledger clock before reserve", async () => {
    const session = open({}, { now: () => Number.NaN });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toEqual({ ok: false, outcome: "denied", reason: "clock_unavailable", operationId: null, reservationId: null });
    expect(transportCount(await inspection(session.orchestrator))).toBe(0);
  });

  it.each([
    ["research", { researchCeiling: 1, dailyCeiling: 8, rateCeiling: 8 }, "research_ceiling"],
    ["daily", { researchCeiling: 8, dailyCeiling: 1, rateCeiling: 8 }, "daily_ceiling"],
    ["rate", { researchCeiling: 8, dailyCeiling: 8, rateCeiling: 1 }, "rate_ceiling"],
  ] as const)("keeps the %s ceiling charged", async (_label, ceilings, reason) => {
    const session = open(ceilings);
    const first = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    const second = await executePe5OfflineOrchestrator(
      session.orchestrator,
      request(complete(lineupBody(OTHER)), { fixtureId: OTHER, source: { fixtureId: OTHER, kickoffUtc: KICKOFF, providerSeasonId: "2024" }, target: { fixtureId: OTHER, kickoffUtc: KICKOFF, providerSeasonId: "2024" } }),
    );
    expect(first).toMatchObject({ ok: true, outcome: "consumed" });
    expect(second).toMatchObject({ ok: false, outcome: "denied", reason, reservationId: null });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(report.ledger.ok && report.ledger.snapshot.occupancy.research).toBe(1);
  });

  it("denies a reserve when the vendor day boundary is absent", async () => {
    const session = open({ vendorDayBoundary: null });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outcome).toBe("denied");
    expect(result.reason).toBe("vendor_day_unknown");
    expect(result.reservationId).toBeNull();
    expect(transportCount(await inspection(session.orchestrator))).toBe(0);
  });

  it("rejects a credential, fixture, operation, or foreign reservation echo before send", async () => {
    const mismatch = await run(complete(lineupBody()), {}, { credentialId: "other-cred" });
    expect(mismatch.result).toEqual({ ok: false, outcome: "denied", reason: "operation_rejected", operationId: null, reservationId: null });
    expect(transportCount(mismatch.report)).toBe(0);

    const fixture = await run(complete(lineupBody()), {}, { fixtureId: OTHER });
    expect(fixture.result).toMatchObject({ ok: false, outcome: "denied", reason: "operation_rejected" });
    expect(transportCount(fixture.report)).toBe(0);

    const forged = await run(complete(lineupBody()), {}, { operationId: "a".repeat(64) });
    expect(forged.result).toMatchObject({ ok: false, outcome: "denied", reason: "operation_rejected" });
    expect(transportCount(forged.report)).toBe(0);

    const foreignKey = open();
    const foreignInput = request(complete(lineupBody())) as Record<string, unknown>;
    foreignInput.reservationId = "foreign-reservation";
    const foreignResult = await executePe5OfflineOrchestrator(foreignKey.orchestrator, foreignInput);
    expect(foreignResult).toEqual({ ok: false, outcome: "denied", reason: "operation_rejected", operationId: null, reservationId: null });
    expect(transportCount(await inspection(foreignKey.orchestrator))).toBe(0);

    const occupied = open();
    const identity = deriveOperationId(
      {
        ledgerInstanceId: "ledger-a",
        credentialId: "cred-research",
        approvalId: "approval:ledger-a",
        generation: 0,
      },
      { endpoint: "lineups", fixtureId: FIXTURE },
    );
    expect(identity.ok).toBe(true);
    if (!identity.ok) return;
    expect(await applyPe5OrchestratorFault(occupied.orchestrator, { kind: "external-charge", operationId: identity.operationId, state: "consumed" })).toEqual({ ok: true });
    const occupiedResult = await executePe5OfflineOrchestrator(occupied.orchestrator, request(complete(lineupBody())));
    expect(occupiedResult).toMatchObject({ ok: false, outcome: "denied", reason: "operation_rejected", operationId: identity.operationId });
    const occupiedReport = await inspection(occupied.orchestrator);
    expect(transportCount(occupiedReport)).toBe(0);
    expect(occupiedReport.ledger.ok && occupiedReport.ledger.snapshot.rows[0]).toMatchObject({ consumer: "external", state: "consumed" });
  });

  it("continues after one ambiguous reserve acknowledgement", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "lost-ack", which: "tryReserve" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: true, outcome: "consumed", decisionOk: true });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(ledgerActions(report, "ack_withheld")).toBe(1);
    expect(ledgerActions(report, "begin_send")).toBe(1);
  });

  it("stops when an ambiguous reserve cannot be attested", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "lost-ack", which: "tryReserve" })).toEqual({ ok: true });
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "unattested-lookup" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: false, outcome: "ambiguous", reason: "ambiguous", reservationId: null });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(0);
    expect(ledgerActions(report, "begin_send")).toBe(0);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("reserved");
  });

  it("does not recover a token after an ambiguous begin-send", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "lost-ack", which: "beginSend" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: false, outcome: "ambiguous", reason: "ambiguous" });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(0);
    expect(outcomeCalls(report)).toBe(0);
    expect(ledgerActions(report, "begin_send")).toBe(1);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("sending");
    const retry = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(retry).toMatchObject({ ok: true, outcome: "duplicate", state: "sending" });
    expect(transportCount(await inspection(session.orchestrator))).toBe(0);
  });

  it.each([
    ["timeout", { outcome: "timeout" }, "timeout"],
    ["cancelled", { outcome: "cancelled" }, "cancelled"],
    ["redirect", { outcome: "redirect", status: 302, location: LOCATION }, "redirect_rejected"],
    ["incomplete", { outcome: "incomplete", partialBytes: Uint8Array.of(1, 2) }, "response_incomplete"],
    ["network before bytes", { outcome: "network_before_bytes" }, "response_incomplete"],
  ] as const)("records a confirmed %s failure once", async (_label, script, reason) => {
    const session = open();
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(script));
    expect(result).toMatchObject({ ok: false, outcome: "failed", reason });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(rawAppends(report)).toBe(0);
    expect(evidenceAppends(report)).toBe(0);
    expect(outcomeCalls(report)).toBe(1);
    expect(ledgerActions(report, "fail")).toBe(1);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]).toMatchObject({ state: "failed", failedReason: reason });
    expect(report.ledger.ok && report.ledger.snapshot.occupancy.research).toBe(1);
    assertClosed(result);
    assertClosed(report.ledger.ok ? report.ledger.snapshot.audits : []);
  });

  it("preserves a charged sending row when the transport outcome is unknown", async () => {
    for (const script of [{ outcome: "outcome_unknown" }, { outcome: "exception", message: `${SECRET} ${PLAYER} ${LOCATION}` }]) {
      const session = open();
      const result = await executePe5OfflineOrchestrator(session.orchestrator, request(script));
      expect(result).toMatchObject({ ok: false, outcome: "unknown", reason: "outcome_unknown" });
      const report = await inspection(session.orchestrator);
      expect(transportCount(report)).toBe(1);
      expect(outcomeCalls(report)).toBe(0);
      expect(rawAppends(report)).toBe(0);
      expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("sending");
      assertClosed(result);
      const retry = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
      expect(retry).toMatchObject({ ok: true, outcome: "duplicate", state: "sending" });
      expect(transportCount(await inspection(session.orchestrator))).toBe(1);
    }
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [429, "rate_limited"],
    [500, "unexpected_provider_behavior"],
    [503, "unexpected_provider_behavior"],
  ] as const)("stores HTTP %s as a sanitized rejection and fails the send", async (status, reason) => {
    const session = await run(complete({ errors: [] }, status));
    expect(session.result).toMatchObject({ ok: false, outcome: "failed", reason });
    expect(transportCount(session.report)).toBe(1);
    expect(rawAppends(session.report)).toBe(1);
    expect(evidenceAppends(session.report)).toBe(1);
    expect(outcomeCalls(session.report)).toBe(1);
    expect(session.report.ledger.ok && session.report.ledger.snapshot.rows[0]).toMatchObject({ state: "failed", failedReason: reason });
    if (!session.result.ok) {
      const evidence = await readPe5OrchestratorEvidence(session.orchestrator, session.result.operationId ?? "");
      expect(evidence.ok && evidence.ok && evidence.record).toMatchObject({ normalizationStatus: "rejected", normalizationReason: reason });
    }
    assertClosed(session.result);
  });

  it("rejects malformed JSON, the wrong fixture, unexpected pagination, and an exhausted quota header", async () => {
    const malformed = await run(complete("{"));
    expect(malformed.result).toMatchObject({ ok: false, outcome: "failed", reason: "malformed_response" });
    expect(transportCount(malformed.report)).toBe(1);

    const wrong = await run(complete(lineupBody(OTHER)));
    expect(wrong.result).toMatchObject({ ok: false, outcome: "failed", reason: "fixture_id_mismatch" });

    const page = await run(complete({ ...lineupBody(), paging: { current: 1, total: 2 } }));
    expect(page.result).toMatchObject({ ok: false, outcome: "failed", reason: "unexpected_pagination" });

    const quota = await run(complete(lineupBody(), 200, 0));
    expect(quota.result).toMatchObject({ ok: false, outcome: "failed", reason: "quota_exhausted" });
    for (const session of [malformed, wrong, page, quota]) {
      expect(outcomeCalls(session.report)).toBe(1);
      expect(session.report.ledger.ok && session.report.ledger.snapshot.rows[0]?.state).toBe("failed");
      assertClosed(session.result);
    }
  });

  it("does not invent a quota header when the transport result omits one", async () => {
    const session = await run(complete(lineupBody(), 200, null));
    expect(session.result).toMatchObject({ ok: true, outcome: "consumed", observedValue: 1 });
    assertClosed(session.result);
    expect(transportCount(session.report)).toBe(1);
  });

  it("stores a missing observation without zero-filling it", async () => {
    const session = await run(complete(emptyBody("lineups")));
    expect(session.result).toMatchObject({
      ok: true,
      outcome: "consumed",
      observation: "missing",
      observedValue: null,
      decisionOk: false,
      reason: "missing_observation",
      evidenceClass: "UNSUPPORTED_OR_UNAVAILABLE",
    });
    if (session.result.ok && session.result.outcome === "consumed") {
      const evidence = await readPe5OrchestratorEvidence(session.orchestrator, session.result.operationId);
      expect(evidence.ok && evidence.ok && evidence.record.normalizationStatus === "normalized" && evidence.record.observation).toMatchObject({
        observation: "missing",
        observedValue: null,
        startXiCount: null,
        substituteCount: null,
      });
    }
  });

  it("does not relabel a current snapshot as prospective", async () => {
    const session = await run(complete(lineupBody()), {}, { provenance: "current_snapshot" });
    expect(session.result).toMatchObject({
      ok: true,
      outcome: "consumed",
      decisionOk: false,
      reason: "ambiguous_provenance",
      evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN",
    });
    if (!session.result.ok || session.result.outcome !== "consumed") return;
    const evidence = await readPe5OrchestratorEvidence(session.orchestrator, session.result.operationId);
    expect(evidence.ok).toBe(true);
    if (!evidence.ok || evidence.record.normalizationStatus !== "normalized") return;
    expect(evidence.record.classification).toMatchObject({
      status: "classified",
      provenance: null,
      decision: { ok: false, reason: "ambiguous_provenance", evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN" },
    });
    expect(JSON.stringify(evidence.record)).not.toContain("prospective_snapshot");
  });

  it("stores a skipped classification when the capture clock is missing or unverified", async () => {
    const missing = open({}, frozen(), null);
    const missingResult = await executePe5OfflineOrchestrator(missing.orchestrator, request(complete(lineupBody())));
    expect(missingResult).toMatchObject({ ok: false, outcome: "rejected", reason: "missing_capture_timestamp" });
    const missingReport = await inspection(missing.orchestrator);
    expect(transportCount(missingReport)).toBe(1);
    expect(outcomeCalls(missingReport)).toBe(0);
    expect(missingReport.ledger.ok && missingReport.ledger.snapshot.rows[0]?.state).toBe("sending");
    if (!missingResult.ok) {
      const evidence = await readPe5OrchestratorEvidence(missing.orchestrator, missingResult.operationId ?? "");
      expect(evidence.ok && evidence.ok && evidence.record.normalizationStatus === "normalized" && evidence.record.classification).toEqual({
        status: "skipped",
        reason: "missing_capture_timestamp",
      });
    }

    const unverified = open({}, ticking(), 0);
    const unverifiedResult = await executePe5OfflineOrchestrator(unverified.orchestrator, request(complete(lineupBody())));
    expect(unverifiedResult).toMatchObject({ ok: false, outcome: "rejected", reason: "capture_timestamp_unverified" });
    expect(outcomeCalls(await inspection(unverified.orchestrator))).toBe(0);
  });

  it("does not store an unrepresentable realized success or mark it consumed", async () => {
    const session = open({}, frozen(), null);
    const result = await executePe5OfflineOrchestrator(
      session.orchestrator,
      request(complete(lineupBody(FIXTURE)), {
        fixtureId: FIXTURE,
        kind: "rotation_minutes",
        provenance: "realized_matchday",
        source: { fixtureId: FIXTURE, kickoffUtc: EARLIER, providerSeasonId: "2024" },
        target: { fixtureId: OTHER, kickoffUtc: LATER, providerSeasonId: "2024" },
      }),
    );
    expect(result).toMatchObject({ ok: false, outcome: "rejected", reason: "classification_unrepresentable" });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(rawAppends(report)).toBe(1);
    expect(evidenceAppends(report)).toBe(0);
    expect(outcomeCalls(report)).toBe(0);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("sending");
    if (!result.ok && result.operationId != null) {
      const evidence = await readPe5OrchestratorEvidence(session.orchestrator, result.operationId);
      expect(evidence).toEqual({ ok: false, reason: "evidence_missing" });
    }
  });

  it.each([
    ["raw append failure", { kind: "raw-append-failure" as const }, "raw_missing"],
    ["raw partial append", { kind: "raw-partial-append" as const }, "raw_missing"],
  ])("does not resend after %s", async (_label, fault, reason) => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, fault)).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: false, outcome: "rejected", reason });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(rawAppends(report)).toBe(0);
    expect(outcomeCalls(report)).toBe(0);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("sending");
    const retry = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(retry).toMatchObject({ outcome: "duplicate" });
    expect(transportCount(await inspection(session.orchestrator))).toBe(1);
  });

  it("reconciles a lost raw acknowledgement without a second send", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "lost-raw-ack" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: true, outcome: "consumed" });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(report.rawAudits.some((entry) => entry.action === "ack_withheld")).toBe(true);
    expect(ledgerActions(report, "consume")).toBe(1);
  });

  it("treats an ambiguous raw read as unconfirmed", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "ambiguous-raw-read" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: false, outcome: "ambiguous", reason: "ambiguous" });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(evidenceAppends(report)).toBe(0);
    expect(outcomeCalls(report)).toBe(0);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("sending");
  });

  it("stops when stored bytes no longer match the digest", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "corrupt-raw-before-read" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: false, outcome: "rejected", reason: "integrity_mismatch" });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(outcomeCalls(report)).toBe(0);
    expect(evidenceAppends(report)).toBe(0);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("sending");
  });

  it("does not retry transport when evidence append fails", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "evidence-append-failure" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: false, outcome: "rejected", reason: "evidence_missing" });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(outcomeCalls(report)).toBe(0);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("sending");
  });

  it("confirms a lost evidence acknowledgement by reading the canonical snapshot", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "lost-evidence-ack" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: true, outcome: "consumed" });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(report.evidenceAudits.some((entry) => entry.action === "ack_withheld")).toBe(true);
    expect(ledgerActions(report, "consume")).toBe(1);
  });

  it("does not treat an ambiguous evidence read as confirmation", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "ambiguous-evidence-read" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: false, outcome: "ambiguous", reason: "ambiguous" });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(outcomeCalls(report)).toBe(0);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("sending");
  });

  it("does not overwrite a conflicting evidence record", async () => {
    const session = open();
    const identity = deriveOperationId(
      { ledgerInstanceId: "ledger-a", credentialId: "cred-research", approvalId: "approval:ledger-a", generation: 0 },
      { endpoint: "lineups", fixtureId: FIXTURE },
    );
    expect(identity.ok).toBe(true);
    if (!identity.ok) return;
    expect(await applyPe5OrchestratorFault(session.orchestrator, {
      kind: "seed-evidence",
      input: {
        operationId: identity.operationId,
        envelopeId: `env-${identity.operationId}`,
        evidenceId: `env-${identity.operationId}`,
        reservationId: "seeded-reservation",
        contentDigest: "b".repeat(64),
        capturedAtUtc: null,
        captureTimestampVerified: false,
        normalizationStatus: "rejected",
        normalizationReason: "malformed_response",
      },
    })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: false, outcome: "rejected", reason: "evidence_conflict", operationId: identity.operationId });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(outcomeCalls(report)).toBe(0);
    const evidence = await readPe5OrchestratorEvidence(session.orchestrator, identity.operationId);
    expect(evidence.ok && evidence.ok && evidence.record).toMatchObject({
      reservationId: "seeded-reservation",
      normalizationStatus: "rejected",
      normalizationReason: "malformed_response",
    });
  });

  it("reconciles one unavailable outcome and then consumes", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "transient-outcome-unavailable" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: true, outcome: "consumed" });
    const report = await inspection(session.orchestrator);
    expect(outcomeCalls(report)).toBe(2);
    expect(transportCount(report)).toBe(1);
    expect(evidenceAppends(report)).toBe(1);
    expect(ledgerActions(report, "consume")).toBe(1);
    expect(report.ledger.ok && report.ledger.snapshot.rows[0]?.state).toBe("consumed");
  });

  it("stops when outcome lookup stays unavailable", async () => {
    const session = open();
    expect(await applyPe5OrchestratorFault(session.orchestrator, { kind: "sticky-outcome-unavailable" })).toEqual({ ok: true });
    const result = await executePe5OfflineOrchestrator(session.orchestrator, request(complete(lineupBody())));
    expect(result).toMatchObject({ ok: false, outcome: "rejected", reason: "unavailable" });
    const report = await inspection(session.orchestrator);
    expect(transportCount(report)).toBe(1);
    expect(outcomeCalls(report)).toBe(1);
    expect(evidenceAppends(report)).toBe(1);
    expect(report.ledger.ok).toBe(false);
  });

  it("does not call the network while rejecting sealed and secret-bearing input", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const session = open();
      const secretInput = request(complete(lineupBody())) as Record<string, unknown>;
      secretInput.apiKey = SECRET;
      const secret = await executePe5OfflineOrchestrator(session.orchestrator, secretInput);
      expect(secret).toEqual({ ok: false, outcome: "denied", reason: "operation_rejected", operationId: null, reservationId: null });
      assertClosed(secret);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(transportCount(await inspection(session.orchestrator))).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
