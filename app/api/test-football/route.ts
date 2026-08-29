/**
 * GET /api/test-football
 * Debug catalogue via the DAL (today, then Premier League 2025 fallback).
 */
import { matchSummaryFromBundle } from "@/lib/dashboard/map";
import { createRepositories, hasFootballApiKey } from "@/lib/repositories";

export async function GET() {
  if (!hasFootballApiKey()) {
    return Response.json(
      { error: "API_FOOTBALL_KEY is not set" },
      { status: 500 },
    );
  }

  const repos = createRepositories();
  const bundles = await repos.fixtures.listCatalogue();
  return Response.json({
    provider: repos.providerId,
    count: bundles.length,
    items: bundles.map(matchSummaryFromBundle),
  });
}
