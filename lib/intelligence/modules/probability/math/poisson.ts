/**
 * Poisson distribution helpers.
 *
 * PMF: P(K = k | λ) = e^{-λ} * λ^k / k!
 *
 * Used to model independent home/away goal counts in a match.
 */

const factorialCache: number[] = [1];

/** n! for non-negative integers (cached). */
export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`factorial expects non-negative integer, got ${n}`);
  }
  while (factorialCache.length <= n) {
    const i = factorialCache.length;
    factorialCache[i] = factorialCache[i - 1]! * i;
  }
  return factorialCache[n]!;
}

/**
 * Poisson probability mass function.
 * P(K = k | λ) = e^{-λ} * λ^k / k!
 */
export function poissonPmf(k: number, lambda: number): number {
  if (!Number.isInteger(k) || k < 0) {
    throw new Error(`poissonPmf expects non-negative integer k, got ${k}`);
  }
  if (!Number.isFinite(lambda) || lambda < 0) {
    throw new Error(`poissonPmf expects λ ≥ 0, got ${lambda}`);
  }
  if (lambda === 0) {
    return k === 0 ? 1 : 0;
  }
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

/**
 * Independent bivariate Poisson scoreline probability:
 * P(H = i, A = j) = Pois(i; λ_h) * Pois(j; λ_a)
 */
export function scorelineProbability(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
): number {
  return (
    poissonPmf(homeGoals, lambdaHome) * poissonPmf(awayGoals, lambdaAway)
  );
}
