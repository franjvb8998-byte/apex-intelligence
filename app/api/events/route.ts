import { getEvents, withApiHandler } from "@/lib/bff";

/**
 * GET /api/events?fixture=
 */
export async function GET(request: Request) {
  return withApiHandler(request, async ({ searchParams }) => {
    const result = await getEvents(searchParams.get("fixture") ?? "");
    return { data: { events: result.events }, provider: result.provider };
  });
}
