/**
 * Adapter: Probability Engine → Match Center Preview.
 * Consumes public PE interfaces only — does not modify the engine.
 */

import {
  createEloPoissonHybridEngine,
  mostLikelyOutcome,
  bothTeamsToScoreFromLambdas,
  confidenceFromHybrid,
  type HybridProbabilityResult,
  type ProbabilityEngine,
  type TeamEloInput,
} from "@/lib/intelligence/modules/probability";
import { explainPrediction } from "@/lib/explainable-ai/engine";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import { placeholderPreviewDashboard } from "@/lib/match-center/dashboard";
import type {
  MatchCenterPreviewData,
  MatchCenterTeam,
} from "@/lib/match-center/types";
import { buildIntelligenceReport } from "@/lib/intelligence-report";
import { rateMatch } from "@/lib/match-rating";
import {
  apexScoreFromScoring,
  scoreMatchSelection,
} from "@/lib/scoring-engine/from-match";

export type PreviewNarrativeOverlay = {
  keyFactors: MatchAnalysisData["keyFactors"];
  risks: MatchAnalysisData["risks"];
  explanation: MatchAnalysisData["explanation"];
  apexScoreLabel?: string;
};

export type PreviewBuildContext = {
  matchId: string;
  leagueName: string;
  kickoffAt: string;
  status: MatchAnalysisData["status"];
  homeTeam: MatchCenterTeam;
  awayTeam: MatchCenterTeam;
  eloInput: TeamEloInput;
  narrative: PreviewNarrativeOverlay;
  source?: MatchCenterPreviewData["source"];
  /** Caller attaches Scoring Engine v2 after Match Center extras exist. */
  skipPlatformScore?: boolean;
};

export { confidenceFromHybrid };

/**
 * Pure map: HybridProbabilityResult → MatchAnalysisData.
 * Narrative overlay stays outside the engine (explainability layer later).
 */
export function mapHybridToMatchAnalysis(
  result: HybridProbabilityResult,
  context: Omit<PreviewBuildContext, "eloInput">,
): MatchAnalysisData {
  const predictedOutcome = mostLikelyOutcome(result.oneXTwo);
  const confidence = confidenceFromHybrid(result);
  const predictedLabel =
    predictedOutcome === "home"
      ? `Victoria ${context.homeTeam.name}`
      : predictedOutcome === "away"
        ? `Victoria ${context.awayTeam.name}`
        : "Empate";
  const rating = rateMatch({
    predictedOutcome,
    predictedLabel,
    oneXTwo: result.oneXTwo,
    expectedGoals: result.expectedGoals,
    confidence,
    decimalOdds: null,
    bookmakerCount: 0,
    home: { form: null, recent: [], goalsFor: null, goalsAgainst: null, played: null },
    away: { form: null, recent: [], goalsFor: null, goalsAgainst: null, played: null },
    standings: { home: null, away: null },
    injuries: [],
    eloWinExpectancyHome: result.elo.winExpectancyHome,
    headline: context.narrative.apexScoreLabel,
  });
  const btts = bothTeamsToScoreFromLambdas({
    lambdaHome: result.poisson.lambdaHome,
    lambdaAway: result.poisson.lambdaAway,
    maxGoals: result.meta.config.maxGoals,
  });

  const analysis: Omit<MatchAnalysisData, "report" | "decision"> = {
    matchId: context.matchId,
    leagueName: context.leagueName,
    kickoffAt: context.kickoffAt,
    status: context.status,
    homeTeam: context.homeTeam,
    awayTeam: context.awayTeam,
    oneXTwo: result.oneXTwo,
    predictedOutcome,
    confidence,
    rating,
    apexScore: { value: 0, label: "", components: [] },
    markets: [
      {
        id: "m-1x2",
        label: "Resultado final (1X2)",
        type: "1x2",
        line: null,
        selections: [
          {
            key: "home",
            label: "Local",
            probability: result.oneXTwo.home,
          },
          {
            key: "draw",
            label: "Empate",
            probability: result.oneXTwo.draw,
          },
          {
            key: "away",
            label: "Visitante",
            probability: result.oneXTwo.away,
          },
        ],
      },
      {
        id: "m-ou25",
        label: "Over / Under 2.5",
        type: "over_under",
        line: 2.5,
        selections: [
          {
            key: "over",
            label: "Over 2.5",
            probability: result.overUnder25.over,
          },
          {
            key: "under",
            label: "Under 2.5",
            probability: result.overUnder25.under,
          },
        ],
      },
      {
        id: "m-btts",
        label: "Both Teams To Score",
        type: "btts",
        line: null,
        selections: [
          {
            key: "yes",
            label: "BTTS Sí",
            probability: btts.yes,
          },
          {
            key: "no",
            label: "BTTS No",
            probability: btts.no,
          },
        ],
      },
    ],
    keyFactors: context.narrative.keyFactors,
    risks: context.narrative.risks,
    explanation: context.narrative.explanation,
    explainable: explainPrediction({
      matchId: context.matchId,
      homeTeamName: context.homeTeam.name,
      awayTeamName: context.awayTeam.name,
      leagueName: context.leagueName,
      probability: result,
      confidence,
    }),
    modelVersion: result.meta.modelVersion,
    source: context.source === "intelligence-core" ? "intelligence-core" : context.source === "data-platform" ? "data-platform" : "mock",
    leaguePosition: { home: null, away: null },
    recentMatches: { home: [], away: [] },
    h2h: [],
    venueSplit: {
      home: { home: null, away: null },
      away: { home: null, away: null },
    },
    matchMetrics: { home: null, away: null },
    expectedGoals: result.expectedGoals,
  };
  if (context.skipPlatformScore) {
    return analysis as MatchAnalysisData;
  }
  const { decision, scoring } = scoreMatchSelection({ analysis });
  return {
    ...analysis,
    decision,
    scoring,
    apexScore: apexScoreFromScoring(scoring),
    report: buildIntelligenceReport({ data: analysis }),
  };
}

export function buildPreviewFromHybrid(
  result: HybridProbabilityResult,
  context: PreviewBuildContext,
): MatchCenterPreviewData {
  const analysis = mapHybridToMatchAnalysis(result, context);
  const btts = bothTeamsToScoreFromLambdas({
    lambdaHome: result.poisson.lambdaHome,
    lambdaAway: result.poisson.lambdaAway,
    maxGoals: result.meta.config.maxGoals,
  });
  return {
    analysis,
    eloInput: context.eloInput,
    hybrid: {
      modelVersion: result.meta.modelVersion,
      expectedGoals: result.expectedGoals,
      overUnder25: result.overUnder25,
      btts,
    },
    dashboard: placeholderPreviewDashboard(btts),
    source: context.source ?? "mock",
  };
}

/**
 * Run ProbabilityEngine.predict and adapt to Preview DTO.
 * Inject a custom engine in tests; default is EloPoissonHybrid.
 */
export function buildPreviewFromEngine(
  context: PreviewBuildContext,
  engine: ProbabilityEngine = createEloPoissonHybridEngine(),
): MatchCenterPreviewData {
  const result = engine.predict(context.eloInput);
  return buildPreviewFromHybrid(result, context);
}
