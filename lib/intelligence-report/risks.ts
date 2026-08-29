/**
 * Risk cards. Each listed risk subtracts from PE confidence.
 * Derby, rotation and next-cup flags are omitted — API-Football does not publish them.
 */

import type { ReportFacts } from "@/lib/intelligence-report/facts";
import type { ApexReportRisk } from "@/lib/intelligence-report/types";
import type { ApexMatchRating } from "@/lib/match-rating/types";
import type { OutcomeProbability } from "@/lib/intelligence/types";

const RAIN = /\b(rain|lluvia|storm|tormenta|downpour|showers?|nieve|snow)\b/i;

export function buildReportRisks(input: {
  facts: ReportFacts;
  rating: ApexMatchRating;
  oneXTwo: OutcomeProbability;
}): ApexReportRisk[] {
  const { facts, rating, oneXTwo } = input;
  const risks: ApexReportRisk[] = [];

  const drawHeavy = oneXTwo.draw >= 0.28;
  const noFavourite =
    Math.max(oneXTwo.home, oneXTwo.away) < 0.48 && oneXTwo.draw >= 0.24;
  if (rating.risk === "high" || drawHeavy || noFavourite) {
    risks.push({
      id: "high_variance",
      title: "High variance",
      detail:
        rating.risk === "high"
          ? "Match Rating flags this fixture as high risk — the 1X2 mass is not concentrated."
          : `Draw probability is ${(oneXTwo.draw * 100).toFixed(0)}%; the favourite is not decisive.`,
      penalty: rating.risk === "high" ? 12 : 8,
    });
  }

  if (facts.weather && RAIN.test(facts.weather)) {
    risks.push({
      id: "weather",
      title: "Heavy rain",
      detail: `Published conditions: ${facts.weather}. Weather of this type raises outcome variance.`,
      penalty: 8,
    });
  }

  if (facts.pick.injuryCount >= 1) {
    const extra = Math.min(facts.pick.injuryCount - 1, 2) * 4;
    risks.push({
      id: "injuries",
      title: "Injuries",
      detail: `${facts.pickName} has ${facts.pick.injuryCount} published absence${facts.pick.injuryCount === 1 ? "" : "s"} — availability of the recommended side is reduced.`,
      penalty: 10 + extra,
    });
  }

  if (
    facts.predicted === "away" &&
    facts.away.awayWinPct != null &&
    facts.away.awayWinPct < 0.33
  ) {
    risks.push({
      id: "poor_away_form",
      title: "Poor away form",
      detail: `${facts.awayName} wins ${(facts.away.awayWinPct * 100).toFixed(0)}% of published away matches.`,
      penalty: 10,
    });
  }

  if (facts.pick.matchesLast7 >= 2) {
    risks.push({
      id: "schedule_congestion",
      title: "Schedule congestion",
      detail: `${facts.pickName} has ${facts.pick.matchesLast7} published matches in the seven days before kick-off.`,
      penalty: 8,
    });
  }

  return risks;
}

export function totalRiskPenalty(risks: ApexReportRisk[]): number {
  return risks.reduce((sum, risk) => sum + risk.penalty, 0);
}
