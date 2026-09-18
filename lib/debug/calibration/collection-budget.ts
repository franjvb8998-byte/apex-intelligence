/**
 * Quota estimates for a future collection sprint.
 * Design only: these functions do not call API-Football.
 */

export type CollectionStrategyId =
  | "naive_per_fixture"
  | "league_season_list_local_reconstruct"
  | "league_season_plus_odds"
  | "reuse_existing_fixture_odds_cache";

export type CollectionBudget = {
  strategy: CollectionStrategyId;
  fixtures: number;
  leagueSeasons: number;
  fixtureListCalls: number;
  fixtureByIdCalls: number;
  teamStatisticsCalls: number;
  lastFixturesCalls: number;
  oddsCalls: number;
  otherCalls: number;
  totalCalls: number;
  worstCaseCalls: number;
  notes: string;
};

export const PILOT_COLLECTION_STAGES = {
  stage1: { fixtures: 150, leagueSeasons: 8 },
  stage2: { fixtures: 500, leagueSeasons: 16 },
  stage3: { fixtures: 1500, leagueSeasons: 28 },
} as const;

const RETRY_FACTOR = 3;

export function seasonListCallCount(
  leagueSeasons: number,
  pagesPerLeagueSeason: number,
): number {
  return leagueSeasons * pagesPerLeagueSeason;
}

export function estimateCollectionBudget(input: {
  strategy: CollectionStrategyId;
  fixtures: number;
  leagueSeasons: number;
  /** SUM of pages across selected league-seasons / seasons if uniform. Default 1 = best case. */
  pagesPerLeagueSeason?: number;
}): CollectionBudget {
  const { strategy, fixtures, leagueSeasons } = input;
  const pagesPerLeagueSeason = input.pagesPerLeagueSeason ?? 1;
  const fixtureListCalls = seasonListCallCount(
    leagueSeasons,
    pagesPerLeagueSeason,
  );

  if (strategy === "naive_per_fixture") {
    const fixtureByIdCalls = fixtures;
    const teamStatisticsCalls = fixtures * 2;
    const lastFixturesCalls = fixtures * 2;
    const oddsCalls = fixtures;
    const total =
      fixtureByIdCalls + teamStatisticsCalls + lastFixturesCalls + oddsCalls;
    return {
      strategy,
      fixtures,
      leagueSeasons,
      fixtureListCalls: 0,
      fixtureByIdCalls,
      teamStatisticsCalls,
      lastFixturesCalls,
      oddsCalls,
      otherCalls: 0,
      totalCalls: total,
      worstCaseCalls: total * RETRY_FACTOR,
      notes:
        "Leaky: team statistics and last-N form are current aggregates, not as-of kickoff.",
    };
  }

  if (strategy === "league_season_list_local_reconstruct") {
    return {
      strategy,
      fixtures,
      leagueSeasons,
      fixtureListCalls,
      fixtureByIdCalls: 0,
      teamStatisticsCalls: 0,
      lastFixturesCalls: 0,
      oddsCalls: 0,
      otherCalls: 0,
      totalCalls: fixtureListCalls,
      worstCaseCalls: fixtureListCalls * RETRY_FACTOR,
      notes:
        "GET /fixtures?league&season pages summed across competition-seasons, reconstruct locally. No odds. Incomplete paging must fail, not be guessed.",
    };
  }

  if (strategy === "reuse_existing_fixture_odds_cache") {
    const oddsCalls = Math.ceil(fixtures * 0.35);
    const total = fixtureListCalls + oddsCalls;
    return {
      strategy,
      fixtures,
      leagueSeasons,
      fixtureListCalls,
      fixtureByIdCalls: 0,
      teamStatisticsCalls: 0,
      lastFixturesCalls: 0,
      oddsCalls,
      otherCalls: 0,
      totalCalls: total,
      worstCaseCalls: (fixtureListCalls + fixtures) * RETRY_FACTOR,
      notes:
        "Assume ~65% of odds already sit in process/Next cache from product traffic; remainder fetched once. Season-list calls = summed pages.",
    };
  }

  const total = fixtureListCalls + fixtures;
  return {
    strategy: "league_season_plus_odds",
    fixtures,
    leagueSeasons,
    fixtureListCalls,
    fixtureByIdCalls: 0,
    teamStatisticsCalls: 0,
    lastFixturesCalls: 0,
    oddsCalls: fixtures,
    otherCalls: 0,
    totalCalls: total,
    worstCaseCalls: (fixtureListCalls + fixtures) * RETRY_FACTOR,
    notes:
      "Recommended: season-list calls = SUM(pages per league-season), reconstruct locally, one GET /odds per fixture. Odds timing remains unknown. Do not collect if paging.total is missing or >1 without fetching every page.",
  };
}

export function recommendedCollectionStrategy(): CollectionStrategyId {
  return "league_season_plus_odds";
}
