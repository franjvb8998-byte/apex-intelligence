/**
 * PE-4H.1 — Deterministic shuffle diagnostic (destroys temporal association).
 */

import {
  PE4_FORM_SIGNAL_SHUFFLE_ITERATIONS,
  PE4_FORM_SIGNAL_SHUFFLE_SEED,
} from "@/lib/debug/calibration/pe4-form/protocol";
import { pearson } from "@/lib/debug/calibration/pe4-form/diagnostics";
import type { SignalPair } from "@/lib/debug/calibration/pe4-form/diagnostics";

/** Deterministic LCG. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Within each team, shuffle the `next` residuals among pairs for that team.
 * Preserves marginal next-residual distribution per team; destroys temporal link.
 * Fixture grouping of historical values is left intact.
 */
export function teamShufflePearson(
  pairs: readonly SignalPair[],
  seed: number = PE4_FORM_SIGNAL_SHUFFLE_SEED,
  iterations: number = PE4_FORM_SIGNAL_SHUFFLE_ITERATIONS,
): {
  observedPearson: number | null;
  shuffleMeanPearson: number | null;
  shuffleP95Abs: number | null;
  fractionAbsExceedsObserved: number | null;
} {
  const observedPearson = pearson(
    pairs.map((p) => p.historical),
    pairs.map((p) => p.next),
  );
  if (observedPearson == null || pairs.length < 5) {
    return {
      observedPearson,
      shuffleMeanPearson: null,
      shuffleP95Abs: null,
      fractionAbsExceedsObserved: null,
    };
  }

  const byTeam = new Map<string, SignalPair[]>();
  for (const p of pairs) {
    const list = byTeam.get(p.teamId) ?? [];
    list.push(p);
    byTeam.set(p.teamId, list);
  }

  const rand = lcg(seed);
  const shuffledRs: number[] = [];
  for (let it = 0; it < iterations; it += 1) {
    const hist: number[] = [];
    const next: number[] = [];
    for (const teamId of [...byTeam.keys()].sort()) {
      const teamPairs = byTeam.get(teamId)!;
      const nextVals = teamPairs.map((p) => p.next);
      shuffleInPlace(nextVals, rand);
      for (let i = 0; i < teamPairs.length; i += 1) {
        hist.push(teamPairs[i]!.historical);
        next.push(nextVals[i]!);
      }
    }
    const r = pearson(hist, next);
    if (r != null) shuffledRs.push(r);
  }

  const shuffleMeanPearson =
    shuffledRs.reduce((a, b) => a + b, 0) / shuffledRs.length;
  const absSorted = [...shuffledRs].map(Math.abs).sort((a, b) => a - b);
  const shuffleP95Abs = absSorted[Math.floor(0.95 * (absSorted.length - 1))]!;
  const obsAbs = Math.abs(observedPearson);
  const fractionAbsExceedsObserved =
    shuffledRs.filter((r) => Math.abs(r) >= obsAbs).length / shuffledRs.length;

  return {
    observedPearson,
    shuffleMeanPearson,
    shuffleP95Abs,
    fractionAbsExceedsObserved,
  };
}
