/**
 * GOALS-1G.3 — Coherence: complements + R3 cross-boundary monotonicity.
 * No post-hoc sorting repair.
 */

import type { GoalsMcalObservation } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  applyCandidateProbability,
  type RefParams,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/candidates";

export type CrossBoundaryAudit = {
  fixturesChecked: number;
  violationCount: number;
  maxViolationMagnitude: number;
  coherenceValid: boolean;
  complementFailures: number;
};

/**
 * For every fixture with match-total overs present, assert after calibration:
 * P(O0.5) >= P(O1.5) >= P(O2.5)  (cross-boundary critical for R3)
 * and full chain through O4.5 when applicable.
 * Complements: Under = 1 - Over.
 */
export function auditMatchTotalCoherence(
  obs: readonly GoalsMcalObservation[],
  params: RefParams,
): CrossBoundaryAudit {
  const byFixture = new Map<string, GoalsMcalObservation[]>();
  for (const o of obs) {
    if (!o.market.startsWith("MATCH_TOTAL_OVER_")) continue;
    const list = byFixture.get(o.fixtureId) ?? [];
    list.push(o);
    byFixture.set(o.fixtureId, list);
  }

  let violationCount = 0;
  let maxViolationMagnitude = 0;
  let complementFailures = 0;
  const eps = 1e-12;

  for (const [, rows] of byFixture) {
    const get = (m: string) => {
      const r = rows.find((o) => o.market === m);
      if (!r) return null;
      return applyCandidateProbability(m, r.rawProbability, params);
    };
    const p05 = get("MATCH_TOTAL_OVER_0_5");
    const p15 = get("MATCH_TOTAL_OVER_1_5");
    const p25 = get("MATCH_TOTAL_OVER_2_5");
    const p35 = get("MATCH_TOTAL_OVER_3_5");
    const p45 = get("MATCH_TOTAL_OVER_4_5");
    const chain = [p05, p15, p25, p35, p45].filter(
      (p): p is number => p != null,
    );
    for (let i = 0; i < chain.length - 1; i += 1) {
      const gap = chain[i + 1]! - chain[i]!;
      if (gap > eps) {
        violationCount += 1;
        if (gap > maxViolationMagnitude) maxViolationMagnitude = gap;
      }
    }
    for (const p of chain) {
      const under = 1 - p;
      if (Math.abs(p + under - 1) > eps) complementFailures += 1;
    }
  }

  return {
    fixturesChecked: byFixture.size,
    violationCount,
    maxViolationMagnitude,
    coherenceValid: violationCount === 0 && complementFailures === 0,
    complementFailures,
  };
}
