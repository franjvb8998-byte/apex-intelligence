import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ApexDecision, ApexDecisionInput } from "@/lib/decision-engine/types";
import { countryFromLeague } from "@/lib/opportunity-scanner/country";
import { fixtureIdFromMatch } from "@/lib/match-center/fixture-id";
import type { MatchCenterData } from "@/lib/match-center/types";
import {
  evaluateScoringFromEngines,
  scoreMatchSelection,
} from "@/lib/scoring-engine";
import type { ApexScoring } from "@/lib/scoring-engine/types";
import type { TeamIntelligence } from "@/lib/team-intelligence/models";
import { selectionTwinFromPreview } from "@/lib/team-intelligence/builders";
import { captureOpportunityRecommendation } from "@/lib/intelligence-learning/capture";
import { persistOpportunityPrediction } from "@/lib/prediction-journal/capture";

function scoringForOpportunity(input: {
  fixtureId: string;
  decision: ApexDecision;
  decisionInput?: ApexDecisionInput;
  team?: TeamIntelligence;
  scoring?: ApexScoring;
}): ApexScoring {
  if (input.scoring) return input.scoring;
  return evaluateScoringFromEngines({
    selectionId: input.fixtureId,
    selectionLabel: input.decision.selectionLabel,
    decision: input.decision,
    decisionInput: input.decisionInput,
    team: input.team,
  });
}

export function mapOpportunityFromCenter(
  data: MatchCenterData,
): ApexOpportunity | null {
  const fixtureId = fixtureIdFromMatch({
    id: data.match.externalId ?? data.match.matchId,
    externalId: data.match.externalId,
  });
  if (!fixtureId) return null;
  const analysis = data.preview.analysis;
  const scored =
    analysis.scoring && analysis.decision
      ? { decision: analysis.decision, scoring: analysis.scoring }
      : scoreMatchSelection({
          analysis,
          extras: {
            injuries: data.preview.dashboard.injuries,
            homeForm: data.preview.dashboard.form.home,
            awayForm: data.preview.dashboard.form.away,
            weather: data.match.weather,
            odds: data.preview.dashboard.odds,
          },
          team: selectionTwinFromPreview(
            data.match,
            data.preview.dashboard,
            analysis.predictedOutcome,
          ),
        });
  return mapOpportunityFromDecision({
    fixtureId,
    kickoffAt: data.match.kickoffAt,
    leagueName: data.match.leagueName,
    home: {
      name: data.match.homeTeam.name,
      shortName: data.match.homeTeam.shortName,
      logoUrl: data.match.homeTeam.logoUrl,
    },
    away: {
      name: data.match.awayTeam.name,
      shortName: data.match.awayTeam.shortName,
      logoUrl: data.match.awayTeam.logoUrl,
    },
    predicted: analysis.predictedOutcome,
    country: countryFromLeague(
      data.match.leagueName,
      data.match.venue?.country,
    ),
    decision: scored.decision,
    scoring: scored.scoring,
  });
}

export function mapOpportunityFromDecision(input: {
  fixtureId: string;
  kickoffAt: string;
  leagueName: string;
  home: ApexOpportunity["home"];
  away: ApexOpportunity["away"];
  predicted: ApexOpportunity["predicted"];
  country?: string | null;
  decision: ApexDecision;
  decisionInput?: ApexDecisionInput;
  team?: TeamIntelligence;
  scoring?: ApexScoring;
}): ApexOpportunity {
  const { decision } = input;
  const scoring = scoringForOpportunity(input);
  const row: ApexOpportunity = {
    fixtureId: input.fixtureId,
    kickoffAt: input.kickoffAt,
    leagueName: input.leagueName,
    country: countryFromLeague(input.leagueName, input.country),
    market: "1x2",
    home: input.home,
    away: input.away,
    predicted: input.predicted,
    selectionLabel: decision.selectionLabel,
    score: scoring.overall,
    stars: scoring.recommendation.stars,
    confidence: decision.confidence.value,
    confidenceBand: decision.confidence.band,
    riskBand: decision.risk.band,
    riskScore: decision.risk.score,
    fairOdds: decision.value.fairOdds,
    bookmakerOdds: decision.value.impliedOdds,
    valuePct: decision.value.valuePct,
    expectedValue: decision.value.expectedValue,
    marketEdge: decision.value.marketEdge,
    kellyPct: decision.sizing.kellyPct,
    stakePct: decision.sizing.stakePct,
    stakeLabel: decision.sizing.stakeLabel,
    recommendation: scoring.recommendation.tier,
    verdict: decision.verdict.kind,
    verdictLabel: scoring.recommendation.tier,
    explanation: scoring.explanation.summary,
    reasonsFor: decision.reasonsFor,
    reasonsAgainst: decision.reasonsAgainst,
    positiveEdge: decision.value.positiveEdge,
  };
  captureOpportunityRecommendation(row, scoring);
  persistOpportunityPrediction({ row, decision, scoring });
  return row;
}
