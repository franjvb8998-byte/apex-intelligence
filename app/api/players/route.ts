import { getPlayer, withApiHandler } from "@/lib/bff";

/**
 * GET /api/players?id=&season=
 */
export async function GET(request: Request) {
  return withApiHandler(request, async ({ searchParams }) => {
    const result = await getPlayer({
      id: searchParams.get("id"),
      season: searchParams.get("season"),
    });
    return { data: { player: result.player }, provider: result.provider };
  });
}
