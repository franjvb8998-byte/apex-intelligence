/**
 * Attach Scoring Engine v2 to a published match selection.
 * Decision Engine still sizes stake/Kelly; this file does not change DE weights.
 */

import { evaluateDecision } from "@/lib/decision-engine/evaluate";
import {
  decisionInputFromMatch,
  type DecisionMatchExtras,
  type MatchAnalysisCore,
} from "@/lib/decision-engine/from-match";
import type {
  ApexDecision,
  ApexDecisionInput,
  ApexDecisionVerdictKind,
} from "@/lib/decision-engine/types";
import type { ApexScoreBreakdown } from "@/lib/match-analysis/types";
import { evaluateScoringFromEngines } from "@/lib/scoring-engine/evaluate";
import type { ApexScoring, ScoringTier } from "@/lib/scoring-engine/types";
import type { TeamIntelligence } from "@/lib/team-intelligence/models";
import { captureMatchRecommendation } from "@/lib/intelligence-learning/capture";
import { persistMatchPrediction } from "@/lib/prediction-journal/capture";

export function apexScoreFromScoring(scored: ApexScoring): ApexScoreBreakdown {
  return {
    value: scored.overall,
    label: scored.recommendation.tier,
    components: scored.components.map((row) => ({
      key: row.key,
      label: row.label,
      value: row.score ?? 0,
      weight: row.weight,
    })),
  };
}

export function verdictKindFromTier(tier: ScoringTier): ApexDecisionVerdictKind {
  if (tier === "Elite") return "elite_pick";
  if (tier === "Strong Bet") return "strong_bet";
  if (tier === "Value Bet") return "lean_bet";
  if (tier === "Watch") return "pass";
  return "avoid";
}

export function scoreMatchSelection(args: {
  analysis: MatchAnalysisCore;
  extras?: DecisionMatchExtras;
  team?: TeamIntelligence;
  season?: string | null;
}): {
  decision: ApexDecision;
  decisionInput: ApexDecisionInput;
  scoring: ApexScoring;
} {
  const extras = args.extras ?? {};
  const decisionInput = decisionInputFromMatch(args.analysis, extras);
  const decision = evaluateDecision(decisionInput);
  const scoring = evaluateScoringFromEngines({
    selectionId: args.analysis.matchId,
    selectionLabel: decision.selectionLabel,
    decision,
    decisionInput,
    team: args.team,
  });
  captureMatchRecommendation({
    analysis: args.analysis,
    decision,
    scoring,
  });
  persistMatchPrediction({
    analysis: args.analysis,
    decision,
    scoring,
    bookmakerOdds: decisionInput.decimalOdds,
    season: args.season,
  });
  return { decision, decisionInput, scoring };
}
