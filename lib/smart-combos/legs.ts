/**
 * Map Decision Engine opportunity rows onto combo legs.
 * Recovers model probability from published fair odds / EV — does not re-run PE.
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import { impliedProbability } from "@/lib/match-rating/pricing";
import type { ComboLeg } from "@/lib/smart-combos/types";

export function apexProbabilityFromOpportunity(
  row: ApexOpportunity,
): number | null {
  if (row.fairOdds != null && Number.isFinite(row.fairOdds) && row.fairOdds > 1) {
    return 1 / row.fairOdds;
  }
  if (
    row.expectedValue != null &&
    Number.isFinite(row.expectedValue) &&
    row.bookmakerOdds != null &&
    Number.isFinite(row.bookmakerOdds) &&
    row.bookmakerOdds > 1
  ) {
    const recovered = (row.expectedValue + 1) / row.bookmakerOdds;
    if (recovered > 0 && recovered < 1) return recovered;
  }
  return null;
}

export function opportunityToComboLeg(row: ApexOpportunity): ComboLeg {
  const apexProbability = apexProbabilityFromOpportunity(row);
  return {
    fixtureId: row.fixtureId,
    kickoffAt: row.kickoffAt,
    leagueName: row.leagueName,
    market: "1x2",
    home: row.home,
    away: row.away,
    predicted: row.predicted,
    selectionLabel: row.selectionLabel,
    decimalOdds: row.bookmakerOdds,
    apexProbability,
    impliedProbability: impliedProbability(row.bookmakerOdds),
    score: row.score,
    confidence: row.confidence,
    confidenceBand: row.confidenceBand,
    riskBand: row.riskBand,
    riskScore: row.riskScore,
    expectedValue: row.expectedValue,
    kellyPct: row.kellyPct,
    verdict: row.verdict,
    verdictLabel: row.verdictLabel,
    explanation: row.explanation,
  };
}

export function legsFromOpportunities(rows: ApexOpportunity[]): ComboLeg[] {
  return rows.map(opportunityToComboLeg);
}

export function pricedLegs(legs: ComboLeg[]): ComboLeg[] {
  return legs.filter(
    (leg) =>
      leg.apexProbability != null &&
      leg.apexProbability > 0 &&
      leg.apexProbability < 1 &&
      leg.decimalOdds != null &&
      leg.decimalOdds > 1,
  );
}

export function uniqueLeagues(rows: ApexOpportunity[]): string[] {
  return [...new Set(rows.map((row) => row.leagueName))].sort((a, b) =>
    a.localeCompare(b),
  );
}
