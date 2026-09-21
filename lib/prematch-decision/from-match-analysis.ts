/**
 * Map published Match Analysis output onto a ticket snapshot.
 * Does not recompute Probability Engine or scoring.
 */

import { vendorFixtureId } from "@/lib/match-center/fixture-id";
import type {
  MatchCenterAbsence,
  MatchCenterFormSide,
  MatchCenterOddsRow,
} from "@/lib/match-center/types";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import type {
  PrematchEvidenceAvailability,
  PrematchPublishedMarket,
  PrematchPublishedQuote,
  PrematchPublishedScoring,
  PrematchPublishedSnapshot,
  PrematchTicketMarketId,
} from "@/lib/prematch-decision/ticket";

export type MatchAnalysisTicketExtras = {
  leagueId?: string | null;
  season?: string | null;
  odds?: MatchCenterOddsRow[];
  injuries?: MatchCenterAbsence[];
  homeForm?: MatchCenterFormSide | null;
  awayForm?: MatchCenterFormSide | null;
  sourceMode?: PrematchPublishedSnapshot["sourceMode"];
};

const PUBLISHED_MARKETS = new Set<PrematchTicketMarketId>([
  "1x2",
  "over_under",
  "btts",
]);

function isPublishedMarket(
  type: string,
): type is PrematchTicketMarketId {
  return PUBLISHED_MARKETS.has(type as PrematchTicketMarketId);
}

function predictedSelectionId(data: MatchAnalysisData): string {
  if (data.predictedOutcome === "home") return "home";
  if (data.predictedOutcome === "away") return "away";
  return "draw";
}

function marketsFromAnalysis(
  data: MatchAnalysisData,
): PrematchPublishedMarket[] {
  const markets: PrematchPublishedMarket[] = [];
  for (const market of data.markets) {
    if (!isPublishedMarket(market.type)) continue;
    markets.push({
      marketId: market.type,
      marketLine: market.line,
      selections: market.selections.map((selection) => ({
        selectionId: selection.key,
        selectionLabel: selection.label,
        modelProbability: selection.probability,
      })),
    });
  }
  return markets;
}

function quotesFromOdds(
  rows: MatchCenterOddsRow[] | undefined,
): PrematchPublishedQuote[] {
  const quotes: PrematchPublishedQuote[] = [];
  for (const row of rows ?? []) {
    if (!isPublishedMarket(row.market)) continue;
    quotes.push({
      marketId: row.market,
      selectionId: row.selection,
      bookmaker: row.bookmaker,
      offeredOdds: row.decimalOdds,
      impliedProbability: row.impliedProbability,
      marketAsOfUtc: null,
    });
  }
  return quotes;
}

function scoringFromAnalysis(
  data: MatchAnalysisData,
): PrematchPublishedScoring | null {
  const decision = data.decision;
  const scoring = data.scoring;
  return {
    apexScore: scoring?.overall ?? decision.score.value,
    confidence: decision.confidence.value,
    confidenceBand: decision.confidence.band,
    riskScore: decision.risk.score,
    riskBand: decision.risk.band,
    expectedValue: decision.value.expectedValue,
    recommendationTier: scoring?.recommendation.tier ?? null,
    recommendationKind: decision.verdict.kind,
    selectionId: predictedSelectionId(data),
    selectionLabel: scoring?.selectionLabel ?? decision.selectionLabel,
    kellyFraction: decision.sizing.kellyFraction,
    kellyPct: decision.sizing.kellyPct,
    stakePct: decision.sizing.stakePct,
    stakeLabel: decision.sizing.stakeLabel,
    fairOdds: decision.value.fairOdds,
    offeredOdds: decision.value.impliedOdds,
    impliedProbability: decision.value.marketProbability,
    bookmaker: data.report.market.bookmaker,
  };
}

function evidenceFromAnalysis(
  data: MatchAnalysisData,
  extras: MatchAnalysisTicketExtras,
): PrematchEvidenceAvailability {
  const statistics =
    data.recentMatches.home.length > 0 ||
    data.leaguePosition.home != null ||
    data.matchMetrics.home != null;
  const tactical = data.decision.score.components.some(
    (row) =>
      (row.key === "attack" || row.key === "defense" || row.key === "xg") &&
      row.available,
  );
  const market =
    data.decision.value.impliedOdds != null ||
    (extras.odds ?? []).some(
      (row) => row.decimalOdds != null && Number.isFinite(row.decimalOdds),
    );
  const teamIntelligence = (data.twins?.home.scores.coverage ?? 0) > 0.15;
  const context =
    Boolean(data.context?.weather) ||
    Boolean(data.context?.referee) ||
    data.decision.score.components.some(
      (row) => (row.key === "rest" || row.key === "injuries") && row.available,
    );
  const news =
    (data.twins?.home.health.injuries.available ?? false) ||
    (data.twins?.home.health.suspensions.available ?? false) ||
    data.risks.some((row) =>
      /injur|suspen|absent/i.test(`${row.title} ${row.detail}`),
    );
  const injuries =
    (extras.injuries?.length ?? 0) > 0 ||
    (data.twins?.home.health.injuries.available ?? false) ||
    (data.twins?.away?.health.injuries.available ?? false);
  const h2h = data.h2h.length > 0;
  const form =
    extras.homeForm != null ||
    extras.awayForm != null ||
    data.recentMatches.home.length > 0 ||
    data.recentMatches.away.length > 0;

  return {
    statistics,
    tactical,
    market,
    teamIntelligence,
    context,
    news,
    injuries,
    h2h,
    form,
  };
}

export function publishedSnapshotFromMatchAnalysis(
  data: MatchAnalysisData,
  extras: MatchAnalysisTicketExtras = {},
): PrematchPublishedSnapshot {
  return {
    fixtureId: vendorFixtureId(data.matchId) ?? data.matchId,
    leagueId: extras.leagueId ?? null,
    season: extras.season ?? null,
    homeTeamId: data.homeTeam.id,
    awayTeamId: data.awayTeam.id,
    homeTeamName: data.homeTeam.name,
    awayTeamName: data.awayTeam.name,
    kickoffUtc: data.kickoffAt,
    vendorStatusShort: data.vendorStatusShort ?? null,
    sourceMode: extras.sourceMode ?? "match-analysis",
    modelVersion: data.modelVersion,
    expectedGoals: data.expectedGoals,
    markets: marketsFromAnalysis(data),
    quotes: quotesFromOdds(extras.odds),
    scoring: scoringFromAnalysis(data),
    evidence: evidenceFromAnalysis(data, extras),
  };
}
