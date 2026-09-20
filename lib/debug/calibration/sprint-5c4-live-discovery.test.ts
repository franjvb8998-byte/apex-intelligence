/**
 * Sprint 5C.4 — first controlled live discovery.
 * Offline synthetic vendor envelopes only. Zero live origin calls until this file passes.
 * Discovery never captures predictions.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_MANIFEST_FINGERPRINT,
  DISCOVERY_ALLOWED_PATH,
  DISCOVERY_CALL_BUDGET,
  DISCOVERY_DATA_DIR,
  DISCOVERY_FIXTURE_QUERY,
  DISCOVERY_FORBIDDEN_PATHS,
  DISCOVERY_PROVIDER,
  DiscoveryBudgetError,
  DiscoveryIntegrityError,
  FIRST_LIVE_PHASE,
  HistoricalFirewallError,
  LIVE_CAPTURE_WINDOW,
  LIVE_PROTOCOL_CONFIG,
  LIVE_PROTOCOL_FINGERPRINT,
  PROSPECTIVE_SEASON_UNVERIFIED,
  SEASON_VERIFICATION_METHOD,
  assertAllowedDiscoveryRequest,
  assertDiscoveryBudget,
  assertOddsUnavailable,
  assertSafeProjectedObject,
  captureOpportunitiesFrom,
  classifyProjectedFixtures,
  createFixedClock,
  discoverLiveFixtures,
  emptyDiscoveryAccounting,
  noteFixtureDiscoveryCall,
  persistDiscoveryArtifact,
  projectSafeFixture,
  projectSafeFixtures,
  verifySeasonFromProjected,
} from "@/lib/debug/calibration";
import type { DiscoveryTransport } from "@/lib/debug/calibration/prospective/live/discovery-types";

const FROZEN_CANDIDATE_FINGERPRINT = "7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c";
const FROZEN_PROTOCOL_FINGERPRINT = "825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9";
const FROZEN_CANDIDATE_FILES = [
  "lib/debug/calibration/prospective/candidate-config.ts",
  "lib/debug/calibration/prospective/candidate-input.ts",
  "lib/debug/calibration/prospective/candidate-transform.ts",
  "lib/debug/calibration/prospective/candidate-high-equal.ts",
  "lib/debug/calibration/prospective/candidate-engine.ts",
];
const PRODUCTION_PATHS = [
  "lib/intelligence/modules/probability",
  "lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts",
  "lib/intelligence/modules/probability/hybrid/config.ts",
];
const PROTOCOL_FILES = [
  "lib/debug/calibration/prospective/protocol/protocol-types.ts",
  "lib/debug/calibration/prospective/protocol/protocol-config.ts",
  "lib/debug/calibration/prospective/protocol/protocol-fingerprint.ts",
  "lib/debug/calibration/prospective/protocol/protocol-utc.ts",
  "lib/debug/calibration/prospective/protocol/protocol-status.ts",
  "lib/debug/calibration/prospective/protocol/protocol-planner.ts",
  "lib/debug/calibration/prospective/protocol/protocol-evidence.ts",
  "lib/debug/calibration/prospective/protocol/protocol-sample.ts",
  "lib/debug/calibration/prospective/protocol/protocol-discovery.ts",
];

const KICKOFF = "2099-08-17T15:00:00.000Z";
const RAW_MARKER = "RAW_PAYLOAD_MUST_NOT_PERSIST";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "apex-5c4-"));
  tempRoots.push(root);
  return root;
}

function atMinutesBefore(minutes: number): string {
  return new Date(Date.parse(KICKOFF) - minutes * 60_000).toISOString();
}

function vendorItem(partial?: {
  id?: number;
  season?: number;
  leagueId?: number;
  statusShort?: string;
  statusLong?: string;
  date?: string;
  home?: string;
  away?: string;
}): Record<string, unknown> {
  return {
    fixture: {
      id: partial?.id ?? 9001,
      referee: RAW_MARKER,
      date: partial?.date ?? KICKOFF,
      status: {
        short: partial?.statusShort ?? "NS",
        long: partial?.statusLong ?? "Not Started",
        elapsed: null,
      },
    },
    league: {
      id: partial?.leagueId ?? 39,
      name: "Premier League",
      season: partial?.season ?? 2026,
      round: "Regular Season - 5",
    },
    teams: {
      home: { id: 33, name: partial?.home ?? "Synthetic Home", winner: true },
      away: { id: 34, name: partial?.away ?? "Synthetic Away", winner: false },
    },
    goals: { home: 3, away: 1 },
    score: {
      halftime: { home: 2, away: 0 },
      fulltime: { home: 3, away: 1 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
    events: [{ type: "Goal", detail: "Normal Goal" }],
    statistics: [{ type: "Shots", value: 12 }],
    lineups: [{ team: { id: 33, name: "Synthetic Home" } }],
  };
}

function vendorEnvelope(items: Record<string, unknown>[], paging?: { current: number; total: number }) {
  return {
    get: "fixtures",
    parameters: { league: "39", next: "20", secret: RAW_MARKER },
    errors: [],
    results: items.length,
    paging: paging ?? { current: 1, total: 1 },
    response: items,
  };
}

function readLiveSources(): string {
  const dir = "lib/debug/calibration/prospective/live";
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

function mockTransport(
  payload: unknown,
  calls: { count: number },
): DiscoveryTransport {
  return {
    async getFixtures() {
      calls.count += 1;
      if (calls.count > 1) {
        throw new Error("pagination loop or repeated probing is forbidden");
      }
      return payload;
    },
  };
}

describe("Sprint 5C.4 — first controlled live discovery", () => {
  it("keeps frozen fingerprints, protocol values, and production/candidate files unchanged", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(FROZEN_CANDIDATE_FINGERPRINT);
    expect(LIVE_PROTOCOL_FINGERPRINT).toBe(FROZEN_PROTOCOL_FINGERPRINT);
    expect(LIVE_PROTOCOL_CONFIG.prospectiveSeason).toBe(PROSPECTIVE_SEASON_UNVERIFIED);
    expect(LIVE_PROTOCOL_CONFIG.competitionId).toBe("39");
    expect(FIRST_LIVE_PHASE).toBe("DISCOVERY_ONLY");
    expect(LIVE_CAPTURE_WINDOW.earliestCaptureMinutesBeforeKickoff).toBe(75);
    expect(LIVE_CAPTURE_WINDOW.latestCaptureMinutesBeforeKickoff).toBe(45);
    expect(DISCOVERY_PROVIDER).toBe("api-football");
    expect(DISCOVERY_FIXTURE_QUERY).toEqual({ league: "39", next: 20 });
    expect(DISCOVERY_ALLOWED_PATH).toBe("/fixtures");
    expect(SEASON_VERIFICATION_METHOD).toMatch(/league\.season/);
    expect(readFileSync(".gitignore", "utf8")).toContain("/data/prospective/");
    expect(DISCOVERY_DATA_DIR).toBe("data/prospective/discovery");
    const candidateDiff = execSync(
      `git diff --name-only HEAD -- ${FROZEN_CANDIDATE_FILES.join(" ")}`,
      { encoding: "utf8" },
    ).trim();
    expect(candidateDiff).toBe("");
    const productionDiff = execSync(
      `git diff --name-only HEAD -- ${PRODUCTION_PATHS.join(" ")}`,
      { encoding: "utf8" },
    ).trim();
    expect(productionDiff).toBe("");
    const protocolDiff = execSync(
      `git diff --name-only HEAD -- ${PROTOCOL_FILES.join(" ")}`,
      { encoding: "utf8" },
    ).trim();
    expect(protocolDiff).toBe("");
  });

  it("strips outcome fields so no score fields survive projection", () => {
    const projected = projectSafeFixture(vendorItem());
    expect(projected).toEqual({
      fixtureId: "9001",
      competitionId: "39",
      season: "2026",
      kickoffUtc: KICKOFF,
      statusShort: "NS",
      statusLong: "Not Started",
      homeTeamId: "33",
      homeTeamName: "Synthetic Home",
      awayTeamId: "34",
      awayTeamName: "Synthetic Away",
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toMatch(/goals|score|winner|halftime|fulltime|extratime|penalt|events|statistics|lineups|RAW_PAYLOAD/i);
    assertSafeProjectedObject(projected);
    const batch = projectSafeFixtures(vendorEnvelope([vendorItem(), vendorItem({ id: 9002 })]));
    expect(batch.fixtures).toHaveLength(2);
    assertSafeProjectedObject(batch.fixtures);
    expect(JSON.stringify(batch.fixtures)).not.toMatch(/goals|score|winner|RAW_PAYLOAD/i);
  });

  it("cannot invoke the candidate runner, capture runner, or odds family", () => {
    const source = readLiveSources();
    expect(source).not.toMatch(/predictCandidate|captureProspectiveBatch|persistPendingBatch|scorePredictionRecord|getFixtureOdds/);
    expect(DISCOVERY_FORBIDDEN_PATHS).toContain("/odds");
    expect(() => assertAllowedDiscoveryRequest("/odds", { fixture: "1" })).toThrow(DiscoveryIntegrityError);
    expect(() => assertAllowedDiscoveryRequest("/fixtures/events", { league: "39" })).toThrow(DiscoveryIntegrityError);
    expect(() => assertAllowedDiscoveryRequest("/leagues", { id: "39" })).toThrow(DiscoveryIntegrityError);
    expect(() => assertAllowedDiscoveryRequest("/fixtures", { league: "39", page: 2 })).toThrow(/page/);
    expect(() =>
      assertOddsUnavailable({
        getFixtures: async () => ({}),
        getFixtureOdds: async () => ({}),
      } as DiscoveryTransport & { getFixtureOdds: () => Promise<unknown> }),
    ).toThrow(/odds endpoint must be unavailable/);
    expect(() => assertOddsUnavailable({ getFixtures: async () => ({}) })).not.toThrow();
  });

  it("rejects USED historical seasons and does not guess a season", () => {
    expect(() => verifySeasonFromProjected(projectSafeFixtures(vendorEnvelope([vendorItem({ season: 2023 })])).fixtures)).toThrow(
      HistoricalFirewallError,
    );
    expect(() => verifySeasonFromProjected(projectSafeFixtures(vendorEnvelope([vendorItem({ season: 2024 })])).fixtures)).toThrow(
      HistoricalFirewallError,
    );
    expect(() => verifySeasonFromProjected(projectSafeFixtures(vendorEnvelope([vendorItem({ season: 2025 })])).fixtures)).toThrow(
      HistoricalFirewallError,
    );
    expect(() =>
      verifySeasonFromProjected(
        projectSafeFixtures(vendorEnvelope([vendorItem({ season: 2026 }), vendorItem({ id: 9002, season: 2027 })])).fixtures,
      ),
    ).toThrow(/multiple seasons/);
    expect(() => verifySeasonFromProjected([])).toThrow(/no rows/);
    expect(() => assertAllowedDiscoveryRequest("/fixtures", { league: "39", season: "2025" })).toThrow(
      HistoricalFirewallError,
    );
  });

  it("caps the discovery budget at 2 total calls and never paginates", async () => {
    expect(DISCOVERY_CALL_BUDGET.maxTotalCalls).toBe(2);
    expect(DISCOVERY_CALL_BUDGET.maxOddsCalls).toBe(0);
    expect(DISCOVERY_CALL_BUDGET.maxEvidenceCalls).toBe(0);
    expect(DISCOVERY_CALL_BUDGET.maxPagingLoops).toBe(0);
    const once = noteFixtureDiscoveryCall(emptyDiscoveryAccounting());
    expect(once).toEqual({
      fixtureDiscoveryCalls: 1,
      seasonDiscoveryCalls: 0,
      oddsCalls: 0,
      evidenceCalls: 0,
      totalCalls: 1,
    });
    expect(() => noteFixtureDiscoveryCall(once)).toThrow(DiscoveryBudgetError);
    expect(() =>
      assertDiscoveryBudget({
        fixtureDiscoveryCalls: 0,
        seasonDiscoveryCalls: 0,
        oddsCalls: 1,
        evidenceCalls: 0,
        totalCalls: 1,
      }),
    ).toThrow(/odds/);
    expect(() =>
      assertDiscoveryBudget({
        fixtureDiscoveryCalls: 1,
        seasonDiscoveryCalls: 1,
        oddsCalls: 0,
        evidenceCalls: 0,
        totalCalls: 3,
      }),
    ).toThrow(/exceed max 2/);

    const calls = { count: 0 };
    const result = await discoverLiveFixtures({
      transport: mockTransport(vendorEnvelope([vendorItem()], { current: 1, total: 3 }), calls),
      clock: createFixedClock(atMinutesBefore(80)),
      persist: false,
    });
    expect(calls.count).toBe(1);
    expect(result.callAccounting.totalCalls).toBe(1);
    expect(result.callAccounting.oddsCalls).toBe(0);
    expect(result.callAccounting.evidenceCalls).toBe(0);
    expect(result.paginationLoopAttempted).toBe(false);
    expect(result.pagingObserved).toEqual({ current: 1, total: 3 });
  });

  it("classifies UTC windows with frozen T-75/T-45 and alerts on IN_WINDOW without capturing", async () => {
    const fixtures = projectSafeFixtures(vendorEnvelope([vendorItem({ statusShort: "NS" })])).fixtures;
    expect(classifyProjectedFixtures(fixtures, createFixedClock(atMinutesBefore(80)), "2026")[0]?.classification).toBe(
      "TOO_EARLY",
    );
    expect(classifyProjectedFixtures(fixtures, createFixedClock(atMinutesBefore(75)), "2026")[0]?.classification).toBe(
      "IN_WINDOW",
    );
    expect(classifyProjectedFixtures(fixtures, createFixedClock(atMinutesBefore(60)), "2026")[0]?.classification).toBe(
      "IN_WINDOW",
    );
    expect(classifyProjectedFixtures(fixtures, createFixedClock(atMinutesBefore(45)), "2026")[0]?.classification).toBe(
      "IN_WINDOW",
    );
    expect(classifyProjectedFixtures(fixtures, createFixedClock(atMinutesBefore(44)), "2026")[0]?.classification).toBe(
      "MISSED_WINDOW",
    );
    const liveStatus = projectSafeFixtures(vendorEnvelope([vendorItem({ statusShort: "LIVE" })])).fixtures;
    expect(classifyProjectedFixtures(liveStatus, createFixedClock(atMinutesBefore(60)), "2026")[0]?.classification).toBe(
      "INELIGIBLE_STATUS",
    );

    const persistRoot = tempRoot();
    const pending = join(persistRoot, "pending");
    const scored = join(persistRoot, "scored");
    mkdirSync(pending, { recursive: true });
    mkdirSync(scored, { recursive: true });
    const calls = { count: 0 };
    const result = await discoverLiveFixtures({
      transport: mockTransport(vendorEnvelope([vendorItem({ statusShort: "NS" })]), calls),
      clock: createFixedClock(atMinutesBefore(60)),
      persist: true,
      persistRoot,
    });
    expect(result.liveCaptureOpportunityDetected).toBe(true);
    expect(result.captureOpportunities).toHaveLength(1);
    expect(result.captureOpportunities[0]?.fixtureId).toBe("9001");
    expect(result.predictionsCaptured).toBe(0);
    expect(result.createdPredictions).toBe(false);
    expect(result.phase).toBe("DISCOVERY_ONLY");
    expect(LIVE_PROTOCOL_CONFIG.prospectiveSeason).toBe(PROSPECTIVE_SEASON_UNVERIFIED);
    expect(captureOpportunitiesFrom(result.classifications)).toHaveLength(1);
    expect(readdirSync(pending)).toEqual([]);
    expect(readdirSync(scored)).toEqual([]);
    expect(result.artifactPath).toBeTruthy();
    expect(result.artifactPath).not.toMatch(/pending|scored/);
  });

  it("persists only the safe artifact with no credentials and no raw payload", async () => {
    const persistRoot = tempRoot();
    const calls = { count: 0 };
    const result = await discoverLiveFixtures({
      transport: mockTransport(
        vendorEnvelope([
          vendorItem({
            id: 9001,
            statusShort: "NS",
            home: "Arsenal",
            away: "Chelsea",
          }),
        ]),
        calls,
      ),
      clock: createFixedClock(atMinutesBefore(4000)),
      persist: true,
      persistRoot,
    });
    expect(result.rawResponsePersisted).toBe(false);
    expect(result.scoresPersisted).toBe(false);
    expect(result.artifactPath && existsSync(result.artifactPath)).toBe(true);
    const body = readFileSync(result.artifactPath!, "utf8");
    expect(body).not.toMatch(/RAW_PAYLOAD_MUST_NOT_PERSIST/);
    expect(body).not.toMatch(/api[_-]?key|x-apisports-key|authorization/i);
    expect(body).not.toMatch(/"goals"|"score"|"winner"|"halftime"|"fulltime"|"events"|"statistics"|"lineups"/);
    expect(body).toContain(FROZEN_PROTOCOL_FINGERPRINT);
    expect(body).toContain(DISCOVERY_PROVIDER);
    expect(body).toContain("discoveredAtUtc");
    const parsed = JSON.parse(body) as { fixtures: unknown; callAccounting: { totalCalls: number } };
    assertSafeProjectedObject(parsed);
    expect(parsed.callAccounting.totalCalls).toBe(1);

    expect(() =>
      persistDiscoveryArtifact({
        artifact: {
          ...result,
          nearestUpcoming: undefined,
          artifactPath: undefined,
          fixtureCountReturned: undefined,
          upcomingFixtureCount: undefined,
          observedStatuses: undefined,
          phase: undefined,
          rawResponsePersisted: undefined,
          scoresPersisted: undefined,
        } as never,
        persistRoot: join(persistRoot, "pending"),
      }),
    ).toThrow(/pending/);

    writeFileSync(join(persistRoot, "poison.json.tmp"), "unused", "utf8");
    expect(() =>
      persistDiscoveryArtifact({
        artifact: {
          ...JSON.parse(body),
          discoveredAtUtc: atMinutesBefore(3999),
          fixtures: [{ ...result.fixtures[0], goals: { home: 1 } }],
        },
        persistRoot,
      }),
    ).toThrow(/forbidden outcome field/);
  });
});
