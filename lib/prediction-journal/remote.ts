import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PredictionJournalEntry } from "@/lib/prediction-journal/types";

type PredictionJournalRow = {
  id: string;
  fixture_id: string;
  league: string;
  season: string | null;
  home_team: string;
  away_team: string;
  market: string;
  recommendation: string;
  bookmaker_odds: number | null;
  model_probability: number | null;
  fair_odds: number | null;
  expected_value: number | null;
  confidence: number | null;
  risk: string;
  apex_score: number;
  decision: PredictionJournalEntry["decision"];
  model_version: string;
  created_at: string;
  synced_at: string | null;
  status: PredictionJournalEntry["status"];
};

function remoteClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function toJournalRow(entry: PredictionJournalEntry): PredictionJournalRow {
  return {
    id: entry.id,
    fixture_id: entry.fixtureId,
    league: entry.league,
    season: entry.season,
    home_team: entry.homeTeam,
    away_team: entry.awayTeam,
    market: entry.market,
    recommendation: entry.recommendation,
    bookmaker_odds: entry.bookmakerOdds,
    model_probability: entry.modelProbability,
    fair_odds: entry.fairOdds,
    expected_value: entry.expectedValue,
    confidence: entry.confidence,
    risk: entry.risk,
    apex_score: entry.apexScore,
    decision: entry.decision,
    model_version: entry.modelVersion,
    created_at: entry.createdAt,
    synced_at: entry.syncedAt,
    status: entry.status,
  };
}

export async function syncPredictionJournalEntry(
  entry: PredictionJournalEntry,
): Promise<string | null> {
  const client = remoteClient();
  if (!client) return null;
  const syncedAt = new Date().toISOString();
  const { error } = await client.from("prediction_journal").upsert(
    { ...toJournalRow(entry), synced_at: syncedAt },
    { onConflict: "id" },
  );
  if (error) return null;
  return syncedAt;
}
