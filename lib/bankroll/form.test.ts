import { describe, expect, it } from "vitest";
import { betPreview, potentialProfit, potentialReturn } from "@/lib/bankroll/calculate";
import {
  emptyAddBetForm,
  formatDecimalField,
  isAddBetValid,
  parseDecimal,
  stakeForUnits,
} from "@/lib/bankroll/form";
import { filterFixturesByTeam, matchLabel } from "@/lib/bankroll/match-search";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";

describe("live bet math", () => {
  it("computes potential return and profit from stake × odds", () => {
    expect(potentialReturn(1.9, 25)).toBe(47.5);
    expect(potentialProfit(1.9, 25)).toBe(22.5);
    expect(betPreview(1.9, 25).potentialProfit).toBe(22.5);
    expect(potentialReturn(1, 25)).toBeNull();
  });
});

describe("add bet form", () => {
  it("parses decimals with comma or dot and formats on blur", () => {
    expect(parseDecimal("1,90")).toBeCloseTo(1.9);
    expect(parseDecimal("25.5")).toBeCloseTo(25.5);
    expect(formatDecimalField("1.9")).toBe("1.90");
    expect(formatDecimalField("25,5")).toBe("25.50");
  });

  it("sizes stakes from the configured 1u value", () => {
    expect(stakeForUnits(100, 1)).toBe(100);
    expect(stakeForUnits(100, 5)).toBe(500);
  });

  it("requires fixture, match, odds and stake before save", () => {
    const form = emptyAddBetForm(100);
    expect(isAddBetValid(form)).toBe(false);
    expect(
      isAddBetValid({
        ...form,
        fixtureId: "1035089",
        match: "Arsenal vs Chelsea",
      }),
    ).toBe(true);
    expect(
      isAddBetValid({
        ...form,
        fixtureId: "1",
        match: "A vs B",
        odds: "1",
      }),
    ).toBe(false);
    expect(
      isAddBetValid({
        ...form,
        fixtureId: "1",
        match: "A vs B",
        stake: "0",
      }),
    ).toBe(false);
  });
});

describe("filterFixturesByTeam", () => {
  const fixtures: DashboardMatchSummary[] = [
    {
      id: "1",
      externalId: "100",
      kickoffAt: "2026-08-27T18:00:00.000Z",
      status: "scheduled",
      leagueName: "Premier League",
      homeTeam: {
        id: "h",
        name: "Arsenal",
        shortName: "ARS",
        logoUrl: null,
      },
      awayTeam: {
        id: "a",
        name: "Chelsea",
        shortName: "CHE",
        logoUrl: null,
      },
      score: { home: null, away: null },
    },
    {
      id: "2",
      externalId: "101",
      kickoffAt: "2026-08-27T20:00:00.000Z",
      status: "scheduled",
      leagueName: "LaLiga",
      homeTeam: {
        id: "h2",
        name: "Barcelona",
        shortName: "BAR",
        logoUrl: null,
      },
      awayTeam: {
        id: "a2",
        name: "Girona",
        shortName: "GIR",
        logoUrl: null,
      },
      score: { home: null, away: null },
    },
  ];

  it("filters by home or away team name", () => {
    expect(filterFixturesByTeam(fixtures, "chel")).toHaveLength(1);
    expect(matchLabel(filterFixturesByTeam(fixtures, "chel")[0]!)).toBe(
      "Arsenal vs Chelsea",
    );
    expect(filterFixturesByTeam(fixtures, "bar")).toHaveLength(1);
    expect(filterFixturesByTeam(fixtures, "zzz")).toHaveLength(0);
    expect(filterFixturesByTeam(fixtures, "")).toHaveLength(2);
  });
});
