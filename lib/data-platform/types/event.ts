import type { ApexId, DataProviderId } from "@/lib/data-platform/types/ids";

/**
 * Chronological match timeline events (canonical).
 * Provider-specific event names are mapped during normalization.
 */
export type ApexEventType =
  | "kickoff"
  | "goal"
  | "own_goal"
  | "penalty_goal"
  | "penalty_miss"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "var"
  | "period_start"
  | "period_end"
  | "full_time"
  | "other";

export type ApexMatchEvent = {
  id: ApexId;
  matchId: ApexId;
  /** Minute on the match clock when known. */
  minute: number | null;
  /** Absolute time for ordering when minute is missing/ambiguous. */
  occurredAt: string;
  type: ApexEventType;
  teamId: ApexId | null;
  playerId: ApexId | null;
  assistPlayerId: ApexId | null;
  /** Free-form structured payload (score after goal, card reason, etc.). */
  payload: Record<string, unknown>;
  sourceProvider: DataProviderId;
  sourceEventId: string | null;
  sequence: number;
};
