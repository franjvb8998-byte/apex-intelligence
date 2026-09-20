/**
 * Sprint 5C.5B.2 — offline controlled live capture execution bridge.
 * Synthetic transports only. Zero provider calls. No real pending or scored batches.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ACCEPTED_PROSPECTIVE_SEASON,
  CANDIDATE_MANIFEST_FINGERPRINT,
  CAPTURE_BRIDGE_LIVE_PROVIDER_ENABLED,
  CAPTURE_BRIDGE_PHASE,
  CAPTURE_BRIDGE_REQUEST_FAMILIES,
  CaptureBridgeRejectedError,
  LIVE_CAPTURE_WINDOW,
  LIVE_EXECUTION_DEFAULT_MODE,
  LIVE_EXECUTION_MODE_PERSIST_PENDING,
  LIVE_PROTOCOL_FINGERPRINT,
  PROSPECTIVE_CANDIDATE_IDS,
  ZERO_BRIDGE_SPENT_CALLS,
  countPersistedProspectiveN,
  countScoredProspectiveN,
  createFixedClock,
  createSyntheticCaptureBridgeTransport,
  executeCaptureBridge,
  hashEvidenceManifest,
  hashRecords,
  planCaptureBridgeBudget,
  verifyBatchHashes,
} from "@/lib/debug/calibration";
import { pendingDirectory } from "@/lib/debug/calibration/prospective/capture/capture-persist";
import type { CaptureClock } from "@/lib/debug/calibration/prospective/capture/capture-types";
import type {
  CaptureBridgeRequest,
  CaptureBridgeTransport,
  ReviewedCaptureHandoff,
} from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";
import type { PlannerDisposition } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

const FROZEN_CANDIDATE = "7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c";
const FROZEN_PROTOCOL = "825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9";
const KICKOFF = "2099-08-17T15:00:00.000Z";
const HOME = 100;
const AWAY = 200;

const FROZEN_CANDIDATE_FILES = [
  "lib/debug/calibration/prospective/candidate-config.ts",
  "lib/debug/calibration/prospective/candidate-input.ts",
  "lib/debug/calibration/prospective/candidate-transform.ts",
  "lib/debug/calibration/prospective/candidate-high-equal.ts",
  "lib/debug/calibration/prospective/candidate-engine.ts",
];
const CAPTURE_FILES = [
  "lib/debug/calibration/prospective/capture/capture-runner.ts",
  "lib/debug/calibration/prospective/capture/capture-eligibility.ts",
  "lib/debug/calibration/prospective/capture/capture-types.ts",
  "lib/debug/calibration/prospective/capture/capture-manifest.ts",
];
const PROTOCOL_FILES = [
  "lib/debug/calibration/prospective/protocol/protocol-types.ts",
  "lib/debug/calibration/prospective/protocol/protocol-config.ts",
  "lib/debug/calibration/prospective/protocol/protocol-fingerprint.ts",
  "lib/debug/calibration/prospective/protocol/protocol-planner.ts",
];
const DISCOVERY_DIR = "lib/debug/calibration/prospective/live";
const INTEGRATION_DIR = "lib/debug/calibration/prospective/live-capture";
const EXECUTION_DIR = "lib/debug/calibration/prospective/live-execution";
const SCORING_DIR = "lib/debug/calibration/prospective/scoring";
const PRODUCTION_PATHS = [
  "lib/intelligence/modules/probability",
  "lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts",
  "lib/intelligence/modules/probability/hybrid/config.ts",
];

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "apex-5c5b2-"));
  tempRoots.push(root);
  return root;
}

function atMinutesBefore(minutes: number): string {
  return new Date(Date.parse(KICKOFF) - minutes * 60_000).toISOString();
}

function daysBefore(days: number): string {
  return new Date(Date.parse(KICKOFF) - days * 86_400_000).toISOString();
}

function providerFixture(input: {
  id: string | number;
  kickoff?: string;
  status?: string;
  leagueId?: number | string;
  season?: number | string;
  homeId?: number | string;
  awayId?: number | string;
  homeName?: string;
  awayName?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
  omitGoals?: boolean;
}): Record<string, unknown> {
  const row: Record<string, unknown> = {
    fixture: {
      id: input.id,
      date: input.kickoff ?? KICKOFF,
      status: { short: input.status ?? "NS" },
    },
    league: { id: input.leagueId ?? 39, season: input.season ?? 2026 },
    teams: {
      home: { id: input.homeId ?? HOME, name: input.homeName ?? `Team ${input.homeId ?? HOME}` },
      away: { id: input.awayId ?? AWAY, name: input.awayName ?? `Team ${input.awayId ?? AWAY}` },
    },
    unusedProviderField: "dropped",
    standings: { rank: 1 },
    lineups: [{ player: "blocked" }],
    injuries: [{ player: "blocked" }],
    xG: 1.8,
    h2h: [{ fixtureId: 1 }],
  };
  if (!input.omitGoals) {
    row.goals = { home: input.homeGoals ?? null, away: input.awayGoals ?? null };
  }
  return row;
}

function targetFixture(partial: Partial<Parameters<typeof providerFixture>[0]> = {}) {
  return providerFixture({
    id: 1557407,
    status: "NS",
    homeName: "Bournemouth",
    awayName: "Liverpool",
    homeGoals: null,
    awayGoals: null,
    ...partial,
  });
}

function reviewedHandoff(partial: Partial<ReviewedCaptureHandoff> = {}): ReviewedCaptureHandoff {
  return {
    fixtureId: "1557407",
    competitionId: "39",
    season: "2026",
    kickoffUtc: KICKOFF,
    status: "NS",
    homeTeamId: "100",
    homeTeamName: "Bournemouth",
    awayTeamId: "200",
    awayTeamName: "Liverpool",
    reviewedDiscoveryAtUtc: atMinutesBefore(70),
    reviewedClassification: "IN_WINDOW",
    ...partial,
  };
}

function balancedPriors() {
  return [
    providerFixture({ id: 1, kickoff: daysBefore(21), status: "FT", homeId: HOME, awayId: 301, homeGoals: 2, awayGoals: 1 }),
    providerFixture({ id: 2, kickoff: daysBefore(14), status: "FT", homeId: 302, awayId: HOME, homeGoals: 1, awayGoals: 1 }),
    providerFixture({ id: 3, kickoff: daysBefore(10), status: "FT", homeId: HOME, awayId: 303, homeGoals: 0, awayGoals: 1 }),
    providerFixture({ id: 4, kickoff: daysBefore(7), status: "FT", homeId: 304, awayId: HOME, homeGoals: 0, awayGoals: 2 }),
    providerFixture({ id: 5, kickoff: daysBefore(21), status: "FT", homeId: AWAY, awayId: 401, homeGoals: 1, awayGoals: 1 }),
    providerFixture({ id: 6, kickoff: daysBefore(14), status: "FT", homeId: 402, awayId: AWAY, homeGoals: 2, awayGoals: 0 }),
    providerFixture({ id: 7, kickoff: daysBefore(10), status: "FT", homeId: AWAY, awayId: 403, homeGoals: 2, awayGoals: 0 }),
    providerFixture({ id: 8, kickoff: daysBefore(7), status: "FT", homeId: 404, awayId: AWAY, homeGoals: 1, awayGoals: 1 }),
  ];
}

function validOdds(capturedAt = atMinutesBefore(70)) {
  return { capturedAt, source: "SyntheticBook", home: 2.1, draw: 3.4, away: 3.6, extraBookField: "dropped" };
}

function trackingTransport(input: {
  target?: unknown;
  fixtures?: readonly unknown[];
  odds?: unknown | null;
  failEvidence?: boolean;
  failOdds?: boolean;
} = {}): CaptureBridgeTransport & { evidenceLoads: number; oddsLoads: number } {
  const state = { evidenceLoads: 0, oddsLoads: 0 };
  const inner = createSyntheticCaptureBridgeTransport({
    target: input.target ?? targetFixture(),
    fixtures: input.fixtures ?? balancedPriors(),
    odds: input.odds,
    failEvidence: input.failEvidence,
    failOdds: input.failOdds,
  });
  return {
    kind: "synthetic",
    get evidenceLoads() {
      return state.evidenceLoads;
    },
    get oddsLoads() {
      return state.oddsLoads;
    },
    loadEvidenceUniverse(handoff) {
      state.evidenceLoads += 1;
      return inner.loadEvidenceUniverse(handoff);
    },
    loadOdds(fixtureId) {
      state.oddsLoads += 1;
      return inner.loadOdds?.(fixtureId) ?? null;
    },
  };
}

function run(
  extra: Partial<CaptureBridgeRequest> & {
    minutes?: number;
    target?: unknown;
    fixtures?: unknown[];
    odds?: unknown | null;
    failEvidence?: boolean;
    failOdds?: boolean;
    classification?: PlannerDisposition;
    clockNow?: string;
  } = {},
) {
  const minutes = extra.minutes ?? 60;
  const capturedAt = extra.capturedAt ?? extra.clockNow ?? atMinutesBefore(minutes);
  const transport = extra.transport ?? trackingTransport({
    target: extra.target ?? targetFixture(),
    fixtures: extra.fixtures ?? balancedPriors(),
    odds: extra.odds,
    failEvidence: extra.failEvidence,
    failOdds: extra.failOdds,
  });
  const clock: CaptureClock = extra.clock ?? createFixedClock(capturedAt);
  return executeCaptureBridge({
    handoff: extra.handoff ?? reviewedHandoff({
      reviewedClassification: extra.classification ?? "IN_WINDOW",
    }),
    transport,
    clock,
    capturedAt,
    mode: extra.mode,
    persistRoot: extra.persistRoot,
    priorDiscoveryCalls: extra.priorDiscoveryCalls,
    plannedEvidenceCalls: extra.plannedEvidenceCalls,
    plannedOddsCalls: extra.plannedOddsCalls,
    authorizeLiveProvider: extra.authorizeLiveProvider,
    simulateCandidateFailure: extra.simulateCandidateFailure,
    simulatePersistenceFailure: extra.simulatePersistenceFailure,
    simulateEvidenceFailure: extra.simulateEvidenceFailure,
  });
}

function expectRejected(fn: () => unknown, pattern: RegExp) {
  try {
    fn();
    throw new Error("expected rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(CaptureBridgeRejectedError);
    expect((error as Error).message).toMatch(pattern);
    return error as CaptureBridgeRejectedError;
  }
}

function readBridgeSources(): string {
  const dir = "lib/debug/calibration/prospective/live-capture-bridge";
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

function pendingJson(root: string): string[] {
  const dir = pendingDirectory(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json"));
}

function evidenceKeys(result: ReturnType<typeof run>) {
  const snap = result.batch!.evidenceSnapshots[0]!;
  return {
    home: Object.keys(snap.home).sort(),
    away: Object.keys(snap.away).sort(),
    snapshot: Object.keys(snap).sort(),
  };
}

describe("Sprint 5C.5B.2 — live capture bridge (offline)", () => {
  it("keeps frozen fingerprints, window, season, and frozen files unchanged", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(FROZEN_CANDIDATE);
    expect(LIVE_PROTOCOL_FINGERPRINT).toBe(FROZEN_PROTOCOL);
    expect(ACCEPTED_PROSPECTIVE_SEASON).toBe("2026");
    expect(LIVE_CAPTURE_WINDOW.targetCaptureMinutesBeforeKickoff).toBe(60);
    expect(LIVE_CAPTURE_WINDOW.earliestCaptureMinutesBeforeKickoff).toBe(75);
    expect(LIVE_CAPTURE_WINDOW.latestCaptureMinutesBeforeKickoff).toBe(45);
    expect(LIVE_EXECUTION_DEFAULT_MODE).toBe("DRY_RUN");
    expect(CAPTURE_BRIDGE_PHASE).toBe("OFFLINE_CONTROLLED_CAPTURE_BRIDGE");
    expect(CAPTURE_BRIDGE_LIVE_PROVIDER_ENABLED).toBe(false);
    expect(CAPTURE_BRIDGE_REQUEST_FAMILIES).toEqual({
      evidenceFamily: "prior_completed_same_league_season",
      oddsFamily: "optional_prematch_odds",
    });
    expect(execSync(`git diff --name-only HEAD -- ${FROZEN_CANDIDATE_FILES.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${CAPTURE_FILES.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${PROTOCOL_FILES.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${DISCOVERY_DIR}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${INTEGRATION_DIR}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${EXECUTION_DIR}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${SCORING_DIR}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${PRODUCTION_PATHS.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
  });

  it("1, 4, 7, 8, 31, 38, 40–44, 50: reviewed IN_WINDOW handoff is accepted at T-60", () => {
    const transport = trackingTransport({ odds: validOdds() });
    const result = run({ transport, minutes: 60 });
    expect(result.phase).toBe(CAPTURE_BRIDGE_PHASE);
    expect(result.dryRun).toBe(true);
    expect(result.report.reviewedClassification).toBe("IN_WINDOW");
    expect(result.report.finalClassification).toBe("IN_WINDOW");
    expect(result.report.identityVerified).toBe(true);
    expect(result.report.minutesToKickoff).toBe(60);
    expect(result.report.executionMode).toBe("DRY_RUN");
    expect(result.report.captureDisposition).toBe("DRY_RUN");
    expect(result.report.oddsDisposition).toBe("ATTACHED");
    expect(result.report.fiveArmCount).toBe(5);
    expect(result.report.candidateIds).toEqual([...PROSPECTIVE_CANDIDATE_IDS]);
    expect(result.report.providerCallAccounting).toMatchObject({
      priorDiscoveryCalls: 1,
      ...ZERO_BRIDGE_SPENT_CALLS,
    });
    expect(result.report.capturedNBefore).toBe(0);
    expect(result.report.capturedNAfter).toBe(0);
    expect(result.report.scoredNBefore).toBe(0);
    expect(result.report.scoredNAfter).toBe(0);
    expect(result.batch?.records).toHaveLength(5);
    expect(result.batch?.records.every((row) => row.resultStatus === "PENDING")).toBe(true);
    expect(result.batch?.records.every((row) => row.finalHomeGoals === null && row.finalAwayGoals === null && row.scoredAt === null)).toBe(true);
    verifyBatchHashes(result.batch!);
    expect(transport.evidenceLoads).toBe(1);
  });

  it("2–3, 57–58: TOO_EARLY and MISSED_WINDOW handoffs reject before evidence", () => {
    const earlyTransport = trackingTransport();
    const missedTransport = trackingTransport();
    const early = expectRejected(
      () => run({ transport: earlyTransport, classification: "TOO_EARLY" }),
      /reviewed handoff is TOO_EARLY/,
    );
    const missed = expectRejected(
      () => run({ transport: missedTransport, classification: "MISSED_WINDOW" }),
      /reviewed handoff is MISSED_WINDOW/,
    );
    expect(earlyTransport.evidenceLoads).toBe(0);
    expect(missedTransport.evidenceLoads).toBe(0);
    expect(early.report.capturedNAfter).toBe(0);
    expect(missed.report.capturedNAfter).toBe(0);
  });

  it("5–7: final recheck uses the injected UTC clock and refuses capture outside the window", () => {
    const early = expectRejected(() => run({ minutes: 80 }), /TOO_EARLY/);
    expect(early.report.minutesToKickoff).toBe(80);
    expect(early.report.finalClassification).toBe("TOO_EARLY");
    expect(early.report.capturedNAfter).toBe(0);

    const missed = expectRejected(() => run({ minutes: 44 }), /MISSED_WINDOW/);
    expect(missed.report.minutesToKickoff).toBe(44);
    expect(missed.report.finalClassification).toBe("MISSED_WINDOW");
    expect(missed.report.capturedNAfter).toBe(0);

    const injected = "2099-08-17T14:00:00.000Z";
    const clock: CaptureClock = { now: () => injected };
    const result = run({ clock, clockNow: injected });
    expect(result.report.minutesToKickoff).toBe(60);
    expect(result.report.executionStartedAtUtc).toBe(injected);
  });

  it("9–14: reviewed fixture identity is bound exactly", () => {
    expectRejected(
      () => run({ target: targetFixture({ id: 999999 }) }),
      /fixtureId mismatch/,
    );
    expectRejected(
      () => run({ target: targetFixture({ leagueId: 40 }) }),
      /competition mismatch/,
    );
    expectRejected(
      () => run({ target: targetFixture({ season: 2027 }) }),
      /season mismatch/,
    );
    expectRejected(
      () => run({ target: targetFixture({ kickoff: "2099-08-17T16:00:00.000Z" }) }),
      /kickoff mismatch/,
    );
    expectRejected(
      () => run({ target: targetFixture({ homeId: 111 }) }),
      /homeTeamId mismatch/,
    );
    expectRejected(
      () => run({ target: targetFixture({ awayId: 222 }) }),
      /awayTeamId mismatch/,
    );
  });

  it("15–26: prior completed same-competition/season evidence only; sparse and zero remain legal", () => {
    const mixed = [
      ...balancedPriors(),
      providerFixture({ id: 11, kickoff: daysBefore(12), status: "AET", homeId: HOME, awayId: 311, homeGoals: 1, awayGoals: 0 }),
      providerFixture({ id: 12, kickoff: daysBefore(11), status: "PEN", homeId: 312, awayId: AWAY, homeGoals: 2, awayGoals: 2 }),
      providerFixture({ id: 13, kickoff: daysBefore(9), status: "LIVE", homeId: HOME, awayId: 313, homeGoals: 3, awayGoals: 0 }),
      providerFixture({ id: 14, kickoff: daysBefore(8), status: "NS", homeId: HOME, awayId: 314, homeGoals: 4, awayGoals: 0 }),
      providerFixture({ id: 15, kickoff: daysBefore(6), status: "FT", leagueId: 40, homeId: HOME, awayId: 315, homeGoals: 5, awayGoals: 0 }),
      providerFixture({ id: 16, kickoff: daysBefore(5), status: "FT", season: 2025, homeId: HOME, awayId: 316, homeGoals: 6, awayGoals: 0 }),
      providerFixture({ id: 17, kickoff: daysBefore(-1), status: "FT", homeId: HOME, awayId: 317, homeGoals: 7, awayGoals: 0 }),
      providerFixture({ id: "same-kickoff", kickoff: KICKOFF, status: "FT", homeId: HOME, awayId: 318, homeGoals: 9, awayGoals: 0 }),
      providerFixture({
        id: 1557407,
        kickoff: KICKOFF,
        status: "FT",
        homeGoals: 8,
        awayGoals: 0,
      }),
    ];
    const result = run({ fixtures: mixed });
    expect(result.report.sameKickoffExcludedCount).toBe(1);
    expect(result.report.targetExcluded).toBe(true);
    expect(result.report.evidenceCutoff).toBe(KICKOFF);
    expect(result.report.evidenceFixtureCount).toBe(10);
    const snap = result.batch!.evidenceSnapshots[0]!;
    expect(snap.home.goalsFor).toBeLessThan(9);
    expect(snap.home.wins).toBeLessThan(9);
    expect(Date.parse(result.report.evidenceCutoff)).toBeGreaterThan(Date.parse(daysBefore(7)));

    const sparse = run({
      handoff: reviewedHandoff({ fixtureId: "syn-sparse" }),
      target: targetFixture({ id: "syn-sparse" }),
      fixtures: [
        providerFixture({ id: 90, kickoff: daysBefore(8), status: "FT", homeId: HOME, awayId: 901, homeGoals: 1, awayGoals: 0 }),
        providerFixture({ id: 91, kickoff: daysBefore(8), status: "FT", homeId: 902, awayId: AWAY, homeGoals: 1, awayGoals: 0 }),
      ],
    });
    expect(sparse.report.evidenceFixtureCount).toBe(2);
    expect(sparse.report.fiveArmCount).toBe(5);

    const zero = run({
      handoff: reviewedHandoff({ fixtureId: "syn-zero" }),
      target: targetFixture({ id: "syn-zero" }),
      fixtures: [],
    });
    expect(zero.report.evidenceFixtureCount).toBe(0);
    expect(zero.report.fiveArmCount).toBe(5);
  });

  it("21–24: FT, AET, and PEN are accepted; non-final statuses are excluded", () => {
    const result = run({
      fixtures: [
        providerFixture({ id: 21, kickoff: daysBefore(9), status: "FT", homeId: HOME, awayId: 321, homeGoals: 1, awayGoals: 0 }),
        providerFixture({ id: 22, kickoff: daysBefore(8), status: "AET", homeId: 322, awayId: HOME, homeGoals: 0, awayGoals: 1 }),
        providerFixture({ id: 23, kickoff: daysBefore(7), status: "PEN", homeId: AWAY, awayId: 323, homeGoals: 2, awayGoals: 2 }),
        providerFixture({ id: 24, kickoff: daysBefore(6), status: "LIVE", homeId: HOME, awayId: 324, homeGoals: 4, awayGoals: 0 }),
        providerFixture({ id: 25, kickoff: daysBefore(5), status: "PST", homeId: HOME, awayId: 325, homeGoals: 4, awayGoals: 0 }),
      ],
    });
    expect(result.report.evidenceFixtureCount).toBe(3);
    expect(result.batch!.evidenceSnapshots[0]!.home.matchesPlayed).toBe(2);
    expect(result.batch!.evidenceSnapshots[0]!.away.matchesPlayed).toBe(1);
  });

  it("27–30: catalogue projection is W/D/L/GF/GA only", () => {
    const keys = evidenceKeys(run());
    expect(keys.home).toEqual(["draws", "goalsAgainst", "goalsFor", "losses", "matchesPlayed", "teamId", "wins"]);
    expect(keys.away).toEqual(keys.home);
    expect(JSON.stringify(run().batch!.evidenceSnapshots)).not.toMatch(/h2h|standings|lineup|injur|xG|possession|shots|cards|corners/i);
  });

  it("32–37: optional odds never reject, never change probabilities, and never select a candidate", () => {
    const missing = run({
      handoff: reviewedHandoff({ fixtureId: "no-odds" }),
      target: targetFixture({ id: "no-odds" }),
      odds: null,
    });
    expect(missing.report.oddsDisposition).toBe("ABSENT");
    expect(missing.report.fiveArmCount).toBe(5);

    const failed = run({
      handoff: reviewedHandoff({ fixtureId: "odds-fail" }),
      target: targetFixture({ id: "odds-fail" }),
      failOdds: true,
    });
    expect(failed.report.oddsDisposition).toBe("TRANSPORT_FAILED");
    expect(failed.report.fiveArmCount).toBe(5);

    const late = run({
      handoff: reviewedHandoff({ fixtureId: "late-odds" }),
      target: targetFixture({ id: "late-odds" }),
      odds: validOdds(atMinutesBefore(30)),
    });
    expect(late.report.oddsDisposition).toBe("DROPPED_LATE");
    expect(late.report.fiveArmCount).toBe(5);

    const invalid = run({
      handoff: reviewedHandoff({ fixtureId: "bad-odds" }),
      target: targetFixture({ id: "bad-odds" }),
      odds: { capturedAt: atMinutesBefore(70), source: "", home: -1, draw: 3, away: 4 },
    });
    expect(invalid.report.oddsDisposition).toBe("DROPPED_INVALID");
    expect(invalid.report.fiveArmCount).toBe(5);

    const withOdds = run({
      handoff: reviewedHandoff({ fixtureId: "odds-compare" }),
      target: targetFixture({ id: "odds-compare" }),
      odds: validOdds(),
    });
    const withoutOdds = run({
      handoff: reviewedHandoff({ fixtureId: "odds-compare" }),
      target: targetFixture({ id: "odds-compare" }),
      odds: null,
    });
    expect(withOdds.batch!.records.map((row) => [row.candidateId, row.probHome, row.probDraw, row.probAway])).toEqual(
      withoutOdds.batch!.records.map((row) => [row.candidateId, row.probHome, row.probDraw, row.probAway]),
    );
    expect(JSON.stringify(withOdds.report)).not.toMatch(/winner|best model|rank|stake|expected value|\bEV\b/i);
  });

  it("39, 47–48: arm failure, persistence failure, and duplicates persist nothing", () => {
    const root = tempRoot();
    expectRejected(
      () => run({ persistRoot: root, mode: LIVE_EXECUTION_MODE_PERSIST_PENDING, simulateCandidateFailure: true }),
      /simulated candidate failure/,
    );
    expect(pendingJson(root)).toEqual([]);
    expect(countPersistedProspectiveN({ persistRoot: root })).toBe(0);

    expectRejected(
      () => run({ persistRoot: root, mode: LIVE_EXECUTION_MODE_PERSIST_PENDING, simulateEvidenceFailure: true }),
      /simulated evidence failure/,
    );
    expect(pendingJson(root)).toEqual([]);

    expectRejected(
      () => run({ persistRoot: root, mode: LIVE_EXECUTION_MODE_PERSIST_PENDING, simulatePersistenceFailure: true }),
      /persist failure/,
    );
    expect(pendingJson(root).filter((name) => !name.includes(".tmp"))).toEqual([]);
    expect(countPersistedProspectiveN({ persistRoot: root })).toBe(0);
  });

  it("42, 45–49, 53–54: explicit temp persistence increments capturedN by 1 and leaves scoredN unchanged", () => {
    const root = tempRoot();
    const dry = run({ persistRoot: root });
    expect(dry.dryRun).toBe(true);
    expect(dry.report.capturedNAfter).toBe(0);
    expect(pendingJson(root)).toEqual([]);
    expect(existsSync(join(process.cwd(), "data/prospective/pending"))).toBe(false);
    expect(existsSync(join(process.cwd(), "data/prospective/scored"))).toBe(false);

    const first = run({ persistRoot: root });
    const second = run({ persistRoot: root });
    expect(first.report.batchId).toBe(second.report.batchId);
    expect(first.report.batchHash).toBe(second.report.batchHash);
    expect(hashRecords(first.batch!.records)).toBe(first.report.recordsHash);
    expect(hashEvidenceManifest(first.batch!.evidenceSnapshots)).toBe(first.report.evidenceManifestHash);

    const written = run({
      persistRoot: root,
      mode: LIVE_EXECUTION_MODE_PERSIST_PENDING,
      handoff: reviewedHandoff({ fixtureId: "persist-one" }),
      target: targetFixture({ id: "persist-one" }),
    });
    expect(written.dryRun).toBe(false);
    expect(written.report.captureDisposition).toBe("CAPTURED");
    expect(written.report.fiveArmCount).toBe(5);
    expect(written.report.capturedNBefore).toBe(0);
    expect(written.report.capturedNAfter).toBe(1);
    expect(countPersistedProspectiveN({ persistRoot: root })).toBe(1);
    expect(countScoredProspectiveN(root)).toBe(0);
    expect(written.report.scoredNAfter).toBe(0);
    expect(pendingJson(root)).toHaveLength(1);
    expect(pendingJson(root)[0]).not.toMatch(/scored/i);

    const duplicate = expectRejected(
      () => run({
        persistRoot: root,
        mode: LIVE_EXECUTION_MODE_PERSIST_PENDING,
        handoff: reviewedHandoff({ fixtureId: "persist-one" }),
        target: targetFixture({ id: "persist-one" }),
      }),
      /DUPLICATE|already captured/,
    );
    expect(countPersistedProspectiveN({ persistRoot: root })).toBe(1);
    expect(duplicate.report.capturedNAfter).toBe(1);
    expect(duplicate.report.scoredNAfter).toBe(0);
  });

  it("50–51: planned budget includes prior discovery and rejects overflow", () => {
    const plan = planCaptureBridgeBudget({});
    expect(plan.priorDiscoveryCalls).toBe(1);
    expect(plan.plannedEvidenceCalls).toBe(1);
    expect(plan.plannedTotalCalls).toBe(2);
    expectRejected(
      () => run({ plannedOddsCalls: 21 }),
      /budget overflow rejected/,
    );
    const overflowTransport = trackingTransport();
    expectRejected(
      () => run({ transport: overflowTransport, plannedEvidenceCalls: 2 }),
      /budget overflow rejected/,
    );
    expect(overflowTransport.evidenceLoads).toBe(0);
  });

  it("52, 55–60: no networking, secrets, discovery shortcut, ranking, or live enablement", () => {
    const source = readBridgeSources();
    expect(source).not.toMatch(/API_FOOTBALL_KEY|x-apisports-key|v3\.football\.api-sports\.io/);
    expect(source).not.toMatch(/\bfetch\s*\(|axios|run-live-discovery|discoverLiveFixtures|createLiveDiscoveryTransport/);
    expect(source).not.toMatch(/randomUUID|crypto\.random|Math\.random/);
    expect(source).not.toMatch(/rankCandidates|pickWinner|bestCandidate|expected value|\bEV\b|value bet|stake/);
    expect(source).not.toMatch(/process\.env\.APEX_CALIBRATION_LIVE|process\.env\.API_FOOTBALL_KEY/);
    expectRejected(
      () => run({ authorizeLiveProvider: true }),
      /live provider authorization is not accepted/,
    );
    expectRejected(
      () => executeCaptureBridge({
        handoff: reviewedHandoff(),
        clock: createFixedClock(atMinutesBefore(60)),
        transport: {
          kind: "live",
          loadEvidenceUniverse: () => ({ target: targetFixture(), fixtures: [] }),
        } as unknown as CaptureBridgeTransport,
      }),
      /synthetic transport only|live provider/,
    );
    expectRejected(
      () => run({ failEvidence: true }),
      /evidence transport failure/,
    );
  });
});
