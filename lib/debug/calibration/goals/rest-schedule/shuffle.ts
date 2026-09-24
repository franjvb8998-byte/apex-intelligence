/**
 * GOALS-1I.1 — Shuffle rest exposures within team (breaks rest→residual link).
 */

import type { GoalsRestTeamObservation } from "@/lib/debug/calibration/goals/rest-schedule/observations";
import { sortTeamObs } from "@/lib/debug/calibration/goals/rest-schedule/observations";
import { associate } from "@/lib/debug/calibration/goals/rest-schedule/diagnostics";
import {
  GOALS_REST_SHUFFLE_REPS,
  GOALS_REST_SHUFFLE_SEED,
} from "@/lib/debug/calibration/goals/rest-schedule/protocol";

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
 * Preserve kickoff slots and residuals; shuffle leagueRestDays among a team's
 * AVAILABLE observations within season (destroys temporal rest alignment).
 */
export function shuffleRestWithinTeam(
  obs: readonly GoalsRestTeamObservation[],
  seed: number,
): GoalsRestTeamObservation[] {
  const rand = lcg(seed);
  const byTeam = new Map<string, GoalsRestTeamObservation[]>();
  for (const o of obs) {
    const key = `${o.season}|${o.teamId}`;
    const list = byTeam.get(key) ?? [];
    list.push(o);
    byTeam.set(key, list);
  }
  const out: GoalsRestTeamObservation[] = [];
  for (const [, list] of [...byTeam.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const sorted = sortTeamObs(list);
    const restVals = sorted.map((o) => o.leagueRestDays);
    const bins = sorted.map((o) => o.restBin);
    const statuses = sorted.map((o) => o.restFeatureStatus);
    // Shuffle only among AVAILABLE indices
    const availIdx = sorted
      .map((o, i) => (o.restFeatureStatus === "AVAILABLE" ? i : -1))
      .filter((i) => i >= 0);
    const restAvail = availIdx.map((i) => restVals[i]!);
    const binAvail = availIdx.map((i) => bins[i]!);
    shuffleInPlace(restAvail, rand);
    shuffleInPlace(binAvail, rand);
    let k = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      if (statuses[i] === "AVAILABLE") {
        out.push({
          ...sorted[i]!,
          leagueRestDays: restAvail[k]!,
          restBin: binAvail[k]!,
          shortRestLe3d: restAvail[k]! <= 3,
          veryShortRestLe2d: restAvail[k]! <= 2,
        });
        k += 1;
      } else {
        out.push(sorted[i]!);
      }
    }
  }
  return sortTeamObs(out);
}

export function shuffleNullRestDiagnostic(
  obs: readonly GoalsRestTeamObservation[],
  seed = GOALS_REST_SHUFFLE_SEED,
  reps = GOALS_REST_SHUFFLE_REPS,
): {
  observedAbsAttackR: number | null;
  observedAbsDefenseR: number | null;
  shuffledAbsAttackMean: number;
  shuffledAbsDefenseMean: number;
  attackExceedsShuffledFrac: number;
  defenseExceedsShuffledFrac: number;
} {
  const avail = obs.filter((o) => o.restFeatureStatus === "AVAILABLE");
  const obsA = associate(
    avail.map((o) => o.leagueRestDays!),
    avail.map((o) => o.attackResidual),
  ).pearson;
  const obsD = associate(
    avail.map((o) => o.leagueRestDays!),
    avail.map((o) => o.defenseResidual),
  ).pearson;
  const absA = obsA != null ? Math.abs(obsA) : null;
  const absD = obsD != null ? Math.abs(obsD) : null;

  const shA: number[] = [];
  const shD: number[] = [];
  for (let i = 0; i < reps; i += 1) {
    const sh = shuffleRestWithinTeam(obs, seed + i);
    const a = sh.filter((o) => o.restFeatureStatus === "AVAILABLE");
    const ra = associate(
      a.map((o) => o.leagueRestDays!),
      a.map((o) => o.attackResidual),
    ).pearson;
    const rd = associate(
      a.map((o) => o.leagueRestDays!),
      a.map((o) => o.defenseResidual),
    ).pearson;
    if (ra != null) shA.push(Math.abs(ra));
    if (rd != null) shD.push(Math.abs(rd));
  }
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  const frac = (obsAbs: number | null, xs: number[]) =>
    obsAbs == null || !xs.length
      ? NaN
      : xs.filter((x) => x >= obsAbs).length / xs.length;

  return {
    observedAbsAttackR: absA,
    observedAbsDefenseR: absD,
    shuffledAbsAttackMean: mean(shA),
    shuffledAbsDefenseMean: mean(shD),
    attackExceedsShuffledFrac: frac(absA, shA),
    defenseExceedsShuffledFrac: frac(absD, shD),
  };
}
