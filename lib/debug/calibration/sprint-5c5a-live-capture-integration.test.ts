/**
 * Sprint 5C.5A — offline live-capture orchestration.
 * Synthetic fixtures only. Zero provider calls. No real pending batches.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ACCEPTED_PROSPECTIVE_SEASON,
  CANDIDATE_MANIFEST_FINGERPRINT,
  LIVE_CAPTURE_DEFAULT_DRY_RUN,
  LIVE_CAPTURE_OPERATIONAL_FACTS,
  LIVE_CAPTURE_PHASE,
  LIVE_CAPTURE_WINDOW,
  LIVE_PROTOCOL_CONFIG,
  LIVE_PROTOCOL_FINGERPRINT,
  PROSPECTIVE_CANDIDATE_IDS,
  PROSPECTIVE_SEASON_UNVERIFIED,
  assertCaptureBatchIntegrity,
  assertLiveCaptureBatchIntegrity,
  countPrimarySampleN,
  createFixedClock,
  hashEvidenceManifest,
  hashRecords,
  orchestrateLiveCapture,
  predictCandidate,
  reportLiveCaptureReadiness,
  siblingMaySupplyEvidence,
  toProspectiveFixtureInput,
  verifyBatchHashes,
} from "@/lib/debug/calibration";
import { assertExactCandidateIds } from "@/lib/debug/calibration/prospective/capture/capture-integrity";
import { evidenceFromSnapshot } from "@/lib/debug/calibration/prospective/capture/capture-evidence";
import { pendingDirectory } from "@/lib/debug/calibration/prospective/capture/capture-persist";
import type { LiveCaptureFixtureInput, LiveCaptureRequest } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import type { ProspectiveCaptureBatch, TeamEvidenceCounts } from "@/lib/debug/calibration/prospective/capture/capture-types";

const FROZEN_CANDIDATE = "7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c";
const FROZEN_PROTOCOL = "825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9";
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
const PRODUCTION_PATHS = [
  "lib/intelligence/modules/probability",
  "lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts",
  "lib/intelligence/modules/probability/hybrid/config.ts",
];

const KICKOFF = "2099-08-17T15:00:00.000Z";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "apex-5c5a-"));
  tempRoots.push(root);
  return root;
}

function atMinutesBefore(minutes: number): string {
  return new Date(Date.parse(KICKOFF) - minutes * 60_000).toISOString();
}

function team(partial: Partial<TeamEvidenceCounts> & Pick<TeamEvidenceCounts, "teamId">): TeamEvidenceCounts {
  return {
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    ...partial,
  };
}

function fixture(
  partial: Partial<LiveCaptureFixtureInput> & Pick<LiveCaptureFixtureInput, "fixtureId">,
): LiveCaptureFixtureInput {
  const homeTeamId = partial.homeTeamId ?? "home-syn";
  const awayTeamId = partial.awayTeamId ?? "away-syn";
  return {
    competitionId: "39",
    season: ACCEPTED_PROSPECTIVE_SEASON,
    kickoffUtc: KICKOFF,
    status: "NS",
    homeTeamId,
    awayTeamId,
    homeTeamName: partial.homeTeamName ?? "Synthetic Home",
    awayTeamName: partial.awayTeamName ?? "Synthetic Away",
    evidenceAsOf: atMinutesBefore(90),
    preMatchEvidence: partial.preMatchEvidence ?? {
      home: team({ teamId: homeTeamId, matchesPlayed: 8, wins: 4, draws: 2, losses: 2, goalsFor: 12, goalsAgainst: 8 }),
      away: team({ teamId: awayTeamId, matchesPlayed: 8, wins: 3, draws: 3, losses: 2, goalsFor: 9, goalsAgainst: 9 }),
    },
    ...partial,
    fixtureId: partial.fixtureId,
  };
}

const SYNTHETIC = {
  balanced: fixture({ fixtureId: "syn-balanced" }),
  strongHome: fixture({
    fixtureId: "syn-strong-home",
    homeTeamName: "Strong Home",
    awayTeamName: "Weak Away",
    preMatchEvidence: {
      home: team({ teamId: "home-syn", matchesPlayed: 10, wins: 9, draws: 1, losses: 0, goalsFor: 28, goalsAgainst: 4 }),
      away: team({ teamId: "away-syn", matchesPlayed: 10, wins: 1, draws: 2, losses: 7, goalsFor: 6, goalsAgainst: 22 }),
    },
  }),
  strongAway: fixture({
    fixtureId: "syn-strong-away",
    homeTeamName: "Weak Home",
    awayTeamName: "Strong Away",
    preMatchEvidence: {
      home: team({ teamId: "home-syn", matchesPlayed: 10, wins: 1, draws: 1, losses: 8, goalsFor: 5, goalsAgainst: 24 }),
      away: team({ teamId: "away-syn", matchesPlayed: 10, wins: 8, draws: 2, losses: 0, goalsFor: 26, goalsAgainst: 5 }),
    },
  }),
  sparse: fixture({
    fixtureId: "syn-sparse",
    preMatchEvidence: {
      home: team({ teamId: "home-syn", matchesPlayed: 1, wins: 1, draws: 0, losses: 0, goalsFor: 1, goalsAgainst: 0 }),
      away: team({ teamId: "away-syn", matchesPlayed: 1, wins: 0, draws: 0, losses: 1, goalsFor: 0, goalsAgainst: 1 }),
    },
  }),
  zero: fixture({
    fixtureId: "syn-zero",
    preMatchEvidence: {
      home: team({ teamId: "home-syn" }),
      away: team({ teamId: "away-syn" }),
    },
  }),
  withOdds: fixture({
    fixtureId: "syn-odds",
    oddsSnapshot: {
      capturedAt: atMinutesBefore(70),
      source: "SyntheticBook",
      home: 2.1,
      draw: 3.4,
      away: 3.6,
    },
  }),
  noOdds: fixture({ fixtureId: "syn-no-odds" }),
  sameA: fixture({ fixtureId: "syn-same-a" }),
  sameB: fixture({ fixtureId: "syn-same-b" }),
};

function run(
  fixtures: LiveCaptureFixtureInput[],
  extra?: Partial<LiveCaptureRequest> & { minutes?: number },
) {
  const minutes = extra?.minutes ?? 60;
  const capturedAt = atMinutesBefore(minutes);
  return orchestrateLiveCapture({
    fixtures,
    clock: createFixedClock(capturedAt),
    capturedAt,
    createdAt: capturedAt,
    dryRun: extra?.dryRun,
    persistRoot: extra?.persistRoot,
    priorIndex: extra?.priorIndex,
    simulateFailureAfterTempWrite: extra?.simulateFailureAfterTempWrite,
    simulateCandidateFailure: extra?.simulateCandidateFailure,
    captureImpl: extra?.captureImpl,
    candidateFingerprint: extra?.candidateFingerprint,
  });
}

function readLiveCaptureSources(): string {
  const dir = "lib/debug/calibration/prospective/live-capture";
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

describe("Sprint 5C.5A — live capture integration (offline)", () => {
  it("keeps frozen fingerprints, protocol season unverified, and candidate/production/capture files unchanged", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(FROZEN_CANDIDATE);
    expect(LIVE_PROTOCOL_FINGERPRINT).toBe(FROZEN_PROTOCOL);
    expect(LIVE_PROTOCOL_CONFIG.prospectiveSeason).toBe(PROSPECTIVE_SEASON_UNVERIFIED);
    expect(ACCEPTED_PROSPECTIVE_SEASON).toBe("2026");
    expect(LIVE_CAPTURE_OPERATIONAL_FACTS.acceptedProspectiveSeason).toBe("2026");
    expect(LIVE_CAPTURE_OPERATIONAL_FACTS.authorizedLiveCapture).toBe(false);
    expect(LIVE_CAPTURE_DEFAULT_DRY_RUN).toBe(true);
    expect(LIVE_CAPTURE_PHASE).toBe("OFFLINE_ORCHESTRATION_ONLY");
    expect(LIVE_CAPTURE_WINDOW.earliestCaptureMinutesBeforeKickoff).toBe(75);
    expect(LIVE_CAPTURE_WINDOW.latestCaptureMinutesBeforeKickoff).toBe(45);
    expect([...PROSPECTIVE_CANDIDATE_IDS]).toEqual([
      "CONTROL_PRODUCTION",
      "CANDIDATE_A_INPUT",
      "CANDIDATE_B_TRANSFORM",
      "CANDIDATE_C_COMBINED",
      "CANDIDATE_D_COMBINED_HIGH_EQUAL",
    ]);
    expect(execSync(`git diff --name-only HEAD -- ${FROZEN_CANDIDATE_FILES.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${PROTOCOL_FILES.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${CAPTURE_FILES.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
    expect(execSync(`git diff --name-only HEAD -- ${PRODUCTION_PATHS.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
  });

  it("contains no provider transport, fetch, API keys, or ranking", () => {
    const source = readLiveCaptureSources();
    expect(source).not.toMatch(/fetch\(|axios|x-apisports-key|API_FOOTBALL_KEY|\/api\/fixtures|\/api\/odds/i);
    expect(source).not.toMatch(/createLiveDiscoveryTransport|discoverLiveFixtures|getFixtureOdds/);
    expect(source).not.toMatch(/rankCandidates|pickWinner|bestCandidate|expected value/);
  });

  it("captures the synthetic matrix at T-60 with five frozen arms, optional odds, and 5C.1 parity", () => {
    const result = run([
      SYNTHETIC.balanced,
      SYNTHETIC.strongHome,
      SYNTHETIC.strongAway,
      SYNTHETIC.sparse,
      SYNTHETIC.zero,
      SYNTHETIC.withOdds,
      SYNTHETIC.noOdds,
      SYNTHETIC.sameA,
      SYNTHETIC.sameB,
    ]);
    expect(result.dryRun).toBe(true);
    expect(result.authorizedLiveCapture).toBe(false);
    expect(result.prospectiveN).toBe(0);
    expect(result.acceptedFixtureCount).toBe(9);
    expect(result.recordCount).toBe(45);
    expect(result.capture?.persisted).toBeNull();
    expect(result.batch?.candidateFingerprint).toBe(FROZEN_CANDIDATE);
    expect(siblingMaySupplyEvidence(SYNTHETIC.sameA, SYNTHETIC.sameB)).toBe(false);

    for (const fixtureId of result.batch!.fixtureIds) {
      const records = result.batch!.records.filter((row) => row.fixtureId === fixtureId);
      expect(records).toHaveLength(5);
      assertExactCandidateIds(records);
      expect(records.every((row) => row.resultStatus === "PENDING")).toBe(true);
      expect(records.every((row) => row.finalHomeGoals === null && row.finalAwayGoals === null && row.scoredAt === null)).toBe(true);
    }

    const odds = result.batch!.records.filter((row) => row.fixtureId === "syn-odds");
    expect(odds.every((row) => row.odds?.home === 2.1)).toBe(true);
    const noOdds = result.batch!.records.filter((row) => row.fixtureId === "syn-no-odds");
    expect(noOdds.every((row) => row.odds === null)).toBe(true);

    const snapshot = result.batch!.evidenceSnapshots.find((row) => row.fixtureId === "syn-balanced")!;
    const evidence = evidenceFromSnapshot(toProspectiveFixtureInput(SYNTHETIC.balanced), snapshot);
    for (const record of result.batch!.records.filter((row) => row.fixtureId === "syn-balanced")) {
      const direct = predictCandidate(record.candidateId, evidence);
      expect(record.probHome).toBe(direct.oneXTwo.home);
      expect(record.probDraw).toBe(direct.oneXTwo.draw);
      expect(record.probAway).toBe(direct.oneXTwo.away);
      expect(record.lambdaHome).toBe(direct.lambdaHome);
      expect(record.homeElo).toBe(direct.homeElo);
    }
  });

  it("accepts T-75 and T-45 and rejects T-80, T-44, kickoff, and post-kickoff", () => {
    expect(run([fixture({ fixtureId: "t75" })], { minutes: 75 }).acceptedFixtureCount).toBe(1);
    expect(run([fixture({ fixtureId: "t60" })], { minutes: 60 }).acceptedFixtureCount).toBe(1);
    expect(run([fixture({ fixtureId: "t45" })], { minutes: 45 }).acceptedFixtureCount).toBe(1);
    expect(() => run([fixture({ fixtureId: "t80" })], { minutes: 80 })).toThrow(/TOO_EARLY/);
    expect(() => run([fixture({ fixtureId: "t44" })], { minutes: 44 })).toThrow(/MISSED_WINDOW/);
    expect(() => run([fixture({ fixtureId: "kick" })], { minutes: 0 })).toThrow(/MISSED_WINDOW|before kickoff/);
    expect(() => run([fixture({ fixtureId: "post" })], { minutes: -5 })).toThrow(/MISSED_WINDOW|before kickoff/);
  });

  it("rejects league, season, status, evidence, odds, leakage, duplicate, and fingerprint failures", () => {
    expect(() => run([fixture({ fixtureId: "lg", competitionId: "40" })])).toThrow(/INTEGRITY_REJECTED|not Premier League/);
    expect(() => run([fixture({ fixtureId: "s2099", season: "2099" })])).toThrow(/season/);
    expect(() => run([fixture({ fixtureId: "s2025", season: "2025" })])).toThrow(/2025|USED|INTEGRITY_REJECTED/);
    expect(() => run([fixture({ fixtureId: "live", status: "LIVE" })])).toThrow(/INELIGIBLE_STATUS/);
    expect(() => run([fixture({ fixtureId: "ft", status: "FT" })])).toThrow(/INELIGIBLE_STATUS|FT/);
    expect(() =>
      run([fixture({ fixtureId: "future-ev", evidenceAsOf: atMinutesBefore(30) })], { minutes: 60 }),
    ).toThrow(/evidenceAsOf/);
    expect(() =>
      run([fixture({ fixtureId: "post-ev", evidenceAsOf: "2099-08-17T16:00:00.000Z" })]),
    ).toThrow(/evidence/);
    expect(() =>
      run([
        fixture({
          fixtureId: "late-odds",
          oddsSnapshot: {
            capturedAt: atMinutesBefore(30),
            source: "SyntheticBook",
            home: 2.1,
            draw: 3.4,
            away: 3.6,
          },
        }),
      ]),
    ).toThrow(/oddsCapturedAt/);
    expect(() => run([{ ...SYNTHETIC.balanced, homeGoals: 2 } as LiveCaptureFixtureInput & { homeGoals: number }])).toThrow(
      /outcome field/,
    );
    expect(() => run([SYNTHETIC.balanced, { ...SYNTHETIC.sparse, fixtureId: "syn-balanced" }])).toThrow(/duplicate fixture/);
    expect(() =>
      run([SYNTHETIC.balanced], {
        priorIndex: {
          entries: [{ fixtureId: "syn-balanced", candidateFingerprint: FROZEN_CANDIDATE, batchId: "prior" }],
        },
      }),
    ).toThrow(/already captured|DUPLICATE/);
    expect(() => run([SYNTHETIC.balanced], { candidateFingerprint: "0".repeat(64) })).toThrow(/wrong candidate fingerprint/);

    const good = run([SYNTHETIC.balanced]);
    expect(() =>
      assertExactCandidateIds(good.batch!.records.slice(0, 4)),
    ).toThrow(/exactly five/);
    const tamperedRecords: ProspectiveCaptureBatch = {
      ...good.batch!,
      records: good.batch!.records.map((row, index) =>
        index === 0 ? { ...row, probHome: row.probHome + 0.01 } : row,
      ),
    };
    expect(hashRecords(tamperedRecords.records)).not.toBe(good.batch!.recordsHash);
    expect(() => verifyBatchHashes(tamperedRecords)).toThrow(/recordsHash/);
    const tamperedEvidence: ProspectiveCaptureBatch = {
      ...good.batch!,
      evidenceSnapshots: good.batch!.evidenceSnapshots.map((row, index) =>
        index === 0 ? { ...row, home: { ...row.home, goalsFor: row.home.goalsFor + 1 } } : row,
      ),
    };
    expect(hashEvidenceManifest(tamperedEvidence.evidenceSnapshots)).not.toBe(good.batch!.evidenceManifestHash);
    expect(() => verifyBatchHashes(tamperedEvidence)).toThrow(/evidenceManifestHash/);
    expect(() =>
      assertCaptureBatchIntegrity({
        ...good.batch!,
        candidateFingerprint: "0".repeat(64),
      }),
    ).toThrow(/fingerprint/);
  });

  it("fails atomically when a candidate arm fails and never writes a partial batch", () => {
    const root = tempRoot();
    expect(() =>
      run([SYNTHETIC.balanced], {
        persistRoot: root,
        dryRun: false,
        simulateCandidateFailure: true,
      }),
    ).toThrow(/simulated candidate failure/);
    expect(existsSync(pendingDirectory(root))).toBe(false);
    expect(countPrimarySampleN([])).toBe(0);

    expect(() =>
      run([SYNTHETIC.sparse], {
        persistRoot: root,
        dryRun: false,
        captureImpl: () => {
          throw new Error("candidate arm failed");
        },
      }),
    ).toThrow(/candidate arm failed/);
    expect(readdirSync(root)).toEqual([]);
  });

  it("defaults to dry-run, persists only into an explicit temp root, and reports mechanical readiness", () => {
    const root = tempRoot();
    const dry = run([SYNTHETIC.balanced], { persistRoot: root });
    expect(dry.dryRun).toBe(true);
    expect(dry.capture?.persisted).toBeNull();
    expect(existsSync(pendingDirectory(root))).toBe(false);
    expect(existsSync(join(process.cwd(), "data/prospective/pending"))).toBe(false);

    const written = run([SYNTHETIC.withOdds], { persistRoot: root, dryRun: false });
    expect(written.dryRun).toBe(false);
    expect(written.prospectiveN).toBe(0);
    expect(written.capture?.persisted?.path).toContain(join("pending", `${written.batch!.batchId}.json`));
    expect(existsSync(written.capture!.persisted!.path)).toBe(true);
    assertLiveCaptureBatchIntegrity(written.batch!);

    const ready = reportLiveCaptureReadiness({
      fixtures: [SYNTHETIC.balanced, fixture({ fixtureId: "early" })],
      clock: createFixedClock(atMinutesBefore(60)),
      capturedAt: atMinutesBefore(60),
    });
    expect(ready.map((row) => row.protocolClassification).sort()).toEqual(["IN_WINDOW", "IN_WINDOW"]);
    const earlyReady = reportLiveCaptureReadiness({
      fixtures: [fixture({ fixtureId: "too-early" })],
      clock: createFixedClock(atMinutesBefore(80)),
      capturedAt: atMinutesBefore(80),
    });
    expect(earlyReady[0]?.protocolClassification).toBe("TOO_EARLY");
    expect(earlyReady[0]?.captureEligible).toBe(false);
    expect(earlyReady[0]?.fiveArmReady).toBe(false);
    const source = readLiveCaptureSources();
    expect(source).not.toMatch(/highest probability|best odds|value bet/i);
  });
});
