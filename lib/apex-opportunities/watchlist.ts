/**
 * Guest watchlist — fixture ids in localStorage. Client-only.
 */

export const WATCHLIST_STORAGE_KEY = "apex:watchlist";

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function parseWatchlist(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return uniqueIds(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return [];
  }
}

export function serializeWatchlist(ids: string[]): string {
  return JSON.stringify(uniqueIds(ids));
}

export function toggleWatchlistId(ids: string[], fixtureId: string): string[] {
  const id = fixtureId.trim();
  if (!id) return uniqueIds(ids);
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  return uniqueIds([...ids, id]);
}
