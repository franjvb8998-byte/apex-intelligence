import { NextResponse } from "next/server";
import { authorizePrematchLifecycleRequest } from "@/lib/prematch-lifecycle/auth";
import { runPrematchLifecycle } from "@/lib/prematch-lifecycle/coordinator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: { code: "unauthorized", message: "Unauthorized" } },
    { status: 401 },
  );
}

/**
 * POST /api/internal/prematch-lifecycle
 * Server-only coordinator. Bearer cron secret required.
 * User session is not authorization. No scheduler is configured here.
 */
export async function POST(request: Request) {
  const auth = authorizePrematchLifecycleRequest(request);
  if (!auth.ok) return unauthorized();
  const report = await runPrematchLifecycle();
  return NextResponse.json({ ok: true, data: report });
}
