/**
 * APEX Scoring Engine v2 — published facts in, platform score out.
 * Missing signals stay null and are dropped from the blend. No HTTP. No UI.
 */

import type { MatchOutcome } from "@/lib/intelligence/types";

export type ScoringComponentKey =
  | "probability"
  | "expectedValue"
  | "marketValue"
  | "teamIntelligence"
  | "momentum"
  | "tactical"
  | "confidence"
  | "risk"
  | "dataQuality";

export type ScoringTier =
  | "Elite"
  | "Strong Bet"
  | "Value Bet"
  | "Watch"
  | "Avoid";

export type ScoringComponent = {
  key: ScoringComponentKey;
  label: string;
  weight: number;
  /** 0–100 when published; null if the catalogue / upstream engine is silent. */
  score: number | null;
  available: boolean;
  note: string;
};

export type ScoringEngineInput = {
  selectionId: string;
  selectionLabel: string;
  predicted: MatchOutcome | null;
  /** Probability Engine mass on the selection, 0–1. */
  modelProbability: number | null;
  oneXTwo: { home: number; draw: number; away: number } | null;
  decimalOdds: number | null;
  bookmakerCount: number;
  /** Decimal EV when already priced; otherwise derived from p × odds − 1. */
  expectedValue: number | null;
  marketEdge: number | null;
  /** Team Intelligence overall 0–100. */
  teamIntelligenceScore: number | null;
  teamIntelligenceCoverage: number | null;
  momentumScore: number | null;
  tacticalScore: number | null;
  /** Reliability 0–100 from Decision Engine confidence when present. */
  confidence: number | null;
  /** Raw risk 0–100 (higher = riskier) from Decision Engine risk when present. */
  risk: number | null;
  /** Share of upstream catalogue that published, 0–1. */
  coverage: number | null;
  formSample: number | null;
  injuriesPublished: boolean;
};

export type ScoringExplanationFactor = {
  key: ScoringComponentKey | "tier";
  title: string;
  detail: string;
};

export type ScoringExplanation = {
  summary: string;
  overall: number;
  coverage: number;
  recommendation: ScoringTier;
  supporting: ScoringExplanationFactor[];
  against: ScoringExplanationFactor[];
};

export type ScoringRecommendation = {
  tier: ScoringTier;
  stars: number;
  note: string;
};

export type ApexScoring = {
  engineId: "scoring-v2";
  selectionId: string;
  selectionLabel: string;
  overall: number;
  coverage: number;
  components: ScoringComponent[];
  recommendation: ScoringRecommendation;
  explanation: ScoringExplanation;
};
