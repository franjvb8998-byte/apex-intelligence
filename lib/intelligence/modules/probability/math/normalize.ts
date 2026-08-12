import type { MatchOutcome, OutcomeProbability } from "@/lib/intelligence/types";

const OUTCOMES: MatchOutcome[] = ["home", "draw", "away"];

export function assertValidProbabilityComponent(
  value: number,
  label: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite number ≥ 0 (got ${value})`);
  }
}

/**
 * Normalize a 1X2 triple so home + draw + away = 1.
 * Zero-vector falls back to a uniform distribution.
 */
export function normalizeOutcomeProbability(
  probabilities: OutcomeProbability,
): OutcomeProbability {
  assertValidProbabilityComponent(probabilities.home, "home");
  assertValidProbabilityComponent(probabilities.draw, "draw");
  assertValidProbabilityComponent(probabilities.away, "away");

  const sum =
    probabilities.home + probabilities.draw + probabilities.away;

  if (sum === 0) {
    return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  }

  return {
    home: probabilities.home / sum,
    draw: probabilities.draw / sum,
    away: probabilities.away / sum,
  };
}

/** Softmax: p_i = e^{s_i} / Σ_j e^{s_j} (stable max-subtraction). */
export function softmaxFromScores(
  scores: Record<MatchOutcome, number>,
): OutcomeProbability {
  for (const outcome of OUTCOMES) {
    if (!Number.isFinite(scores[outcome])) {
      throw new Error(`Score for ${outcome} must be finite`);
    }
  }

  const maxScore = Math.max(scores.home, scores.draw, scores.away);
  const exps = {
    home: Math.exp(scores.home - maxScore),
    draw: Math.exp(scores.draw - maxScore),
    away: Math.exp(scores.away - maxScore),
  };

  return normalizeOutcomeProbability(exps);
}

/**
 * Argmax over 1X2. Tie-break order: home > draw > away
 * (deterministic; documented for tests).
 */
export function mostLikelyOutcome(
  probabilities: OutcomeProbability,
): MatchOutcome {
  const normalized = normalizeOutcomeProbability(probabilities);
  let best: MatchOutcome = "home";
  let bestValue = normalized.home;

  if (normalized.draw > bestValue) {
    best = "draw";
    bestValue = normalized.draw;
  }
  if (normalized.away > bestValue) {
    best = "away";
  }

  return best;
}

/**
 * Normalized Shannon entropy in [0, 1]:
 * H_norm = -Σ p_i log2(p_i) / log2(3)
 */
export function normalizedEntropy(
  probabilities: OutcomeProbability,
): number {
  const p = normalizeOutcomeProbability(probabilities);
  const values = [p.home, p.draw, p.away];
  let entropy = 0;

  for (const value of values) {
    if (value > 0) {
      entropy -= value * Math.log2(value);
    }
  }

  return entropy / Math.log2(3);
}

export function normalizeBinary(over: number, under: number): {
  over: number;
  under: number;
} {
  assertValidProbabilityComponent(over, "over");
  assertValidProbabilityComponent(under, "under");
  const sum = over + under;
  if (sum === 0) {
    return { over: 0.5, under: 0.5 };
  }
  return { over: over / sum, under: under / sum };
}
