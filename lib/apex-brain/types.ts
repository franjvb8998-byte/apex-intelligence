/**
 * APEX Brain v2 briefing — generated copy, never scores.
 */

export type BrainRecommendationKind =
  | "strong_bet"
  | "bet"
  | "lean_bet"
  | "watch"
  | "skip";

export type BrainPoint = {
  id: string;
  title: string;
  detail: string;
};

export type ApexBrainBriefing = {
  executiveSummary: string;
  strengths: BrainPoint[];
  risks: BrainPoint[];
  why: string;
  recommendation: {
    kind: BrainRecommendationKind;
    label: "STRONG BET" | "BET" | "LEAN BET" | "WATCH" | "SKIP";
    explanation: string;
  };
  confidenceExplanation: string;
  advantages: BrainPoint[];
  disadvantages: BrainPoint[];
  verdict: string;
};
