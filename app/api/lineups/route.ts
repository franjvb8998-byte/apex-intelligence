import { getLineups, withApiHandler } from "@/lib/bff";

/**
 * GET /api/lineups?fixture=
 */
export async function GET(request: Request) {
  return withApiHandler(request, async ({ searchParams }) => {
    const result = await getLineups(searchParams.get("fixture") ?? "");
    return { data: { lineups: result.lineups }, provider: result.provider };
  });
}
