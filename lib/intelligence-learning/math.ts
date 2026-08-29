export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round4(values.reduce((sum, n) => sum + n, 0) / values.length);
}

export function variance(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg == null) return null;
  const sumSq = values.reduce((sum, n) => sum + (n - avg) ** 2, 0);
  return round4(sumSq / values.length);
}

export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator === 0) return null;
  return round4(numerator / denominator);
}
