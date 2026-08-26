import { getTeam, withApiHandler } from "@/lib/bff";

/**
 * GET /api/teams?id=
 */
export async function GET(request: Request) {
  return withApiHandler(request, async ({ searchParams }) => {
    const result = await getTeam(searchParams.get("id") ?? "");
    return { data: { team: result.team }, provider: result.provider };
  });
}
