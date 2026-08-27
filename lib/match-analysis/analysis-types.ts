/**
 * Sprint 8 — AI Match Analysis contracts.
 * Aggregates Data Platform + Probability Engine + rule-based Reasoning signals.
 */

import type { ApexMatchEvent } from "@/lib/data-platform/types/event";
import type { ApexLeague, ApexPlayer, ApexTeam } from "@/lib/data-platform/types/team";
import type { ApexMatch } from "@/lib/data-platform/types/match";
import type { HybridProbabilityResult } from "@/lib/intelligence/modules/probability";
import type {
  ConfidenceScore,
  MatchOutcome,
  OutcomeProbability,
} from "@/lib/intelligence/types";
import type {
  Explanation,
  Recommendation,
  ValueOpportunity,
} from "@/lib/intelligence/reasoning/contracts/types";
import type { ExplainablePrediction } from "@/lib/explainable-ai/types";

/** Team statistics snapshot (compatible with Data Platform adapters). */
export type MatchAnalysisTeamStatSnapshot = {
  form?: string | null;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  played?: number;
  teamName?: string;
};

export type MatchAnalysisTeamStats = {
  home?: MatchAnalysisTeamStatSnapshot | null;
  away?: MatchAnalysisTeamStatSnapshot | null;
};

export type MatchAnalysisKeyPlayer = {
  id: string;
  name: string;
  teamId: string | null;
  position: string;
  shirtNumber: number | null;
};

export type MatchAnalysisInjury = {
  id: string;
  playerName: string;
  teamId: string | null;
  detail: string;
};

/**
 * Service input — all signals already normalized (no vendor JSON).
 */
export type MatchAnalysisInput = {
  match: ApexMatch;
  homeTeam: ApexTeam;
  awayTeam: ApexTeam;
  league?: ApexLeague | null;
  teamStats?: MatchAnalysisTeamStats;
  probability: HybridProbabilityResult;
  confidence?: ConfidenceScore;
  timeline?: ApexMatchEvent[];
  /** Optional market odds for value detection (decimal). */
  marketOdds?: {
    home?: number | null;
    draw?: number | null;
    away?: number | null;
    over25?: number | null;
    under25?: number | null;
    bttsYes?: number | null;
    bttsNo?: number | null;
  };
  players?: ApexPlayer[];
  /** Injury feed from the data layer when available. */
  injuries?: MatchAnalysisInjury[];
};

export type MatchAnalysisPrediction = {
  outcome: MatchOutcome;
  label: string;
  oneXTwo: OutcomeProbability;
  modelVersion: string;
};

export type MatchAnalysisFactor = {
  id: string;
  label: string;
  detail: string;
  side?: "home" | "away" | "match";
};

export type MatchAnalysisExpectedGoals = {
  home: number;
  away: number;
  total: number;
};

/**
 * Full AI Match Analysis output (Sprint 8).
 */
export type MatchAnalysis = {
  matchId: string;
  generatedAt: string;
  prediction: MatchAnalysisPrediction;
  confidence: ConfidenceScore;
  strengths: MatchAnalysisFactor[];
  weaknesses: MatchAnalysisFactor[];
  tacticalFactors: MatchAnalysisFactor[];
  recentForm: {
    home: string | null;
    away: string | null;
    summary: string;
  };
  keyPlayers: MatchAnalysisKeyPlayer[];
  injuries: MatchAnalysisInjury[];
  expectedGoals: MatchAnalysisExpectedGoals;
  riskLevel: "low" | "medium" | "high";
  recommendation: Recommendation;
  valueBet: ValueOpportunity | null;
  explainability: Explanation;
  /** Sprint 10 — structured Explainable AI report. */
  explainable: ExplainablePrediction;
  /** Provenance — never OpenAI in this sprint. */
  source: {
    dataPlatform: boolean;
    probabilityEngine: boolean;
    reasoning: "rules";
  };
};

export type MatchAnalysisFromBundleOptions = {
  teamStats?: MatchAnalysisTeamStats;
  marketOdds?: MatchAnalysisInput["marketOdds"];
  injuries?: MatchAnalysisInjury[];
  homeElo?: number;
  awayElo?: number;
};
