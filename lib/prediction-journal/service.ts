import { InMemoryPredictionJournalStore } from "@/lib/prediction-journal/memory";
import { predictionIdFromParts } from "@/lib/prediction-journal/ids";
import { syncPredictionJournalEntry } from "@/lib/prediction-journal/remote";
import type {
  PredictionId,
  PredictionJournalEntry,
  PredictionJournalFilter,
  PredictionJournalPatch,
  PredictionJournalWrite,
} from "@/lib/prediction-journal/types";

export class PredictionJournalService {
  constructor(private readonly store = new InMemoryPredictionJournalStore()) {}

  savePrediction(input: PredictionJournalWrite): PredictionJournalEntry {
    const requestedId =
      input.id ??
      predictionIdFromParts({
        fixtureId: input.fixtureId,
        market: input.market,
        selectionLabel: input.decision.selectionLabel,
      });
    const existing =
      this.store.get(requestedId) ??
      this.store.findPending(input.fixtureId, input.market);
    const id = existing?.id ?? requestedId;
    const now = new Date().toISOString();
    const entry: PredictionJournalEntry = {
      id,
      fixtureId: input.fixtureId,
      league: input.league,
      season: input.season ?? existing?.season ?? null,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      market: input.market,
      recommendation: input.recommendation,
      bookmakerOdds: input.bookmakerOdds,
      modelProbability: input.modelProbability,
      fairOdds: input.fairOdds,
      expectedValue: input.expectedValue,
      confidence: input.confidence,
      risk: input.risk,
      apexScore: input.apexScore,
      decision: input.decision,
      modelVersion: input.modelVersion,
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      syncedAt: input.syncedAt ?? existing?.syncedAt ?? null,
      status: input.status ?? existing?.status ?? "PENDING",
    };
    this.store.save(entry);
    void this.sync(entry);
    return entry;
  }

  getPrediction(id: PredictionId): PredictionJournalEntry | null {
    return this.store.get(id);
  }

  listPredictions(
    filter: PredictionJournalFilter = {},
  ): PredictionJournalEntry[] {
    return this.store.list(filter);
  }

  updatePrediction(
    id: PredictionId,
    patch: PredictionJournalPatch,
  ): PredictionJournalEntry | null {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: PredictionJournalEntry = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    this.store.save(updated);
    void this.sync(updated);
    return updated;
  }

  private async sync(entry: PredictionJournalEntry): Promise<void> {
    try {
      const syncedAt = await syncPredictionJournalEntry(entry);
      if (!syncedAt) return;
      const current = this.store.get(entry.id);
      if (!current) return;
      this.store.save({ ...current, syncedAt });
    } catch {
      // Remote sync is best-effort. In-memory journal stays the source of truth.
    }
  }
}

let journal: PredictionJournalService | null = null;

export function getPredictionJournalService(): PredictionJournalService {
  if (!journal) {
    journal = new PredictionJournalService();
  }
  return journal;
}

/** Test isolation only. */
export function resetPredictionJournalService(): PredictionJournalService {
  journal = new PredictionJournalService();
  return journal;
}
