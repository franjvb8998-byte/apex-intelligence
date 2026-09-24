/**
 * GOALS-1F.1 — Pure diagnostic math (no model fitting).
 */

import { poissonPmf } from "@/lib/intelligence/modules/probability/math/poisson";
import { binaryBrier, binaryLogLoss } from "@/lib/debug/calibration/goals/g0/metrics";
import type { GoalsG1Prediction } from "@/lib/debug/calibration/goals/g1/predict";

export type LabeledG1Row = {
  fixtureId: string;
  season: string;
  kickoffUtc: string;
  muHome: number;
  muAway: number;
  muTotal: number;
  actualHome: number;
  actualAway: number;
  actualTotal: number;
  evidenceSupportBucket: string;
  markets: NonNullable<GoalsG1Prediction["markets"]>;
  p00: number;
};

export function toLabeledRows(
  predictions: readonly GoalsG1Prediction[],
): LabeledG1Row[] {
  const out: LabeledG1Row[] = [];
  for (const p of predictions) {
    if (p.predictionStatus !== "AVAILABLE") continue;
    if (p.labelHomeGoals90 == null || p.labelAwayGoals90 == null) continue;
    if (p.muHome == null || p.muAway == null || !p.markets) continue;
    const mh = p.muHome;
    const ma = p.muAway;
    out.push({
      fixtureId: p.fixtureId,
      season: p.season,
      kickoffUtc: p.kickoffUtc,
      muHome: mh,
      muAway: ma,
      muTotal: mh + ma,
      actualHome: p.labelHomeGoals90,
      actualAway: p.labelAwayGoals90,
      actualTotal: p.labelHomeGoals90 + p.labelAwayGoals90,
      evidenceSupportBucket: p.evidenceSupportBucket,
      markets: p.markets,
      p00: Math.exp(-(mh + ma)),
    });
  }
  return out.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );
}

export type CountCell = {
  bucket: string;
  observed: number;
  expected: number;
  oeRatio: number | null;
  absDiff: number;
  /** (O-E) / sqrt(E) when E > 0 */
  standardizedResidual: number | null;
};

function sideBucket(k: number): string {
  return k >= 5 ? "5+" : String(k);
}

function totalBucket(k: number): string {
  return k >= 6 ? "6+" : String(k);
}

function tailBucket(k: number): string {
  return k >= 5 ? "5+" : String(k);
}

function emptySide(): Record<string, { o: number; e: number }> {
  return {
    "0": { o: 0, e: 0 },
    "1": { o: 0, e: 0 },
    "2": { o: 0, e: 0 },
    "3": { o: 0, e: 0 },
    "4": { o: 0, e: 0 },
    "5+": { o: 0, e: 0 },
  };
}

function emptyTotal(): Record<string, { o: number; e: number }> {
  return {
    "0": { o: 0, e: 0 },
    "1": { o: 0, e: 0 },
    "2": { o: 0, e: 0 },
    "3": { o: 0, e: 0 },
    "4": { o: 0, e: 0 },
    "5": { o: 0, e: 0 },
    "6+": { o: 0, e: 0 },
  };
}

function emptyTail(): Record<string, { o: number; e: number }> {
  return {
    "0": { o: 0, e: 0 },
    "1": { o: 0, e: 0 },
    "2": { o: 0, e: 0 },
    "3": { o: 0, e: 0 },
    "4": { o: 0, e: 0 },
    "5+": { o: 0, e: 0 },
  };
}

function toCells(
  map: Record<string, { o: number; e: number }>,
  order: readonly string[],
): CountCell[] {
  return order.map((bucket) => {
    const { o, e } = map[bucket]!;
    return {
      bucket,
      observed: o,
      expected: e,
      oeRatio: e > 0 ? o / e : null,
      absDiff: Math.abs(o - e),
      standardizedResidual: e > 0 ? (o - e) / Math.sqrt(e) : null,
    };
  });
}

export function scoreCountAdequacy(rows: readonly LabeledG1Row[]): {
  n: number;
  home: CountCell[];
  away: CountCell[];
  total: CountCell[];
} {
  const home = emptySide();
  const away = emptySide();
  const total = emptyTotal();
  for (const r of rows) {
    home[sideBucket(r.actualHome)]!.o += 1;
    away[sideBucket(r.actualAway)]!.o += 1;
    total[totalBucket(r.actualTotal)]!.o += 1;
    for (let k = 0; k <= 4; k += 1) {
      home[String(k)]!.e += poissonPmf(k, r.muHome);
      away[String(k)]!.e += poissonPmf(k, r.muAway);
    }
    let h5 = 0;
    let a5 = 0;
    for (let k = 5; k <= 30; k += 1) {
      h5 += poissonPmf(k, r.muHome);
      a5 += poissonPmf(k, r.muAway);
    }
    home["5+"]!.e += h5;
    away["5+"]!.e += a5;
    for (let k = 0; k <= 5; k += 1) {
      total[String(k)]!.e += poissonPmf(k, r.muTotal);
    }
    let t6 = 0;
    for (let k = 6; k <= 40; k += 1) t6 += poissonPmf(k, r.muTotal);
    total["6+"]!.e += t6;
  }
  return {
    n: rows.length,
    home: toCells(home, ["0", "1", "2", "3", "4", "5+"]),
    away: toCells(away, ["0", "1", "2", "3", "4", "5+"]),
    total: toCells(total, ["0", "1", "2", "3", "4", "5", "6+"]),
  };
}

export function meanVariance(xs: number[]): {
  n: number;
  mean: number;
  variance: number;
  varianceOverMean: number | null;
} {
  const n = xs.length;
  if (n === 0) {
    return { n: 0, mean: NaN, variance: NaN, varianceOverMean: null };
  }
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return {
    n,
    mean,
    variance,
    varianceOverMean: mean > 0 ? variance / mean : null,
  };
}

/** Pearson dispersion: sum((y-mu)^2/mu) / (n) — population form for diagnostics. */
export function pearsonDispersion(
  ys: number[],
  mus: number[],
): { statistic: number; df: number; n: number } {
  if (ys.length !== mus.length || ys.length === 0) {
    return { statistic: NaN, df: 0, n: 0 };
  }
  let s = 0;
  let n = 0;
  for (let i = 0; i < ys.length; i += 1) {
    const mu = mus[i]!;
    if (!(mu > 0)) continue;
    s += ((ys[i]! - mu) ** 2) / mu;
    n += 1;
  }
  const df = Math.max(1, n);
  return { statistic: s / df, df, n };
}

export type DispersionReport = {
  actualHome: ReturnType<typeof meanVariance>;
  actualAway: ReturnType<typeof meanVariance>;
  actualTotal: ReturnType<typeof meanVariance>;
  pearsonHome: ReturnType<typeof pearsonDispersion>;
  pearsonAway: ReturnType<typeof pearsonDispersion>;
  pearsonTotal: ReturnType<typeof pearsonDispersion>;
  classification: string;
};

export function dispersionAudit(rows: readonly LabeledG1Row[]): DispersionReport {
  const homes = rows.map((r) => r.actualHome);
  const aways = rows.map((r) => r.actualAway);
  const totals = rows.map((r) => r.actualTotal);
  const actualHome = meanVariance(homes);
  const actualAway = meanVariance(aways);
  const actualTotal = meanVariance(totals);
  const pearsonHome = pearsonDispersion(
    homes,
    rows.map((r) => r.muHome),
  );
  const pearsonAway = pearsonDispersion(
    aways,
    rows.map((r) => r.muAway),
  );
  const pearsonTotal = pearsonDispersion(
    totals,
    rows.map((r) => r.muTotal),
  );

  // Predeclared descriptive bands on Pearson dispersion around 1.
  const over =
    pearsonHome.statistic > 1.15 ||
    pearsonAway.statistic > 1.15 ||
    pearsonTotal.statistic > 1.15;
  const under =
    pearsonHome.statistic < 0.85 ||
    pearsonAway.statistic < 0.85 ||
    pearsonTotal.statistic < 0.85;
  let classification = "NO_OBVIOUS_DISPERSION_PROBLEM";
  if (over && under) classification = "INCONCLUSIVE";
  else if (over) classification = "POSSIBLE_OVERDISPERSION";
  else if (under) classification = "POSSIBLE_UNDERDISPERSION";

  return {
    actualHome,
    actualAway,
    actualTotal,
    pearsonHome,
    pearsonAway,
    pearsonTotal,
    classification,
  };
}

export type LowScoreCellReport = {
  cell: string;
  observed: number;
  expected: number;
  oeRatio: number | null;
  observedFrequency: number;
  meanPredictedProbability: number;
};

export function exactScoreProb(
  h: number,
  a: number,
  muHome: number,
  muAway: number,
): number {
  return poissonPmf(h, muHome) * poissonPmf(a, muAway);
}

export function lowScoreAudit(rows: readonly LabeledG1Row[]): {
  n: number;
  cells: LowScoreCellReport[];
  lowScore2x2: {
    observed: number;
    expected: number;
    oeRatio: number | null;
    observedMass: number;
    expectedMass: number;
  };
  zeroZero: LowScoreCellReport;
} {
  const n = rows.length;
  const cellsSpec: [string, number, number][] = [
    ["0-0", 0, 0],
    ["1-0", 1, 0],
    ["0-1", 0, 1],
    ["1-1", 1, 1],
  ];
  const cells: LowScoreCellReport[] = [];
  let obs2 = 0;
  let exp2 = 0;
  for (const [cell, h, a] of cellsSpec) {
    let observed = 0;
    let expected = 0;
    let sumP = 0;
    for (const r of rows) {
      const p = exactScoreProb(h, a, r.muHome, r.muAway);
      expected += p;
      sumP += p;
      if (r.actualHome === h && r.actualAway === a) observed += 1;
    }
    obs2 += observed;
    exp2 += expected;
    cells.push({
      cell,
      observed,
      expected,
      oeRatio: expected > 0 ? observed / expected : null,
      observedFrequency: n ? observed / n : NaN,
      meanPredictedProbability: n ? sumP / n : NaN,
    });
  }
  const zeroZero = cells.find((c) => c.cell === "0-0")!;
  return {
    n,
    cells,
    lowScore2x2: {
      observed: obs2,
      expected: exp2,
      oeRatio: exp2 > 0 ? obs2 / exp2 : null,
      observedMass: n ? obs2 / n : NaN,
      expectedMass: n ? exp2 / n : NaN,
    },
    zeroZero,
  };
}

export function pearsonCorr(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx <= 0 || dy <= 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function covariance(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 1) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let s = 0;
  for (let i = 0; i < n; i += 1) s += (xs[i]! - mx) * (ys[i]! - my);
  return s / n;
}

export function homeAwayDependence(rows: readonly LabeledG1Row[]) {
  const h = rows.map((r) => r.actualHome);
  const a = rows.map((r) => r.actualAway);
  const rH = rows.map((r) => r.actualHome - r.muHome);
  const rA = rows.map((r) => r.actualAway - r.muAway);
  return {
    n: rows.length,
    corrActualHomeAway: pearsonCorr(h, a),
    covActualHomeAway: covariance(h, a),
    corrResidualHomeAway: pearsonCorr(rH, rA),
    covResidualHomeAway: covariance(rH, rA),
  };
}

export function tailAudit(rows: readonly LabeledG1Row[]) {
  const map = emptyTail();
  let expGe5 = 0;
  let expGe6 = 0;
  let obsGe5 = 0;
  let obsGe6 = 0;
  for (const r of rows) {
    map[tailBucket(r.actualTotal)]!.o += 1;
    if (r.actualTotal >= 5) obsGe5 += 1;
    if (r.actualTotal >= 6) obsGe6 += 1;
    for (let k = 0; k <= 4; k += 1) {
      map[String(k)]!.e += poissonPmf(k, r.muTotal);
    }
    let p5p = 0;
    for (let k = 5; k <= 40; k += 1) p5p += poissonPmf(k, r.muTotal);
    map["5+"]!.e += p5p;
    let ge5 = 0;
    let ge6 = 0;
    for (let k = 5; k <= 40; k += 1) {
      const p = poissonPmf(k, r.muTotal);
      ge5 += p;
      if (k >= 6) ge6 += p;
    }
    expGe5 += ge5;
    expGe6 += ge6;
  }
  const n = rows.length;
  return {
    n,
    regions: toCells(map, ["0", "1", "2", "3", "4", "5+"]),
    pTotalGe5: {
      observedRate: n ? obsGe5 / n : NaN,
      meanPredicted: n ? expGe5 / n : NaN,
      observed: obsGe5,
      expected: expGe5,
    },
    pTotalGe6: {
      observedRate: n ? obsGe6 / n : NaN,
      meanPredicted: n ? expGe6 / n : NaN,
      observed: obsGe6,
      expected: expGe6,
    },
  };
}

export type MarketError = {
  market: string;
  n: number;
  meanPredicted: number;
  actualFrequency: number;
  difference: number;
  logLoss: number;
  brier: number;
};

export function marketErrorAudit(rows: readonly LabeledG1Row[]): {
  markets: MarketError[];
  ou05: MarketError & { under: MarketError; zeroZeroInvariantHolds: boolean };
} {
  const defs: {
    market: string;
    p: (r: LabeledG1Row) => number;
    y: (r: LabeledG1Row) => 0 | 1;
  }[] = [
    {
      market: "O05",
      p: (r) => r.markets.matchTotals.over05,
      y: (r) => (r.actualTotal >= 1 ? 1 : 0),
    },
    {
      market: "U05",
      p: (r) => r.markets.matchTotals.under05,
      y: (r) => (r.actualTotal === 0 ? 1 : 0),
    },
    {
      market: "O15",
      p: (r) => r.markets.matchTotals.over15,
      y: (r) => (r.actualTotal >= 2 ? 1 : 0),
    },
    {
      market: "O25",
      p: (r) => r.markets.matchTotals.over25,
      y: (r) => (r.actualTotal >= 3 ? 1 : 0),
    },
    {
      market: "O35",
      p: (r) => r.markets.matchTotals.over35,
      y: (r) => (r.actualTotal >= 4 ? 1 : 0),
    },
    {
      market: "O45",
      p: (r) => r.markets.matchTotals.over45,
      y: (r) => (r.actualTotal >= 5 ? 1 : 0),
    },
    {
      market: "BTTS_YES",
      p: (r) => r.markets.btts.yes,
      y: (r) => (r.actualHome >= 1 && r.actualAway >= 1 ? 1 : 0),
    },
    {
      market: "BTTS_NO",
      p: (r) => r.markets.btts.no,
      y: (r) => (r.actualHome === 0 || r.actualAway === 0 ? 1 : 0),
    },
  ];

  const markets: MarketError[] = [];
  for (const d of defs) {
    let ll = 0;
    let br = 0;
    let sumP = 0;
    let sumY = 0;
    for (const r of rows) {
      const p = d.p(r);
      const y = d.y(r);
      ll += binaryLogLoss(p, y);
      br += binaryBrier(p, y);
      sumP += p;
      sumY += y;
    }
    const n = rows.length;
    markets.push({
      market: d.market,
      n,
      meanPredicted: n ? sumP / n : NaN,
      actualFrequency: n ? sumY / n : NaN,
      difference: n ? sumP / n - sumY / n : NaN,
      logLoss: n ? ll / n : NaN,
      brier: n ? br / n : NaN,
    });
  }

  const o05 = markets.find((m) => m.market === "O05")!;
  const u05 = markets.find((m) => m.market === "U05")!;
  // Under 0.5 <=> exact 0-0; mean P(U0.5) must equal mean P(0-0)
  let sumU = 0;
  let sum00 = 0;
  for (const r of rows) {
    sumU += r.markets.matchTotals.under05;
    sum00 += r.p00;
  }
  const zeroZeroInvariantHolds =
    rows.length === 0 || Math.abs(sumU - sum00) < 1e-9;

  return {
    markets,
    ou05: { ...o05, under: u05, zeroZeroInvariantHolds },
  };
}

export function residualSummary(xs: number[]) {
  if (xs.length === 0) {
    return {
      n: 0,
      mean: NaN,
      median: NaN,
      sd: NaN,
      p10: NaN,
      p25: NaN,
      p75: NaN,
      p90: NaN,
      min: NaN,
      max: NaN,
    };
  }
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const pct = (p: number) =>
    sorted[
      Math.min(n - 1, Math.max(0, Math.floor((p / 100) * (n - 1))))
    ]!;
  return {
    n,
    mean,
    median: pct(50),
    sd: Math.sqrt(variance),
    p10: pct(10),
    p25: pct(25),
    p75: pct(75),
    p90: pct(90),
    min: sorted[0]!,
    max: sorted[n - 1]!,
  };
}

export function fixtureResiduals(rows: readonly LabeledG1Row[]) {
  const home = rows.map((r) => r.actualHome - r.muHome);
  const away = rows.map((r) => r.actualAway - r.muAway);
  const total = rows.map((r) => r.actualTotal - r.muTotal);
  return {
    home: residualSummary(home),
    away: residualSummary(away),
    total: residualSummary(total),
  };
}
