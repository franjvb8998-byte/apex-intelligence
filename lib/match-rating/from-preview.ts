/**
 * Build rating input from Match Center preview + rules analysis.
 */

import { mostLikelyOutcome } from "@/lib/intelligence/modules/probability";
import type { MatchAnalysis } from "@/lib/match-analysis/analysis-types";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import type { MatchCenterPreviewData } from "@/lib/match-center/types";
import { rateMatch } from "@/lib/match-rating/rate-match";
import type {
  ApexMatchRating,
  ApexRatingFormSide,
  ApexRatingInput,
  ApexRatingInjury,
} from "@/lib/match-rating/types";

function formFromPreview(
  preview: MatchCenterPreviewData,
  side: "home" | "away",
): ApexRatingFormSide {
  const block = preview.dashboard.form[side];
  const recent = preview.analysis.recentMatches[side];
  const fromDash = block?.recentMatches ?? [];
  const rows = (fromDash.length > 0 ? fromDash : recent).map((row) => ({
    result: row.result,
  }));
  return {
    form: block?.form ?? null,
    recent: rows,
    goalsFor: block?.goalsFor ?? null,
    goalsAgainst: block?.goalsAgainst ?? null,
    played: block?.played ?? null,
  };
}

function injuriesFromPreview(
  preview: MatchCenterPreviewData,
  homeTeamId: string,
  awayTeamId: string,
): ApexRatingInjury[] {
  return preview.dashboard.injuries.map((row) => {
    const teamSide =
      row.teamId === homeTeamId
        ? "home"
        : row.teamId === awayTeamId
          ? "away"
          : "unknown";
    return { teamSide };
  });
}

function predictedOdds(preview: MatchCenterPreviewData, predicted: "home" | "draw" | "away") {
  const rows = preview.dashboard.odds.filter(
    (row) =>
      row.market === "1x2" &&
      row.selection.toLowerCase() === predicted &&
      row.decimalOdds != null,
  );
  const best =
    rows.find((row) => row.isBest) ??
    rows.reduce<(typeof rows)[number] | null>((acc, row) => {
      if (row.decimalOdds == null) return acc;
      if (!acc || (acc.decimalOdds ?? 0) < row.decimalOdds) return row;
      return acc;
    }, null);
  const books = new Set(rows.map((row) => row.bookmaker).filter(Boolean)).size;
  return {
    decimalOdds: best?.decimalOdds ?? null,
    bookmakerCount: Math.max(books, rows.length > 0 ? 1 : 0),
  };
}

export function ratingInputFromPreview(
  preview: MatchCenterPreviewData,
  analysis?: MatchAnalysis,
  headline?: string,
): ApexRatingInput {
  const predicted =
    analysis?.prediction.outcome ??
    preview.analysis.predictedOutcome ??
    mostLikelyOutcome(preview.analysis.oneXTwo);
  const predictedLabel =
    analysis?.prediction.label ??
    (predicted === "home"
      ? `Victoria ${preview.analysis.homeTeam.name}`
      : predicted === "away"
        ? `Victoria ${preview.analysis.awayTeam.name}`
        : "Empate");
  const odds = predictedOdds(preview, predicted);
  const valueOdds = analysis?.valueBet?.decimalOdds ?? odds.decimalOdds;

  return {
    predictedOutcome: predicted,
    predictedLabel,
    oneXTwo: preview.analysis.oneXTwo,
    expectedGoals: preview.hybrid.expectedGoals,
    confidence: analysis?.confidence ?? preview.analysis.confidence,
    riskLevel: analysis?.riskLevel,
    recommendationAction: analysis?.recommendation.action,
    decimalOdds: valueOdds ?? odds.decimalOdds,
    bookmakerCount: odds.bookmakerCount,
    home: formFromPreview(preview, "home"),
    away: formFromPreview(preview, "away"),
    standings: {
      home: preview.dashboard.standings.home
        ? {
            rank: preview.dashboard.standings.home.rank,
            points: preview.dashboard.standings.home.points,
            played: preview.dashboard.standings.home.played,
          }
        : preview.analysis.leaguePosition.home
          ? {
              rank: preview.analysis.leaguePosition.home.rank,
              points: preview.analysis.leaguePosition.home.points,
              played: preview.analysis.leaguePosition.home.played,
            }
          : null,
      away: preview.dashboard.standings.away
        ? {
            rank: preview.dashboard.standings.away.rank,
            points: preview.dashboard.standings.away.points,
            played: preview.dashboard.standings.away.played,
          }
        : preview.analysis.leaguePosition.away
          ? {
              rank: preview.analysis.leaguePosition.away.rank,
              points: preview.analysis.leaguePosition.away.points,
              played: preview.analysis.leaguePosition.away.played,
            }
          : null,
    },
    injuries: injuriesFromPreview(
      preview,
      preview.analysis.homeTeam.id,
      preview.analysis.awayTeam.id,
    ),
    eloWinExpectancyHome: undefined,
    headline,
  };
}

export function ratingInputFromAnalysis(data: MatchAnalysisData): ApexRatingInput {
  const predicted = data.predictedOutcome;
  const predictedOddsRow = data.markets
    .find((market) => market.type === "1x2")
    ?.selections.find((row) => row.key === predicted);
  const homeRecent = data.recentMatches.home.map((row) => ({ result: row.result }));
  const awayRecent = data.recentMatches.away.map((row) => ({ result: row.result }));

  return {
    predictedOutcome: predicted,
    predictedLabel:
      predicted === "home"
        ? `Victoria ${data.homeTeam.name}`
        : predicted === "away"
          ? `Victoria ${data.awayTeam.name}`
          : "Empate",
    oneXTwo: data.oneXTwo,
    expectedGoals: data.expectedGoals,
    confidence: data.confidence,
    decimalOdds: predictedOddsRow?.decimalOdds ?? null,
    bookmakerCount: predictedOddsRow?.decimalOdds != null ? 1 : 0,
    home: {
      form: null,
      recent: homeRecent,
      goalsFor: null,
      goalsAgainst: null,
      played: homeRecent.length || null,
    },
    away: {
      form: null,
      recent: awayRecent,
      goalsFor: null,
      goalsAgainst: null,
      played: awayRecent.length || null,
    },
    standings: {
      home: data.leaguePosition.home
        ? {
            rank: data.leaguePosition.home.rank,
            points: data.leaguePosition.home.points,
            played: data.leaguePosition.home.played,
          }
        : null,
      away: data.leaguePosition.away
        ? {
            rank: data.leaguePosition.away.rank,
            points: data.leaguePosition.away.points,
            played: data.leaguePosition.away.played,
          }
        : null,
    },
    injuries: [],
    headline: data.apexScore.label,
  };
}

export function ratePreview(
  preview: MatchCenterPreviewData,
  analysis?: MatchAnalysis,
  headline?: string,
): ApexMatchRating {
  return rateMatch(ratingInputFromPreview(preview, analysis, headline));
}
