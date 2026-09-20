/**
 * Sprint 5C.7 — offline prospective evaluation and reporting.
 * Synthetic scored artifacts only. Zero provider calls. No real pending/scored reads.
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_MANIFEST_FINGERPRINT,
  EVALUATION_DEFAULT_MODE,
  EVALUATION_ECE_BIN_COUNT,
  EvaluationRejectedError,
  LIVE_PROTOCOL_FINGERPRINT,
  PROSPECTIVE_CANDIDATE_IDS,
  PROSPECTIVE_EVALUATION_PHASE,
  brierOneXTwo,
  evaluateProspectiveScores,
  evaluationCheckpointState,
  inspectScoredArtifact,
  logLossOneXTwo,
} from "@/lib/debug/calibration";
import { CALIBRATION_BIN_COUNT } from "@/lib/debug/calibration/metrics";
import { PROSPECTIVE_CANDIDATE_VERSION } from "@/lib/debug/calibration/prospective/candidate-types";
import type { ProspectiveCandidateId } from "@/lib/debug/calibration/prospective/candidate-types";
import type { ProspectivePredictionRecord } from "@/lib/debug/calibration/prospective/candidate-types";
import {
  hashCandidateScores,
  hashOutcome,
  hashScoredArtifact,
  sortCandidateScores,
} from "@/lib/debug/calibration/prospective/scoring/scoring-hash";
import { scoreCandidateObservation } from "@/lib/debug/calibration/prospective/scoring/scoring-metrics";
import { toCalibrationOutcome } from "@/lib/debug/calibration/prospective/scoring/scoring-outcome";
import { PROSPECTIVE_SCORING_VERSION } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import type {
  CandidateScoreRow,
  ObservedClass,
  ProspectiveScoredArtifact,
} from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import type { ProspectiveEvaluationReport } from "@/lib/debug/calibration/prospective/evaluation/evaluation-types";

const FROZEN_CANDIDATE = "7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c";
const FROZEN_PROTOCOL = "825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9";
const KICKOFF = "2099-08-17T15:00:00.000Z";
const SCORED_AT = "2099-08-17T17:00:00.000Z";

const FROZEN_PATHS = [
  "lib/debug/calibration/prospective/candidate-config.ts",
  "lib/debug/calibration/prospective/candidate-input.ts",
  "lib/debug/calibration/prospective/candidate-transform.ts",
  "lib/debug/calibration/prospective/candidate-high-equal.ts",
  "lib/debug/calibration/prospective/candidate-engine.ts",
  "lib/debug/calibration/prospective/capture",
  "lib/debug/calibration/prospective/protocol",
  "lib/debug/calibration/prospective/live",
  "lib/debug/calibration/prospective/live-capture",
  "lib/debug/calibration/prospective/live-execution",
  "lib/debug/calibration/prospective/live-capture-bridge",
  "lib/debug/calibration/prospective/scoring",
  "lib/intelligence/modules/probability",
  "lib/auth",
  "lib/supabase/proxy.ts",
  "lib/supabase/auth-errors.ts",
];

const FORBIDDEN_REPORT = /winner|ranking|promotion|recommendedCandidate|leaderboard|stake|roi|kelly|bankroll|yield|expected value|bet recommendation/i;

const DEFAULT_PROBS: Record<ProspectiveCandidateId, { home: number; draw: number; away: number }> = {
  CONTROL_PRODUCTION: { home: 0.2, draw: 0.2, away: 0.6 },
  CANDIDATE_A_INPUT: { home: 0.34, draw: 0.33, away: 0.33 },
  CANDIDATE_B_TRANSFORM: { home: 0.5, draw: 0.25, away: 0.25 },
  CANDIDATE_C_COMBINED: { home: 0.7, draw: 0.2, away: 0.1 },
  CANDIDATE_D_COMBINED_HIGH_EQUAL: { home: 0.9, draw: 0.05, away: 0.05 },
};

function gitDiff(paths: string[]): string {
  return execSync(`git diff --name-only HEAD -- ${paths.join(" ")}`, { encoding: "utf8" }).trim();
}

function readEvaluationSources(): string {
  const dir = "lib/debug/calibration/prospective/evaluation";
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

function goalsFor(observed: ObservedClass): { home: number; away: number } {
  if (observed === "HOME") return { home: 2, away: 1 };
  if (observed === "AWAY") return { home: 0, away: 1 };
  return { home: 1, away: 1 };
}

function dummyRecord(
  fixtureId: string,
  candidateId: ProspectiveCandidateId,
  probs: { home: number; draw: number; away: number },
  kickoffUtc: string,
): ProspectivePredictionRecord {
  return {
    fixtureId,
    competitionId: "39",
    season: "2026",
    kickoff: kickoffUtc,
    capturedAt: SCORED_AT,
    modelVersion: "synthetic-eval",
    candidateId,
    candidateVersion: PROSPECTIVE_CANDIDATE_VERSION,
    candidateFingerprint: CANDIDATE_MANIFEST_FINGERPRINT,
    inputEvidenceCounts: { homePlayedBefore: 8, awayPlayedBefore: 8 },
    homeElo: 1500,
    awayElo: 1500,
    eloGap: 0,
    lambdaHome: 1.2,
    lambdaAway: 1.1,
    probHome: probs.home,
    probDraw: probs.draw,
    probAway: probs.away,
    confidence: Math.max(probs.home, probs.draw, probs.away),
    odds: null,
    marketImpliedProbabilities: null,
    resultStatus: "PENDING",
    finalHomeGoals: null,
    finalAwayGoals: null,
    scoredAt: null,
  };
}

function seal(
  partial: Omit<ProspectiveScoredArtifact, "outcomeHash" | "candidateScoresHash" | "scoredArtifactHash">,
): ProspectiveScoredArtifact {
  const candidateScores = sortCandidateScores(partial.candidateScores);
  const outcomeHash = hashOutcome({
    fixtureId: partial.fixtureId,
    competitionId: partial.competitionId,
    season: partial.season,
    kickoffUtc: partial.kickoffUtc,
    finalStatus: partial.finalStatus,
    homeGoals: partial.homeGoals,
    awayGoals: partial.awayGoals,
    outcomeCapturedAt: partial.outcomeCapturedAt,
    provenance: "synthetic",
  });
  const candidateScoresHash = hashCandidateScores(candidateScores);
  const material = { ...partial, candidateScores, outcomeHash, candidateScoresHash };
  return { ...material, scoredArtifactHash: hashScoredArtifact(material) };
}

function syntheticArtifact(input: {
  fixtureId: string;
  observed?: ObservedClass;
  scoredAt?: string;
  kickoffUtc?: string;
  probs?: Partial<Record<ProspectiveCandidateId, { home: number; draw: number; away: number }>>;
  fingerprint?: string;
  mutate?: (artifact: ProspectiveScoredArtifact) => ProspectiveScoredArtifact;
  reseal?: boolean;
}): ProspectiveScoredArtifact {
  const observed = input.observed ?? "HOME";
  const kickoffUtc = input.kickoffUtc ?? KICKOFF;
  const scoredAt = input.scoredAt ?? SCORED_AT;
  const { home, away } = goalsFor(observed);
  const candidateScores: CandidateScoreRow[] = PROSPECTIVE_CANDIDATE_IDS.map((candidateId) => {
    const probs = input.probs?.[candidateId] ?? DEFAULT_PROBS[candidateId];
    return scoreCandidateObservation(dummyRecord(input.fixtureId, candidateId, probs, kickoffUtc), observed);
  });
  const artifact = seal({
    scoringVersion: PROSPECTIVE_SCORING_VERSION,
    scoredAt,
    sourceBatchId: `batch-${input.fixtureId}`,
    sourceBatchHash: "11".repeat(32),
    sourceRecordsHash: "22".repeat(32),
    sourceEvidenceManifestHash: "33".repeat(32),
    candidateFingerprint: input.fingerprint ?? CANDIDATE_MANIFEST_FINGERPRINT,
    fixtureId: input.fixtureId,
    competitionId: "39",
    season: "2026",
    kickoffUtc,
    finalStatus: "FT",
    homeGoals: home,
    awayGoals: away,
    observedClass: observed,
    outcomeCapturedAt: scoredAt,
    candidateScores,
  });
  if (!input.mutate) return artifact;
  const mutated = input.mutate(artifact);
  if (input.reseal === false) return mutated;
  return seal({
    scoringVersion: mutated.scoringVersion,
    scoredAt: mutated.scoredAt,
    sourceBatchId: mutated.sourceBatchId,
    sourceBatchHash: mutated.sourceBatchHash,
    sourceRecordsHash: mutated.sourceRecordsHash,
    sourceEvidenceManifestHash: mutated.sourceEvidenceManifestHash,
    candidateFingerprint: mutated.candidateFingerprint,
    fixtureId: mutated.fixtureId,
    competitionId: mutated.competitionId,
    season: mutated.season,
    kickoffUtc: mutated.kickoffUtc,
    finalStatus: mutated.finalStatus,
    homeGoals: mutated.homeGoals,
    awayGoals: mutated.awayGoals,
    observedClass: mutated.observedClass,
    outcomeCapturedAt: mutated.outcomeCapturedAt,
    candidateScores: mutated.candidateScores,
  });
}

function many(n: number, start = 0): ProspectiveScoredArtifact[] {
  return Array.from({ length: n }, (_, index) => {
    const i = start + index;
    const observed: ObservedClass = (["HOME", "DRAW", "AWAY"] as const)[i % 3]!;
    return syntheticArtifact({
      fixtureId: `fx-${String(i).padStart(4, "0")}`,
      observed,
      scoredAt: `2099-08-17T${String(17 + (i % 6)).padStart(2, "0")}:00:00.000Z`,
      kickoffUtc: `2099-08-${String(10 + (i % 18)).padStart(2, "0")}T15:00:00.000Z`,
    });
  });
}

function expectRejected(fn: () => unknown): EvaluationRejectedError {
  try {
    fn();
    throw new Error("expected evaluation rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(EvaluationRejectedError);
    return error as EvaluationRejectedError;
  }
}

function assertFiniteReport(report: ProspectiveEvaluationReport): void {
  const walk = (value: unknown): void => {
    if (typeof value === "number") {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(report);
}

function json(report: ProspectiveEvaluationReport): string {
  return JSON.stringify(report);
}

describe("Sprint 5C.7 — prospective evaluation (offline)", () => {
  it("keeps frozen fingerprints, ECE convention, and frozen files unchanged", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(FROZEN_CANDIDATE);
    expect(LIVE_PROTOCOL_FINGERPRINT).toBe(FROZEN_PROTOCOL);
    expect(EVALUATION_ECE_BIN_COUNT).toBe(10);
    expect(CALIBRATION_BIN_COUNT).toBe(10);
    expect(EVALUATION_DEFAULT_MODE).toBe("STRICT");
    expect(gitDiff(FROZEN_PATHS)).toBe("");
  });

  it("1–9: N=0/1/99/100/249/250/499/500/>500 checkpoint states", () => {
    const empty = evaluateProspectiveScores({ artifacts: [] });
    expect(empty.report.evaluatedN).toBe(0);
    expect(empty.report.checkpointState).toBe("BELOW_FIRST_CHECKPOINT");
    expect(empty.report.integrityStatus).toBe("EMPTY");
    expect(empty.report.formalReviewAvailable).toBe(false);
    expect(empty.report.phase).toBe(PROSPECTIVE_EVALUATION_PHASE);
    assertFiniteReport(empty.report);

    const n1 = evaluateProspectiveScores({ artifacts: many(1) });
    expect(n1.report.evaluatedN).toBe(1);
    expect(n1.report.checkpointState).toBe("BELOW_FIRST_CHECKPOINT");
    expect(n1.report.formalReviewAvailable).toBe(false);
    assertFiniteReport(n1.report);

    expect(evaluateProspectiveScores({ artifacts: many(99) }).report.checkpointState).toBe("BELOW_FIRST_CHECKPOINT");
    expect(evaluateProspectiveScores({ artifacts: many(100) }).report.checkpointState).toBe("CHECKPOINT_100");
    expect(evaluateProspectiveScores({ artifacts: many(249) }).report.checkpointState).toBe("CHECKPOINT_100");
    expect(evaluateProspectiveScores({ artifacts: many(250) }).report.checkpointState).toBe("CHECKPOINT_250");
    expect(evaluateProspectiveScores({ artifacts: many(499) }).report.checkpointState).toBe("CHECKPOINT_250");
    expect(evaluateProspectiveScores({ artifacts: many(500) }).report.checkpointState).toBe("CHECKPOINT_500");
    expect(evaluateProspectiveScores({ artifacts: many(501) }).report.checkpointState).toBe("ABOVE_500");
    expect(evaluationCheckpointState(0)).toBe("BELOW_FIRST_CHECKPOINT");
    expect(evaluationCheckpointState(500)).toBe("CHECKPOINT_500");
    expect(evaluationCheckpointState(501)).toBe("ABOVE_500");
  });

  it("10–17: shared fixture sample, N=fixtures, frozen order, no ranking/promotion/betting fields", () => {
    const artifacts = [
      syntheticArtifact({ fixtureId: "b-late", observed: "AWAY" }),
      syntheticArtifact({ fixtureId: "a-early", observed: "HOME" }),
    ];
    const result = evaluateProspectiveScores({ artifacts });
    expect(result.report.evaluatedN).toBe(2);
    expect(result.report.fixtureCount).toBe(2);
    expect(result.report.candidateRowCount).toBe(10);
    expect(result.report.candidateAggregates.map((row) => row.candidateId)).toEqual([...PROSPECTIVE_CANDIDATE_IDS]);
    expect(new Set(result.report.candidateAggregates.map((row) => row.evaluatedN))).toEqual(new Set([2]));
    const ids = result.report.candidateAggregates.map((row) => row.candidateId);
    const byLoss = [...result.report.candidateAggregates].sort((left, right) => left.meanLogLoss - right.meanLogLoss);
    expect(ids).not.toEqual(byLoss.map((row) => row.candidateId));
    expect(ids[0]).toBe("CONTROL_PRODUCTION");
    expect(result.report).not.toHaveProperty("winner");
    expect(result.report).not.toHaveProperty("ranking");
    expect(result.report).not.toHaveProperty("promotion");
    expect(json(result.report)).not.toMatch(FORBIDDEN_REPORT);
    expect(result.observations).toHaveLength(10);
  });

  it("18–24: mean log loss, Brier, accuracy, confidence, and classwise HOME/DRAW/AWAY", () => {
    const artifacts = [
      syntheticArtifact({ fixtureId: "c-home", observed: "HOME" }),
      syntheticArtifact({ fixtureId: "c-draw", observed: "DRAW" }),
      syntheticArtifact({ fixtureId: "c-away", observed: "AWAY" }),
    ];
    const result = evaluateProspectiveScores({ artifacts });
    const ordered = [...artifacts].sort((left, right) => left.fixtureId.localeCompare(right.fixtureId));
    for (const candidateId of PROSPECTIVE_CANDIDATE_IDS) {
      const probs = DEFAULT_PROBS[candidateId];
      const predicted = { home: probs.home, draw: probs.draw, away: probs.away };
      const rows = ordered.map((artifact) => artifact.candidateScores.find((row) => row.candidateId === candidateId)!);
      for (const [index, row] of rows.entries()) {
        const actual = toCalibrationOutcome(ordered[index]!.observedClass);
        expect(row.logLossContribution).toBe(logLossOneXTwo(predicted, actual));
        expect(row.brierContribution).toBe(brierOneXTwo(predicted, actual));
      }
      const expectedLoss = rows.reduce((sum, row) => sum + row.logLossContribution, 0) / 3;
      const expectedBrier = rows.reduce((sum, row) => sum + row.brierContribution, 0) / 3;
      const expectedConfidence = rows.reduce((sum, row) => sum + row.confidence, 0) / 3;
      const aggregate = result.report.candidateAggregates.find((row) => row.candidateId === candidateId)!;
      expect(aggregate.meanLogLoss).toBe(expectedLoss);
      expect(aggregate.meanBrier).toBe(expectedBrier);
      expect(aggregate.meanConfidence).toBe(expectedConfidence);
      expect(aggregate.numberEvaluated).toBe(3);
      const argmax = probs.home >= probs.draw && probs.home >= probs.away
        ? "HOME"
        : probs.away >= probs.draw
          ? "AWAY"
          : "DRAW";
      const correct = ["HOME", "DRAW", "AWAY"].filter((observed) => observed === argmax).length;
      expect(aggregate.numberCorrect).toBe(correct);
      expect(aggregate.accuracy).toBe(correct / 3);

      for (const observedClass of ["HOME", "DRAW", "AWAY"] as const) {
        const row = result.report.classwiseCalibration.find(
          (item) => item.candidateId === candidateId && item.observedClass === observedClass,
        )!;
        expect(row.observationCount).toBe(1);
        expect(row.observedFrequency).toBe(1 / 3);
        const meanP = rows.reduce(
          (sum, item) => sum + item[`${observedClass.toLowerCase()}Probability` as "homeProbability" | "drawProbability" | "awayProbability"],
          0,
        ) / 3;
        expect(row.meanPredictedProbability).toBe(meanP);
        expect(row.absoluteCalibrationGap).toBe(Math.abs(meanP - 1 / 3));
      }
    }
  });

  it("25–30: ECE reuses frozen 10-bin convention, 1.0 enters last bin, empty is finite", () => {
    const sure = syntheticArtifact({
      fixtureId: "ece-1",
      observed: "HOME",
      probs: Object.fromEntries(
        PROSPECTIVE_CANDIDATE_IDS.map((id) => [id, { home: 1, draw: 0, away: 0 }]),
      ) as Record<ProspectiveCandidateId, { home: number; draw: number; away: number }>,
    });
    const scored = evaluateProspectiveScores({ artifacts: [sure] });
    for (const report of scored.report.eceReports) {
      expect(report.bins).toHaveLength(10);
      expect(report.bins[0]).toMatchObject({ index: 0, lower: 0, upper: 0.1, count: 0 });
      expect(report.bins[9]).toMatchObject({ index: 9, lower: 0.9, upper: 1, count: 1, meanConfidence: 1, accuracy: 1 });
      expect(report.ece).toBe(0);
    }
    const empty = evaluateProspectiveScores({ artifacts: [] });
    for (const report of empty.report.eceReports) {
      expect(report.ece).toBe(0);
      expect(report.bins.every((bin) => bin.count === 0 && bin.meanConfidence === 0 && bin.accuracy === 0)).toBe(true);
    }
    assertFiniteReport(scored.report);
    assertFiniteReport(empty.report);
  });

  it("31–38, 43–44: STRICT rejects invalid artifacts with explicit reasons; AUDITED records them", () => {
    const valid = syntheticArtifact({ fixtureId: "ok-1" });
    const duplicate = syntheticArtifact({ fixtureId: "ok-1" });
    const dupArm = syntheticArtifact({
      fixtureId: "dup-arm",
      mutate: (artifact) => ({
        ...artifact,
        candidateScores: [
          ...artifact.candidateScores.slice(0, 4),
          { ...artifact.candidateScores[0]!, candidateId: "CONTROL_PRODUCTION" },
        ],
      }),
    });
    const missing = syntheticArtifact({
      fixtureId: "missing-arm",
      mutate: (artifact) => ({
        ...artifact,
        candidateScores: artifact.candidateScores.slice(0, 4),
      }),
    });
    const unknown = syntheticArtifact({
      fixtureId: "unknown-arm",
      mutate: (artifact) => ({
        ...artifact,
        candidateScores: artifact.candidateScores.map((row, index) =>
          index === 4 ? { ...row, candidateId: "NOT_AN_ARM" as ProspectiveCandidateId } : row,
        ),
      }),
    });
    const wrongFp = syntheticArtifact({
      fixtureId: "wrong-fp",
      fingerprint: "0".repeat(64),
    });
    const tampered = syntheticArtifact({
      fixtureId: "tampered",
      reseal: false,
      mutate: (artifact) => ({
        ...artifact,
        candidateScores: artifact.candidateScores.map((row, index) =>
          index === 0 ? { ...row, homeProbability: row.homeProbability + 0.01 } : row,
        ),
      }),
    });
    const invalidP = syntheticArtifact({
      fixtureId: "bad-p",
      mutate: (artifact) => ({
        ...artifact,
        candidateScores: artifact.candidateScores.map((row) => ({
          ...row,
          homeProbability: 0.5,
          drawProbability: 0.5,
          awayProbability: 0.5,
        })),
      }),
    });
    const inconsistent = syntheticArtifact({
      fixtureId: "bad-obs",
      mutate: (artifact) => ({
        ...artifact,
        observedClass: "AWAY",
        candidateScores: artifact.candidateScores.map((row) => ({ ...row, observedClass: "AWAY" as const })),
      }),
    });

    expect(inspectScoredArtifact(dupArm)).toBe("DUPLICATE_ARM");
    expect(inspectScoredArtifact(missing)).toBe("MISSING_ARM");
    expect(inspectScoredArtifact(unknown)).toBe("UNKNOWN_ARM");
    expect(inspectScoredArtifact(wrongFp)).toBe("WRONG_FINGERPRINT");
    expect(inspectScoredArtifact(tampered)).toBe("TAMPERED_ARTIFACT");
    expect(inspectScoredArtifact(invalidP)).toBe("INVALID_PROBABILITY");
    expect(inspectScoredArtifact(inconsistent)).toBe("INCONSISTENT_OBSERVED_CLASS");

    const rejected = expectRejected(() => evaluateProspectiveScores({ artifacts: [valid, duplicate] }));
    expect(rejected.report.rejections.some((item) => item.reason === "DUPLICATE_FIXTURE")).toBe(true);
    expect(rejected.report.integrityStatus).toBe("FAIL");
    expect(rejected.report.evaluatedN).toBe(0);

    const cases = [dupArm, missing, unknown, wrongFp, tampered, invalidP, inconsistent];
    for (const artifact of cases) {
      const error = expectRejected(() => evaluateProspectiveScores({ artifacts: [valid, artifact] }));
      expect(error.report.rejectedCount).toBeGreaterThan(0);
      expect(error.report.rejections.length).toBe(error.report.rejectedCount);
    }

    const audited = evaluateProspectiveScores({
      artifacts: [valid, duplicate, missing],
      mode: "AUDITED_COLLECTION",
    });
    expect(audited.report.evaluatedN).toBe(1);
    expect(audited.report.rejectedCount).toBe(2);
    expect(audited.report.rejections.map((item) => item.reason).sort()).toEqual([
      "DUPLICATE_FIXTURE",
      "MISSING_ARM",
    ]);
    expect(audited.report.rejectionPolicy).toBe("AUDITED_COLLECTION");
  });

  it("39–42: input order does not change metrics or hash; no UUID/random", () => {
    const artifacts = many(5);
    const forward = evaluateProspectiveScores({ artifacts });
    const reverse = evaluateProspectiveScores({ artifacts: [...artifacts].reverse() });
    expect(forward.report.evaluationHash).toBe(reverse.report.evaluationHash);
    expect(forward.report.candidateAggregates).toEqual(reverse.report.candidateAggregates);
    expect(forward.report.checkpointState).toBe(reverse.report.checkpointState);
    expect(forward.report.evaluationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(forward.report.evaluationHash).toBe(
      evaluateProspectiveScores({ artifacts: [...artifacts] }).report.evaluationHash,
    );
    expect(readEvaluationSources()).not.toMatch(/randomUUID|Math\.random|crypto\.randomBytes|uuid/i);
  });

  it("45–48: N<100 and checkpoint N never auto-promote", () => {
    for (const n of [1, 99, 100, 250, 500, 501]) {
      const report = evaluateProspectiveScores({ artifacts: many(n) }).report;
      expect(report.formalReviewAvailable).toBe(n >= 100);
      expect(json(report)).not.toMatch(FORBIDDEN_REPORT);
      expect(report.candidateAggregates.map((row) => row.candidateId)).toEqual([...PROSPECTIVE_CANDIDATE_IDS]);
    }
  });

  it("49–60: no production mutation, no provider/network/keys, no real prospective reads", () => {
    const source = readEvaluationSources();
    expect(source).not.toMatch(/API_FOOTBALL_KEY|x-apisports-key|v3\.football\.api-sports\.io|fetch\s*\(|axios/);
    expect(source).not.toMatch(/data\/prospective\/pending|data\/prospective\/scored/);
    expect(source).not.toMatch(/createLiveDiscoveryTransport|kind:\s*"live"/);
    expect(source).not.toMatch(/process\.env/);
    expect(gitDiff(FROZEN_PATHS)).toBe("");
    const report = evaluateProspectiveScores({ artifacts: many(3) }).report;
    expect(report.providerCallAccounting).toEqual({
      discoveryCalls: 0,
      evidenceCalls: 0,
      oddsCalls: 0,
      outcomeCalls: 0,
      totalCalls: 0,
    });
    expect(report.candidateFingerprint).toBe(FROZEN_CANDIDATE);
    expect(report.protocolFingerprint).toBe(FROZEN_PROTOCOL);
    expect(execSync("git status --short -- data/prospective", { encoding: "utf8" }).trim()).toBe("");
  });
});
