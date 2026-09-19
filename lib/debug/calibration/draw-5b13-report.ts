/**
 * 5B.13 forensic classifications. No ranking. No production draw model.
 */

import type { PanelSeasonDrawReport } from "@/lib/debug/calibration/draw-5b13-evaluate";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";

export type DrawChannelAttribution = {
  eloDrawDeficit: ForensicAnswer;
  poissonDrawDeficit: ForensicAnswer;
  lowScoreDependence: ForensicAnswer;
  higherDrawResidual: ForensicAnswer;
  drawBaseSufficiency: ForensicAnswer;
  blendCausality: ForensicAnswer;
  haContribution: ForensicAnswer;
  residual2025OneComponent: ForensicAnswer;
  drawModelStructural: ForensicAnswer;
};

function yesNoMixed(flags: readonly boolean[]): ForensicAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

function holdoutsOf(
  reports: readonly PanelSeasonDrawReport[],
  panel: "D0" | "D1",
): PanelSeasonDrawReport[] {
  return reports.filter(
    (report) =>
      report.panel === panel &&
      (DRAW_FORENSICS_HOLDOUT_SEASONS as readonly string[]).includes(report.season),
  );
}

function diagnostic(report: PanelSeasonDrawReport, id: string) {
  return report.diagnostics.find((row) => row.id === id) ?? null;
}

function higherDrawObserved(report: PanelSeasonDrawReport): { obs: number; exp: number } {
  const higher = report.scorelines.filter((row) => row.key === "2-2" || row.key === "3-3" || row.key === "4-4+");
  return {
    obs: higher.reduce((sum, row) => sum + row.observedCount, 0),
    exp: higher.reduce((sum, row) => sum + row.expectedCount, 0),
  };
}

export function classifyDrawChannelResidual(input: {
  reports: readonly PanelSeasonDrawReport[];
}): DrawChannelAttribution {
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

  const eloDrawDeficit = [...d0Hold, ...d1Hold].map(
    (report) => report.decomposition.meanEloDraw < report.decomposition.observedDraw - 0.02,
  );

  const poissonDrawDeficit = [...d0Hold, ...d1Hold].map(
    (report) => report.decomposition.meanPoissonDraw < report.decomposition.observedDraw - 0.02,
  );

  const lowScoreDependence = d0Hold.map((report) => {
    const m05 = diagnostic(report, "dc:-0.05");
    const m10 = diagnostic(report, "dc:-0.1");
    const lift = Math.max(
      (m05?.meanHybridDraw ?? 0) - report.decomposition.meanHybridDraw,
      (m10?.meanHybridDraw ?? 0) - report.decomposition.meanHybridDraw,
    );
    return lift > 0.005;
  });

  const higherDrawResidual = d0Hold.map((report) => {
    const { obs, exp } = higherDrawObserved(report);
    return exp > 0 && obs > exp * 1.1;
  });

  const drawBaseSufficiency = d0Hold.map((report) => {
    const plus = diagnostic(report, "drawBase:+0.03");
    return plus != null && Math.abs(plus.metrics.drawBias) < 0.015;
  });

  const blendCausality = d0Hold.map((report) => {
    const b05 = diagnostic(report, "blend:0.5");
    const b09 = diagnostic(report, "blend:0.9");
    if (!b05 || !b09) return false;
    const prod = report.production.drawBias;
    return Math.abs(prod) > Math.abs(b05.metrics.drawBias) + 0.005 || Math.abs(prod) > Math.abs(b09.metrics.drawBias) + 0.005;
  });

  const haContribution = d0Hold.map((report) => {
    const ha0 = diagnostic(report, "ha:0");
    if (!ha0) return false;
    return (
      ha0.meanEloDraw > report.decomposition.meanEloDraw + 0.005 ||
      ha0.metrics.homeBias < report.production.homeBias - 0.01
    );
  });

  const y2025 = input.reports.filter((report) => report.season === "2025");
  const residual2025OneComponent = y2025.map((report) => {
    const deficit = Math.abs(report.decomposition.meanHybridDraw - report.decomposition.observedDraw);
    if (deficit < 0.02) return false;
    const effects = report.diagnostics.map((row) =>
      Math.abs(row.meanHybridDraw - report.decomposition.observedDraw),
    );
    const closed = effects.filter((value) => value < deficit * 0.4).length;
    return closed === 1;
  });

  const drawModelStructural = d1Hold.map((report) => {
    const d1Deficit = report.decomposition.meanHybridDraw < report.decomposition.observedDraw - 0.03;
    const channelDeficit =
      report.decomposition.meanEloDraw < report.decomposition.observedDraw - 0.02 ||
      report.decomposition.meanPoissonDraw < report.decomposition.observedDraw - 0.02;
    return d1Deficit && channelDeficit;
  });

  return {
    eloDrawDeficit: yesNoMixed(eloDrawDeficit),
    poissonDrawDeficit: yesNoMixed(poissonDrawDeficit),
    lowScoreDependence: yesNoMixed(lowScoreDependence),
    higherDrawResidual: yesNoMixed(higherDrawResidual),
    drawBaseSufficiency: yesNoMixed(drawBaseSufficiency),
    blendCausality: yesNoMixed(blendCausality),
    haContribution: yesNoMixed(haContribution),
    residual2025OneComponent: yesNoMixed(residual2025OneComponent),
    drawModelStructural: yesNoMixed(drawModelStructural),
  };
}
