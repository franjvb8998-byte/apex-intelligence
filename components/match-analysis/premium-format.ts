export function formatOdds(value: number | null, empty: string): string {
  if (value == null || !Number.isFinite(value)) return empty;
  return value.toFixed(2);
}

export function formatEv(value: number | null, empty: string): string {
  if (value == null || !Number.isFinite(value)) return empty;
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function formatScore(value: number | null, empty: string): string {
  if (value == null || !Number.isFinite(value)) return empty;
  return String(Math.round(value));
}

export function formatProb(value: number | null, empty: string): string {
  if (value == null || !Number.isFinite(value)) return empty;
  return `${(value * 100).toFixed(1)}%`;
}
