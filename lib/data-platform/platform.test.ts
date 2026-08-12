import { describe, expect, it } from "vitest";
import {
  createApiFootballProvider,
  createDataPlatform,
  createFootballDataProvider,
  createMockProvider,
  createSportMonksProvider,
  DEMO_MATCH_EXTERNAL_ID,
  createDemoFixturePayload,
} from "@/lib/data-platform";

describe("Data Platform infrastructure", () => {
  it("ingests mock provider into Apex model with trust score", async () => {
    const platform = createDataPlatform({
      providers: [createMockProvider()],
    });

    const { bundle } = await platform.ingestMatch({
      providerId: "mock",
      externalMatchId: DEMO_MATCH_EXTERNAL_ID,
    });

    expect(bundle.match.externalRefs[0]?.provider).toBe("mock");
    expect(bundle.homeTeam.name).toBeTruthy();
    expect(bundle.odds.length).toBeGreaterThan(0);
    expect(bundle.trustScore?.value).toBeGreaterThan(0.5);
    expect(bundle.trustScore?.band).toMatch(/low|medium|high/);
  });

  it("normalizes all vendor adapters without HTTP", async () => {
    const platform = createDataPlatform({
      providers: [
        createMockProvider(),
        createApiFootballProvider(),
        createSportMonksProvider(),
        createFootballDataProvider(),
      ],
    });

    for (const providerId of [
      "mock",
      "api-football",
      "sportmonks",
      "football-data",
    ] as const) {
      const { bundle } = await platform.ingestMatch({
        providerId,
        externalMatchId: DEMO_MATCH_EXTERNAL_ID,
      });
      expect(bundle.provenance.primaryProvider).toBe(providerId);
      expect(bundle.match.id.startsWith("apex:")).toBe(true);
    }
  });

  it("scores football-data mock lower when odds are missing", async () => {
    const platform = createDataPlatform({
      providers: [createMockProvider(), createFootballDataProvider()],
    });

    const rich = await platform.ingestMatch({
      providerId: "mock",
      externalMatchId: DEMO_MATCH_EXTERNAL_ID,
    });
    const thin = await platform.ingestMatch({
      providerId: "football-data",
      externalMatchId: DEMO_MATCH_EXTERNAL_ID,
    });

    expect(thin.bundle.odds).toHaveLength(0);
    expect(thin.bundle.trustScore!.value).toBeLessThan(
      rich.bundle.trustScore!.value,
    );
  });

  it("appends match events chronologically in the EventStore", async () => {
    const fixture = createDemoFixturePayload("mock");
    fixture.events = [
      {
        id: "e2",
        minute: 12,
        occurredAt: "2026-08-15T18:12:00.000Z",
        type: "goal",
        teamId: fixture.match.home.id,
        playerId: fixture.players[0]!.id,
      },
      {
        id: "e1",
        minute: 1,
        occurredAt: "2026-08-15T18:01:00.000Z",
        type: "kickoff",
        teamId: null,
        playerId: null,
      },
    ];

    const platform = createDataPlatform({
      providers: [createMockProvider({ fixture })],
    });

    const { bundle, eventsAppended } = await platform.ingestMatch({
      providerId: "mock",
      externalMatchId: DEMO_MATCH_EXTERNAL_ID,
    });

    expect(eventsAppended).toBe(2);
    const timeline = await platform.eventStore.list({
      matchId: bundle.match.id,
    });
    expect(timeline).toHaveLength(2);
    expect(timeline[0]!.type).toBe("kickoff");
    expect(timeline[1]!.type).toBe("goal");
  });
});
