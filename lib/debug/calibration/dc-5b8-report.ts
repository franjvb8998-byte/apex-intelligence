/**
 * 5B.8 forensic classifications. No ranking. No production rho.
 */

import type { SeasonPoissonForensics } from "@/lib/debug/calibration/dc-5b8-evaluate";
import type { DixonColesSensitivityCell } from "@/lib/debug/calibration/dc-5b8-sensitivity";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";

export type DcComponentAttribution = {
  lowScoreDependence: ForensicAnswer;
  dixonColesLeverage: ForensicAnswer;
  largeGapResidual: ForensicAnswer;
  xgClamp: ForensicAnswer;
  truncation: "YES" | "NO";
  structural: ForensicAnswer;
};

export type DcSeasonClassificationInput = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  v0: SeasonPoissonForensics;
  sensitivityV0: readonly DixonColesSensitivityCell[];
};

function yesNoMixed(flags: readonly boolean[]): ForensicAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

export function classifyDcForensics(input: {
  seasons: readonly DcSeasonClassificationInput[];
}): DcComponentAttribution {
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

  const lowScore = input.seasons.map((season) => season.v0.lowScore.residual > 0);
  const leverage = input.seasons.map((season) => {
    const rho0 = season.sensitivityV0.find((cell) => cell.rho === 0);
    if (!rho0?.valid || rho0.drawBias == null) return false;
    const baselineDrawBias = rho0.drawBias;
    return season.sensitivityV0.some((cell) => {
      if (!cell.valid || cell.drawBias == null) return false;
      return Math.abs(cell.drawBias - baselineDrawBias) >= 0.01;
    });
  });
  const largeGap = input.seasons.map((season) => {
    const valid = season.sensitivityV0.filter(
      (cell) => cell.valid && cell.largeXgDiffDrawBias != null,
    );
    if (valid.length === 0) return true;
    return valid.every((cell) => (cell.largeXgDiffDrawBias ?? 0) < -0.05);
  });
  const clamp = input.seasons.map((season) => {
    if (season.v0.clamp.clamp.n === 0 || season.v0.clamp.nonClamp.n === 0) return false;
    return season.v0.clamp.clamp.drawBias < season.v0.clamp.nonClamp.drawBias - 0.02;
  });
  const truncationMaterial = input.seasons.some(
    (season) => season.v0.truncation.meanCoveredMass < 0.99 || season.v0.truncation.maxLostMass > 0.02,
  );
  const structuralFlags = [
    lowScore.every(Boolean),
    leverage.some(Boolean),
    largeGap.some(Boolean) || clamp.some(Boolean),
  ];

  return {
    lowScoreDependence: yesNoMixed(lowScore),
    dixonColesLeverage: yesNoMixed(leverage),
    largeGapResidual: yesNoMixed(largeGap),
    xgClamp: yesNoMixed(clamp),
    truncation: truncationMaterial ? "YES" : "NO",
    structural: structuralFlags.filter(Boolean).length >= 2 ? "YES" : yesNoMixed(structuralFlags),
  };
}
