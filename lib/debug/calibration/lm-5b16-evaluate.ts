/**
 * Empirical D0/D1 local HIGH_EQUAL mass evaluation. Frozen production G0. Not a tuner.
 */

import {
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { isValidOneXTwo, summarizeMetrics } from "@/lib/debug/calibration/metrics";
import { snapshotHsPanel, type HsMatchTrace, type NumericFailure } from "@/lib/debug/calibration/hs-5b14-evaluate";
import { HS_D1_NON_CANDIDATE_LABEL, HS_NAMED_TRACES, isHighEqual, isLowEqual } from "@/lib/debug/calibration/hs-5b14-shape";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import {
  applyLocalMassArm,
  highEqualFromEqual,
  lowEqualFromEqual,
  summarizeCells,
  type LocalGridResult,
  type MassChangeAudit,
} from "@/lib/debug/calibration/lm-5b16-formula";
import {
  LOCAL_MASS_ARMS,
  LOW_EQUAL_RATE_FLAG,
  type LmPanelId,
  type LocalMassArm,
} from "@/lib/debug/calibration/lm-5b16-shape";
import {
  HALF_WINDOWS,
  SEASON_N,
  requireSeasonLength,
  sortChronological,
  splitHalves,
  splitQuartiles,
  type HalfWindow,
  type QuartileWindow,
} from "@/lib/debug/calibration/tr-5b15-shape";
import type { CalibrationRow, OneXTwo } from "@/lib/debug/calibration/types";

export type OeRow = {
  key: string;
  observedCount: number;
  expectedCount: number;
  oeRatio: number | null;
};

export type ArmMetrics = {
  arm: LocalMassArm;
  diagnosticOnly: true;
  n: number;
  logLoss: number;
  brier: number;
  ece: number;
  predicted: OneXTwo;
  observed: OneXTwo;
  homeBias: number;
  drawBias: number;
  awayBias: number;
  meanMaxProbability: number;
  share80: number;
  share90: number;
  share95: number;
  scorelines: OeRow[];
  meanChange: MassChangeAudit;
  lowEqualRateChange: number;
  lowEqualFlag: boolean;
  addedMass: { twoTwo: number; threeThree: number; fourPlus: number; highEqual: number };
  addedShare: { twoTwo: number; threeThree: number; fourPlus: number };
};

export type NamedLocalTrace = {
  label: string;
  fixtureId: string;
  season: string;
  panel: LmPanelId;
  byArm: Record<
    string,
    { p00: number; p11: number; p22: number; p33plus: number; draw: number; hybrid: OneXTwo }
  >;
};

export type TemporalOe = {
  window: string;
  n: number;
  byArm: Record<string, { observedCount: number; expectedCount: number; oeRatio: number | null }>;
};

export type LeaveOneOutRow = {
  arm: LocalMassArm;
  excluded: string;
  included: readonly string[];
  n: number;
  observedCount: number;
  expectedCount: number;
  oeRatio: number | null;
};

export type SeasonLocalReport = {
  panel: LmPanelId;
  panelLabel: string;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  n: number;
  failures: NumericFailure[];
  arms: ArmMetrics[];
  namedTraces: NamedLocalTrace[];
  halves: Record<HalfWindow, TemporalOe>;
  quartiles: Record<QuartileWindow, TemporalOe>;
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function oe(observed: number, expected: number): number | null {
  if (!(expected > 0)) return null;
  return observed / expected;
}

function peak(oneXTwo: OneXTwo): number {
  return Math.max(oneXTwo.home, oneXTwo.draw, oneXTwo.away);
}

function observedOutcome(traces: readonly HsMatchTrace[]): OneXTwo {
  const n = traces.length || 1;
  return {
    home: traces.filter((trace) => trace.actualOutcome === "home").length / n,
    draw: traces.filter((trace) => trace.actualOutcome === "draw").length / n,
    away: traces.filter((trace) => trace.actualOutcome === "away").length / n,
  };
}

type ReplayBook = Map<string, Record<LocalMassArm, LocalGridResult>>;

function replayArm(trace: HsMatchTrace, arm: LocalMassArm): LocalGridResult {
  return applyLocalMassArm({
    control: summarizeCells(trace.independentCells),
    elo: trace.snapshot.elo,
    arm,
  });
}

function buildReplayBook(traces: readonly HsMatchTrace[]): ReplayBook {
  const book: ReplayBook = new Map();
  for (const trace of traces) {
    const byArm = {} as Record<LocalMassArm, LocalGridResult>;
    for (const arm of LOCAL_MASS_ARMS) {
      byArm[arm] = replayArm(trace, arm);
    }
    book.set(trace.fixtureId, byArm);
  }
  return book;
}

function requireReplay(book: ReplayBook, fixtureId: string, arm: LocalMassArm): LocalGridResult {
  const row = book.get(fixtureId);
  if (!row) throw new Error(`Missing local-mass replay for ${fixtureId}`);
  return row[arm];
}

function scorelineRows(traces: readonly HsMatchTrace[], replays: readonly LocalGridResult[]): OeRow[] {
  const specs: { key: string; observed: (trace: HsMatchTrace) => boolean; expected: (replay: LocalGridResult) => number }[] =
    [
      {
        key: "0-0",
        observed: (trace) => trace.actualHomeGoals === 0 && trace.actualAwayGoals === 0,
        expected: (replay) => replay.grid.p00,
      },
      {
        key: "1-1",
        observed: (trace) => trace.actualHomeGoals === 1 && trace.actualAwayGoals === 1,
        expected: (replay) => replay.grid.p11,
      },
      {
        key: "2-2",
        observed: (trace) => trace.actualHomeGoals === 2 && trace.actualAwayGoals === 2,
        expected: (replay) => replay.grid.p22,
      },
      {
        key: "3-3+",
        observed: (trace) =>
          isHighEqual(trace.actualHomeGoals, trace.actualAwayGoals) && trace.actualHomeGoals >= 3,
        expected: (replay) => replay.grid.p33 + replay.grid.p44 + replay.grid.p55plus,
      },
      {
        key: "LOW_EQUAL",
        observed: (trace) => isLowEqual(trace.actualHomeGoals, trace.actualAwayGoals),
        expected: (replay) => lowEqualFromEqual(replay.grid.equal),
      },
      {
        key: "HIGH_EQUAL",
        observed: (trace) => isHighEqual(trace.actualHomeGoals, trace.actualAwayGoals),
        expected: (replay) => highEqualFromEqual(replay.grid.equal),
      },
      {
        key: "all-equal",
        observed: (trace) => trace.actualHomeGoals === trace.actualAwayGoals,
        expected: (replay) => replay.grid.draw,
      },
    ];
  return specs.map((spec) => {
    const observedCount = traces.filter(spec.observed).length;
    const expectedCount = replays.reduce((sum, replay) => sum + spec.expected(replay), 0);
    return {
      key: spec.key,
      observedCount,
      expectedCount,
      oeRatio: oe(observedCount, expectedCount),
    };
  });
}

function addedMass(replays: readonly LocalGridResult[], controls: readonly LocalGridResult[]): ArmMetrics["addedMass"] {
  const twoTwo = replays.reduce((sum, replay, index) => sum + replay.grid.p22 - controls[index]!.grid.p22, 0);
  const threeThree = replays.reduce((sum, replay, index) => sum + replay.grid.p33 - controls[index]!.grid.p33, 0);
  const fourPlus = replays.reduce(
    (sum, replay, index) =>
      sum +
      replay.grid.p44 +
      replay.grid.p55plus -
      controls[index]!.grid.p44 -
      controls[index]!.grid.p55plus,
    0,
  );
  return { twoTwo, threeThree, fourPlus, highEqual: twoTwo + threeThree + fourPlus };
}

function evaluateArm(
  traces: readonly HsMatchTrace[],
  arm: LocalMassArm,
  book: ReplayBook,
): ArmMetrics {
  const replays = traces.map((trace) => requireReplay(book, trace.fixtureId, arm));
  const controls = traces.map((trace) => requireReplay(book, trace.fixtureId, "M0"));
  const metrics = summarizeMetrics(
    traces.map((trace, index) => ({
      predicted: replays[index]!.hybrid,
      actual: trace.actualOutcome,
      bucket: "10+",
      policyId: arm,
    })),
  );
  const predicted = {
    home: mean(replays.map((replay) => replay.hybrid.home)),
    draw: mean(replays.map((replay) => replay.hybrid.draw)),
    away: mean(replays.map((replay) => replay.hybrid.away)),
  };
  const observed = observedOutcome(traces);
  const maxes = replays.map((replay) => peak(replay.hybrid));
  const added = addedMass(replays, controls);
  const lowEqualRateChange = mean(replays.map((replay) => lowEqualFromEqual(replay.grid.equal))) -
    mean(controls.map((replay) => lowEqualFromEqual(replay.grid.equal)));
  return {
    arm,
    diagnosticOnly: true,
    n: traces.length,
    logLoss: metrics.logLoss,
    brier: metrics.brier,
    ece: metrics.ece,
    predicted,
    observed,
    homeBias: predicted.home - observed.home,
    drawBias: predicted.draw - observed.draw,
    awayBias: predicted.away - observed.away,
    meanMaxProbability: mean(maxes),
    share80: maxes.filter((value) => value >= 0.8).length / (traces.length || 1),
    share90: maxes.filter((value) => value >= 0.9).length / (traces.length || 1),
    share95: maxes.filter((value) => value >= 0.95).length / (traces.length || 1),
    scorelines: scorelineRows(traces, replays),
    meanChange: {
      p00: mean(replays.map((replay) => replay.changeFromControl.p00)),
      p11: mean(replays.map((replay) => replay.changeFromControl.p11)),
      p22: mean(replays.map((replay) => replay.changeFromControl.p22)),
      p33plus: mean(replays.map((replay) => replay.changeFromControl.p33plus)),
      highEqual: mean(replays.map((replay) => replay.changeFromControl.highEqual)),
      lowEqual: mean(replays.map((replay) => replay.changeFromControl.lowEqual)),
      draw: mean(replays.map((replay) => replay.changeFromControl.draw)),
      home: mean(replays.map((replay) => replay.changeFromControl.home)),
      away: mean(replays.map((replay) => replay.changeFromControl.away)),
    },
    lowEqualRateChange,
    lowEqualFlag: Math.abs(lowEqualRateChange) > LOW_EQUAL_RATE_FLAG,
    addedMass: added,
    addedShare: {
      twoTwo: added.highEqual > 0 ? added.twoTwo / added.highEqual : 0,
      threeThree: added.highEqual > 0 ? added.threeThree / added.highEqual : 0,
      fourPlus: added.highEqual > 0 ? added.fourPlus / added.highEqual : 0,
    },
  };
}

function temporalOe(
  traces: readonly HsMatchTrace[],
  window: string,
  book: ReplayBook,
): TemporalOe {
  const byArm: TemporalOe["byArm"] = {};
  for (const arm of LOCAL_MASS_ARMS) {
    const replays = traces.map((trace) => requireReplay(book, trace.fixtureId, arm));
    const observedCount = traces.filter((trace) =>
      isHighEqual(trace.actualHomeGoals, trace.actualAwayGoals),
    ).length;
    const expectedCount = replays.reduce((sum, replay) => sum + highEqualFromEqual(replay.grid.equal), 0);
    byArm[arm] = { observedCount, expectedCount, oeRatio: oe(observedCount, expectedCount) };
  }
  return { window, n: traces.length, byArm };
}

function namedTraces(
  traces: readonly HsMatchTrace[],
  panel: LmPanelId,
  book: ReplayBook,
): NamedLocalTrace[] {
  return HS_NAMED_TRACES.flatMap((spec) => {
    const match = traces.find(
      (row) =>
        row.season === spec.season &&
        row.homeTeamName === spec.home &&
        row.awayTeamName === spec.away &&
        `${row.actualHomeGoals}-${row.actualAwayGoals}` === spec.score,
    );
    if (!match) return [];
    const byArm: NamedLocalTrace["byArm"] = {};
    for (const arm of LOCAL_MASS_ARMS) {
      const replay = requireReplay(book, match.fixtureId, arm);
      byArm[arm] = {
        p00: replay.grid.p00,
        p11: replay.grid.p11,
        p22: replay.grid.p22,
        p33plus: replay.grid.p33 + replay.grid.p44 + replay.grid.p55plus,
        draw: replay.grid.draw,
        hybrid: replay.hybrid,
      };
    }
    return [
      {
        label: `${spec.season} ${spec.home} vs ${spec.away} ${spec.score}`,
        fixtureId: match.fixtureId,
        season: match.season,
        panel,
        byArm,
      },
    ];
  });
}

export function evaluateSeasonLocalMass(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  panel: LmPanelId;
}): SeasonLocalReport {
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
  if (snap.traces.some((trace) => !isValidOneXTwo(trace.snapshot.hybrid))) {
    throw new Error("Invalid production hybrid on local-mass snapshot");
  }
  const sorted = sortChronological(snap.traces);
  const halves = splitHalves(sorted);
  const quartiles = splitQuartiles(sorted);
  const book = buildReplayBook(snap.traces);
  const report: SeasonLocalReport = {
    panel: input.panel,
    panelLabel: input.panel === "D1" ? HS_D1_NON_CANDIDATE_LABEL : "PRODUCTION_CHAIN_C0_G0",
    season: input.season,
    role: input.role,
    n: SEASON_N,
    failures: snap.failures,
    arms: LOCAL_MASS_ARMS.map((arm) => evaluateArm(snap.traces, arm, book)),
    namedTraces: namedTraces(snap.traces, input.panel, book),
    halves: {
      H1: temporalOe(halves.H1, "H1", book),
      H2: temporalOe(halves.H2, "H2", book),
    },
    quartiles: {
      Q1: temporalOe(quartiles.Q1, "Q1", book),
      Q2: temporalOe(quartiles.Q2, "Q2", book),
      Q3: temporalOe(quartiles.Q3, "Q3", book),
      Q4: temporalOe(quartiles.Q4, "Q4", book),
    },
  };
  assertProductionHybridConfigUnchanged(before);
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== 400) throw new Error("Production eloGoalScale mutated");
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== 0.28) throw new Error("Production eloDrawBase mutated");
  if (DEFAULT_HYBRID_CONFIG.poissonBlendWeight !== 0.7) throw new Error("Production blend mutated");
  if (DEFAULT_HYBRID_CONFIG.homeAdvantageElo !== 65) throw new Error("Production homeAdvantageElo mutated");
  return report;
}

function weightArms(reports: readonly SeasonLocalReport[]): ArmMetrics[] {
  const n = reports.reduce((sum, report) => sum + report.n, 0);
  return LOCAL_MASS_ARMS.map((arm, index) => {
    const parts = reports.map((report) => report.arms[index]!);
    const ww = (value: (row: ArmMetrics) => number) =>
      n === 0 ? 0 : parts.reduce((sum, row) => sum + value(row) * row.n, 0) / n;
    const scorelines = (parts[0]?.scorelines ?? []).map((row, scoreIndex) => {
      const observedCount = parts.reduce((sum, part) => sum + (part.scorelines[scoreIndex]?.observedCount ?? 0), 0);
      const expectedCount = parts.reduce((sum, part) => sum + (part.scorelines[scoreIndex]?.expectedCount ?? 0), 0);
      return { key: row.key, observedCount, expectedCount, oeRatio: oe(observedCount, expectedCount) };
    });
    const added = {
      twoTwo: parts.reduce((sum, part) => sum + part.addedMass.twoTwo, 0),
      threeThree: parts.reduce((sum, part) => sum + part.addedMass.threeThree, 0),
      fourPlus: parts.reduce((sum, part) => sum + part.addedMass.fourPlus, 0),
      highEqual: 0,
    };
    added.highEqual = added.twoTwo + added.threeThree + added.fourPlus;
    return {
      arm,
      diagnosticOnly: true as const,
      n,
      logLoss: ww((row) => row.logLoss),
      brier: ww((row) => row.brier),
      ece: ww((row) => row.ece),
      predicted: {
        home: ww((row) => row.predicted.home),
        draw: ww((row) => row.predicted.draw),
        away: ww((row) => row.predicted.away),
      },
      observed: {
        home: ww((row) => row.observed.home),
        draw: ww((row) => row.observed.draw),
        away: ww((row) => row.observed.away),
      },
      homeBias: ww((row) => row.homeBias),
      drawBias: ww((row) => row.drawBias),
      awayBias: ww((row) => row.awayBias),
      meanMaxProbability: ww((row) => row.meanMaxProbability),
      share80: ww((row) => row.share80),
      share90: ww((row) => row.share90),
      share95: ww((row) => row.share95),
      scorelines,
      meanChange: {
        p00: ww((row) => row.meanChange.p00),
        p11: ww((row) => row.meanChange.p11),
        p22: ww((row) => row.meanChange.p22),
        p33plus: ww((row) => row.meanChange.p33plus),
        highEqual: ww((row) => row.meanChange.highEqual),
        lowEqual: ww((row) => row.meanChange.lowEqual),
        draw: ww((row) => row.meanChange.draw),
        home: ww((row) => row.meanChange.home),
        away: ww((row) => row.meanChange.away),
      },
      lowEqualRateChange: ww((row) => row.lowEqualRateChange),
      lowEqualFlag: Math.abs(ww((row) => row.lowEqualRateChange)) > LOW_EQUAL_RATE_FLAG,
      addedMass: added,
      addedShare: {
        twoTwo: added.highEqual > 0 ? added.twoTwo / added.highEqual : 0,
        threeThree: added.highEqual > 0 ? added.threeThree / added.highEqual : 0,
        fourPlus: added.highEqual > 0 ? added.fourPlus / added.highEqual : 0,
      },
    };
  });
}

export function poolHoldoutLocal(reports: readonly SeasonLocalReport[]): {
  panel: LmPanelId;
  n: number;
  seasons: readonly string[];
  arms: ArmMetrics[];
} {
  const holdouts = reports.filter((report) => report.role === "HOLDOUT");
  if (holdouts.some((report) => report.season === "2024")) {
    throw new Error("HOLDOUT-ONLY aggregate must exclude PL 2024");
  }
  if (holdouts.length === 0) throw new Error("HOLDOUT-ONLY aggregate is empty");
  const panel = holdouts[0]!.panel;
  if (holdouts.some((report) => report.panel !== panel)) {
    throw new Error("HOLDOUT-ONLY aggregate mixed panels");
  }
  return {
    panel,
    n: holdouts.reduce((sum, report) => sum + report.n, 0),
    seasons: holdouts.map((report) => report.season),
    arms: weightArms(holdouts),
  };
}

export function poolTemporal(
  reports: readonly SeasonLocalReport[],
  window: HalfWindow | QuartileWindow,
): TemporalOe {
  const slices = reports.map((report) =>
    HALF_WINDOWS.includes(window as HalfWindow)
      ? report.halves[window as HalfWindow]
      : report.quartiles[window as QuartileWindow],
  );
  const byArm: TemporalOe["byArm"] = {};
  for (const arm of LOCAL_MASS_ARMS) {
    const observedCount = slices.reduce((sum, slice) => sum + (slice.byArm[arm]?.observedCount ?? 0), 0);
    const expectedCount = slices.reduce((sum, slice) => sum + (slice.byArm[arm]?.expectedCount ?? 0), 0);
    byArm[arm] = { observedCount, expectedCount, oeRatio: oe(observedCount, expectedCount) };
  }
  return {
    window,
    n: slices.reduce((sum, slice) => sum + slice.n, 0),
    byArm,
  };
}

export function leaveOneSeasonOutLocal(reports: readonly SeasonLocalReport[]): LeaveOneOutRow[] {
  if (reports.some((report) => report.panel !== "D1")) {
    throw new Error("Leave-one-season-out is defined on D1 only");
  }
  const labels = reports.map((report) => report.season);
  return LOCAL_MASS_ARMS.flatMap((arm) =>
    labels.map((excluded) => {
      const kept = reports.filter((report) => report.season !== excluded);
      const observedCount = kept.reduce((sum, report) => {
        const row = report.arms.find((item) => item.arm === arm)?.scorelines.find((item) => item.key === "HIGH_EQUAL");
        return sum + (row?.observedCount ?? 0);
      }, 0);
      const expectedCount = kept.reduce((sum, report) => {
        const row = report.arms.find((item) => item.arm === arm)?.scorelines.find((item) => item.key === "HIGH_EQUAL");
        return sum + (row?.expectedCount ?? 0);
      }, 0);
      return {
        arm,
        excluded,
        included: kept.map((report) => report.season),
        n: kept.reduce((sum, report) => sum + report.n, 0),
        observedCount,
        expectedCount,
        oeRatio: oe(observedCount, expectedCount),
      };
    }),
  );
}
