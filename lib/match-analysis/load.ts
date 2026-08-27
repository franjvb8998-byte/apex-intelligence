/**
 * Match Analysis page loader — selected API-Football fixture + PE + catalogue charts.
 */

import { createApiFootballDataProvider, type IDataProvider } from "@/lib/data-platform";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { hasFootballApiKey } from "@/lib/dashboard/resolve-provider";
import {
  EMPTY_MATCH_ANALYSIS_CATALOGUE,
  enrichMatchAnalysisCatalogue,
} from "@/lib/match-analysis/catalogue";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import {
  EMPTY_MATCH_CENTER_ENRICHMENT,
  enrichMatchCenterContext,
} from "@/lib/match-center/enrich";
import { vendorFixtureId } from "@/lib/match-center/fixture-id";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";
import {
  listMatchCenterFixtures,
  type LoadMatchCenterOptions,
} from "@/lib/match-center/load";

export type LoadMatchAnalysisOptions = LoadMatchCenterOptions;

function resolveProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): IDataProvider {
  const hasKey = hasFootballApiKey(env);
  return createApiFootballDataProvider({
    env,
    enrichMatch: true,
    fallback: hasKey ? "error" : "recorded",
  });
}

/**
 * Load Match Analysis for a selected fixture. Does not use getMockMatchAnalysis.
 */
export async function getMatchAnalysisData(
  options: LoadMatchAnalysisOptions = {},
): Promise<MatchAnalysisData> {
  const env = options.env ?? process.env;
  const provider = options.provider ?? resolveProvider(env);
  const matchId = vendorFixtureId(options.externalMatchId);
  if (!matchId) {
    throw new Error("Selecciona un fixture de API-Football para el análisis.");
  }

  const bundle = await provider.getMatch({ matchId });
  const [enrichment, catalogue] = await Promise.all([
    enrichMatchCenterContext(provider, bundle).catch(() => ({
      ...EMPTY_MATCH_CENTER_ENRICHMENT,
    })),
    enrichMatchAnalysisCatalogue(provider, bundle).catch(() => ({
      ...EMPTY_MATCH_ANALYSIS_CATALOGUE,
    })),
  ]);

  const center = createMatchCenterFromApexBundle(bundle, { enrichment });
  return attachCatalogue(center.preview.analysis, bundle, enrichment, catalogue);
}

function attachCatalogue(
  analysis: MatchAnalysisData,
  bundle: ApexMatchBundle,
  enrichment: Awaited<ReturnType<typeof enrichMatchCenterContext>>,
  catalogue: Awaited<ReturnType<typeof enrichMatchAnalysisCatalogue>>,
): MatchAnalysisData {
  const caveats = analysis.explanation.caveats.filter(
    (line) => !/simulad/i.test(line),
  );
  return {
    ...analysis,
    source: "data-platform",
    leagueName: bundle.league?.name ?? analysis.leagueName,
    leaguePosition: catalogue.positions,
    recentMatches: enrichment.recent,
    h2h: enrichment.h2h,
    venueSplit: {
      home: {
        home: enrichment.teamStats?.home?.homeSplit ?? null,
        away: enrichment.teamStats?.home?.awaySplit ?? null,
      },
      away: {
        home: enrichment.teamStats?.away?.homeSplit ?? null,
        away: enrichment.teamStats?.away?.awaySplit ?? null,
      },
    },
    matchMetrics: catalogue.matchMetrics,
    expectedGoals: analysis.expectedGoals,
    explanation: {
      ...analysis.explanation,
      caveats:
        caveats.length > 0
          ? caveats
          : [
              "Métricas de partido (posesión, tiros, xG) solo aparecen si el proveedor las publica.",
              "No constituye consejo financiero ni garantía de resultado.",
            ],
    },
  };
}

export { listMatchCenterFixtures as listMatchAnalysisFixtures };
