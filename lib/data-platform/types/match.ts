import type { ApexId, ExternalRef } from "@/lib/data-platform/types/ids";

/**
 * Canonical match lifecycle — independent of any vendor vocabulary.
 */
export type ApexMatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "cancelled"
  | "postponed"
  | "suspended"
  | "unknown";

export type ApexScore = {
  home: number | null;
  away: number | null;
  /** Half-time / period scores when available. */
  periods?: {
    ht?: { home: number | null; away: number | null };
    ft?: { home: number | null; away: number | null };
  };
};

export type ApexVenue = {
  name: string | null;
  city: string | null;
  country: string | null;
};

export type ApexMatch = {
  id: ApexId;
  leagueId: ApexId | null;
  homeTeamId: ApexId;
  awayTeamId: ApexId;
  kickoffAt: string;
  status: ApexMatchStatus;
  score: ApexScore;
  venue: ApexVenue | null;
  referee?: string | null;
  attendance?: number | null;
  weather?: string | null;
  minute: number | null;
  externalRefs: ExternalRef[];
  /** ISO timestamps for lineage. */
  ingestedAt: string;
  updatedAt: string;
};
