import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { MockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import {
  getEvents,
  getFixtures,
  getLineups,
  getStandings,
  getTeam,
  getTeamStatistics,
  withApiHandler,
} from "@/lib/bff";

describe("BFF catalog (mock provider)", () => {
  const provider = new MockDataProvider();

  it("lists fixtures via ProviderFactory-compatible mock", async () => {
    const result = await getFixtures({}, { provider });
    expect(result.provider).toBe("mock");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]!.homeTeam.name).toBe("Northbridge FC");
  });

  it("gets a fixture by id", async () => {
    const result = await getFixtures(
      { id: DEMO_MATCH_EXTERNAL_ID },
      { provider },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.externalId).toBe(DEMO_MATCH_EXTERNAL_ID);
  });

  it("resolves mock team by apex id", async () => {
    const fixtures = await getFixtures(
      { id: DEMO_MATCH_EXTERNAL_ID },
      { provider },
    );
    const homeId = fixtures.items[0]!.homeTeam.id;
    const result = await getTeam(homeId, { provider });
    expect(result.team.name).toBe("Northbridge FC");
  });

  it("returns mock standings", async () => {
    const result = await getStandings(
      { league: "39", season: "2025" },
      { provider },
    );
    expect(result.standings.table.length).toBe(2);
  });

  it("requires league and season for standings", async () => {
    await expect(
      getStandings({ league: null, season: "2025" }, { provider }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns events and lineups for a fixture", async () => {
    const events = await getEvents(DEMO_MATCH_EXTERNAL_ID, { provider });
    const lineups = await getLineups(DEMO_MATCH_EXTERNAL_ID, { provider });
    expect(events.provider).toBe("mock");
    expect(lineups.lineups.length).toBeGreaterThan(0);
  });

  it("returns mock team statistics", async () => {
    const result = await getTeamStatistics(
      { team: "any", league: "39", season: "2025" },
      { provider },
    );
    expect(result.statistics.played).toBe(1);
  });
});

describe("BFF withApiHandler", () => {
  it("returns uniform success envelope", async () => {
    const request = new Request("http://localhost/api/fixtures");
    const response = await withApiHandler(request, async () => ({
      data: { hello: "world" },
      provider: "mock",
    }));

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.hello).toBe("world");
    expect(body.meta.requestId).toBeTruthy();
    expect(body.meta.provider).toBe("mock");
  });

  it("maps BffError to HTTP status and logs error envelope", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const request = new Request("http://localhost/api/teams");
    const response = await withApiHandler(request, async () => {
      await getTeam("", { provider: new MockDataProvider() });
      return { data: null };
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad_request");
    errorSpy.mockRestore();
  });
});
