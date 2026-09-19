/**
 * 5B.12 forensic classifications. No ranking. No production S.
 */

import type { PanelSeasonReport } from "@/lib/debug/calibration/xg-5b12-evaluate";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";

export type GeometryAttribution = {
  sensitivity: ForensicAnswer;
  drawRecovery: ForensicAnswer;
  properScores: ForensicAnswer;
  calibration: ForensicAnswer;
  capEffect: ForensicAnswer;
  cleanInputResidual: ForensicAnswer;
  geometryContribution: ForensicAnswer;
  inputVsTransform: ForensicAnswer;
  drawModelResidual: ForensicAnswer;
};

function yesNoMixed(flags: readonly boolean[]): ForensicAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

function holdoutsOf(
  reports: readonly PanelSeasonReport[],
  panel: "P0" | "P7",
): PanelSeasonReport[] {
  return reports.filter(
    (report) =>
      report.panel === panel &&
      (DRAW_FORENSICS_HOLDOUT_SEASONS as readonly string[]).includes(report.season),
  );
}

export function classifyXgGeometryCounterfactual(input: {
  reports: readonly PanelSeasonReport[];
}): GeometryAttribution {
  for (const report of input.reports) {
    if (
      (DRAW_FORENSICS_HOLDOUT_SEASONS as readonly string[]).includes(report.season) &&
      report.role !== "HOLDOUT"
    ) {
      throw new Error(`${report.season} must remain HOLDOUT`);
    }
    if (report.season === DRAW_FORENSICS_DEVELOPMENT_SEASON && report.role !== "DEVELOPMENT") {
      throw new Error("PL 2024 must remain DEVELOPMENT");
    }
  }

  const p0Hold = holdoutsOf(input.reports, "P0");
  const p7Hold = holdoutsOf(input.reports, "P7");
  const development = input.reports.filter((report) => report.season === "2024");

  const sensitivity = [...p0Hold, ...p7Hold].map((report) => {
    const g0 = report.arms.G0.all;
    const g3 = report.arms.G3.all;
    return g3.p90LambdaRatio < g0.p90LambdaRatio && g3.countMaxGe90 <= g0.countMaxGe90;
  });

  const drawRecovery = p0Hold.map((report) => {
    const g0 = report.arms.G0.all;
    return (
      report.arms.G1.all.meanHybridDraw > g0.meanHybridDraw &&
      report.arms.G2.all.meanHybridDraw > report.arms.G1.all.meanHybridDraw &&
      report.arms.G3.all.meanHybridDraw > report.arms.G2.all.meanHybridDraw
    );
  });

  const proper = p0Hold.map((report) => {
    const dev = development.find((row) => row.panel === "P0");
    if (!dev) return false;
    const arms = ["G1", "G2", "G3"] as const;
    return arms.every((armId) => {
      const devDown = dev.arms[armId].all.logLoss < dev.arms.G0.all.logLoss;
      const holdDown = report.arms[armId].all.logLoss < report.arms.G0.all.logLoss;
      const devBrier = dev.arms[armId].all.brier < dev.arms.G0.all.brier;
      const holdBrier = report.arms[armId].all.brier < report.arms.G0.all.brier;
      return devDown === holdDown && devBrier === holdBrier;
    });
  });

  const calibration = p0Hold.map((report) => {
    const dev = development.find((row) => row.panel === "P0");
    if (!dev) return false;
    const arms = ["G1", "G2", "G3"] as const;
    return arms.every((armId) => {
      const devEce = dev.arms[armId].all.ece < dev.arms.G0.all.ece;
      const holdEce = report.arms[armId].all.ece < report.arms.G0.all.ece;
      const devDraw = Math.abs(dev.arms[armId].all.drawBias) < Math.abs(dev.arms.G0.all.drawBias);
      const holdDraw = Math.abs(report.arms[armId].all.drawBias) < Math.abs(report.arms.G0.all.drawBias);
      return devEce === holdEce && devDraw === holdDraw;
    });
  });

  const capEffect = p0Hold.map((report) => {
    const high0 = report.arms.G0.gapBuckets.filter(
      (row) => row.bucket === "200-249" || row.bucket === "250-299" || row.bucket === "300+",
    );
    const high4 = report.arms.G4.gapBuckets.filter(
      (row) => row.bucket === "200-249" || row.bucket === "250-299" || row.bucket === "300+",
    );
    const g0HighLr = high0.reduce((sum, row) => sum + row.meanLambdaRatio * row.n, 0);
    const g4HighLr = high4.reduce((sum, row) => sum + row.meanLambdaRatio * row.n, 0);
    const g0HighN = high0.reduce((sum, row) => sum + row.n, 0);
    return (
      report.arms.G4.all.countMaxGe90 < report.arms.G0.all.countMaxGe90 &&
      (g0HighN === 0 || g4HighLr < g0HighLr)
    );
  });

  const cleanResidual = p7Hold.map((report) => {
    const g0 = report.arms.G0.all;
    return (
      g0.countMaxGe90 > 0 ||
      g0.homeBias > 0.03 ||
      g0.drawBias < -0.03 ||
      g0.meanLambdaRatio > 2
    );
  });

  const geometryContribution = [...p0Hold, ...p7Hold].map((report) => {
    const g0 = report.arms.G0.all;
    const g3 = report.arms.G3.all;
    return (
      Math.abs(g3.meanLambdaRatio - g0.meanLambdaRatio) > 0.2 ||
      g3.countMaxGe90 !== g0.countMaxGe90 ||
      Math.abs(g3.meanHybridDraw - g0.meanHybridDraw) > 0.005
    );
  });

  const inputVsTransform = p0Hold.map((p0) => {
    const p7 = p7Hold.find((row) => row.season === p0.season);
    if (!p7) return false;
    const inputDiff = Math.abs(p0.arms.G0.all.meanLambdaRatio - p7.arms.G0.all.meanLambdaRatio) > 0.3;
    const transformDiff = Math.abs(p0.arms.G0.all.meanLambdaRatio - p0.arms.G3.all.meanLambdaRatio) > 0.2;
    return inputDiff && transformDiff;
  });

  const drawResidual = [...p0Hold, ...p7Hold].map((report) => {
    const g3 = report.arms.G3.all;
    const g5 = report.arms.G5.all;
    return g3.drawBias < -0.03 && g5.drawBias < -0.03;
  });

  return {
    sensitivity: yesNoMixed(sensitivity),
    drawRecovery: yesNoMixed(drawRecovery),
    properScores: yesNoMixed(proper),
    calibration: yesNoMixed(calibration),
    capEffect: yesNoMixed(capEffect),
    cleanInputResidual: yesNoMixed(cleanResidual),
    geometryContribution: yesNoMixed(geometryContribution),
    inputVsTransform: yesNoMixed(inputVsTransform),
    drawModelResidual: yesNoMixed(drawResidual),
  };
}
