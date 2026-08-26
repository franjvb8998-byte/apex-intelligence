/**
 * Sprint 10 — Explainable AI contracts.
 * Structured explanations for predictions (rules only, no OpenAI).
 */

import type { ConfidenceScore, MatchOutcome } from "@/lib/intelligence/types";

export type EvidenceSource =
  | "probability-engine"
  | "data-platform"
  | "team-stats"
  | "timeline"
  | "rules";

export type ExplanationEvidence = {
  id: string;
  source: EvidenceSource;
  label: string;
  value: string;
};

export type ExplainableFactor = {
  id: string;
  label: string;
  detail: string;
  /** Relative importance in [0, 1]. */
  weight: number;
  polarity: "positive" | "negative";
  evidenceIds: string[];
};

export type ExplanationQualityScore = {
  /** 0–100 composite quality of the explanation / signal. */
  value: number;
  band: "low" | "medium" | "high";
  label: string;
  components: Array<{
    key: string;
    label: string;
    value: number;
  }>;
};

/**
 * Full explainable prediction payload for UI + Copilot.
 */
export type ExplainablePrediction = {
  matchId: string;
  predictedOutcome: MatchOutcome;
  predictedLabel: string;
  summary: string;
  confidence: ConfidenceScore;
  positiveFactors: ExplainableFactor[];
  negativeFactors: ExplainableFactor[];
  evidence: ExplanationEvidence[];
  qualityScore: ExplanationQualityScore;
  generatedAt: string;
  method: "rules";
};
