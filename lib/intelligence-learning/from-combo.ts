import { INTELLIGENCE_LEARNING_VERSION } from "@/lib/intelligence-learning/types";
import type { RecommendationDraft } from "@/lib/intelligence-learning/types";
import type { ApexScoring, ScoringComponentKey, ScoringTier } from "@/lib/scoring-engine/types";
import type { ComboAnalysis } from "@/lib/smart-combos/types";

const TIERS: ScoringTier[] = [
  "Elite",
  "Strong Bet",
  "Value Bet",
  "Watch",
  "Avoid",
];

function pillar(scoring: ApexScoring | undefined, key: ScoringComponentKey): number | null {
  const row = scoring?.components.find((item) => item.key === key);
  return row?.available ? (row.score ?? null) : null;
}

function tierFromLabel(label: string): ScoringTier {
  return TIERS.includes(label as ScoringTier) ? (label as ScoringTier) : "Avoid";
}

export function recommendationDraftFromCombo(
  analysis: ComboAnalysis,
  scoring?: ApexScoring,
  timestamp = new Date().toISOString(),
): RecommendationDraft {
  const fixtureId =
    [...analysis.legs.map((leg) => leg.fixtureId)].sort().join("+") || "combo";
  const leagues = [...new Set(analysis.legs.map((leg) => leg.leagueName))];
  return {
    timestamp,
    source: "smart-combo",
    fixtureId,
    competition: leagues.join(" + ") || "Combo",
    teams: {
      home: analysis.legs.map((leg) => leg.home.shortName).join("/"),
      away: analysis.legs.map((leg) => leg.away.shortName).join("/"),
    },
    market: "combo",
    selectionLabel: analysis.legs.map((leg) => leg.selectionLabel).join(" + ") || "Smart Combo",
    predicted: "combo",
    odds: analysis.combinedOdds,
    recommendation: scoring?.recommendation.tier ?? tierFromLabel(analysis.verdict.label),
    apexScore: scoring?.overall ?? analysis.healthScore,
    confidence: analysis.confidence,
    risk: analysis.riskScore,
    expectedValue: analysis.expectedValue,
    kellyStake: analysis.sizing.kellyPct,
    stakePct: analysis.sizing.stakePct,
    teamIntelligence: pillar(scoring, "teamIntelligence"),
    momentum: pillar(scoring, "momentum"),
    tacticalScore: pillar(scoring, "tactical"),
    marketScore: pillar(scoring, "marketValue"),
    dataQuality: pillar(scoring, "dataQuality") ?? (analysis.legs.length === 0 ? 0 : 100),
    reasoning: {
      summary: analysis.explanation,
      supporting: analysis.legs.map((leg) => ({
        key: leg.fixtureId,
        title: leg.selectionLabel,
        detail: `${leg.verdictLabel} · model ${leg.apexProbability ?? "n/d"} · ${leg.explanation}`,
      })),
      against: analysis.correlation.pairs.map((pair) => ({
        key: pair.kind,
        title: pair.kind,
        detail: pair.detail,
      })),
      reasonsFor: [],
      reasonsAgainst: analysis.blockedReason
        ? [
            {
              id: "blocked",
              title: "Blocked combo",
              detail: analysis.blockedReason,
            },
          ]
        : [],
    },
    engineVersion: {
      learning: INTELLIGENCE_LEARNING_VERSION,
      scoring: "scoring-v2",
      decision: "deterministic-v1",
    },
  };
}
