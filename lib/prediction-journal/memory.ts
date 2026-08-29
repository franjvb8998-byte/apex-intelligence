import type {
  PredictionId,
  PredictionJournalEntry,
  PredictionJournalFilter,
} from "@/lib/prediction-journal/types";

export class InMemoryPredictionJournalStore {
  private readonly rows = new Map<PredictionId, PredictionJournalEntry>();

  save(entry: PredictionJournalEntry): PredictionJournalEntry {
    this.rows.set(entry.id, entry);
    return entry;
  }

  get(id: PredictionId): PredictionJournalEntry | null {
    return this.rows.get(id) ?? null;
  }

  findPending(fixtureId: string, market: string): PredictionJournalEntry | null {
    for (const row of this.rows.values()) {
      if (
        row.fixtureId === fixtureId &&
        row.market === market &&
        row.status === "PENDING"
      ) {
        return row;
      }
    }
    return null;
  }

  list(filter: PredictionJournalFilter = {}): PredictionJournalEntry[] {
    let rows = [...this.rows.values()];
    if (filter.fixtureId) {
      rows = rows.filter((row) => row.fixtureId === filter.fixtureId);
    }
    if (filter.league) {
      rows = rows.filter((row) => row.league === filter.league);
    }
    if (filter.status) {
      rows = rows.filter((row) => row.status === filter.status);
    }
    if (filter.market) {
      rows = rows.filter((row) => row.market === filter.market);
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  clear(): void {
    this.rows.clear();
  }
}
