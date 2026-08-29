/**
 * Assemble the APEX Intelligence Report from Match Analysis + Match Center extras.
 */

import { buildReportFacts, type BuildFactsInput } from "@/lib/intelligence-report/facts";
import { buildBreakdown } from "@/lib/intelligence-report/breakdown";
import { buildNarrative } from "@/lib/intelligence-report/narrative";
import { buildReportReasons } from "@/lib/intelligence-report/reasons";
import { buildReportRisks } from "@/lib/intelligence-report/risks";
import type { ApexIntelligenceReport, ApexReportMarket } from "@/lib/intelligence-report/types";
import {
  adjustConfidence,
  decideRecommendation,
  decideVerdict,
} from "@/lib/intelligence-report/verdict";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import type {
  MatchCenterAbsence,
  MatchCenterFormSide,
  MatchCenterOddsRow,
} from "@/lib/match-center/types";
import {
  expectedValue,
  fairOdds,
  impliedProbability,
} from "@/lib/match-rating/pricing";

export type BuildIntelligenceReportInput = {
  data: Omit<MatchAnalysisData, "report" | "decision">;
  injuries?: MatchCenterAbsence[];
  homeForm?: MatchCenterFormSide | null;
  awayForm?: MatchCenterFormSide | null;
  weather?: string | null;
  odds?: MatchCenterOddsRow[];
};

const EV_EPS = 0.005;
const EDGE_EPS = 0.005;

function buildMarket(
  data: Omit<MatchAnalysisData, "report" | "decision">,
  facts: ReturnType<typeof buildReportFacts>,
): ApexReportMarket {
  const modelProbability = data.oneXTwo[data.predictedOutcome];
  const bookmakerOdds = facts.bestOdds?.decimal ?? null;
  const implied = impliedProbability(bookmakerOdds);
  const ev =
    data.rating.expectedValue ??
    expectedValue(modelProbability, bookmakerOdds);
  const marketEdge =
    implied != null ? modelProbability - implied : null;
  const kellyPct =
    data.rating.recommendedKelly != null
      ? data.rating.recommendedKelly * 100
      : data.rating.kellyFraction != null
        ? data.rating.kellyFraction * 100
        : null;

  const positiveEv = ev != null && ev > EV_EPS;
  const negativeEv = ev != null && ev < -EV_EPS;
  const fair = data.rating.fairOdds ?? fairOdds(modelProbability);
  const underpriced =
    bookmakerOdds != null && fair != null && bookmakerOdds > fair + 0.01;
  const overpriced =
    bookmakerOdds != null && fair != null && bookmakerOdds < fair - 0.01;

  return {
    bookmakerOdds,
    bookmaker: facts.bestOdds?.bookmaker ?? null,
    fairOdds: fair,
    modelProbability,
    expectedValue: ev,
    kellyPct,
    impliedProbability: implied,
    marketEdge,
    flags: {
      positiveEv,
      negativeEv,
      overpriced,
      underpriced,
    },
  };
}

export function buildIntelligenceReport(
  input: BuildIntelligenceReportInput,
): ApexIntelligenceReport {
  const factsInput: BuildFactsInput = {
    data: input.data,
    injuries: input.injuries ?? [],
    homeForm: input.homeForm ?? null,
    awayForm: input.awayForm ?? null,
    weather: input.weather ?? null,
    odds: input.odds ?? [],
  };
  const facts = buildReportFacts(factsInput);
  const reasons = buildReportReasons(facts, input.data);
  const risks = buildReportRisks({
    facts,
    rating: input.data.rating,
    oneXTwo: input.data.oneXTwo,
  });
  const confidence = adjustConfidence(input.data.rating.confidencePct, risks);
  const verdict = decideVerdict(input.data.rating, confidence);
  const recommendation = decideRecommendation(verdict, input.data.rating);
  const market = buildMarket(input.data, facts);
  const breakdown = buildBreakdown({
    rating: input.data.rating,
    oneXTwo: input.data.oneXTwo,
    risks,
  });
  const narrative = buildNarrative({
    facts,
    rating: input.data.rating,
    market,
    reasons,
    risks,
    verdict: {
      ...verdict,
      predictedOutcome: input.data.predictedOutcome,
    },
    recommendation,
  });

  return {
    verdict: {
      ...verdict,
      predictedOutcome: input.data.predictedOutcome,
    },
    confidence,
    reasons,
    risks,
    market,
    recommendation,
    narrative,
    breakdown,
    metricsUsed: input.data.rating.metrics,
  };
}
