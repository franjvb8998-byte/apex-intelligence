/**
 * Match Analysis extras: standings + in-match statistics.
 */

import type { IDataProvider } from "@/lib/data-platform/provider";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ApiFootballStandingsResponse } from "@/lib/data-platform/providers/api-football/types";
import type {
  MatchAnalysisLeaguePosition,
  MatchAnalysisMatchMetrics,
} from "@/lib/match-analysis/types";
import {
  createRepositories,
  isRepositories,
  type ApexRepositories,
} from "@/lib/repositories";

export type MatchAnalysisCatalogue = {
  positions: {
    home: MatchAnalysisLeaguePosition | null;
    away: MatchAnalysisLeaguePosition | null;
  };
  matchMetrics: {
    home: MatchAnalysisMatchMetrics | null;
    away: MatchAnalysisMatchMetrics | null;
  };
};

export type MatchAnalysisCatalogueOptions = {
  /**
   * League table already loaded by enrichMatchCenterContext.
   * When set, skip standings.getTable (duplicate with Match Center).
   */
  standings?: ApiFootballStandingsResponse | null;
  /** Skip standings entirely; caller maps positions from Match Center enrich. */
  skipStandings?: boolean;
};

export const EMPTY_MATCH_ANALYSIS_CATALOGUE: MatchAnalysisCatalogue = {
  positions: { home: null, away: null },
  matchMetrics: { home: null, away: null },
};

export async function enrichMatchAnalysisCatalogue(
  access: IDataProvider | ApexRepositories,
  bundle: ApexMatchBundle,
  options?: MatchAnalysisCatalogueOptions,
): Promise<MatchAnalysisCatalogue> {
  const repos = isRepositories(access)
    ? access
    : createRepositories({ provider: access });
  return repos.matchAnalysis.getCatalogue(bundle, options);
}
