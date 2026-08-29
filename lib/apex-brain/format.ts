export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function signedPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function sentences(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .map((part) => (part.endsWith(".") ? part : `${part}.`))
    .join(" ");
}
