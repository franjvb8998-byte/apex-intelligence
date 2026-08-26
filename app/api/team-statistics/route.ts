import { getTeamStatistics, withApiHandler } from "@/lib/bff";

/**
 * GET /api/team-statistics?team=&league=&season=
 */
export async function GET(request: Request) {
  return withApiHandler(request, async ({ searchParams }) => {
    const result = await getTeamStatistics({
      team: searchParams.get("team"),
      league: searchParams.get("league"),
      season: searchParams.get("season"),
    });
    return {
      data: { statistics: result.statistics },
      provider: result.provider,
    };
  });
}
