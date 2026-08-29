/**
 * APEX Prediction Journal — persisted Decision Engine recommendations.
 * ROI and match results are out of scope for this MVP.
 */

import type { ApexDecision, ApexRiskBand } from "@/lib/decision-engine/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";

export type PredictionId = string;

export type PredictionJournalStatus = "PENDING" | "SETTLED" | "VOID";

export type PredictionJournalMarket = "1x2";

export type PredictionJournalEntry = {
  id: PredictionId;
  fixtureId: string;
  league: string;
  season: string | null;
  homeTeam: string;
  awayTeam: string;
  market: PredictionJournalMarket;
  recommendation: ScoringTier;
  bookmakerOdds: number | null;
  modelProbability: number | null;
  fairOdds: number | null;
  expectedValue: number | null;
  confidence: number | null;
  risk: ApexRiskBand;
  apexScore: number;
  decision: ApexDecision;
  modelVersion: string;
  createdAt: string;
  syncedAt: string | null;
  status: PredictionJournalStatus;
};

export type PredictionJournalWrite = Omit<
  PredictionJournalEntry,
  "id" | "createdAt" | "syncedAt" | "status"
> & {
  id?: PredictionId;
  createdAt?: string;
  syncedAt?: string | null;
  status?: PredictionJournalStatus;
};

export type PredictionJournalPatch = Partial<
  Omit<PredictionJournalEntry, "id" | "createdAt">
>;

export type PredictionJournalFilter = {
  fixtureId?: string;
  league?: string;
  status?: PredictionJournalStatus;
  market?: PredictionJournalMarket;
};
