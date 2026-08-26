import { getStandings, withApiHandler } from "@/lib/bff";

/**
 * GET /api/standings?league=&season=
 */
export async function GET(request: Request) {
  return withApiHandler(request, async ({ searchParams }) => {
    const result = await getStandings({
      league: searchParams.get("league"),
      season: searchParams.get("season"),
    });
    return { data: { standings: result.standings }, provider: result.provider };
  });
}
