/**
 * GET /api/test-football
 * Free-plan compatible: today's fixtures, then Premier League 2025 fallback.
 */
export async function GET() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "API_FOOTBALL_KEY is not set" },
      { status: 500 },
    );
  }

  const headers = { "x-apisports-key": apiKey };
  const today = new Date().toISOString().slice(0, 10);

  const todayResponse = await fetch(
    `https://v3.football.api-sports.io/fixtures?date=${today}`,
    { headers, cache: "no-store" },
  );
  const todayPayload: unknown = await todayResponse.json();

  if (hasFixtures(todayPayload)) {
    return Response.json(todayPayload, { status: todayResponse.status });
  }

  const leagueResponse = await fetch(
    "https://v3.football.api-sports.io/fixtures?league=39&season=2025",
    { headers, cache: "no-store" },
  );
  const leaguePayload: unknown = await leagueResponse.json();
  return Response.json(leaguePayload, { status: leagueResponse.status });
}

function hasFixtures(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const record = payload as { results?: unknown; response?: unknown };
  if (typeof record.results === "number") return record.results > 0;
  return Array.isArray(record.response) && record.response.length > 0;
}
