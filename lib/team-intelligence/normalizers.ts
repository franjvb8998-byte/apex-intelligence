/**
 * Pure helpers. No I/O. No Date.now() — callers pass asOf.
 */

import type { FormLetter, PublishedMetric, PublishedScore } from "@/lib/team-intelligence/types";

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function metric<T>(
  value: T | null,
  note: string,
): PublishedMetric<T> {
  return {
    value,
    available: value != null,
    note,
  };
}

export function score(
  value: number | null,
  note: string,
): PublishedScore {
  if (value == null || !Number.isFinite(value)) {
    return { value: null, available: false, note };
  }
  return { value: roundScore(value), available: true, note };
}

export function unavailable<T = number>(note: string): PublishedMetric<T> {
  return { value: null, available: false, note };
}

export function unavailableScore(note: string): PublishedScore {
  return { value: null, available: false, note };
}

export function formLettersFrom(
  form: string | null | undefined,
  recent: Array<{ result: FormLetter | null }>,
): FormLetter[] {
  const fromRecent = recent
    .map((row) => row.result)
    .filter((result): result is FormLetter => result === "W" || result === "D" || result === "L");
  if (fromRecent.length > 0) return fromRecent;
  const raw = form?.toUpperCase().replace(/[^WDL]/g, "") ?? "";
  return [...raw].filter((ch): ch is FormLetter => ch === "W" || ch === "D" || ch === "L");
}

/** Recency-weighted 0–1 quality. Same shape as Intelligence Report formQuality. */
export function formQuality(letters: FormLetter[]): number | null {
  if (letters.length === 0) return null;
  let weighted = 0;
  let denom = 0;
  letters.forEach((letter, index) => {
    const w = 1 + index * 0.25;
    const pts = letter === "W" ? 1 : letter === "D" ? 0.45 : 0;
    weighted += pts * w;
    denom += w;
  });
  return denom > 0 ? weighted / denom : null;
}

export function mean(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

export function rate(hits: number, sample: number): number | null {
  if (sample <= 0) return null;
  return round2(hits / sample);
}

export function winRate(record: {
  played: number;
  wins: number;
} | null): number | null {
  if (!record || record.played <= 0) return null;
  return rate(record.wins, record.played);
}

export function daysBetween(laterIso: string, earlierIso: string): number | null {
  const later = Date.parse(laterIso);
  const earlier = Date.parse(earlierIso);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return (later - earlier) / 86_400_000;
}

export function ms(iso: string): number | null {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : null;
}

export type CoverageBlend = {
  score: number;
  coverage: number;
};

export function coverageBlend(
  parts: Array<{ score: number | null; weight: number }>,
): CoverageBlend {
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  const available = parts.filter(
    (part) => part.score != null && Number.isFinite(part.score) && part.weight > 0,
  );
  const used = available.reduce((sum, part) => sum + part.weight, 0);
  const blended =
    used > 0
      ? available.reduce((sum, part) => sum + (part.score ?? 0) * part.weight, 0) / used
      : 0;
  return {
    score: blended,
    coverage: total > 0 ? used / total : 0,
  };
}
