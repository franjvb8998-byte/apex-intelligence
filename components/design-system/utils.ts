/**
 * Design-system className helper (no external deps).
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function toPercent(value: number, digits = 0): string {
  return `${(clamp01(value) * 100).toFixed(digits)}%`;
}
