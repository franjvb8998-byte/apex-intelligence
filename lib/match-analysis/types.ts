/**
 * View-model for Match Analysis UI.
 * Shaped to map cleanly from Intelligence Core outputs
 * (HybridProbabilityResult, PredictionExplanation, ConfidenceScore).
 */

import type {
  ConfidenceScore,
  MatchOutcome,
  OutcomeProbability,
  UUID,
} from "@/lib/intelligence/types";
import type { ExplanationFactor } from "@/lib/intelligence/types/engine";

export type MatchAnalysisTeam = {
  id: UUID;
  name: string;
  shortName: string;
};

export type MatchAnalysisMarket = {
  id: string;
  label: string;
  /** e.g. "1X2", "Over/Under 2.5", "BTTS" */
  type: "1x2" | "over_under" | "btts" | "other";
  line: number | null;
  selections: Array<{
    key: string;
    label: string;
    probability: number;
    /** Optional decimal odds for display when markets module is wired. */
    decimalOdds?: number | null;
  }>;
};

export type ApexScoreBreakdown = {
  /** Composite 0–100 score for decision quality / model conviction. */
  value: number;
  label: string;
  components: Array<{
    key: string;
    label: string;
    value: number;
    weight: number;
  }>;
};

export type MatchRisk = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
};

export type MatchAnalysisExplanation = {
  summary: string;
  factors: ExplanationFactor[];
  caveats: string[];
  /** Longer narrative shown in the expandable panel. */
  narrative: string;
};

/**
 * Full screen payload. Replace `getMockMatchAnalysis()` with a Core adapter later.
 */
export type MatchAnalysisData = {
  matchId: UUID;
  leagueName: string;
  kickoffAt: string;
  status: "scheduled" | "live" | "finished";
  homeTeam: MatchAnalysisTeam;
  awayTeam: MatchAnalysisTeam;
  oneXTwo: OutcomeProbability;
  predictedOutcome: MatchOutcome;
  confidence: ConfidenceScore;
  apexScore: ApexScoreBreakdown;
  markets: MatchAnalysisMarket[];
  keyFactors: ExplanationFactor[];
  risks: MatchRisk[];
  explanation: MatchAnalysisExplanation;
  modelVersion: string;
  /** Provenance flag until live Core wiring exists. */
  source: "mock" | "intelligence-core";
};
