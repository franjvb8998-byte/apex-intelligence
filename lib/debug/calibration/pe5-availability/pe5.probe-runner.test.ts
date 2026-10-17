/**
 * PE-5.3D — offline probe-runner tests.
 * In-memory fixtures only. No provider calls and no artifact writes.
 * The fixture-module mock is a vitest replacement of the data reader.
 * It is not a public runner parameter and it does not authorize a transport.
 * Source regex checks are review aids, not a security boundary.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyPe5Evidence } from "@/lib/debug/calibration/pe5-availability/evidence-class";
import {
  assertPe53bResearchPathUntouched,
  PE53B_FIXTURE_ALLOWLIST,
  PE53B_IN_MEMORY_CONFIRMATION,
  PE53B_LIVE_CONFIRMATION,
  PE53B_LIVE_PROVIDER_AUTHORIZED,
  PE53B_ORIGIN_REQUEST_CAP,
  PE53B_SELECTED_FIXTURES,
} from "@/lib/debug/calibration/pe5-availability/probe-fixtures";
import { pe5Protocol } from "@/lib/debug/calibration/pe5-availability/protocol";
import type {
  Pe53bTransportRequest,
  Pe53bTransportResponse,
} from "@/lib/debug/calibration/pe5-availability/probe-transport";

const SECRET = "TEST_SECRET_KEY_DO_NOT_LOG";
const LEAK_TOKEN = "PE53D_LEAK_TOKEN";
const PLAYER_NAME = "UniquePlayerNameZZZ";
const PLAYER_ID = 987654321;
const DAILY_QUOTA_MESSAGE =
  "You have reached the request limit for the day, Go to https://dashboard.api-football.com to upgrade your plan.";

type ProbeRunner = typeof import("@/lib/debug/calibration/pe5-availability/probe-runner");
type ProbeFixtures = typeof import("@/lib/debug/calibration/pe5-availability/probe-fixtures");
type FixtureInput = { path: string; query: { fixture: string } };
type FixtureImpl = (
  input: FixtureInput,
) => Pe53bTransportResponse | Promise<Pe53bTransportResponse>;

const fixtureControls = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; fixture: string }>,
  impl: null as null | FixtureImpl,
}));

vi.mock("@/lib/debug/calibration/pe5-availability/probe-offline-fixture", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/debug/calibration/pe5-availability/probe-offline-fixture")
  >("@/lib/debug/calibration/pe5-availability/probe-offline-fixture");
  return {
    readPe53bOfflineFixture(input: FixtureInput) {
      const pathName = input.path;
      const fixture = input.query.fixture;
      fixtureControls.calls.push({ path: pathName, fixture });
      if (fixtureControls.impl) return fixtureControls.impl(input);
      return actual.readPe53bOfflineFixture(
        input as import("@/lib/debug/calibration/pe5-availability/probe-transport").Pe53bTransportRequest,
      );
    },
  };
});

afterEach(() => {
  fixtureControls.impl = null;
  fixtureControls.calls = [];
  vi.restoreAllMocks();
});

function envelope(
  request: FixtureInput,
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

async function loadSuite(): Promise<{ runner: ProbeRunner; fixtures: ProbeFixtures }> {
  fixtureControls.impl = null;
  fixtureControls.calls = [];
  vi.resetModules();
  const runner = await import("@/lib/debug/calibration/pe5-availability/probe-runner");
  const fixtures = await import("@/lib/debug/calibration/pe5-availability/probe-fixtures");
  return { runner, fixtures };
}

function runInMemory(
  runner: ProbeRunner,
  extra: Record<string, unknown> = {},
) {
  return runner.runPe53bProbe({
    mode: "in_memory",
    inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
    ...extra,
  });
}

function assertUnproven(report: Awaited<ReturnType<ProbeRunner["runPe53bProbe"]>>): void {
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
  expect(serialized).not.toMatch(/"remaining"\s*:/);
  expect(report.runnerVersion).toBe("pe5.probe_runner.v3");
  expect(report.limitations).toMatchObject({
    historicalEvidence: "CURRENT_SNAPSHOT_UNPROVEN",
    missingObservations: "stay_missing_not_zero_not_available",
    dispatchBudget: "closed_counter_in_one_module_instance_not_process_wide",
    perRunAttempts: "originRequestsAttempted_counts_this_run_only",
    sharedBalance: "not_reported_because_a_process_balance_is_not_verifiable",
    fixtureIdentity: "omitted_provider_echo_is_unverified_and_not_inferred",
  });
  expect(report.sharedBudget).toEqual({ reported: false, scope: "module_instance" });
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

type FixtureRow = ProbeFixtures["PE53B_SELECTED_FIXTURES"][number];

function rememberFixtures(fixtures: ProbeFixtures): FixtureRow[] {
  return fixtures.PE53B_SELECTED_FIXTURES.map((fixture) => ({ ...fixture }));
}

function restoreFixtures(fixtures: ProbeFixtures, saved: readonly FixtureRow[]): void {
  fixtures.PE53B_SELECTED_FIXTURES.forEach((fixture, index) => {
    const prior = saved[index]!;
    const mutable = fixture as {
      fixtureId: string;
      providerSeason: string;
      kickoffUtc: string;
    };
    mutable.fixtureId = prior.fixtureId;
    mutable.providerSeason = prior.providerSeason;
    mutable.kickoffUtc = prior.kickoffUtc;
  });
}

describe("PE-5.3D probe runner", () => {
  it("plans exactly the PE-5.3A allowlist and 20 fixture-scoped requests", async () => {
    const { runner } = await loadSuite();
    const plan = runner.buildPe53bPlan();
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

  it("dry-run performs no fixture read and does not consume the budget", async () => {
    const previous = globalThis.fetch;
    const events: string[] = [];
    globalThis.fetch = (async () => {
      events.push("fetch");
      throw new Error("network forbidden");
    }) as typeof fetch;
    const { runner } = await loadSuite();
    let hostile = 0;
    try {
      const report = await runner.runPe53bProbe({
        transport: {
          async request() {
            hostile += 1;
          },
        },
      } as never);
      expect(report.mode).toBe("dry_run");
      expect(report.originRequestsAttempted).toBe(0);
      expect(report.plannedRequestCount).toBe(20);
      expect(report.measurements).toEqual([]);
      expect(report.limitations.writeAccounting).toBe(
        "runner_local_counter_not_a_storage_audit",
      );
      expect(fixtureControls.calls).toEqual([]);
      expect(hostile).toBe(0);
      expect(events).toEqual([]);
      assertUnproven(report);

      const followed = await runInMemory(runner);
      expect(followed.originRequestsAttempted).toBe(20);
      expect(followed.stopped).toBe(false);
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("rejects live execution even with the confirmation token", async () => {
    const { runner } = await loadSuite();
    const auth = runner.authorizePe53bLiveProvider({
      requestLiveProvider: true,
      liveConfirmation: PE53B_LIVE_CONFIRMATION,
    });
    expect(PE53B_LIVE_PROVIDER_AUTHORIZED).toBe(false);
    expect(pe5Protocol().pe53Authorized).toBe(false);
    expect(auth).toEqual({
      authorized: false,
      reason: "live_provider_not_authorized",
    });
    const report = await runner.runPe53bProbe({
      requestLiveProvider: true,
      liveConfirmation: PE53B_LIVE_CONFIRMATION,
      mode: "in_memory",
      inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
      transport: {
        request() {
          throw new Error(LEAK_TOKEN);
        },
      },
    } as never);
    expect(report.mode).toBe("rejected");
    expect(report.rejectionReason).toBe("live_provider_not_authorized");
    expect(report.originRequestsAttempted).toBe(0);
    expect(fixtureControls.calls).toEqual([]);
    expect(JSON.stringify(report)).not.toContain(LEAK_TOKEN);
  });

  it("does not export a reset, a remaining counter, or a branded executor", async () => {
    const { runner } = await loadSuite();
    expect(Object.keys(runner).sort()).toEqual(
      [
        "PE53B_RUNNER_VERSION",
        "PE53D_REPORT_LIMITATIONS",
        "PE53D_SHARED_BUDGET",
        "authorizePe53bLiveProvider",
        "buildPe53bPlan",
        "runPe53bProbe",
      ].sort(),
    );
    const namespace = runner as Record<string, unknown>;
    expect(namespace.resetPe53cDispatchBudgetForTests).toBeUndefined();
    expect(namespace.pe53cDispatchBudgetRemainingForTests).toBeUndefined();
    expect(namespace.executePe53bBrandedPlan).toBeUndefined();
    expect(namespace.createPe53bBrandedOfflineTransport).toBeUndefined();
    expect(() => {
      const reset = namespace.resetPe53cDispatchBudgetForTests;
      if (typeof reset !== "function") {
        throw new TypeError("reset is not a function");
      }
      reset();
    }).toThrow(TypeError);

    const exhausted = await runInMemory(runner);
    expect(exhausted.originRequestsAttempted).toBe(20);
    const blocked = await runInMemory(runner);
    expect(blocked.stopReason).toBe("request_cap");
    expect(blocked.originRequestsAttempted).toBe(0);
    const dry = await runner.runPe53bProbe();
    expect(dry.mode).toBe("dry_run");
    const stillBlocked = await runInMemory(runner);
    expect(stillBlocked.stopReason).toBe("request_cap");
    expect(stillBlocked.originRequestsAttempted).toBe(0);
    expect(fixtureControls.calls).toHaveLength(20);
  });

  it("ignores global budget slots and forged transport symbols", async () => {
    const { runner } = await loadSuite();
    const slot = Symbol.for("apex.pe53c.offlineProbeDispatchBudget");
    const forged = Symbol("pe53c.offlineFixtureTransport");
    let hostile = 0;
    const accessor = {};
    Object.defineProperty(accessor, "remaining", {
      configurable: true,
      get() {
        return 20;
      },
      set() {
        return;
      },
    });
    Object.defineProperty(globalThis, slot, {
      configurable: true,
      writable: true,
      value: accessor,
    });
    try {
      const symbols = [
        ...Object.getOwnPropertySymbols(runner),
        ...Object.getOwnPropertySymbols(runner.runPe53bProbe),
        forged,
        slot,
      ];
      const transport: Record<PropertyKey, unknown> = {
        kind: "in_memory",
        async request() {
          hostile += 1;
          throw new Error(LEAK_TOKEN);
        },
      };
      for (const symbol of symbols) {
        transport[symbol] = symbol;
      }
      const report = await runner.runPe53bProbe({
        mode: "in_memory",
        inMemoryConfirmation: PE53B_IN_MEMORY_CONFIRMATION,
        transport,
      } as never);
      expect(hostile).toBe(0);
      expect(report.originRequestsAttempted).toBe(20);
      expect(report.measurements).toHaveLength(20);
      const blocked = await runInMemory(runner);
      expect(blocked.stopReason).toBe("request_cap");
      expect(blocked.originRequestsAttempted).toBe(0);
      expect(fixtureControls.calls).toHaveLength(20);
      expect(JSON.stringify(report)).not.toContain(LEAK_TOKEN);
    } finally {
      Reflect.deleteProperty(globalThis, slot);
    }
  });

  it("keeps the captured fixture reader when the export is replaced", async () => {
    const { runner } = await loadSuite();
    const fixtureModule = await import(
      "@/lib/debug/calibration/pe5-availability/probe-offline-fixture"
    );
    const original = fixtureModule.readPe53bOfflineFixture;
    let hostile = 0;
    const replacement = () => {
      hostile += 1;
      throw new Error(LEAK_TOKEN);
    };
    try {
      (
        fixtureModule as { readPe53bOfflineFixture: typeof replacement }
      ).readPe53bOfflineFixture = replacement;
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
    }
    try {
      const report = await runInMemory(runner);
      expect(hostile).toBe(0);
      expect(report.originRequestsAttempted).toBe(20);
      expect(report.stopped).toBe(false);
      expect(JSON.stringify(report)).not.toContain(LEAK_TOKEN);
    } finally {
      try {
        (
          fixtureModule as { readPe53bOfflineFixture: typeof original }
        ).readPe53bOfflineFixture = original;
      } catch {
        // Native module namespaces reject the write. The captured reader stays.
      }
    }
  });

  it("shares one module budget across concurrent and later runs", async () => {
    const firstModule = await loadSuite();
    const secondModule = await import(
      "@/lib/debug/calibration/pe5-availability/probe-runner"
    );
    expect(firstModule.runner.runPe53bProbe).toBe(secondModule.runPe53bProbe);
    const [left, right] = await Promise.all([
      runInMemory(firstModule.runner),
      runInMemory(secondModule),
    ]);
    expect(fixtureControls.calls).toHaveLength(20);
    expect(left.originRequestsAttempted + right.originRequestsAttempted).toBe(20);
    expect(left.originRequestsAttempted).toBeGreaterThan(0);
    expect(right.originRequestsAttempted).toBeGreaterThan(0);
    expect(left.measurements.length).toBe(left.originRequestsAttempted);
    expect(right.measurements.length).toBe(right.originRequestsAttempted);
    expect(left.sharedBudget.reported).toBe(false);
    expect(right.sharedBudget.reported).toBe(false);
    const blocked = await runInMemory(firstModule.runner);
    expect(blocked.originRequestsAttempted).toBe(0);
    expect(blocked.stopReason).toBe("request_cap");
    expect(blocked.stoppedAtOrdinal).toBeNull();
    expect(blocked.measurements).toEqual([]);
    expect(fixtureControls.calls).toHaveLength(20);
  });

  it("starts a new counter when the module is evaluated again", async () => {
    const first = await loadSuite();
    const exhausted = await runInMemory(first.runner);
    expect(exhausted.originRequestsAttempted).toBe(20);
    const second = await loadSuite();
    expect(second.runner.runPe53bProbe).not.toBe(first.runner.runPe53bProbe);
    const again = await runInMemory(second.runner);
    expect(again.originRequestsAttempted).toBe(20);
    expect(again.stopped).toBe(false);
  });

  it("preserves attempts when the fixture reader throws after 1, 2, and several successes", async () => {
    for (const successes of [1, 2, 5]) {
      const { runner } = await loadSuite();
      fixtureControls.impl = (input) => {
        if (fixtureControls.calls.length > successes) {
          throw new Error(`socket reset ${LEAK_TOKEN} ${SECRET}`);
        }
        return envelope(input, []);
      };
      const report = await runInMemory(runner);
      expect(report.stopReason).toBe("unexpected_provider_behavior");
      expect(report.originRequestsAttempted).toBe(successes + 1);
      expect(report.measurements).toHaveLength(successes);
      expect(report.stoppedAtOrdinal).toBe(successes + 1);
      expect(fixtureControls.calls).toHaveLength(successes + 1);
      expect(report.measurements.at(-1)?.ordinal).toBe(successes);
      assertUnproven(report);
    }
  });

  it("stops on the first thrown fixture read without fabricating a measurement", async () => {
    const { runner } = await loadSuite();
    fixtureControls.impl = () => {
      throw new Error(`socket reset ${LEAK_TOKEN}`);
    };
    const report = await runInMemory(runner);
    expect(report.stopReason).toBe("unexpected_provider_behavior");
    expect(report.originRequestsAttempted).toBe(1);
    expect(report.measurements).toEqual([]);
    expect(fixtureControls.calls).toHaveLength(1);
    expect(report.stoppedAtOrdinal).toBe(1);
    expect(JSON.stringify(report)).not.toContain(LEAK_TOKEN);
  });

  it("does not reserve a pre-dispatch rejection and continues on the same budget", async () => {
    const { runner, fixtures } = await loadSuite();
    const saved = rememberFixtures(fixtures);
    try {
      (fixtures.PE53B_SELECTED_FIXTURES[0] as { fixtureId: string }).fixtureId = "999001";
      const rejected = await runInMemory(runner);
      expect(rejected.stopReason).toBe("fixture_not_allowlisted");
      expect(rejected.originRequestsAttempted).toBe(0);
      expect(rejected.stoppedAtOrdinal).toBe(1);
      expect(fixtureControls.calls).toEqual([]);
    } finally {
      restoreFixtures(fixtures, saved);
    }
    const followed = await runInMemory(runner);
    expect(followed.originRequestsAttempted).toBe(20);
    expect(followed.stopped).toBe(false);
  });

  it("rejects a 2025 season or kickoff before dispatch and does not consume budget", async () => {
    const { runner, fixtures } = await loadSuite();
    const saved = rememberFixtures(fixtures);
    try {
      const mutable = fixtures.PE53B_SELECTED_FIXTURES[0] as {
        providerSeason: string;
        kickoffUtc: string;
      };
      mutable.providerSeason = "2025";
      mutable.kickoffUtc = "2025-08-16T19:00:00.000Z";
      const report = await runInMemory(runner);
      expect(report.stopReason).toBe("holdout_rejected");
      expect(report.originRequestsAttempted).toBe(0);
      expect(fixtureControls.calls).toEqual([]);
    } finally {
      restoreFixtures(fixtures, saved);
    }
    const followed = await runInMemory(runner);
    expect(followed.originRequestsAttempted).toBe(20);
  });

  it("stops a later gate without counting it, then hits the shared cap", async () => {
    const { runner, fixtures } = await loadSuite();
    const saved = rememberFixtures(fixtures);
    fixtureControls.impl = (input) => {
      if (fixtureControls.calls.length === 2) {
        (fixtures.PE53B_SELECTED_FIXTURES[1] as { fixtureId: string }).fixtureId =
          "999001";
      }
      return envelope(input, []);
    };
    try {
      const first = await runInMemory(runner);
      expect(first.stopReason).toBe("fixture_not_allowlisted");
      expect(first.originRequestsAttempted).toBe(2);
      expect(first.measurements).toHaveLength(2);
      expect(first.stoppedAtOrdinal).toBe(3);
      expect(fixtureControls.calls).toHaveLength(2);
    } finally {
      restoreFixtures(fixtures, saved);
    }
    fixtureControls.calls = [];
    fixtureControls.impl = (input) => envelope(input, []);
    const second = await runInMemory(runner);
    expect(second.originRequestsAttempted).toBe(18);
    expect(second.measurements).toHaveLength(18);
    expect(second.stopReason).toBe("request_cap");
    expect(second.stoppedAtOrdinal).toBeNull();
    expect(fixtureControls.calls).toHaveLength(18);
    const third = await runInMemory(runner);
    expect(third.originRequestsAttempted).toBe(0);
    expect(third.stopReason).toBe("request_cap");
  });

  it("reserves only two dispatches after an earlier run consumed 18", async () => {
    const { runner, fixtures } = await loadSuite();
    const saved = rememberFixtures(fixtures);
    fixtureControls.impl = (input) => {
      if (fixtureControls.calls.length === 18) {
        for (const fixture of fixtures.PE53B_SELECTED_FIXTURES) {
          (fixture as { providerSeason: string }).providerSeason = "2025";
        }
      }
      return envelope(input, []);
    };
    try {
      const first = await runInMemory(runner);
      expect(first.originRequestsAttempted).toBe(18);
      expect(first.measurements).toHaveLength(17);
      expect(first.stopReason).toBe("holdout_rejected");
      expect(first.stoppedAtOrdinal).toBe(18);
    } finally {
      restoreFixtures(fixtures, saved);
    }
    fixtureControls.calls = [];
    fixtureControls.impl = (input) => envelope(input, []);
    const second = await runInMemory(runner);
    expect(second.originRequestsAttempted).toBe(2);
    expect(second.measurements).toHaveLength(2);
    expect(second.stopReason).toBe("request_cap");
    expect(second.stoppedAtOrdinal).toBeNull();
    expect(fixtureControls.calls).toHaveLength(2);
    expect(second.sharedBudget).toEqual({ reported: false, scope: "module_instance" });
    expect(JSON.stringify(second)).not.toMatch(/"remaining"\s*:/);
    const third = await runInMemory(runner);
    expect(third.originRequestsAttempted).toBe(0);
    expect(third.measurements).toEqual([]);
    expect(fixtureControls.calls).toHaveLength(2);
  });

  it("does not retry and stops on authentication, quota, or 429", async () => {
    const cases = [
      [401, {}, "unauthorized"],
      [403, {}, "unauthorized"],
      [429, {}, "rate_limited"],
      [200, { "x-ratelimit-requests-remaining": "0" }, "quota_exhausted"],
    ] as const;
    for (const [status, headers, reason] of cases) {
      const { runner } = await loadSuite();
      fixtureControls.impl = () => ({
        status,
        headers,
        body: {
          errors: status === 200 ? [DAILY_QUOTA_MESSAGE] : [],
          response: [],
          paging: { current: 1, total: 1 },
          results: 0,
        },
      });
      const report = await runInMemory(runner);
      expect(report.stopReason).toBe(reason);
      expect(report.originRequestsAttempted).toBe(1);
      expect(report.retriesAttempted).toBe(0);
      expect(report.measurements).toEqual([]);
      expect(fixtureControls.calls).toHaveLength(1);
    }
  });

  it("treats numeric 0, string 0, and zero-padded strings as daily exhaustion", async () => {
    for (const value of [0, "0", "00", "000", " 00 "]) {
      const { runner } = await loadSuite();
      fixtureControls.impl = (input) => ({
        ...envelope(input, []),
        headers: { "x-ratelimit-requests-remaining": value },
      });
      const report = await runInMemory(runner);
      expect(report.stopReason).toBe("quota_exhausted");
      expect(report.measurements).toEqual([]);
      expect(fixtureControls.calls).toHaveLength(1);
    }
  });

  it("fails closed on malformed quota headers and ignores unrelated ones", async () => {
    for (const value of ["0.0", "01", "-1", "nope", "", "0e0", true, null, {}, []]) {
      const { runner } = await loadSuite();
      fixtureControls.impl = () =>
        ({
          status: 200,
          headers: { "X-RateLimit-Requests-Remaining": value },
          body: {
            errors: [],
            results: 0,
            paging: { current: 1, total: 1 },
            response: [],
          },
        }) as unknown as Pe53bTransportResponse;
      const report = await runInMemory(runner);
      expect(report.stopReason).toBe("malformed_response");
      expect(report.stopReason).not.toBe("quota_exhausted");
      expect(fixtureControls.calls).toHaveLength(1);
    }

    const { runner } = await loadSuite();
    fixtureControls.impl = (input) => ({
      ...envelope(input, []),
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-requests-remaining-today": "0",
      },
    });
    const unrelated = await runInMemory(runner);
    expect(unrelated.stopped).toBe(false);
    expect(unrelated.originRequestsAttempted).toBe(20);
    expect(unrelated.stopReason).not.toBe("quota_exhausted");
  });

  it("recognizes quota phrases and ignores unrelated quota words", async () => {
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
      const { runner } = await loadSuite();
      fixtureControls.impl = () => ({ status: 200, headers: {}, body });
      const report = await runInMemory(runner);
      expect(report.stopReason).toBe("quota_exhausted");
      expect(fixtureControls.calls).toHaveLength(1);
    }

    const { runner } = await loadSuite();
    fixtureControls.impl = (input) =>
      envelope(input, [], {
        message: "No fixtures for the day",
        note: "squad quota remains a coverage topic",
      });
    const note = await runInMemory(runner);
    expect(note.stopped).toBe(false);
    expect(note.measurements).toHaveLength(20);
    expect(note.measurements[0]?.observation).toBe("missing");

    for (const errors of [
      ["squad quota remains a coverage topic"],
      ["daily training"],
      ["upgrade your plan"],
    ]) {
      const suite = await loadSuite();
      fixtureControls.impl = (input) => envelope(input, [], { errors });
      const report = await runInMemory(suite.runner);
      expect(report.stopReason).toBe("malformed_response");
      expect(report.stopReason).not.toBe("quota_exhausted");
      expect(fixtureControls.calls).toHaveLength(1);
    }
  });

  it("rejects malformed pagination, including inherited fields, getters, and proxies", async () => {
    let getterReads = 0;
    const accessorPaging: Record<string, unknown> = {};
    Object.defineProperty(accessorPaging, "current", {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error(LEAK_TOKEN);
      },
    });
    Object.defineProperty(accessorPaging, "total", {
      enumerable: true,
      value: 1,
    });
    const inherited = Object.create({ current: 1, total: 1 }) as {
      current?: number;
      total?: number;
    };
    const proxyPaging = new Proxy(
      { current: 1, total: 1 },
      {
        get() {
          throw new Error(LEAK_TOKEN);
        },
      },
    );
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
      { paging: { total: 1 }, reason: "malformed_response" },
      { paging: inherited, reason: "malformed_response" },
      { paging: accessorPaging, reason: "malformed_response" },
      { paging: proxyPaging, reason: "malformed_response" },
      { paging: { current: 2, total: 1 }, reason: "unexpected_pagination" },
      { paging: { current: 1, total: 2 }, reason: "unexpected_pagination" },
      { paging: { current: 2, total: 4 }, reason: "unexpected_pagination" },
    ];
    const previous = globalThis.fetch;
    const fetched: string[] = [];
    globalThis.fetch = (async () => {
      fetched.push("fetch");
      throw new Error("network forbidden");
    }) as typeof fetch;
    try {
      for (const candidate of cases) {
        const { runner } = await loadSuite();
        fixtureControls.impl = (input) =>
          envelope(input, [], {
            paging: candidate.paging,
            next: "https://pe53d-paging-follow.test/page-2",
          });
        const report = await runInMemory(runner);
        expect(report.stopReason).toBe(candidate.reason);
        expect(report.measurements).toEqual([]);
        expect(fixtureControls.calls).toHaveLength(1);
        expect(JSON.stringify(report)).not.toContain("pe53d-paging-follow.test");
        expect(JSON.stringify(report)).not.toContain(LEAK_TOKEN);
      }
      expect(getterReads).toBe(0);
      expect(fetched).toEqual([]);
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("stops on 500, 502, and 503 without chasing another page", async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network forbidden");
    }) as typeof fetch;
    try {
      for (const status of [500, 502, 503]) {
        const { runner } = await loadSuite();
        fixtureControls.impl = () => ({
          status,
          headers: { "x-ratelimit-requests-remaining": 0 },
          body: {
            message: DAILY_QUOTA_MESSAGE,
            errors: [],
            results: 0,
            paging: { current: 1, total: 2, next: "https://pe53d-paging-follow.test/500" },
            response: [],
          },
        });
        const report = await runInMemory(runner);
        expect(report.stopReason).toBe("unexpected_provider_behavior");
        expect(report.measurements).toEqual([]);
        expect(report.originRequestsAttempted).toBe(1);
        expect(fixtureControls.calls).toHaveLength(1);
        expect(JSON.stringify(report)).not.toContain("pe53d-paging-follow.test");
      }
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("rejects invalid HTTP statuses without treating them as auth or server errors", async () => {
    for (const status of ["401", "429", "500", "502", "503", "200", 200.5, Number.NaN, true, null]) {
      const { runner } = await loadSuite();
      fixtureControls.impl = () =>
        ({
          status,
          headers: { "x-ratelimit-requests-remaining": "0" },
          body: {
            errors: [],
            results: 0,
            paging: { current: 1, total: 1 },
            response: [],
          },
        }) as Pe53bTransportResponse;
      const report = await runInMemory(runner);
      expect(report.stopReason).toBe("malformed_response");
      expect(report.measurements).toEqual([]);
      expect(fixtureControls.calls).toHaveLength(1);
    }
  });

  it("contains throwing response getters and preserves earlier measurements", async () => {
    const { runner } = await loadSuite();
    fixtureControls.impl = (input) => {
      if (fixtureControls.calls.length < 3) return envelope(input, []);
      return {
        get status(): number {
          throw new Error(`${LEAK_TOKEN} ${SECRET}`);
        },
        get body(): unknown {
          return { apiKey: SECRET, player: PLAYER_NAME };
        },
      } as Pe53bTransportResponse;
    };
    const report = await runInMemory(runner);
    expect(report.stopReason).toBe("unexpected_provider_behavior");
    expect(report.originRequestsAttempted).toBe(3);
    expect(report.measurements).toHaveLength(2);
    expect(report.stoppedAtOrdinal).toBe(3);
    expect(fixtureControls.calls).toHaveLength(3);
    assertUnproven(report);

    const pagingSuite = await loadSuite();
    fixtureControls.impl = () => ({
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
    });
    const pagingThrow = await runInMemory(pagingSuite.runner);
    expect(pagingThrow.stopReason).toBe("malformed_response");
    expect(pagingThrow.measurements).toEqual([]);
    expect(pagingThrow.originRequestsAttempted).toBe(1);
    expect(fixtureControls.calls).toHaveLength(1);
    expect(JSON.stringify(pagingThrow)).not.toContain(LEAK_TOKEN);
  });

  it("records empty responses as missing and does not promote them", async () => {
    const { runner } = await loadSuite();
    const report = await runInMemory(runner);
    expect(report.stopped).toBe(false);
    expect(report.originRequestsAttempted).toBe(20);
    expect(fixtureControls.calls).toHaveLength(20);
    expect(report.measurements).toHaveLength(20);
    for (const measurement of report.measurements) {
      expect(measurement).toMatchObject({
        observation: "missing",
        responseState: "empty",
        anomalies: ["empty_response"],
        evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN",
        numericValue: null,
      });
    }
    assertUnproven(report);
    expect(report.limitations.emptyObservationProbe).toContain(
      "classifier_receives_present",
    );

    const fixture = PE53B_SELECTED_FIXTURES[0]!;
    const missingDecision = classifyPe5Evidence({
      evidenceId: `pe53b-${fixture.fixtureId}-lineups`,
      kind: "confirmed_starting_xi",
      provenance: "current_snapshot",
      sourceFixtureId: fixture.fixtureId,
      sourceKickoffUtc: fixture.kickoffUtc,
      sourceProviderSeasonId: fixture.providerSeason,
      capturedAtUtc: null,
      captureTimestampVerified: false,
      observation: "missing",
      observedValue: null,
      targetFixtureId: fixture.fixtureId,
      targetKickoffUtc: fixture.kickoffUtc,
      targetProviderSeasonId: fixture.providerSeason,
    });
    expect(missingDecision.evidenceClass).toBe("UNSUPPORTED_OR_UNAVAILABLE");
    expect(missingDecision.reason).toBe("missing_observation");
    expect(missingDecision.ok).toBe(false);
    expect(missingDecision.targetPrematchEligible).toBe(false);
  });

  it("records missing player ids and unexpected team ids without promoting them", async () => {
    const { runner, fixtures } = await loadSuite();
    fixtureControls.impl = (input) => {
      const fixture = fixtures.PE53B_SELECTED_FIXTURES.find(
        (row) => row.fixtureId === input.query.fixture,
      )!;
      if (input.path === "/fixtures/lineups") {
        return envelope(input, lineup(fixture.homeTeamId, fixture.awayTeamId, null));
      }
      return envelope(input, [
        {
          player: { id: null, name: PLAYER_NAME },
          team: { id: 999001 },
          fixture: { id: Number(input.query.fixture) },
        },
      ]);
    };
    const report = await runInMemory(runner);
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
  });

  it("does not infer a missing fixture echo and stops on an unexpected one", async () => {
    const { runner } = await loadSuite();
    fixtureControls.impl = (input) =>
      envelope(input, [], {
        parameters: {},
      });
    const omitted = await runInMemory(runner);
    expect(omitted.stopped).toBe(false);
    expect(omitted.stopReason).toBeNull();
    expect(omitted.measurements).toHaveLength(20);
    expect(omitted.measurements[0]?.fixtureId).toBe(PE53B_FIXTURE_ALLOWLIST[0]);
    expect(omitted.limitations.fixtureIdentity).toBe(
      "omitted_provider_echo_is_unverified_and_not_inferred",
    );

    const mismatch = await loadSuite();
    fixtureControls.impl = (input) =>
      envelope(input, [], { parameters: { fixture: "999001" } });
    const wrong = await runInMemory(mismatch.runner);
    expect(wrong.stopReason).toBe("fixture_id_mismatch");
    expect(wrong.measurements).toEqual([]);
    expect(wrong.originRequestsAttempted).toBe(1);

    const rowMismatch = await loadSuite();
    fixtureControls.impl = (input) =>
      envelope(input, [
        {
          player: { id: 15 },
          team: { id: 44 },
          fixture: { id: "999001" },
        },
      ]);
    const row = await runInMemory(rowMismatch.runner);
    expect(row.stopReason).toBe("fixture_id_mismatch");
    expect(row.measurements).toEqual([]);

    const inherited = await loadSuite();
    fixtureControls.impl = (input) => {
      const parameters = Object.create({ fixture: "999001" }) as { fixture?: string };
      return envelope(input, [], { parameters });
    };
    const inheritedReport = await runInMemory(inherited.runner);
    expect(inheritedReport.stopReason).toBe("malformed_response");
    expect(inheritedReport.measurements).toEqual([]);

    let idReads = 0;
    const accessor = await loadSuite();
    fixtureControls.impl = (input) => {
      const fixture = {};
      Object.defineProperty(fixture, "id", {
        enumerable: true,
        get() {
          idReads += 1;
          return input.query.fixture;
        },
      });
      return envelope(input, [{ player: { id: 15 }, team: { id: 1 }, fixture }]);
    };
    const accessorReport = await runInMemory(accessor.runner);
    expect(accessorReport.stopReason).toBe("malformed_response");
    expect(idReads).toBe(0);
    expect(JSON.stringify(accessorReport)).not.toContain(LEAK_TOKEN);
  });

  it("keeps snapshotted fixture order when the dispatched query is mutated", async () => {
    const { runner } = await loadSuite();
    const callerPlan = runner.buildPe53bPlan();
    callerPlan[1]!.fixtureId = "999001";
    callerPlan[1]!.providerSeason = "2025";
    callerPlan[1]!.query = { fixture: "999001", page: "2" } as typeof callerPlan[1]["query"];
    fixtureControls.impl = (input) => {
      const seen = fixtureControls.calls.at(-1)!;
      (input.query as { fixture: string; season?: string }).fixture = "1";
      (input.query as { season?: string }).season = "2025";
      return envelope(
        { path: seen.path as Pe53bTransportRequest["path"], query: { fixture: seen.fixture } },
        [],
      );
    };
    const report = await runInMemory(runner);
    expect(report.stopped).toBe(false);
    expect(report.originRequestsAttempted).toBe(20);
    expect(fixtureControls.calls.map((call) => call.fixture)).toEqual(
      PE53B_FIXTURE_ALLOWLIST.flatMap((id) => [id, id]),
    );
    expect(fixtureControls.calls.map((call) => call.path)).toEqual(
      PE53B_SELECTED_FIXTURES.flatMap(() => ["/fixtures/lineups", "/injuries"]),
    );
  });

  it("stops when the live fixture season is mutated to 2025 during a read", async () => {
    const { runner, fixtures } = await loadSuite();
    const saved = rememberFixtures(fixtures);
    fixtureControls.impl = (input) => {
      (fixtures.PE53B_SELECTED_FIXTURES[0] as { providerSeason: string }).providerSeason =
        "2025";
      return envelope(input, []);
    };
    try {
      const report = await runInMemory(runner);
      expect(fixtureControls.calls).toHaveLength(1);
      expect(report.originRequestsAttempted).toBe(1);
      expect(report.measurements).toEqual([]);
      expect(report.stopReason).toBe("holdout_rejected");
      expect(report.stoppedAtOrdinal).toBe(1);
    } finally {
      restoreFixtures(fixtures, saved);
    }
  });

  it("returns a sanitized report when the input itself throws", async () => {
    const { runner } = await loadSuite();
    const input = new Proxy(
      {},
      {
        get() {
          throw new Error(`${LEAK_TOKEN} ${SECRET}`);
        },
      },
    );
    const report = await runner.runPe53bProbe(input as never);
    expect(report.mode).toBe("rejected");
    expect(report.stopReason).toBe("unexpected_provider_behavior");
    expect(report.originRequestsAttempted).toBe(0);
    expect(report.measurements).toEqual([]);
    expect(fixtureControls.calls).toEqual([]);
    expect(JSON.stringify(report)).not.toContain(LEAK_TOKEN);
    expect(JSON.stringify(report)).not.toContain(SECRET);
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
    expect(() => readFileSync(path.join(directory, "probe-test-boundary.ts"), "utf8")).toThrow();
    expect(() =>
      readFileSync(path.join(directory, "probe-offline-capability.ts"), "utf8"),
    ).toThrow();
    const files = [
      "probe-fixtures.ts",
      "probe-transport.ts",
      "probe-runner.ts",
      "probe-offline-fixture.ts",
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
      /Symbol\.for/,
      /globalThis/,
      /executePe53bBrandedPlan/,
      /createPe53bBrandedOfflineTransport/,
      /resetPe53cDispatchBudgetForTests/,
    ];
    for (const source of sources) {
      for (const pattern of forbidden) {
        expect(source).not.toMatch(pattern);
      }
    }
    const runnerSource = sources[2]!;
    const fixtureSource = sources[3]!;
    expect(runnerSource).toContain("const offlineFixtureReader = loadOfflineFixture");
    expect(runnerSource.match(/offlineFixtureReader\(/g)).toEqual(["offlineFixtureReader("]);
    expect(runnerSource).not.toContain("input.transport");
    expect(runnerSource).not.toMatch(/\.remaining\b/);
    expect(runnerSource).toContain('observation: "present"');
    expect(fixtureSource).not.toContain("Symbol(");
    expect(fixtureSource).not.toMatch(/request\s*:\s*\(/);
    const publicEntry = runnerSource.slice(
      runnerSource.indexOf("export async function runPe53bProbe"),
      runnerSource.indexOf("async function executeOfficialPlan"),
    );
    expect(publicEntry).not.toContain("input.transport");
    expect(publicEntry).not.toMatch(/\.request\s*\(/);
    expect(publicEntry).toContain("executeOfficialPlan(plan)");
  });
});
