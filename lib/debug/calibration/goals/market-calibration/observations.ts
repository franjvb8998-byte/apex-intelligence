/**
 * GOALS-1G.1 — Canonical market observations from frozen G1 predictions.
 */

import type { GoalsG1Prediction } from "@/lib/debug/calibration/goals/g1/predict";
import {
  GOALS_MCAL_CANONICAL_MARKETS,
  type GoalsMcalCanonicalMarket,
} from "@/lib/debug/calibration/goals/market-calibration/protocol";

export type GoalsMcalObservation = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  market: GoalsMcalCanonicalMarket;
  family: "MATCH_TOTAL" | "BTTS" | "HOME_TOTAL" | "AWAY_TOTAL";
  threshold: number | null;
  side: "OVER" | "YES";
  rawProbability: number;
  complementProbability: number;
  actualBinaryOutcome: 0 | 1;
  muHome: number;
  muAway: number;
  muTotal: number;
  evidenceSupportBucket: string;
  regulationLabelSource: string;
};

type Extractor = {
  market: GoalsMcalCanonicalMarket;
  family: GoalsMcalObservation["family"];
  threshold: number | null;
  side: "OVER" | "YES";
  p: (m: NonNullable<GoalsG1Prediction["markets"]>) => number;
  y: (h: number, a: number) => 0 | 1;
};

const EXTRACTORS: Extractor[] = [
  {
    market: "MATCH_TOTAL_OVER_0_5",
    family: "MATCH_TOTAL",
    threshold: 0.5,
    side: "OVER",
    p: (m) => m.matchTotals.over05,
    y: (h, a) => (h + a >= 1 ? 1 : 0),
  },
  {
    market: "MATCH_TOTAL_OVER_1_5",
    family: "MATCH_TOTAL",
    threshold: 1.5,
    side: "OVER",
    p: (m) => m.matchTotals.over15,
    y: (h, a) => (h + a >= 2 ? 1 : 0),
  },
  {
    market: "MATCH_TOTAL_OVER_2_5",
    family: "MATCH_TOTAL",
    threshold: 2.5,
    side: "OVER",
    p: (m) => m.matchTotals.over25,
    y: (h, a) => (h + a >= 3 ? 1 : 0),
  },
  {
    market: "MATCH_TOTAL_OVER_3_5",
    family: "MATCH_TOTAL",
    threshold: 3.5,
    side: "OVER",
    p: (m) => m.matchTotals.over35,
    y: (h, a) => (h + a >= 4 ? 1 : 0),
  },
  {
    market: "MATCH_TOTAL_OVER_4_5",
    family: "MATCH_TOTAL",
    threshold: 4.5,
    side: "OVER",
    p: (m) => m.matchTotals.over45,
    y: (h, a) => (h + a >= 5 ? 1 : 0),
  },
  {
    market: "BTTS_YES",
    family: "BTTS",
    threshold: null,
    side: "YES",
    p: (m) => m.btts.yes,
    y: (h, a) => (h >= 1 && a >= 1 ? 1 : 0),
  },
  {
    market: "HOME_TOTAL_OVER_0_5",
    family: "HOME_TOTAL",
    threshold: 0.5,
    side: "OVER",
    p: (m) => m.homeTeamTotals.over05,
    y: (h) => (h >= 1 ? 1 : 0),
  },
  {
    market: "HOME_TOTAL_OVER_1_5",
    family: "HOME_TOTAL",
    threshold: 1.5,
    side: "OVER",
    p: (m) => m.homeTeamTotals.over15,
    y: (h) => (h >= 2 ? 1 : 0),
  },
  {
    market: "HOME_TOTAL_OVER_2_5",
    family: "HOME_TOTAL",
    threshold: 2.5,
    side: "OVER",
    p: (m) => m.homeTeamTotals.over25,
    y: (h) => (h >= 3 ? 1 : 0),
  },
  {
    market: "AWAY_TOTAL_OVER_0_5",
    family: "AWAY_TOTAL",
    threshold: 0.5,
    side: "OVER",
    p: (m) => m.awayTeamTotals.over05,
    y: (_h, a) => (a >= 1 ? 1 : 0),
  },
  {
    market: "AWAY_TOTAL_OVER_1_5",
    family: "AWAY_TOTAL",
    threshold: 1.5,
    side: "OVER",
    p: (m) => m.awayTeamTotals.over15,
    y: (_h, a) => (a >= 2 ? 1 : 0),
  },
  {
    market: "AWAY_TOTAL_OVER_2_5",
    family: "AWAY_TOTAL",
    threshold: 2.5,
    side: "OVER",
    p: (m) => m.awayTeamTotals.over25,
    y: (_h, a) => (a >= 3 ? 1 : 0),
  },
];

export function assertG1MarketCoherence(pred: GoalsG1Prediction): void {
  if (pred.predictionStatus !== "AVAILABLE" || !pred.markets) return;
  const m = pred.markets;
  const eps = 1e-9;
  const pairs: [number, number][] = [
    [m.matchTotals.over05, m.matchTotals.under05],
    [m.matchTotals.over15, m.matchTotals.under15],
    [m.matchTotals.over25, m.matchTotals.under25],
    [m.matchTotals.over35, m.matchTotals.under35],
    [m.matchTotals.over45, m.matchTotals.under45],
    [m.btts.yes, m.btts.no],
    [m.homeTeamTotals.over05, m.homeTeamTotals.under05],
    [m.homeTeamTotals.over15, m.homeTeamTotals.under15],
    [m.homeTeamTotals.over25, m.homeTeamTotals.under25],
    [m.awayTeamTotals.over05, m.awayTeamTotals.under05],
    [m.awayTeamTotals.over15, m.awayTeamTotals.under15],
    [m.awayTeamTotals.over25, m.awayTeamTotals.under25],
  ];
  for (const [a, b] of pairs) {
    if (Math.abs(a + b - 1) > eps) {
      throw new Error(`Complement failed for ${pred.fixtureId}`);
    }
  }
  const matchOvers = [
    m.matchTotals.over05,
    m.matchTotals.over15,
    m.matchTotals.over25,
    m.matchTotals.over35,
    m.matchTotals.over45,
  ];
  for (let i = 0; i < matchOvers.length - 1; i += 1) {
    if (matchOvers[i]! + eps < matchOvers[i + 1]!) {
      throw new Error(`Match-total monotonicity failed ${pred.fixtureId}`);
    }
  }
  const homeOvers = [
    m.homeTeamTotals.over05,
    m.homeTeamTotals.over15,
    m.homeTeamTotals.over25,
  ];
  for (let i = 0; i < homeOvers.length - 1; i += 1) {
    if (homeOvers[i]! + eps < homeOvers[i + 1]!) {
      throw new Error(`Home-total monotonicity failed ${pred.fixtureId}`);
    }
  }
  const awayOvers = [
    m.awayTeamTotals.over05,
    m.awayTeamTotals.over15,
    m.awayTeamTotals.over25,
  ];
  for (let i = 0; i < awayOvers.length - 1; i += 1) {
    if (awayOvers[i]! + eps < awayOvers[i + 1]!) {
      throw new Error(`Away-total monotonicity failed ${pred.fixtureId}`);
    }
  }
}

export function buildCanonicalObservations(
  predictions: readonly GoalsG1Prediction[],
  competitionId = "39",
): GoalsMcalObservation[] {
  const out: GoalsMcalObservation[] = [];
  const seen = new Set<string>();

  const sorted = [...predictions].sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );

  for (const pred of sorted) {
    if (pred.predictionStatus !== "AVAILABLE" || !pred.markets) continue;
    if (pred.labelHomeGoals90 == null || pred.labelAwayGoals90 == null) continue;
    if (pred.muHome == null || pred.muAway == null) continue;
    assertG1MarketCoherence(pred);

    const h = pred.labelHomeGoals90;
    const a = pred.labelAwayGoals90;
    for (const ex of EXTRACTORS) {
      const key = `${pred.fixtureId}|${ex.market}`;
      if (seen.has(key)) {
        throw new Error(`Duplicate observation ${key}`);
      }
      seen.add(key);
      const raw = ex.p(pred.markets);
      out.push({
        fixtureId: pred.fixtureId,
        competitionId,
        season: pred.season,
        kickoffUtc: pred.kickoffUtc,
        market: ex.market,
        family: ex.family,
        threshold: ex.threshold,
        side: ex.side,
        rawProbability: raw,
        complementProbability: 1 - raw,
        actualBinaryOutcome: ex.y(h, a),
        muHome: pred.muHome,
        muAway: pred.muAway,
        muTotal: pred.muHome + pred.muAway,
        evidenceSupportBucket: pred.evidenceSupportBucket,
        regulationLabelSource: pred.regulationLabelSource,
      });
    }
  }

  // Deterministic order: kickoff, fixture, market index
  const marketOrder = new Map(
    GOALS_MCAL_CANONICAL_MARKETS.map((m, i) => [m, i]),
  );
  out.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId) ||
      (marketOrder.get(a.market)! - marketOrder.get(b.market)!),
  );
  return out;
}

/** Under 0.5 observation derived from MATCH_TOTAL_OVER_0_5 complement. */
export function deriveUnder05(
  over05: GoalsMcalObservation,
): {
  rawProbability: number;
  actualBinaryOutcome: 0 | 1;
  isZeroZero: boolean;
} {
  if (over05.market !== "MATCH_TOTAL_OVER_0_5") {
    throw new Error("deriveUnder05 expects MATCH_TOTAL_OVER_0_5");
  }
  return {
    rawProbability: over05.complementProbability,
    actualBinaryOutcome: (1 - over05.actualBinaryOutcome) as 0 | 1,
    isZeroZero: over05.actualBinaryOutcome === 0,
  };
}
