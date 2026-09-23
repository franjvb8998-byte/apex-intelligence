/**
 * Map APEX competition ids to API-Football vendor league ids.
 *
 * Repository convention (bff/normalize, lifecycle tests):
 *   apex:api-football:league:{numericVendorId}
 *
 * Fail closed on anything else — never strip arbitrary suffixes.
 */

const APEX_API_FOOTBALL_LEAGUE =
  /^apex:api-football:league:(\d+)$/;

/**
 * Extract vendor league id for GET /fixtures?league=.
 * Returns null when the competition id is not a trusted APEX API-Football league id.
 */
export function vendorLeagueIdFromCompetitionId(
  competitionId: string,
): string | null {
  if (typeof competitionId !== "string") return null;
  const trimmed = competitionId.trim();
  if (!trimmed) return null;
  const match = APEX_API_FOOTBALL_LEAGUE.exec(trimmed);
  return match?.[1] ?? null;
}
