/**
 * APEX Smart Combos — domain types.
 * Legs are Decision Engine outputs. Combo math never re-scores 1X2.
 */

import type {
  ApexConfidenceBand,
  ApexDecisionVerdictKind,
  ApexRiskBand,
  ApexSizingBlock,
} from "@/lib/decision-engine/types";
import type { MatchOutcome } from "@/lib/intelligence/types";

export type ComboMarket = "1x2";

export type ComboRiskProfile = "conservative" | "balanced" | "aggressive";

export type DailyComboKind = "conservative" | "value" | "aggressive" | "jackpot";

export type ComboCorrelationKind =
  | "same_fixture_conflict"
  | "same_fixture_duplicate"
  | "same_team"
  | "same_league"
  | "same_kickoff_window";

export type ComboTeam = {
  name: string;
  shortName: string;
  logoUrl: string | null;
};

export type ComboLeg = {
  fixtureId: string;
  kickoffAt: string;
  leagueName: string;
  market: ComboMarket;
  home: ComboTeam;
  away: ComboTeam;
  predicted: MatchOutcome;
  selectionLabel: string;
  /** Published decimal odds. Null when the catalogue has no price. */
  decimalOdds: number | null;
  /** Decision Engine model probability for the selected side. */
  apexProbability: number | null;
  impliedProbability: number | null;
  score: number;
  confidence: number;
  confidenceBand: ApexConfidenceBand;
  riskBand: ApexRiskBand;
  riskScore: number;
  expectedValue: number | null;
  kellyPct: number | null;
  verdict: ApexDecisionVerdictKind;
  verdictLabel: string;
  explanation: string;
};

export type ComboPairCorrelation = {
  leftFixtureId: string;
  rightFixtureId: string;
  kind: ComboCorrelationKind;
  /** 0–1 association used by the copula. Conflicts use 1. */
  rho: number;
  detail: string;
};

export type ComboCorrelationReport = {
  pairs: ComboPairCorrelation[];
  maxRho: number;
  hasConflict: boolean;
  hasDuplicate: boolean;
  /** 0–1 penalty applied to independent hit probability for display. */
  penalty: number;
  summary: string;
};

export type ComboMonteCarlo = {
  trials: number;
  seed: number;
  hitRate: number;
  independentHitRate: number;
  histogram: number[];
  p05: number;
  p50: number;
  p95: number;
};

export type ComboAnalysis = {
  legs: ComboLeg[];
  combinedOdds: number | null;
  impliedProbability: number | null;
  /** Product of DE probabilities (independence). */
  independentApexProbability: number | null;
  /** Independence product × (1 − correlation penalty). */
  adjustedApexProbability: number | null;
  expectedValue: number | null;
  confidence: number;
  confidenceBand: ApexConfidenceBand;
  riskBand: ApexRiskBand;
  riskScore: number;
  healthScore: number;
  weakest: ComboLeg | null;
  correlation: ComboCorrelationReport;
  verdict: {
    kind: ApexDecisionVerdictKind;
    label: string;
    stars: number;
  };
  sizing: ApexSizingBlock;
  explanation: string;
  blockedReason: string | null;
};

export type ComboBuildSpec = {
  legCount: number;
  oddsMin?: number | null;
  oddsMax?: number | null;
  leagues?: string[];
  markets?: ComboMarket[];
  riskProfile: ComboRiskProfile;
  requirePositiveEv?: boolean;
};

export type ComboBuildResult =
  | { ok: true; analysis: ComboAnalysis; spec: ComboBuildSpec }
  | { ok: false; reason: string; spec: ComboBuildSpec; partial: ComboLeg[] };

export type ComboSwapSuggestion = {
  kind: "remove" | "safer" | "higher_value";
  title: string;
  detail: string;
  removed: ComboLeg;
  added: ComboLeg | null;
  analysis: ComboAnalysis;
  /** Percentage-point change in independent hit probability. */
  deltaHitPct: number | null;
};

export type ComboOptimization = {
  current: ComboAnalysis;
  suggestions: ComboSwapSuggestion[];
};

export type DailySmartCombo = {
  kind: DailyComboKind;
  title: string;
  subtitle: string;
  analysis: ComboAnalysis;
};

export type DailySmartCombosBoard = {
  generatedAt: string;
  items: DailySmartCombo[];
  unavailable: Array<{ kind: DailyComboKind; reason: string }>;
};
