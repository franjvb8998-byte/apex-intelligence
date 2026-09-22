import { describe, expect, it } from "vitest";
import {
  utcCalendarDate,
  utcCalendarDatePlusDays,
} from "@/lib/prematch-lifecycle/utc";

describe("prematch lifecycle UTC calendar", () => {
  it("P. UTC year boundary uses Date.UTC, not local time", () => {
    const nye = new Date("2025-12-31T23:50:00.000Z");
    expect(utcCalendarDate(nye)).toBe("2025-12-31");
    expect(utcCalendarDatePlusDays(nye, 1)).toBe("2026-01-01");
  });

  it("Q. UTC leap-day boundary is calendar-safe", () => {
    const eve = new Date("2024-02-28T23:00:00.000Z");
    expect(utcCalendarDate(eve)).toBe("2024-02-28");
    expect(utcCalendarDatePlusDays(eve, 1)).toBe("2024-02-29");
    const nonLeap = new Date("2023-02-28T23:00:00.000Z");
    expect(utcCalendarDatePlusDays(nonLeap, 1)).toBe("2023-03-01");
  });

  it("does not use local timezone for 23:50/00:30 discovery dates", () => {
    const now = new Date("2033-05-31T23:50:00.000Z");
    expect(utcCalendarDate(now)).toBe("2033-05-31");
    expect(utcCalendarDatePlusDays(now, 1)).toBe("2033-06-01");
  });
});
