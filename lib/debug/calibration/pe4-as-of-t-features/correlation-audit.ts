/**
 * PE-4I.18 — Pairwise Pearson correlation audit (allowlisted numerics).
 * Optional Spearman reserved for exploratory subsample — default off.
 * NO labels / outcomes.
 */

import {
  PE4I18_MIN_PAIRWISE_N,
  classifyCorrelationBand,
  type Pe4I18CorrelationBand,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";

export type Pe4I18CorrelationPair = {
  fieldA: string;
  fieldB: string;
  pairwiseN: number;
  pearsonR: number | null;
  absR: number | null;
  band: Pe4I18CorrelationBand;
  spearmanRho: number | null;
};

export type Pe4I18CorrelationAudit = {
  fieldCount: number;
  pairCountEvaluated: number;
  minPairwiseN: number;
  bandCounts: Record<Pe4I18CorrelationBand, number>;
  extremePairs: Pe4I18CorrelationPair[];
  veryHighPairs: Pe4I18CorrelationPair[];
  highPairs: Pe4I18CorrelationPair[];
  /** Top EXTREME by |r| then name. */
  topExtremePairs: Pe4I18CorrelationPair[];
  spearmanComputed: false;
};

type PairMoments = {
  n: number;
  sumX: number;
  sumY: number;
  sumXY: number;
  sumXX: number;
  sumYY: number;
};

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

export function createCorrelationState(fields: readonly string[]): {
  fields: string[];
  pairs: Map<string, PairMoments>;
} {
  const pairs = new Map<string, PairMoments>();
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      pairs.set(pairKey(fields[i]!, fields[j]!), {
        n: 0,
        sumX: 0,
        sumY: 0,
        sumXY: 0,
        sumXX: 0,
        sumYY: 0,
      });
    }
  }
  return { fields: [...fields], pairs };
}

export function accumulateCorrelation(
  state: { fields: string[]; pairs: Map<string, PairMoments> },
  numerics: Record<string, number>,
): void {
  const vals = state.fields.map((f) => numerics[f] ?? Number.NaN);
  for (let i = 0; i < state.fields.length; i++) {
    const x = vals[i]!;
    if (!Number.isFinite(x)) continue;
    for (let j = i + 1; j < state.fields.length; j++) {
      const y = vals[j]!;
      if (!Number.isFinite(y)) continue;
      const acc = state.pairs.get(pairKey(state.fields[i]!, state.fields[j]!));
      if (!acc) continue;
      acc.n += 1;
      acc.sumX += x;
      acc.sumY += y;
      acc.sumXY += x * y;
      acc.sumXX += x * x;
      acc.sumYY += y * y;
    }
  }
}

function pearsonFrom(acc: PairMoments): number | null {
  if (acc.n < 2) return null;
  const n = acc.n;
  const num = n * acc.sumXY - acc.sumX * acc.sumY;
  const denX = n * acc.sumXX - acc.sumX * acc.sumX;
  const denY = n * acc.sumYY - acc.sumY * acc.sumY;
  if (denX <= 0 || denY <= 0) return null;
  const r = num / Math.sqrt(denX * denY);
  if (!Number.isFinite(r)) return null;
  return Math.max(-1, Math.min(1, r));
}

export function finalizeCorrelationAudit(
  state: { fields: string[]; pairs: Map<string, PairMoments> },
  minPairwiseN: number = PE4I18_MIN_PAIRWISE_N,
): Pe4I18CorrelationAudit {
  const bandCounts: Record<Pe4I18CorrelationBand, number> = {
    EXTREME: 0,
    VERY_HIGH: 0,
    HIGH: 0,
    MODERATE_OR_BELOW: 0,
    INSUFFICIENT_PAIRWISE_N: 0,
  };

  const all: Pe4I18CorrelationPair[] = [];
  for (const [key, acc] of state.pairs) {
    const [fieldA, fieldB] = key.split("\0") as [string, string];
    if (acc.n < minPairwiseN) {
      bandCounts.INSUFFICIENT_PAIRWISE_N += 1;
      all.push({
        fieldA,
        fieldB,
        pairwiseN: acc.n,
        pearsonR: null,
        absR: null,
        band: "INSUFFICIENT_PAIRWISE_N",
        spearmanRho: null,
      });
      continue;
    }
    const r = pearsonFrom(acc);
    if (r == null) {
      bandCounts.INSUFFICIENT_PAIRWISE_N += 1;
      all.push({
        fieldA,
        fieldB,
        pairwiseN: acc.n,
        pearsonR: null,
        absR: null,
        band: "INSUFFICIENT_PAIRWISE_N",
        spearmanRho: null,
      });
      continue;
    }
    const band = classifyCorrelationBand(Math.abs(r));
    bandCounts[band] += 1;
    all.push({
      fieldA,
      fieldB,
      pairwiseN: acc.n,
      pearsonR: r,
      absR: Math.abs(r),
      band,
      spearmanRho: null,
    });
  }

  const sortPairs = (xs: Pe4I18CorrelationPair[]) =>
    [...xs].sort((a, b) => {
      const ar = a.absR ?? -1;
      const br = b.absR ?? -1;
      if (br !== ar) return br - ar;
      const fa = a.fieldA.localeCompare(b.fieldA);
      if (fa !== 0) return fa;
      return a.fieldB.localeCompare(b.fieldB);
    });

  const extremePairs = sortPairs(all.filter((p) => p.band === "EXTREME"));
  const veryHighPairs = sortPairs(all.filter((p) => p.band === "VERY_HIGH"));
  const highPairs = sortPairs(all.filter((p) => p.band === "HIGH"));

  return {
    fieldCount: state.fields.length,
    pairCountEvaluated: all.length,
    minPairwiseN,
    bandCounts,
    extremePairs,
    veryHighPairs: veryHighPairs.slice(0, 100),
    highPairs: highPairs.slice(0, 100),
    topExtremePairs: extremePairs.slice(0, 25),
    spearmanComputed: false,
  };
}
