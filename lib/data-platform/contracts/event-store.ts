import type { ApexMatchEvent } from "@/lib/data-platform/types/event";
import type { ApexId } from "@/lib/data-platform/types/ids";

export type AppendEventsInput = {
  matchId: ApexId;
  events: ApexMatchEvent[];
};

export type ListEventsQuery = {
  matchId: ApexId;
  /** Inclusive lower bound on sequence when resuming a cursor. */
  afterSequence?: number;
  limit?: number;
};

/**
 * Append-only chronological store for match events.
 * Persistence backend is swappable (memory → Supabase/Postgres later).
 *
 * TODO(persistence): implement SupabaseEventStore without changing this port.
 */
export interface EventStore {
  append(input: AppendEventsInput): Promise<void>;
  list(query: ListEventsQuery): Promise<ApexMatchEvent[]>;
  /** Replace timeline for a match (re-ingestion / correction). */
  replaceTimeline(matchId: ApexId, events: ApexMatchEvent[]): Promise<void>;
  clear?(matchId: ApexId): Promise<void>;
}
