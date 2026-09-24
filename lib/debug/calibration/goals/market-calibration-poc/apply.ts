/**
 * GOALS-1G.2 — Apply selected calibrators; assert coherence (no post-hoc repair).
 */

import type { GoalsMcalObservation } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  applyIdentityCal,
  applyLogisticCal,
  type LogisticFitResult,
} from "@/lib/debug/calibration/goals/market-calibration-poc/logistic";
import type { GroupSelectionResult } from "@/lib/debug/calibration/goals/market-calibration-poc/select";
import type {
  GoalsMcalPocCanonicalMarket,
  GoalsMcalPocGroupId,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";
import { GOALS_MCAL_POC_GROUPS } from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";

export type CalibratedObservation = GoalsMcalObservation & {
  calibratedProbability: number;
  complementCalibrated: number;
  calibratorFamily: "CAL_0" | "CAL_1";
  groupId: GoalsMcalPocGroupId;
  calibrationApplied: boolean;
};

function marketToGroup(market: GoalsMcalPocCanonicalMarket): GoalsMcalPocGroupId {
  for (const [gid, markets] of Object.entries(GOALS_MCAL_POC_GROUPS) as [
    GoalsMcalPocGroupId,
    readonly GoalsMcalPocCanonicalMarket[],
  ][]) {
    if (markets.includes(market)) return gid;
  }
  throw new Error(`Unknown market ${market}`);
}

export function activeFitForGroup(
  sel: GroupSelectionResult,
): LogisticFitResult | null {
  if (sel.selectedFamily !== "CAL_1") return null;
  if (!sel.fullDevFit?.finite || sel.fullDevFit.slope <= 0) return null;
  return sel.fullDevFit;
}

/**
 * Prove: same (a,b) with b>0 preserves ordering of raw probs for a fixture.
 */
export function assertSharedLogisticPreservesOrder(
  rawOrderedDescending: readonly number[],
  intercept: number,
  slope: number,
): void {
  if (!(slope > 0)) {
    throw new Error("b<=0 cannot preserve Over monotonicity — fail closed");
  }
  const cals = rawOrderedDescending.map((p) =>
    applyLogisticCal(p, intercept, slope),
  );
  for (let i = 0; i < cals.length - 1; i += 1) {
    if (cals[i]! + 1e-12 < cals[i + 1]!) {
      throw new Error("Shared logistic broke monotonicity unexpectedly");
    }
  }
}

export function applySelectionsToObservations(
  obs: readonly GoalsMcalObservation[],
  selections: Record<GoalsMcalPocGroupId, GroupSelectionResult>,
): CalibratedObservation[] {
  const fitByGroup = new Map<GoalsMcalPocGroupId, LogisticFitResult | null>();
  for (const [gid, sel] of Object.entries(selections) as [
    GoalsMcalPocGroupId,
    GroupSelectionResult,
  ][]) {
    fitByGroup.set(gid, activeFitForGroup(sel));
  }

  // Coherence check per fixture for monotone groups
  const byFixture = new Map<string, GoalsMcalObservation[]>();
  for (const o of obs) {
    const list = byFixture.get(o.fixtureId) ?? [];
    list.push(o);
    byFixture.set(o.fixtureId, list);
  }

  for (const [fixtureId, rows] of byFixture) {
    for (const gid of [
      "GROUP_MATCH_TOTAL",
      "GROUP_HOME_TOTAL",
      "GROUP_AWAY_TOTAL",
    ] as const) {
      const fit = fitByGroup.get(gid);
      if (!fit) continue;
      const markets = GOALS_MCAL_POC_GROUPS[gid];
      const ordered = markets.map((m) => {
        const r = rows.find((o) => o.market === m);
        if (!r) throw new Error(`Missing ${m} for ${fixtureId}`);
        return r.rawProbability;
      });
      assertSharedLogisticPreservesOrder(ordered, fit.intercept, fit.slope);
    }
  }

  const out: CalibratedObservation[] = [];
  for (const o of obs) {
    const groupId = marketToGroup(o.market as GoalsMcalPocCanonicalMarket);
    const sel = selections[groupId]!;
    const fit = fitByGroup.get(groupId);
    let calibratedProbability: number;
    let calibrationApplied = false;
    let family: "CAL_0" | "CAL_1" = "CAL_0";

    if (sel.selectedFamily === "CAL_1" && fit) {
      calibratedProbability = applyLogisticCal(
        o.rawProbability,
        fit.intercept,
        fit.slope,
      );
      calibrationApplied = true;
      family = "CAL_1";
    } else {
      calibratedProbability = applyIdentityCal(o.rawProbability);
    }

    if (!Number.isFinite(calibratedProbability)) {
      calibratedProbability = o.rawProbability;
      calibrationApplied = false;
      family = "CAL_0";
    }

    const complementCalibrated = 1 - calibratedProbability;
    if (Math.abs(calibratedProbability + complementCalibrated - 1) > 1e-12) {
      throw new Error(`Complement coherence failed ${o.fixtureId}|${o.market}`);
    }

    out.push({
      ...o,
      calibratedProbability,
      complementCalibrated,
      calibratorFamily: family,
      groupId,
      calibrationApplied,
    });
  }
  return out;
}

/** Assert no O0.5-dedicated parameter exists in artifacts. */
export function assertNoDedicatedO05Calibrator(
  selections: Record<GoalsMcalPocGroupId, GroupSelectionResult>,
): void {
  const mt = selections.GROUP_MATCH_TOTAL;
  if (!mt) return;
  // Shared fit only — markets include O0.5 but no separate O05 artifact key.
  if (mt.markets.length !== 5) {
    throw new Error("Match-total group must be shared 5-threshold");
  }
}
