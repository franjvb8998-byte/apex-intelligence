/**
 * PE-4I.16 — Offline ledger + as-of-T feature vector tests.
 * Zero provider calls. No fitting / metrics.
 */

import { describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { isResearchHoldoutOutcomeEvidence } from "@/lib/debug/calibration/pe4-acquisition/holdout";
import { PE4I5_FROZEN_STAGE2_QUEUE_DIGEST } from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";
import {
  buildHistoricalMatchLedgerRow,
  presentNumeric,
  missingNumeric,
} from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import {
  materializeLedgerRowsInMemory,
  pe4I16LocalCachePresent,
  materializeOfflineLedger,
} from "@/lib/debug/calibration/pe4-as-of-t-features/ledger-materialize";
import {
  expandTeamPerspectiveHistory,
  countTeamPerspective,
  teamHistoryFor,
} from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import { selectAsOfTHistory } from "@/lib/debug/calibration/pe4-as-of-t-features/history-selector";
import { buildUniversalNonXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/universal-vector";
import { buildOptionalXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/xg-vector";
import { buildScheduleRestFeatures } from "@/lib/debug/calibration/pe4-as-of-t-features/schedule-rest-features";
import {
  joinOpponentStrengthAsOfKickoffM,
  PE4I16_OPPONENT_STRENGTH_UNAVAILABLE_REASON,
} from "@/lib/debug/calibration/pe4-as-of-t-features/opponent-strength-join";
import {
  buildAsOfTFeatureVector,
  pathAValidWhenXgAbsent,
} from "@/lib/debug/calibration/pe4-as-of-t-features/feature-vector";
import { digestFeatureVectorProvenance } from "@/lib/debug/calibration/pe4-as-of-t-features/provenance";
import {
  PE4I15_LAST_N_WINDOWS,
  PE4I15_CALENDAR_DAY_WINDOWS,
  PE4I15_WINDOW_CONTRACT,
} from "@/lib/debug/calibration/pe4-as-of-t-features/window-contract";
import {
  PE4I16_PRODUCTION_WIRING,
  PE4I16_PARENT_QUEUE_DIGEST,
  pe4I16Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";
import type { Pe4I16UniverseFixture } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger-materialize";
import type { Pe4I2RawStatisticsEnvelope } from "@/lib/debug/calibration/pe4-acquisition/envelopes";

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

describe("PE-4I.16 offline ledger + feature vectors", () => {
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
    expect(PE4I16_PARENT_QUEUE_DIGEST).toBe(PE4I5_FROZEN_STAGE2_QUEUE_DIGEST);
    expect(PE4I16_PRODUCTION_WIRING).toBe(false);
    expect(pe4I16Protocol().providerCallsForbidden).toBe(true);
    expect(
      isResearchHoldoutOutcomeEvidence({
        providerSeasonId: "2024",
        kickoffUtc: "2025-06-01T15:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("materialization counts + fail-closed conflicting identity", () => {
    const fixtures = [
      fixture({
        id: "M1",
        kickoff: "2024-01-01T15:00:00.000Z",
        home: "33",
        away: "40",
        hg: 2,
        ag: 1,
      }),
      fixture({
        id: "M2",
        kickoff: "2024-01-08T15:00:00.000Z",
        home: "33",
        away: "50",
        hg: 0,
        ag: 0,
      }),
      fixture({
        id: "M3",
        kickoff: "2024-01-15T15:00:00.000Z",
        home: "40",
        away: "33",
        status: "AET",
        hg: 3,
        ag: 2,
      }),
      fixture({
        id: "H2025",
        kickoff: "2025-03-01T15:00:00.000Z",
        home: "33",
        away: "42",
        hg: 1,
        ag: 1,
      }),
    ];
    const seasons = new Map([
      ["M1", "2024"],
      ["M2", "2024"],
      ["M3", "2024"],
      ["H2025", "2024"],
    ]);
    const stats = new Map([
      [
        "M1",
        statsEnv({
          fixtureId: "M1",
          homeId: "33",
          awayId: "40",
          homeXg: 1.2,
          awayXg: 0.8,
          homeShots: 10,
        }),
      ],
      [
        "M2",
        statsEnv({
          fixtureId: "M2",
          homeId: "33",
          awayId: "50",
          homeShots: 8,
        }),
      ],
    ]);

    const ok = materializeLedgerRowsInMemory({
      fixtures,
      seasons,
      statisticsByFixtureId: stats,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.value.rows).toHaveLength(4);
    expect(
      ok.value.rows.filter((r) => r.regulationAmbiguity).map((r) => r.fixtureId),
    ).toEqual(["M3"]);
    expect(
      ok.value.rows.filter(
        (r) => r.holdoutClassification === "calendar_2025_sealed_outcome",
      ),
    ).toHaveLength(1);
    expect(
      ok.value.rows.find((r) => r.fixtureId === "M2")?.home.expectedGoals
        .presence,
    ).toBe("missing");
    expect(
      ok.value.rows.find((r) => r.fixtureId === "M2")?.home.expectedGoals.value,
    ).toBeNull();

    const conflict = materializeLedgerRowsInMemory({
      fixtures: [
        fixture({
          id: "X",
          kickoff: "2024-01-01T15:00:00.000Z",
          home: "33",
          away: "40",
        }),
        fixture({
          id: "X",
          kickoff: "2024-01-02T15:00:00.000Z",
          home: "33",
          away: "40",
        }),
      ],
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.reason).toBe("conflicting_identity");
  });

  it("temporal fail-closed: self / future / same-kickoff rejected from history selection", () => {
    const rows = [
      buildHistoricalMatchLedgerRow({
        fixtureId: "T",
        competition: "39",
        providerSeason: "2024",
        kickoffUtc: "2024-06-01T15:00:00.000Z",
        status: "FT",
        homeTeamId: "33",
        awayTeamId: "40",
        home: { goals: presentNumeric(1) },
        away: { goals: presentNumeric(0) },
      }),
      buildHistoricalMatchLedgerRow({
        fixtureId: "FUTURE",
        competition: "39",
        providerSeason: "2024",
        kickoffUtc: "2024-07-01T15:00:00.000Z",
        status: "FT",
        homeTeamId: "33",
        awayTeamId: "50",
        home: { goals: presentNumeric(2) },
        away: { goals: presentNumeric(0) },
      }),
      buildHistoricalMatchLedgerRow({
        fixtureId: "PAST",
        competition: "39",
        providerSeason: "2024",
        kickoffUtc: "2024-05-01T15:00:00.000Z",
        status: "FT",
        homeTeamId: "33",
        awayTeamId: "42",
        home: { goals: presentNumeric(1) },
        away: { goals: presentNumeric(1) },
      }),
    ].map((r) => {
      expect(r.ok).toBe(true);
      return r.ok ? r.value : null;
    }).filter(Boolean);

    const perspective = expandTeamPerspectiveHistory(rows as NonNullable<(typeof rows)[number]>[]);
    const hist = teamHistoryFor(perspective, "33");
    const window = PE4I15_WINDOW_CONTRACT.find(
      (w) => w.kind === "last_n" && w.n === 5,
    )!;

    const sel = selectAsOfTHistory({
      teamId: "33",
      teamHistory: hist,
      target: { fixtureId: "T", kickoffUtc: "2024-06-01T15:00:00.000Z" },
      window,
      minObservations: 1,
      rejectRegulationAmbiguous: true,
    });
    expect(sel.ok).toBe(true);
    if (!sel.ok) return;
    expect(sel.value.selected.map((s) => s.fixtureId)).toEqual(["PAST"]);
    expect(sel.value.selected.some((s) => s.fixtureId === "T")).toBe(false);
    expect(sel.value.selected.some((s) => s.fixtureId === "FUTURE")).toBe(
      false,
    );
  });

  it("calendar-2025 retained in ledger storage but rejected from DEV history selection", () => {
    const built = materializeLedgerRowsInMemory({
      fixtures: [
        fixture({
          id: "P1",
          kickoff: "2024-05-01T15:00:00.000Z",
          home: "33",
          away: "40",
        }),
        fixture({
          id: "P2",
          kickoff: "2024-05-10T15:00:00.000Z",
          home: "33",
          away: "50",
        }),
        fixture({
          id: "P3",
          kickoff: "2024-05-20T15:00:00.000Z",
          home: "40",
          away: "33",
        }),
        fixture({
          id: "C2025",
          kickoff: "2025-02-01T15:00:00.000Z",
          home: "33",
          away: "42",
        }),
        fixture({
          id: "T",
          kickoff: "2025-06-01T15:00:00.000Z",
          home: "33",
          away: "55",
        }),
      ],
      seasons: new Map([
        ["P1", "2024"],
        ["P2", "2024"],
        ["P3", "2024"],
        ["C2025", "2024"],
        ["T", "2024"],
      ]),
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(
      built.value.rows.some(
        (r) =>
          r.fixtureId === "C2025" &&
          r.holdoutClassification === "calendar_2025_sealed_outcome",
      ),
    ).toBe(true);

    const perspective = expandTeamPerspectiveHistory(built.value.rows);
    const hist = teamHistoryFor(perspective, "33");
    const window = PE4I15_WINDOW_CONTRACT.find(
      (w) => w.kind === "last_n" && w.n === 10,
    )!;
    const sel = selectAsOfTHistory({
      teamId: "33",
      teamHistory: hist,
      target: { fixtureId: "T", kickoffUtc: "2025-06-01T15:00:00.000Z" },
      window,
      minObservations: 1,
      excludeCalendar2025HoldoutOutcomes: true,
    });
    expect(sel.ok).toBe(true);
    if (!sel.ok) return;
    expect(sel.value.selected.map((s) => s.fixtureId).includes("C2025")).toBe(
      false,
    );
    expect(sel.value.selected.map((s) => s.fixtureId).sort()).toEqual([
      "P1",
      "P2",
      "P3",
    ]);
  });

  it("AET/PEN excluded from results/performance aggregates", () => {
    const rows = [
      buildHistoricalMatchLedgerRow({
        fixtureId: "FT1",
        competition: "39",
        providerSeason: "2024",
        kickoffUtc: "2024-01-01T15:00:00.000Z",
        status: "FT",
        homeTeamId: "33",
        awayTeamId: "40",
        home: { goals: presentNumeric(2), shots: presentNumeric(10) },
        away: { goals: presentNumeric(1), shots: presentNumeric(5) },
      }),
      buildHistoricalMatchLedgerRow({
        fixtureId: "AET1",
        competition: "39",
        providerSeason: "2024",
        kickoffUtc: "2024-01-08T15:00:00.000Z",
        status: "AET",
        homeTeamId: "33",
        awayTeamId: "50",
        regulationAmbiguity: true,
        home: { goals: presentNumeric(3), shots: presentNumeric(12) },
        away: { goals: presentNumeric(2), shots: presentNumeric(8) },
      }),
      buildHistoricalMatchLedgerRow({
        fixtureId: "PEN1",
        competition: "39",
        providerSeason: "2024",
        kickoffUtc: "2024-01-15T15:00:00.000Z",
        status: "PEN",
        homeTeamId: "40",
        awayTeamId: "33",
        regulationAmbiguity: true,
        home: { goals: presentNumeric(1), shots: presentNumeric(7) },
        away: { goals: presentNumeric(1), shots: presentNumeric(9) },
      }),
      buildHistoricalMatchLedgerRow({
        fixtureId: "FT2",
        competition: "39",
        providerSeason: "2024",
        kickoffUtc: "2024-01-22T15:00:00.000Z",
        status: "FT",
        homeTeamId: "33",
        awayTeamId: "42",
        home: { goals: presentNumeric(0), shots: presentNumeric(4) },
        away: { goals: presentNumeric(0), shots: presentNumeric(6) },
      }),
    ].map((r) => {
      expect(r.ok).toBe(true);
      return r.ok ? r.value : null!;
    });

    const perspective = expandTeamPerspectiveHistory(rows);
    const hist = teamHistoryFor(perspective, "33");
    const window = PE4I15_WINDOW_CONTRACT.find(
      (w) => w.kind === "last_n" && w.n === 10,
    )!;
    const sel = selectAsOfTHistory({
      teamId: "33",
      teamHistory: hist,
      target: {
        fixtureId: "T_TARGET",
        kickoffUtc: "2024-02-01T15:00:00.000Z",
      },
      window,
      minObservations: 1,
      rejectRegulationAmbiguous: true,
    });
    expect(sel.ok).toBe(true);
    if (!sel.ok) return;
    expect(sel.value.selected.map((s) => s.fixtureId).sort()).toEqual([
      "FT1",
      "FT2",
    ]);
    const vec = buildUniversalNonXgVector(sel.value.selected);
    expect(vec.results.resultObsCount).toBe(2);
    expect(vec.observationCount).toBe(2);
  });

  it("provenance digest is order-independent for history fixture IDs", () => {
    const base = {
      targetFixtureId: "T",
      targetKickoffUtc: "2024-06-01T15:00:00.000Z",
      evidenceCutoffUtc: "2024-06-01T15:00:00.000Z",
      windowId: "last_5" as const,
      observationCount: 3,
      competitionCounts: { "39": 2, "2": 1 },
      availability: [
        {
          familyId: "recent_results" as const,
          status: "AVAILABLE" as const,
          observationCount: 3,
          missingCount: 0,
        },
      ],
      holdoutClassification: "dev_or_conf_eligible" as const,
      protocolVersion: "test",
    };
    const a = digestFeatureVectorProvenance({
      ...base,
      historyFixtureIds: ["c", "a", "b"],
    });
    const b = digestFeatureVectorProvenance({
      ...base,
      historyFixtureIds: ["b", "c", "a"],
    });
    expect(a.digest).toBe(b.digest);
    expect(a.historyFixtureIds).toEqual(["a", "b", "c"]);
  });

  it("xG missing is not zero-filled; Path A valid when xG absent", () => {
    const rows = [1, 2, 3, 4, 5].map((i) => {
      const r = buildHistoricalMatchLedgerRow({
        fixtureId: `M${i}`,
        competition: "39",
        providerSeason: "2024",
        kickoffUtc: `2024-0${i}-01T15:00:00.000Z`,
        status: "FT",
        homeTeamId: "33",
        awayTeamId: String(40 + i),
        home: {
          goals: presentNumeric(1),
          shots: presentNumeric(8),
          expectedGoals: missingNumeric(),
        },
        away: {
          goals: presentNumeric(0),
          shots: presentNumeric(4),
          expectedGoals: missingNumeric(),
        },
      });
      expect(r.ok).toBe(true);
      return r.ok ? r.value : null!;
    });
    const perspective = expandTeamPerspectiveHistory(rows);
    const hist = teamHistoryFor(perspective, "33");
    const window = PE4I15_WINDOW_CONTRACT.find(
      (w) => w.kind === "last_n" && w.n === 5,
    )!;
    const built = buildAsOfTFeatureVector({
      teamId: "33",
      teamHistory: hist,
      target: {
        fixtureId: "TARGET",
        kickoffUtc: "2024-06-01T15:00:00.000Z",
      },
      window,
      minObservations: 3,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.pathB.anyXgPresent).toBe(false);
    expect(built.value.pathB.expectedGoalsFor.mean).toBeNull();
    expect(built.value.pathB.expectedGoalsFor.missingCount).toBe(
      built.value.pathA.observationCount,
    );
    expect(built.value.pathB.zeroFillUsed).toBe(false);
    expect(built.value.pathA.observationCount).toBe(5);
    expect(built.value.pathA.shotsFor.mean).toBe(8);
    expect(pathAValidWhenXgAbsent(built.value)).toBe(true);

    const xgOnlyMissing = buildOptionalXgVector(built.value.historySelection.selected);
    expect(xgOnlyMissing.expectedGoalsFor.sum).toBeNull();
    expect(xgOnlyMissing.populationShifted).toBe(false);
  });

  it("windows implemented: N={3,5,8,10} and days={30,60,90}; venue home/away splits", () => {
    expect([...PE4I15_LAST_N_WINDOWS]).toEqual([3, 5, 8, 10]);
    expect([...PE4I15_CALENDAR_DAY_WINDOWS]).toEqual([30, 60, 90]);

    const rows = [1, 2, 3, 4, 5, 6].map((i) => {
      const home = i % 2 === 1;
      const r = buildHistoricalMatchLedgerRow({
        fixtureId: `W${i}`,
        competition: "39",
        providerSeason: "2024",
        kickoffUtc: `2024-01-${String(i).padStart(2, "0")}T15:00:00.000Z`,
        status: "FT",
        homeTeamId: home ? "33" : "40",
        awayTeamId: home ? "40" : "33",
        home: { goals: presentNumeric(1) },
        away: { goals: presentNumeric(0) },
      });
      expect(r.ok).toBe(true);
      return r.ok ? r.value : null!;
    });
    const perspective = expandTeamPerspectiveHistory(rows);
    const hist = teamHistoryFor(perspective, "33");
    const last3 = PE4I15_WINDOW_CONTRACT.find(
      (w) => w.kind === "last_n" && w.n === 3,
    )!;
    const homeSel = selectAsOfTHistory({
      teamId: "33",
      teamHistory: hist,
      target: {
        fixtureId: "T",
        kickoffUtc: "2024-02-01T15:00:00.000Z",
      },
      window: last3,
      minObservations: 1,
      venueFilter: "home",
    });
    expect(homeSel.ok).toBe(true);
    if (!homeSel.ok) return;
    expect(homeSel.value.selected.every((s) => s.venueRole === "HOME")).toBe(
      true,
    );

    const rest = buildScheduleRestFeatures({
      teamHistory: hist,
      targetKickoffUtc: "2024-02-01T15:00:00.000Z",
      targetFixtureId: "T",
    });
    expect(rest.status).toBe("AVAILABLE");
    expect(rest.matchesInLast28d).toBeGreaterThan(0);
    expect(rest.daysSincePreviousMatch).not.toBeNull();
    expect(rest.noFatigueMultiplier).toBe(true);
  });

  it("opponent strength join is UNAVAILABLE without offline strength catalogue", () => {
    const join = joinOpponentStrengthAsOfKickoffM({
      selectedHistory: [],
      targetKickoffUtc: "2024-06-01T15:00:00.000Z",
    });
    expect(join.status).toBe("UNAVAILABLE");
    if (join.status !== "UNAVAILABLE") return;
    expect(join.reason).toBe(PE4I16_OPPONENT_STRENGTH_UNAVAILABLE_REASON);
  });

  it("team-perspective expands both sides", () => {
    const row = buildHistoricalMatchLedgerRow({
      fixtureId: "M",
      competition: "39",
      providerSeason: "2024",
      kickoffUtc: "2024-01-01T15:00:00.000Z",
      status: "FT",
      homeTeamId: "33",
      awayTeamId: "40",
      home: { goals: presentNumeric(2) },
      away: { goals: presentNumeric(1) },
    });
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    const perspective = expandTeamPerspectiveHistory([row.value]);
    expect(perspective).toHaveLength(2);
    const counts = countTeamPerspective(perspective, 1);
    expect(counts.byVenueRole).toEqual({ HOME: 1, AWAY: 1 });
  });

  it("offline materialization against local cache when present", () => {
    if (!pe4I16LocalCachePresent()) {
      expect(true).toBe(true);
      return;
    }
    const { rows, report } = materializeOfflineLedger({
      writeArtifacts: true,
    });
    expect(report.providerCallsMade).toBe(0);
    expect(report.parentQueueDigest).toBe(PE4I5_FROZEN_STAGE2_QUEUE_DIGEST);
    expect(report.statisticsEnvelopeCount).toBe(1094);
    expect(rows.length).toBeGreaterThan(1000);
    expect(report.ledgerDigest).toHaveLength(64);
    expect(report.calendar2025InLedger).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
