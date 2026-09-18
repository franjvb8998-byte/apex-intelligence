/**
 * Copilot value_scan ranking path (Sprint 5A.6 P0-D).
 *
 * Field-equivalence (ranking loop only):
 *
 * | Field | Previous source | New source | Equivalent? |
 * |---|---|---|---|
 * | decimalOdds, bookmaker, market, selection, quote id | MC dashboard.odds ← bundle.odds ← GET /odds + mapOdds | repos.odds.listForFixture (same extras + mapOdds) | YES |
 * | modelProbability | hybrid PE from Elo (team stats when present) | same resolveEloWithProvenance + createEloPoissonHybridEngine | YES |
 * | expectedValue | expectedValue(modelProbability, decimalOdds) via buildOddsEvRows | same buildOddsEvRows | YES |
 * | injuries, H2H, lineups, events, standings, last-5 | full MC enrich | not used for ranking | n/a |
 * | Winner briefing snapshot | loadMatch | loadMatch once for the selected fixture | YES |
 *
 * Scanner opportunity board is NOT reused: it publishes one 1x2 Decision
 * Engine selection, while value_scan ranks every 1X2 / O/U 2.5 / BTTS line.
 */

import { edgePp, fairOdds, impliedProbability } from "@/lib/copilot/pricing";
import type { CopilotMarketLine } from "@/lib/copilot/types";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { IDataProvider } from "@/lib/data-platform/provider";
import {
  bothTeamsToScoreFromLambdas,
  createEloPoissonHybridEngine,
} from "@/lib/intelligence/modules/probability";
import {
  EMPTY_MATCH_CENTER_ENRICHMENT,
  enrichTeamStatisticsOnly,
} from "@/lib/match-center/enrich";
import { fixtureIdFromMatch } from "@/lib/match-center/fixture-id";
import { resolveEloWithProvenance } from "@/lib/match-center/from-data-platform";
import {
  listMatchCenterFixtureBundles,
  type LoadMatchCenterOptions,
} from "@/lib/match-center/load";
import { buildOddsEvRows } from "@/lib/match-center/markets";
import {
  createRepositories,
  isQuotaError,
  type ApexRepositories,
} from "@/lib/repositories";

const HOME_ELO_BASE = 1580;
const AWAY_ELO_BASE = 1520;

export const VALUE_SCAN_SAMPLE_SIZE = 8;

export type CopilotValueScanLoadOptions = LoadMatchCenterOptions & {
  provider: IDataProvider;
};

async function attachOddsForValueScan(
  repos: ApexRepositories,
  bundle: ApexMatchBundle,
): Promise<ApexMatchBundle> {
  if (bundle.odds.length > 0) return bundle;
  const matchId = fixtureIdFromMatch({
    id: bundle.match.id,
    externalId: bundle.match.externalRefs[0]?.externalId ?? null,
  });
  if (!matchId) return bundle;
  const odds = await repos.odds.listForFixture(matchId);
  if (odds.length === 0) return bundle;
  return { ...bundle, odds };
}

function marketsFromBundle(
  bundle: ApexMatchBundle,
  enrichment: Awaited<ReturnType<typeof enrichTeamStatisticsOnly>>,
): CopilotMarketLine[] {
  const homeDerivation = resolveEloWithProvenance(
    enrichment.teamStats?.home,
    bundle.homeTeam.id,
    HOME_ELO_BASE,
  );
  const awayDerivation = resolveEloWithProvenance(
    enrichment.teamStats?.away,
    bundle.awayTeam.id,
    AWAY_ELO_BASE,
  );
  const hybrid = createEloPoissonHybridEngine().predict({
    homeElo: homeDerivation.elo,
    awayElo: awayDerivation.elo,
    homeTeamId: bundle.homeTeam.id,
    awayTeamId: bundle.awayTeam.id,
    matchId: bundle.match.id,
  });
  const btts = bothTeamsToScoreFromLambdas({
    lambdaHome: hybrid.poisson.lambdaHome,
    lambdaAway: hybrid.poisson.lambdaAway,
    maxGoals: hybrid.meta.config.maxGoals,
  });
  const rows = buildOddsEvRows({
    quotes: bundle.odds,
    oneXTwo: hybrid.oneXTwo,
    overUnder25: hybrid.overUnder25,
    btts,
  });
  const best = rows.filter((row) => row.isBest);
  const source = best.length > 0 ? best : rows;
  return source.map((row) => ({
    market: row.marketLabel,
    selection: row.selection,
    label: row.label,
    modelProbability: row.modelProbability,
    fairOdds: fairOdds(row.modelProbability),
    decimalOdds: row.decimalOdds,
    impliedProbability:
      row.impliedProbability ?? impliedProbability(row.decimalOdds),
    edge: edgePp(row.modelProbability, row.decimalOdds),
    expectedValue: row.expectedValue,
    bookmaker: row.bookmaker,
  }));
}

/**
 * Odds + team-stats Elo + PE hybrid. Does not call getMatch / full enrich.
 */
export async function loadCopilotValueScanMarkets(
  options: CopilotValueScanLoadOptions,
  externalMatchId: string,
): Promise<CopilotMarketLine[]> {
  const env = options.env ?? process.env;
  const repos = createRepositories({
    provider: options.provider,
    env,
    enrichMatch: false,
  });
  const bundles = await listMatchCenterFixtureBundles({
    provider: options.provider,
    env,
  });
  const bundle = bundles.find((item) => {
    const id = fixtureIdFromMatch({
      id: item.match.id,
      externalId: item.match.externalRefs[0]?.externalId ?? null,
    });
    return id === externalMatchId || item.match.id === externalMatchId;
  });
  if (!bundle) return [];

  const withOdds = await attachOddsForValueScan(repos, bundle);
  if (withOdds.odds.length === 0) return [];

  let enrichment;
  try {
    enrichment = await enrichTeamStatisticsOnly(repos, withOdds);
  } catch (error) {
    if (isQuotaError(error)) throw error;
    enrichment = { ...EMPTY_MATCH_CENTER_ENRICHMENT };
  }

  return marketsFromBundle(withOdds, enrichment);
}
