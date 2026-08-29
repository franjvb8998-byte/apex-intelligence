export function formatPctPoints(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

export function formatEv(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
