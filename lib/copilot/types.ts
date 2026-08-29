/**
 * APEX Copilot v1 — briefing and chat types.
 * Numbers always come from APEX engines / Data Platform, never from an LLM.
 */

import type { ApexDecision } from "@/lib/decision-engine/types";
import type { ApexScoring } from "@/lib/scoring-engine/types";
import type { MatchOutcome } from "@/lib/intelligence/types";
import type { Recommendation } from "@/lib/intelligence/reasoning/contracts/types";

export type CopilotRole = "user" | "assistant" | "system";

export type CopilotIntentKind =
  | "analyze_match"
  | "value_scan"
  | "explain_prediction"
  | "stake_advice"
  | "help";

export type CopilotIntent = {
  kind: CopilotIntentKind;
  query: string;
  teamQuery: string | null;
};

export type CopilotAvailability = "available" | "unavailable";

export type CopilotFact<T> = {
  status: CopilotAvailability;
  value: T | null;
  note: string | null;
};

export type CopilotMarketLine = {
  market: string;
  selection: string;
  label: string;
  modelProbability: number | null;
  fairOdds: number | null;
  decimalOdds: number | null;
  impliedProbability: number | null;
  edge: number | null;
  expectedValue: number | null;
  bookmaker: string | null;
};

export type CopilotTeamBlock = {
  id: string;
  name: string;
  form: string | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
};

export type CopilotAbsence = {
  playerName: string;
  teamName: string | null;
  detail: string;
};

export type CopilotMatchSnapshot = {
  matchId: string;
  externalId: string | null;
  leagueName: string;
  kickoffAt: string;
  status: "scheduled" | "live" | "finished";
  home: CopilotTeamBlock;
  away: CopilotTeamBlock;
  oneXTwo: { home: number; draw: number; away: number };
  overUnder25: { over: number; under: number };
  btts: { yes: number; no: number };
  expectedGoals: { home: number; away: number; total: number };
  predictedOutcome: MatchOutcome;
  predictedLabel: string;
  confidence: { value: number; band: "low" | "medium" | "high" };
  modelVersion: string;
  elo: {
    home: number;
    away: number;
    estimated: true;
  };
  strengths: Array<{ label: string; detail: string }>;
  weaknesses: Array<{ label: string; detail: string }>;
  tactical: Array<{ label: string; detail: string }>;
  recommendation: Recommendation;
  valueBet: {
    market: string;
    selection: string;
    modelProbability: number;
    decimalOdds: number | null;
    edge: number;
    kellyFraction: number | null;
    explanation: string | null;
  } | null;
  markets: CopilotMarketLine[];
  injuries: CopilotAbsence[];
  h2h: Array<{
    kickoffAt: string;
    homeTeamName: string;
    awayTeamName: string;
    homeGoals: number | null;
    awayGoals: number | null;
  }>;
  provenance: {
    dataPlatform: boolean;
    probabilityEngine: boolean;
    reasoning: "rules";
  };
  /** True when the catalogue published a start XI. Undefined if Copilot did not inspect lineups. */
  lineupsPublished?: boolean;
  /** In-play score only when the fixture is actually live. */
  liveState?: { minute: number; home: number; away: number } | null;
  /** Copied from Match Center — never re-scored here. */
  decision?: ApexDecision;
  scoring?: ApexScoring;
};

export type CopilotCall =
  | "back_home"
  | "back_away"
  | "back_draw"
  | "avoid"
  | "watch_live";

export type CopilotEvTone = "positive" | "neutral" | "negative";

export type CopilotMarketVerdict =
  | "elite"
  | "value"
  | "fair"
  | "high_risk"
  | "no_bet"
  | "avoid";

export type CopilotIntelligencePoint = {
  id: string;
  title: string;
  detail: string;
};

export type CopilotLiveOpportunity = {
  cues: string[];
};

export type CopilotIntelligence = {
  call: CopilotCall;
  confidenceBand: "low" | "medium" | "high";
  riskBand: "low" | "medium" | "high";
  evTone: CopilotEvTone;
  paragraph: string;
  reasons: CopilotIntelligencePoint[];
  concerns: CopilotIntelligencePoint[];
  live: CopilotLiveOpportunity | null;
  verdict: CopilotMarketVerdict;
  confidenceWhy: string;
};

export type CopilotBriefingSection = {
  id:
    | "executive"
    | "strengths"
    | "weaknesses"
    | "live"
    | "market"
    | "confidence";
  title: string;
  body: string;
  bullets?: string[];
};

export type CopilotSuggestedStake = {
  units: number;
  label: string;
  rationale: string;
};

export type CopilotBriefing = {
  matchLabel: string;
  league: string;
  generatedAt: string;
  analyst: string;
  modelId: string;
  sections: CopilotBriefingSection[];
  stake: CopilotSuggestedStake;
  recommendationAction: Recommendation["action"];
  confidenceBand: "low" | "medium" | "high";
  riskLevel: "low" | "medium" | "high";
  intelligence: CopilotIntelligence;
};

export type CopilotCardKind = "analysis" | "prediction" | "explainable" | "briefing";

export type CopilotAnalysisCardData = {
  kind: "analysis";
  matchLabel: string;
  league: string;
  summary: string;
  risk: "low" | "medium" | "high";
  factors: string[];
};

export type CopilotPredictionCardData = {
  kind: "prediction";
  matchLabel: string;
  outcome: string;
  confidence: number;
  oneXTwo: { home: number; draw: number; away: number };
  valueNote: string;
};

export type CopilotExplainableCardData = {
  kind: "explainable";
  matchLabel: string;
  explainable: import("@/lib/explainable-ai/types").ExplainablePrediction;
};

export type CopilotBriefingCardData = {
  kind: "briefing";
  briefing: CopilotBriefing;
};

export type CopilotCardData =
  | CopilotAnalysisCardData
  | CopilotPredictionCardData
  | CopilotExplainableCardData
  | CopilotBriefingCardData;

export type CopilotMessage = {
  id: string;
  role: CopilotRole;
  content: string;
  createdAt: string;
  card?: CopilotCardData;
};

export type CopilotChatSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
};

export type CopilotReply = {
  content: string;
  card?: CopilotCardData;
  intent: CopilotIntentKind;
  providerId: string;
};

export type CopilotAskInput = {
  prompt: string;
};
