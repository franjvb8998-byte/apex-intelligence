import { badRequest, withApiHandler } from "@/lib/bff";
import { parseTrackedFixtureId } from "@/lib/apex-vision/live/parse-id";
import { getVisionLiveCoordinator } from "@/lib/apex-vision/live/coordinator";

type RouteContext = {
  params: Promise<{ fixtureId: string }>;
};

/**
 * GET /api/match-center/live/:fixtureId
 * APEX Vision live state for one fixture. Not an API-Football proxy.
 */
export async function GET(request: Request, context: RouteContext) {
  return withApiHandler(
    request,
    async () => {
      const { fixtureId: raw } = await context.params;
      const fixtureId = parseTrackedFixtureId(decodeURIComponent(raw));
      if (fixtureId == null) {
        throw badRequest("Invalid fixture id", { fixtureId: raw });
      }
      const view = await getVisionLiveCoordinator().refreshFixture(fixtureId);
      return {
        data: view,
        provider: "apex-vision-live",
      };
    },
    { provider: "apex-vision-live" },
  );
}
