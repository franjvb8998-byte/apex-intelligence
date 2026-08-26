/**
 * APEX Match Center™ — screen view-model.
 *
 * Shaped so each phase card can swap `source: "mock"` for live adapters later
 * (Intelligence Core, Vision feed, Learning Engine) without UI rewrites.
 */

import type { VisionLiveState } from "@/lib/apex-vision/types";
import type {
  ConfidenceScore,
  MatchOutcome,
  OutcomeProbability,
  UUID,
} from "@/lib/intelligence/types";
import type { TeamEloInput } from "@/lib/intelligence/modules/probability";
import type { MatchAnalysis } from "@/lib/match-analysis/analysis-types";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";

export type MatchCenterPhase = "preview" | "live" | "post";

export type MatchCenterTeam = {
  id: UUID;
  name: string;
  shortName: string;
};

export type MatchCenterMeta = {
  matchId: UUID;
  leagueName: string;
  kickoffAt: string;
  /** Canonical match status from the catalogue layer. */
  status: "scheduled" | "live" | "finished";
  homeTeam: MatchCenterTeam;
  awayTeam: MatchCenterTeam;
  /** Provenance until Data Platform / Core wiring exists. */
  source: "mock" | "data-platform" | "intelligence-core";
};

/**
 * Pre-match (Preview) payload.
 * `analysis` reuses Match Analysis DTO; `eloInput` + hybrid meta keep the PE seam explicit.
 */
export type MatchCenterPreviewData = {
  analysis: MatchAnalysisData;
  /** Inputs used (or to be used) by ProbabilityEngine.predict. */
  eloInput: TeamEloInput;
  hybrid: {
    modelVersion: string;
    expectedGoals: { home: number; away: number; total: number };
    overUnder25: { line: 2.5; over: number; under: number };
  };
  source: "mock" | "intelligence-core";
};

/** In-play (Live) payload — APEX Vision state, ready for realtime swap. */
export type MatchCenterLiveData = {
  vision: VisionLiveState;
  source: "mock" | "realtime";
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
  source: "mock" | "learning-engine";
};

/**
 * Full Match Center screen payload.
 * Replace `getMockMatchCenter()` with Core / Vision / Learning adapters later.
 */
export type MatchCenterData = {
  match: MatchCenterMeta;
  /** Phase highlighted on first paint (derived from match.status in mock). */
  defaultPhase: MatchCenterPhase;
  preview: MatchCenterPreviewData;
  live: MatchCenterLiveData;
  post: MatchCenterPostData;
  /** Sprint 8 — AI Match Analysis (rules + PE + Data Platform). */
  aiAnalysis: MatchAnalysis;
  source: "mock" | "platform";
};
