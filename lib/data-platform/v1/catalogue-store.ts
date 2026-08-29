/**
 * Internal catalogue — Apex* snapshots after normalization.
 * UI and product services read this. They never see vendor JSON.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";
import type { ApexId } from "@/lib/data-platform/types/ids";

export type CatalogueStandingRow = {
  leagueId: ApexId;
  season: string;
  teamId: ApexId;
  rank: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  updatedAt: string;
};

export type CatalogueListQuery = {
  /** UTC calendar date YYYY-MM-DD. */
  date?: string;
  leagueId?: ApexId;
  status?: ApexMatchBundle["match"]["status"];
  limit?: number;
};

export interface CatalogueStore {
  upsertBundle(bundle: ApexMatchBundle): Promise<void>;
  getBundle(matchId: ApexId): Promise<ApexMatchBundle | null>;
  listBundles(query?: CatalogueListQuery): Promise<ApexMatchBundle[]>;
  listOdds(matchId: ApexId): Promise<ApexOddsQuote[]>;
  upsertStandings(rows: CatalogueStandingRow[]): Promise<void>;
  listStandings(leagueId: ApexId, season: string): Promise<CatalogueStandingRow[]>;
}

function dateKey(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Process-local catalogue. Swap for Postgres without changing Collector or services.
 */
export class InMemoryCatalogueStore implements CatalogueStore {
  private readonly bundles = new Map<ApexId, ApexMatchBundle>();
  private readonly standings: CatalogueStandingRow[] = [];

  async upsertBundle(bundle: ApexMatchBundle): Promise<void> {
    this.bundles.set(bundle.match.id, bundle);
  }

  async getBundle(matchId: ApexId): Promise<ApexMatchBundle | null> {
    return this.bundles.get(matchId) ?? null;
  }

  async listBundles(query: CatalogueListQuery = {}): Promise<ApexMatchBundle[]> {
    let rows = [...this.bundles.values()];
    if (query.date) {
      rows = rows.filter((row) => dateKey(row.match.kickoffAt) === query.date);
    }
    if (query.leagueId) {
      rows = rows.filter(
        (row) =>
          row.match.leagueId === query.leagueId ||
          row.league?.id === query.leagueId,
      );
    }
    if (query.status) {
      rows = rows.filter((row) => row.match.status === query.status);
    }
    rows.sort((a, b) => a.match.kickoffAt.localeCompare(b.match.kickoffAt));
    if (query.limit != null) rows = rows.slice(0, query.limit);
    return rows;
  }

  async listOdds(matchId: ApexId): Promise<ApexOddsQuote[]> {
    return (this.bundles.get(matchId)?.odds ?? []).slice();
  }

  async upsertStandings(rows: CatalogueStandingRow[]): Promise<void> {
    for (const row of rows) {
      const index = this.standings.findIndex(
        (existing) =>
          existing.leagueId === row.leagueId &&
          existing.season === row.season &&
          existing.teamId === row.teamId,
      );
      if (index >= 0) this.standings[index] = row;
      else this.standings.push(row);
    }
  }

  async listStandings(
    leagueId: ApexId,
    season: string,
  ): Promise<CatalogueStandingRow[]> {
    return this.standings
      .filter((row) => row.leagueId === leagueId && row.season === season)
      .sort((a, b) => a.rank - b.rank);
  }
}

export function createInMemoryCatalogueStore(): CatalogueStore {
  return new InMemoryCatalogueStore();
}
