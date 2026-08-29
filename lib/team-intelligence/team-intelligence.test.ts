import { describe, expect, it } from "vitest";
import {
  teamIntelligenceInputFromMatchCenter,
  emptyTeamIntelligenceInput,
} from "@/lib/team-intelligence/builders";
import { parseStandingDescription } from "@/lib/team-intelligence/calculators";
import {
  createTeamIntelligenceEngine,
  evaluateMatchClubTwins,
  evaluateTeamIntelligence,
} from "@/lib/team-intelligence/engine";
import { teamIntelligenceFixture } from "@/lib/team-intelligence/fixture";

describe("APEX Team Intelligence Engine", () => {
  it("is deterministic and never random", () => {
    const input = teamIntelligenceFixture();
    const engine = createTeamIntelligenceEngine();
    expect(engine.evaluate(input)).toEqual(evaluateTeamIntelligence(input));
    expect(engine.id).toBe("team-intelligence-v1");
  });

  it("scores a published club twin 0–100 with coverage and layered DNA", () => {
    const twin = evaluateTeamIntelligence(teamIntelligenceFixture());
    expect(twin.scores.overall).toBeGreaterThanOrEqual(0);
    expect(twin.scores.overall).toBeLessThanOrEqual(100);
    expect(twin.scores.coverage).toBeGreaterThan(0.5);
    expect(twin.identity.clubName).toBe("Arsenal");
    expect(twin.identity.clubSize).toBe("large");
    expect(twin.identity.playingStyle).toBe("high_press");
    expect(twin.identity.budgetTier).toBeNull();
    expect(twin.identity.marketValue).toBeNull();
    expect(twin.form.last5.length).toBeGreaterThan(0);
    expect(twin.tactical.attackingStrength.available).toBe(true);
    expect(twin.tactical.setPieceRating.available).toBe(false);
    expect(twin.tactical.crossingFrequency.available).toBe(false);
    expect(twin.home.winRate.value).toBe(1);
    expect(twin.away.winRate.available).toBe(true);
    expect(twin.health.injuries.value).toBe(1);
    expect(twin.schedule.travelDistance.available).toBe(false);
    expect(twin.environment.refereeCompatibility.available).toBe(false);
    expect(twin.transfers.incomingTransfers.available).toBe(false);
    expect(twin.scores.pillars).toHaveLength(9);
    expect(twin.reasons.length).toBeGreaterThan(0);
  });

  it("does not invent transfers, derbies, travel, or set pieces", () => {
    const twin = evaluateTeamIntelligence(teamIntelligenceFixture());
    expect(twin.transfers.estimatedImpact.value).toBeNull();
    expect(twin.motivation.derby.value).toBeNull();
    expect(twin.motivation.rivalry.value).toBeNull();
    expect(twin.schedule.travelDistance.value).toBeNull();
    expect(twin.tactical.highLine.value).toBeNull();
    expect(twin.tactical.compactness.value).toBeNull();
    expect(twin.environment.weatherSensitivity.value).toBeNull();
    expect(twin.environment.altitudeExperience.value).toBeNull();
  });

  it("parses Europe from a vendor standing description without calling it a title race", () => {
    expect(
      parseStandingDescription("Promotion - Champions League (Group Stage)"),
    ).toEqual({
      titleRace: null,
      europe: true,
      relegation: null,
    });
    expect(parseStandingDescription("Relegation")).toEqual({
      titleRace: false,
      europe: null,
      relegation: true,
    });
    const twin = evaluateTeamIntelligence(teamIntelligenceFixture());
    expect(twin.motivation.europeanQualification.value).toBe(true);
    expect(twin.motivation.titleRace.value).toBeNull();
  });

  it("leaves scoring layers n/d when the catalogue is silent", () => {
    const twin = evaluateTeamIntelligence(
      emptyTeamIntelligenceInput({
        asOf: "2026-08-28T12:00:00.000Z",
        identity: {
          teamId: "apex:team:unknown",
          name: "Unknown FC",
          shortName: null,
          country: null,
          leagueName: null,
          season: null,
          managerName: null,
          formation: null,
          venueCapacity: null,
          venueSurface: null,
          logoUrl: null,
          budgetTier: null,
          marketValue: null,
          averageSquadAge: null,
        },
      }),
    );
    expect(twin.scores.coverage).toBe(0);
    expect(twin.scores.overall).toBe(0);
    expect(twin.form.last5).toEqual([]);
    expect(twin.tactical.attackingStrength.available).toBe(false);
    expect(twin.health.injuries.available).toBe(false);
    expect(twin.identity.playingStyle).toBeNull();
    expect(twin.identity.clubSize).toBeNull();
  });

  it("maps Match Center context without inventing xG or derbies", () => {
    const input = teamIntelligenceInputFromMatchCenter({
      asOf: "2026-08-28T12:00:00.000Z",
      team: {
        id: "t1",
        name: "Arsenal",
        shortName: "ARS",
        logoUrl: null,
      },
      country: "England",
      leagueName: "Premier League",
      season: "2025",
      form: {
        teamId: "t1",
        teamName: "Arsenal",
        form: "WWDLW",
        played: 5,
        wins: 3,
        draws: 1,
        losses: 1,
        goalsFor: 8,
        goalsAgainst: 4,
        recentMatches: [
          {
            id: "m1",
            kickoffAt: "2026-08-24T15:00:00.000Z",
            opponentName: "Chelsea",
            home: true,
            goalsFor: 2,
            goalsAgainst: 0,
            result: "W",
          },
        ],
      },
      standing: {
        teamId: "t1",
        teamName: "Arsenal",
        rank: 2,
        points: 20,
        played: 8,
        wins: 6,
        draws: 2,
        losses: 0,
        goalsFor: 16,
        goalsAgainst: 5,
        goalsDiff: 11,
        form: "WWDLW",
      },
      teamsInTable: 20,
      injuries: [],
      suspensions: [],
    });
    expect(input.schedule.nextIsDerby).toBeNull();
    expect(input.recent[0]?.expectedGoalsFor).toBeNull();
    expect(input.transfers.published).toBe(false);
    const twin = evaluateTeamIntelligence(input);
    expect(twin.identity.clubName).toBe("Arsenal");
    expect(twin.motivation.leaguePosition.value).toBe(2);
  });

  it("builds a pair of club twins for a match without mixing the sides", () => {
    const home = teamIntelligenceFixture();
    const away = teamIntelligenceFixture({
      identity: {
        ...teamIntelligenceFixture().identity,
        teamId: "apex:team:chelsea",
        name: "Chelsea",
      },
    });
    const pair = evaluateMatchClubTwins(home, away);
    expect(pair.home.teamId).toBe("apex:team:arsenal");
    expect(pair.away.identity.clubName).toBe("Chelsea");
  });
});
