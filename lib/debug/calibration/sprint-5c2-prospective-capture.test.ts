/**
 * Sprint 5C.2 — prospective capture infrastructure.
 * Synthetic fixtures only. Zero live origin calls. No result scoring.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_MANIFEST_FINGERPRINT,
  CAPTURE_WINDOW_PLACEHOLDER,
  FORBIDDEN_CAPTURE_INPUT_KEYS,
  HistoricalFirewallError,
  PRODUCTION_BASE_COMMIT,
  PROSPECTIVE_CANDIDATE_IDS,
  PROSPECTIVE_CANDIDATE_VERSION,
  USED_HISTORICAL_SEASONS,
  assertCaptureBatchIntegrity,
  captureProspectiveBatch,
  createEvidenceSnapshot,
  createFixedClock,
  deriveBatchId,
  findPriorFixtureCapture,
  formatCaptureReport,
  hashEvidenceManifest,
  hashRecords,
  loadPendingBatch,
  loadPriorCaptureIndex,
  persistPendingBatch,
  predictCandidate,
  sha256Canonical,
  verifyBatchHashes,
} from "@/lib/debug/calibration";
import { evidenceFromSnapshot } from "@/lib/debug/calibration/prospective/capture/capture-evidence";
import { assertEligibleFixture } from "@/lib/debug/calibration/prospective/capture/capture-eligibility";
import { assertExactCandidateIds } from "@/lib/debug/calibration/prospective/capture/capture-integrity";
import { pendingDirectory, scoredDirectory } from "@/lib/debug/calibration/prospective/capture/capture-persist";
import type {
  ProspectiveCaptureBatch,
  ProspectiveFixtureInput,
  TeamEvidenceCounts,
} from "@/lib/debug/calibration/prospective/capture/capture-types";

const FROZEN_HEAD = "132f82cf5312b8de81ac7da674b074a0611d7dda";
const FROZEN_FINGERPRINT = "7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c";
const FROZEN_CANDIDATE_FILES = [
  "lib/debug/calibration/prospective/candidate-config.ts",
  "lib/debug/calibration/prospective/candidate-input.ts",
  "lib/debug/calibration/prospective/candidate-transform.ts",
  "lib/debug/calibration/prospective/candidate-high-equal.ts",
  "lib/debug/calibration/prospective/candidate-engine.ts",
];

const CLOCK = createFixedClock("2099-08-16T18:00:00.000Z");
const CREATED_AT = "2099-08-16T18:00:00.000Z";
const CAPTURED_AT = "2099-08-16T18:00:00.000Z";
const KICKOFF = "2099-08-17T15:00:00.000Z";
const EVIDENCE_AS_OF = "2099-08-16T12:00:00.000Z";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "apex-5c2-"));
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
    competitionId: "UNSEEN-TEST",
    season: "2099",
    kickoff: KICKOFF,
    homeTeamId,
    awayTeamId,
    homeTeamName: partial.homeTeamName ?? "Synthetic Home",
    awayTeamName: partial.awayTeamName ?? "Synthetic Away",
    evidenceAsOf: EVIDENCE_AS_OF,
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
      capturedAt: "2099-08-16T17:00:00.000Z",
      source: "SyntheticBook",
      home: 2.1,
      draw: 3.4,
      away: 3.6,
    },
  }),
  noOdds: fixture({ fixtureId: "syn-no-odds" }),
  sameKickoffA: fixture({ fixtureId: "syn-same-a", kickoff: "2099-08-17T15:00:00.000Z" }),
  sameKickoffB: fixture({ fixtureId: "syn-same-b", kickoff: "2099-08-17T15:00:00.000Z" }),
};

function capture(fixtures: ProspectiveFixtureInput[], extra?: Partial<Parameters<typeof captureProspectiveBatch>[1]>) {
  return captureProspectiveBatch(fixtures, {
    clock: CLOCK,
    createdAt: CREATED_AT,
    capturedAt: CAPTURED_AT,
    dryRun: true,
    ...extra,
  });
}

function readCaptureSources(): string {
  return [
    "lib/debug/calibration/prospective/capture/capture-types.ts",
    "lib/debug/calibration/prospective/capture/capture-clock.ts",
    "lib/debug/calibration/prospective/capture/capture-eligibility.ts",
    "lib/debug/calibration/prospective/capture/capture-evidence.ts",
    "lib/debug/calibration/prospective/capture/capture-runner.ts",
    "lib/debug/calibration/prospective/capture/capture-integrity.ts",
    "lib/debug/calibration/prospective/capture/capture-persist.ts",
    "lib/debug/calibration/prospective/capture/capture-manifest.ts",
    "lib/debug/calibration/prospective/capture/capture-report.ts",
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("Sprint 5C.2 — prospective capture infrastructure", () => {
  it("keeps the frozen 5C.1 fingerprint, version, and candidate files unchanged", () => {
    expect(PROSPECTIVE_CANDIDATE_VERSION).toBe("apex.calibration.prospective.5c1.v1");
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(FROZEN_FINGERPRINT);
    expect([...PROSPECTIVE_CANDIDATE_IDS]).toEqual([
      "CONTROL_PRODUCTION",
      "CANDIDATE_A_INPUT",
      "CANDIDATE_B_TRANSFORM",
      "CANDIDATE_C_COMBINED",
      "CANDIDATE_D_COMBINED_HIGH_EQUAL",
    ]);
    expect(PRODUCTION_BASE_COMMIT).toBe("967b541f3947a4f9cfe0d1fe5eea57f3de880f62");
    expect([...USED_HISTORICAL_SEASONS]).toEqual(["2023", "2024", "2025"]);
    const diff = execSync(`git diff --name-only ${FROZEN_HEAD} -- ${FROZEN_CANDIDATE_FILES.join(" ")}`, {
      encoding: "utf8",
    }).trim();
    expect(diff).toBe("");
  });

  it("has no network, API, collector, scoring, ranking, or random identity helpers", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    const source = readCaptureSources();
    expect(source).not.toMatch(/fetch\(|axios|createLive|getFixtureOdds|collector/i);
    expect(source).not.toMatch(/scorePredictionRecord|loadDrawForensics|evaluateSeason|loadCalibrationDataset/);
    expect(source).not.toMatch(/rankCandidates|pickWinner|bestCandidate|optimizeCandidate|winner helper|ranking helper/);
    expect(source).not.toMatch(/Math\.random|randomUUID|crypto\.randomUUID/);
    expect(source).not.toMatch(/CALIBRATION_ARTIFACT_DIR|loadCalibrationDataset|writeCalibrationArtifacts/);
    expect(CAPTURE_WINDOW_PLACEHOLDER.earliestCaptureMinutesBeforeKickoff).toBe(
      "UNASSIGNED_UNTIL_5C3_LIVE_PROTOCOL",
    );
    expect(CAPTURE_WINDOW_PLACEHOLDER.latestCaptureMinutesBeforeKickoff).toBe(
      "UNASSIGNED_UNTIL_5C3_LIVE_PROTOCOL",
    );
  });

  it("rejects result fields on the capture input contract", () => {
    const sample = SYNTHETIC.balanced;
    for (const key of FORBIDDEN_CAPTURE_INPUT_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(sample, key)).toBe(false);
    }
    const leaked = {
      ...sample,
      finalHomeGoals: 2,
    };
    expect(() => capture([leaked as ProspectiveFixtureInput])).toThrow(/outcome field/);
    expect(() =>
      capture([{ ...sample, fixtureStatus: "FT" } as ProspectiveFixtureInput & { fixtureStatus: string }]),
    ).toThrow(/fixtureStatus/);
  });

  it("captures exactly five frozen-candidate records with PENDING outcomes and optional odds", () => {
    const mixed = capture([
      SYNTHETIC.balanced,
      SYNTHETIC.strongHome,
      SYNTHETIC.strongAway,
      SYNTHETIC.sparse,
      SYNTHETIC.zero,
      SYNTHETIC.withOdds,
      SYNTHETIC.noOdds,
      SYNTHETIC.sameKickoffA,
      SYNTHETIC.sameKickoffB,
    ]);
    expect(mixed.dryRun).toBe(true);
    expect(mixed.persisted).toBeNull();
    expect(mixed.batch.fixtureCount).toBe(9);
    expect(mixed.batch.recordCount).toBe(45);
    expect(mixed.batch.recordCount).toBe(mixed.batch.fixtureCount * 5);
    expect(mixed.batch.candidateVersion).toBe(PROSPECTIVE_CANDIDATE_VERSION);
    expect(mixed.batch.candidateFingerprint).toBe(FROZEN_FINGERPRINT);

    const oddsRecords = mixed.batch.records.filter((row) => row.fixtureId === "syn-odds");
    expect(oddsRecords).toHaveLength(5);
    expect(oddsRecords.every((row) => row.odds?.home === 2.1)).toBe(true);
    expect(oddsRecords[0]?.marketImpliedProbabilities).not.toBeNull();
    const implied = oddsRecords[0]!.marketImpliedProbabilities!;
    expect(implied.home + implied.draw + implied.away).toBeCloseTo(1, 12);

    const noOdds = mixed.batch.records.filter((row) => row.fixtureId === "syn-no-odds");
    expect(noOdds.every((row) => row.odds === null && row.marketImpliedProbabilities === null)).toBe(true);

    for (const record of mixed.batch.records) {
      expect(record.resultStatus).toBe("PENDING");
      expect(record.finalHomeGoals).toBeNull();
      expect(record.finalAwayGoals).toBeNull();
      expect(record.scoredAt).toBeNull();
      expect(record.capturedAt).toBe(CAPTURED_AT);
      expect(Date.parse(record.capturedAt) < Date.parse(record.kickoff)).toBe(true);
    }

    const sameKickoffIds = mixed.batch.fixtureIds.filter((id) => id.startsWith("syn-same"));
    expect(sameKickoffIds).toEqual(["syn-same-a", "syn-same-b"]);
  });

  it("preserves frozen 5C.1 candidate-engine parity and shared evidence identity", () => {
    const result = capture([SYNTHETIC.balanced]);
    expect(result.batch.records).toHaveLength(5);
    assertExactCandidateIds(result.batch.records);
    const snapshot = result.batch.evidenceSnapshots[0]!;
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.home)).toBe(true);
    expect(() => {
      (snapshot as { fixtureId: string }).fixtureId = "mutated";
    }).toThrow(TypeError);
    const evidence = evidenceFromSnapshot(SYNTHETIC.balanced, snapshot);
    expect(Date.parse(SYNTHETIC.balanced.evidenceAsOf) <= Date.parse(CAPTURED_AT)).toBe(true);
    expect(Date.parse(evidence.evidenceAsOf) < Date.parse(SYNTHETIC.balanced.kickoff)).toBe(true);

    for (const record of result.batch.records) {
      const direct = predictCandidate(record.candidateId, evidence);
      expect(record.homeElo).toBe(direct.homeElo);
      expect(record.awayElo).toBe(direct.awayElo);
      expect(record.eloGap).toBe(direct.eloGap);
      expect(record.lambdaHome).toBe(direct.lambdaHome);
      expect(record.lambdaAway).toBe(direct.lambdaAway);
      expect(record.probHome).toBe(direct.oneXTwo.home);
      expect(record.probDraw).toBe(direct.oneXTwo.draw);
      expect(record.probAway).toBe(direct.oneXTwo.away);
      expect(record.confidence).toBe(direct.confidence);
      expect(record.candidateFingerprint).toBe(FROZEN_FINGERPRINT);
      expect(record.inputEvidenceCounts).toEqual({
        homePlayedBefore: snapshot.home.matchesPlayed,
        awayPlayedBefore: snapshot.away.matchesPlayed,
      });
    }
  });

  it("uses deterministic canonical hashes and a derived batchId", () => {
    const first = capture([SYNTHETIC.balanced, SYNTHETIC.withOdds]);
    const second = capture([SYNTHETIC.withOdds, SYNTHETIC.balanced]);
    expect(first.batch.recordsHash).toBe(second.batch.recordsHash);
    expect(first.batch.evidenceManifestHash).toBe(second.batch.evidenceManifestHash);
    expect(first.batch.batchHash).toBe(second.batch.batchHash);
    expect(first.batch.batchId).toBe(second.batch.batchId);
    expect(first.batch.recordsHash).toBe(hashRecords(first.batch.records));
    expect(first.batch.evidenceManifestHash).toBe(hashEvidenceManifest(first.batch.evidenceSnapshots));
    expect(first.batch.batchId).toBe(
      deriveBatchId({
        candidateFingerprint: first.batch.candidateFingerprint,
        createdAt: first.batch.createdAt,
        fixtureIds: first.batch.fixtureIds,
        recordsHash: first.batch.recordsHash,
      }),
    );
    expect(first.batch.batchId).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Canonical({ a: 1, b: 2 })).toBe(sha256Canonical({ b: 2, a: 1 }));

    const tamperedRecord: ProspectiveCaptureBatch = {
      ...first.batch,
      records: first.batch.records.map((row, index) =>
        index === 0 ? { ...row, probHome: row.probHome + 0.01 } : row,
      ),
    };
    expect(hashRecords(tamperedRecord.records)).not.toBe(first.batch.recordsHash);
    expect(() => verifyBatchHashes(tamperedRecord)).toThrow(/recordsHash/);

    const tamperedEvidence: ProspectiveCaptureBatch = {
      ...first.batch,
      evidenceSnapshots: first.batch.evidenceSnapshots.map((row, index) =>
        index === 0 ? { ...row, home: { ...row.home, goalsFor: row.home.goalsFor + 1 } } : row,
      ),
    };
    expect(hashEvidenceManifest(tamperedEvidence.evidenceSnapshots)).not.toBe(
      first.batch.evidenceManifestHash,
    );
    expect(() => verifyBatchHashes(tamperedEvidence)).toThrow(/evidenceManifestHash/);
  });

  it("rejects time, odds, leakage, firewall, duplicate, and integrity failures", () => {
    expect(() =>
      capture([{ ...SYNTHETIC.balanced, kickoff: CAPTURED_AT }]),
    ).toThrow(/capturedAt must be before kickoff/);
    expect(() =>
      capture([{ ...SYNTHETIC.balanced, kickoff: "2099-08-16T17:00:00.000Z" }]),
    ).toThrow(/capturedAt must be before kickoff/);
    expect(() =>
      capture([{ ...SYNTHETIC.balanced, evidenceAsOf: "2099-08-16T19:00:00.000Z" }]),
    ).toThrow(/evidenceAsOf/);
    expect(() =>
      capture([{ ...SYNTHETIC.balanced, evidenceAsOf: "2099-08-18T12:00:00.000Z" }]),
    ).toThrow(/evidence/);
    expect(() =>
      capture([
        {
          ...SYNTHETIC.withOdds,
          oddsSnapshot: {
            capturedAt: "2099-08-16T19:00:00.000Z",
            source: "SyntheticBook",
            home: 2.1,
            draw: 3.4,
            away: 3.6,
          },
        },
      ]),
    ).toThrow(/oddsCapturedAt/);
    expect(() =>
      capture([
        {
          ...SYNTHETIC.withOdds,
          oddsSnapshot: {
            capturedAt: "2099-08-18T12:00:00.000Z",
            source: "SyntheticBook",
            home: 2.1,
            draw: 3.4,
            away: 3.6,
          },
        },
      ]),
    ).toThrow(/capturedAt must be before kickoff|oddsCapturedAt/);
    expect(() => capture([SYNTHETIC.balanced, { ...SYNTHETIC.sparse, fixtureId: "syn-balanced" }])).toThrow(
      /duplicate fixture/,
    );
    expect(() => capture([{ ...SYNTHETIC.balanced, season: "2023" }])).toThrow(HistoricalFirewallError);
    expect(() => capture([{ ...SYNTHETIC.balanced, season: "2024" }])).toThrow(HistoricalFirewallError);
    expect(() => capture([{ ...SYNTHETIC.balanced, season: "2025" }])).toThrow(HistoricalFirewallError);

    const good = capture([SYNTHETIC.balanced]);
    expect(() =>
      assertCaptureBatchIntegrity({
        ...good.batch,
        candidateFingerprint: "0".repeat(64),
      }),
    ).toThrow(/fingerprint/);
    expect(() =>
      assertExactCandidateIds(good.batch.records.slice(0, 4)),
    ).toThrow(/exactly five/);
    const duplicateCandidate = [...good.batch.records.slice(0, 4), { ...good.batch.records[0]! }];
    expect(() => assertExactCandidateIds(duplicateCandidate)).toThrow(/duplicate candidate/);
    expect(() =>
      capture([SYNTHETIC.balanced], {
        priorIndex: {
          entries: [
            {
              fixtureId: "syn-balanced",
              candidateFingerprint: FROZEN_FINGERPRINT,
              batchId: "already-captured",
            },
          ],
        },
      }),
    ).toThrow(/already captured/);
  });

  it("supports injected capture windows without choosing live operational values", () => {
    const window = {
      earliestCaptureMinutesBeforeKickoff: 48 * 60,
      latestCaptureMinutesBeforeKickoff: 30,
    };
    expect(() => capture([SYNTHETIC.balanced], { window })).not.toThrow();
    expect(() =>
      capture([{ ...SYNTHETIC.balanced, evidenceAsOf: "2099-08-10T12:00:00.000Z" }], {
        window,
        capturedAt: "2099-08-10T15:00:00.000Z",
      }),
    ).toThrow(/earliest capture window/);
    expect(() =>
      capture([SYNTHETIC.balanced], {
        window,
        capturedAt: "2099-08-17T14:45:00.000Z",
      }),
    ).toThrow(/latest capture window/);
  });

  it("dry-run writes nothing and persist writes pending only with overwrite and temp cleanup", () => {
    const root = tempRoot();
    const dry = capture([SYNTHETIC.balanced], { persistRoot: root, dryRun: true });
    expect(dry.persisted).toBeNull();
    expect(existsSync(pendingDirectory(root))).toBe(false);
    expect(existsSync(scoredDirectory(root))).toBe(false);

    const written = capture([SYNTHETIC.balanced], { persistRoot: root, dryRun: false });
    expect(written.persisted?.path).toBe(join(pendingDirectory(root), `${written.batch.batchId}.json`));
    expect(existsSync(written.persisted!.path)).toBe(true);
    expect(existsSync(scoredDirectory(root))).toBe(false);
    const loaded = loadPendingBatch(written.batch.batchId, root);
    expect(loaded.batchHash).toBe(written.batch.batchHash);
    const index = loadPriorCaptureIndex(root);
    expect(findPriorFixtureCapture(index, "syn-balanced", FROZEN_FINGERPRINT)?.batchId).toBe(
      written.batch.batchId,
    );
    expect(readdirSync(pendingDirectory(root)).every((name) => !name.endsWith(".tmp"))).toBe(true);

    expect(() => persistPendingBatch({ batch: written.batch, persistRoot: root })).toThrow(/overwrite/);
    expect(() =>
      capture([SYNTHETIC.balanced], {
        persistRoot: root,
        dryRun: false,
        createdAt: "2099-08-16T19:00:00.000Z",
      }),
    ).toThrow(/already captured/);

    const failRoot = tempRoot();
    expect(() =>
      capture([SYNTHETIC.sparse], {
        persistRoot: failRoot,
        dryRun: false,
        simulateFailureAfterTempWrite: true,
      }),
    ).toThrow(/simulated persist failure/);
    expect(existsSync(pendingDirectory(failRoot))).toBe(true);
    expect(readdirSync(pendingDirectory(failRoot))).toEqual([]);

    const report = formatCaptureReport(written.report);
    expect(report).toContain(written.batch.batchId);
    expect(report).toContain("odds=no");
    expect(report).not.toMatch(/winner|ranking|best candidate/i);
  });

  it("does not mutate production or frozen candidate source in capture modules", () => {
    const source = readCaptureSources();
    expect(source).not.toMatch(/DEFAULT_HYBRID_CONFIG\s*=/);
    expect(source).not.toMatch(/eloGoalScale:\s*600/);
    expect(source).not.toMatch(/CANDIDATE_ARMS\s*=/);
    expect(assertEligibleFixture).toBeTypeOf("function");
    expect(createEvidenceSnapshot(SYNTHETIC.zero, CAPTURED_AT).home.matchesPlayed).toBe(0);
  });
});
