/**
 * Null-aware helpers for frozen betting numbers.
 * Missing is not 0. Real 0 remains 0.
 */

export function presentNumber(
  value: number | null | undefined,
): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function presentNumbers(
  values: Array<number | null | undefined>,
): number[] {
  return values.filter(presentNumber);
}

/** Descending rank: missing sorts last. Does not coerce missing to 0. */
export function descPresent(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const left = presentNumber(b) ? b : Number.NEGATIVE_INFINITY;
  const right = presentNumber(a) ? a : Number.NEGATIVE_INFINITY;
  return left - right;
}

/** Ascending rank: missing sorts last. */
export function ascPresent(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const left = presentNumber(a) ? a : Number.POSITIVE_INFINITY;
  const right = presentNumber(b) ? b : Number.POSITIVE_INFINITY;
  return left - right;
}

export function formatFrozenInt(value: number | null | undefined): string {
  return presentNumber(value) ? String(Math.round(value)) : "—";
}
