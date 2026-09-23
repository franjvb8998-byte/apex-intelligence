/**
 * Canonical immutable prematch decision ticket.
 *
 * Historical evidence of what APEX published before kickoff.
 * Not a second model, not live intelligence, and not a source of truth
 * for recomputation. Future LiveDecisionSnapshot is a separate type.
 */

import type {
  PrematchActionabilityReason,
} from "@/lib/prematch-decision/actionability";
import type { PrematchInputProvenance } from "@/lib/prematch-decision/input-provenance";
import type { ApexConfidenceBand, ApexDecisionVerdictKind, ApexRiskBand } from "@/lib/decision-engine/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";

export const PREMATCH_DECISION_TICKET_SCHEMA_VERSION = "1.0.0";

export const PREMATCH_DECISION_TICKET_ID_PREFIX =
  "apex:prematch-decision:v1";

export type PrematchTicketSourceMode =
  | "match-analysis"
  | "published-snapshot"
  | "scanner";

export type PrematchTicketMarketId = "1x2" | "over_under" | "btts";

export type PrematchTicketSelection = {
  marketId: PrematchTicketMarketId;
  marketLine: number | null;
  selectionId: string;
  selectionLabel: string;
  modelProbability: number;
  fairOdds: number | null;
  bookmaker: string | null;
  offeredOdds: number | null;
  impliedProbability: number | null;
  marketAsOfUtc: string | null;
};

export type PrematchTicketScoring = {
  apexScore: number | null;
  confidence: number | null;
  confidenceBand: ApexConfidenceBand | null;
  riskScore: number | null;
  riskBand: ApexRiskBand | null;
  expectedValue: number | null;
  recommendationTier: ScoringTier | null;
  recommendationKind: ApexDecisionVerdictKind | null;
  selectionId: string | null;
  selectionLabel: string | null;
  kellyFraction: number | null;
  kellyPct: number | null;
  stakePct: number | null;
  stakeLabel: string | null;
  fairOdds: number | null;
  offeredOdds: number | null;
  impliedProbability: number | null;
  bookmaker: string | null;
};

export type PrematchEvidenceAvailability = {
  statistics: boolean;
  tactical: boolean;
  market: boolean;
  teamIntelligence: boolean;
  context: boolean;
  news: boolean;
  injuries: boolean;
  h2h: boolean;
  form: boolean;
};

export const EMPTY_PREMATCH_EVIDENCE: PrematchEvidenceAvailability = {
  statistics: false,
  tactical: false,
  market: false,
  teamIntelligence: false,
  context: false,
  news: false,
  injuries: false,
  h2h: false,
  form: false,
};

/**
 * Frozen record of a prematch decision. One ticket per fixture: PE publishes
 * a single bundle (1X2, O/U 2.5, BTTS, xG) plus one scored recommendation.
 *
 * Compatible with a future evaluator (log loss / Brier / CLV) that compares
 * these frozen probabilities to a terminal outcome without recomputing PE.
 * Does not store outcomes, closing odds, live scores, or Vision events.
 */
export type PrematchDecisionTicket = {
  schemaVersion: typeof PREMATCH_DECISION_TICKET_SCHEMA_VERSION;
  ticketId: string;
  fixtureId: string;
  leagueId: string | null;
  season: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffUtc: string;
  capturedAtUtc: string;
  asOfUtc: string;
  vendorStatusShort: string;
  actionability: {
    actionable: true;
    reason: PrematchActionabilityReason;
  };
  sourceMode: PrematchTicketSourceMode;
  model: {
    version: string | null;
    expectedGoals: {
      home: number;
      away: number;
      total: number;
    } | null;
  };
  selections: PrematchTicketSelection[];
  scoring: PrematchTicketScoring | null;
  evidence: PrematchEvidenceAvailability;
  /**
   * Optional PE-3B+ input provenance. Absent on legacy tickets ⇒ interpret as
   * REGIME_LIFECYCLE_BASE_PRIOR_V1. Never backfill old rows.
   */
  inputProvenance?: PrematchInputProvenance | null;
};

export type PrematchPublishedSelection = {
  selectionId: string;
  selectionLabel: string;
  modelProbability: number;
};

export type PrematchPublishedMarket = {
  marketId: PrematchTicketMarketId;
  marketLine: number | null;
  selections: PrematchPublishedSelection[];
};

export type PrematchPublishedQuote = {
  marketId: PrematchTicketMarketId;
  marketLine?: number | null;
  selectionId: string;
  bookmaker: string | null;
  offeredOdds: number | null;
  impliedProbability: number | null;
  marketAsOfUtc?: string | null;
};

export type PrematchPublishedScoring = PrematchTicketScoring;

/**
 * Already-published prematch pipeline output. Ticket capture snapshots this
 * object. It must not be produced by calling the Probability Engine.
 */
export type PrematchPublishedSnapshot = {
  fixtureId: string;
  leagueId?: string | null;
  season?: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffUtc: string;
  vendorStatusShort?: string | null;
  asOfUtc?: string | null;
  sourceMode: PrematchTicketSourceMode;
  modelVersion?: string | null;
  expectedGoals?: {
    home: number;
    away: number;
    total: number;
  } | null;
  markets: PrematchPublishedMarket[];
  quotes?: PrematchPublishedQuote[];
  scoring?: PrematchPublishedScoring | null;
  evidence?: Partial<PrematchEvidenceAvailability> | null;
  /** Optional; frozen onto the ticket when present (PE-3B+). */
  inputProvenance?: PrematchInputProvenance | null;
};
