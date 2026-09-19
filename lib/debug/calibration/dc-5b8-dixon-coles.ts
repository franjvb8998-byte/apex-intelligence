/**
 * Debug/calibration-only Dixon-Coles low-score correction.
 * Isolated from production PE. Not a fitted parameter.
 *
 * Dixon & Coles (1997) τ(x,y; λ, μ, ρ) with x=home goals, y=away goals,
 * λ=λ_home, μ=λ_away:
 *
 *   τ(0,0) = 1 - λ μ ρ
 *   τ(0,1) = 1 + λ ρ
 *   τ(1,0) = 1 + μ ρ
 *   τ(1,1) = 1 - ρ
 *   τ(x,y) = 1 otherwise
 *
 * Corrected cell mass is P_indep(x,y) * τ. Negative or non-finite τ is
 * INVALID and is never silently clamped.
 *
 * ρ = 0 ⇒ τ = 1 everywhere ⇒ independent Poisson.
 */

import { scorelineProbability } from "@/lib/intelligence/modules/probability/math/poisson";
import { normalizeOutcomeProbability } from "@/lib/intelligence/modules/probability/math/normalize";
import type { OneXTwo } from "@/lib/debug/calibration/types";
import {
  DRAW_SCORELINE_PARTS,
  OBSERVED_SCORELINE_KEYS,
  type DrawScorelinePart,
  type ObservedScorelineKey,
} from "@/lib/debug/calibration/dc-5b8-shape";

export class DixonColesInvalidError extends Error {
  constructor(
    message: string,
    readonly details: DixonColesFailure,
  ) {
    super(message);
    this.name = "DixonColesInvalidError";
  }
}

export type DixonColesFailure = {
  rho: number;
  fixtureId?: string;
  homeGoals: number;
  awayGoals: number;
  lambdaHome: number;
  lambdaAway: number;
  tau: number;
  reason: string;
};

export type ScorelineMasses = Record<ObservedScorelineKey, number>;
export type DrawPartMasses = Record<DrawScorelinePart, number>;

export function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

export function inspectDixonColesTau(input: {
  homeGoals: number;
  awayGoals: number;
  lambdaHome: number;
  lambdaAway: number;
  rho: number;
  fixtureId?: string;
}): { ok: true; tau: number } | { ok: false; failure: DixonColesFailure } {
  const tau = dixonColesTau(
    input.homeGoals,
    input.awayGoals,
    input.lambdaHome,
    input.lambdaAway,
    input.rho,
  );
  if (!Number.isFinite(tau)) {
    return {
      ok: false,
      failure: {
        rho: input.rho,
        fixtureId: input.fixtureId,
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        lambdaHome: input.lambdaHome,
        lambdaAway: input.lambdaAway,
        tau,
        reason: "tau is not finite",
      },
    };
  }
  if (tau < 0) {
    return {
      ok: false,
      failure: {
        rho: input.rho,
        fixtureId: input.fixtureId,
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        lambdaHome: input.lambdaHome,
        lambdaAway: input.lambdaAway,
        tau,
        reason: "tau is negative",
      },
    };
  }
  return { ok: true, tau };
}

export function assertValidDixonColesTau(input: {
  homeGoals: number;
  awayGoals: number;
  lambdaHome: number;
  lambdaAway: number;
  rho: number;
}): number {
  const inspected = inspectDixonColesTau(input);
  if (!inspected.ok) {
    throw new DixonColesInvalidError(inspected.failure.reason, inspected.failure);
  }
  return inspected.tau;
}

function emptyScorelines(): ScorelineMasses {
  return {
    "0-0": 0,
    "1-0": 0,
    "0-1": 0,
    "1-1": 0,
    "2-0": 0,
    "0-2": 0,
    "2-1": 0,
    "1-2": 0,
    "2-2": 0,
    "3-3+": 0,
    other: 0,
  };
}

function emptyDrawParts(): DrawPartMasses {
  return { "0-0": 0, "1-1": 0, "2-2": 0, "3-3": 0, "4-4+": 0 };
}

export function observedScorelineKey(
  homeGoals: number,
  awayGoals: number,
): ObservedScorelineKey {
  const key = `${homeGoals}-${awayGoals}`;
  if (
    key === "0-0" ||
    key === "1-0" ||
    key === "0-1" ||
    key === "1-1" ||
    key === "2-0" ||
    key === "0-2" ||
    key === "2-1" ||
    key === "1-2" ||
    key === "2-2"
  ) {
    return key;
  }
  if (homeGoals === awayGoals && homeGoals >= 3) return "3-3+";
  return "other";
}

function accumulateScoreline(masses: ScorelineMasses, i: number, j: number, p: number): void {
  const key = observedScorelineKey(i, j);
  masses[key] += p;
}

function accumulateDrawPart(parts: DrawPartMasses, i: number, j: number, p: number): void {
  if (i !== j) return;
  if (i === 0) parts["0-0"] += p;
  else if (i === 1) parts["1-1"] += p;
  else if (i === 2) parts["2-2"] += p;
  else if (i === 3) parts["3-3"] += p;
  else parts["4-4+"] += p;
}

export type DixonColesGridResult =
  | {
      ok: true;
      rho: number;
      oneXTwo: OneXTwo;
      coveredMass: number;
      rawMass: number;
      scorelines: ScorelineMasses;
      drawParts: DrawPartMasses;
    }
  | {
      ok: false;
      rho: number;
      failure: DixonColesFailure;
    };

export function buildScoreGrid(input: {
  lambdaHome: number;
  lambdaAway: number;
  maxGoals: number;
  rho: number;
  fixtureId?: string;
}): DixonColesGridResult {
  const { lambdaHome, lambdaAway, maxGoals, rho } = input;
  let home = 0;
  let draw = 0;
  let away = 0;
  let rawMass = 0;
  const scorelines = emptyScorelines();
  const drawParts = emptyDrawParts();

  for (let i = 0; i <= maxGoals; i += 1) {
    for (let j = 0; j <= maxGoals; j += 1) {
      const inspected = inspectDixonColesTau({
        homeGoals: i,
        awayGoals: j,
        lambdaHome,
        lambdaAway,
        rho,
        fixtureId: input.fixtureId,
      });
      if (!inspected.ok) return { ok: false, rho, failure: inspected.failure };
      const independent = scorelineProbability(i, j, lambdaHome, lambdaAway);
      const p = independent * inspected.tau;
      if (!Number.isFinite(p) || p < 0) {
        return {
          ok: false,
          rho,
          failure: {
            rho,
            fixtureId: input.fixtureId,
            homeGoals: i,
            awayGoals: j,
            lambdaHome,
            lambdaAway,
            tau: inspected.tau,
            reason: p < 0 ? "corrected cell mass is negative" : "corrected cell mass is not finite",
          },
        };
      }
      rawMass += p;
      accumulateScoreline(scorelines, i, j, p);
      accumulateDrawPart(drawParts, i, j, p);
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
    }
  }

  if (!(rawMass > 0) || !Number.isFinite(rawMass)) {
    return {
      ok: false,
      rho,
      failure: {
        rho,
        fixtureId: input.fixtureId,
        homeGoals: -1,
        awayGoals: -1,
        lambdaHome,
        lambdaAway,
        tau: Number.NaN,
        reason: "corrected grid mass is not positive and finite",
      },
    };
  }

  const oneXTwo = normalizeOutcomeProbability({
    home: home / rawMass,
    draw: draw / rawMass,
    away: away / rawMass,
  });
  const normalizedScorelines = emptyScorelines();
  const normalizedDrawParts = emptyDrawParts();
  for (const key of OBSERVED_SCORELINE_KEYS) {
    normalizedScorelines[key] = scorelines[key] / rawMass;
  }
  for (const key of DRAW_SCORELINE_PARTS) {
    normalizedDrawParts[key] = drawParts[key] / rawMass;
  }
  return {
    ok: true,
    rho,
    oneXTwo,
    coveredMass: rawMass,
    rawMass,
    scorelines: normalizedScorelines,
    drawParts: normalizedDrawParts,
  };
}

export function independentPoissonGrid(input: {
  lambdaHome: number;
  lambdaAway: number;
  maxGoals: number;
}): Extract<DixonColesGridResult, { ok: true }> {
  const grid = buildScoreGrid({ ...input, rho: 0 });
  if (!grid.ok) {
    throw new DixonColesInvalidError("rho=0 must be valid independent Poisson", grid.failure);
  }
  return grid;
}
