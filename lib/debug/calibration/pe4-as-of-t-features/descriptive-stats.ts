/**
 * PE-4I.18 — Descriptive stats + constant / near-constant / low-variance flags.
 * Structural only — no outcome association.
 */

import {
  classifyVarianceClass,
  type Pe4I18VarianceClass,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";

export type Pe4I18DescriptiveFieldStats = {
  field: string;
  nPresent: number;
  uniqueFinite: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  stdev: number | null;
  zeroShare: number | null;
  modeShare: number | null;
  modeValue: number | null;
  range: number | null;
  varianceClass: Pe4I18VarianceClass;
};

export type Pe4I18DescriptiveStatsAudit = {
  fields: Pe4I18DescriptiveFieldStats[];
  countsByClass: Record<Pe4I18VarianceClass, number>;
  constantExamples: string[];
  nearConstantExamples: string[];
  lowVarianceExamples: string[];
};

type Online = {
  n: number;
  sum: number;
  sumSq: number;
  min: number;
  max: number;
  zeroCount: number;
  /** Rounded-key histogram for mode (deterministic string keys). */
  hist: Map<string, { value: number; count: number }>;
  /** Reservoir of values for median (capped; full store if n small). */
  values: number[];
};

const MEDIAN_STORE_CAP = 50_000;

function roundKey(v: number): string {
  // Stable key for near-duplicates; preserve exact ints.
  if (Number.isInteger(v)) return `i:${v}`;
  return `f:${v.toPrecision(12)}`;
}

export function createDescriptiveAccumulator(
  fields: readonly string[],
): Map<string, Online> {
  const m = new Map<string, Online>();
  for (const f of fields) {
    m.set(f, {
      n: 0,
      sum: 0,
      sumSq: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      zeroCount: 0,
      hist: new Map(),
      values: [],
    });
  }
  return m;
}

export function accumulateDescriptive(
  state: Map<string, Online>,
  numerics: Record<string, number>,
): void {
  for (const [field, v] of Object.entries(numerics)) {
    if (!Number.isFinite(v)) continue;
    let o = state.get(field);
    if (!o) {
      o = {
        n: 0,
        sum: 0,
        sumSq: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        zeroCount: 0,
        hist: new Map(),
        values: [],
      };
      state.set(field, o);
    }
    o.n += 1;
    o.sum += v;
    o.sumSq += v * v;
    if (v < o.min) o.min = v;
    if (v > o.max) o.max = v;
    if (v === 0) o.zeroCount += 1;
    const k = roundKey(v);
    const h = o.hist.get(k);
    if (h) h.count += 1;
    else o.hist.set(k, { value: v, count: 1 });
    if (o.values.length < MEDIAN_STORE_CAP) o.values.push(v);
  }
}

function medianOf(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function finalizeDescriptiveStats(
  state: Map<string, Online>,
): Pe4I18DescriptiveStatsAudit {
  const fields: Pe4I18DescriptiveFieldStats[] = [];
  for (const [field, o] of [...state.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (o.n === 0) {
      fields.push({
        field,
        nPresent: 0,
        uniqueFinite: 0,
        min: null,
        max: null,
        mean: null,
        median: null,
        stdev: null,
        zeroShare: null,
        modeShare: null,
        modeValue: null,
        range: null,
        varianceClass: "CONSTANT",
      });
      continue;
    }
    const mean = o.sum / o.n;
    const variance = Math.max(0, o.sumSq / o.n - mean * mean);
    const stdev = Math.sqrt(variance);
    const sorted = [...o.values].sort((a, b) => a - b);
    let modeValue: number | null = null;
    let modeCount = 0;
    for (const { value, count } of o.hist.values()) {
      if (
        count > modeCount ||
        (count === modeCount &&
          modeValue != null &&
          value < modeValue)
      ) {
        // Prefer lower value on ties for determinism when counts equal — actually
        // we want highest count; on tie pick lexicographically smaller key via value.
        if (count > modeCount || (count === modeCount && (modeValue == null || value < modeValue))) {
          modeCount = count;
          modeValue = value;
        }
      }
    }
    const modeShare = modeCount / o.n;
    const range = o.max - o.min;
    const uniqueFinite = o.hist.size;
    const varianceClass = classifyVarianceClass({
      uniqueFinite,
      mostCommonShare: modeShare,
      range,
      mean,
      stdev,
    });
    fields.push({
      field,
      nPresent: o.n,
      uniqueFinite,
      min: o.min,
      max: o.max,
      mean,
      median: medianOf(sorted),
      stdev,
      zeroShare: o.zeroCount / o.n,
      modeShare,
      modeValue,
      range,
      varianceClass,
    });
  }

  const countsByClass: Record<Pe4I18VarianceClass, number> = {
    CONSTANT: 0,
    NEAR_CONSTANT: 0,
    LOW_VARIANCE: 0,
    VARIABLE: 0,
  };
  for (const f of fields) countsByClass[f.varianceClass] += 1;

  const pick = (c: Pe4I18VarianceClass, n = 8) =>
    fields.filter((f) => f.varianceClass === c).slice(0, n).map((f) => f.field);

  return {
    fields,
    countsByClass,
    constantExamples: pick("CONSTANT"),
    nearConstantExamples: pick("NEAR_CONSTANT"),
    lowVarianceExamples: pick("LOW_VARIANCE"),
  };
}
