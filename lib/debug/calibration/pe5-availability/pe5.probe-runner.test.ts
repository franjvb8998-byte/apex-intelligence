/**
 * PE-5.3C — offline probe-runner tests.
 * In-memory doubles only. No provider calls and no artifact writes.
 * Source regex checks are review aids, not a security boundary.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  executePe53bPlanForTests,
  runPe53bProbeForTests,
} from "@/lib/debug/calibration/pe5-availability/probe-test-boundary";
import {
  assertPe53bResearchPathUntouched,
  PE53B_FIXTURE_ALLOWLIST,
  PE53B_IN_MEMORY_CONFIRMATION,
  PE53B_LIVE_CONFIRMATION,
  PE53B_LIVE_PROVIDER_AUTHORIZED,
  PE53B_ORIGIN_REQUEST_CAP,
  PE53B_SELECTED_FIXTURES,
} from "@/lib/debug/calibration/pe5-availability/probe-fixtures";
import {
  authorizePe53bLiveProvider,
  buildPe53bPlan,
  executePe53bBrandedPlan,
  pe53cDispatchBudgetRemainingForTests,
  PE53C_REPORT_LIMITATIONS,
  resetPe53cDispatchBudgetForTests,
  runPe53bProbe,
  type Pe53bPlannedRequest,
  type Pe53bProbeReport,
} from "@/lib/debug/calibration/pe5-availability/probe-runner";
import type {
  Pe53bTransport,
  Pe53bTransportRequest,
  Pe53bTransportResponse,
} from "@/lib/debug/calibration/pe5-availability/probe-transport";
import { pe5Protocol } from "@/lib/debug/calibration/pe5-availability/protocol";

const SECRET = "TEST_SECRET_KEY_DO_NOT_LOG";
const LEAK_TOKEN = "PE53C_LEAK_TOKEN";
const PLAYER_NAME = "UniquePlayerNameZZZ";
const PLAYER_ID = 987654321;
const DAILY_QUOTA_MESSAGE =
  "You have reached the request limit for the day, Go to https://dashboard.api-football.com to upgrade your plan.";

afterEach(() => {
  resetPe53cDispatchBudgetForTests();
  vi.restoreAllMocks();
});

function envelope(
  request: Pe53bTransportRequest,
  response: unknown[],
  extras: Record<string, unknown> = {},
): Pe53bTransportResponse {
  return {
    status: 200,
    headers: {},
    body: {
      get: request.path.replace(/^\//, ""),
      parameters: { fixture: request.query.fixture },
      errors: [],
      results: response.length,
      paging: { current: 1, total: 1 },
      response,
      ...extras,
    },
  };
}

function scripted(
  respond: (
    request: Pe53bTransportRequest,
    call: number,
  ) => Pe53bTransportResponse | Promise<Pe53bTransportResponse>,
): { transport: Pe53bTransport; calls: () => number; seen: Pe53bTransportRequest[] } {
  const seen: Pe53bTransportRequest[] = [];
  return {
    seen,
    calls: () => seen.length,
    transport: {
      async request(request) {
        seen.push(request);
        return respond(request, seen.length);
      },
    },
  };
}

function emptyTransport() {
  return scripted((request) => envelope(request, []));
}

function lineup(home: string, away: string, playerId: number | null) {
  return [
    {
      team: { id: Number(home) },
      startXI: [{ player: { id: playerId, name: PLAYER_NAME } }],
      substitutes: [
        { player: { id: playerId == null ? null : playerId + 1, name: PLAYER_NAME } },
      ],
    },
    {
      team: { id: Number(away) },
      startXI: [{ player: { id: PLAYER_ID, name: PLAYER_NAME } }],
      substitutes: [],
    },
  ];
}

async function runDouble(
  respond: (
    request: Pe53bTransportRequest,
    call: number,
  ) => Pe53bTransportResponse | Promise<Pe53bTransportResponse>,
  plan: readonly Pe53bPlannedRequest[] = buildPe53bPlan(),
): Promise<{ report: Pe53bProbeReport; calls: number; seen: Pe53bTransportRequest[] }> {
  const fake = scripted(respond);
  const report = await executePe53bPlanForTests({
    plan,
    transport: fake.transport,
    inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
  });
  return { report, calls: fake.calls(), seen: fake.seen };
}

function assertUnproven(report: Pe53bProbeReport): void {
  const serialized = JSON.stringify(report);
  expect(serialized).not.toContain(SECRET);
  expect(serialized).not.toContain(LEAK_TOKEN);
  expect(serialized).not.toContain(PLAYER_NAME);
  expect(serialized).not.toContain(String(PLAYER_ID));
  expect(serialized).not.toContain('"evidenceClass":"PROSPECTIVE_PREMATCH_SNAPSHOT"');
  expect(serialized).not.toContain('"evidenceClass":"REALIZED_MATCHDAY_HISTORY"');
  expect(serialized).not.toContain('"targetPrematchEligible":true');
  expect(serialized).not.toContain('"zeroFilled":true');
  expect(serialized).not.toContain('"numericValue":0');
  expect(report.limitations).toEqual(PE53C_REPORT_LIMITATIONS);
  expect(report.writesAttempted).toBe(0);
  expect(report.retriesAttempted).toBe(0);
  expect(report.liveResponsesStored).toBe(false);
  expect(report.liveProviderAuthorized).toBe(false);
  for (const measurement of report.measurements) {
    expect(measurement).toMatchObject({
      evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN",
      provenance: "current_snapshot",
      captureTimestampVerified: false,
      capturedAtUtc: null,
      numericValue: null,
      zeroFilled: false,
      absenceMeansAvailable: false,
      targetPrematchEligible: false,
      laterTargetHistoryEligible: false,
    });
  }
}

describe("PE-5.3C probe runner", () => {
  it("plans exactly the PE-5.3A allowlist and 20 fixture-scoped requests", () => {
    const plan = buildPe53bPlan();
    expect(PE53B_SELECTED_FIXTURES.map((fixture) => fixture.fixtureId)).toEqual([
      "1035037",
      "1035553",
      "1208021",
      "1208208",
      "1126192",
      "1299091",
      "1184829",
      "1314299",
      "1180022",
      "1126302",
    ]);
    expect(PE53B_FIXTURE_ALLOWLIST).toHaveLength(10);
    expect(plan).toHaveLength(PE53B_ORIGIN_REQUEST_CAP);
    expect(plan.map((request) => request.fixtureId)).toEqual(
      PE53B_FIXTURE_ALLOWLIST.flatMap((id) => [id, id]),
    );
    for (const [index, fixture] of PE53B_SELECTED_FIXTURES.entries()) {
      const lineupRequest = plan[index * 2]!;
      const injuryRequest = plan[index * 2 + 1]!;
      expect(lineupRequest).toMatchObject({
        ordinal: index * 2 + 1,
        slot: fixture.slot,
        path: "/fixtures/lineups",
        endpoint: "lineups",
        query: { fixture: fixture.fixtureId },
      });
      expect(injuryRequest).toMatchObject({
        ordinal: index * 2 + 2,
        slot: fixture.slot,
        path: "/injuries",
        endpoint: "injuries",
        query: { fixture: fixture.fixtureId },
      });
      expect(Object.keys(lineupRequest.query)).toEqual(["fixture"]);
      expect(Object.keys(injuryRequest.query)).toEqual(["fixture"]);
      expect(fixture.providerSeason === "2023" || fixture.providerSeason === "2024").toBe(
        true,
      );
      expect(fixture.kickoffUtc.startsWith("2025")).toBe(false);
    }
  });

  it("dry-run performs no transport or network calls and stores nothing", async () => {
    const previous = globalThis.fetch;
    const events: string[] = [];
    globalThis.fetch = (async () => {
      events.push("fetch");
      throw new Error("network forbidden");
    }) as typeof fetch;
    const fake = emptyTransport();
    try {
      const report = await runPe53bProbe({
        transport: fake.transport,
      } as never);
      expect(report.mode).toBe("dry_run");
      expect(report.originRequestsAttempted).toBe(0);
      expect(report.plannedRequestCount).toBe(20);
      expect(report.measurements).toEqual([]);
      expect(report.limitations.writeAccounting).toBe(
        "runner_local_counter_not_a_storage_audit",
      );
      expect(fake.calls()).toBe(0);
      expect(events).toEqual([]);
      expect(pe53cDispatchBudgetRemainingForTests()).toBe(20);
      assertUnproven(report);
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("rejects live execution even with the confirmation token", async () => {
    const fake = emptyTransport();
    const auth = authorizePe53bLiveProvider({
      requestLiveProvider: true,
      liveConfirmation: PE53B_LIVE_CONFIRMATION,
    });
    expect(PE53B_LIVE_PROVIDER_AUTHORIZED).toBe(false);
    expect(pe5Protocol().pe53Authorized).toBe(false);
    expect(auth).toEqual({
      authorized: false,
      reason: "live_provider_not_authorized",
    });
    const report = await runPe53bProbe({
      requestLiveProvider: true,
      liveConfirmation: PE53B_LIVE_CONFIRMATION,
      mode: "in_memory",
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      transport: fake.transport,
    } as never);
    expect(report.mode).toBe("rejected");
    expect(report.rejectionReason).toBe("live_provider_not_authorized");
    expect(report.originRequestsAttempted).toBe(0);
    expect(fake.calls()).toBe(0);
    expect(pe53cDispatchBudgetRemainingForTests()).toBe(20);
  });

  it("does not retry and stops on the first authentication, quota, or 429 response", async () => {
    for (const [status, headers, reason] of [
      [401, {}, "unauthorized"],
      [403, {}, "unauthorized"],
      [429, {}, "rate_limited"],
      [200, { "x-ratelimit-requests-remaining": "0" }, "quota_exhausted"],
    ] as const) {
      resetPe53cDispatchBudgetForTests();
      const { report, calls } = await runDouble(() => ({
        status,
        headers,
        body: {
          errors: status === 200 ? [DAILY_QUOTA_MESSAGE] : [],
          response: [],
          paging: { current: 1, total: 1 },
          results: 0,
        },
      }));
      expect(report.stopReason).toBe(reason);
      expect(report.originRequestsAttempted).toBe(1);
      expect(report.retriesAttempted).toBe(0);
      expect(report.measurements).toEqual([]);
      expect(calls).toBe(1);
    }
  });

  it("stops on a thrown transport error without a second attempt", async () => {
    const { report, calls } = await runDouble(() => {
      throw new Error(`socket reset ${LEAK_TOKEN}`);
    });
    expect(report.stopReason).toBe("unexpected_provider_behavior");
    expect(report.originRequestsAttempted).toBe(1);
    expect(report.measurements).toEqual([]);
    expect(calls).toBe(1);
    expect(report.retriesAttempted).toBe(0);
    expect(JSON.stringify(report)).not.toContain(LEAK_TOKEN);
  });

  it("stops immediately on malformed envelopes, pagination, and fixture mismatch", async () => {
    const cases: Array<{ body: Record<string, unknown>; reason: string }> = [
      { body: { response: {} }, reason: "malformed_response" },
      {
        body: {
          errors: [],
          results: 0,
          paging: { current: 1, total: 2 },
          response: [],
        },
        reason: "unexpected_pagination",
      },
      {
        body: {
          errors: [],
          results: 0,
          paging: { current: 1, total: 1 },
          parameters: { fixture: "999" },
          response: [],
        },
        reason: "fixture_id_mismatch",
      },
    ];
    for (const candidate of cases) {
      resetPe53cDispatchBudgetForTests();
      const { report, calls } = await runDouble((request) =>
        envelope(request, [], candidate.body),
      );
      expect(report.stopReason).toBe(candidate.reason);
      expect(report.measurements).toEqual([]);
      expect(calls).toBe(1);
    }
  });

  it("rejects numeric and non-numeric pagination without a follow-up request", async () => {
    const previous = globalThis.fetch;
    const fetched: string[] = [];
    globalThis.fetch = (async () => {
      fetched.push("fetch");
      throw new Error("network forbidden");
    }) as typeof fetch;
    const nextUrl = "https://pe53c-paging-follow.test/page-2";
    const cases: Array<{
      paging: unknown;
      reason: "malformed_response" | "unexpected_pagination";
    }> = [
      { paging: null, reason: "malformed_response" },
      { paging: [], reason: "malformed_response" },
      { paging: "1", reason: "malformed_response" },
      { paging: 1, reason: "malformed_response" },
      { paging: { current: "1", total: "1" }, reason: "malformed_response" },
      { paging: { current: 1.5, total: 1 }, reason: "malformed_response" },
      { paging: { current: -1, total: 1 }, reason: "malformed_response" },
      { paging: { current: 1, total: -3 }, reason: "malformed_response" },
      { paging: { current: Number.NaN, total: 1 }, reason: "malformed_response" },
      {
        paging: { current: 1, total: Number.POSITIVE_INFINITY },
        reason: "malformed_response",
      },
      { paging: { current: 0, total: 1 }, reason: "malformed_response" },
      { paging: { current: 1, total: 0 }, reason: "malformed_response" },
      { paging: { current: 2, total: 1 }, reason: "unexpected_pagination" },
      { paging: { current: 1, total: 2 }, reason: "unexpected_pagination" },
      { paging: { current: 2, total: 4 }, reason: "unexpected_pagination" },
    ];
    try {
      for (const candidate of cases) {
        resetPe53cDispatchBudgetForTests();
        const { report, calls } = await runDouble((request) =>
          envelope(request, [], {
            paging: candidate.paging,
            next: nextUrl,
          }),
        );
        expect(report.stopReason).toBe(candidate.reason);
        expect(report.measurements).toEqual([]);
        expect(calls).toBe(1);
        expect(JSON.stringify(report)).not.toContain("pe53c-paging-follow.test");
      }
      resetPe53cDispatchBudgetForTests();
      const followed = await runDouble((request) =>
        envelope(request, [], { next: nextUrl }),
        buildPe53bPlan().slice(0, 1),
      );
      expect(followed.report.stopped).toBe(false);
      expect(followed.calls).toBe(1);
      expect(followed.report.measurements).toHaveLength(1);
      expect(JSON.stringify(followed.report)).not.toContain("pe53c-paging-follow.test");
      expect(fetched).toEqual([]);
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("contains throwing response getters and preserves earlier measurements", async () => {
    let call = 0;
    const { report, calls } = await runDouble(() => {
      call += 1;
      if (call < 3) {
        const request = buildPe53bPlan()[call - 1]!;
        return envelope(
          { path: request.path, query: { fixture: request.fixtureId } },
          [],
        );
      }
      return {
        get status(): number {
          throw new Error(`${LEAK_TOKEN} ${SECRET}`);
        },
        get body(): unknown {
          return { apiKey: SECRET, player: PLAYER_NAME };
        },
      };
    });
    expect(report.stopReason).toBe("unexpected_provider_behavior");
    expect(report.originRequestsAttempted).toBe(3);
    expect(report.measurements).toHaveLength(2);
    expect(report.stoppedAtOrdinal).toBe(3);
    expect(calls).toBe(3);
    assertUnproven(report);

    resetPe53cDispatchBudgetForTests();
    const pagingThrow = await runDouble(() => ({
      status: 200,
      headers: {},
      body: {
        errors: [],
        results: 0,
        response: [],
        get paging(): unknown {
          throw new Error(LEAK_TOKEN);
        },
      },
    }));
    expect(pagingThrow.report.stopReason).toBe("unexpected_provider_behavior");
    expect(pagingThrow.report.measurements).toEqual([]);
    expect(pagingThrow.report.originRequestsAttempted).toBe(1);
    expect(pagingThrow.calls).toBe(1);
    expect(JSON.stringify(pagingThrow.report)).not.toContain(LEAK_TOKEN);
  });

  it("rejects invalid and string HTTP statuses without treating them as auth or server errors", async () => {
    for (const status of ["401", "429", "500", "502", "503", "200", 200.5, Number.NaN, true, null]) {
      resetPe53cDispatchBudgetForTests();
      const { report, calls } = await runDouble(
        () =>
          ({
            status,
            headers: { "x-ratelimit-requests-remaining": "0" },
            body: {
              errors: [],
              results: 0,
              paging: { current: 1, total: 1 },
              response: [],
            },
          }) as Pe53bTransportResponse,
      );
      expect(report.stopReason).toBe("malformed_response");
      expect(report.measurements).toEqual([]);
      expect(calls).toBe(1);
    }
  });

  it("recognizes quota outside the errors array and ignores unrelated text", async () => {
    const quotaBodies: unknown[] = [
      {
        message: DAILY_QUOTA_MESSAGE,
        errors: [],
        results: 0,
        paging: { current: 1, total: 1 },
        response: [],
      },
      {
        errors: { requests: DAILY_QUOTA_MESSAGE },
        results: 0,
        paging: { current: 1, total: 1 },
        response: [],
      },
      {
        error: "API-Football daily request quota is exhausted",
        errors: [],
        results: 0,
        paging: { current: 1, total: 1 },
        response: [],
      },
    ];
    for (const body of quotaBodies) {
      resetPe53cDispatchBudgetForTests();
      const { report, calls } = await runDouble(() => ({ status: 200, headers: {}, body }));
      expect(report.stopReason).toBe("quota_exhausted");
      expect(report.measurements).toEqual([]);
      expect(calls).toBe(1);
    }

    resetPe53cDispatchBudgetForTests();
    const unrelated = await runDouble(
      (request) =>
        envelope(request, [], {
          message: "No fixtures for the day",
          note: "squad quota remains a coverage topic",
        }),
      buildPe53bPlan().slice(0, 1),
    );
    expect(unrelated.report.stopped).toBe(false);
    expect(unrelated.report.stopReason).toBeNull();
    expect(unrelated.report.measurements).toHaveLength(1);
    expect(unrelated.report.measurements[0]?.observation).toBe("missing");

    for (const errors of [
      ["squad quota remains a coverage topic"],
      ["daily training"],
      ["upgrade your plan"],
    ]) {
      resetPe53cDispatchBudgetForTests();
      const { report, calls } = await runDouble((request) =>
        envelope(request, [], { errors }),
      );
      expect(report.stopReason).toBe("malformed_response");
      expect(report.stopReason).not.toBe("quota_exhausted");
      expect(calls).toBe(1);
    }

    resetPe53cDispatchBudgetForTests();
    const minuteHeader = await runDouble(
      (request) =>
        envelope(request, [], {
          headersIgnored: true,
        }),
      buildPe53bPlan().slice(0, 1),
    );
    const minute = await runDouble(
      (request) => ({
        ...envelope(request, []),
        headers: { "x-ratelimit-remaining": "0" },
      }),
      buildPe53bPlan().slice(0, 1),
    );
    expect(minute.report.stopReason).not.toBe("quota_exhausted");
    expect(minute.report.stopped).toBe(false);
    expect(minuteHeader.report.stopped).toBe(false);
  });

  it("stops on 500, 502, and 503 without chasing another page", async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network forbidden");
    }) as typeof fetch;
    try {
      for (const status of [500, 502, 503]) {
        resetPe53cDispatchBudgetForTests();
        const { report, calls } = await runDouble(() => ({
          status,
          headers: { "x-ratelimit-requests-remaining": "0" },
          body: {
            message: DAILY_QUOTA_MESSAGE,
            errors: [],
            results: 0,
            paging: { current: 1, total: 2, next: "https://pe53c-paging-follow.test/500" },
            response: [],
          },
        }));
        expect(report.stopReason).toBe("unexpected_provider_behavior");
        expect(report.measurements).toEqual([]);
        expect(report.originRequestsAttempted).toBe(1);
        expect(calls).toBe(1);
        expect(JSON.stringify(report)).not.toContain("pe53c-paging-follow.test");
      }
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("records empty responses without inferring availability", async () => {
    const { report, calls } = await runDouble((request) => envelope(request, []));
    expect(report.stopped).toBe(false);
    expect(report.originRequestsAttempted).toBe(20);
    expect(calls).toBe(20);
    expect(report.measurements).toHaveLength(20);
    for (const measurement of report.measurements) {
      expect(measurement).toMatchObject({
        observation: "missing",
        responseState: "empty",
        anomalies: ["empty_response"],
      });
    }
    assertUnproven(report);
  });

  it("records missing player ids and unexpected team ids without promoting them", async () => {
    const { report } = await runDouble((request) => {
      const fixture = PE53B_SELECTED_FIXTURES.find(
        (row) => row.fixtureId === request.query.fixture,
      )!;
      if (request.path === "/fixtures/lineups") {
        return envelope(request, lineup(fixture.homeTeamId, fixture.awayTeamId, null));
      }
      return envelope(request, [
        {
          player: { id: null, name: PLAYER_NAME },
          team: { id: 999001 },
          fixture: { id: Number(request.query.fixture) },
        },
      ]);
    });
    expect(report.stopped).toBe(false);
    expect(report.originRequestsAttempted).toBe(20);
    const lineupMeasurement = report.measurements.find(
      (measurement) => measurement.endpoint === "lineups",
    );
    const injuryMeasurement = report.measurements.find(
      (measurement) => measurement.endpoint === "injuries",
    );
    expect(lineupMeasurement?.playerIdsMissing).toBeGreaterThan(0);
    expect(lineupMeasurement?.anomalies).toContain("missing_player_id");
    expect(injuryMeasurement).toMatchObject({
      observation: "present",
      unexpectedTeamIds: true,
    });
    expect(injuryMeasurement?.anomalies).toContain("missing_player_id");
    expect(injuryMeasurement?.anomalies).toContain("unexpected_team_ids");
    assertUnproven(report);

    resetPe53cDispatchBudgetForTests();
    const missingTeam = await runDouble(
      (request) => {
        if (request.path === "/injuries") {
          return envelope(request, [{ player: { id: 15 }, team: {} }]);
        }
        return envelope(request, []);
      },
      buildPe53bPlan().slice(0, 2),
    );
    expect(missingTeam.report.stopped).toBe(false);
    expect(missingTeam.report.measurements[1]).toMatchObject({
      endpoint: "injuries",
      unexpectedTeamIds: true,
      numericValue: null,
      absenceMeansAvailable: false,
    });
  });

  it("shares one dispatch budget across concurrent and later runner calls", async () => {
    let calls = 0;
    const make = () =>
      scripted(async (request) => {
        calls += 1;
        await Promise.resolve();
        return envelope(request, []);
      });
    const first = make();
    const second = make();
    const [left, right] = await Promise.all([
      runPe53bProbeForTests({
        transport: first.transport,
        inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      }),
      runPe53bProbeForTests({
        transport: second.transport,
        inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      }),
    ]);
    expect(calls).toBe(20);
    expect(left.originRequestsAttempted + right.originRequestsAttempted).toBe(20);
    expect(left.originRequestsAttempted).toBeGreaterThan(0);
    expect(right.originRequestsAttempted).toBeGreaterThan(0);
    expect(left.originRequestsAttempted).toBeLessThanOrEqual(20);
    expect(right.originRequestsAttempted).toBeLessThanOrEqual(20);
    expect(pe53cDispatchBudgetRemainingForTests()).toBe(0);

    const bypass = emptyTransport();
    const blocked = await runPe53bProbeForTests({
      transport: bypass.transport,
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
    });
    expect(bypass.calls()).toBe(0);
    expect(blocked.originRequestsAttempted).toBe(0);
    expect(blocked.stopReason).toBe("request_cap");
    expect(blocked.stoppedAtOrdinal).toBeNull();
    expect(blocked.measurements).toEqual([]);
  });

  it("refuses a 21st origin request and does not reset the shared budget", async () => {
    const official = buildPe53bPlan();
    const extra: Pe53bPlannedRequest = { ...official[0]!, ordinal: 21 };
    const fake = emptyTransport();
    const report = await executePe53bPlanForTests({
      plan: [...official, extra],
      transport: fake.transport,
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
    });
    expect(fake.calls()).toBe(20);
    expect(report.originRequestsAttempted).toBe(20);
    expect(report.stopReason).toBe("request_cap");
    expect(report.stoppedAtOrdinal).toBeNull();

    const other = emptyTransport();
    const second = await executePe53bPlanForTests({
      plan: official,
      transport: other.transport,
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
    });
    expect(other.calls()).toBe(0);
    expect(second.stopReason).toBe("request_cap");
    expect(second.originRequestsAttempted).toBe(0);
  });

  it("rejects fixtures outside the allowlist, 2025 holdout, and extra query parameters before a call", async () => {
    const official = buildPe53bPlan();
    const outside: Pe53bPlannedRequest = {
      ...official[0]!,
      fixtureId: "999001",
      query: { fixture: "999001" },
      providerSeason: "2024",
      kickoffUtc: "2024-08-16T19:00:00.000Z",
    };
    const holdout: Pe53bPlannedRequest = {
      ...official[0]!,
      providerSeason: "2025",
      kickoffUtc: "2025-08-16T19:00:00.000Z",
    };
    const fallback: Pe53bPlannedRequest = {
      ...official[0]!,
      query: { fixture: official[0]!.fixtureId, season: "2024" } as {
        fixture: string;
      },
    };
    const hiddenPage: Pe53bPlannedRequest = {
      ...official[0]!,
      query: { fixture: official[0]!.fixtureId },
    };
    Object.defineProperty(hiddenPage.query, "page", {
      value: "2",
      enumerable: false,
    });
    for (const [plan, reason] of [
      [[outside], "fixture_not_allowlisted"],
      [[holdout], "holdout_rejected"],
      [[fallback], "fallback_query_rejected"],
      [[hiddenPage], "fallback_query_rejected"],
    ] as const) {
      resetPe53cDispatchBudgetForTests();
      const fake = emptyTransport();
      const report = await executePe53bPlanForTests({
        plan,
        transport: fake.transport,
        inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      });
      expect(report.stopReason).toBe(reason);
      expect(fake.calls()).toBe(0);
      expect(report.originRequestsAttempted).toBe(0);
      expect(pe53cDispatchBudgetRemainingForTests()).toBe(20);
    }
  });

  it("rejects endpoint and path disagreement before dispatch", async () => {
    const official = buildPe53bPlan();
    const cases: Pe53bPlannedRequest[] = [
      { ...official[0]!, endpoint: "lineups", path: "/injuries" },
      { ...official[1]!, endpoint: "injuries", path: "/fixtures/lineups" },
    ];
    for (const request of cases) {
      resetPe53cDispatchBudgetForTests();
      const { report, calls } = await runDouble(
        (query) => envelope(query, []),
        [request],
      );
      expect(report.stopReason).toBe("fallback_query_rejected");
      expect(report.originRequestsAttempted).toBe(0);
      expect(calls).toBe(0);
    }
  });

  it("keeps the snapshotted fixture order when the plan and query are mutated mid-run", async () => {
    const original = buildPe53bPlan().map((request) => ({
      ...request,
      query: { fixture: request.fixtureId },
    }));
    const dispatched: Array<{ path: string; fixture: string; keys: string[] }> = [];
    const fake = scripted((request) => {
      dispatched.push({
        path: request.path,
        fixture: request.query.fixture,
        keys: Object.keys(request.query),
      });
      const mutableQuery = request.query as { fixture: string; season?: string };
      mutableQuery.fixture = "1";
      mutableQuery.season = "2025";
      const later = original[1];
      if (later) {
        later.fixtureId = "999001";
        later.path = "/injuries";
        later.endpoint = "lineups";
        later.providerSeason = "2025";
        later.kickoffUtc = "2025-01-01T00:00:00.000Z";
        later.query = { fixture: "999001", page: "2" } as typeof later.query;
      }
      return envelope(
        { path: dispatched.at(-1)!.path as Pe53bTransportRequest["path"], query: { fixture: dispatched.at(-1)!.fixture } },
        [],
      );
    });
    const report = await executePe53bPlanForTests({
      plan: original,
      transport: fake.transport,
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
    });
    const expected = buildPe53bPlan();
    expect(report.stopped).toBe(false);
    expect(report.originRequestsAttempted).toBe(20);
    expect(dispatched).toEqual(
      expected.map((request) => ({
        path: request.path,
        fixture: request.fixtureId,
        keys: ["fixture"],
      })),
    );
  });

  it("stops without recording a measurement when a fixture season is mutated to 2025", async () => {
    const fixture = PE53B_SELECTED_FIXTURES[0]!;
    const previous = fixture.providerSeason;
    try {
      const { report, calls } = await runDouble((request) => {
        (fixture as { providerSeason: string }).providerSeason = "2025";
        return envelope(request, []);
      });
      expect(calls).toBe(1);
      expect(report.originRequestsAttempted).toBe(1);
      expect(report.measurements).toEqual([]);
      expect(report.stopReason).toBe("holdout_rejected");
      expect(report.stoppedAtOrdinal).toBe(1);
    } finally {
      (fixture as { providerSeason: string }).providerSeason = previous;
    }
  });

  it("preserves partial measurements when a later request fails the pre-dispatch gate", async () => {
    const plan = buildPe53bPlan().slice(0, 3).map((request) => ({
      ...request,
      query: { fixture: request.fixtureId },
    }));
    plan[2] = {
      ...plan[2]!,
      query: { fixture: plan[2]!.fixtureId, page: "2" } as typeof plan[2]["query"],
    };
    const { report, calls } = await runDouble((request) => envelope(request, []), plan);
    expect(calls).toBe(2);
    expect(report.originRequestsAttempted).toBe(2);
    expect(report.measurements).toHaveLength(2);
    expect(report.stopReason).toBe("fallback_query_rejected");
    expect(report.stoppedAtOrdinal).toBe(3);
    assertUnproven(report);
  });

  it("ignores caller transports on the public entry, including a forged capability", async () => {
    const previous = globalThis.fetch;
    const events: string[] = [];
    globalThis.fetch = (async () => {
      events.push("fetch");
      throw new Error("network forbidden");
    }) as typeof fetch;
    const hostileCalls: string[] = [];
    const forged = {
      kind: "in_memory",
      [Symbol("pe53c.offlineFixtureTransport")]: Symbol("pe53c.offlineFixtureTransport"),
      async request() {
        hostileCalls.push("transport");
        await globalThis.fetch("https://v3.football.api-sports.io/fixtures");
        return { status: 200, body: { response: [] } };
      },
    };
    try {
      const report = await runPe53bProbe({
        mode: "in_memory",
        inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
        transport: forged,
      } as never);
      expect(hostileCalls).toEqual([]);
      expect(events).toEqual([]);
      expect(report.mode).toBe("in_memory");
      expect(report.originRequestsAttempted).toBe(20);
      expect(report.measurements).toHaveLength(20);
      assertUnproven(report);

      const unbranded = emptyTransport();
      const rejected = await executePe53bBrandedPlan({
        plan: buildPe53bPlan(),
        transport: { kind: "in_memory", request: unbranded.transport.request },
        inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      });
      expect(unbranded.calls()).toBe(0);
      expect(rejected.mode).toBe("rejected");
      expect(rejected.rejectionReason).toBe("in_memory_transport_required");
      expect(rejected.originRequestsAttempted).toBe(0);
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("refuses frozen research paths and keeps provider clients out of the runner", () => {
    expect(() =>
      assertPe53bResearchPathUntouched(
        "data/calibration/pe4-acquisition-v1/stage1-i5/calendar-2025-spill.json",
      ),
    ).toThrow(/frozen research path/);
    expect(() =>
      assertPe53bResearchPathUntouched(
        "data/calibration/pe4-acquisition-v1/stage2i17-dev-dataset/target-labels-separated.json",
      ),
    ).toThrow(/frozen research path/);
    expect(() =>
      assertPe53bResearchPathUntouched(
        "lib/debug/calibration/pe4-as-of-t-features/ledger.ts",
      ),
    ).toThrow(/frozen research path/);

    const directory = path.join(
      process.cwd(),
      "lib/debug/calibration/pe5-availability",
    );
    const files = [
      "probe-fixtures.ts",
      "probe-transport.ts",
      "probe-runner.ts",
      "probe-offline-capability.ts",
      "probe-test-boundary.ts",
    ];
    const sources = files.map((file) => readFileSync(path.join(directory, file), "utf8"));
    const forbidden = [
      /from\s+["']node:fs["']/,
      /from\s+["']node:http["']/,
      /from\s+["']node:https["']/,
      /from\s+["']node:net["']/,
      /from\s+["']fs["']/,
      /\bfetch\s*\(/,
      /\bimport\s*\(/,
      /createApiFootballClient/,
      /API_FOOTBALL_KEY/,
      /axios/,
      /undici/,
      /writeFile|appendFile|mkdirSync|createWriteStream/,
      /child_process/,
      /api-sports\.io/,
    ];
    for (const source of sources) {
      for (const pattern of forbidden) {
        expect(source).not.toMatch(pattern);
      }
    }
    const runnerSource = sources[2]!;
    const capabilitySource = sources[3]!;
    const publicEntry = runnerSource.slice(
      runnerSource.indexOf("export async function runPe53bProbe"),
      runnerSource.indexOf("export async function executePe53bBrandedPlan"),
    );
    expect(publicEntry).toContain("createPe53bBuiltinOfflineTransport()");
    expect(publicEntry).not.toContain("input.transport");
    expect(publicEntry).not.toMatch(/\.request\s*\(/);
    expect(runnerSource).not.toContain("createPe53bBrandedOfflineTransport");
    expect(runnerSource.match(/await send\(/g)).toEqual(["await send("]);
    expect(runnerSource.match(/resetPe53cDispatchBudgetForTests/g)).toHaveLength(1);
    expect(capabilitySource).toContain("Symbol(");
    expect(capabilitySource).not.toMatch(/export\s+(?:const|function|type)\s+PE53C_OFFLINE_CAPABILITY/);
    expect(runnerSource).not.toMatch(/kind\s*[!=]==\s*["']in_memory["']/);
  });
});
