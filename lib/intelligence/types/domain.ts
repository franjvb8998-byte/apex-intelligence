/**
 * Shared domain types for the APEX Intelligence Core.
 * Aligned with supabase/schema.sql — no algorithm logic here.
 */

export type UUID = string;

export type MatchOutcome = "home" | "draw" | "away";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "cancelled"
  | "postponed";

export type League = {
  id: UUID;
  name: string;
  country: string | null;
  sport: string;
  season: string | null;
};

export type Team = {
  id: UUID;
  leagueId: UUID;
  name: string;
  shortName: string | null;
};

export type Match = {
  id: UUID;
  leagueId: UUID;
  homeTeamId: UUID;
  awayTeamId: UUID;
  kickoffAt: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
};

export type MatchContext = {
  match: Match;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
};

/** Normalized probability triple for 1X2 markets. Must sum to ~1. */
export type OutcomeProbability = {
  home: number;
  draw: number;
  away: number;
};

export type ConfidenceScore = {
  /** Calibrated confidence in [0, 1]. */
  value: number;
  /** Optional qualitative band for UI/explainability. */
  band: "low" | "medium" | "high";
};

export type SystemPrediction = {
  id?: UUID;
  matchId: UUID;
  predictedOutcome: MatchOutcome;
  probabilities: OutcomeProbability;
  confidence: ConfidenceScore;
  modelVersion: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UserPrediction = {
  id: UUID;
  userId: UUID;
  matchId: UUID;
  predictionId: UUID | null;
  predictedOutcome: MatchOutcome;
  stake: number | null;
  notes: string | null;
};
