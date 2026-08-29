import { badRequest, withApiHandler } from "@/lib/bff";
import { createCopilotService } from "@/lib/copilot";

/**
 * POST /api/copilot
 * Body: { prompt: string }
 */
export async function POST(request: Request) {
  return withApiHandler(request, async () => {
    const body = (await request.json().catch(() => null)) as
      | { prompt?: unknown }
      | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      throw badRequest("El prompt es obligatorio.");
    }
    const service = createCopilotService();
    const reply = await service.ask({ prompt });
    return { data: reply, provider: reply.providerId };
  });
}
