/**
 * PE-5.3B — offline historical squad-coverage probe runner.
 * Dry-run by default. In-memory transport only. No live provider client.
 *
 * Files:
 * - probe-fixtures.ts — PE-5.3A allowlist and frozen-path guard
 * - probe-transport.ts — transport interface
 * - probe-runner.ts — plan, authorization, execution, classification
 */

import { classifyPe5Evidence } from "@/lib/debug/calibration/pe5-availability/evidence-class";
import {
  isPe53bFixtureAllowed,
  pe53bFixtureById,
  PE53B_IN_MEMORY_CONFIRMATION,
  PE53B_LIVE_CONFIRMATION,
  PE53B_LIVE_PROVIDER_AUTHORIZED,
  PE53B_ORIGIN_REQUEST_CAP,
  PE53B_SELECTED_FIXTURES,
  type Pe53bFixture,
} from "@/lib/debug/calibration/pe5-availability/probe-fixtures";
import {
  pe5Protocol,
  type Pe5FailReason,
  type Pe5SquadEvidenceKind,
} from "@/lib/debug/calibration/pe5-availability/protocol";
import type {
  Pe53bTransport,
  Pe53bTransportResponse,
} from "@/lib/debug/calibration/pe5-availability/probe-transport";

export const PE53B_RUNNER_VERSION = "pe5.probe_runner.v1" as const;

export type Pe53bEndpoint = "lineups" | "injuries";

export type Pe53bPlannedRequest = {
  ordinal: number;
  slot: number;
  fixtureId: string;
  competitionId: string;
  providerSeason: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  endpoint: Pe53bEndpoint;
  path: "/fixtures/lineups" | "/injuries";
  query: { fixture: string };
};

export type Pe53bStopReason =
  | "unauthorized"
  | "quota_exhausted"
  | "rate_limited"
  | "malformed_response"
  | "unexpected_pagination"
  | "unexpected_provider_behavior"
  | "fixture_id_mismatch"
  | "fixture_not_allowlisted"
  | "holdout_rejected"
  | "fallback_query_rejected"
  | "request_cap"
  | "evidence_promotion_blocked";

export type Pe53bRejectionReason =
  | "live_provider_not_authorized"
  | "live_confirmation_missing"
  | "pe53_protocol_not_authorized"
  | "live_transport_not_implemented"
  | "in_memory_confirmation_missing"
  | "in_memory_transport_required";

export type Pe53bAnomaly =
  | "empty_response"
  | "missing_player_id"
  | "unexpected_team_ids";

export type Pe53bMeasurement = {
  ordinal: number;
  slot: number;
  fixtureId: string;
  endpoint: Pe53bEndpoint;
  httpStatus: number;
  providerSuccess: boolean;
  responseState: "empty" | "non_empty";
  evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN";
  protocolReason: Pe5FailReason | "classified";
  provenance: "current_snapshot";
  captureTimestampVerified: false;
  capturedAtUtc: null;
  observation: "present" | "missing";
  numericValue: null;
  zeroFilled: false;
  targetPrematchEligible: false;
  laterTargetHistoryEligible: false;
  absenceMeansAvailable: false;
  playerIdsPresent: number;
  playerIdsMissing: number;
  startXiCount: number | null;
  substituteCount: number | null;
  injuryRecordCount: number | null;
  unexpectedTeamIds: boolean;
  anomalies: Pe53bAnomaly[];
};

export type Pe53bProbeReport = {
  runnerVersion: typeof PE53B_RUNNER_VERSION;
  mode: "dry_run" | "in_memory" | "rejected";
  rejectionReason: Pe53bRejectionReason | null;
  originRequestsAttempted: number;
  originRequestCap: typeof PE53B_ORIGIN_REQUEST_CAP;
  plannedRequestCount: number;
  plan: readonly Pe53bPlannedRequest[];
  stopped: boolean;
  stopReason: Pe53bStopReason | null;
  stoppedAtOrdinal: number | null;
  measurements: Pe53bMeasurement[];
  writesAttempted: 0;
  liveResponsesStored: false;
  retriesAttempted: 0;
  liveProviderAuthorized: false;
};

export type Pe53bProbeInput = {
  mode?: "dry_run" | "in_memory";
  transport?: Pe53bTransport | null;
  inMemoryConfirmation?: string | null;
  requestLiveProvider?: boolean;
  liveConfirmation?: string | null;
};

const DAILY_QUOTA_RE = /for the day|daily|quota|upgrade your plan/i;
const FIXTURE_ID_RE = /^[1-9]\d{0,11}$/;

export function buildPe53bPlan(): readonly Pe53bPlannedRequest[] {
  const plan: Pe53bPlannedRequest[] = [];
  for (const fixture of PE53B_SELECTED_FIXTURES) {
    plan.push(plannedRequest(fixture, "lineups", plan.length + 1));
    plan.push(plannedRequest(fixture, "injuries", plan.length + 1));
  }
  if (plan.length !== PE53B_ORIGIN_REQUEST_CAP) {
    throw new Error("PE-5.3B plan must contain exactly 20 requests");
  }
  return plan;
}

export function authorizePe53bLiveProvider(input: {
  requestLiveProvider: boolean;
  liveConfirmation?: string | null;
}): { authorized: false; reason: Pe53bRejectionReason } {
  const liveFlag: boolean = PE53B_LIVE_PROVIDER_AUTHORIZED;
  const protocolAllowsLive: boolean = pe5Protocol().pe53Authorized;
  if (!input.requestLiveProvider) {
    return { authorized: false, reason: "live_provider_not_authorized" };
  }
  if (input.liveConfirmation !== PE53B_LIVE_CONFIRMATION) {
    return { authorized: false, reason: "live_confirmation_missing" };
  }
  if (!liveFlag) {
    return { authorized: false, reason: "live_provider_not_authorized" };
  }
  if (!protocolAllowsLive) {
    return { authorized: false, reason: "pe53_protocol_not_authorized" };
  }
  return { authorized: false, reason: "live_transport_not_implemented" };
}

export async function runPe53bProbe(
  input: Pe53bProbeInput = {},
): Promise<Pe53bProbeReport> {
  const plan = buildPe53bPlan();
  if (input.requestLiveProvider === true) {
    const auth = authorizePe53bLiveProvider({
      requestLiveProvider: true,
      liveConfirmation: input.liveConfirmation,
    });
    return rejectedReport(plan, auth.reason);
  }
  if ((input.mode ?? "dry_run") === "dry_run") {
    return dryRunReport(plan);
  }
  if (input.inMemoryConfirmation !== PE53B_IN_MEMORY_CONFIRMATION) {
    return rejectedReport(plan, "in_memory_confirmation_missing");
  }
  if (!input.transport || input.transport.kind !== "in_memory") {
    return rejectedReport(plan, "in_memory_transport_required");
  }
  return executePe53bPlan({
    plan,
    transport: input.transport,
    inMemoryConfirmation: input.inMemoryConfirmation,
  });
}

export async function executePe53bPlan(input: {
  plan: readonly Pe53bPlannedRequest[];
  transport: Pe53bTransport;
  inMemoryConfirmation?: string | null;
}): Promise<Pe53bProbeReport> {
  const officialPlan = buildPe53bPlan();
  if (input.inMemoryConfirmation !== PE53B_IN_MEMORY_CONFIRMATION) {
    return rejectedReport(officialPlan, "in_memory_confirmation_missing");
  }
  if (input.transport.kind !== "in_memory") {
    return rejectedReport(officialPlan, "in_memory_transport_required");
  }

  const measurements: Pe53bMeasurement[] = [];
  let attempted = 0;

  for (const request of input.plan) {
    if (attempted >= PE53B_ORIGIN_REQUEST_CAP) {
      return finish({
        plan: input.plan,
        attempted,
        measurements,
        stopped: true,
        stopReason: "request_cap",
        stoppedAtOrdinal: null,
      });
    }

    const gate = gateRequest(request);
    if (gate) {
      return finish({
        plan: input.plan,
        attempted,
        measurements,
        stopped: true,
        stopReason: gate,
        stoppedAtOrdinal: request.ordinal,
      });
    }

    attempted += 1;
    let response: Pe53bTransportResponse;
    try {
      response = await input.transport.request({
        path: request.path,
        query: { fixture: request.fixtureId },
      });
    } catch {
      return finish({
        plan: input.plan,
        attempted,
        measurements,
        stopped: true,
        stopReason: "unexpected_provider_behavior",
        stoppedAtOrdinal: request.ordinal,
      });
    }

    const interpreted = interpretResponse(request, response);
    if (interpreted.stopReason) {
      return finish({
        plan: input.plan,
        attempted,
        measurements,
        stopped: true,
        stopReason: interpreted.stopReason,
        stoppedAtOrdinal: request.ordinal,
      });
    }
    measurements.push(interpreted.measurement);
  }

  return finish({
    plan: input.plan,
    attempted,
    measurements,
    stopped: false,
    stopReason: null,
    stoppedAtOrdinal: null,
  });
}

function plannedRequest(
  fixture: Pe53bFixture,
  endpoint: Pe53bEndpoint,
  ordinal: number,
): Pe53bPlannedRequest {
  return {
    ordinal,
    slot: fixture.slot,
    fixtureId: fixture.fixtureId,
    competitionId: fixture.competitionId,
    providerSeason: fixture.providerSeason,
    kickoffUtc: fixture.kickoffUtc,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    endpoint,
    path: endpoint === "lineups" ? "/fixtures/lineups" : "/injuries",
    query: { fixture: fixture.fixtureId },
  };
}

function gateRequest(request: Pe53bPlannedRequest): Pe53bStopReason | null {
  const queryKeys = Object.keys(request.query);
  if (
    queryKeys.length !== 1 ||
    queryKeys[0] !== "fixture" ||
    request.query.fixture !== request.fixtureId ||
    (request.path !== "/fixtures/lineups" && request.path !== "/injuries")
  ) {
    return "fallback_query_rejected";
  }
  if (
    request.providerSeason === "2025" ||
    request.kickoffUtc.startsWith("2025")
  ) {
    return "holdout_rejected";
  }
  if (!isPe53bFixtureAllowed(request.fixtureId)) {
    return "fixture_not_allowlisted";
  }
  const fixture = pe53bFixtureById(request.fixtureId);
  if (!fixture) return "fixture_not_allowlisted";
  const season: string = fixture.providerSeason;
  if (season === "2025" || fixture.kickoffUtc.startsWith("2025")) {
    return "holdout_rejected";
  }
  return null;
}

function interpretResponse(
  request: Pe53bPlannedRequest,
  response: Pe53bTransportResponse,
): { stopReason: Pe53bStopReason | null; measurement: Pe53bMeasurement } {
  const quota = quotaSignal(response);
  if (response.status === 401 || response.status === 403) {
    return stoppedShell(request, response.status, "unauthorized");
  }
  if (quota) {
    return stoppedShell(request, response.status, "quota_exhausted");
  }
  if (response.status === 429) {
    return stoppedShell(request, response.status, "rate_limited");
  }
  if (response.status >= 500) {
    return stoppedShell(
      request,
      response.status,
      "unexpected_provider_behavior",
    );
  }
  if (response.status !== 200 || !isRecord(response.body)) {
    return stoppedShell(request, response.status, "malformed_response");
  }

  const body = response.body;
  if (errorsArePresent(body.errors)) {
    return stoppedShell(request, response.status, "malformed_response");
  }
  if (!Array.isArray(body.response)) {
    return stoppedShell(request, response.status, "malformed_response");
  }
  if (unexpectedPaging(body.paging)) {
    return stoppedShell(request, response.status, "unexpected_pagination");
  }
  if (typeof body.paging === "string" || Array.isArray(body.paging)) {
    return stoppedShell(request, response.status, "malformed_response");
  }
  if (getMismatches(request, body.get)) {
    return stoppedShell(
      request,
      response.status,
      "unexpected_provider_behavior",
    );
  }
  if (
    typeof body.results === "number" &&
    body.results !== body.response.length
  ) {
    return stoppedShell(
      request,
      response.status,
      "unexpected_provider_behavior",
    );
  }
  if (fixtureIdMismatches(request.fixtureId, body)) {
    return stoppedShell(request, response.status, "fixture_id_mismatch");
  }
  if (rowsAreMalformed(request, body.response)) {
    return stoppedShell(request, response.status, "malformed_response");
  }

  const coverage = summarizeCoverage(request, body.response);
  const observation = body.response.length === 0 ? "missing" : "present";
  const protocol = classifyHistoricalQuery(request);
  if (protocol.stopReason) {
    return stoppedShell(request, response.status, protocol.stopReason);
  }

  const anomalies: Pe53bAnomaly[] = [];
  if (observation === "missing") anomalies.push("empty_response");
  if (coverage.playerIdsMissing > 0) anomalies.push("missing_player_id");
  if (coverage.unexpectedTeamIds) anomalies.push("unexpected_team_ids");

  return {
    stopReason: null,
    measurement: {
      ordinal: request.ordinal,
      slot: request.slot,
      fixtureId: request.fixtureId,
      endpoint: request.endpoint,
      httpStatus: response.status,
      providerSuccess: true,
      responseState: observation === "missing" ? "empty" : "non_empty",
      evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN",
      protocolReason: protocol.reason,
      provenance: "current_snapshot",
      captureTimestampVerified: false,
      capturedAtUtc: null,
      observation,
      numericValue: null,
      zeroFilled: false,
      targetPrematchEligible: false,
      laterTargetHistoryEligible: false,
      absenceMeansAvailable: false,
      playerIdsPresent: coverage.playerIdsPresent,
      playerIdsMissing: coverage.playerIdsMissing,
      startXiCount: coverage.startXiCount,
      substituteCount: coverage.substituteCount,
      injuryRecordCount: coverage.injuryRecordCount,
      unexpectedTeamIds: coverage.unexpectedTeamIds,
      anomalies,
    },
  };
}

function classifyHistoricalQuery(
  request: Pe53bPlannedRequest,
): { stopReason: Pe53bStopReason | null; reason: Pe5FailReason | "classified" } {
  const fixture = pe53bFixtureById(request.fixtureId);
  if (!fixture) {
    return { stopReason: "fixture_not_allowlisted", reason: "invalid_identifier" };
  }
  const kind: Pe5SquadEvidenceKind =
    request.endpoint === "lineups"
      ? "confirmed_starting_xi"
      : "injury_unavailability";
  const decision = classifyPe5Evidence({
    evidenceId: `pe53b-${request.fixtureId}-${request.endpoint}`,
    kind,
    provenance: "current_snapshot",
    sourceFixtureId: fixture.fixtureId,
    sourceKickoffUtc: fixture.kickoffUtc,
    sourceProviderSeasonId: fixture.providerSeason,
    capturedAtUtc: null,
    captureTimestampVerified: false,
    observation: "present",
    observedValue: null,
    targetFixtureId: fixture.fixtureId,
    targetKickoffUtc: fixture.kickoffUtc,
    targetProviderSeasonId: fixture.providerSeason,
  });
  if (
    decision.ok ||
    decision.evidenceClass !== "CURRENT_SNAPSHOT_UNPROVEN" ||
    decision.targetPrematchEligible ||
    decision.laterTargetHistoryEligible ||
    decision.numericValue !== null ||
    decision.zeroFilled !== false
  ) {
    return {
      stopReason: "evidence_promotion_blocked",
      reason: decision.reason,
    };
  }
  return { stopReason: null, reason: decision.reason };
}

function rowsAreMalformed(
  request: Pe53bPlannedRequest,
  rows: readonly unknown[],
): boolean {
  for (const row of rows) {
    if (!isRecord(row)) return true;
    if (request.endpoint !== "lineups") continue;
    if (row.startXI != null && !Array.isArray(row.startXI)) return true;
    if (row.substitutes != null && !Array.isArray(row.substitutes)) return true;
  }
  return false;
}

function summarizeCoverage(
  request: Pe53bPlannedRequest,
  rows: readonly unknown[],
): {
  playerIdsPresent: number;
  playerIdsMissing: number;
  startXiCount: number | null;
  substituteCount: number | null;
  injuryRecordCount: number | null;
  unexpectedTeamIds: boolean;
} {
  const expected = new Set([request.homeTeamId, request.awayTeamId]);
  let playerIdsPresent = 0;
  let playerIdsMissing = 0;
  let unexpectedTeamIds = false;
  const observedTeams = new Set<string>();

  if (request.endpoint === "injuries") {
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const idState = readPlayerId(isRecord(row.player) ? row.player.id : undefined);
      if (idState === "present") playerIdsPresent += 1;
      else playerIdsMissing += 1;
      const teamId = readTeamId(isRecord(row.team) ? row.team.id : undefined);
      if (teamId) observedTeams.add(teamId);
    }
    if (rows.length > 0) {
      for (const teamId of observedTeams) {
        if (!expected.has(teamId)) unexpectedTeamIds = true;
      }
    }
    return {
      playerIdsPresent,
      playerIdsMissing,
      startXiCount: null,
      substituteCount: null,
      injuryRecordCount: rows.length,
      unexpectedTeamIds,
    };
  }

  let startXiCount = 0;
  let substituteCount = 0;
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const teamId = readTeamId(isRecord(row.team) ? row.team.id : undefined);
    if (teamId) observedTeams.add(teamId);
    else if (rows.length > 0) unexpectedTeamIds = true;
    const startXi = Array.isArray(row.startXI) ? row.startXI : [];
    const substitutes = Array.isArray(row.substitutes) ? row.substitutes : [];
    startXiCount += startXi.length;
    substituteCount += substitutes.length;
    for (const entry of [...startXi, ...substitutes]) {
      const player = isRecord(entry) && isRecord(entry.player) ? entry.player : null;
      const idState = readPlayerId(player ? player.id : undefined);
      if (idState === "present") playerIdsPresent += 1;
      else playerIdsMissing += 1;
    }
  }
  if (rows.length > 0) {
    if (observedTeams.size !== expected.size) unexpectedTeamIds = true;
    for (const teamId of observedTeams) {
      if (!expected.has(teamId)) unexpectedTeamIds = true;
    }
  }
  return {
    playerIdsPresent,
    playerIdsMissing,
    startXiCount,
    substituteCount,
    injuryRecordCount: null,
    unexpectedTeamIds,
  };
}

function fixtureIdMismatches(
  fixtureId: string,
  body: Record<string, unknown>,
): boolean {
  if (isRecord(body.parameters) && "fixture" in body.parameters) {
    if (String(body.parameters.fixture) !== fixtureId) return true;
  }
  if (!Array.isArray(body.response)) return false;
  for (const row of body.response) {
    if (!isRecord(row) || !isRecord(row.fixture) || row.fixture.id == null) {
      continue;
    }
    if (String(row.fixture.id) !== fixtureId) return true;
  }
  return false;
}

function getMismatches(request: Pe53bPlannedRequest, getValue: unknown): boolean {
  if (getValue == null || getValue === "") return false;
  if (typeof getValue !== "string") return true;
  const normalized = getValue.replace(/^\//, "");
  const expected = request.path.replace(/^\//, "");
  return normalized !== expected;
}

function unexpectedPaging(paging: unknown): boolean {
  if (paging == null) return false;
  if (!isRecord(paging)) return false;
  const current = paging.current;
  const total = paging.total;
  if (typeof total === "number" && total > 1) return true;
  if (typeof current === "number" && current > 1) return true;
  return false;
}

function quotaSignal(response: Pe53bTransportResponse): boolean {
  const headers = response.headers ?? {};
  for (const [key, value] of Object.entries(headers)) {
    if (
      key.toLowerCase() === "x-ratelimit-requests-remaining" &&
      value === "0"
    ) {
      return true;
    }
  }
  if (!isRecord(response.body)) return false;
  let text = "";
  try {
    text = JSON.stringify(response.body.errors ?? "");
  } catch {
    text = "";
  }
  return DAILY_QUOTA_RE.test(text);
}

function errorsArePresent(errors: unknown): boolean {
  if (errors == null) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "string") return errors.trim().length > 0;
  if (isRecord(errors)) return Object.keys(errors).length > 0;
  return true;
}

function readPlayerId(id: unknown): "present" | "missing" {
  if (typeof id === "number" && Number.isInteger(id) && id > 0) return "present";
  if (typeof id === "string" && FIXTURE_ID_RE.test(id)) return "present";
  return "missing";
}

function readTeamId(id: unknown): string | null {
  if (typeof id === "number" && Number.isInteger(id) && id > 0) return String(id);
  if (typeof id === "string" && FIXTURE_ID_RE.test(id)) return id;
  return null;
}

function stoppedShell(
  request: Pe53bPlannedRequest,
  status: number,
  stopReason: Pe53bStopReason,
): { stopReason: Pe53bStopReason; measurement: Pe53bMeasurement } {
  void status;
  return {
    stopReason,
    measurement: emptyMeasurement(request),
  };
}

function emptyMeasurement(request: Pe53bPlannedRequest): Pe53bMeasurement {
  return {
    ordinal: request.ordinal,
    slot: request.slot,
    fixtureId: request.fixtureId,
    endpoint: request.endpoint,
    httpStatus: 0,
    providerSuccess: false,
    responseState: "empty",
    evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN",
    protocolReason: "current_snapshot_unproven",
    provenance: "current_snapshot",
    captureTimestampVerified: false,
    capturedAtUtc: null,
    observation: "missing",
    numericValue: null,
    zeroFilled: false,
    targetPrematchEligible: false,
    laterTargetHistoryEligible: false,
    absenceMeansAvailable: false,
    playerIdsPresent: 0,
    playerIdsMissing: 0,
    startXiCount: null,
    substituteCount: null,
    injuryRecordCount: null,
    unexpectedTeamIds: false,
    anomalies: [],
  };
}

function dryRunReport(plan: readonly Pe53bPlannedRequest[]): Pe53bProbeReport {
  return baseReport({
    mode: "dry_run",
    rejectionReason: null,
    plan,
    attempted: 0,
    measurements: [],
    stopped: false,
    stopReason: null,
    stoppedAtOrdinal: null,
  });
}

function rejectedReport(
  plan: readonly Pe53bPlannedRequest[],
  rejectionReason: Pe53bRejectionReason,
): Pe53bProbeReport {
  return baseReport({
    mode: "rejected",
    rejectionReason,
    plan,
    attempted: 0,
    measurements: [],
    stopped: true,
    stopReason: null,
    stoppedAtOrdinal: null,
  });
}

function finish(input: {
  plan: readonly Pe53bPlannedRequest[];
  attempted: number;
  measurements: Pe53bMeasurement[];
  stopped: boolean;
  stopReason: Pe53bStopReason | null;
  stoppedAtOrdinal: number | null;
}): Pe53bProbeReport {
  return baseReport({
    mode: "in_memory",
    rejectionReason: null,
    plan: input.plan,
    attempted: input.attempted,
    measurements: input.measurements,
    stopped: input.stopped,
    stopReason: input.stopReason,
    stoppedAtOrdinal: input.stoppedAtOrdinal,
  });
}

function baseReport(input: {
  mode: Pe53bProbeReport["mode"];
  rejectionReason: Pe53bRejectionReason | null;
  plan: readonly Pe53bPlannedRequest[];
  attempted: number;
  measurements: Pe53bMeasurement[];
  stopped: boolean;
  stopReason: Pe53bStopReason | null;
  stoppedAtOrdinal: number | null;
}): Pe53bProbeReport {
  return {
    runnerVersion: PE53B_RUNNER_VERSION,
    mode: input.mode,
    rejectionReason: input.rejectionReason,
    originRequestsAttempted: input.attempted,
    originRequestCap: PE53B_ORIGIN_REQUEST_CAP,
    plannedRequestCount: input.plan.length,
    plan: input.plan,
    stopped: input.stopped,
    stopReason: input.stopReason,
    stoppedAtOrdinal: input.stoppedAtOrdinal,
    measurements: input.measurements,
    writesAttempted: 0,
    liveResponsesStored: false,
    retriesAttempted: 0,
    liveProviderAuthorized: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
