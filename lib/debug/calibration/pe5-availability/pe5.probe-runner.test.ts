/**
 * PE-5.3B — offline probe-runner tests.
 * In-memory transport only. No provider calls, no artifact writes.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  executePe53bPlan,
  runPe53bProbe,
  type Pe53bPlannedRequest,
} from "@/lib/debug/calibration/pe5-availability/probe-runner";
import type {
  Pe53bTransport,
  Pe53bTransportRequest,
  Pe53bTransportResponse,
} from "@/lib/debug/calibration/pe5-availability/probe-transport";
import { pe5Protocol } from "@/lib/debug/calibration/pe5-availability/protocol";

const SECRET = "TEST_SECRET_KEY_DO_NOT_LOG";
const PLAYER_NAME = "UniquePlayerNameZZZ";
const PLAYER_ID = 987654321;

afterEach(() => {
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
      kind: "in_memory",
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
      substitutes: [{ player: { id: playerId == null ? null : playerId + 1, name: PLAYER_NAME } }],
    },
    {
      team: { id: Number(away) },
      startXI: [{ player: { id: PLAYER_ID, name: PLAYER_NAME } }],
      substitutes: [],
    },
  ];
}

describe("PE-5.3B probe runner", () => {
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
    const fetchCalls: unknown[] = [];
    globalThis.fetch = (async () => {
      fetchCalls.push("fetch");
      throw new Error("network forbidden");
    }) as typeof fetch;
    const fake = emptyTransport();
    try {
      const report = await runPe53bProbe({ transport: fake.transport });
      expect(report.mode).toBe("dry_run");
      expect(report.originRequestsAttempted).toBe(0);
      expect(report.plannedRequestCount).toBe(20);
      expect(report.retriesAttempted).toBe(0);
      expect(report.writesAttempted).toBe(0);
      expect(report.liveResponsesStored).toBe(false);
      expect(report.liveProviderAuthorized).toBe(false);
      expect(report.measurements).toEqual([]);
      expect(fake.calls()).toBe(0);
      expect(fetchCalls).toEqual([]);
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
    });
    expect(report.mode).toBe("rejected");
    expect(report.rejectionReason).toBe("live_provider_not_authorized");
    expect(report.originRequestsAttempted).toBe(0);
    expect(fake.calls()).toBe(0);
  });

  it("does not retry and stops on the first authentication, quota, or 429 response", async () => {
    for (const [status, headers, reason] of [
      [401, {}, "unauthorized"],
      [403, {}, "unauthorized"],
      [429, {}, "rate_limited"],
      [200, { "x-ratelimit-requests-remaining": "0" }, "quota_exhausted"],
    ] as const) {
      const fake = scripted(() => ({
        status,
        headers,
        body: { errors: status === 200 ? ["daily quota upgrade your plan"] : [] },
      }));
      const report = await runPe53bProbe({
        mode: "in_memory",
        inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
        transport: fake.transport,
      });
      expect(report.stopReason).toBe(reason);
      expect(report.originRequestsAttempted).toBe(1);
      expect(report.retriesAttempted).toBe(0);
      expect(fake.calls()).toBe(1);
      expect(report.measurements).toEqual([]);
    }
  });

  it("stops on a thrown transport error without a second attempt", async () => {
    const fake = scripted(() => {
      throw new Error("socket reset");
    });
    const report = await runPe53bProbe({
      mode: "in_memory",
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      transport: fake.transport,
    });
    expect(report.stopReason).toBe("unexpected_provider_behavior");
    expect(fake.calls()).toBe(1);
    expect(report.retriesAttempted).toBe(0);
  });

  it("stops immediately on malformed envelopes, pagination, and fixture mismatch", async () => {
    const cases: Array<{
      body: Record<string, unknown>;
      reason: string;
    }> = [
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
      const fake = scripted((request) =>
        envelope(request, [], candidate.body),
      );
      const report = await runPe53bProbe({
        mode: "in_memory",
        inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
        transport: fake.transport,
      });
      expect(report.stopReason).toBe(candidate.reason);
      expect(fake.calls()).toBe(1);
    }
  });

  it("records empty responses without inferring availability", async () => {
    const fake = emptyTransport();
    const report = await runPe53bProbe({
      mode: "in_memory",
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      transport: fake.transport,
    });
    expect(report.stopped).toBe(false);
    expect(report.originRequestsAttempted).toBe(20);
    expect(fake.calls()).toBe(20);
    expect(report.measurements).toHaveLength(20);
    for (const measurement of report.measurements) {
      expect(measurement).toMatchObject({
        evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN",
        provenance: "current_snapshot",
        captureTimestampVerified: false,
        capturedAtUtc: null,
        observation: "missing",
        responseState: "empty",
        numericValue: null,
        zeroFilled: false,
        absenceMeansAvailable: false,
        targetPrematchEligible: false,
        laterTargetHistoryEligible: false,
        anomalies: ["empty_response"],
      });
    }
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain(PLAYER_NAME);
  });

  it("records missing player ids and continues", async () => {
    const fake = scripted((request) => {
      if (request.path === "/fixtures/lineups") {
        const fixture = PE53B_SELECTED_FIXTURES.find(
          (row) => row.fixtureId === request.query.fixture,
        )!;
        return envelope(request, lineup(fixture.homeTeamId, fixture.awayTeamId, null));
      }
      return envelope(request, [
        {
          player: { id: null, name: PLAYER_NAME },
          team: { id: Number(PE53B_SELECTED_FIXTURES[0]!.homeTeamId) },
          fixture: { id: Number(request.query.fixture), date: "2024-08-16T19:00:00.000Z" },
        },
      ]);
    });
    const report = await runPe53bProbe({
      mode: "in_memory",
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      transport: fake.transport,
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
      capturedAtUtc: null,
      absenceMeansAvailable: false,
      evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN",
    });
    expect(injuryMeasurement?.anomalies).toContain("missing_player_id");
    expect(JSON.stringify(report)).not.toContain(PLAYER_NAME);
    expect(JSON.stringify(report)).not.toContain(String(PLAYER_ID));
  });

  it("records unexpected team identities and continues", async () => {
    const fake = scripted((request) => {
      if (request.path === "/fixtures/lineups") {
        return envelope(request, [
          {
            team: { id: 999001 },
            startXI: [{ player: { id: 15, name: PLAYER_NAME } }],
            substitutes: [],
          },
        ]);
      }
      return envelope(request, []);
    });
    const report = await runPe53bProbe({
      mode: "in_memory",
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      transport: fake.transport,
    });
    expect(report.stopped).toBe(false);
    expect(report.originRequestsAttempted).toBe(20);
    const lineupMeasurement = report.measurements.find(
      (measurement) => measurement.endpoint === "lineups",
    );
    expect(lineupMeasurement?.unexpectedTeamIds).toBe(true);
    expect(lineupMeasurement?.anomalies).toContain("unexpected_team_ids");
    expect(lineupMeasurement?.evidenceClass).toBe("CURRENT_SNAPSHOT_UNPROVEN");
  });

  it("refuses a 21st origin request", async () => {
    const official = buildPe53bPlan();
    const extra: Pe53bPlannedRequest = { ...official[0]!, ordinal: 21 };
    const fake = emptyTransport();
    const report = await executePe53bPlan({
      plan: [...official, extra],
      transport: fake.transport,
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
    });
    expect(fake.calls()).toBe(20);
    expect(report.originRequestsAttempted).toBe(20);
    expect(report.stopReason).toBe("request_cap");
    expect(report.stoppedAtOrdinal).toBeNull();
  });

  it("rejects fixtures outside the allowlist and any 2025 holdout before a call", async () => {
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
    for (const [plan, reason] of [
      [[outside], "fixture_not_allowlisted"],
      [[holdout], "holdout_rejected"],
      [[fallback], "fallback_query_rejected"],
    ] as const) {
      const fake = emptyTransport();
      const report = await executePe53bPlan({
        plan,
        transport: fake.transport,
        inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      });
      expect(report.stopReason).toBe(reason);
      expect(fake.calls()).toBe(0);
      expect(report.originRequestsAttempted).toBe(0);
    }
  });

  it("refuses frozen research paths and does not write them", () => {
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
    const sources = [
      "probe-fixtures.ts",
      "probe-transport.ts",
      "probe-runner.ts",
    ].map((file) => readFileSync(path.join(directory, file), "utf8"));
    for (const source of sources) {
      expect(source).not.toMatch(/writeFile|appendFile|mkdirSync|createApiFootballClient|API_FOOTBALL_KEY|from \"node:fs\"|fetch\(/);
    }
  });
});
