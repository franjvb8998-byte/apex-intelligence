import { matchAnalysisHref } from "@/lib/match-center/fixture-id";

export function opportunityAnalysisHref(fixtureId: string): string {
  return matchAnalysisHref(fixtureId);
}

export function opportunityBankrollHref(fixtureId: string): string {
  return `/bankroll?fixture=${encodeURIComponent(fixtureId)}`;
}

export function opportunityCopilotHref(
  homeName: string,
  awayName: string,
  fixtureId?: string,
): string {
  const params = new URLSearchParams({
    prompt: `Analiza ${homeName} vs ${awayName}`,
  });
  if (fixtureId?.trim()) {
    params.set("fixture", fixtureId.trim());
  }
  return `/copilot?${params.toString()}`;
}
