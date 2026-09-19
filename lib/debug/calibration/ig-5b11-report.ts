/**
 * 5B.11 forensic classifications. No ranking. No production parameter.
 */

import type { SeasonInputGeometryReport } from "@/lib/debug/calibration/ig-5b11-evaluate";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";

export type InputGeometryAttribution = {
  rolePriorEffect: ForensicAnswer;
  shrinkageEarly: ForensicAnswer;
  shrinkageMature: ForensicAnswer;
  gdAccumulation: ForensicAnswer;
  drawRecovery: ForensicAnswer;
  properScores: ForensicAnswer;
  calibration: ForensicAnswer;
  inputOnlySufficiency: ForensicAnswer;
  needEloXgExperiment: ForensicAnswer;
};

export type InputGeometryClassificationInput = {
  seasons: readonly SeasonInputGeometryReport[];
};

function yesNoMixed(flags: readonly boolean[]): ForensicAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

function holdouts(input: InputGeometryClassificationInput): SeasonInputGeometryReport[] {
  return input.seasons.filter((season) =>
    (DRAW_FORENSICS_HOLDOUT_SEASONS as readonly string[]).includes(season.season),
  );
}

export function classifyInputGeometry(
  input: InputGeometryClassificationInput,
): InputGeometryAttribution {
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
  const held = holdouts(input);
  const development = input.seasons.find(
    (season) => season.season === DRAW_FORENSICS_DEVELOPMENT_SEASON,
  );

  const rolePrior = held.map((season) => {
    const c0 = season.arms.C0.all;
    const c1 = season.arms.C1.all;
    return c1.meanAbsGap < c0.meanAbsGap && Math.abs(c1.homeBias) < Math.abs(c0.homeBias);
  });

  const shrinkageEarly = held.map((season) => {
    const early0 = season.arms.C0.byEvidence["1-3"];
    const early2 = season.arms.C2.byEvidence["1-3"];
    const mid0 = season.arms.C0.byEvidence["4-9"];
    const mid2 = season.arms.C2.byEvidence["4-9"];
    const early =
      early2.countGe200 < early0.countGe200 ||
      early2.countMaxGe90 < early0.countMaxGe90 ||
      early2.meanAbsGap + 10 < early0.meanAbsGap;
    const mid =
      mid2.countGe200 < mid0.countGe200 ||
      mid2.countMaxGe90 < mid0.countMaxGe90 ||
      mid2.meanAbsGap + 10 < mid0.meanAbsGap;
    return early && mid;
  });

  const shrinkageMature = held.map((season) => season.arms.C2.byEvidence["10+"].countGe200 > 0);

  const gdAccumulation = held.map((season) => {
    const mature0 = season.arms.C0.byEvidence["10+"];
    const mature4 = season.arms.C4.byEvidence["10+"];
    return (
      mature4.countGe200 < mature0.countGe200 &&
      mature4.p90LambdaRatio < mature0.p90LambdaRatio
    );
  });

  const drawRecovery = held.map((season) => {
    const c0 = season.arms.C0.all;
    const recovered = (["C1", "C2", "C3", "C4", "C7"] as const).some(
      (armId) => season.arms[armId].all.meanHybridDraw >= c0.meanHybridDraw + 0.01,
    );
    const stillCollapsed = (["C1", "C2", "C3", "C4", "C7"] as const).every(
      (armId) => season.arms[armId].all.meanHybridDraw < c0.observedDraw - 0.04,
    );
    return recovered && !stillCollapsed;
  });

  const properHoldout = held.map((season) => {
    if (!development) return false;
    const d0 = development.arms.C0.all;
    const arms = ["C1", "C2", "C4"] as const;
    return arms.every((armId) => {
      const devDown = development.arms[armId].all.logLoss < d0.logLoss;
      const holdDown = season.arms[armId].all.logLoss < season.arms.C0.all.logLoss;
      const devBrierDown = development.arms[armId].all.brier < d0.brier;
      const holdBrierDown = season.arms[armId].all.brier < season.arms.C0.all.brier;
      return devDown === holdDown && devBrierDown === holdBrierDown;
    });
  });

  const calibrationHoldout = held.map((season) => {
    if (!development) return false;
    const d0 = development.arms.C0.all;
    const arms = ["C1", "C2", "C4"] as const;
    return arms.every((armId) => {
      const devEce = development.arms[armId].all.ece < d0.ece;
      const holdEce = season.arms[armId].all.ece < season.arms.C0.all.ece;
      const devDraw = Math.abs(development.arms[armId].all.drawBias) < Math.abs(d0.drawBias);
      const holdDraw =
        Math.abs(season.arms[armId].all.drawBias) < Math.abs(season.arms.C0.all.drawBias);
      return devEce === holdEce && devDraw === holdDraw;
    });
  });

  const sufficiency = held.map((season) => {
    const c7 = season.arms.C7.all;
    const c0 = season.arms.C0.all;
    return c7.countMaxGe95 === 0 && c7.meanHybridDraw >= c0.observedDraw - 0.03;
  });

  const needXg = held.map((season) => {
    const c7 = season.arms.C7.all;
    return c7.countMaxGe90 > 0 || c7.meanHybridDraw < c7.observedDraw - 0.04;
  });

  return {
    rolePriorEffect: yesNoMixed(rolePrior),
    shrinkageEarly: yesNoMixed(shrinkageEarly),
    shrinkageMature: shrinkageMature.every(Boolean) ? "YES" : shrinkageMature.some(Boolean) ? "MIXED" : "NO",
    gdAccumulation: yesNoMixed(gdAccumulation),
    drawRecovery: yesNoMixed(drawRecovery),
    properScores: yesNoMixed(properHoldout),
    calibration: yesNoMixed(calibrationHoldout),
    inputOnlySufficiency: yesNoMixed(sufficiency),
    needEloXgExperiment: needXg.every(Boolean) ? "YES" : needXg.some(Boolean) ? "MIXED" : "NO",
  };
}
