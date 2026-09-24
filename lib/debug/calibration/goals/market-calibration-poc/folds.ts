/**
 * GOALS-1G.2 — Chronological expanding-origin folds on DEVELOPMENT fixtures.
 */

import { createHash } from "node:crypto";
import type { GoalsMcalObservation } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  GOALS_MCAL_POC_INTERNAL_FOLDS,
  GOALS_MCAL_POC_MIN_TRAIN_FIXTURES,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";

export type GoalsMcalPocFold = {
  id: string;
  trainFixtureIds: string[];
  evalFixtureIds: string[];
  trainFirstKickoffUtc: string;
  trainLastKickoffUtc: string;
  evalFirstKickoffUtc: string;
  evalLastKickoffUtc: string;
  trainFixtureDigest: string;
  evalFixtureDigest: string;
};

function fixtureDigest(ids: readonly string[]): string {
  return createHash("sha256")
    .update([...ids].sort().join("\n"), "utf8")
    .digest("hex");
}

/** Unique fixtures sorted by earliest kickoff then fixtureId. */
export function uniqueFixturesChronological(
  obs: readonly GoalsMcalObservation[],
): { fixtureId: string; kickoffUtc: string }[] {
  const map = new Map<string, string>();
  for (const o of obs) {
    const prev = map.get(o.fixtureId);
    if (!prev || o.kickoffUtc < prev) map.set(o.fixtureId, o.kickoffUtc);
  }
  return [...map.entries()]
    .map(([fixtureId, kickoffUtc]) => ({ fixtureId, kickoffUtc }))
    .sort(
      (a, b) =>
        a.kickoffUtc.localeCompare(b.kickoffUtc) ||
        a.fixtureId.localeCompare(b.fixtureId),
    );
}

export function buildDevelopmentFolds(
  developmentObs: readonly GoalsMcalObservation[],
): GoalsMcalPocFold[] {
  const fixtures = uniqueFixturesChronological(developmentObs);
  const n = fixtures.length;
  const folds: GoalsMcalPocFold[] = [];

  for (const spec of GOALS_MCAL_POC_INTERNAL_FOLDS) {
    const trainEnd = Math.floor(n * spec.trainEndFrac);
    const evalEnd = Math.floor(n * spec.evalEndFrac);
    const trainFx = fixtures.slice(0, trainEnd);
    const evalFx = fixtures.slice(trainEnd, evalEnd);
    if (trainFx.length < GOALS_MCAL_POC_MIN_TRAIN_FIXTURES) continue;
    if (evalFx.length === 0) continue;

    const trainIds = new Set(trainFx.map((f) => f.fixtureId));
    for (const f of evalFx) {
      if (trainIds.has(f.fixtureId)) {
        throw new Error(`Fold ${spec.id} overlapping fixture`);
      }
    }
    const lastTrain = Date.parse(trainFx[trainFx.length - 1]!.kickoffUtc);
    const firstEval = Date.parse(evalFx[0]!.kickoffUtc);
    if (lastTrain > firstEval) {
      throw new Error(`Fold ${spec.id} violates chronological order`);
    }

    const trainFixtureIds = trainFx.map((f) => f.fixtureId);
    const evalFixtureIds = evalFx.map((f) => f.fixtureId);
    folds.push({
      id: spec.id,
      trainFixtureIds,
      evalFixtureIds,
      trainFirstKickoffUtc: trainFx[0]!.kickoffUtc,
      trainLastKickoffUtc: trainFx[trainFx.length - 1]!.kickoffUtc,
      evalFirstKickoffUtc: evalFx[0]!.kickoffUtc,
      evalLastKickoffUtc: evalFx[evalFx.length - 1]!.kickoffUtc,
      trainFixtureDigest: fixtureDigest(trainFixtureIds),
      evalFixtureDigest: fixtureDigest(evalFixtureIds),
    });
  }
  return folds;
}

export function filterObsByFixtures(
  obs: readonly GoalsMcalObservation[],
  fixtureIds: readonly string[],
): GoalsMcalObservation[] {
  const set = new Set(fixtureIds);
  return obs.filter((o) => set.has(o.fixtureId));
}
