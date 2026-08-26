import { getLeague, withApiHandler } from "@/lib/bff";

/**
 * GET /api/leagues?id=
 */
export async function GET(request: Request) {
  return withApiHandler(request, async ({ searchParams }) => {
    const result = await getLeague(searchParams.get("id") ?? "");
    return { data: { league: result.league }, provider: result.provider };
  });
}
