/**
 * PE-4I.15 — Unit tests: temporal fail-closed, holdout, presence, windows, digest.
 * Offline only. Zero provider calls.
 */

import { describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { isResearchHoldoutOutcomeEvidence } from "@/lib/debug/calibration/pe4-acquisition/holdout";
import { PE4I5_FROZEN_STAGE2_QUEUE_DIGEST } from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";
import {
  PE4I15_AET_PEN_CONTRACT,
  PE4I15_FEATURE_FAMILY_SPECS,
  PE4I15_LAST_N_WINDOWS,
  PE4I15_CALENDAR_DAY_WINDOWS,
  PE4I15_OPPONENT_STRENGTH_CONTRACT,
  PE4I15_PARENT_QUEUE_DIGEST,
  PE4I15_SCHEDULE_REST_CONTRACT,
  PE4I15_UNSUPPORTED_FEATURES,
  PE4I15_WINDOW_CONTRACT,
  PE4I15_XG_HETEROGENEITY_CONTRACT,
  assertOpponentStrengthCutoffIsKickoffM,
  buildHistoricalMatchLedgerRow,
  classifyRegulationStatus,
  digestFeatureVectorProvenance,
  digestPe4I15Protocol,
  familyMayConsumeRegulation,
  filterEligibleHistoryForTarget,
  filterOutCalendar2025Outcomes,
  measureXgCoverage,
  pe4I15Protocol,
  presentNumeric,
  missingNumeric,
  researchHoldoutOutcomeEvidenceIsSealed,
  selectWindow,
  validateHistoryAgainstTarget,
  mayUseOutcomeInResearchPool,
} from "@/lib/debug/calibration/pe4-as-of-t-features";

describe("PE-4I.15 as-of-T feature construction plan", () => {
  it("safety pins: activation false, expectation UNAVAILABLE, G1 k=10, queue digest, holdout sealed", () => {
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
    expect(PE4I15_PARENT_QUEUE_DIGEST).toBe(
      "876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f",
    );
    expect(PE4I15_PARENT_QUEUE_DIGEST).toBe(PE4I5_FROZEN_STAGE2_QUEUE_DIGEST);
    expect(
      isResearchHoldoutOutcomeEvidence({
        providerSeasonId: "2024",
        kickoffUtc: "2025-06-01T15:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      researchHoldoutOutcomeEvidenceIsSealed({
        providerSeasonId: "2024",
        kickoffUtc: "2025-06-01T15:00:00.000Z",
      }),
    ).toBe(true);
    expect(pe4I15Protocol().productionWiring).toBe(false);
    expect(pe4I15Protocol().modelingForbidden).toBe(true);
    expect(digestPe4I15Protocol()).toHaveLength(64);
  });

  it("fail-closed temporal filters: self, same-kickoff, future, missing kickoff", () => {
    const target = {
      fixtureId: "T1",
      kickoffUtc: "2024-10-01T15:00:00.000Z",
    };

    expect(
      validateHistoryAgainstTarget({
        historical: {
          fixtureId: "T1",
          kickoffUtc: "2024-09-01T15:00:00.000Z",
        },
        target,
      }).ok,
    ).toBe(false);

    expect(
      validateHistoryAgainstTarget({
        historical: {
          fixtureId: "M1",
          kickoffUtc: "2024-10-01T15:00:00.000Z",
        },
        target,
      }).ok,
    ).toBe(false);

    expect(
      validateHistoryAgainstTarget({
        historical: {
          fixtureId: "M2",
          kickoffUtc: "2024-11-01T15:00:00.000Z",
        },
        target,
      }).ok,
    ).toBe(false);

    {
      const missingKickoff = validateHistoryAgainstTarget({
        historical: { fixtureId: "M3", kickoffUtc: "" },
        target,
      });
      expect(missingKickoff.ok).toBe(false);
      if (!missingKickoff.ok) {
        expect(missingKickoff.reason).toBe("missing_kickoff");
      }
    }

    expect(
      validateHistoryAgainstTarget({
        historical: {
          fixtureId: "M4",
          kickoffUtc: "2024-09-01T15:00:00.000Z",
        },
        target,
      }).ok,
    ).toBe(true);
  });

  it("excludes calendar-2025 holdout outcomes from DEV research pools", () => {
    const target = {
      fixtureId: "T1",
      kickoffUtc: "2025-03-01T15:00:00.000Z",
    };
    const result = filterEligibleHistoryForTarget({
      candidates: [
        {
          fixtureId: "H2024",
          kickoffUtc: "2024-12-20T15:00:00.000Z",
          homeTeamId: "1",
          awayTeamId: "2",
        },
        {
          fixtureId: "H2025",
          kickoffUtc: "2025-01-15T15:00:00.000Z",
          homeTeamId: "1",
          awayTeamId: "2",
        },
      ],
      target,
      excludeCalendar2025HoldoutOutcomes: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accepted.map((a) => a.fixtureId)).toEqual(["H2024"]);
    expect(
      result.value.rejected.some(
        (r) => r.reason === "calendar_2025_holdout_outcome_excluded",
      ),
    ).toBe(true);

    expect(
      mayUseOutcomeInResearchPool({
        kickoffUtc: "2025-01-15T15:00:00.000Z",
        pool: "DEV_FITTING",
      }),
    ).toBe(false);
    expect(
      mayUseOutcomeInResearchPool({
        kickoffUtc: "2025-01-15T15:00:00.000Z",
        pool: "LEDGER_STORAGE",
      }),
    ).toBe(true);

    expect(
      filterOutCalendar2025Outcomes([
        { kickoffUtc: "2024-06-01T00:00:00.000Z", id: "a" },
        { kickoffUtc: "2025-06-01T00:00:00.000Z", id: "b" },
      ]).map((r) => r.id),
    ).toEqual(["a"]);
  });

  it("fail-closed on duplicates, conflicting identity, malformed teams, incomplete stats, AET/PEN", () => {
    const target = {
      fixtureId: "T1",
      kickoffUtc: "2024-10-01T15:00:00.000Z",
    };

    const dup = filterEligibleHistoryForTarget({
      candidates: [
        {
          fixtureId: "M1",
          kickoffUtc: "2024-09-01T15:00:00.000Z",
        },
        {
          fixtureId: "M1",
          kickoffUtc: "2024-09-01T15:00:00.000Z",
        },
      ],
      target,
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.reason).toBe("duplicate_fixture_id");

    const conflict = filterEligibleHistoryForTarget({
      candidates: [
        {
          fixtureId: "M1",
          kickoffUtc: "2024-09-01T15:00:00.000Z",
          homeTeamId: "1",
          awayTeamId: "2",
        },
        {
          fixtureId: "M1",
          kickoffUtc: "2024-09-02T15:00:00.000Z",
          homeTeamId: "1",
          awayTeamId: "2",
        },
      ],
      target,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.reason).toBe("conflicting_identity");

    {
      const malformedTeams = validateHistoryAgainstTarget({
        historical: {
          fixtureId: "M2",
          kickoffUtc: "2024-09-01T15:00:00.000Z",
          homeTeamId: "1",
          awayTeamId: "1",
        },
        target,
        requireTeams: true,
      });
      expect(malformedTeams.ok).toBe(false);
      if (!malformedTeams.ok) {
        expect(malformedTeams.reason).toBe("malformed_teams");
      }
    }

    {
      const incomplete = validateHistoryAgainstTarget({
        historical: {
          fixtureId: "M3",
          kickoffUtc: "2024-09-01T15:00:00.000Z",
          incompleteStats: true,
        },
        target,
        requireCompleteStats: true,
      });
      expect(incomplete.ok).toBe(false);
      if (!incomplete.ok) {
        expect(incomplete.reason).toBe("incomplete_stats");
      }
    }

    {
      const aetPen = validateHistoryAgainstTarget({
        historical: {
          fixtureId: "M4",
          kickoffUtc: "2024-09-01T15:00:00.000Z",
          regulationAmbiguous: true,
        },
        target,
        rejectRegulationAmbiguous: true,
      });
      expect(aetPen.ok).toBe(false);
      if (!aetPen.ok) {
        expect(aetPen.reason).toBe("aet_pen_ambiguous_regulation");
      }
    }
  });

  it("ledger presence semantics: missing ≠ zero; AET sets regulationAmbiguity", () => {
    const row = buildHistoricalMatchLedgerRow({
      fixtureId: "100",
      competition: "39",
      providerSeason: "2024",
      kickoffUtc: "2024-08-01T15:00:00.000Z",
      status: "AET",
      homeTeamId: "33",
      awayTeamId: "34",
      home: {
        teamId: "33",
        goals: presentNumeric(1),
        expectedGoals: missingNumeric(),
        shots: presentNumeric(0),
        shotsOnTarget: missingNumeric(),
        possession: missingNumeric(),
        corners: missingNumeric(),
        yellowCards: missingNumeric(),
        redCards: missingNumeric(),
      },
    });
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.value.regulationAmbiguity).toBe(true);
    expect(row.value.home.expectedGoals.presence).toBe("missing");
    expect(row.value.home.expectedGoals.value).toBeNull();
    expect(row.value.home.shots.presence).toBe("present");
    expect(row.value.home.shots.value).toBe(0);
    expect(row.value.holdoutClassification).toBe("dev_or_conf_eligible");

    const cal2025 = buildHistoricalMatchLedgerRow({
      fixtureId: "101",
      competition: "39",
      providerSeason: "2024",
      kickoffUtc: "2025-01-10T15:00:00.000Z",
      status: "FT",
      homeTeamId: "33",
      awayTeamId: "34",
    });
    expect(cal2025.ok).toBe(true);
    if (!cal2025.ok) return;
    expect(cal2025.value.holdoutClassification).toBe(
      "calendar_2025_sealed_outcome",
    );
  });

  it("window selection is deterministic; all N and days proceed", () => {
    expect([...PE4I15_LAST_N_WINDOWS]).toEqual([3, 5, 8, 10]);
    expect([...PE4I15_CALENDAR_DAY_WINDOWS]).toEqual([30, 60, 90]);
    expect(PE4I15_WINDOW_CONTRACT.every((w) => w.proceeds)).toBe(true);

    const targetKickoffUtc = "2024-10-20T15:00:00.000Z";
    const eligible = [
      {
        fixtureId: "a",
        kickoffUtc: "2024-10-01T15:00:00.000Z",
        competition: "39",
        venueRole: "HOME" as const,
      },
      {
        fixtureId: "b",
        kickoffUtc: "2024-10-05T15:00:00.000Z",
        competition: "39",
        venueRole: "AWAY" as const,
      },
      {
        fixtureId: "c",
        kickoffUtc: "2024-10-10T15:00:00.000Z",
        competition: "2",
        venueRole: "HOME" as const,
      },
      {
        fixtureId: "d",
        kickoffUtc: "2024-09-01T15:00:00.000Z",
        competition: "39",
        venueRole: "HOME" as const,
      },
      // same kickoff tie → fixture_id asc
      {
        fixtureId: "e1",
        kickoffUtc: "2024-10-15T15:00:00.000Z",
        competition: "39",
        venueRole: "HOME" as const,
      },
      {
        fixtureId: "e0",
        kickoffUtc: "2024-10-15T15:00:00.000Z",
        competition: "39",
        venueRole: "AWAY" as const,
      },
    ];

    const last3 = selectWindow({
      eligibleChronological: eligible,
      targetKickoffUtc,
      window: { kind: "last_n", n: 3, proceeds: true, justification: "t" },
      minObservations: 3,
    });
    expect(last3.ok).toBe(true);
    if (!last3.ok) return;
    expect(last3.value.selected.map((s) => s.fixtureId)).toEqual([
      "c",
      "e0",
      "e1",
    ]);
    expect(last3.value.belowMinObservations).toBe(false);

    const days30 = selectWindow({
      eligibleChronological: eligible,
      targetKickoffUtc,
      window: {
        kind: "calendar_days",
        days: 30,
        proceeds: true,
        justification: "t",
      },
      minObservations: 3,
    });
    expect(days30.ok).toBe(true);
    if (!days30.ok) return;
    // d is ~49 days before → excluded from 30d
    expect(days30.value.selected.map((s) => s.fixtureId)).toEqual([
      "a",
      "b",
      "c",
      "e0",
      "e1",
    ]);

    const homeOnly = selectWindow({
      eligibleChronological: eligible,
      targetKickoffUtc,
      window: { kind: "last_n", n: 3, proceeds: true, justification: "t" },
      minObservations: 2,
      venueRoleFilter: "HOME",
    });
    expect(homeOnly.ok).toBe(true);
    if (!homeOnly.ok) return;
    expect(homeOnly.value.selected.every((s) => s.venueRole === "HOME")).toBe(
      true,
    );
  });

  it("xG coverage counts; zero-fill forbidden; AET family gates; contracts present", () => {
    const coverage = measureXgCoverage([
      { fixtureId: "1", home: "present", away: "present" },
      { fixtureId: "2", home: "present", away: "missing" },
      { fixtureId: "3", home: "missing", away: "missing" },
      { fixtureId: "4", home: "ambiguous", away: "missing" },
    ]);
    expect(coverage.fixturesConsidered).toBe(4);
    expect(coverage.xgPresentSides).toBe(3);
    expect(coverage.fixturesWithBothSidesXg).toBe(1);
    expect(coverage.fixturesWithAnyXg).toBe(2);
    expect(coverage.fixturesWithNoXg).toBe(2);
    expect(PE4I15_XG_HETEROGENEITY_CONTRACT.zeroFillForbidden).toBe(true);
    expect(PE4I15_XG_HETEROGENEITY_CONTRACT.imputationForbidden).toBe(true);

    expect(classifyRegulationStatus("FT")).toBe("FT_REGULATION");
    expect(classifyRegulationStatus("AET")).toBe("AET_PEN_AMBIGUOUS");
    expect(
      familyMayConsumeRegulation({
        familyId: "recent_results",
        regulationClass: "AET_PEN_AMBIGUOUS",
      }),
    ).toBe(false);
    expect(
      familyMayConsumeRegulation({
        familyId: "schedule_rest",
        regulationClass: "AET_PEN_AMBIGUOUS",
      }),
    ).toBe(true);
    expect(PE4I15_AET_PEN_CONTRACT.neverInventRegulationOnlySplit).toBe(true);

    expect(PE4I15_FEATURE_FAMILY_SPECS).toHaveLength(6);
    expect(PE4I15_SCHEDULE_REST_CONTRACT.noG1Mutation).toBe(true);
    expect(PE4I15_OPPONENT_STRENGTH_CONTRACT.forbidCutoffAtTargetT).toBe(true);
    expect(
      assertOpponentStrengthCutoffIsKickoffM({
        strengthCutoffUtc: "2024-09-01T15:00:00.000Z",
        historicalKickoffUtc: "2024-09-01T15:00:00.000Z",
        targetKickoffUtc: "2024-10-01T15:00:00.000Z",
      }).ok,
    ).toBe(true);
    expect(
      assertOpponentStrengthCutoffIsKickoffM({
        strengthCutoffUtc: "2024-10-01T15:00:00.000Z",
        historicalKickoffUtc: "2024-09-01T15:00:00.000Z",
        targetKickoffUtc: "2024-10-01T15:00:00.000Z",
      }).ok,
    ).toBe(false);
    expect(PE4I15_UNSUPPORTED_FEATURES.length).toBeGreaterThan(0);
  });

  it("provenance digest is stable and order-independent for history IDs", () => {
    const base = {
      targetFixtureId: "T1",
      targetKickoffUtc: "2024-10-01T15:00:00.000Z",
      evidenceCutoffUtc: "2024-10-01T15:00:00.000Z",
      windowId: "last_5" as const,
      observationCount: 2,
      competitionCounts: { "39": 2 },
      availability: [
        {
          familyId: "recent_results" as const,
          status: "AVAILABLE" as const,
          observationCount: 2,
          missingCount: 0,
        },
      ],
      holdoutClassification: "dev_or_conf_eligible" as const,
      protocolVersion: pe4I15Protocol().protocolVersion,
    };
    const d1 = digestFeatureVectorProvenance({
      ...base,
      historyFixtureIds: ["b", "a"],
    });
    const d2 = digestFeatureVectorProvenance({
      ...base,
      historyFixtureIds: ["a", "b"],
    });
    expect(d1.digest).toBe(d2.digest);
    expect(d1.digest).toHaveLength(64);
    expect(d1.historyFixtureIds).toEqual(["a", "b"]);

    const d3 = digestFeatureVectorProvenance({
      ...base,
      historyFixtureIds: ["a", "b", "c"],
    });
    expect(d3.digest).not.toBe(d1.digest);
  });
});
