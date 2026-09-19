/**
 * 5B.15 forensic classifications. No ranking. No production correction.
 */

import type { SeasonTemporalReport } from "@/lib/debug/calibration/tr-5b15-evaluate";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";

export type TemporalRobustnessAttribution = {
  halfRobustness: ForensicAnswer;
  quarterRobustness: ForensicAnswer;
  leaveOneSeasonOut: ForensicAnswer;
  positiveResidualDependence: ForensicAnswer;
  lowEqualInstability: ForensicAnswer;
  structuralHighEqual: ForensicAnswer;
  productionCorrectionReady: ForensicAnswer;
};

function yesNoMixed(flags: readonly boolean[]): ForensicAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

function d1Seasons(reports: readonly SeasonTemporalReport[]): SeasonTemporalReport[] {
  return reports.filter((report) => report.panel === "D1");
}

function halfOe(report: SeasonTemporalReport, window: "H1" | "H2"): number | null {
  return report.halves[window].highEqual.oeRatio;
}

function lowOe(report: SeasonTemporalReport, window: "H1" | "H2"): number | null {
  return report.halves[window].lowEqual.oeRatio;
}

function range(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

export function classifyTemporalRobustness(input: {
  reports: readonly SeasonTemporalReport[];
  leaveOneOut: readonly { exceedsThreshold: boolean }[];
}): TemporalRobustnessAttribution {
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

  const d1 = d1Seasons(input.reports);
  const halfFlags = d1.flatMap((report) => [
    report.halves.H1.exceedsThreshold,
    report.halves.H2.exceedsThreshold,
  ]);
  const halfRobustness = yesNoMixed(halfFlags);

  const quartileFlags = d1.flatMap((report) =>
    (["Q1", "Q2", "Q3", "Q4"] as const).map((window) => report.quartiles[window].exceedsThreshold),
  );
  const quartileHits = quartileFlags.filter(Boolean).length;
  const quarterRobustness =
    quartileHits >= 8 ? "YES" : quartileHits <= 3 ? "NO" : "MIXED";

  const leaveOneSeasonOut = yesNoMixed(input.leaveOneOut.map((row) => row.exceedsThreshold));

  const halfPositive = d1.flatMap((report) => [
    report.halves.H1.residual.lo > 0,
    report.halves.H2.residual.lo > 0,
  ]);
  const quartilePositive = d1.flatMap((report) =>
    (["Q1", "Q2", "Q3", "Q4"] as const).map((window) => report.quartiles[window].residual.lo > 0),
  );
  const positiveHalfCount = halfPositive.filter(Boolean).length;
  const positiveQuartileCount = quartilePositive.filter(Boolean).length;
  const positiveResidualDependence =
    positiveHalfCount >= 2 || positiveQuartileCount >= 3 ? "YES" : "NO";

  const highOes = d1.flatMap((report) =>
    [halfOe(report, "H1"), halfOe(report, "H2")].filter((value): value is number => value != null),
  );
  const lowOes = d1.flatMap((report) =>
    [lowOe(report, "H1"), lowOe(report, "H2")].filter((value): value is number => value != null),
  );
  const lowCrosses =
    lowOes.some((value) => value < 0.9) && lowOes.some((value) => value > 1.1);
  const lowEqualInstability = range(lowOes) > range(highOes) && lowCrosses ? "YES" : "NO";

  const structuralHighEqual =
    halfRobustness === "YES" && leaveOneSeasonOut === "YES" && quarterRobustness === "YES"
      ? "YES"
      : halfRobustness === "NO" && leaveOneSeasonOut === "NO" && quarterRobustness === "NO"
        ? "NO"
        : "MIXED";

  return {
    halfRobustness,
    quarterRobustness,
    leaveOneSeasonOut,
    positiveResidualDependence,
    lowEqualInstability,
    structuralHighEqual,
    productionCorrectionReady: "NO",
  };
}
