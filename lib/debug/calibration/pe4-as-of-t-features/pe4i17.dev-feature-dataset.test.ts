/**
 * PE-4I.17 — Offline DEV feature dataset emission + coverage audit tests.
 * Zero provider calls. No fitting / metrics / 2025 unsealing.
 */

import { describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { isResearchHoldoutOutcomeEvidence } from "@/lib/debug/calibration/pe4-acquisition/holdout";
import { PE4I5_FROZEN_STAGE2_QUEUE_DIGEST } from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";
import {
  materializeLedgerRowsInMemory,
  type Pe4I16UniverseFixture,
} from "@/lib/debug/calibration/pe4-as-of-t-features/ledger-materialize";
import type { Pe4I2RawStatisticsEnvelope } from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import {
  PE4I17_EMIT_WINDOW_IDS,
  PE4I17_PRODUCTION_WIRING,
  PE4I17_PARENT_QUEUE_DIGEST,
  PE4I17_VENUE_MODES,
  pe4I17Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i17-protocol";
import {
  classifyDevTargetEligibility,
  selectDevEligibleTargets,
} from "@/lib/debug/calibration/pe4-as-of-t-features/target-eligibility";
import {
  buildSeparatedOutcomeLabels,
  mutateSeparatedLabelGoals,
} from "@/lib/debug/calibration/pe4-as-of-t-features/outcome-labels";
import {
  buildDevFeatureDatasetInMemory,
  emitFeatureRecordPair,
  verifyReproducibility,
} from "@/lib/debug/calibration/pe4-as-of-t-features/dataset-emit";
import {
  auditCoverage,
  populationKey,
} from "@/lib/debug/calibration/pe4-as-of-t-features/coverage-audit";
import {
  expandTeamPerspectiveHistory,
  teamHistoryFor,
} from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import { PE4I15_PRODUCTION_WIRING } from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";
import { PE4I16_PRODUCTION_WIRING } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";

function fixture(partial: {
  id: string;
  kickoff: string;
  home: string;
  away: string;
  status?: string;
  hg?: number | null;
  ag?: number | null;
  competition?: string;
}): Pe4I16UniverseFixture {
  return {
    providerFixtureId: partial.id,
    providerCompetitionId: partial.competition ?? "39",
    providerCompetitionName: "Premier League",
    kickoffUtc: partial.kickoff,
    status: partial.status ?? "FT",
    homeTeamId: partial.home,
    awayTeamId: partial.away,
    homeGoals: partial.hg === undefined ? 1 : partial.hg,
    awayGoals: partial.ag === undefined ? 0 : partial.ag,
  };
}

function statsEnv(input: {
  fixtureId: string;
  homeId: string;
  awayId: string;
  homeXg?: number | null;
  awayXg?: number | null;
  homeShots?: number | null;
}): Pe4I2RawStatisticsEnvelope {
  const side = (
    teamId: string,
    xg: number | null | undefined,
    shots: number | null | undefined,
  ) => ({
    providerTeamId: teamId,
    teamName: null,
    statistics: [
      ...(xg == null
        ? []
        : [
            {
              rawName: "expected_goals",
              rawValue: xg,
              valuePresence: "present" as const,
              parseableNumeric: true,
              parsedNumeric: xg,
            },
          ]),
      ...(shots == null
        ? []
        : [
            {
              rawName: "Total Shots",
              rawValue: shots,
              valuePresence: "present" as const,
              parseableNumeric: true,
              parsedNumeric: shots,
            },
          ]),
    ],
  });
  return {
    schemaVersion: "pe4.acquisition.raw.v1",
    acquisitionVersion: "pe4.acquisition.infrastructure.v1",
    evidenceKind: "fixture_statistics",
    acquiredAtUtc: "2024-01-01T00:00:00.000Z",
    provider: "api-football",
    providerFixtureId: input.fixtureId,
    providerEnvelopeComplete: true,
    resultsCount: 2,
    teams: [
      side(input.homeId, input.homeXg, input.homeShots),
      side(input.awayId, input.awayXg, undefined),
    ],
    contentDigest: `digest-${input.fixtureId}`,
    vendorXgFieldObserved: input.homeXg != null || input.awayXg != null,
  };
}

function toyLedger() {
  const fixtures = [
    fixture({
      id: "H1",
      kickoff: "2024-01-01T15:00:00.000Z",
      home: "33",
      away: "40",
      hg: 2,
      ag: 1,
    }),
    fixture({
      id: "H2",
      kickoff: "2024-01-08T15:00:00.000Z",
      home: "33",
      away: "50",
      hg: 1,
      ag: 0,
    }),
    fixture({
      id: "H3",
      kickoff: "2024-01-15T15:00:00.000Z",
      home: "40",
      away: "33",
      hg: 0,
      ag: 2,
    }),
    fixture({
      id: "H4",
      kickoff: "2024-01-22T15:00:00.000Z",
      home: "33",
      away: "42",
      hg: 3,
      ag: 1,
    }),
    fixture({
      id: "T1",
      kickoff: "2024-02-01T15:00:00.000Z",
      home: "33",
      away: "55",
      hg: 1,
      ag: 1,
    }),
    fixture({
      id: "AET1",
      kickoff: "2024-02-05T15:00:00.000Z",
      home: "33",
      away: "60",
      status: "AET",
      hg: 2,
      ag: 1,
    }),
    fixture({
      id: "PEN1",
      kickoff: "2024-02-10T15:00:00.000Z",
      home: "40",
      away: "33",
      status: "PEN",
      hg: 1,
      ag: 1,
    }),
    fixture({
      id: "CANC1",
      kickoff: "2024-02-12T15:00:00.000Z",
      home: "33",
      away: "70",
      status: "CANC",
      hg: null,
      ag: null,
    }),
    fixture({
      id: "Canc2",
      kickoff: "2024-02-13T15:00:00.000Z",
      home: "33",
      away: "71",
      status: "Canc",
      hg: null,
      ag: null,
    }),
    fixture({
      id: "H2025",
      kickoff: "2025-03-01T15:00:00.000Z",
      home: "33",
      away: "80",
      hg: 2,
      ag: 0,
    }),
    fixture({
      id: "T2",
      kickoff: "2024-03-01T15:00:00.000Z",
      home: "40",
      away: "33",
      hg: 0,
      ag: 1,
    }),
  ];
  const seasons = new Map(fixtures.map((f) => [f.providerFixtureId, "2024"]));
  const stats = new Map([
    [
      "H1",
      statsEnv({
        fixtureId: "H1",
        homeId: "33",
        awayId: "40",
        homeXg: 1.4,
        awayXg: 0.7,
        homeShots: 12,
      }),
    ],
    [
      "H2",
      statsEnv({
        fixtureId: "H2",
        homeId: "33",
        awayId: "50",
        homeShots: 8,
      }),
    ],
    [
      "H3",
      statsEnv({
        fixtureId: "H3",
        homeId: "40",
        awayId: "33",
        homeXg: 0.9,
        awayXg: 1.5,
        homeShots: 6,
      }),
    ],
    [
      "H4",
      statsEnv({
        fixtureId: "H4",
        homeId: "33",
        awayId: "42",
        homeXg: 2.1,
        awayXg: 0.5,
        homeShots: 15,
      }),
    ],
    [
      "T1",
      statsEnv({
        fixtureId: "T1",
        homeId: "33",
        awayId: "55",
        homeXg: 1.0,
        awayXg: 1.0,
        homeShots: 10,
      }),
    ],
    [
      "T2",
      statsEnv({
        fixtureId: "T2",
        homeId: "40",
        awayId: "33",
        homeShots: 7,
      }),
    ],
  ]);
  const ok = materializeLedgerRowsInMemory({
    fixtures,
    seasons,
    statisticsByFixtureId: stats,
  });
  if (!ok.ok) throw new Error(ok.reason);
  return ok.value.rows;
}

describe("PE-4I.17 offline DEV feature dataset", () => {
  it("safety pins: PE3C=false, expectation UNAVAILABLE, G1 k=10, queue digest, holdout sealed, no production wiring", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(
      resolvePe4HistoricalExpectation({
        targetStrengthCommon: 1600,
        opponentStrengthCommon: 1500,
        targetVenueRole: "HOME",
        pairwiseAvailable: true,
        historicalCutoffUtc: "2024-01-01T00:00:00.000Z",
        targetSource: "catalogue",
        opponentSource: "catalogue",
      }).status,
    ).toBe("UNAVAILABLE");
    expect(goalsG1Protocol(10).selectedShrinkageK).toBe(10);
    expect(PE4I17_PARENT_QUEUE_DIGEST).toBe(PE4I5_FROZEN_STAGE2_QUEUE_DIGEST);
    expect(PE4I17_PRODUCTION_WIRING).toBe(false);
    expect(PE4I15_PRODUCTION_WIRING).toBe(false);
    expect(PE4I16_PRODUCTION_WIRING).toBe(false);
    expect(pe4I17Protocol().providerCallsForbidden).toBe(true);
    expect(pe4I17Protocol().outcomeLabelsSeparated).toBe(true);
    expect(
      isResearchHoldoutOutcomeEvidence({
        providerSeasonId: "2024",
        kickoffUtc: "2025-06-01T15:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("target eligibility: excludes holdout, AET/PEN, CANC/Canc; keeps FT DEV", () => {
    const ledger = toyLedger();
    const report = selectDevEligibleTargets(ledger);
    expect(report.eligibleFixtureIds).toContain("T1");
    expect(report.eligibleFixtureIds).toContain("T2");
    expect(report.eligibleFixtureIds).not.toContain("H2025");
    expect(report.eligibleFixtureIds).not.toContain("AET1");
    expect(report.eligibleFixtureIds).not.toContain("PEN1");
    expect(report.eligibleFixtureIds).not.toContain("CANC1");
    expect(report.eligibleFixtureIds).not.toContain("Canc2");
    expect(report.exclusionCounts.calendar_2025_holdout).toBeGreaterThan(0);
    expect(
      report.exclusionCounts.aet_pen_ambiguous_regulation_default_exclude,
    ).toBeGreaterThanOrEqual(2);
    expect(report.exclusionCounts.cancelled).toBeGreaterThanOrEqual(2);

    const holdout = ledger.find((r) => r.fixtureId === "H2025")!;
    expect(classifyDevTargetEligibility(holdout).eligible).toBe(false);
    expect(classifyDevTargetEligibility(holdout).reason).toBe(
      "calendar_2025_holdout",
    );
  });

  it("outcome labels are separated: mutate/remove labels → identical feature digest", () => {
    const ledger = toyLedger();
    const built = buildDevFeatureDatasetInMemory({ ledger, targetLimit: 2 });
    const digestBefore = built.pathADigest;

    const mutated = mutateSeparatedLabelGoals(
      built.labels,
      built.eligibility.eligibleFixtureIds[0]!,
      99,
      0,
    );
    expect(mutated.digest).not.toBe(built.labels.digest);

    // Rebuild features without consulting labels — digest unchanged.
    const rebuilt = buildDevFeatureDatasetInMemory({ ledger, targetLimit: 2 });
    expect(rebuilt.pathADigest).toBe(digestBefore);
    expect(rebuilt.pathBDigest).toBe(built.pathBDigest);

    // Labels artifact can be removed entirely; feature emit still works.
    const labelsOnly = buildSeparatedOutcomeLabels([]);
    expect(labelsOnly.labelCount).toBe(0);
    expect(rebuilt.pathARecords.length).toBeGreaterThan(0);
  });

  it("emits both team rows × all windows × venue modes; Path B preserves Path A population", () => {
    const ledger = toyLedger();
    const built = buildDevFeatureDatasetInMemory({ ledger, targetLimit: 2 });
    const expectedPerTarget =
      2 * PE4I17_EMIT_WINDOW_IDS.length * PE4I17_VENUE_MODES.length;
    expect(built.pathARecords.length).toBe(2 * expectedPerTarget);
    expect(built.pathBRecords.length).toBe(built.pathARecords.length);

    for (const windowId of PE4I17_EMIT_WINDOW_IDS) {
      expect(
        built.pathARecords.filter((r) => r.windowId === windowId).length,
      ).toBeGreaterThan(0);
    }
    for (const venueMode of PE4I17_VENUE_MODES) {
      expect(
        built.pathARecords.filter((r) => r.venueMode === venueMode).length,
      ).toBeGreaterThan(0);
    }

    const keysA = new Set(
      built.pathARecords.map((r) =>
        populationKey({
          targetFixtureId: r.targetFixtureId,
          teamId: r.teamId,
          windowId: r.windowId,
          venueMode: r.venueMode,
        }),
      ),
    );
    const keysB = new Set(built.pathBRecords.map((r) => r.populationKey));
    expect(keysB.size).toBe(keysA.size);
    for (const k of keysA) expect(keysB.has(k)).toBe(true);

    // Path B never zero-fills / population-shifts.
    for (const r of built.pathBRecords) {
      expect(r.pathB.zeroFillUsed).toBe(false);
      expect(r.pathB.populationShifted).toBe(false);
      expect(r.pathB.imputationUsed).toBe(false);
    }
  });

  it("history is strictly before T; rejects calendar-2025 history for DEV", () => {
    const ledger = toyLedger();
    const target = ledger.find((r) => r.fixtureId === "T2")!;
    const perspective = expandTeamPerspectiveHistory(ledger);
    const hist = teamHistoryFor(perspective, target.homeTeamId);
    const pair = emitFeatureRecordPair({
      target,
      teamId: target.homeTeamId,
      opponentId: target.awayTeamId,
      targetVenueRole: "HOME",
      teamHistory: hist,
      windowId: "last_5",
      venueMode: "all",
    });
    expect(pair.ok).toBe(true);
    if (!pair.ok) return;
    for (const hid of pair.value.pathA.historyFixtureIds) {
      const row = ledger.find((r) => r.fixtureId === hid)!;
      expect(row.kickoffUtc < target.kickoffUtc).toBe(true);
      expect(row.holdoutClassification).not.toBe(
        "calendar_2025_sealed_outcome",
      );
      expect(hid).not.toBe("H2025");
      expect(hid).not.toBe(target.fixtureId);
    }
  });

  it("AET/PEN history excluded from results/performance families (rejectRegulationAmbiguous)", () => {
    const ledger = toyLedger();
    const target = ledger.find((r) => r.fixtureId === "T2")!;
    const perspective = expandTeamPerspectiveHistory(ledger);
    const hist = teamHistoryFor(perspective, "33");
    const pair = emitFeatureRecordPair({
      target,
      teamId: "33",
      opponentId: target.homeTeamId === "33" ? target.awayTeamId : target.homeTeamId,
      targetVenueRole: target.homeTeamId === "33" ? "HOME" : "AWAY",
      teamHistory: hist,
      windowId: "last_10",
      venueMode: "all",
    });
    expect(pair.ok).toBe(true);
    if (!pair.ok) return;
    expect(pair.value.pathA.historyFixtureIds).not.toContain("AET1");
    expect(pair.value.pathA.historyFixtureIds).not.toContain("PEN1");
  });

  it("reproducibility: double emit + shuffled ledger → identical digests", () => {
    const ledger = toyLedger();
    const repro = verifyReproducibility({ ledger, targetLimit: 2 });
    expect(repro.pass).toBe(true);
    expect(repro.digestsMatch).toBe(true);
    expect(repro.emitPass1Digest).toBe(repro.emitPass2Digest);
    expect(repro.emitPass1Digest).toBe(repro.shuffledLedgerInputDigest);
  });

  it("coverage auditors: competition/window/team/depth/xg/aet/holdout", () => {
    const ledger = toyLedger();
    const built = buildDevFeatureDatasetInMemory({ ledger, targetLimit: 3 });
    const coverage = auditCoverage({
      ledger,
      pathARecords: built.pathARecords,
      pathBRecords: built.pathBRecords,
      pathAPopulationKeys: built.pathARecords.map((r) =>
        populationKey({
          targetFixtureId: r.targetFixtureId,
          teamId: r.teamId,
          windowId: r.windowId,
          venueMode: r.venueMode,
        }),
      ),
      eligibility: built.eligibility,
    });

    expect(coverage.xgCoverage.pathBPreservesPathAPopulation).toBe(true);
    expect(coverage.holdoutFirewall.devTargetsFrom2025).toBe(0);
    expect(coverage.holdoutFirewall.devHistoryFrom2025).toBe(0);
    expect(coverage.holdoutFirewall.rawCalendar2025PresentInLedger).toBeGreaterThan(
      0,
    );
    expect(coverage.holdoutFirewall.sealed).toBe(true);
    expect(coverage.aetPen.ledgerAetPenCount).toBeGreaterThanOrEqual(2);
    expect(coverage.aetPen.excludedAsDevTargets).toBeGreaterThanOrEqual(2);
    expect(Object.keys(coverage.byWindow).sort()).toEqual(
      [...PE4I17_EMIT_WINDOW_IDS].sort(),
    );
    expect(coverage.byTeam.uniqueTeams).toBeGreaterThan(0);
    expect(
      Object.values(coverage.historyDepth).some((n) => n > 0),
    ).toBe(true);
  });

  it("records carry required fields and providerCallsMade=0", () => {
    const ledger = toyLedger();
    const built = buildDevFeatureDatasetInMemory({ ledger, targetLimit: 1 });
    const r = built.pathARecords[0]!;
    expect(r.targetFixtureId).toBeTruthy();
    expect(r.kickoffUtc).toBeTruthy();
    expect(r.competition).toBeTruthy();
    expect(r.providerSeason).toBeTruthy();
    expect(r.teamId).toBeTruthy();
    expect(r.opponentId).toBeTruthy();
    expect(r.targetVenueRole === "HOME" || r.targetVenueRole === "AWAY").toBe(
      true,
    );
    expect(r.pathA.path).toBe("A_UNIVERSAL_NON_XG");
    expect(r.scheduleRest.familyId).toBe("schedule_rest");
    expect(r.availability.length).toBeGreaterThan(0);
    expect(r.missingCounts).toBeDefined();
    expect(r.ambiguityExclusions).toBeDefined();
    expect(Array.isArray(r.historyFixtureIds)).toBe(true);
    expect(r.provenanceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(r.providerCallsMade).toBe(0);
    expect(built.pathBRecords[0]!.providerCallsMade).toBe(0);
  });
});
