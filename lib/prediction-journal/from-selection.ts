import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ApexDecision } from "@/lib/decision-engine/types";
import type { MatchAnalysisCore } from "@/lib/decision-engine/from-match";
import { predictionIdFromParts } from "@/lib/prediction-journal/ids";
import type { PredictionJournalWrite } from "@/lib/prediction-journal/types";
import type { ApexScoring } from "@/lib/scoring-engine/types";

export function journalWriteFromMatchSelection(input: {
  analysis: MatchAnalysisCore;
  decision: ApexDecision;
  scoring: ApexScoring;
  bookmakerOdds?: number | null;
  season?: string | null;
}): PredictionJournalWrite {
  const { analysis, decision, scoring } = input;
  return {
    id: predictionIdFromParts({
      fixtureId: analysis.matchId,
      market: "1x2",
      selectionLabel: decision.selectionLabel,
    }),
    fixtureId: analysis.matchId,
    league: analysis.leagueName,
    season: input.season ?? null,
    homeTeam: analysis.homeTeam.name,
    awayTeam: analysis.awayTeam.name,
    market: "1x2",
    recommendation: scoring.recommendation.tier,
    bookmakerOdds: input.bookmakerOdds ?? decision.value.impliedOdds,
    modelProbability: decision.value.modelProbability,
    fairOdds: decision.value.fairOdds,
    expectedValue: decision.value.expectedValue,
    confidence: decision.confidence.value,
    risk: decision.risk.band,
    apexScore: scoring.overall,
    decision,
    modelVersion: `${analysis.modelVersion}+${decision.engineId}+${scoring.engineId}`,
  };
}

export function journalWriteFromOpportunity(input: {
  row: ApexOpportunity;
  decision: ApexDecision;
  scoring?: ApexScoring;
  season?: string | null;
}): PredictionJournalWrite {
  const { row, decision } = input;
  const scoring = input.scoring;
  return {
    id: predictionIdFromParts({
      fixtureId: row.fixtureId,
      market: row.market,
      selectionLabel: row.selectionLabel,
    }),
    fixtureId: row.fixtureId,
    league: row.leagueName,
    season: input.season ?? null,
    homeTeam: row.home.name,
    awayTeam: row.away.name,
    market: "1x2",
    recommendation: row.recommendation,
    bookmakerOdds: row.bookmakerOdds,
    modelProbability: decision.value.modelProbability,
    fairOdds: row.fairOdds,
    expectedValue: row.expectedValue,
    confidence: row.confidence,
    risk: row.riskBand,
    apexScore: row.score,
    decision,
    modelVersion: scoring
      ? `${decision.engineId}+${scoring.engineId}`
      : decision.engineId,
  };
}
