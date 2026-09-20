/**
 * Sprint 5C.6 — offline prospective scoring infrastructure.
 * Synthetic pending batches and outcomes only. Zero provider calls.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AET_PEN_GOAL_POLICY,
  CANDIDATE_MANIFEST_FINGERPRINT,
  LIVE_PROTOCOL_FINGERPRINT,
  LOG_LOSS_EPS,
  PROSPECTIVE_CANDIDATE_IDS,
  ScoringRejectedError,
  ZERO_SCORING_PROVIDER_CALLS,
  brierOneXTwo,
  countCapturedProspectiveN,
  countScoredProspectiveN,
  createFixedClock,
  createSyntheticOutcomeSource,
  deriveObservedClass,
  hashCandidateScores,
  hashOutcome,
  logLossOneXTwo,
  scoreProspectiveBatch,
  scoredDirectory,
  verifyBatchHashes,
  verifyScoredHashes,
} from "@/lib/debug/calibration";
import { captureProspectiveBatch } from "@/lib/debug/calibration/prospective/capture/capture-runner";
import type { ProspectiveCaptureBatch, ProspectiveFixtureInput, TeamEvidenceCounts } from "@/lib/debug/calibration/prospective/capture/capture-types";
import type { ProspectiveFinalOutcome } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import { persistScoredArtifact, scoredArtifactPath } from "@/lib/debug/calibration/prospective/scoring/scoring-persist";

const FROZEN_CANDIDATE = "7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c";
const FROZEN_PROTOCOL = "825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9";
const KICKOFF = "2099-08-17T15:00:00.000Z";
const CAPTURED_AT = "2099-08-17T14:00:00.000Z";
const SCORED_AT = "2099-08-17T17:00:00.000Z";

const FROZEN_PATHS = [
  "lib/debug/calibration/prospective/candidate-config.ts",
  "lib/debug/calibration/prospective/capture",
  "lib/debug/calibration/prospective/protocol",
  "lib/debug/calibration/prospective/live",
  "lib/debug/calibration/prospective/live-capture",
  "lib/debug/calibration/prospective/live-execution",
  "lib/intelligence/modules/probability",
];

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "apex-5c6-"));
  tempRoots.push(root);
  return root;
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

function fixture(partial: Partial<ProspectiveFixtureInput> & Pick<ProspectiveFixtureInput, "fixtureId">): ProspectiveFixtureInput {
  const homeTeamId = partial.homeTeamId ?? "home-syn";
  const awayTeamId = partial.awayTeamId ?? "away-syn";
  return {
    competitionId: "39",
    season: "2026",
    kickoff: KICKOFF,
    homeTeamId,
    awayTeamId,
    homeTeamName: "Synthetic Home",
    awayTeamName: "Synthetic Away",
    evidenceAsOf: "2099-08-17T13:30:00.000Z",
    preMatchEvidence: {
      home: team({ teamId: homeTeamId, matchesPlayed: 8, wins: 4, draws: 2, losses: 2, goalsFor: 12, goalsAgainst: 8 }),
      away: team({ teamId: awayTeamId, matchesPlayed: 8, wins: 3, draws: 3, losses: 2, goalsFor: 9, goalsAgainst: 9 }),
    },
    ...partial,
    fixtureId: partial.fixtureId,
  };
}

function persistPending(id = "syn-score"): { root: string; batch: ProspectiveCaptureBatch; path: string } {
  const root = tempRoot();
  const captured = captureProspectiveBatch([fixture({ fixtureId: id })], {
    clock: createFixedClock(CAPTURED_AT),
    capturedAt: CAPTURED_AT,
    createdAt: CAPTURED_AT,
    dryRun: false,
    persistRoot: root,
  });
  if (!captured.persisted) {
    throw new Error("expected pending persist in temp root");
  }
  return { root, batch: captured.batch, path: captured.persisted.path };
}

function outcome(partial: Partial<ProspectiveFinalOutcome> & Pick<ProspectiveFinalOutcome, "fixtureId" | "homeGoals" | "awayGoals">): ProspectiveFinalOutcome {
  return {
    competitionId: "39",
    season: "2026",
    kickoffUtc: KICKOFF,
    finalStatus: "FT",
    outcomeCapturedAt: SCORED_AT,
    provenance: "synthetic",
    ...partial,
  };
}

function score(
  pending: { root: string; batch: ProspectiveCaptureBatch; path: string },
  result: ProspectiveFinalOutcome,
  extra?: Partial<Parameters<typeof scoreProspectiveBatch>[0]>,
) {
  return scoreProspectiveBatch({
    pendingBatch: pending.batch,
    pendingPath: pending.path,
    outcome: result,
    clock: createFixedClock(SCORED_AT),
    scoredAt: SCORED_AT,
    persistRoot: pending.root,
    persist: extra?.persist ?? true,
    transport: extra?.transport,
    simulateScoringFailure: extra?.simulateScoringFailure,
    simulatePersistenceFailure: extra?.simulatePersistenceFailure,
  });
}

function expectRejected(fn: () => unknown, pattern: RegExp): ScoringRejectedError {
  try {
    fn();
    throw new Error("expected rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(ScoringRejectedError);
    expect((error as Error).message).toMatch(pattern);
    return error as ScoringRejectedError;
  }
}

function readScoringSources(): string {
  const dir = "lib/debug/calibration/prospective/scoring";
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

describe("Sprint 5C.6 — prospective scoring (offline)", () => {
  it("keeps frozen fingerprints, metric conventions, and frozen files unchanged", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(FROZEN_CANDIDATE);
    expect(LIVE_PROTOCOL_FINGERPRINT).toBe(FROZEN_PROTOCOL);
    expect(AET_PEN_GOAL_POLICY).toBe("90_PLUS_ET_GOALS_NOT_SHOOTOUT");
    expect(LOG_LOSS_EPS).toBe(1e-15);
    expect(execSync(`git diff --name-only HEAD -- ${FROZEN_PATHS.join(" ")}`, { encoding: "utf8" }).trim()).toBe("");
  });

  it("1–16: HOME/DRAW/AWAY scoring preserves probabilities and matches 5B arithmetic", () => {
    const pending = persistPending("syn-home");
    const home = score(pending, outcome({ fixtureId: "syn-home", homeGoals: 2, awayGoals: 0 }));
    expect(home.artifact?.observedClass).toBe("HOME");
    expect(deriveObservedClass(2, 0)).toBe("HOME");
    expect(home.artifact?.candidateFingerprint).toBe(FROZEN_CANDIDATE);
    expect(home.artifact?.candidateScores).toHaveLength(5);
    expect(home.artifact?.candidateScores.map((row) => row.candidateId)).toEqual([...PROSPECTIVE_CANDIDATE_IDS]);
    verifyBatchHashes(pending.batch);
    verifyScoredHashes(home.artifact!);
    for (const row of home.artifact!.candidateScores) {
      const source = pending.batch.records.find((record) => record.candidateId === row.candidateId)!;
      expect(row.homeProbability).toBe(source.probHome);
      expect(row.drawProbability).toBe(source.probDraw);
      expect(row.awayProbability).toBe(source.probAway);
      expect(row.confidence).toBe(source.confidence);
      expect(row.logLossContribution).toBe(logLossOneXTwo({
        home: source.probHome,
        draw: source.probDraw,
        away: source.probAway,
      }, "home"));
      expect(row.brierContribution).toBe(brierOneXTwo({
        home: source.probHome,
        draw: source.probDraw,
        away: source.probAway,
      }, "home"));
      expect(row.isCorrect).toBe(row.predictedClass === "HOME");
    }
    expect(home.report.probabilitiesUnchanged).toBe(true);
    expect(home.report.providerCallAccounting).toEqual(ZERO_SCORING_PROVIDER_CALLS);

    const drawPending = persistPending("syn-draw");
    const draw = score(drawPending, outcome({ fixtureId: "syn-draw", homeGoals: 1, awayGoals: 1 }));
    expect(draw.artifact?.observedClass).toBe("DRAW");
    expect(draw.artifact?.candidateScores[0]?.logLossContribution).toBe(
      logLossOneXTwo({
        home: drawPending.batch.records[0]!.probHome,
        draw: drawPending.batch.records[0]!.probDraw,
        away: drawPending.batch.records[0]!.probAway,
      }, "draw"),
    );

    const awayPending = persistPending("syn-away");
    const away = score(awayPending, outcome({ fixtureId: "syn-away", homeGoals: 0, awayGoals: 3 }));
    expect(away.artifact?.observedClass).toBe("AWAY");
    expect(logLossOneXTwo({ home: 0, draw: 0, away: 1 }, "home")).toBe(-Math.log(LOG_LOSS_EPS));
  });

  it("17–19, 44–46: pending bytes stay identical; temp scored file; N semantics", () => {
    const pending = persistPending("syn-n");
    const before = readFileSync(pending.path);
    expect(countCapturedProspectiveN(pending.root)).toBe(1);
    expect(countScoredProspectiveN(pending.root)).toBe(0);
    const result = score(pending, outcome({ fixtureId: "syn-n", homeGoals: 2, awayGoals: 1 }));
    expect(readFileSync(pending.path).equals(before)).toBe(true);
    expect(result.pendingBytesUnchanged).toBe(true);
    expect(existsSync(scoredArtifactPath(pending.root, pending.batch.batchId, "syn-n"))).toBe(true);
    expect(existsSync(join(process.cwd(), "data/prospective/pending"))).toBe(false);
    expect(existsSync(join(process.cwd(), "data/prospective/scored"))).toBe(false);
    expect(result.report.capturedNBefore).toBe(1);
    expect(result.report.capturedNAfter).toBe(1);
    expect(result.report.scoredNBefore).toBe(0);
    expect(result.report.scoredNAfter).toBe(1);
    expect(result.report.candidateCount).toBe(5);
    expect(countCapturedProspectiveN(pending.root)).toBe(1);
    expect(countScoredProspectiveN(pending.root)).toBe(1);
  });

  it("20–33: eligibility rejects mismatches, time, goals, fingerprint, hash, and arm errors", () => {
    const pending = persistPending("syn-guard");
    const before = readFileSync(pending.path);
    const base = outcome({ fixtureId: "syn-guard", homeGoals: 1, awayGoals: 0 });
    expectRejected(() => score(pending, { ...base, fixtureId: "other" }), /fixtureId mismatch/);
    expectRejected(() => score(pending, { ...base, competitionId: "40" }), /competition mismatch/);
    expectRejected(() => score(pending, { ...base, season: "2027" }), /season mismatch/);
    expectRejected(
      () => scoreProspectiveBatch({
        pendingBatch: pending.batch,
        pendingPath: pending.path,
        outcome: base,
        clock: createFixedClock(KICKOFF),
        scoredAt: "2099-08-17T14:00:00.000Z",
        persistRoot: pending.root,
        persist: true,
      }),
      /future fixture/,
    );
    expectRejected(
      () => scoreProspectiveBatch({
        pendingBatch: pending.batch,
        pendingPath: pending.path,
        outcome: base,
        clock: createFixedClock(KICKOFF),
        scoredAt: KICKOFF,
        persistRoot: pending.root,
        persist: true,
      }),
      /scoring at kickoff/,
    );
    expectRejected(() => score(pending, { ...base, finalStatus: "LIVE" as ProspectiveFinalOutcome["finalStatus"] }), /non-final status/);
    expectRejected(() => score(pending, { ...base, homeGoals: -1 }), /negative goals/);
    expectRejected(() => score(pending, { ...base, homeGoals: 1.5 }), /integers|fractional/);
    expectRejected(() => score(pending, { ...base, homeGoals: Number.NaN }), /integers|malformed/);
    expectRejected(
      () => score({ ...pending, batch: { ...pending.batch, candidateFingerprint: "0".repeat(64) } }, base),
      /fingerprint/,
    );
    expectRejected(
      () => score({ ...pending, batch: { ...pending.batch, recordsHash: "deadbeef" } }, base),
      /tampered pending hash/,
    );
    expectRejected(
      () => score({ ...pending, batch: { ...pending.batch, records: pending.batch.records.slice(0, 4) } }, base),
      /fewer than five/,
    );
    const dup = pending.batch.records.map((row, index) =>
      index === 1 ? { ...row, candidateId: pending.batch.records[0]!.candidateId } : row,
    );
    expectRejected(() => score({ ...pending, batch: { ...pending.batch, records: dup } }, base), /duplicate candidate/);
    const unknown = pending.batch.records.map((row, index) =>
      index === 0 ? { ...row, candidateId: "NOT_A_CANDIDATE" as typeof row.candidateId } : row,
    );
    expectRejected(() => score({ ...pending, batch: { ...pending.batch, records: unknown } }, base), /unknown candidate/);
    expect(readFileSync(pending.path).equals(before)).toBe(true);
    expect(countScoredProspectiveN(pending.root)).toBe(0);
  });

  it("34–38, 52: failures persist nothing and leave pending bytes unchanged", () => {
    const pending = persistPending("syn-fail");
    const before = readFileSync(pending.path);
    const result = outcome({ fixtureId: "syn-fail", homeGoals: 2, awayGoals: 0 });
    expectRejected(
      () => score(pending, result, { simulateScoringFailure: true }),
      /simulated scoring failure/,
    );
    expect(existsSync(scoredDirectory(pending.root)) ? readdirSync(scoredDirectory(pending.root)) : []).toEqual([]);
    expectRejected(
      () => score(pending, result, { simulatePersistenceFailure: true }),
      /persist failure/,
    );
    const leftover = existsSync(scoredDirectory(pending.root))
      ? readdirSync(scoredDirectory(pending.root))
      : [];
    expect(leftover.filter((name) => !name.includes(".tmp"))).toEqual([]);
    expect(leftover.some((name) => name.endsWith(".tmp"))).toBe(false);
    expect(readFileSync(pending.path).equals(before)).toBe(true);

    const written = score(pending, result);
    expectRejected(() => score(pending, result), /already scored/);
    expect(countScoredProspectiveN(pending.root)).toBe(1);
    expectRejected(
      () => persistScoredArtifact({ artifact: written.artifact!, persistRoot: pending.root }),
      /already scored|overwrite/,
    );
    expect(readFileSync(pending.path).equals(before)).toBe(true);
  });

  it("39–43: scored hashes are deterministic, order-safe, and detect mutation", () => {
    const pending = persistPending("syn-hash");
    const first = score(pending, outcome({ fixtureId: "syn-hash", homeGoals: 3, awayGoals: 1 }), { persist: false });
    const second = score(pending, outcome({ fixtureId: "syn-hash", homeGoals: 3, awayGoals: 1 }), { persist: false });
    expect(first.artifact!.scoredArtifactHash).toBe(second.artifact!.scoredArtifactHash);
    expect(hashCandidateScores(first.artifact!.candidateScores)).toBe(
      hashCandidateScores([...first.artifact!.candidateScores].reverse()),
    );
    const mutatedOutcome = hashOutcome({
      ...outcome({ fixtureId: "syn-hash", homeGoals: 0, awayGoals: 1 }),
    });
    expect(mutatedOutcome).not.toBe(first.artifact!.outcomeHash);
    const mutatedScores = first.artifact!.candidateScores.map((row, index) =>
      index === 0 ? { ...row, logLossContribution: row.logLossContribution + 0.01 } : row,
    );
    expect(hashCandidateScores(mutatedScores)).not.toBe(first.artifact!.candidateScoresHash);
    expect(() => verifyScoredHashes({ ...first.artifact!, scoredArtifactHash: "nope" })).toThrow(/scoredArtifactHash/);
  });

  it("47–51: no selection logic, no live transport, provider accounting stays zero", () => {
    const source = readScoringSources();
    expect(source).not.toMatch(/API_FOOTBALL_KEY|x-apisports-key|v3\.football\.api-sports\.io|fetch\s*\(|axios|createLiveDiscoveryTransport/);
    expect(source).not.toMatch(/rankCandidates|pickWinner|promoteCandidate|stakeSize|bet recommendation|expected value/);
    expect(source).toMatch(/kind: "synthetic"/);
    const pending = persistPending("syn-transport");
    const transport = createSyntheticOutcomeSource([outcome({ fixtureId: "syn-transport", homeGoals: 1, awayGoals: 0 })]);
    const result = score(pending, outcome({ fixtureId: "syn-transport", homeGoals: 1, awayGoals: 0 }), { transport, persist: false });
    expect(result.report.providerCallAccounting).toEqual({
      discoveryCalls: 0,
      evidenceCalls: 0,
      oddsCalls: 0,
      outcomeCalls: 0,
      totalCalls: 0,
    });
    expect(JSON.stringify(result.report)).not.toMatch(/winner|best model|stake|bet recommendation/i);
  });
});
