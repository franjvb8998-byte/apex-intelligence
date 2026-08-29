/**
 * League → country when the catalogue did not publish a country.
 * Used for scanner filters only — never invents odds or scores.
 */

const LEAGUE_COUNTRY: Record<string, string> = {
  "Premier League": "England",
  Championship: "England",
  "League One": "England",
  "FA Cup": "England",
  "La Liga": "Spain",
  "Copa del Rey": "Spain",
  Bundesliga: "Germany",
  "2. Bundesliga": "Germany",
  "Serie A": "Italy",
  "Serie B": "Italy",
  "Ligue 1": "France",
  "Ligue 2": "France",
  Eredivisie: "Netherlands",
  "Primeira Liga": "Portugal",
  "Belgian Pro League": "Belgium",
  "Scottish Premiership": "Scotland",
  "Super Lig": "Turkey",
  "Süper Lig": "Turkey",
  "MLS": "USA",
  "Liga MX": "Mexico",
  "Brasileirão": "Brazil",
  "Serie A Brazil": "Brazil",
  "Argentine Primera": "Argentina",
  "UEFA Champions League": "Europe",
  "UEFA Europa League": "Europe",
  "UEFA Conference League": "Europe",
  "World Cup": "International",
  "Euro Championship": "International",
};

export function countryFromLeague(
  leagueName: string,
  published?: string | null,
): string | null {
  const fromVendor = published?.trim();
  if (fromVendor) return fromVendor;
  return LEAGUE_COUNTRY[leagueName] ?? null;
}

export function countryOptions(
  rows: Array<{ country: string | null }>,
): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row.country)
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}
