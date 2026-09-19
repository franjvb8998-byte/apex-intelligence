/**
 * 5B.9 forensic classifications. No ranking. No production parameter.
 */

import type { SeasonLambdaGeometry } from "@/lib/debug/calibration/xg-5b9-evaluate";
import type { AnalyticGeometryRow } from "@/lib/debug/calibration/xg-5b9-geometry";
import type {
  CounterfactualSummary,
  GoalBaseSeasonReport,
} from "@/lib/debug/calibration/xg-5b9-counterfactual";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";
export type ClampCausalityAnswer = "CREATE" | "LIMIT" | "MIXED";

export type XgGeometryAttribution = {
  exponentialAmplification: "YES" | "NO";
  lambdaRatioCalibration: ForensicAnswer;
  drawCollapse: ForensicAnswer;
  clampCausality: ClampCausalityAnswer;
  baseGoalAsymmetry: ForensicAnswer;
  actualDrawContradiction: "YES" | "NO";
  structural: ForensicAnswer;
};

export type XgSeasonClassificationInput = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  geometry: SeasonLambdaGeometry;
  unclamped: { clamped: CounterfactualSummary; unclamped: CounterfactualSummary };
  goalBases: { G0: GoalBaseSeasonReport; G1: GoalBaseSeasonReport };
};

function yesNoMixed(flags: readonly boolean[]): ForensicAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

export function classifyXgGeometry(input: {
  seasons: readonly XgSeasonClassificationInput[];
  analytic: readonly AnalyticGeometryRow[];
}): XgGeometryAttribution {
  for (const season of input.seasons) {
    if (
      (DRAW_FORENSICS_HOLDOUT_SEASONS as readonly string[]).includes(season.season) &&
      season.role !== "HOLDOUT"
    ) {
      throw new Error(`${season.season} must remain HOLDOUT`);
    }
    if (season.season === DRAW_FORENSICS_DEVELOPMENT_SEASON && season.role !== "DEVELOPMENT") {
      throw new Error("PL 2024 must remain DEVELOPMENT");
    }
  }

  const zero = input.analytic.find((row) => row.rawEloDiff === 0);
  const plus400 = input.analytic.find((row) => row.rawEloDiff === 400);
  const exponentialAmplification =
    zero != null &&
    plus400 != null &&
    plus400.lambdaRatioClamped > zero.lambdaRatioClamped * 2
      ? "YES"
      : "NO";

  const ratioCalibration = input.seasons.map((season) => {
    const balanced = season.geometry.ratioBuckets.find((row) => row.bucket === "1.00-1.49");
    const high = season.geometry.ratioBuckets.find(
      (row) => row.bucket === "5.00-7.99" || row.bucket === "8.00-11.99" || row.bucket === "12.00+",
    );
    const highPopulated = [...season.geometry.ratioBuckets]
      .reverse()
      .find((row) => row.n > 0 && row.bucket !== "1.00-1.49" && row.bucket !== "1.50-1.99");
    const compare = (high?.n ?? 0) > 0 ? high : highPopulated;
    if (!balanced || !compare || balanced.n === 0 || compare.n === 0) return false;
    return (
      Math.abs(compare.drawBias) > Math.abs(balanced.drawBias) + 0.02 ||
      compare.logLoss > balanced.logLoss + 0.05
    );
  });

  const collapse = input.seasons.map((season) => {
    const populated = season.geometry.ratioBuckets.filter((row) => row.n > 0);
    if (populated.length < 2) return false;
    return populated[populated.length - 1]!.poisson.draw < populated[0]!.poisson.draw - 0.05;
  });

  const clampFlags = input.seasons.map((season) => {
    const clamped = season.unclamped.clamped;
    const unclamped = season.unclamped.unclamped;
    if (!clamped.valid || !unclamped.valid) return "MIXED" as const;
    const moreExtreme =
      (unclamped.maxLambda ?? 0) > (clamped.maxLambda ?? 0) &&
      (unclamped.meanLambdaRatio ?? 0) >= (clamped.meanLambdaRatio ?? 0) - 1e-12 &&
      (unclamped.poissonDraw ?? 1) <= (clamped.poissonDraw ?? 0) + 1e-12;
    return moreExtreme ? ("LIMIT" as const) : ("CREATE" as const);
  });
  const clampCausality: ClampCausalityAnswer = clampFlags.every((flag) => flag === "LIMIT")
    ? "LIMIT"
    : clampFlags.every((flag) => flag === "CREATE")
      ? "CREATE"
      : "MIXED";

  const baseGoal = input.seasons.map((season) => {
    const g0 = season.goalBases.G0.summary;
    const g1 = season.goalBases.G1.summary;
    if (!g0.valid || !g1.valid) return false;
    return (
      (g0.meanLambdaRatio ?? 0) > (g1.meanLambdaRatio ?? 0) + 0.05 ||
      (g0.clampCount ?? 0) > (g1.clampCount ?? 0)
    );
  });

  const contradiction = input.seasons.map(
    (season) => season.geometry.actualDraws.drawsHybridLt10 >= 5,
  );

  const structuralFlags = [
    exponentialAmplification === "YES",
    collapse.some(Boolean),
    contradiction.some(Boolean),
  ];

  return {
    exponentialAmplification,
    lambdaRatioCalibration: yesNoMixed(ratioCalibration),
    drawCollapse: yesNoMixed(collapse),
    clampCausality,
    baseGoalAsymmetry: yesNoMixed(baseGoal),
    actualDrawContradiction: contradiction.some(Boolean) ? "YES" : "NO",
    structural: structuralFlags.filter(Boolean).length >= 2 ? "YES" : yesNoMixed(structuralFlags),
  };
}
