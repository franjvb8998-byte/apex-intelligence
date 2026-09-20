/**
 * Sprint 5C.5B.1 — offline live evidence / capture execution adapter.
 * Synthetic provider payloads only. Zero provider calls. No real pending batches.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ACCEPTED_PROSPECTIVE_SEASON,
  CANDIDATE_MANIFEST_FINGERPRINT,
  LIVE_CAPTURE_WINDOW,
  LIVE_EXECUTION_DEFAULT_MODE,
  LIVE_EXECUTION_MODE_DRY_RUN,
  LIVE_EXECUTION_MODE_PERSIST_PENDING,
  LIVE_EXECUTION_PHASE,
  LIVE_PROTOCOL_FINGERPRINT,
  LiveExecutionRejectedError,
  PROSPECTIVE_CANDIDATE_IDS,
  ZERO_PROVIDER_CALLS,
  countPersistedProspectiveN,
  createFixedClock,
  createSyntheticLiveExecutionTransport,
  executeLiveCaptureAdapter,
  hashEvidenceManifest,
  hashRecords,
  verifyBatchHashes,
} from "@/lib/debug/calibration";
import { pendingDirectory } from "@/lib/debug/calibration/prospective/capture/capture-persist";
import type { ProspectiveCaptureBatch } from "@/lib/debug/calibration/prospective/capture/capture-types";
import type { LiveExecutionRequest } from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";

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
const PROTOCOL_FILES = [
  "lib/debug/calibration/prospective/protocol/protocol-types.ts",
  "lib/debug/calibration/prospective/protocol/protocol-config.ts",
  "lib/debug/calibration/prospective/protocol/protocol-fingerprint.ts",
  "lib/debug/calibration/prospective/protocol/protocol-planner.ts",
];
const CAPTURE_FILES = [
  "lib/debug/calibration/prospective/capture/capture-runner.ts",
  "lib/debug/calibration/prospective/capture/capture-eligibility.ts",
  "lib/debug/calibration/prospective/capture/capture-types.ts",
];
const DISCOVERY_DIR = "lib/debug/calibration/prospective/live";
const INTEGRATION_DIR = "lib/debug/calibration/prospective/live-capture";
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
  const root = mkdtempSync(join(tmpdir(), "apex-5c5b1-"));
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

function priorWin(id: number, teamId: number, opponent: number, days: number) {
  return providerFixture({
    id,
    kickoff: daysBefore(days),
    status: "FT",
    homeId: teamId,
    awayId: opponent,
    homeGoals: 2,
    awayGoals: 0,
  });
}

function priorLoss(id: number, teamId: number, opponent: number, days: number) {
  return providerFixture({
    id,
    kickoff: daysBefore(days),
    status: "FT",
    homeId: opponent,
    awayId: teamId,
    homeGoals: 3,
    awayGoals: 0,
  });
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

function strongHomePriors() {
  return [
    ...Array.from({ length: 9 }, (_, i) => priorWin(20 + i, HOME, 500 + i, 30 - i)),
    providerFixture({ id: 29, kickoff: daysBefore(2), status: "FT", homeId: HOME, awayId: 510, homeGoals: 1, awayGoals: 1 }),
    ...Array.from({ length: 7 }, (_, i) => priorLoss(40 + i, AWAY, 600 + i, 28 - i)),
    providerFixture({ id: 47, kickoff: daysBefore(6), status: "FT", homeId: AWAY, awayId: 610, homeGoals: 1, awayGoals: 0 }),
    providerFixture({ id: 48, kickoff: daysBefore(4), status: "FT", homeId: 611, awayId: AWAY, homeGoals: 1, awayGoals: 1 }),
    providerFixture({ id: 49, kickoff: daysBefore(3), status: "FT", homeId: 612, awayId: AWAY, homeGoals: 1, awayGoals: 1 }),
  ];
}

function strongAwayPriors() {
  return [
    ...Array.from({ length: 8 }, (_, i) => priorLoss(60 + i, HOME, 700 + i, 28 - i)),
    ...Array.from({ length: 8 }, (_, i) => priorWin(80 + i, AWAY, 800 + i, 27 - i)),
  ];
}

function sparsePriors() {
  return [
    providerFixture({ id: 90, kickoff: daysBefore(8), status: "FT", homeId: HOME, awayId: 901, homeGoals: 1, awayGoals: 0 }),
    providerFixture({ id: 91, kickoff: daysBefore(8), status: "FT", homeId: 902, awayId: AWAY, homeGoals: 1, awayGoals: 0 }),
  ];
}

function validOdds(capturedAt = atMinutesBefore(70)) {
  return { capturedAt, source: "SyntheticBook", home: 2.1, draw: 3.4, away: 3.6, extraBookField: "dropped" };
}

function run(
  extra: Partial<LiveExecutionRequest> & {
    minutes?: number;
    target?: unknown;
    fixtures?: unknown[];
    odds?: unknown | null;
  } = {},
) {
  const minutes = extra.minutes ?? 60;
  const capturedAt = extra.capturedAt ?? atMinutesBefore(minutes);
  const target = extra.target ?? targetFixture();
  const transport = extra.transport ?? createSyntheticLiveExecutionTransport({
    target,
    fixtures: extra.fixtures ?? balancedPriors(),
    odds: extra.odds,
  });
  return executeLiveCaptureAdapter({
    clock: extra.clock ?? createFixedClock(capturedAt),
    capturedAt,
    createdAt: extra.createdAt ?? capturedAt,
    mode: extra.mode,
    persistRoot: extra.persistRoot,
    priorIndex: extra.priorIndex,
    transport,
    simulateEvidenceFailure: extra.simulateEvidenceFailure,
    simulateCandidateFailure: extra.simulateCandidateFailure,
    simulatePersistenceFailure: extra.simulatePersistenceFailure,
    simulateIntegrityFailure: extra.simulateIntegrityFailure,
  });
}

function expectRejected(fn: () => unknown, pattern: RegExp) {
  try {
    fn();
    throw new Error("expected rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(LiveExecutionRejectedError);
    expect((error as Error).message).toMatch(pattern);
    return error as LiveExecutionRejectedError;
  }
}

function readExecutionSources(): string {
  const dir = "lib/debug/calibration/prospective/live-execution";
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

describe("Sprint 5C.5B.1 — live execution adapter (offline)", () => {
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
    expect(LIVE_EXECUTION_MODE_DRY_RUN).toBe("DRY_RUN");
    expect(LIVE_EXECUTION_PHASE).toBe("OFFLINE_LIVE_EXECUTION_ADAPTER");
    expect(execSync(`git diff --name-only HEAD -- ${FROZEN_CANDIDATE_FILES.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${PROTOCOL_FILES.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${CAPTURE_FILES.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${DISCOVERY_DIR}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${INTEGRATION_DIR}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${PRODUCTION_PATHS.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
  });

  it("1–8, 26–33, 43–44: balanced T-60 capture via synthetic transport with optional odds", () => {
    const result = run({ odds: validOdds() });
    expect(result.phase).toBe(LIVE_EXECUTION_PHASE);
    expect(result.mode).toBe(LIVE_EXECUTION_DEFAULT_MODE);
    expect(result.dryRun).toBe(true);
    expect(result.callAccounting).toEqual(ZERO_PROVIDER_CALLS);
    expect(result.report.providerCallAccounting).toEqual({
      discoveryCalls: 0,
      evidenceCalls: 0,
      oddsCalls: 0,
      totalCalls: 0,
    });
    expect(result.projectedTarget).toEqual({
      fixtureId: "1557407",
      competitionId: "39",
      season: "2026",
      kickoffUtc: KICKOFF,
      status: "NS",
      homeTeamId: "100",
      awayTeamId: "200",
      homeTeamName: "Bournemouth",
      awayTeamName: "Liverpool",
    });
    expect(result.provenance?.homeEvidenceMatchCount).toBe(4);
    expect(result.provenance?.awayEvidenceMatchCount).toBe(4);
    expect(result.provenance?.latestAcceptedKickoff).toBe(daysBefore(7));
    expect(Date.parse(result.provenance!.latestAcceptedKickoff!)).toBeLessThan(Date.parse(KICKOFF));
    expect(result.report.oddsPresent).toBe(true);
    expect(result.capture?.recordCount).toBe(5);
    expect(result.capture?.batch?.candidateFingerprint).toBe(FROZEN_CANDIDATE);
    const records = result.capture!.batch!.records;
    expect(records.map((row) => row.candidateId)).toEqual([...PROSPECTIVE_CANDIDATE_IDS]);
    expect(records.every((row) => row.resultStatus === "PENDING")).toBe(true);
    expect(records.every((row) => row.finalHomeGoals === null && row.finalAwayGoals === null && row.scoredAt === null)).toBe(true);
    expect(records.every((row) => row.odds?.home === 2.1)).toBe(true);
    verifyBatchHashes(result.capture!.batch!);
    expect(result.report.hashVerification).toBe("PASS");
    expect(result.report.persistenceStatus).toBe("NOT_WRITTEN");
    expect(JSON.stringify(result.report)).not.toMatch(/API_FOOTBALL_KEY|x-apisports-key|winner|bet recommendation|probHome/i);
  });

  it("2–5: strong-home, strong-away, sparse, and zero-match evidence remain legal", () => {
    const strongHome = run({ fixtures: strongHomePriors() });
    const strongHomeSnap = strongHome.capture!.batch!.evidenceSnapshots[0]!;
    expect(strongHomeSnap.home.wins).toBeGreaterThan(strongHomeSnap.home.losses);
    expect(strongHomeSnap.home.wins).toBeGreaterThan(strongHomeSnap.away.wins);
    expect(strongHome.capture?.recordCount).toBe(5);

    const strongAway = run({ target: targetFixture({ id: "syn-away" }), fixtures: strongAwayPriors() });
    const strongAwaySnap = strongAway.capture!.batch!.evidenceSnapshots[0]!;
    expect(strongAwaySnap.away.wins).toBeGreaterThan(strongAwaySnap.away.losses);
    expect(strongAwaySnap.away.wins).toBeGreaterThan(strongAwaySnap.home.wins);

    const sparse = run({ target: targetFixture({ id: "syn-sparse" }), fixtures: sparsePriors() });
    expect(sparse.provenance?.homeEvidenceMatchCount).toBe(1);
    expect(sparse.provenance?.awayEvidenceMatchCount).toBe(1);
    expect(sparse.capture?.recordCount).toBe(5);

    const zero = run({ target: targetFixture({ id: "syn-zero" }), fixtures: [] });
    expect(zero.provenance?.priorsAccepted).toBe(0);
    expect(zero.provenance?.homeEvidenceMatchCount).toBe(0);
    expect(zero.provenance?.awayEvidenceMatchCount).toBe(0);
    expect(zero.provenance?.latestAcceptedKickoff).toBeNull();
    expect(zero.report.evidencePresent).toBe(true);
    expect(zero.capture?.recordCount).toBe(5);
  });

  it("6–8: valid odds attach, missing odds remain eligible, late odds are dropped", () => {
    const withOdds = run({ odds: validOdds() });
    expect(withOdds.report.oddsPresent).toBe(true);

    const none = run({ target: targetFixture({ id: "no-odds" }), odds: null });
    expect(none.report.oddsPresent).toBe(false);
    expect(none.capture?.recordCount).toBe(5);
    expect(none.capture?.batch?.records.every((row) => row.odds === null)).toBe(true);

    const late = run({
      target: targetFixture({ id: "late-odds" }),
      odds: validOdds(atMinutesBefore(30)),
    });
    expect(late.report.oddsPresent).toBe(false);
    expect(late.capture?.recordCount).toBe(5);
  });

  it("9–15: frozen window recheck — T-80 too early, T-75/60/45 eligible, T-44/kickoff/post missed", () => {
    expectRejected(() => run({ minutes: 80 }), /TOO_EARLY/);
    expect(run({ minutes: 75, target: targetFixture({ id: "t75" }) }).capture?.recordCount).toBe(5);
    expect(run({ minutes: 60, target: targetFixture({ id: "t60" }) }).capture?.recordCount).toBe(5);
    expect(run({ minutes: 45, target: targetFixture({ id: "t45" }) }).capture?.recordCount).toBe(5);
    expectRejected(() => run({ minutes: 44 }), /MISSED_WINDOW/);
    expectRejected(() => run({ minutes: 0 }), /MISSED_WINDOW|kickoff/);
    expectRejected(() => run({ minutes: -10 }), /MISSED_WINDOW|kickoff/);
  });

  it("16–20: wrong league, wrong season, LIVE, FT, and unknown status are rejected", () => {
    expectRejected(() => run({ target: targetFixture({ leagueId: 40 }) }), /Premier League|INTEGRITY_REJECTED/);
    expectRejected(() => run({ target: targetFixture({ season: 2027 }) }), /season|INTEGRITY_REJECTED/);
    expectRejected(() => run({ target: targetFixture({ status: "LIVE" }) }), /INELIGIBLE_STATUS|LIVE/);
    expectRejected(() => run({ target: targetFixture({ status: "FT" }) }), /INELIGIBLE_STATUS|FT/);
    expectRejected(() => run({ target: targetFixture({ status: "WEIRD" }) }), /unknown provider status|INELIGIBLE_STATUS/);
  });

  it("21–25: same-kickoff, future, target, incomplete, and postponed/cancelled fixtures are excluded from evidence", () => {
    const excluded = [
      providerFixture({ id: "same-kickoff", kickoff: KICKOFF, status: "FT", homeId: HOME, awayId: 999, homeGoals: 9, awayGoals: 0 }),
      providerFixture({ id: "future", kickoff: daysBefore(-3), status: "FT", homeId: HOME, awayId: 998, homeGoals: 7, awayGoals: 0 }),
      providerFixture({
        id: 1557407,
        kickoff: KICKOFF,
        status: "FT",
        homeGoals: 5,
        awayGoals: 0,
      }),
      providerFixture({ id: "incomplete", kickoff: daysBefore(5), status: "FT", homeId: HOME, awayId: 997, omitGoals: true }),
      providerFixture({ id: "postponed", kickoff: daysBefore(4), status: "PST", homeId: HOME, awayId: 996, homeGoals: 4, awayGoals: 0 }),
      providerFixture({ id: "cancelled", kickoff: daysBefore(3), status: "CANC", homeId: HOME, awayId: 995, homeGoals: 4, awayGoals: 0 }),
      providerFixture({ id: "abandoned", kickoff: daysBefore(2), status: "ABD", homeId: HOME, awayId: 994, homeGoals: 4, awayGoals: 0 }),
      providerFixture({ id: "live-prior", kickoff: daysBefore(1), status: "LIVE", homeId: HOME, awayId: 993, homeGoals: 1, awayGoals: 0 }),
    ];
    const result = run({ fixtures: [...balancedPriors(), ...excluded] });
    expect(result.provenance?.homeEvidenceMatchCount).toBe(4);
    expect(result.provenance?.awayEvidenceMatchCount).toBe(4);
    expect(result.provenance?.priorsInspected).toBe(balancedPriors().length + excluded.length);
    expect(result.provenance?.priorsAccepted).toBe(8);
    expect(Date.parse(result.provenance!.latestAcceptedKickoff!)).toBeLessThan(Date.parse(KICKOFF));
    expect(JSON.stringify(result.provenance)).not.toMatch(/"homeGoals"|"winner"|"finalHomeGoals"/);
  });

  it("34–38: tampering is detected and simulated failures persist nothing", () => {
    const good = run();
    const tamperedRecords: ProspectiveCaptureBatch = {
      ...good.capture!.batch!,
      records: good.capture!.batch!.records.map((row, index) =>
        index === 0 ? { ...row, probHome: row.probHome + 0.01 } : row,
      ),
    };
    expect(hashRecords(tamperedRecords.records)).not.toBe(good.capture!.batch!.recordsHash);
    expect(() => verifyBatchHashes(tamperedRecords)).toThrow(/recordsHash/);
    const tamperedEvidence: ProspectiveCaptureBatch = {
      ...good.capture!.batch!,
      evidenceSnapshots: good.capture!.batch!.evidenceSnapshots.map((row, index) =>
        index === 0 ? { ...row, home: { ...row.home, goalsFor: row.home.goalsFor + 1 } } : row,
      ),
    };
    expect(hashEvidenceManifest(tamperedEvidence.evidenceSnapshots)).not.toBe(good.capture!.batch!.evidenceManifestHash);
    expect(() => verifyBatchHashes(tamperedEvidence)).toThrow(/evidenceManifestHash/);

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
      () => run({ persistRoot: root, mode: LIVE_EXECUTION_MODE_PERSIST_PENDING, simulateIntegrityFailure: true }),
      /recordsHash|integrity/,
    );
    expect(pendingJson(root)).toEqual([]);

    expectRejected(
      () => run({ persistRoot: root, mode: LIVE_EXECUTION_MODE_PERSIST_PENDING, simulatePersistenceFailure: true }),
      /persist failure/,
    );
    expect(pendingJson(root).filter((name) => !name.includes(".tmp"))).toEqual([]);
    expect(countPersistedProspectiveN({ persistRoot: root })).toBe(0);
  });

  it("35, 39–42: DRY_RUN does not write or change N; persisted temp capture increments N by 1", () => {
    const root = tempRoot();
    const dry = run({ persistRoot: root });
    expect(dry.mode).toBe("DRY_RUN");
    expect(dry.dryRun).toBe(true);
    expect(dry.report.prospectiveNBefore).toBe(0);
    expect(dry.report.prospectiveNAfter).toBe(0);
    expect(dry.capture?.capture?.persisted).toBeNull();
    expect(pendingJson(root)).toEqual([]);
    expect(existsSync(join(process.cwd(), "data/prospective/pending"))).toBe(false);

    const written = run({
      persistRoot: root,
      mode: LIVE_EXECUTION_MODE_PERSIST_PENDING,
      target: targetFixture({ id: "persist-one" }),
    });
    expect(written.dryRun).toBe(false);
    expect(written.report.recordCount).toBe(5);
    expect(written.report.prospectiveNBefore).toBe(0);
    expect(written.report.prospectiveNAfter).toBe(1);
    expect(countPersistedProspectiveN({ persistRoot: root })).toBe(1);
    expect(pendingJson(root)).toHaveLength(1);
    expect(written.capture?.capture?.persisted?.path).toContain(join("pending", `${written.capture!.batch!.batchId}.json`));

    expectRejected(
      () => run({
        persistRoot: root,
        mode: LIVE_EXECUTION_MODE_PERSIST_PENDING,
        target: targetFixture({ id: "persist-one" }),
      }),
      /DUPLICATE|already captured/,
    );
    expect(countPersistedProspectiveN({ persistRoot: root })).toBe(1);
  });

  it("45–47: no ranking/selection, no historical scoring, and no network/live-transport source", () => {
    const source = readExecutionSources();
    expect(source).not.toMatch(/API_FOOTBALL_KEY|x-apisports-key|v3\.football\.api-sports\.io|\/api\/odds|\/api\/fixtures/);
    expect(source).not.toMatch(/\bfetch\s*\(|axios|createLiveDiscoveryTransport|discoverLiveFixtures|getFixtureOdds/);
    expect(source).not.toMatch(/rankCandidates|pickWinner|bestCandidate|expected value|\bEV\b|value bet|highest probability/);
    expect(source).not.toMatch(/scoredAt|finalHomeGoals|historical scoring|outcome scoring/);
    expect(source).toMatch(/kind: "synthetic"/);
    expectRejected(
      () => executeLiveCaptureAdapter({
        clock: createFixedClock(atMinutesBefore(60)),
        capturedAt: atMinutesBefore(60),
        transport: {
          kind: "live",
          loadUniverse: () => ({ target: targetFixture(), fixtures: [] }),
        },
      }),
      /live transport is not authorized/,
    );
  });
});
