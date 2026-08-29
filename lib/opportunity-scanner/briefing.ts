/**
 * Daily briefing + insight from the published scan. Presentation only.
 * Does not re-score, re-size, or call HTTP.
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

export type ScannerBriefingMatch = {
  fixtureId: string;
  label: string;
  leagueName: string;
  score: number;
};

export type ScannerBriefing = {
  fixturesAnalyzed: number;
  competitionsScanned: number;
  averageMarketQuality: number | null;
  averageConfidence: number | null;
  averageEv: number | null;
  highestRatedMatch: ScannerBriefingMatch | null;
  bestLeague: { name: string; averageScore: number } | null;
  bestMarket: string | null;
  generatedAt: string;
  quotaExhausted: boolean;
};

export type ScannerInsight = {
  catalogEmpty: boolean;
  quotaExhausted: boolean;
  strongestLeagueName: string | null;
  averageConfidence: number | null;
  hasMarket: boolean;
  interestingMatch: ScannerBriefingMatch | null;
};

function matchLabel(row: ApexOpportunity): string {
  return `${row.home.name} vs ${row.away.name}`;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function buildScannerBriefing(
  rows: ApexOpportunity[],
  generatedAt: string,
  quotaExhausted = false,
): ScannerBriefing {
  const leagues = [...new Set(rows.map((row) => row.leagueName))];
  const scores = rows.map((row) => row.score);
  const conf = rows.map((row) => row.confidence);
  const evs = rows
    .map((row) => row.expectedValue)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const highest = [...rows].sort((a, b) => b.score - a.score)[0] ?? null;

  let bestLeague: ScannerBriefing["bestLeague"] = null;
  for (const name of leagues) {
    const avg = mean(
      rows.filter((row) => row.leagueName === name).map((row) => row.score),
    );
    if (avg == null) continue;
    if (!bestLeague || avg > bestLeague.averageScore) {
      bestLeague = { name, averageScore: avg };
    }
  }

  const has1x2 = rows.some((row) => row.market === "1x2");

  return {
    fixturesAnalyzed: rows.length,
    competitionsScanned: leagues.length,
    averageMarketQuality: mean(scores),
    averageConfidence: mean(conf),
    averageEv: mean(evs),
    highestRatedMatch: highest
      ? {
          fixtureId: highest.fixtureId,
          label: matchLabel(highest),
          leagueName: highest.leagueName,
          score: highest.score,
        }
      : null,
    bestLeague,
    bestMarket: has1x2 ? "1x2" : null,
    generatedAt,
    quotaExhausted,
  };
}

export function buildScannerInsight(briefing: ScannerBriefing): ScannerInsight {
  return {
    catalogEmpty: briefing.fixturesAnalyzed === 0,
    quotaExhausted: briefing.quotaExhausted,
    strongestLeagueName: briefing.bestLeague?.name ?? null,
    averageConfidence: briefing.averageConfidence,
    hasMarket: briefing.bestMarket != null,
    interestingMatch: briefing.highestRatedMatch,
  };
}
