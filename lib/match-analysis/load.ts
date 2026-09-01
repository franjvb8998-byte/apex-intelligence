/**
 * Match Analysis page loader — selected fixture + PE + catalogue charts.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  EMPTY_MATCH_ANALYSIS_CATALOGUE,
  enrichMatchAnalysisCatalogue,
} from "@/lib/match-analysis/catalogue";
import type {
  MatchAnalysisData,
  MatchAnalysisLeaguePosition,
} from "@/lib/match-analysis/types";
import type { MatchCenterStanding } from "@/lib/match-center/types";
import { buildIntelligenceReport } from "@/lib/intelligence-report";
import { scoreMatchSelection, apexScoreFromScoring } from "@/lib/scoring-engine/from-match";
import { clubTwinsFromPreview, selectionTwinFromPreview } from "@/lib/team-intelligence/builders";
import { ratePreview } from "@/lib/match-rating";
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
import { createRepositories } from "@/lib/repositories";

export type LoadMatchAnalysisOptions = LoadMatchCenterOptions;

/**
 * Load Match Analysis for a selected fixture. Does not use getMockMatchAnalysis.
 */
export async function getMatchAnalysisData(
  options: LoadMatchAnalysisOptions = {},
): Promise<MatchAnalysisData> {
  const env = options.env ?? process.env;
  const repos = createRepositories({
    provider: options.provider,
    env,
    enrichMatch: true,
  });
  const matchId = vendorFixtureId(options.externalMatchId);
  if (!matchId) {
    throw new Error("Selecciona un fixture de API-Football para el análisis.");
  }

  const bundle = await repos.fixtures.getById(matchId);
  const [enrichment, catalogue] = await Promise.all([
    enrichMatchCenterContext(repos, bundle).catch(() => ({
      ...EMPTY_MATCH_CENTER_ENRICHMENT,
    })),
    // Removed duplicate standings.getTable: Match Center enrich already
    // loads the league table. Catalogue only fetches fixture statistics.
    enrichMatchAnalysisCatalogue(repos, bundle, { skipStandings: true }).catch(
      () => ({
        ...EMPTY_MATCH_ANALYSIS_CATALOGUE,
      }),
    ),
  ]);

  const center = createMatchCenterFromApexBundle(bundle, { enrichment });
  const analysis = attachCatalogue(
    center.preview.analysis,
    bundle,
    enrichment,
    catalogue,
  );
  const rating = ratePreview(
    { ...center.preview, analysis },
    center.aiAnalysis,
    analysis.rating.label,
  );
  const twins = clubTwinsFromPreview(center.match, center.preview.dashboard);
  const extras = {
    injuries: center.preview.dashboard.injuries,
    homeForm: center.preview.dashboard.form.home,
    awayForm: center.preview.dashboard.form.away,
    weather: center.match.weather,
    odds: center.preview.dashboard.odds,
  };
  const stamped = {
    ...analysis,
    rating,
  };
  const scored =
    analysis.decision && analysis.scoring
      ? { decision: analysis.decision, scoring: analysis.scoring }
      : scoreMatchSelection({
          analysis: stamped,
          extras,
          team: selectionTwinFromPreview(
            center.match,
            center.preview.dashboard,
            stamped.predictedOutcome,
          ),
          season: bundle.league?.season ?? null,
        });
  return {
    ...stamped,
    decision: scored.decision,
    scoring: scored.scoring,
    apexScore: apexScoreFromScoring(scored.scoring),
    report: buildIntelligenceReport({
      data: stamped,
      ...extras,
    }),
    twins,
    context: {
      weather: center.match.weather,
      referee: center.match.referee,
    },
  };
}

function leaguePositionFromStanding(
  standing: MatchCenterStanding | null,
): MatchAnalysisLeaguePosition | null {
  if (!standing) return null;
  return {
    rank: standing.rank,
    points: standing.points,
    played: standing.played,
    teamName: standing.teamName,
  };
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
    // Prefer standings already mapped by Match Center enrich; catalogue
    // positions are only a fallback when skipStandings was not used.
    leaguePosition: {
      home:
        leaguePositionFromStanding(enrichment.standings.home) ??
        catalogue.positions.home,
      away:
        leaguePositionFromStanding(enrichment.standings.away) ??
        catalogue.positions.away,
    },
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
