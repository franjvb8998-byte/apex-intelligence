/**
 * PE-5.3C — offline historical squad-coverage probe runner.
 *
 * Public entry: runPe53bProbe. Dry-run by default. In-memory mode uses the
 * builtin offline transport only. Caller callbacks are not read.
 *
 * The dispatch budget is one in-process counter shared through globalThis.
 * It is not a cross-process, cross-worker, or distributed cap. The test reset
 * is explicit; the runner does not refill the counter between runs.
 *
 * Source-level isolation is not a sandbox. The testing boundary can stamp a
 * double the public entry cannot see.
 */

import { classifyPe5Evidence } from "@/lib/debug/calibration/pe5-availability/evidence-class";
import {
  createPe53bBuiltinOfflineTransport,
  isPe53bBrandedOfflineTransport,
  type Pe53bBrandedOfflineTransport,
} from "@/lib/debug/calibration/pe5-availability/probe-offline-capability";
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
  Pe53bTransportRequest,
  Pe53bTransportResponse,
} from "@/lib/debug/calibration/pe5-availability/probe-transport";

export const PE53B_RUNNER_VERSION = "pe5.probe_runner.v2" as const;

export const PE53C_REPORT_LIMITATIONS = Object.freeze({
  measurements: "coverage_counts_only",
  missingObservations: "stay_missing_not_zero_not_available",
  historicalEvidence: "CURRENT_SNAPSHOT_UNPROVEN",
  writeAccounting: "runner_local_counter_not_a_storage_audit",
  dispatchBudget: "in_process_shared_counter_not_cross_process",
  transportIsolation: "public_entry_local_transport_not_a_sandbox",
} as const);

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
  limitations: typeof PE53C_REPORT_LIMITATIONS;
};

export type Pe53bProbeInput = {
  mode?: "dry_run" | "in_memory";
  inMemoryConfirmation?: string | null;
  requestLiveProvider?: boolean;
  liveConfirmation?: string | null;
};

const DAILY_QUOTA_RE = /request limit for the day|daily request quota/i;
const DAILY_REMAINING_HEADER = "x-ratelimit-requests-remaining";
const FIXTURE_ID_RE = /^[1-9]\d{0,11}$/;
const DISPATCH_BUDGET_SLOT = Symbol.for("apex.pe53c.offlineProbeDispatchBudget");

type DispatchBudget = { remaining: number };
type BudgetGlobal = typeof globalThis & {
  [DISPATCH_BUDGET_SLOT]?: DispatchBudget;
};

const localBudget: DispatchBudget = { remaining: PE53B_ORIGIN_REQUEST_CAP };
let budgetOwner: DispatchBudget | null = null;

type Interpretation =
  | { stopReason: Pe53bStopReason }
  | { stopReason: null; measurement: Pe53bMeasurement };

type FinishInput = {
  mode?: Pe53bProbeReport["mode"];
  rejectionReason?: Pe53bRejectionReason | null;
  plan: readonly Pe53bPlannedRequest[];
  attempted: number;
  measurements: Pe53bMeasurement[];
  stopped: boolean;
  stopReason: Pe53bStopReason | null;
  stoppedAtOrdinal: number | null;
};

/**
 * In-process dispatch budget.
 * The first module copy publishes one counter on globalThis. Later copies
 * adopt it. Replacing or deleting the slot is written back to that object.
 * A second OS process, worker, or realm has its own counter.
 */
function sharedDispatchBudget(): DispatchBudget {
  const g = globalThis as BudgetGlobal;
  if (budgetOwner) {
    g[DISPATCH_BUDGET_SLOT] = budgetOwner;
    return budgetOwner;
  }
  const existing = g[DISPATCH_BUDGET_SLOT];
  if (existing && typeof existing === "object") {
    if (
      !Number.isInteger(existing.remaining) ||
      existing.remaining < 0 ||
      existing.remaining > PE53B_ORIGIN_REQUEST_CAP
    ) {
      existing.remaining = 0;
    }
    budgetOwner = existing;
    return existing;
  }
  budgetOwner = localBudget;
  g[DISPATCH_BUDGET_SLOT] = budgetOwner;
  return budgetOwner;
}

function tryReserveDispatch(): boolean {
  const budget = sharedDispatchBudget();
  if (
    !Number.isInteger(budget.remaining) ||
    budget.remaining <= 0 ||
    budget.remaining > PE53B_ORIGIN_REQUEST_CAP
  ) {
    budget.remaining = 0;
    return false;
  }
  budget.remaining -= 1;
  return true;
}

export function resetPe53cDispatchBudgetForTests(): void {
  const budget = sharedDispatchBudget();
  budget.remaining = PE53B_ORIGIN_REQUEST_CAP;
}

export function pe53cDispatchBudgetRemainingForTests(): number {
  return sharedDispatchBudget().remaining;
}

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
  try {
    const plan = buildPe53bPlan();
    if (input.requestLiveProvider === true) {
      const auth = authorizePe53bLiveProvider({
        requestLiveProvider: true,
        liveConfirmation: input.liveConfirmation,
      });
      return rejectedReport(plan, auth.reason);
    }
    const mode = input.mode ?? "dry_run";
    if (mode === "dry_run") return dryRunReport(plan);
    if (mode !== "in_memory") {
      return rejectedReport(plan, "in_memory_transport_required");
    }
    if (input.inMemoryConfirmation !== PE53B_IN_MEMORY_CONFIRMATION) {
      return rejectedReport(plan, "in_memory_confirmation_missing");
    }
    return await executePe53bPlan(plan, createPe53bBuiltinOfflineTransport());
  } catch {
    return fatalReport("unexpected_provider_behavior");
  }
}

export async function executePe53bBrandedPlan(input: {
  plan: readonly Pe53bPlannedRequest[];
  transport: unknown;
  inMemoryConfirmation?: string | null;
}): Promise<Pe53bProbeReport> {
  try {
    const officialPlan = buildPe53bPlan();
    if (input.inMemoryConfirmation !== PE53B_IN_MEMORY_CONFIRMATION) {
      return rejectedReport(officialPlan, "in_memory_confirmation_missing");
    }
    if (!isPe53bBrandedOfflineTransport(input.transport)) {
      return rejectedReport(officialPlan, "in_memory_transport_required");
    }
    return await executePe53bPlan(input.plan, input.transport);
  } catch {
    return fatalReport("unexpected_provider_behavior");
  }
}

async function executePe53bPlan(
  plan: readonly Pe53bPlannedRequest[],
  transport: Pe53bBrandedOfflineTransport,
): Promise<Pe53bProbeReport> {
  const send = transport.request;
  let snapshots: Pe53bPlannedRequest[];
  try {
    snapshots = snapshotPlan(plan);
  } catch {
    return finish({
      plan: [],
      attempted: 0,
      measurements: [],
      stopped: true,
      stopReason: "unexpected_provider_behavior",
      stoppedAtOrdinal: null,
    });
  }

  const measurements: Pe53bMeasurement[] = [];
  let attempted = 0;

  for (const request of snapshots) {
    const shape = safeDispatchShape(request);
    if (shape.stopReason) {
      return finish({
        plan: snapshots,
        attempted,
        measurements,
        stopped: true,
        stopReason: shape.stopReason,
        stoppedAtOrdinal: ordinalOf(request),
      });
    }
    if (!tryReserveDispatch()) {
      return finish({
        plan: snapshots,
        attempted,
        measurements,
        stopped: true,
        stopReason: "request_cap",
        stoppedAtOrdinal: null,
      });
    }
    attempted += 1;
    try {
      const response = await send({
        path: shape.path,
        query: { fixture: shape.fixture },
      });
      const interpreted = interpretResponse(request, response);
      if (interpreted.stopReason) {
        return finish({
          plan: snapshots,
          attempted,
          measurements,
          stopped: true,
          stopReason: interpreted.stopReason,
          stoppedAtOrdinal: ordinalOf(request),
        });
      }
      measurements.push(interpreted.measurement);
    } catch {
      return finish({
        plan: snapshots,
        attempted,
        measurements,
        stopped: true,
        stopReason: "unexpected_provider_behavior",
        stoppedAtOrdinal: ordinalOf(request),
      });
    }
  }

  return finish({
    plan: snapshots,
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

function snapshotPlan(
  plan: readonly Pe53bPlannedRequest[],
): Pe53bPlannedRequest[] {
  if (!Array.isArray(plan)) {
    throw new Error("plan");
  }
  return plan.map((request) => ({
    ordinal: request.ordinal,
    slot: request.slot,
    fixtureId: request.fixtureId,
    competitionId: request.competitionId,
    providerSeason: request.providerSeason,
    kickoffUtc: request.kickoffUtc,
    homeTeamId: request.homeTeamId,
    awayTeamId: request.awayTeamId,
    endpoint: request.endpoint,
    path: request.path,
    query: copyQuery(request.query) as Pe53bPlannedRequest["query"],
  }));
}

function copyQuery(query: unknown): Record<PropertyKey, unknown> {
  if (!isPlainObject(query)) return {};
  const copy: Record<PropertyKey, unknown> = {};
  for (const key of Reflect.ownKeys(query)) {
    copy[key] = Reflect.get(query, key);
  }
  return copy;
}

function safeDispatchShape(request: Pe53bPlannedRequest):
  | {
      stopReason: null;
      path: Pe53bTransportRequest["path"];
      fixture: string;
    }
  | { stopReason: Pe53bStopReason } {
  try {
    const gate = gateRequest(request);
    if (gate) return { stopReason: gate };
    if (request.path !== "/fixtures/lineups" && request.path !== "/injuries") {
      return { stopReason: "fallback_query_rejected" };
    }
    return { stopReason: null, path: request.path, fixture: request.fixtureId };
  } catch {
    return { stopReason: "unexpected_provider_behavior" };
  }
}

function gateRequest(request: Pe53bPlannedRequest): Pe53bStopReason | null {
  if (queryRejected(request) || pathDisagrees(request)) {
    return "fallback_query_rejected";
  }
  if (isHoldoutValue(request.providerSeason, request.kickoffUtc)) {
    return "holdout_rejected";
  }
  if (
    typeof request.fixtureId !== "string" ||
    !FIXTURE_ID_RE.test(request.fixtureId) ||
    !isPe53bFixtureAllowed(request.fixtureId)
  ) {
    return "fixture_not_allowlisted";
  }
  const fixture = pe53bFixtureById(request.fixtureId);
  if (!fixture) return "fixture_not_allowlisted";
  if (isHoldoutValue(fixture.providerSeason, fixture.kickoffUtc)) {
    return "holdout_rejected";
  }
  return null;
}

function queryRejected(request: Pe53bPlannedRequest): boolean {
  const query = request.query as unknown;
  if (!isPlainObject(query)) return true;
  const keys = Reflect.ownKeys(query);
  if (keys.length !== 1 || keys[0] !== "fixture") return true;
  return query.fixture !== request.fixtureId;
}

function pathDisagrees(request: Pe53bPlannedRequest): boolean {
  if (request.endpoint === "lineups") return request.path !== "/fixtures/lineups";
  if (request.endpoint === "injuries") return request.path !== "/injuries";
  return true;
}

function isHoldoutValue(season: unknown, kickoff: unknown): boolean {
  if (typeof season !== "string" || typeof kickoff !== "string") return true;
  if (season.trim() === "2025") return true;
  return kickoff.trim().startsWith("2025");
}

function interpretResponse(
  request: Pe53bPlannedRequest,
  response: Pe53bTransportResponse,
): Interpretation {
  const status = readHttpStatus(response.status);
  if (status == null) return stop("malformed_response");
  if (status === 401 || status === 403) return stop("unauthorized");
  if (status >= 500) return stop("unexpected_provider_behavior");

  const headerQuota = readDailyQuotaHeader(response.headers);
  if (headerQuota === "exhausted") return stop("quota_exhausted");

  let bodyQuota = false;
  try {
    bodyQuota = bodyHasDailyQuota(response.body);
  } catch {
    if (status === 429) return stop("rate_limited");
    return stop("unexpected_provider_behavior");
  }
  if (bodyQuota) return stop("quota_exhausted");
  if (status === 429) return stop("rate_limited");
  if (headerQuota === "malformed") return stop("malformed_response");
  if (status !== 200) return stop("malformed_response");
  return interpretSuccessBody(request, response.body);
}

function interpretSuccessBody(
  request: Pe53bPlannedRequest,
  bodyValue: unknown,
): Interpretation {
  if (!isPlainObject(bodyValue)) return stop("malformed_response");
  const body = bodyValue;
  if (!Array.isArray(body.errors) || body.errors.length !== 0) {
    return stop("malformed_response");
  }
  if (!Array.isArray(body.response)) return stop("malformed_response");
  const paging = classifyPaging(body.paging);
  if (paging !== "ok") return stop(paging);
  if (getMismatches(request, body.get)) {
    return stop("unexpected_provider_behavior");
  }
  if (
    typeof body.results !== "number" ||
    !Number.isSafeInteger(body.results) ||
    body.results < 0
  ) {
    return stop("malformed_response");
  }
  if (body.results !== body.response.length) {
    return stop("unexpected_provider_behavior");
  }
  if (fixtureIdMismatches(request.fixtureId, body)) {
    return stop("fixture_id_mismatch");
  }
  if (rowsAreMalformed(request, body.response)) {
    return stop("malformed_response");
  }

  const coverage = summarizeCoverage(request, body.response);
  const observation = body.response.length === 0 ? "missing" : "present";
  const protocol = classifyHistoricalQuery(request);
  if (protocol.stopReason) return stop(protocol.stopReason);

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
      httpStatus: 200,
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

function classifyHistoricalQuery(request: Pe53bPlannedRequest): {
  stopReason: Pe53bStopReason | null;
  reason: Pe5FailReason | "classified";
} {
  const fixture = pe53bFixtureById(request.fixtureId);
  if (!fixture) {
    return { stopReason: "fixture_not_allowlisted", reason: "invalid_identifier" };
  }
  if (
    isHoldoutValue(fixture.providerSeason, fixture.kickoffUtc) ||
    isHoldoutValue(request.providerSeason, request.kickoffUtc)
  ) {
    return { stopReason: "holdout_rejected", reason: "holdout_source_excluded" };
  }
  const kind: Pe5SquadEvidenceKind =
    request.endpoint === "lineups" ? "confirmed_starting_xi" : "injury_unavailability";
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
    return { stopReason: "evidence_promotion_blocked", reason: decision.reason };
  }
  return { stopReason: null, reason: decision.reason };
}

function rowsAreMalformed(
  request: Pe53bPlannedRequest,
  rows: readonly unknown[],
): boolean {
  for (const row of rows) {
    if (!isPlainObject(row)) return true;
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
  const expected = new Set<string>();
  if (typeof request.homeTeamId === "string") expected.add(request.homeTeamId);
  if (typeof request.awayTeamId === "string") expected.add(request.awayTeamId);
  let playerIdsPresent = 0;
  let playerIdsMissing = 0;
  let unexpectedTeamIds = false;
  // Both endpoints use readTeamId. A missing or foreign club is unexpected.
  // Lineups also require both clubs. An injury list may name only one.
  const observedTeams = new Set<string>();

  if (request.endpoint === "injuries") {
    for (const row of rows) {
      if (!isPlainObject(row)) continue;
      const idState = readPlayerId(isPlainObject(row.player) ? row.player.id : undefined);
      if (idState === "present") playerIdsPresent += 1;
      else playerIdsMissing += 1;
      const teamId = readTeamId(isPlainObject(row.team) ? row.team.id : undefined);
      if (teamId == null || !expected.has(teamId)) unexpectedTeamIds = true;
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
    if (!isPlainObject(row)) continue;
    const teamId = readTeamId(isPlainObject(row.team) ? row.team.id : undefined);
    if (teamId == null || !expected.has(teamId)) unexpectedTeamIds = true;
    else observedTeams.add(teamId);
    const startXi = Array.isArray(row.startXI) ? row.startXI : [];
    const substitutes = Array.isArray(row.substitutes) ? row.substitutes : [];
    startXiCount += startXi.length;
    substituteCount += substitutes.length;
    for (const entry of [...startXi, ...substitutes]) {
      const player =
        isPlainObject(entry) && isPlainObject(entry.player) ? entry.player : null;
      const idState = readPlayerId(player ? player.id : undefined);
      if (idState === "present") playerIdsPresent += 1;
      else playerIdsMissing += 1;
    }
  }
  if (rows.length > 0 && observedTeams.size !== expected.size) {
    unexpectedTeamIds = true;
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
  if (isPlainObject(body.parameters) && "fixture" in body.parameters) {
    if (String(body.parameters.fixture) !== fixtureId) return true;
  }
  if (!Array.isArray(body.response)) return false;
  for (const row of body.response) {
    if (!isPlainObject(row) || !isPlainObject(row.fixture) || row.fixture.id == null) {
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

function classifyPaging(
  paging: unknown,
): "ok" | "malformed_response" | "unexpected_pagination" {
  if (!isPlainObject(paging)) return "malformed_response";
  const current = paging.current;
  const total = paging.total;
  if (!isPositiveSafeInteger(current) || !isPositiveSafeInteger(total)) {
    return "malformed_response";
  }
  if (current !== 1 || total !== 1) return "unexpected_pagination";
  return "ok";
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function readHttpStatus(status: unknown): number | null {
  if (typeof status !== "number" || !Number.isInteger(status)) return null;
  if (status < 100 || status > 599) return null;
  return status;
}

function readDailyQuotaHeader(
  headers: unknown,
): "absent" | "exhausted" | "malformed" {
  if (headers == null) return "absent";
  if (!isPlainObject(headers)) return "malformed";
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== DAILY_REMAINING_HEADER) continue;
    if (typeof value === "string" && value.trim() === "0") return "exhausted";
  }
  return "absent";
}

function bodyHasDailyQuota(body: unknown): boolean {
  if (!isPlainObject(body)) return false;
  const parts: string[] = [];
  appendString(parts, body.message);
  appendString(parts, body.error);
  appendErrors(parts, body.errors);
  if (parts.length === 0) return false;
  return DAILY_QUOTA_RE.test(parts.join("\n"));
}

function appendString(parts: string[], value: unknown): void {
  if (typeof value === "string" && value.trim() !== "") parts.push(value);
}

function appendErrors(parts: string[], errors: unknown): void {
  if (typeof errors === "string") {
    appendString(parts, errors);
    return;
  }
  if (Array.isArray(errors)) {
    for (const entry of errors) appendString(parts, entry);
    return;
  }
  if (!isPlainObject(errors)) return;
  for (const value of Object.values(errors)) {
    if (Array.isArray(value)) {
      for (const entry of value) appendString(parts, entry);
      continue;
    }
    appendString(parts, value);
  }
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

function ordinalOf(request: Pe53bPlannedRequest): number | null {
  return typeof request.ordinal === "number" && Number.isInteger(request.ordinal)
    ? request.ordinal
    : null;
}

function stop(stopReason: Pe53bStopReason): Interpretation {
  return { stopReason };
}

function dryRunReport(plan: readonly Pe53bPlannedRequest[]): Pe53bProbeReport {
  return finish({
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
  return finish({
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

function fatalReport(stopReason: Pe53bStopReason): Pe53bProbeReport {
  return finish({
    mode: "rejected",
    rejectionReason: null,
    plan: [],
    attempted: 0,
    measurements: [],
    stopped: true,
    stopReason,
    stoppedAtOrdinal: null,
  });
}

function finish(input: FinishInput): Pe53bProbeReport {
  return {
    runnerVersion: PE53B_RUNNER_VERSION,
    mode: input.mode ?? "in_memory",
    rejectionReason: input.rejectionReason ?? null,
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
    limitations: PE53C_REPORT_LIMITATIONS,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
