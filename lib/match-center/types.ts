/**
 * APEX Match Center™ — screen view-model.
 *
 * Shaped so each phase card can swap `source: "mock"` for live adapters later
 * (Intelligence Core, Vision feed, Learning Engine) without UI rewrites.
 */

import type { VisionLiveState } from "@/lib/apex-vision/types";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import type {
  ConfidenceScore,
  MatchOutcome,
  OutcomeProbability,
  UUID,
} from "@/lib/intelligence/types";
import type { TeamEloInput } from "@/lib/intelligence/modules/probability";
import type { BothTeamsToScoreProbability } from "@/lib/intelligence/modules/probability";
import type {
  MatchAnalysis,
  MatchAnalysisInjury,
} from "@/lib/match-analysis/analysis-types";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import type {
  Recommendation,
  ValueOpportunity,
} from "@/lib/intelligence/reasoning/contracts/types";
import type { ApexMarketType } from "@/lib/data-platform/types/odds";

export type MatchCenterPhase = "preview" | "live" | "post";

export type MatchCenterTeam = {
  id: UUID;
  name: string;
  shortName: string;
};

export type MatchCenterMeta = {
  matchId: UUID;
  /** Vendor fixture id (API-Football) when loaded from Data Platform. */
  externalId?: string | null;
  leagueName: string;
  kickoffAt: string;
  /** Canonical match status from the catalogue layer. */
  status: "scheduled" | "live" | "finished";
  homeTeam: MatchCenterTeam;
  awayTeam: MatchCenterTeam;
  /** Provenance until Data Platform / Core wiring exists. */
  source: "mock" | "data-platform" | "intelligence-core";
  /** Human label of the IDataProvider (mock, API-Football, …). */
  providerLabel?: string;
};

/**
 * Pre-match (Preview) payload.
 * `analysis` reuses Match Analysis DTO; `eloInput` + hybrid meta keep the PE seam explicit.
 */
export type MatchCenterOddsRow = {
  id: string;
  market: ApexMarketType;
  marketLabel: string;
  selection: string;
  label: string;
  decimalOdds: number | null;
  impliedProbability: number | null;
  modelProbability: number | null;
  expectedValue: number | null;
  bookmaker: string | null;
};

export type MatchCenterFormSide = {
  teamId: string;
  teamName: string;
  form: string | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
};

export type MatchCenterH2HMeeting = {
  id: string;
  kickoffAt: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

export type MatchCenterPreviewDashboard = {
  btts: BothTeamsToScoreProbability;
  odds: MatchCenterOddsRow[];
  form: {
    home: MatchCenterFormSide | null;
    away: MatchCenterFormSide | null;
  };
  h2h: MatchCenterH2HMeeting[];
  injuries: MatchAnalysisInjury[];
  recommendation: Recommendation;
  valueBet: ValueOpportunity | null;
};

export type MatchCenterPreviewData = {
  analysis: MatchAnalysisData;
  /** Inputs used (or to be used) by ProbabilityEngine.predict. */
  eloInput: TeamEloInput;
  hybrid: {
    modelVersion: string;
    expectedGoals: { home: number; away: number; total: number };
    overUnder25: { line: 2.5; over: number; under: number };
    btts: BothTeamsToScoreProbability;
  };
  dashboard: MatchCenterPreviewDashboard;
  source: "mock" | "intelligence-core" | "data-platform";
};

/** In-play (Live) payload — APEX Vision state, ready for realtime swap. */
export type MatchCenterLiveData = {
  vision: VisionLiveState;
  source: "mock" | "realtime" | "data-platform";
};

export type MatchCenterMarketVerdict = {
  id: string;
  market: string;
  label: string;
  selection: string;
  preMatchProbability: number;
  hit: boolean;
};

export type MatchCenterLearningNote = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
};

export type MatchCenterRecommendation = {
  id: string;
  priority: "low" | "medium" | "high";
  title: string;
  detail: string;
};

/**
 * Post-match payload.
 * Ready to map from Learning Engine EvaluationReport + ActualMatchResult.
 */
export type MatchCenterPostData = {
  finishedAt: string;
  finalScore: { home: number; away: number };
  actualOutcome: MatchOutcome;
  preMatch: {
    predictedOutcome: MatchOutcome;
    oneXTwo: OutcomeProbability;
    confidence: ConfidenceScore;
    modelVersion: string;
  };
  outcomeHit: boolean;
  markets: MatchCenterMarketVerdict[];
  metrics: {
    brierScore: number;
    /** Absolute error on predicted outcome probability. */
    outcomeError: number;
  };
  learningSummary: string;
  notes: MatchCenterLearningNote[];
  recommendations: MatchCenterRecommendation[];
  source: "mock" | "learning-engine" | "data-platform";
};

/**
 * Full Match Center screen payload.
 * Preview / Live / Post are built from the selected Data Platform fixture.
 */
export type MatchCenterData = {
  match: MatchCenterMeta;
  /** Phase highlighted on first paint (derived from match.status). */
  defaultPhase: MatchCenterPhase;
  preview: MatchCenterPreviewData;
  live: MatchCenterLiveData;
  post: MatchCenterPostData;
  /** Sprint 8 — AI Match Analysis (rules + PE + Data Platform). */
  aiAnalysis: MatchAnalysis;
  /** Today's (or fallback) fixtures for the selector. */
  fixtures: DashboardMatchSummary[];
  source: "mock" | "platform";
};
