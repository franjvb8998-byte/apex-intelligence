/**
 * Pure helpers for the Decision Engine. No I/O.
 */

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

export function shannonEntropy(parts: number[]): number {
  return parts
    .filter((p) => p > 0)
    .reduce((sum, p) => sum + -p * Math.log2(p), 0);
}

export function threeWayEntropy(oneXTwo: {
  home: number;
  draw: number;
  away: number;
}): number {
  const max = Math.log2(3);
  if (max <= 0) return 1;
  return clamp(
    shannonEntropy([oneXTwo.home, oneXTwo.draw, oneXTwo.away]) / max,
    0,
    1,
  );
}

export function formVariance(letters: Array<"W" | "D" | "L">): number | null {
  if (letters.length < 3) return null;
  const pts: number[] = letters.map((ch) => (ch === "W" ? 1 : ch === "D" ? 0.45 : 0));
  const mean = pts.reduce((a, b) => a + b, 0) / pts.length;
  const varSum = pts.reduce((sum, p) => sum + (p - mean) ** 2, 0) / pts.length;
  return clamp(varSum, 0, 1);
}
