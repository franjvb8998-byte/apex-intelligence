/**
 * APEX Data Access Layer v1 — repository port for football data.
 *
 * UI and product loaders talk only to these repositories.
 * The current provider (API-Football) stays behind FootballSource.
 */

import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";
import type { IDataProvider } from "@/lib/data-platform";
import { createFixturesRepository, type FixturesRepository } from "@/lib/repositories/fixtures";
import { createMatchAnalysisRepository, type MatchAnalysisRepository } from "@/lib/repositories/match-analysis";
import { createOddsRepository, type OddsRepository } from "@/lib/repositories/odds";
import { createStandingsRepository, type StandingsRepository } from "@/lib/repositories/standings";
import { createStatisticsRepository, type StatisticsRepository } from "@/lib/repositories/statistics";
import {
  createFootballSource,
  type RepositoryContext,
} from "@/lib/repositories/source";
import { createTeamsRepository, type TeamsRepository } from "@/lib/repositories/teams";

export type ApexRepositories = {
  fixtures: FixturesRepository;
  teams: TeamsRepository;
  odds: OddsRepository;
  standings: StandingsRepository;
  statistics: StatisticsRepository;
  matchAnalysis: MatchAnalysisRepository;
  hasResourcePort: boolean;
  providerId: IDataProvider["id"];
  displayName: string;
};

export function createRepositories(
  context: RepositoryContext = {},
): ApexRepositories {
  const source = createFootballSource(context);
  const fixtures = createFixturesRepository(source);
  const teams = createTeamsRepository(source);
  const odds = createOddsRepository(source);
  const standings = createStandingsRepository(source);
  const statistics = createStatisticsRepository(source);
  const matchAnalysis = createMatchAnalysisRepository(
    source,
    standings,
    statistics,
  );

  return {
    fixtures,
    teams,
    odds,
    standings,
    statistics,
    matchAnalysis,
    hasResourcePort: source.extras != null,
    providerId: source.id,
    displayName: source.displayName,
  };
}

export function isRepositories(
  value: IDataProvider | ApexRepositories,
): value is ApexRepositories {
  return (
    typeof value === "object" &&
    value != null &&
    "fixtures" in value &&
    "matchAnalysis" in value &&
    "hasResourcePort" in value
  );
}

export {
  createFootballSource,
  createProductDataProvider,
  createRecordedDataProvider,
  dataModeOf,
  hasFootballApiKey,
  type DataAccessMode,
  type DataAccessProfile,
  type FootballSource,
  type RepositoryContext,
} from "@/lib/repositories/source";

export {
  ignoreNonQuotaErrors,
  isApiFootballQuotaError,
  isQuotaError,
  loadUnlessQuota,
  type QuotaLoadResult,
} from "@/lib/repositories/quota";

export type { FixturesRepository } from "@/lib/repositories/fixtures";
export type { TeamsRepository } from "@/lib/repositories/teams";
export type { OddsRepository } from "@/lib/repositories/odds";
export type { StandingsRepository } from "@/lib/repositories/standings";
export type { StatisticsRepository } from "@/lib/repositories/statistics";
export type { MatchAnalysisRepository } from "@/lib/repositories/match-analysis";

export { RECORDED_API_FOOTBALL_FIXTURE_ID };
