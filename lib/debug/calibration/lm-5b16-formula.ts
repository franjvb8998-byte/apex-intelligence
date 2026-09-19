/**
 * Debug-only local HIGH_EQUAL mass compose. Isolated. Does not mutate production PE.
 * M0 = independent Poisson. No fitting. No multiplier search.
 */

import { blendOneXTwo } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { normalizeOutcomeProbability } from "@/lib/intelligence/modules/probability/math/normalize";
import {
  buildIndependentScoreGrid,
  emptyEqualMasses,
  type EqualScoreMasses,
  type ScoreGridResult,
} from "@/lib/debug/calibration/hs-5b14-formula";
import { equalScoreKey } from "@/lib/debug/calibration/hs-5b14-shape";
import type { OneXTwo } from "@/lib/debug/calibration/types";
import {
  HIGH_EQUAL_MULTIPLIERS,
  TRANSFER_HIGH_EQUAL_RELATIVE,
  isHighEqualCell,
  isLowEqualCell,
  isNonDrawCell,
  type LocalMassArm,
} from "@/lib/debug/calibration/lm-5b16-shape";

export const LOCAL_MASS_NORMALIZATION = {
  multiplier:
    "adjusted(k,k)=original(k,k)*m for k>=2; then p'(i,j)=p*(i,j)/Σp* so the matrix sums to 1",
  transfer:
    "add exactly 0.10*H to HIGH_EQUAL, allocated in original HIGH_EQUAL proportions; remove the same mass from non-draw cells in their original proportions; 0-0 and 1-1 untouched; divide by Σ only for floating-point tolerance",
  direct: "HIGH_EQUAL multiplication or T1 HIGH_EQUAL increment",
  indirect: "global renormalization of every cell, including 0-0/1-1 on M1/M2/M3",
} as const;

export type MassChangeAudit = {
  p00: number;
  p11: number;
  p22: number;
  p33plus: number;
  highEqual: number;
  lowEqual: number;
  draw: number;
  home: number;
  away: number;
};

export type LocalGridResult = {
  arm: LocalMassArm;
  grid: ScoreGridResult;
  oneXTwo: OneXTwo;
  hybrid: OneXTwo;
  directHighEqual: number;
  indirectScale: number;
  changeFromControl: MassChangeAudit;
};

function cloneCells(cells: readonly (readonly number[])[]): number[][] {
  return cells.map((row) => [...row]);
}

function matrixSum(cells: readonly (readonly number[])[]): number {
  let sum = 0;
  for (const row of cells) {
    for (const value of row) sum += value;
  }
  return sum;
}

function assertValidCell(value: number, i: number, j: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid score mass at ${i}-${j}: ${value}`);
  }
}

export function summarizeCells(cells: readonly (readonly number[])[]): ScoreGridResult {
  const maxGoals = cells.length - 1;
  let home = 0;
  let draw = 0;
  let away = 0;
  const equal = emptyEqualMasses();
  for (let i = 0; i <= maxGoals; i += 1) {
    for (let j = 0; j <= maxGoals; j += 1) {
      const p = cells[i]![j]!;
      assertValidCell(p, i, j);
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      const key = equalScoreKey(i, j);
      if (key) equal[key] += p;
    }
  }
  const coveredMass = home + draw + away;
  if (!(Math.abs(coveredMass - 1) < 1e-9)) {
    throw new Error(`Score matrix sum ${coveredMass} is outside truncation tolerance of 1`);
  }
  const oneXTwo = normalizeOutcomeProbability({ home, draw, away });
  return {
    oneXTwo,
    coveredMass,
    equal,
    cells: cells.map((row) => [...row]),
    p00: equal["0-0"],
    p11: equal["1-1"],
    p22: equal["2-2"],
    p33: equal["3-3"],
    p44: equal["4-4"],
    p55plus: equal["5-5+"],
    draw: oneXTwo.draw,
  };
}

function highEqualMass(cells: readonly (readonly number[])[]): number {
  let mass = 0;
  for (let k = 2; k < cells.length; k += 1) mass += cells[k]![k]!;
  return mass;
}

function scaleMatrix(cells: number[][], scale: number): void {
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = 0; j < cells[i]!.length; j += 1) {
      cells[i]![j]! *= scale;
    }
  }
}

export function applyHighEqualMultiplier(
  control: ScoreGridResult,
  multiplier: number,
): { cells: number[][]; directHighEqual: number; indirectScale: number } {
  if (!(multiplier > 0)) throw new Error(`Invalid HIGH_EQUAL multiplier ${multiplier}`);
  const cells = cloneCells(control.cells);
  const originalHigh = highEqualMass(cells);
  for (let k = 2; k < cells.length; k += 1) {
    cells[k]![k]! *= multiplier;
  }
  const total = matrixSum(cells);
  if (!(total > 0)) throw new Error("Multiplier grid produced zero mass");
  scaleMatrix(cells, 1 / total);
  return {
    cells,
    directHighEqual: originalHigh * multiplier,
    indirectScale: 1 / total,
  };
}

export function applyHighEqualTransfer(control: ScoreGridResult): {
  cells: number[][];
  directHighEqual: number;
  indirectScale: number;
} {
  const cells = cloneCells(control.cells);
  const originalHigh = highEqualMass(cells);
  const added = TRANSFER_HIGH_EQUAL_RELATIVE * originalHigh;
  let donor = 0;
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = 0; j < cells[i]!.length; j += 1) {
      if (isNonDrawCell(i, j)) donor += cells[i]![j]!;
    }
  }
  if (!(donor > added)) {
    throw new Error(`T1 donor mass ${donor} cannot fund HIGH_EQUAL increment ${added}`);
  }
  const low00 = cells[0]![0]!;
  const low11 = cells[1]![1]!;
  if (originalHigh > 0) {
    for (let k = 2; k < cells.length; k += 1) {
      cells[k]![k]! += added * (control.cells[k]![k]! / originalHigh);
    }
  }
  const donorScale = (donor - added) / donor;
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = 0; j < cells[i]!.length; j += 1) {
      if (isNonDrawCell(i, j)) {
        cells[i]![j]! *= donorScale;
        if (cells[i]![j]! < 0) {
          throw new Error(`T1 produced negative donor mass at ${i}-${j}`);
        }
      }
    }
  }
  if (Math.abs(cells[0]![0]! - low00) > 1e-15) {
    throw new Error("T1 must not directly modify 0-0");
  }
  if (Math.abs(cells[1]![1]! - low11) > 1e-15) {
    throw new Error("T1 must not directly modify 1-1");
  }
  const total = matrixSum(cells);
  scaleMatrix(cells, 1 / total);
  return {
    cells,
    directHighEqual: originalHigh + added,
    indirectScale: 1 / total,
  };
}

function audit(grid: ScoreGridResult): MassChangeAudit {
  return {
    p00: grid.p00,
    p11: grid.p11,
    p22: grid.p22,
    p33plus: grid.p33 + grid.p44 + grid.p55plus,
    highEqual: grid.p22 + grid.p33 + grid.p44 + grid.p55plus,
    lowEqual: grid.p00 + grid.p11,
    draw: grid.draw,
    home: grid.oneXTwo.home,
    away: grid.oneXTwo.away,
  };
}

function deltaAudit(probe: ScoreGridResult, control: ScoreGridResult): MassChangeAudit {
  const left = audit(probe);
  const right = audit(control);
  return {
    p00: left.p00 - right.p00,
    p11: left.p11 - right.p11,
    p22: left.p22 - right.p22,
    p33plus: left.p33plus - right.p33plus,
    highEqual: left.highEqual - right.highEqual,
    lowEqual: left.lowEqual - right.lowEqual,
    draw: left.draw - right.draw,
    home: left.home - right.home,
    away: left.away - right.away,
  };
}

export function applyLocalMassArm(input: {
  control: ScoreGridResult;
  elo: OneXTwo;
  arm: LocalMassArm;
}): LocalGridResult {
  const transformed =
    input.arm === "T1"
      ? applyHighEqualTransfer(input.control)
      : applyHighEqualMultiplier(input.control, HIGH_EQUAL_MULTIPLIERS[input.arm]);
  const grid = summarizeCells(transformed.cells);
  const hybrid = blendOneXTwo(grid.oneXTwo, input.elo, DEFAULT_HYBRID_CONFIG.poissonBlendWeight);
  if (Math.abs(hybrid.home + hybrid.draw + hybrid.away - 1) > 1e-12) {
    throw new Error("Hybrid H+D+A must equal 1");
  }
  return {
    arm: input.arm,
    grid,
    oneXTwo: grid.oneXTwo,
    hybrid,
    directHighEqual: transformed.directHighEqual,
    indirectScale: transformed.indirectScale,
    changeFromControl: deltaAudit(grid, input.control),
  };
}

export function buildControlGrid(lambdaHome: number, lambdaAway: number): ScoreGridResult {
  return buildIndependentScoreGrid({ lambdaHome, lambdaAway });
}

export function assertM0MirrorsIndependent(input: {
  lambdaHome: number;
  lambdaAway: number;
}): void {
  const control = buildControlGrid(input.lambdaHome, input.lambdaAway);
  const replay = applyLocalMassArm({
    control,
    elo: { home: 1 / 3, draw: 1 / 3, away: 1 / 3 },
    arm: "M0",
  });
  if (Math.abs(replay.grid.draw - control.draw) > 1e-12) {
    throw new Error("M0 must reproduce independent Poisson draw");
  }
  if (Math.abs(replay.grid.p22 - control.p22) > 1e-12) {
    throw new Error("M0 must reproduce independent P(2-2)");
  }
}

export function highEqualFromEqual(equal: EqualScoreMasses): number {
  return equal["2-2"] + equal["3-3"] + equal["4-4"] + equal["5-5+"];
}

export function lowEqualFromEqual(equal: EqualScoreMasses): number {
  return equal["0-0"] + equal["1-1"];
}

export { isHighEqualCell, isLowEqualCell, isNonDrawCell };
