/**
 * GOALS-1C — Probabilistic metrics for G0 predictions vs labels.
 */

import { poissonPmf } from "@/lib/intelligence/modules/probability/math/poisson";
import {
  GOALS_G0_CALIBRATION_BINS,
  GOALS_G0_MIN_BIN_SUPPORT,
} from "@/lib/debug/calibration/goals/g0/protocol";
import {
  jointScoreLogLoss,
  totalGoalLogLoss,
  unaryGoalLogLoss,
} from "@/lib/debug/calibration/goals/g0/poisson-markets";
import type { GoalsG0Prediction } from "@/lib/debug/calibration/goals/g0/predict";

export function binaryLogLoss(p: number, y: 0 | 1): number {
  const pp = Math.min(1 - 1e-15, Math.max(1e-15, p));
  return -(y * Math.log(pp) + (1 - y) * Math.log(1 - pp));
}

export function binaryBrier(p: number, y: 0 | 1): number {
  return (p - y) ** 2;
}

export type BinaryMarketMetric = {
  n: number;
  logLoss: number;
  brier: number;
  meanPredicted: number;
  actualRate: number;
};

function aggregateBinary(
  pairs: { p: number; y: 0 | 1 }[],
): BinaryMarketMetric | null {
  if (pairs.length === 0) return null;
  let ll = 0;
  let br = 0;
  let sumP = 0;
  let sumY = 0;
  for (const { p, y } of pairs) {
    ll += binaryLogLoss(p, y);
    br += binaryBrier(p, y);
    sumP += p;
    sumY += y;
  }
  const n = pairs.length;
  return {
    n,
    logLoss: ll / n,
    brier: br / n,
    meanPredicted: sumP / n,
    actualRate: sumY / n,
  };
}

export type CalibrationBin = {
  lo: number;
  hi: number;
  n: number;
  meanPredicted: number;
  actualRate: number;
  lowSupport: boolean;
};

export function calibrationTable(
  pairs: { p: number; y: 0 | 1 }[],
): CalibrationBin[] {
  const bins: CalibrationBin[] = [];
  const edges = GOALS_G0_CALIBRATION_BINS;
  for (let i = 0; i < edges.length - 1; i += 1) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    const subset = pairs.filter((x) => x.p >= lo && x.p < hi);
    const n = subset.length;
    bins.push({
      lo,
      hi,
      n,
      meanPredicted: n ? subset.reduce((s, x) => s + x.p, 0) / n : NaN,
      actualRate: n ? subset.reduce((s, x) => s + x.y, 0) / n : NaN,
      lowSupport: n < GOALS_G0_MIN_BIN_SUPPORT,
    });
  }
  return bins;
}

export type GoalsG0SeasonMetrics = {
  eligibleN: number;
  unavailableN: number;
  labeledEligibleN: number;
  distribution: {
    jointScoreLogLoss: number;
    totalGoalLogLoss: number;
    homeGoalLogLoss: number;
    awayGoalLogLoss: number;
    meanPredHome: number;
    meanActualHome: number;
    meanPredAway: number;
    meanActualAway: number;
    meanPredTotal: number;
    meanActualTotal: number;
  } | null;
  markets: Record<string, BinaryMarketMetric | null>;
  calibration: Record<string, CalibrationBin[]>;
  overUnder05: {
    n: number;
    actual00: number;
    actualOver: number;
    meanPUnder: number;
    meanPOver: number;
    under: BinaryMarketMetric | null;
    over: BinaryMarketMetric | null;
  } | null;
  scorelineObservedVsPredicted: Record<
    string,
    { observed: number; meanPredicted: number }
  >;
  totalHistogram: Record<string, { observed: number; meanPredicted: number }>;
  dispersion: {
    actualHomeMean: number;
    actualHomeVar: number;
    actualAwayMean: number;
    actualAwayVar: number;
    actualTotalMean: number;
    actualTotalVar: number;
    classification: string;
  } | null;
};

export function evaluateG0Season(
  predictions: readonly GoalsG0Prediction[],
): GoalsG0SeasonMetrics {
  const eligible = predictions.filter((p) => p.predictionStatus === "AVAILABLE");
  const unavailable = predictions.filter(
    (p) => p.predictionStatus === "UNAVAILABLE",
  );
  const labeled = eligible.filter(
    (p) => p.labelHomeGoals90 != null && p.labelAwayGoals90 != null,
  );

  if (labeled.length === 0) {
    return {
      eligibleN: eligible.length,
      unavailableN: unavailable.length,
      labeledEligibleN: 0,
      distribution: null,
      markets: {},
      calibration: {},
      overUnder05: null,
      scorelineObservedVsPredicted: {},
      totalHistogram: {},
      dispersion: null,
    };
  }

  let jointLL = 0;
  let totLL = 0;
  let homeLL = 0;
  let awayLL = 0;
  let sumPredH = 0;
  let sumActH = 0;
  let sumPredA = 0;
  let sumActA = 0;

  const marketPairs: Record<string, { p: number; y: 0 | 1 }[]> = {
    O05: [],
    O15: [],
    O25: [],
    O35: [],
    O45: [],
    BTTS_YES: [],
    HOME_O05: [],
    HOME_O15: [],
    HOME_O25: [],
    AWAY_O05: [],
    AWAY_O15: [],
    AWAY_O25: [],
    U05: [],
  };

  const scoreKeys = [
    "0-0",
    "1-0",
    "0-1",
    "1-1",
    "2-0",
    "0-2",
    "2-1",
    "1-2",
    "2-2",
  ];
  const scoreObs: Record<string, number> = {};
  const scorePred: Record<string, number> = {};
  for (const k of scoreKeys) {
    scoreObs[k] = 0;
    scorePred[k] = 0;
  }
  const totObs: Record<string, number> = {
    "0": 0,
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5+": 0,
  };
  const totPred: Record<string, number> = {
    "0": 0,
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5+": 0,
  };

  const homes: number[] = [];
  const aways: number[] = [];
  const totals: number[] = [];

  for (const p of labeled) {
    const h = p.labelHomeGoals90!;
    const a = p.labelAwayGoals90!;
    const mh = p.muHome!;
    const ma = p.muAway!;
    const mt = mh + ma;
    jointLL += jointScoreLogLoss(h, a, mh, ma);
    totLL += totalGoalLogLoss(h + a, mt);
    homeLL += unaryGoalLogLoss(h, mh);
    awayLL += unaryGoalLogLoss(a, ma);
    sumPredH += mh;
    sumActH += h;
    sumPredA += ma;
    sumActA += a;
    homes.push(h);
    aways.push(a);
    totals.push(h + a);

    const m = p.markets!;
    const total = h + a;
    marketPairs.O05!.push({ p: m.matchTotals.over05, y: total >= 1 ? 1 : 0 });
    marketPairs.U05!.push({ p: m.matchTotals.under05, y: total === 0 ? 1 : 0 });
    marketPairs.O15!.push({ p: m.matchTotals.over15, y: total >= 2 ? 1 : 0 });
    marketPairs.O25!.push({ p: m.matchTotals.over25, y: total >= 3 ? 1 : 0 });
    marketPairs.O35!.push({ p: m.matchTotals.over35, y: total >= 4 ? 1 : 0 });
    marketPairs.O45!.push({ p: m.matchTotals.over45, y: total >= 5 ? 1 : 0 });
    marketPairs.BTTS_YES!.push({
      p: m.btts.yes,
      y: h >= 1 && a >= 1 ? 1 : 0,
    });
    marketPairs.HOME_O05!.push({
      p: m.homeTeamTotals.over05,
      y: h >= 1 ? 1 : 0,
    });
    marketPairs.HOME_O15!.push({
      p: m.homeTeamTotals.over15,
      y: h >= 2 ? 1 : 0,
    });
    marketPairs.HOME_O25!.push({
      p: m.homeTeamTotals.over25,
      y: h >= 3 ? 1 : 0,
    });
    marketPairs.AWAY_O05!.push({
      p: m.awayTeamTotals.over05,
      y: a >= 1 ? 1 : 0,
    });
    marketPairs.AWAY_O15!.push({
      p: m.awayTeamTotals.over15,
      y: a >= 2 ? 1 : 0,
    });
    marketPairs.AWAY_O25!.push({
      p: m.awayTeamTotals.over25,
      y: a >= 3 ? 1 : 0,
    });

    const key = `${h}-${a}`;
    if (key in scoreObs) scoreObs[key]! += 1;
    for (const sk of scoreKeys) {
      scorePred[sk]! += p.diagnostics!.exactScores[sk] ?? 0;
    }

    const tKey = total >= 5 ? "5+" : String(total);
    totObs[tKey]! += 1;
    for (let t = 0; t <= 4; t += 1) {
      totPred[String(t)]! += poissonPmf(t, mt);
    }
    let p5 = 0;
    for (let t = 5; t <= 25; t += 1) p5 += poissonPmf(t, mt);
    totPred["5+"]! += p5;
  }

  const n = labeled.length;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = (xs: number[]) => {
    const m = mean(xs);
    return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  };
  const hMean = mean(homes);
  const hVar = variance(homes);
  const aMean = mean(aways);
  const aVar = variance(aways);
  const tMean = mean(totals);
  const tVar = variance(totals);

  let classification = "NO_OBVIOUS_DISPERSION_PROBLEM";
  const overH = hVar > hMean * 1.15;
  const overA = aVar > aMean * 1.15;
  const underH = hVar < hMean * 0.85;
  const underA = aVar < aMean * 0.85;
  if ((overH || overA) && (underH || underA)) classification = "MIXED";
  else if (overH || overA || tVar > tMean * 1.15)
    classification = "POSSIBLE_OVERDISPERSION";
  else if (underH || underA || tVar < tMean * 0.85)
    classification = "POSSIBLE_UNDERDISPERSION";

  const markets: Record<string, BinaryMarketMetric | null> = {};
  const calibration: Record<string, CalibrationBin[]> = {};
  for (const [k, pairs] of Object.entries(marketPairs)) {
    markets[k] = aggregateBinary(pairs);
    if (["O05", "O15", "O25", "O35", "O45", "BTTS_YES"].includes(k)) {
      calibration[k] = calibrationTable(pairs);
    }
  }

  const scorelineObservedVsPredicted: Record<
    string,
    { observed: number; meanPredicted: number }
  > = {};
  for (const k of scoreKeys) {
    scorelineObservedVsPredicted[k] = {
      observed: scoreObs[k]!,
      meanPredicted: scorePred[k]! / n,
    };
  }
  const totalHistogram: Record<
    string,
    { observed: number; meanPredicted: number }
  > = {};
  for (const k of Object.keys(totObs)) {
    totalHistogram[k] = {
      observed: totObs[k]!,
      meanPredicted: totPred[k]! / n,
    };
  }

  return {
    eligibleN: eligible.length,
    unavailableN: unavailable.length,
    labeledEligibleN: n,
    distribution: {
      jointScoreLogLoss: jointLL / n,
      totalGoalLogLoss: totLL / n,
      homeGoalLogLoss: homeLL / n,
      awayGoalLogLoss: awayLL / n,
      meanPredHome: sumPredH / n,
      meanActualHome: sumActH / n,
      meanPredAway: sumPredA / n,
      meanActualAway: sumActA / n,
      meanPredTotal: (sumPredH + sumPredA) / n,
      meanActualTotal: (sumActH + sumActA) / n,
    },
    markets,
    calibration,
    overUnder05: {
      n,
      actual00: marketPairs.U05!.filter((x) => x.y === 1).length,
      actualOver: marketPairs.O05!.filter((x) => x.y === 1).length,
      meanPUnder: markets.U05!.meanPredicted,
      meanPOver: markets.O05!.meanPredicted,
      under: markets.U05!,
      over: markets.O05!,
    },
    scorelineObservedVsPredicted,
    totalHistogram,
    dispersion: {
      actualHomeMean: hMean,
      actualHomeVar: hVar,
      actualAwayMean: aMean,
      actualAwayVar: aVar,
      actualTotalMean: tMean,
      actualTotalVar: tVar,
      classification,
    },
  };
}
