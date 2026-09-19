/**
 * 5B.14 forensic classifications. No ranking. No production λ3.
 */

import type { HsPanelSeasonReport } from "@/lib/debug/calibration/hs-5b14-evaluate";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";

export type HigherScoreAttribution = {
  highEqualExcess: ForensicAnswer;
  lowEqualCalibration: ForensicAnswer;
  residualGoalDependence: ForensicAnswer;
  year2025HighEqual: ForensicAnswer;
  bivariateDirection: ForensicAnswer;
  bivariateSufficiency: ForensicAnswer;
  seasonInstability: ForensicAnswer;
  needProspectiveValidation: ForensicAnswer;
};

function yesNoMixed(flags: readonly boolean[]): ForensicAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

function holdoutsOf(
  reports: readonly HsPanelSeasonReport[],
  panel: "D0" | "D1",
): HsPanelSeasonReport[] {
  return reports.filter(
    (report) =>
      report.panel === panel &&
      (DRAW_FORENSICS_HOLDOUT_SEASONS as readonly string[]).includes(report.season),
  );
}

function oeOf(report: HsPanelSeasonReport, key: string): number | null {
  return report.exactScoreOe.find((row) => row.key === key)?.oeRatio ?? null;
}

export function classifyHigherScoreDraw(input: {
  reports: readonly HsPanelSeasonReport[];
}): HigherScoreAttribution {
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

  const d0Hold = holdoutsOf(input.reports, "D0");
  const d1Hold = holdoutsOf(input.reports, "D1");

  const highEqualExcess = [...d0Hold, ...d1Hold].map((report) => {
    const oe = report.lowHighEqual.high.oeRatio;
    return oe != null && oe > 1.1;
  });

  const lowEqualCalibration = d1Hold.map((report) => {
    const zero = oeOf(report, "0-0");
    const one = oeOf(report, "1-1");
    const inBand = (value: number | null) => value != null && value >= 0.7 && value <= 1.3;
    return inBand(zero) && inBand(one);
  });

  const residualGoalDependence = [...d0Hold, ...d1Hold].map(
    (report) => report.correlation.residualBootstrap.lo > 0,
  );

  const year2025HighEqual = d1Hold
    .filter((report) => report.season === "2025")
    .map((y2025) => {
      const y2023 = d1Hold.find((report) => report.season === "2023");
      if (!y2023) return false;
      const highDiff = y2025.lowHighEqual.high.observedCount - y2023.lowHighEqual.high.observedCount;
      const drawDiff =
        (y2025.residualDecomposition.find((row) => row.part === "TOTAL")?.observedCount ?? 0) -
        (y2023.residualDecomposition.find((row) => row.part === "TOTAL")?.observedCount ?? 0);
      return drawDiff > 0 && highDiff / y2025.n > 0.015;
    });

  const bivariateDirection = [...d0Hold, ...d1Hold].map((report) => {
    const zero = report.lambda3.find((row) => row.lambda3 === 0);
    const high = report.lambda3.find((row) => row.lambda3 === 0.2);
    if (!zero || !high) return false;
    return high.meanP22 > zero.meanP22 && high.meanDraw > zero.meanDraw;
  });

  const bivariateSufficiency = d1Hold.map((report) =>
    report.lambda3.some((row) => {
      const highOe = report.lowHighEqual.high.oeRatio;
      return Math.abs(row.drawBias) < 0.015 && highOe != null && highOe >= 0.85 && highOe <= 1.15;
    }),
  );

  const seasonInstability = d1Hold
    .filter((report) => report.season === "2025")
    .map((y2025) => {
      const y2023 = d1Hold.find((report) => report.season === "2023");
      if (!y2023) return false;
      const draw2025 =
        (y2025.residualDecomposition.find((row) => row.part === "TOTAL")?.observedCount ?? 0) / y2025.n;
      const draw2023 =
        (y2023.residualDecomposition.find((row) => row.part === "TOTAL")?.observedCount ?? 0) / y2023.n;
      const zeroDiff = Math.abs(
        (y2025.exactScoreOe.find((row) => row.key === "0-0")?.observedCount ?? 0) / y2025.n -
          (y2023.exactScoreOe.find((row) => row.key === "0-0")?.observedCount ?? 0) / y2023.n,
      );
      return Math.abs(draw2025 - draw2023) > 0.04 || zeroDiff > 0.02;
    });

  const season = yesNoMixed(seasonInstability);

  return {
    highEqualExcess: yesNoMixed(highEqualExcess),
    lowEqualCalibration: yesNoMixed(lowEqualCalibration),
    residualGoalDependence: yesNoMixed(residualGoalDependence),
    year2025HighEqual: yesNoMixed(year2025HighEqual),
    bivariateDirection: yesNoMixed(bivariateDirection),
    bivariateSufficiency: yesNoMixed(bivariateSufficiency),
    seasonInstability: season,
    needProspectiveValidation: season === "YES" ? "YES" : season,
  };
}
