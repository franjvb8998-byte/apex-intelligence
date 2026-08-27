/**
 * Adapter: Probability Engine → Match Center Preview.
 * Consumes public PE interfaces only — does not modify the engine.
 */

import {
  createEloPoissonHybridEngine,
  mostLikelyOutcome,
  normalizedEntropy,
  bothTeamsToScoreFromLambdas,
  type HybridProbabilityResult,
  type ProbabilityEngine,
  type TeamEloInput,
} from "@/lib/intelligence/modules/probability";
import type { ConfidenceScore, MatchOutcome } from "@/lib/intelligence/types";
import { explainPrediction } from "@/lib/explainable-ai/engine";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import { placeholderPreviewDashboard } from "@/lib/match-center/dashboard";
import type {
  MatchCenterPreviewData,
  MatchCenterTeam,
} from "@/lib/match-center/types";

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
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Map PE uncertainty → ConfidenceScore for UI.
 * Lower entropy ⇒ higher confidence.
 */
export function confidenceFromHybrid(
  result: HybridProbabilityResult,
): ConfidenceScore {
  const entropy = normalizedEntropy(result.oneXTwo);
  const value = clamp01(1 - entropy);
  const band: ConfidenceScore["band"] =
    value >= 0.75 ? "high" : value >= 0.45 ? "medium" : "low";
  return { value, band };
}

function apexScoreFromHybrid(
  result: HybridProbabilityResult,
  predicted: MatchOutcome,
  label?: string,
): MatchAnalysisData["apexScore"] {
  const lead = result.oneXTwo[predicted];
  const clarity = Math.round(clamp01(lead - 1 / 3) * 180 + 40);
  const model = Math.round(clamp01(1 - normalizedEntropy(result.oneXTwo)) * 100);
  const edge = Math.round(clamp01(result.overUnder25.over) * 40 + 50);
  const value = Math.round(
    Math.min(100, Math.max(0, model * 0.4 + clarity * 0.35 + edge * 0.25)),
  );

  return {
    value,
    label:
      label ??
      (predicted === "home"
        ? "Señal a favor del local"
        : predicted === "away"
          ? "Señal a favor del visitante"
          : "Señal equilibrada / empate"),
    components: [
      {
        key: "model",
        label: "Convicción del modelo",
        value: model,
        weight: 0.4,
      },
      {
        key: "edge",
        label: "Claridad 1X2",
        value: Math.min(100, clarity),
        weight: 0.35,
      },
      {
        key: "ou",
        label: "Perfil Over 2.5",
        value: Math.min(100, edge),
        weight: 0.25,
      },
    ],
  };
}

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
  const btts = bothTeamsToScoreFromLambdas({
    lambdaHome: result.poisson.lambdaHome,
    lambdaAway: result.poisson.lambdaAway,
    maxGoals: result.meta.config.maxGoals,
  });

  return {
    matchId: context.matchId,
    leagueName: context.leagueName,
    kickoffAt: context.kickoffAt,
    status: context.status,
    homeTeam: context.homeTeam,
    awayTeam: context.awayTeam,
    oneXTwo: result.oneXTwo,
    predictedOutcome,
    confidence,
    apexScore: apexScoreFromHybrid(
      result,
      predictedOutcome,
      context.narrative.apexScoreLabel,
    ),
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
    source: context.source === "intelligence-core" ? "intelligence-core" : "mock",
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
