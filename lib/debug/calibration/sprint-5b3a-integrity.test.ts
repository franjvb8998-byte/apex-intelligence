/**
 * Sprint 5B.3A final integrity audit — offline harness only.
 */

import { describe, expect, it } from "vitest";
import {
  assertChronologicalSplit,
  assertSeasonListCompleteForCalibration,
  assignChronologicalFold,
  BOOKMAKER_ODDS_TIMING_DISCLAIMER,
  bookmakerBaselineReportLabel,
  bookmakerMetricRows,
  buildCalibrationRow,
  buildLabeledCalibrationRows,
  createCollectionRunMetadata,
  createDefaultEloPolicies,
  createSyntheticCalibrationRows,
  createSyntheticLeagueFixtures,
  dedupeReconstructionFixtures,
  estimateCollectionBudget,
  evaluateCalibrationRows,
  EXAMPLE_CHRONOLOGICAL_SPLIT,
  EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS,
  fixtureCalibrationRole,
  IncompleteSeasonListError,
  isValidOneXTwo,
  logLossOneXTwo,
  LOG_LOSS_EPS,
  oddsMayBeDescribedAsKnownAtKickoff,
  PILOT_COLLECTION_STAGES,
  planFixtureListPages,
  prepareCalibrationFixtures,
  reconstructTeamRecord,
  summarizeMetrics,
} from "@/lib/debug/calibration";
import { createEloPoissonHybridEngine } from "@/lib/intelligence/modules/probability";
import type { ReconstructionFixture } from "@/lib/debug/calibration/types";

function baseFixture(
  overrides: Partial<ReconstructionFixture> & Pick<ReconstructionFixture, "fixtureId">,
): ReconstructionFixture {
  return {
    kickoff: "2024-08-10T15:00:00.000Z",
    competitionId: "syn-league",
    season: "2024",
    homeTeamId: "alpha",
    awayTeamId: "beta",
    status: "FT",
    goalsHome: 1,
    goalsAway: 0,
    fulltimeHome: 1,
    fulltimeAway: 0,
    ...overrides,
  };
}

describe("Sprint 5B.3A integrity — season pagination", () => {
  it("fails loudly when paging is missing or total > 1", () => {
    expect(() => assertSeasonListCompleteForCalibration(null)).toThrow(
      IncompleteSeasonListError,
    );
    expect(() =>
      assertSeasonListCompleteForCalibration({ current: 1, total: 2 }),
    ).toThrow(/paging.total=2/);
    expect(() =>
      prepareCalibrationFixtures([baseFixture({ fixtureId: "a" })], {
        current: 1,
        total: 2,
      }),
    ).toThrow(IncompleteSeasonListError);
  });

  it("accepts a proven single complete page and plans pages 1..N without fetching", () => {
    expect(() =>
      assertSeasonListCompleteForCalibration({ current: 1, total: 1 }),
    ).not.toThrow();
    expect(planFixtureListPages(3)).toEqual([1, 2, 3]);
  });

  it("will not silently turn a paginated season into labeled rows", () => {
    expect(() =>
      buildLabeledCalibrationRows({
        fixtures: createSyntheticLeagueFixtures(),
        paging: { current: 1, total: 2 },
      }),
    ).toThrow(IncompleteSeasonListError);
  });
});

describe("Sprint 5B.3A integrity — reconstruction order and same-kickoff", () => {
  const fixtures = createSyntheticLeagueFixtures();
  const target = fixtures.find((row) => row.fixtureId === "lg-target")!;

  it("is invariant to input order and ignores the target and later fixtures", () => {
    const reversed = [...fixtures].reverse();
    const a = reconstructTeamRecord({
      teamId: "alpha",
      kickoff: target.kickoff,
      competitionId: "syn-league",
      season: "2024",
      fixtures,
    });
    const b = reconstructTeamRecord({
      teamId: "alpha",
      kickoff: target.kickoff,
      competitionId: "syn-league",
      season: "2024",
      fixtures: reversed,
    });
    expect(a).toEqual(b);
    expect(a.played).toBe(2);
  });

  it("does not leak a same-timestamp sibling into pre-match stats", () => {
    const twin = baseFixture({
      fixtureId: "same-kickoff-other",
      kickoff: target.kickoff,
      homeTeamId: "alpha",
      awayTeamId: "omega",
      goalsHome: 9,
      goalsAway: 0,
    });
    const withTwin = reconstructTeamRecord({
      teamId: "alpha",
      kickoff: target.kickoff,
      competitionId: "syn-league",
      season: "2024",
      fixtures: [...fixtures, twin],
    });
    const withoutTwin = reconstructTeamRecord({
      teamId: "alpha",
      kickoff: target.kickoff,
      competitionId: "syn-league",
      season: "2024",
      fixtures,
    });
    expect(withTwin).toEqual(withoutTwin);
  });
});

describe("Sprint 5B.3A integrity — status and score eligibility", () => {
  it("documents prior/target/label eligibility", () => {
    expect(fixtureCalibrationRole("FT").canProvideOutcomeLabel).toBe(true);
    expect(fixtureCalibrationRole("AET").contributeToPrior).toBe(true);
    expect(fixtureCalibrationRole("PEN").eligibleTarget).toBe(true);
    for (const status of ["PST", "CANC", "ABD", "AWD", "WO", "SUSP", "LIVE"]) {
      const role = fixtureCalibrationRole(status);
      expect(role.contributeToPrior).toBe(false);
      expect(role.eligibleTarget).toBe(false);
      expect(role.canProvideOutcomeLabel).toBe(false);
    }
  });

  it("does not label cancelled/awarded fixtures even when a score is present", () => {
    const cancelled = baseFixture({
      fixtureId: "canc-with-score",
      status: "CANC",
      goalsHome: 3,
      goalsAway: 0,
    });
    const row = buildCalibrationRow({
      target: cancelled,
      fixtures: [cancelled],
    });
    expect(row.actualOutcome).toBeNull();
    expect(row.actualHomeGoals).toBeNull();
  });
});

describe("Sprint 5B.3A integrity — duplicate fixtures", () => {
  it("dedupes identical IDs and refuses conflicting duplicates", () => {
    const a = baseFixture({ fixtureId: "dup" });
    const clone = { ...a };
    const conflict = baseFixture({ fixtureId: "dup", goalsHome: 8 });
    expect(dedupeReconstructionFixtures([a, clone]).afterCount).toBe(1);
    expect(() => dedupeReconstructionFixtures([a, conflict])).toThrow(
      /Conflicting duplicate fixture dup/,
    );
  });

  it("emits one labeled row per fixture id", () => {
    const prior = baseFixture({
      fixtureId: "prior",
      kickoff: "2024-08-01T15:00:00.000Z",
    });
    const target = baseFixture({ fixtureId: "target" });
    const rows = buildLabeledCalibrationRows({
      fixtures: [prior, target, { ...target }],
      paging: { current: 1, total: 1 },
    });
    expect(rows.filter((row) => row.fixtureId === "target")).toHaveLength(1);
  });
});

describe("Sprint 5B.3A integrity — chronological split", () => {
  it("rejects overlapping or inverted boundaries and does not default to example dates", () => {
    expect(() =>
      assertChronologicalSplit({
        trainThrough: "2025-01-01T00:00:00.000Z",
        validationThrough: "2024-01-01T00:00:00.000Z",
        testFrom: "2025-07-01T00:00:00.000Z",
      }),
    ).toThrow(/trainThrough must be strictly before/);
    expect(() =>
      assertChronologicalSplit({
        trainThrough: "2024-12-31T00:00:00.000Z",
        validationThrough: "2025-07-01T00:00:00.000Z",
        testFrom: "2025-06-01T00:00:00.000Z",
      }),
    ).toThrow(/validationThrough must be strictly before/);
    expect(EXAMPLE_CHRONOLOGICAL_SPLIT.trainThrough).toContain("2024-12-31");
    expect(assignChronologicalFold("2024-06-01T00:00:00.000Z", EXAMPLE_CHRONOLOGICAL_SPLIT)).toBe(
      "train",
    );
    expect(assignChronologicalFold("2025-03-01T00:00:00.000Z", EXAMPLE_CHRONOLOGICAL_SPLIT)).toBe(
      "validation",
    );
    expect(assignChronologicalFold("2025-08-01T00:00:00.000Z", EXAMPLE_CHRONOLOGICAL_SPLIT)).toBe(
      "test",
    );
  });
});

describe("Sprint 5B.3A integrity — odds, metrics, policies, budget", () => {
  it("refuses to describe unknown/fetch-time odds as known at kickoff", () => {
    expect(oddsMayBeDescribedAsKnownAtKickoff("unknown")).toBe(false);
    expect(oddsMayBeDescribedAsKnownAtKickoff("fetch_time")).toBe(false);
    expect(oddsMayBeDescribedAsKnownAtKickoff("vendor_update")).toBe(false);
    expect(bookmakerBaselineReportLabel("unknown")).toContain("not_prematch");
    const report = evaluateCalibrationRows(createSyntheticCalibrationRows());
    expect(report.bookmakerDisclaimer).toBe(BOOKMAKER_ODDS_TIMING_DISCLAIMER);
  });

  it("guards log(0), empty sets, invalid probabilities, and null outcomes", () => {
    expect(logLossOneXTwo({ home: 0, draw: 0, away: 1 }, "home")).toBe(
      -Math.log(LOG_LOSS_EPS),
    );
    expect(summarizeMetrics([]).n).toBe(0);
    expect(summarizeMetrics([]).logLoss).toBe(0);
    expect(isValidOneXTwo({ home: 0.5, draw: 0.5, away: 0.5 })).toBe(false);
    expect(isValidOneXTwo({ home: -0.1, draw: 0.6, away: 0.5 })).toBe(false);
    expect(
      summarizeMetrics([
        {
          predicted: { home: Number.NaN, draw: 0, away: 0 },
          actual: "home",
          bucket: "0",
          policyId: "bad",
        },
      ]).n,
    ).toBe(0);
    const unlabeled = createSyntheticCalibrationRows().map((row) => ({
      ...row,
      actualOutcome: null,
    }));
    expect(evaluateCalibrationRows(unlabeled).policyMetrics.all).toBeUndefined();
    expect(bookmakerMetricRows(unlabeled)).toHaveLength(0);
  });

  it("scores every policy on the same rows, labels, and frozen PE instance", () => {
    const rows = createSyntheticCalibrationRows();
    const engine = createEloPoissonHybridEngine();
    const policies = createDefaultEloPolicies();
    const report = evaluateCalibrationRows(rows, policies);
    for (const row of rows) {
      const scored = report.scores.filter((item) => item.fixtureId === row.fixtureId);
      expect(scored).toHaveLength(policies.length);
      expect(new Set(scored.map((item) => item.peModelVersion)).size).toBe(1);
      expect(scored.every((item) => item.peModelVersion === engine.modelVersion)).toBe(
        true,
      );
    }
    expect(EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS.linearK).toBe(8);
    expect(report.scores.some((item) => item.policyId === "current_catalogue")).toBe(
      true,
    );
  });

  it("counts season-list calls as summed pages, not always one per season", () => {
    const best = estimateCollectionBudget({
      strategy: "league_season_plus_odds",
      fixtures: PILOT_COLLECTION_STAGES.stage1.fixtures,
      leagueSeasons: PILOT_COLLECTION_STAGES.stage1.leagueSeasons,
      pagesPerLeagueSeason: 1,
    });
    const twoPage = estimateCollectionBudget({
      strategy: "league_season_plus_odds",
      fixtures: 150,
      leagueSeasons: 8,
      pagesPerLeagueSeason: 2,
    });
    const conservative = estimateCollectionBudget({
      strategy: "league_season_plus_odds",
      fixtures: 1500,
      leagueSeasons: 28,
      pagesPerLeagueSeason: 3,
    });
    expect(best.fixtureListCalls).toBe(8);
    expect(best.totalCalls).toBe(158);
    expect(twoPage.fixtureListCalls).toBe(16);
    expect(twoPage.totalCalls).toBe(166);
    expect(conservative.fixtureListCalls).toBe(84);
    expect(conservative.totalCalls).toBe(1584);
  });

  it("records collection-run metadata without secrets", () => {
    const fixtures = createSyntheticLeagueFixtures();
    const prepared = prepareCalibrationFixtures(fixtures, {
      current: 1,
      total: 1,
    });
    const rows = buildLabeledCalibrationRows({
      fixtures,
      paging: { current: 1, total: 1 },
    });
    const meta = createCollectionRunMetadata({
      selectedLeagueSeasons: [{ leagueId: "syn-league", season: "2024", pageCount: 1 }],
      fixtureCountBeforeDedupe: prepared.beforeCount,
      fixtureCountAfterDedupe: prepared.afterCount,
      rows,
      collectionTimestamp: "2026-09-18T00:00:00.000Z",
    });
    expect(meta.collectorVersion).toBe("apex.calibration.collector.v1");
    expect(JSON.stringify(meta)).not.toMatch(/api[_-]?key/i);
    expect(meta.targetRowCount).toBe(rows.length);
    expect(meta.pageCounts).toEqual([1]);
  });
});
