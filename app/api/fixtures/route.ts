import {
  getFixtures,
  withApiHandler,
} from "@/lib/bff";

/**
 * GET /api/fixtures
 * Query: id? | date? | leagueId? | limit?
 */
export async function GET(request: Request) {
  return withApiHandler(request, async ({ searchParams }) => {
    const limitRaw = searchParams.get("limit");
    const limit =
      limitRaw && Number.isFinite(Number(limitRaw))
        ? Number(limitRaw)
        : null;

    const result = await getFixtures({
      id: searchParams.get("id"),
      date: searchParams.get("date"),
      leagueId: searchParams.get("leagueId"),
      limit,
    });

    return { data: { fixtures: result.items }, provider: result.provider };
  });
}
