/**
 * Sprint 5B.3A — offline calibration harness.
 * Synthetic data only. No API-Football collection.
 */

import { describe, expect, it } from "vitest";
import {
  bookmakerMetricRows,
  buildCalibrationRow,
  createDefaultEloPolicies,
  createSyntheticCalibrationRows,
  createSyntheticLeagueFixtures,
  estimateCollectionBudget,
  evaluateCalibrationRows,
  impliedProbabilitiesFromDecimalOdds,
  logLossOneXTwo,
  LOG_LOSS_EPS,
  PILOT_COLLECTION_STAGES,
  recommendedCollectionStrategy,
  reconstructTeamRecord,
  rowEvidenceBucket,
} from "@/lib/debug/calibration";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability";
import { resolveEloWithProvenance } from "@/lib/match-center/from-data-platform";

describe("Sprint 5B.3A — leakage-safe reconstruction", () => {
  const fixtures = createSyntheticLeagueFixtures();
  const target = fixtures.find((row) => row.fixtureId === "lg-target")!;

  it("counts only same competition+season fixtures with kickoff strictly before T", () => {
    const alpha = reconstructTeamRecord({
      teamId: "alpha",
      kickoff: target.kickoff,
      competitionId: "syn-league",
      season: "2024",
      fixtures,
    });
    expect(alpha.played).toBe(2);
    expect(alpha.wins).toBe(1);
    expect(alpha.goalsFor).toBe(3);
    expect(alpha.goalsAgainst).toBe(1);
  });

  it("ignores postponed, cancelled, other-season, and future fixtures", () => {
    const alpha = reconstructTeamRecord({
      teamId: "alpha",
      kickoff: target.kickoff,
      competitionId: "syn-league",
      season: "2024",
      fixtures,
    });
    expect(alpha.goalsFor).toBeLessThan(8);
    expect(alpha.played).not.toBe(4);
  });

  it("uses full-time goals for penalty shootouts, not the shootout", () => {
    const row = buildCalibrationRow({ target, fixtures });
    expect(row.homePlayedBefore).toBe(2);
    expect(row.actualOutcome).toBe("home");
    expect(row.reconstructionVersion).toBe("same_competition_season.kickoff_lt.v2");
  });
});

describe("Sprint 5B.3A — candidate policies and frozen PE", () => {
  const rows = createSyntheticCalibrationRows();
  const policies = createDefaultEloPolicies();
  const report = evaluateCalibrationRows(rows, policies);

  it("scores every row under every candidate without fetching", () => {
    expect(policies.map((policy) => policy.id)).toEqual([
      "current_catalogue",
      "base_prior",
      "linear_shrinkage",
      "exponential_shrinkage",
      "pseudo_match_bayesian",
      "shrinkage_plus_cap",
    ]);
    expect(report.scores).toHaveLength(rows.length * policies.length);
    expect(new Set(report.scores.map((row) => row.fixtureId)).size).toBe(
      rows.length,
    );
  });

  it("invokes the production PE model version and 1580/1520 prior hybrid", () => {
    expect(report.peModelVersion).toBe(DEFAULT_HYBRID_CONFIG.modelVersion);
    const played0 = report.scores.find(
      (row) =>
        row.fixtureId === "syn-played-0-home-win" &&
        row.policyId === "base_prior",
    )!;
    expect(played0.homeElo).toBe(1580);
    expect(played0.awayElo).toBe(1520);
    expect([
      Math.round(played0.oneXTwo.home * 100),
      Math.round(played0.oneXTwo.draw * 100),
      Math.round(played0.oneXTwo.away * 100),
    ]).toEqual([63, 19, 18]);
  });

  it("current_catalogue matches production resolver on the Bangladesh/Korea shape", () => {
    const sparse = rows.find((row) => row.fixtureId === "syn-bangladesh-korea-shape")!;
    const home = resolveEloWithProvenance(
      {
        played: sparse.homePlayedBefore,
        wins: sparse.homeWinsBefore,
        goalsFor: sparse.homeGfBefore,
        goalsAgainst: sparse.homeGaBefore,
      },
      sparse.homeTeamId,
      1580,
    );
    const away = resolveEloWithProvenance(
      {
        played: sparse.awayPlayedBefore,
        wins: sparse.awayWinsBefore,
        goalsFor: sparse.awayGfBefore,
        goalsAgainst: sparse.awayGaBefore,
      },
      sparse.awayTeamId,
      1520,
    );
    const scored = report.scores.find(
      (row) =>
        row.fixtureId === sparse.fixtureId && row.policyId === "current_catalogue",
    )!;
    expect(home.elo).toBe(1460);
    expect(away.elo).toBe(1688);
    expect(scored.homeElo).toBe(1460);
    expect(scored.awayElo).toBe(1688);
    expect([
      Math.round(scored.oneXTwo.home * 100),
      Math.round(scored.oneXTwo.draw * 100),
      Math.round(scored.oneXTwo.away * 100),
    ]).toEqual([8, 6, 86]);
  });

  it("shrinkage candidates stay closer to the role bases than current_catalogue at n=1", () => {
    const scores = report.scores.filter(
      (row) => row.fixtureId === "syn-played-1-favorite-correct",
    );
    const catalogue = scores.find((row) => row.policyId === "current_catalogue")!;
    const linear = scores.find((row) => row.policyId === "linear_shrinkage")!;
    const capped = scores.find((row) => row.policyId === "shrinkage_plus_cap")!;
    expect(Math.abs(catalogue.homeElo - 1580)).toBeGreaterThan(
      Math.abs(linear.homeElo - 1580),
    );
    expect(Math.abs(capped.homeElo - 1580)).toBeLessThanOrEqual(
      Math.abs(catalogue.homeElo - 1580),
    );
  });

  it("assigns evidence buckets from min(home, away) played-before", () => {
    expect(
      rowEvidenceBucket(rows.find((row) => row.fixtureId === "syn-played-0-home-win")!),
    ).toBe("0");
    expect(
      rowEvidenceBucket(
        rows.find((row) => row.fixtureId === "syn-played-1-favorite-correct")!,
      ),
    ).toBe("1-3");
    expect(
      rowEvidenceBucket(rows.find((row) => row.fixtureId === "syn-played-5-home-win")!),
    ).toBe("4-9");
    expect(
      rowEvidenceBucket(rows.find((row) => row.fixtureId === "syn-played-10-away-win")!),
    ).toBe("10+");
  });
});

describe("Sprint 5B.3A — metrics and bookmaker baseline", () => {
  it("clips log(0) and is deterministic", () => {
    expect(logLossOneXTwo({ home: 0, draw: 1, away: 0 }, "home")).toBe(
      -Math.log(LOG_LOSS_EPS),
    );
    const reportA = evaluateCalibrationRows(createSyntheticCalibrationRows());
    const reportB = evaluateCalibrationRows(createSyntheticCalibrationRows());
    expect(reportA.policyMetrics["policy:current_catalogue"]?.logLoss).toBe(
      reportB.policyMetrics["policy:current_catalogue"]?.logLoss,
    );
    expect(reportA.policyMetrics["bucket:1-3"]?.n).toBeGreaterThan(0);
  });

  it("normalizes 1X2 decimal odds by removing overround", () => {
    const implied = impliedProbabilitiesFromDecimalOdds({
      homeOdds: 1.5,
      drawOdds: 4,
      awayOdds: 6,
    });
    expect(implied).not.toBeNull();
    expect(implied!.overround).toBeCloseTo(1 / 1.5 + 1 / 4 + 1 / 6, 8);
    expect(
      implied!.normalized.home + implied!.normalized.draw + implied!.normalized.away,
    ).toBeCloseTo(1, 12);
    expect(implied!.normalized.home).toBeCloseTo(1 / 1.5 / implied!.overround, 12);
  });

  it("scores bookmaker rows separately and skips missing odds", () => {
    const rows = createSyntheticCalibrationRows();
    const bookmaker = bookmakerMetricRows(rows);
    const withOdds = rows.filter((row) => row.homeOdds != null).length;
    const missing = rows.filter((row) => row.homeOdds == null).length;
    expect(missing).toBeGreaterThan(0);
    expect(bookmaker).toHaveLength(withOdds);
    expect(bookmaker.every((row) => row.policyId === "bookmaker_normalized")).toBe(
      true,
    );
  });
});

describe("Sprint 5B.3A — collection budget (no live calls)", () => {
  it("recommends season-list reconstruction plus one odds call per fixture", () => {
    expect(recommendedCollectionStrategy()).toBe("league_season_plus_odds");
    const stage1 = estimateCollectionBudget({
      strategy: "league_season_plus_odds",
      fixtures: PILOT_COLLECTION_STAGES.stage1.fixtures,
      leagueSeasons: PILOT_COLLECTION_STAGES.stage1.leagueSeasons,
    });
    const naive = estimateCollectionBudget({
      strategy: "naive_per_fixture",
      fixtures: 150,
      leagueSeasons: 8,
    });
    expect(stage1.totalCalls).toBe(158);
    expect(naive.totalCalls).toBe(900);
    expect(naive.teamStatisticsCalls).toBe(300);
    expect(stage1.teamStatisticsCalls).toBe(0);
  });
});
