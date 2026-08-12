import type { DataProviderId } from "@/lib/data-platform/types/ids";

export type DataTrustBand = "low" | "medium" | "high";

export type DataTrustDimension =
  | "identity"
  | "schedule"
  | "score"
  | "lineups"
  | "events"
  | "odds"
  | "freshness";

export type DataTrustDimensionScore = {
  dimension: DataTrustDimension;
  score: number;
  weight: number;
  notes: string[];
};

/**
 * Aggregate trust score in [0, 1] for a normalized match bundle.
 */
export type DataTrustScore = {
  matchId: string;
  value: number;
  band: DataTrustBand;
  dimensions: DataTrustDimensionScore[];
  scoredAt: string;
  primaryProvider: DataProviderId;
};
