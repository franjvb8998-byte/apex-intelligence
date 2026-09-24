/**
 * GOALS-1H.1 — Within-team temporal shuffle diagnostic (destroys order).
 */

import type { GoalsRadTeamObservation } from "@/lib/debug/calibration/goals/recent-attack-defense/observations";
import { sortTeamObservations } from "@/lib/debug/calibration/goals/recent-attack-defense/observations";
import {
  associate,
  buildSignalPairs,
  pearson,
} from "@/lib/debug/calibration/goals/recent-attack-defense/diagnostics";
import {
  GOALS_RAD_SHUFFLE_ITERATIONS,
  GOALS_RAD_SHUFFLE_SEED,
} from "@/lib/debug/calibration/goals/recent-attack-defense/protocol";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/**
 * Preserve team identity and sample size; shuffle residual sequence within team
 * while keeping kickoff/fixture slots fixed — breaks temporal persistence.
 */
export function shuffleResidualsWithinTeam(
  obs: readonly GoalsRadTeamObservation[],
  seed: number,
): GoalsRadTeamObservation[] {
  const rand = lcg(seed);
  const byTeam = new Map<string, GoalsRadTeamObservation[]>();
  for (const o of obs) {
    const key = `${o.season}|${o.teamId}`;
    const list = byTeam.get(key) ?? [];
    list.push(o);
    byTeam.set(key, list);
  }
  const out: GoalsRadTeamObservation[] = [];
  for (const [, list] of [...byTeam.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const sorted = sortTeamObservations(list);
    const attack = sorted.map((o) => o.attackResidual);
    const defense = sorted.map((o) => o.defenseResidual);
    const gf = sorted.map((o) => o.actualGoalsFor);
    const ga = sorted.map((o) => o.actualGoalsAgainst);
    shuffleInPlace(attack, rand);
    shuffleInPlace(defense, rand);
    shuffleInPlace(gf, rand);
    shuffleInPlace(ga, rand);
    for (let i = 0; i < sorted.length; i += 1) {
      out.push({
        ...sorted[i]!,
        attackResidual: attack[i]!,
        defenseResidual: defense[i]!,
        actualGoalsFor: gf[i]!,
        actualGoalsAgainst: ga[i]!,
      });
    }
  }
  return sortTeamObservations(out);
}

export function shuffleNullDiagnostic(
  obs: readonly GoalsRadTeamObservation[],
  windowId: "last_5" | "halfLife_28" = "last_5",
  seed = GOALS_RAD_SHUFFLE_SEED,
  iterations = GOALS_RAD_SHUFFLE_ITERATIONS,
): {
  observedAbsAttackR: number | null;
  observedAbsDefenseR: number | null;
  shuffledAbsAttackMean: number;
  shuffledAbsDefenseMean: number;
  attackExceedsShuffledFrac: number;
  defenseExceedsShuffledFrac: number;
} {
  const observed = associate(buildSignalPairs(obs, windowId, 1), "attack");
  const observedD = associate(buildSignalPairs(obs, windowId, 1), "defense");
  const obsA = observed.pearson != null ? Math.abs(observed.pearson) : null;
  const obsD = observedD.pearson != null ? Math.abs(observedD.pearson) : null;

  const shuffledA: number[] = [];
  const shuffledD: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const sh = shuffleResidualsWithinTeam(obs, seed + i);
    const a = associate(buildSignalPairs(sh, windowId, 1), "attack").pearson;
    const d = associate(buildSignalPairs(sh, windowId, 1), "defense").pearson;
    if (a != null) shuffledA.push(Math.abs(a));
    if (d != null) shuffledD.push(Math.abs(d));
  }
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  const fracExceed = (obsAbs: number | null, xs: number[]) => {
    if (obsAbs == null || !xs.length) return NaN;
    return xs.filter((x) => x >= obsAbs).length / xs.length;
  };

  return {
    observedAbsAttackR: obsA,
    observedAbsDefenseR: obsD,
    shuffledAbsAttackMean: mean(shuffledA),
    shuffledAbsDefenseMean: mean(shuffledD),
    attackExceedsShuffledFrac: fracExceed(obsA, shuffledA),
    defenseExceedsShuffledFrac: fracExceed(obsD, shuffledD),
  };
}

export { pearson };
