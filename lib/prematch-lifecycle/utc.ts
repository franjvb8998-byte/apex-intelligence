export function resolveLifecycleClock(
  clock?: Date | string | number,
): Date {
  if (clock === undefined) return new Date();
  if (clock instanceof Date) return clock;
  return new Date(clock);
}

export function utcCalendarDate(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

export function utcCalendarDatePlusDays(now: Date, days: number): string {
  const shifted = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
  return utcCalendarDate(shifted);
}

export function addUtcDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
