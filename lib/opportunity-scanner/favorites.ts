/**
 * Scanner favorite leagues and teams — local presentation preference.
 * Separate from the fixture watchlist (`apex:watchlist`).
 */

export const SCANNER_FAVORITES_KEY = "apex:scanner-favorites";

export type ScannerFavorites = {
  leagues: string[];
  teams: string[];
};

const EMPTY: ScannerFavorites = { leagues: [], teams: [] };

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function parseScannerFavorites(raw: string | null): ScannerFavorites {
  if (!raw?.trim()) return { ...EMPTY, leagues: [], teams: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { leagues: [], teams: [] };
    const record = parsed as Record<string, unknown>;
    const leagues = Array.isArray(record.leagues)
      ? unique(record.leagues.filter((item): item is string => typeof item === "string"))
      : [];
    const teams = Array.isArray(record.teams)
      ? unique(record.teams.filter((item): item is string => typeof item === "string"))
      : [];
    return { leagues, teams };
  } catch {
    return { leagues: [], teams: [] };
  }
}

export function serializeScannerFavorites(favorites: ScannerFavorites): string {
  return JSON.stringify({
    leagues: unique(favorites.leagues),
    teams: unique(favorites.teams),
  });
}

export function toggleFavoriteName(list: string[], name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return list;
  return list.includes(trimmed)
    ? list.filter((item) => item !== trimmed)
    : [...list, trimmed];
}
