/**
 * Sprint 5C.3 — live prospective capture protocol freeze.
 * Offline synthetic metadata only. Zero live origin calls. No scoring.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_MANIFEST_FINGERPRINT,
  CAPTURE_WINDOW_PLACEHOLDER,
  FIRST_LIVE_PHASE,
  LIVE_CAPTURE_WINDOW,
  LIVE_PROTOCOL_API_BUDGET,
  LIVE_PROTOCOL_BASE_COMMIT,
  LIVE_PROTOCOL_CONFIG,
  LIVE_PROTOCOL_FINGERPRINT,
  LIVE_PROTOCOL_VERSION,
  OFFLINE_SYNTHETIC_SEASON,
  PRODUCTION_BASE_COMMIT,
  PROSPECTIVE_CANDIDATE_VERSION,
  PROSPECTIVE_CHECKPOINTS,
  PROSPECTIVE_COMPETITION_ID,
  PROSPECTIVE_SEASON_UNVERIFIED,
  SAMPLE_DISPOSITIONS,
  assertFiniteApiBudget,
  assertProtocolFingerprintsDistinct,
  captureProspectiveBatch,
  computeProtocolFingerprint,
  countPrimarySampleN,
  createFixedClock,
  isEligiblePriorEvidence,
  liveProtocolCaptureWindow,
  planDiscoveredFixtures,
  planFirstLiveDiscovery,
  protocolCanonicalJson,
  protocolDryRun,
  reportingCheckpoints,
  selectPriorEvidenceFixtures,
  toUtcIso,
} from "@/lib/debug/calibration";
import type { DiscoveredFixtureMetadata } from "@/lib/debug/calibration/prospective/protocol/protocol-types";
import type { ProspectiveFixtureInput } from "@/lib/debug/calibration/prospective/capture/capture-types";

const FROZEN_HEAD = "82162ad2cea7132cede9631ff268ad1c0fcee608";
const FROZEN_CANDIDATE_FINGERPRINT = "7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c";
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

const KICKOFF = "2099-08-17T15:00:00.000Z";

function atMinutesBefore(minutes: number): string {
  return new Date(Date.parse(KICKOFF) - minutes * 60_000).toISOString();
}

function discovered(
  partial: Partial<DiscoveredFixtureMetadata> & Pick<DiscoveredFixtureMetadata, "fixtureId">,
): DiscoveredFixtureMetadata {
  return {
    competitionId: "39",
    season: OFFLINE_SYNTHETIC_SEASON,
    kickoff: KICKOFF,
    homeTeamId: "home-syn",
    awayTeamId: "away-syn",
    status: "NS",
    ...partial,
  };
}

function classify(fixture: DiscoveredFixtureMetadata, minutesBefore: number) {
  return planDiscoveredFixtures([fixture], createFixedClock(atMinutesBefore(minutesBefore)))[0]!;
}

function captureInput(fixtureId: string): ProspectiveFixtureInput {
  return {
    fixtureId,
    competitionId: "UNSEEN-TEST",
    season: "2099",
    kickoff: KICKOFF,
    homeTeamId: "home-syn",
    awayTeamId: "away-syn",
    homeTeamName: "Synthetic Home",
    awayTeamName: "Synthetic Away",
    evidenceAsOf: atMinutesBefore(90),
    preMatchEvidence: {
      home: {
        teamId: "home-syn",
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      },
      away: {
        teamId: "away-syn",
        matchesPlayed: 1,
        wins: 0,
        draws: 1,
        losses: 0,
        goalsFor: 1,
        goalsAgainst: 1,
      },
    },
  };
}

function readProtocolSources(): string {
  return [
    "lib/debug/calibration/prospective/protocol/protocol-types.ts",
    "lib/debug/calibration/prospective/protocol/protocol-config.ts",
    "lib/debug/calibration/prospective/protocol/protocol-fingerprint.ts",
    "lib/debug/calibration/prospective/protocol/protocol-utc.ts",
    "lib/debug/calibration/prospective/protocol/protocol-status.ts",
    "lib/debug/calibration/prospective/protocol/protocol-planner.ts",
    "lib/debug/calibration/prospective/protocol/protocol-evidence.ts",
    "lib/debug/calibration/prospective/protocol/protocol-sample.ts",
    "lib/debug/calibration/prospective/protocol/protocol-discovery.ts",
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("Sprint 5C.3 — live prospective protocol freeze", () => {
  it("freezes competition, window, unverified season, and unchanged candidate/production files", () => {
    expect(LIVE_PROTOCOL_BASE_COMMIT).toBe(FROZEN_HEAD);
    expect(LIVE_PROTOCOL_CONFIG.baseCommit).toBe(FROZEN_HEAD);
    expect(PRODUCTION_BASE_COMMIT).toBe("967b541f3947a4f9cfe0d1fe5eea57f3de880f62");
    expect(CANDIDATE_MANIFEST_FINGERPRINT).toBe(FROZEN_CANDIDATE_FINGERPRINT);
    expect(LIVE_PROTOCOL_CONFIG.candidateFingerprint).toBe(FROZEN_CANDIDATE_FINGERPRINT);
    expect(LIVE_PROTOCOL_CONFIG.candidateVersion).toBe(PROSPECTIVE_CANDIDATE_VERSION);
    expect(LIVE_PROTOCOL_VERSION).toBe("apex.calibration.prospective.5c3.v1");
    expect(PROSPECTIVE_COMPETITION_ID).toBe("39");
    expect(LIVE_PROTOCOL_CONFIG.competitionId).toBe("39");
    expect(LIVE_PROTOCOL_CONFIG.prospectiveSeason).toBe(PROSPECTIVE_SEASON_UNVERIFIED);
    expect(LIVE_CAPTURE_WINDOW.targetCaptureMinutesBeforeKickoff).toBe(60);
    expect(LIVE_CAPTURE_WINDOW.earliestCaptureMinutesBeforeKickoff).toBe(75);
    expect(LIVE_CAPTURE_WINDOW.latestCaptureMinutesBeforeKickoff).toBe(45);
    expect(CAPTURE_WINDOW_PLACEHOLDER.earliestCaptureMinutesBeforeKickoff).toBe(
      "UNASSIGNED_UNTIL_5C3_LIVE_PROTOCOL",
    );
    expect([...reportingCheckpoints()]).toEqual([100, 250, 500]);
    expect([...PROSPECTIVE_CHECKPOINTS]).toEqual([100, 250, 500]);
    expect([...LIVE_PROTOCOL_CONFIG.historicalUsedSeasons]).toEqual(["2023", "2024", "2025"]);
    expect(LIVE_PROTOCOL_CONFIG.oddsRequired).toBe(false);
    const candidateDiff = execSync(
      `git diff --name-only ${FROZEN_HEAD} -- ${FROZEN_CANDIDATE_FILES.join(" ")}`,
      { encoding: "utf8" },
    ).trim();
    expect(candidateDiff).toBe("");
    const productionDiff = execSync(`git diff --name-only ${FROZEN_HEAD} -- ${PRODUCTION_PATHS.join(" ")}`, {
      encoding: "utf8",
    }).trim();
    expect(productionDiff).toBe("");
  });

  it("classifies the operational window, statuses, seasons, and leagues deterministically", () => {
    expect(classify(discovered({ fixtureId: "t80" }), 80).disposition).toBe("TOO_EARLY");
    expect(classify(discovered({ fixtureId: "t75" }), 75).disposition).toBe("IN_WINDOW");
    expect(classify(discovered({ fixtureId: "t60" }), 60).disposition).toBe("IN_WINDOW");
    expect(classify(discovered({ fixtureId: "t45" }), 45).disposition).toBe("IN_WINDOW");
    expect(classify(discovered({ fixtureId: "t44" }), 44).disposition).toBe("MISSED_WINDOW");
    expect(classify(discovered({ fixtureId: "post" }), -5).disposition).toBe("MISSED_WINDOW");
    expect(classify(discovered({ fixtureId: "league2", competitionId: "40" }), 60).disposition).toBe(
      "INTEGRITY_REJECTED",
    );
    expect(classify(discovered({ fixtureId: "s2023", season: "2023" }), 60).disposition).toBe(
      "INTEGRITY_REJECTED",
    );
    expect(classify(discovered({ fixtureId: "s2024", season: "2024" }), 60).disposition).toBe(
      "INTEGRITY_REJECTED",
    );
    expect(classify(discovered({ fixtureId: "s2025", season: "2025" }), 60).disposition).toBe(
      "INTEGRITY_REJECTED",
    );
    expect(classify(discovered({ fixtureId: "ns", status: "NS" }), 60).disposition).toBe("IN_WINDOW");
    expect(classify(discovered({ fixtureId: "live", status: "LIVE" }), 60).disposition).toBe(
      "INELIGIBLE_STATUS",
    );
    expect(classify(discovered({ fixtureId: "ft", status: "FT" }), 60).disposition).toBe(
      "INELIGIBLE_STATUS",
    );
    expect(classify(discovered({ fixtureId: "unk", status: "WEIRD_STATE" }), 60).disposition).toBe(
      "INELIGIBLE_STATUS",
    );
    expect(classify(discovered({ fixtureId: "dup", alreadyCaptured: true }), 60).disposition).toBe(
      "DUPLICATE",
    );
    expect(classify(discovered({ fixtureId: "pst", status: "PST" }), 60).disposition).toBe(
      "POSTPONED_BEFORE_CAPTURE",
    );
    expect(classify(discovered({ fixtureId: "canc", status: "CANC" }), 60).disposition).toBe(
      "CANCELLED_BEFORE_CAPTURE",
    );

    const utcA = classify(discovered({ fixtureId: "utc-z", kickoff: "2099-08-17T15:00:00.000Z" }), 60);
    const utcB = classify(discovered({ fixtureId: "utc-offset", kickoff: "2099-08-17T16:00:00.000+01:00" }), 60);
    expect(utcA.disposition).toBe(utcB.disposition);
    expect(utcA.kickoffUtc).toBe(utcB.kickoffUtc);
    expect(toUtcIso("2099-08-17T16:00:00+01:00")).toBe("2099-08-17T15:00:00.000Z");
  });

  it("keeps same-kickoff evidence exclusive and allows sparse or zero evidence", () => {
    const target = { fixtureId: "target", kickoff: KICKOFF };
    const same = { fixtureId: "same-ko", kickoff: KICKOFF };
    const prior = { fixtureId: "prior", kickoff: "2099-08-16T15:00:00.000Z" };
    const later = { fixtureId: "later", kickoff: "2099-08-18T15:00:00.000Z" };
    expect(isEligiblePriorEvidence(same.kickoff, target.kickoff)).toBe(false);
    expect(isEligiblePriorEvidence(prior.kickoff, target.kickoff)).toBe(true);
    expect(isEligiblePriorEvidence(later.kickoff, target.kickoff)).toBe(false);
    expect(selectPriorEvidenceFixtures([same, prior, later], target).map((row) => row.fixtureId)).toEqual([
      "prior",
    ]);

    const zero = captureProspectiveBatch([captureInput("syn-zero")], {
      clock: createFixedClock(atMinutesBefore(60)),
      capturedAt: atMinutesBefore(60),
      createdAt: atMinutesBefore(60),
      window: liveProtocolCaptureWindow(),
      dryRun: true,
    });
    expect(zero.batch.records).toHaveLength(5);
    expect(zero.batch.records[0]?.inputEvidenceCounts.homePlayedBefore).toBe(0);
    const sparse = captureInput("syn-sparse");
    sparse.preMatchEvidence.home.matchesPlayed = 1;
    sparse.preMatchEvidence.home.wins = 1;
    sparse.preMatchEvidence.home.goalsFor = 1;
    const captured = captureProspectiveBatch([sparse], {
      clock: createFixedClock(atMinutesBefore(60)),
      capturedAt: atMinutesBefore(60),
      createdAt: atMinutesBefore(60),
      window: liveProtocolCaptureWindow(),
      dryRun: true,
    });
    expect(captured.batch.recordCount).toBe(5);
    expect(captured.dryRun).toBe(true);
  });

  it("keeps odds optional and rejects post-capture odds in the existing capture layer", () => {
    const withOdds = captureInput("syn-odds");
    withOdds.oddsSnapshot = {
      capturedAt: atMinutesBefore(70),
      source: "SyntheticBook",
      home: 2.2,
      draw: 3.3,
      away: 3.4,
    };
    const ok = captureProspectiveBatch([withOdds], {
      clock: createFixedClock(atMinutesBefore(60)),
      capturedAt: atMinutesBefore(60),
      createdAt: atMinutesBefore(60),
      window: liveProtocolCaptureWindow(),
      dryRun: true,
    });
    expect(ok.batch.records[0]?.odds).not.toBeNull();

    const lateOdds = captureInput("syn-late-odds");
    lateOdds.oddsSnapshot = {
      capturedAt: atMinutesBefore(30),
      source: "SyntheticBook",
      home: 2.2,
      draw: 3.3,
      away: 3.4,
    };
    expect(() =>
      captureProspectiveBatch([lateOdds], {
        clock: createFixedClock(atMinutesBefore(60)),
        capturedAt: atMinutesBefore(60),
        createdAt: atMinutesBefore(60),
        window: liveProtocolCaptureWindow(),
        dryRun: true,
      }),
    ).toThrow(/oddsCapturedAt/);

    const noOdds = captureProspectiveBatch([captureInput("syn-no-odds")], {
      clock: createFixedClock(atMinutesBefore(60)),
      capturedAt: atMinutesBefore(60),
      createdAt: atMinutesBefore(60),
      window: liveProtocolCaptureWindow(),
      dryRun: true,
    });
    expect(noOdds.batch.records.every((row) => row.odds === null)).toBe(true);
  });

  it("counts N by fixture, fingerprints the protocol, and separates discovery from capture", () => {
    expect(countPrimarySampleN([
      { fixtureId: "a", disposition: "CAPTURED_PENDING" },
      { fixtureId: "a", disposition: "CAPTURED_PENDING" },
      { fixtureId: "b", disposition: "CAPTURED_PENDING" },
      { fixtureId: "c", disposition: "MISSED_WINDOW" },
    ])).toBe(2);
    expect([...SAMPLE_DISPOSITIONS]).toEqual([
      "CAPTURED_PENDING",
      "MISSED_WINDOW",
      "POSTPONED_BEFORE_CAPTURE",
      "CANCELLED_BEFORE_CAPTURE",
      "INELIGIBLE_STATUS",
      "DUPLICATE",
      "INTEGRITY_REJECTED",
      "SOURCE_FAILURE",
    ]);

    const first = computeProtocolFingerprint();
    const second = computeProtocolFingerprint();
    expect(first).toBe(second);
    expect(first).toBe(LIVE_PROTOCOL_FINGERPRINT);
    expect(protocolCanonicalJson()).toBe(protocolCanonicalJson(LIVE_PROTOCOL_CONFIG));
    expect(LIVE_PROTOCOL_FINGERPRINT).toMatch(/^[a-f0-9]{64}$/);
    assertProtocolFingerprintsDistinct();
    expect(LIVE_PROTOCOL_FINGERPRINT).not.toBe(CANDIDATE_MANIFEST_FINGERPRINT);

    const dry = protocolDryRun(
      [
        discovered({ fixtureId: "early" }),
        discovered({ fixtureId: "ok" }),
      ],
      createFixedClock(atMinutesBefore(80)),
    );
    expect(dry.dryRun).toBe(true);
    expect(dry.createdPredictions).toBe(false);
    expect(dry.networkCalls).toBe(0);
    expect(dry.classifications.map((row) => row.disposition)).toEqual(["TOO_EARLY", "TOO_EARLY"]);

    const discovery = planFirstLiveDiscovery(
      [discovered({ fixtureId: "discover-only" })],
      createFixedClock(atMinutesBefore(60)),
    );
    expect(discovery.phase).toBe(FIRST_LIVE_PHASE);
    expect(discovery.createdPredictions).toBe(false);
    expect(discovery.networkCalls).toBe(0);
    expect(LIVE_PROTOCOL_CONFIG.discoverySeparatedFromCapture).toBe(true);
  });

  it("has a finite API budget and no network, collector, scoring, ranking, or backfill helpers", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    assertFiniteApiBudget();
    expect(LIVE_PROTOCOL_API_BUDGET.maxFixtureDiscoveryCalls).toBeGreaterThan(0);
    expect(LIVE_PROTOCOL_API_BUDGET.maxTotalCalls).toBeLessThan(100);
    expect(LIVE_PROTOCOL_CONFIG.maxPagingLoops).toBe(0);
    expect(LIVE_PROTOCOL_CONFIG.fixtureDiscoveryPaging).toBe("UNPAGED_SINGLE_CALL");
    expect(LIVE_PROTOCOL_CONFIG.evidenceCallsPerCandidate).toBe(0);
    expect(LIVE_PROTOCOL_CONFIG.sharedEvidenceSnapshot).toBe(true);
    expect(LIVE_PROTOCOL_CONFIG.noRetrospectiveBackfill).toBe(true);
    const source = readProtocolSources();
    expect(source).not.toMatch(/fetch\(|axios|createLive|getFixtureOdds|collector/i);
    expect(source).not.toMatch(/scorePredictionRecord|loadDrawForensics|evaluateSeason|loadCalibrationDataset/);
    expect(source).not.toMatch(/rankCandidates|pickWinner|bestCandidate|winner helper|ranking helper/);
    expect(source).not.toMatch(/Math\.random|randomUUID|crypto\.randomUUID/);
    expect(source).not.toMatch(/backfillMissedWindow|reconstructWouldHavePredicted|retrospectiveCapture/);
    expect(source).not.toMatch(/for\s*\(.*page|while\s*\(.*page/);
  });
});
