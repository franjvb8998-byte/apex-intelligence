/**
 * Empirical D0/D1 HIGH_EQUAL temporal evaluation. Frozen production G0. Not a tuner.
 */

import {
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { snapshotHsPanel, type HsMatchTrace, type NumericFailure } from "@/lib/debug/calibration/hs-5b14-evaluate";
import { HS_D1_NON_CANDIDATE_LABEL } from "@/lib/debug/calibration/hs-5b14-shape";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import {
  bootstrapHighEqual,
  bootstrapResidual,
  fourPlusExpected,
  highEqualExpected,
  isFourPlusEqual,
  isHighEqualTrace,
  isLowEqualTrace,
  isThreeThree,
  isTwoTwo,
  lowEqualExpected,
  threeThreeExpected,
  twoTwoExpected,
  type BootstrapPair,
  type IntervalEstimate,
} from "@/lib/debug/calibration/tr-5b15-formula";
import {
  HALF_SIZE,
  HALF_WINDOWS,
  HIGH_EQUAL_OE_THRESHOLD,
  QUARTILE_SIZE,
  QUARTILE_WINDOWS,
  SEASON_N,
  requireSeasonLength,
  sortChronological,
  splitHalves,
  splitQuartiles,
  type HalfWindow,
  type QuartileWindow,
  type TemporalWindow,
  type TrPanelId,
} from "@/lib/debug/calibration/tr-5b15-shape";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

export type CountRow = {
  key: string;
  observedCount: number;
  expectedCount: number;
  oeRatio: number | null;
  observedRate: number;
  expectedRate: number;
  difference: number;
};

export type DrawComposition = {
  nDraws: number;
  drawRate: number;
  share00: number;
  share11: number;
  share22: number;
  share33plus: number;
};

export type ResidualBlock = IntervalEstimate & {
  seed: number;
  resamples: number;
};

export type TemporalWindowReport = {
  panel: TrPanelId;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  window: TemporalWindow;
  n: number;
  highEqual: CountRow;
  twoTwo: CountRow;
  threeThree: CountRow;
  fourPlus: CountRow;
  lowEqual: CountRow;
  composition: DrawComposition;
  residual: ResidualBlock;
  highEqualBootstrap: BootstrapPair;
  exceedsThreshold: boolean;
};

export type SeasonTemporalReport = {
  panel: TrPanelId;
  panelLabel: string;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  n: number;
  failures: NumericFailure[];
  halves: Record<HalfWindow, TemporalWindowReport>;
  quartiles: Record<QuartileWindow, TemporalWindowReport>;
};

function oe(observed: number, expected: number): number | null {
  if (!(expected > 0)) return null;
  return observed / expected;
}

function countRow(
  key: string,
  traces: readonly HsMatchTrace[],
  observed: number,
  expected: number,
): CountRow {
  const n = traces.length;
  const observedRate = n === 0 ? 0 : observed / n;
  const expectedRate = n === 0 ? 0 : expected / n;
  return {
    key,
    observedCount: observed,
    expectedCount: expected,
    oeRatio: oe(observed, expected),
    observedRate,
    expectedRate,
    difference: observedRate - expectedRate,
  };
}

function composition(traces: readonly HsMatchTrace[]): DrawComposition {
  const draws = traces.filter((trace) => trace.actualHomeGoals === trace.actualAwayGoals);
  const nDraws = draws.length;
  const share = (pred: (trace: HsMatchTrace) => boolean) =>
    nDraws === 0 ? 0 : draws.filter(pred).length / nDraws;
  return {
    nDraws,
    drawRate: traces.length === 0 ? 0 : nDraws / traces.length,
    share00: share((trace) => trace.actualHomeGoals === 0),
    share11: share((trace) => trace.actualHomeGoals === 1),
    share22: share((trace) => trace.actualHomeGoals === 2),
    share33plus: share((trace) => trace.actualHomeGoals >= 3),
  };
}

export function evaluateTemporalWindow(input: {
  traces: readonly HsMatchTrace[];
  panel: TrPanelId;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  window: TemporalWindow;
}): TemporalWindowReport {
  const traces = input.traces;
  const highObs = traces.filter(isHighEqualTrace).length;
  const highExp = traces.reduce((sum, trace) => sum + highEqualExpected(trace), 0);
  const highEqual = countRow("HIGH_EQUAL", traces, highObs, highExp);
  return {
    panel: input.panel,
    season: input.season,
    role: input.role,
    window: input.window,
    n: traces.length,
    highEqual,
    twoTwo: countRow(
      "2-2",
      traces,
      traces.filter(isTwoTwo).length,
      traces.reduce((sum, trace) => sum + twoTwoExpected(trace), 0),
    ),
    threeThree: countRow(
      "3-3",
      traces,
      traces.filter(isThreeThree).length,
      traces.reduce((sum, trace) => sum + threeThreeExpected(trace), 0),
    ),
    fourPlus: countRow(
      "4-4+",
      traces,
      traces.filter(isFourPlusEqual).length,
      traces.reduce((sum, trace) => sum + fourPlusExpected(trace), 0),
    ),
    lowEqual: countRow(
      "LOW_EQUAL",
      traces,
      traces.filter(isLowEqualTrace).length,
      traces.reduce((sum, trace) => sum + lowEqualExpected(trace), 0),
    ),
    composition: composition(traces),
    residual: bootstrapResidual({ traces }),
    highEqualBootstrap: bootstrapHighEqual({ traces }),
    exceedsThreshold: highEqual.oeRatio != null && highEqual.oeRatio > HIGH_EQUAL_OE_THRESHOLD,
  };
}

export function evaluateSeasonTemporal(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  panel: TrPanelId;
}): SeasonTemporalReport {
  const before = snapshotDefaultHybridConfig();
  requireSeasonLength(input.rows.length, `${input.season} ${input.panel}`);
  if (input.season === "2024" && input.role !== "DEVELOPMENT") {
    throw new Error("PL 2024 must remain DEVELOPMENT");
  }
  if (input.season !== "2024" && input.role !== "HOLDOUT") {
    throw new Error(`${input.season} must remain HOLDOUT`);
  }
  const snap = snapshotHsPanel({
    rows: input.rows,
    season: input.season,
    role: input.role,
    panel: input.panel,
  });
  const sorted = sortChronological(snap.traces);
  if (sorted.length !== SEASON_N) {
    throw new Error(`${input.season} ${input.panel} traces ${sorted.length} !== ${SEASON_N}`);
  }
  const halves = splitHalves(sorted);
  const quartiles = splitQuartiles(sorted);
  if (halves.H1.length !== HALF_SIZE || halves.H2.length !== HALF_SIZE) {
    throw new Error("Halves must be exactly 190/190");
  }
  for (const window of QUARTILE_WINDOWS) {
    if (quartiles[window].length !== QUARTILE_SIZE) {
      throw new Error(`Quartile ${window} must be exactly ${QUARTILE_SIZE}`);
    }
  }
  const report: SeasonTemporalReport = {
    panel: input.panel,
    panelLabel: input.panel === "D1" ? HS_D1_NON_CANDIDATE_LABEL : "PRODUCTION_CHAIN_C0_G0",
    season: input.season,
    role: input.role,
    n: SEASON_N,
    failures: snap.failures,
    halves: {
      H1: evaluateTemporalWindow({
        traces: halves.H1,
        panel: input.panel,
        season: input.season,
        role: input.role,
        window: "H1",
      }),
      H2: evaluateTemporalWindow({
        traces: halves.H2,
        panel: input.panel,
        season: input.season,
        role: input.role,
        window: "H2",
      }),
    },
    quartiles: {
      Q1: evaluateTemporalWindow({
        traces: quartiles.Q1,
        panel: input.panel,
        season: input.season,
        role: input.role,
        window: "Q1",
      }),
      Q2: evaluateTemporalWindow({
        traces: quartiles.Q2,
        panel: input.panel,
        season: input.season,
        role: input.role,
        window: "Q2",
      }),
      Q3: evaluateTemporalWindow({
        traces: quartiles.Q3,
        panel: input.panel,
        season: input.season,
        role: input.role,
        window: "Q3",
      }),
      Q4: evaluateTemporalWindow({
        traces: quartiles.Q4,
        panel: input.panel,
        season: input.season,
        role: input.role,
        window: "Q4",
      }),
    },
  };
  assertProductionHybridConfigUnchanged(before);
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== 400) throw new Error("Production eloGoalScale mutated");
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== 0.28) throw new Error("Production eloDrawBase mutated");
  if (DEFAULT_HYBRID_CONFIG.poissonBlendWeight !== 0.7) throw new Error("Production blend mutated");
  if (DEFAULT_HYBRID_CONFIG.homeAdvantageElo !== 65) throw new Error("Production homeAdvantageElo mutated");
  return report;
}

export function poolWindowReports(reports: readonly TemporalWindowReport[]): TemporalWindowReport {
  if (reports.length === 0) throw new Error("Pooled temporal window is empty");
  const panel = reports[0]!.panel;
  const window = reports[0]!.window;
  if (reports.some((report) => report.panel !== panel || report.window !== window)) {
    throw new Error("Pooled temporal window mixed panel or window");
  }
  const tracesN = reports.reduce((sum, report) => sum + report.n, 0);
  const highObs = reports.reduce((sum, report) => sum + report.highEqual.observedCount, 0);
  const highExp = reports.reduce((sum, report) => sum + report.highEqual.expectedCount, 0);
  const twoObs = reports.reduce((sum, report) => sum + report.twoTwo.observedCount, 0);
  const twoExp = reports.reduce((sum, report) => sum + report.twoTwo.expectedCount, 0);
  const threeObs = reports.reduce((sum, report) => sum + report.threeThree.observedCount, 0);
  const threeExp = reports.reduce((sum, report) => sum + report.threeThree.expectedCount, 0);
  const fourObs = reports.reduce((sum, report) => sum + report.fourPlus.observedCount, 0);
  const fourExp = reports.reduce((sum, report) => sum + report.fourPlus.expectedCount, 0);
  const lowObs = reports.reduce((sum, report) => sum + report.lowEqual.observedCount, 0);
  const lowExp = reports.reduce((sum, report) => sum + report.lowEqual.expectedCount, 0);
  const nDraws = reports.reduce((sum, report) => sum + report.composition.nDraws, 0);
  const share = (pick: (report: TemporalWindowReport) => number) =>
    nDraws === 0
      ? 0
      : reports.reduce((sum, report) => sum + pick(report) * report.composition.nDraws, 0) / nDraws;
  const dummyTraces = [] as HsMatchTrace[];
  const highEqual = countRow("HIGH_EQUAL", dummyTraces, highObs, highExp);
  highEqual.observedRate = tracesN === 0 ? 0 : highObs / tracesN;
  highEqual.expectedRate = tracesN === 0 ? 0 : highExp / tracesN;
  highEqual.difference = highEqual.observedRate - highEqual.expectedRate;
  const patch = (row: CountRow, obs: number, exp: number): CountRow => ({
    ...row,
    observedRate: tracesN === 0 ? 0 : obs / tracesN,
    expectedRate: tracesN === 0 ? 0 : exp / tracesN,
    difference: tracesN === 0 ? 0 : obs / tracesN - exp / tracesN,
  });
  const residualEstimate =
    tracesN === 0
      ? 0
      : reports.reduce((sum, report) => sum + report.residual.estimate * report.n, 0) / tracesN;
  const residualLo =
    tracesN === 0
      ? 0
      : reports.reduce((sum, report) => sum + report.residual.lo * report.n, 0) / tracesN;
  const residualHi =
    tracesN === 0
      ? 0
      : reports.reduce((sum, report) => sum + report.residual.hi * report.n, 0) / tracesN;
  return {
    panel,
    season: reports.map((report) => report.season).join("+"),
    role: "HOLDOUT",
    window,
    n: tracesN,
    highEqual: patch(highEqual, highObs, highExp),
    twoTwo: patch(countRow("2-2", dummyTraces, twoObs, twoExp), twoObs, twoExp),
    threeThree: patch(countRow("3-3", dummyTraces, threeObs, threeExp), threeObs, threeExp),
    fourPlus: patch(countRow("4-4+", dummyTraces, fourObs, fourExp), fourObs, fourExp),
    lowEqual: patch(countRow("LOW_EQUAL", dummyTraces, lowObs, lowExp), lowObs, lowExp),
    composition: {
      nDraws,
      drawRate: tracesN === 0 ? 0 : nDraws / tracesN,
      share00: share((report) => report.composition.share00),
      share11: share((report) => report.composition.share11),
      share22: share((report) => report.composition.share22),
      share33plus: share((report) => report.composition.share33plus),
    },
    residual: {
      estimate: residualEstimate,
      lo: residualLo,
      hi: residualHi,
      seed: reports[0]!.residual.seed,
      resamples: reports[0]!.residual.resamples,
    },
    highEqualBootstrap: {
      seed: reports[0]!.highEqualBootstrap.seed,
      resamples: reports[0]!.highEqualBootstrap.resamples,
      rate: {
        estimate: tracesN === 0 ? 0 : highObs / tracesN,
        lo:
          tracesN === 0
            ? 0
            : reports.reduce((sum, report) => sum + report.highEqualBootstrap.rate.lo * report.n, 0) /
              tracesN,
        hi:
          tracesN === 0
            ? 0
            : reports.reduce((sum, report) => sum + report.highEqualBootstrap.rate.hi * report.n, 0) /
              tracesN,
      },
      oe: {
        estimate: highExp > 0 ? highObs / highExp : 0,
        lo:
          tracesN === 0
            ? 0
            : reports.reduce((sum, report) => sum + report.highEqualBootstrap.oe.lo * report.n, 0) /
              tracesN,
        hi:
          tracesN === 0
            ? 0
            : reports.reduce((sum, report) => sum + report.highEqualBootstrap.oe.hi * report.n, 0) /
              tracesN,
      },
    },
    exceedsThreshold: highExp > 0 && highObs / highExp > HIGH_EQUAL_OE_THRESHOLD,
  };
}

export function poolCorrespondingWindows(
  seasons: readonly SeasonTemporalReport[],
  window: TemporalWindow,
): TemporalWindowReport {
  const reports = seasons.map((season) =>
    HALF_WINDOWS.includes(window as HalfWindow)
      ? season.halves[window as HalfWindow]
      : season.quartiles[window as QuartileWindow],
  );
  return poolWindowReports(reports);
}

export type LeaveOneSeasonOutRow = {
  included: readonly string[];
  excluded: string;
  n: number;
  observedCount: number;
  expectedCount: number;
  oeRatio: number | null;
  exceedsThreshold: boolean;
};

export function leaveOneSeasonOut(seasons: readonly SeasonTemporalReport[]): LeaveOneSeasonOutRow[] {
  if (seasons.some((season) => season.panel !== "D1")) {
    throw new Error("Leave-one-season-out is defined on D1 only");
  }
  const labels = seasons.map((season) => season.season);
  return labels.map((excluded) => {
    const kept = seasons.filter((season) => season.season !== excluded);
    const observedCount = kept.reduce(
      (sum, season) =>
        sum + season.halves.H1.highEqual.observedCount + season.halves.H2.highEqual.observedCount,
      0,
    );
    const expectedCount = kept.reduce(
      (sum, season) =>
        sum + season.halves.H1.highEqual.expectedCount + season.halves.H2.highEqual.expectedCount,
      0,
    );
    const n = kept.reduce((sum, season) => sum + season.n, 0);
    const oeRatio = oe(observedCount, expectedCount);
    return {
      included: kept.map((season) => season.season),
      excluded,
      n,
      observedCount,
      expectedCount,
      oeRatio,
      exceedsThreshold: oeRatio != null && oeRatio > HIGH_EQUAL_OE_THRESHOLD,
    };
  });
}

export function d1HalfThresholds(seasons: readonly SeasonTemporalReport[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const season of seasons) {
    if (season.panel !== "D1") continue;
    for (const window of HALF_WINDOWS) {
      out[`${season.season} ${window}`] = season.halves[window].exceedsThreshold;
    }
  }
  return out;
}

export function d1QuartileThresholds(
  seasons: readonly SeasonTemporalReport[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const season of seasons) {
    if (season.panel !== "D1") continue;
    for (const window of QUARTILE_WINDOWS) {
      out[`${season.season} ${window}`] = season.quartiles[window].exceedsThreshold;
    }
  }
  return out;
}
