import { describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data-platform/mock-provider";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import { getDashboardData, loadDashboardWorkspace } from "@/lib/dashboard/load";
import {
  hasFootballApiKey,
  resolveDashboardProvider,
} from "@/lib/dashboard/resolve-provider";
import {
  addUtcDays,
  isUpcomingMatch,
  startOfUtcDay,
} from "@/lib/dashboard/map";

describe("Dashboard provider resolution", () => {
  it("selects mock when API key is missing", () => {
    const resolved = resolveDashboardProvider({ env: {} });
    expect(resolved.kind).toBe("mock");
    expect(resolved.hasApiKey).toBe(false);
    expect(resolved.dataMode).toBe("mock");
    expect(hasFootballApiKey({})).toBe(false);
  });

  it("selects api-football when API_FOOTBALL_KEY is set", () => {
    expect(hasFootballApiKey({ API_FOOTBALL_KEY: "test-key" })).toBe(true);
    expect(hasFootballApiKey({ API_KEY: "x" })).toBe(true);

    const resolved = resolveDashboardProvider({
      env: { API_FOOTBALL_KEY: "test-key" },
    });
    expect(resolved.kind).toBe("api-football");
    expect(resolved.hasApiKey).toBe(true);
    expect(resolved.dataMode).toBe("live");
  });

  it("accepts injected mock provider", () => {
    const provider = new MockDataProvider();
    const resolved = resolveDashboardProvider({ provider });
    expect(resolved.kind).toBe("mock");
    expect(resolved.provider.id).toBe("mock");
  });
});

describe("Dashboard data loader", () => {
  it("loads overview sections from mock provider", async () => {
    const provider = new MockDataProvider();
    const data = await getDashboardData({
      provider,
      today: "2026-08-15",
      now: new Date("2026-08-12T12:00:00.000Z"),
    });

    expect(data.system.provider).toBe("mock");
    expect(data.todayMatches.length).toBeGreaterThan(0);
    expect(data.upcomingMatches.length).toBeGreaterThan(0);
    expect(data.leagues.length).toBeGreaterThan(0);
    expect(data.featuredTeams.length).toBeGreaterThanOrEqual(2);
    expect(data.featuredMatchId).toBeTruthy();
    expect(data.leagues[0]!.name).toBe("Premier League");
    expect(
      data.featuredTeams.some((t) => t.name === "Northbridge FC"),
    ).toBe(true);
  });

  it("loads overview from api-football recorded fixtures without key", async () => {
    const provider = new ApiFootballDataProvider({
      apiKey: null,
      env: {},
      useCache: false,
    });
    const data = await getDashboardData({
      provider,
      today: "2024-04-23",
      now: new Date("2024-04-20T12:00:00.000Z"),
      upcomingDays: 5,
    });

    expect(data.system.provider).toBe("api-football");
    expect(data.leagues.some((l) => l.name === "Premier League")).toBe(true);
    expect(data.featuredTeams.some((t) => t.name === "Arsenal")).toBe(true);
    expect(data.featuredMatchId).toBeTruthy();
  });
});

describe("Dashboard map helpers", () => {
  it("computes UTC date helpers", () => {
    expect(startOfUtcDay(new Date("2026-08-12T23:00:00.000Z"))).toBe(
      "2026-08-12",
    );
    expect(addUtcDays("2026-08-12", 1)).toBe("2026-08-13");
  });

  it("classifies upcoming matches", () => {
    expect(
      isUpcomingMatch(
        {
          id: "1",
          externalId: "1",
          kickoffAt: "2026-08-20T18:00:00.000Z",
          status: "scheduled",
          leagueName: null,
          homeTeam: { id: "h", name: "H", shortName: "H" },
          awayTeam: { id: "a", name: "A", shortName: "A" },
          score: { home: null, away: null },
        },
        new Date("2026-08-12T12:00:00.000Z"),
      ),
    ).toBe(true);

    expect(
      isUpcomingMatch(
        {
          id: "2",
          externalId: "2",
          kickoffAt: "2024-01-01T18:00:00.000Z",
          status: "finished",
          leagueName: null,
          homeTeam: { id: "h", name: "H", shortName: "H" },
          awayTeam: { id: "a", name: "A", shortName: "A" },
          score: { home: 1, away: 0 },
        },
        new Date("2026-08-12T12:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

describe("Dashboard workspace", () => {
  it("does not throw when the football provider crashes on id access", async () => {
    const provider = {
      id: "mock" as const,
      displayName: "Broken",
      async getMatch() {
        throw new Error("Cannot read properties of undefined (reading 'id')");
      },
      async listFixtures() {
        throw new Error("Cannot read properties of undefined (reading 'id')");
      },
    };

    const { dashboard } = await loadDashboardWorkspace({
      provider,
      env: {},
      today: "2026-08-15",
      now: new Date("2026-08-12T12:00:00.000Z"),
    });

    expect(dashboard.todayMatches).toEqual([]);
    expect(dashboard.system.displayName).toBe("Broken");
  });
});
