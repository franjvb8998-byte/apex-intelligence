/**
 * GOALS-1C — Independent Poisson market derivations (analytic where possible).
 */

import { poissonPmf } from "@/lib/intelligence/modules/probability/math/poisson";
import { GOALS_G0_DIAGNOSTIC_MAX_GOALS } from "@/lib/debug/calibration/goals/g0/protocol";

export function assertValidLambda(lambda: number, name: string): void {
  if (!Number.isFinite(lambda) || lambda <= 0) {
    throw new Error(`Invalid ${name}: ${lambda}`);
  }
}

/** P(K <= k) for Poisson(λ). */
export function poissonCdfLeq(k: number, lambda: number): number {
  if (!Number.isInteger(k) || k < 0) {
    throw new Error(`poissonCdfLeq expects k >= 0 integer, got ${k}`);
  }
  let s = 0;
  for (let i = 0; i <= k; i += 1) s += poissonPmf(i, lambda);
  return s;
}

export function totalOverProb(lineHalf: number, muTotal: number): number {
  // lineHalf in {0.5,1.5,2.5,3.5,4.5} => Over means T >= ceil(line)
  const threshold = Math.ceil(lineHalf); // 1,2,3,4,5
  // P(T >= threshold) = 1 - P(T <= threshold-1)
  if (threshold <= 0) return 1;
  return 1 - poissonCdfLeq(threshold - 1, muTotal);
}

export function totalUnderProb(lineHalf: number, muTotal: number): number {
  return 1 - totalOverProb(lineHalf, muTotal);
}

export function teamOverProb(lineHalf: number, mu: number): number {
  const threshold = Math.ceil(lineHalf);
  if (threshold <= 0) return 1;
  return 1 - poissonCdfLeq(threshold - 1, mu);
}

export function bttsYesIndependent(muHome: number, muAway: number): number {
  return (
    1 -
    Math.exp(-muHome) -
    Math.exp(-muAway) +
    Math.exp(-(muHome + muAway))
  );
}

export type GoalsG0MarketBundle = {
  matchTotals: {
    over05: number;
    under05: number;
    over15: number;
    under15: number;
    over25: number;
    under25: number;
    over35: number;
    under35: number;
    over45: number;
    under45: number;
  };
  btts: { yes: number; no: number };
  homeTeamTotals: {
    over05: number;
    under05: number;
    over15: number;
    under15: number;
    over25: number;
    under25: number;
  };
  awayTeamTotals: {
    over05: number;
    under05: number;
    over15: number;
    under15: number;
    over25: number;
    under25: number;
  };
};

export function deriveAnalyticMarkets(
  muHome: number,
  muAway: number,
): GoalsG0MarketBundle {
  assertValidLambda(muHome, "muHome");
  assertValidLambda(muAway, "muAway");
  const muT = muHome + muAway;
  const under05 = Math.exp(-muT);
  const over05 = 1 - under05;
  const mt = {
    over05,
    under05,
    over15: totalOverProb(1.5, muT),
    under15: totalUnderProb(1.5, muT),
    over25: totalOverProb(2.5, muT),
    under25: totalUnderProb(2.5, muT),
    over35: totalOverProb(3.5, muT),
    under35: totalUnderProb(3.5, muT),
    over45: totalOverProb(4.5, muT),
    under45: totalUnderProb(4.5, muT),
  };
  const yes = bttsYesIndependent(muHome, muAway);
  const home = {
    over05: teamOverProb(0.5, muHome),
    under05: 1 - teamOverProb(0.5, muHome),
    over15: teamOverProb(1.5, muHome),
    under15: 1 - teamOverProb(1.5, muHome),
    over25: teamOverProb(2.5, muHome),
    under25: 1 - teamOverProb(2.5, muHome),
  };
  const away = {
    over05: teamOverProb(0.5, muAway),
    under05: 1 - teamOverProb(0.5, muAway),
    over15: teamOverProb(1.5, muAway),
    under15: 1 - teamOverProb(1.5, muAway),
    over25: teamOverProb(2.5, muAway),
    under25: 1 - teamOverProb(2.5, muAway),
  };
  return {
    matchTotals: mt,
    btts: { yes, no: 1 - yes },
    homeTeamTotals: home,
    awayTeamTotals: away,
  };
}

export type GoalsG0ScoreDiagnostics = {
  coveredMass: number;
  omittedMass: number;
  oneXTwo: { home: number; draw: number; away: number };
  exactScores: Record<string, number>;
};

export function diagnosticScoreGrid(
  muHome: number,
  muAway: number,
  maxGoals = GOALS_G0_DIAGNOSTIC_MAX_GOALS,
): GoalsG0ScoreDiagnostics {
  assertValidLambda(muHome, "muHome");
  assertValidLambda(muAway, "muAway");
  let home = 0;
  let draw = 0;
  let away = 0;
  let covered = 0;
  const exactKeys = [
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
  const exactScores: Record<string, number> = {};
  for (const k of exactKeys) exactScores[k] = 0;

  for (let i = 0; i <= maxGoals; i += 1) {
    for (let j = 0; j <= maxGoals; j += 1) {
      const p = poissonPmf(i, muHome) * poissonPmf(j, muAway);
      covered += p;
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      const key = `${i}-${j}`;
      if (key in exactScores) exactScores[key] = p;
    }
  }
  // Renormalize 1X2 by covered mass (document omitted)
  const denom = covered > 0 ? covered : 1;
  return {
    coveredMass: covered,
    omittedMass: Math.max(0, 1 - covered),
    oneXTwo: {
      home: home / denom,
      draw: draw / denom,
      away: away / denom,
    },
    exactScores,
  };
}

/** Joint PMF for metric evaluation (exact, no truncation). */
export function jointScoreLogLoss(
  homeGoals: number,
  awayGoals: number,
  muHome: number,
  muAway: number,
): number {
  const p =
    poissonPmf(homeGoals, muHome) * poissonPmf(awayGoals, muAway);
  return -Math.log(Math.max(p, 1e-15));
}

export function totalGoalLogLoss(
  total: number,
  muTotal: number,
): number {
  return -Math.log(Math.max(poissonPmf(total, muTotal), 1e-15));
}

export function unaryGoalLogLoss(goals: number, mu: number): number {
  return -Math.log(Math.max(poissonPmf(goals, mu), 1e-15));
}
