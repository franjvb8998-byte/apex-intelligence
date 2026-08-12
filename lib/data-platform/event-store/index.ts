import type {
  AppendEventsInput,
  EventStore,
  ListEventsQuery,
} from "@/lib/data-platform/contracts/event-store";
import type { ApexMatchEvent } from "@/lib/data-platform/types/event";
import type { ApexId } from "@/lib/data-platform/types/ids";

function sortChronologically(events: ApexMatchEvent[]): ApexMatchEvent[] {
  return [...events].sort((a, b) => {
    const byTime = a.occurredAt.localeCompare(b.occurredAt);
    if (byTime !== 0) return byTime;
    if (a.minute !== null && b.minute !== null && a.minute !== b.minute) {
      return a.minute - b.minute;
    }
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.id.localeCompare(b.id);
  });
}

/**
 * In-memory EventStore for local/dev.
 *
 * TODO(persistence): SupabaseEventStore implementing the same port
 * (table match_events, ordered by sequence / occurred_at).
 */
export class InMemoryEventStore implements EventStore {
  private readonly timelines = new Map<ApexId, ApexMatchEvent[]>();

  async append(input: AppendEventsInput): Promise<void> {
    const existing = this.timelines.get(input.matchId) ?? [];
    const maxSeq = existing.reduce((max, e) => Math.max(max, e.sequence), 0);

    const incoming = input.events.map((event, index) => ({
      ...event,
      matchId: input.matchId,
      sequence:
        event.sequence > 0 ? event.sequence : maxSeq + index + 1,
    }));

    const merged = sortChronologically([...existing, ...incoming]);
    this.timelines.set(input.matchId, merged);
  }

  async list(query: ListEventsQuery): Promise<ApexMatchEvent[]> {
    const all = this.timelines.get(query.matchId) ?? [];
    const after = query.afterSequence ?? 0;
    const filtered = all.filter((event) => event.sequence > after);
    return typeof query.limit === "number"
      ? filtered.slice(0, query.limit)
      : filtered;
  }

  async replaceTimeline(
    matchId: ApexId,
    events: ApexMatchEvent[],
  ): Promise<void> {
    const normalized = sortChronologically(
      events.map((event, index) => ({
        ...event,
        matchId,
        sequence: event.sequence > 0 ? event.sequence : index + 1,
      })),
    );
    this.timelines.set(matchId, normalized);
  }

  async clear(matchId: ApexId): Promise<void> {
    this.timelines.delete(matchId);
  }
}

export function createInMemoryEventStore(): EventStore {
  return new InMemoryEventStore();
}
