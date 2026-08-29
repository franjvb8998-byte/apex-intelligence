/**
 * APEX Opportunities — daily discovery board.
 * Rows are Decision Engine outputs on today's real fixtures. Never mock.
 */

import type { ApexScoring, ScoringTier } from "@/lib/scoring-engine/types";
import type {
  ApexConfidenceBand,
  ApexDecisionReason,
  ApexDecisionVerdictKind,
  ApexRiskBand,
} from "@/lib/decision-engine/types";
import type { MatchOutcome } from "@/lib/intelligence/types";

export type OpportunityMarket = "1x2";

export type OpportunitySideFilter = "all" | "home" | "away";

export type OpportunityKickoffWindow = "all" | "morning" | "afternoon" | "evening";

export type OpportunityRiskFilter = "all" | ApexRiskBand;

export type ApexOpportunityTeam = {
  name: string;
  shortName: string;
  logoUrl: string | null;
};

export type ApexOpportunity = {
  fixtureId: string;
  kickoffAt: string;
  leagueName: string;
  country: string | null;
  market: OpportunityMarket;
  home: ApexOpportunityTeam;
  away: ApexOpportunityTeam;
  predicted: MatchOutcome;
  selectionLabel: string;
  score: number;
  stars: number;
  confidence: number;
  confidenceBand: ApexConfidenceBand;
  riskBand: ApexRiskBand;
  riskScore: number;
  fairOdds: number | null;
  bookmakerOdds: number | null;
  valuePct: number | null;
  expectedValue: number | null;
  marketEdge: number | null;
  kellyPct: number | null;
  stakePct: number;
  stakeLabel: string;
  /** Scoring Engine v2 recommendation. Stake still comes from Decision Engine. */
  recommendation: ScoringTier;
  verdict: ApexDecisionVerdictKind;
  verdictLabel: string;
  explanation: string;
  reasonsFor: ApexDecisionReason[];
  reasonsAgainst: ApexDecisionReason[];
  positiveEdge: boolean;
};

export type OpportunityFilters = {
  league: string;
  market: OpportunityMarket | "all";
  kickoff: OpportunityKickoffWindow;
  minScore: number;
  /** Decimal EV floor. Default 0 means strictly positive EV. */
  minEv: number;
  minConfidence: number;
  risk: OpportunityRiskFilter;
  oddsMin: number | null;
  oddsMax: number | null;
  side: OpportunitySideFilter;
};

export type OpportunityHeaderStats = {
  analyzed: number;
  opportunities: number;
  elitePicks: number;
  averageConfidence: number | null;
  averageEv: number | null;
};

export type OpportunitySummaryStats = {
  analyzed: number;
  elitePicks: number;
  averageEdge: number | null;
  averageKelly: number | null;
  averageConfidence: number | null;
};

export type OpportunityMarketSummary = {
  averageInefficiency: number | null;
  averageConfidence: number | null;
  highestEv: ApexOpportunity | null;
  highestScore: ApexOpportunity | null;
  safest: ApexOpportunity | null;
  mostAggressive: ApexOpportunity | null;
};

export type ApexOpportunitiesBoard = {
  generatedAt: string;
  analyzed: ApexOpportunity[];
};

export const DEFAULT_OPPORTUNITY_FILTERS: OpportunityFilters = {
  league: "all",
  market: "all",
  kickoff: "all",
  minScore: 75,
  minEv: 0,
  minConfidence: 65,
  risk: "all",
  oddsMin: null,
  oddsMax: null,
  side: "all",
};

export const EMPTY_OPPORTUNITY_COPY = {
  title: "No quality betting opportunities were detected today.",
  body: "The APEX Decision Engine recommends waiting instead of forcing a bet.",
} as const;
