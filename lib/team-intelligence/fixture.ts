import { emptyTeamIntelligenceInput } from "@/lib/team-intelligence/builders";
import type {
  RecentMatchFact,
  TeamIntelligenceInput,
} from "@/lib/team-intelligence/types";

function match(
  over: Partial<RecentMatchFact> & { kickoffAt: string; result: "W" | "D" | "L" },
): RecentMatchFact {
  return {
    home: true,
    goalsFor: over.result === "W" ? 2 : over.result === "D" ? 1 : 0,
    goalsAgainst: over.result === "W" ? 0 : over.result === "D" ? 1 : 2,
    expectedGoalsFor: null,
    expectedGoalsAgainst: null,
    possession: 54,
    shots: 12,
    corners: 5,
    cards: 2,
    opponentName: "Opponent",
    ...over,
  };
}

export function teamIntelligenceFixture(
  over: Partial<TeamIntelligenceInput> = {},
): TeamIntelligenceInput {
  return emptyTeamIntelligenceInput({
    asOf: "2026-08-28T12:00:00.000Z",
    identity: {
      teamId: "apex:team:arsenal",
      name: "Arsenal",
      shortName: "ARS",
      country: "England",
      leagueName: "Premier League",
      season: "2025",
      managerName: "Mikel Arteta",
      formation: "4-3-3",
      venueCapacity: 60_704,
      venueSurface: "grass",
      logoUrl: null,
      budgetTier: null,
      marketValue: null,
      averageSquadAge: 25.4,
      ...over.identity,
    },
    table: {
      rank: 1,
      points: 22,
      played: 8,
      teamsInTable: 20,
      description: "Promotion - Champions League (Group Stage)",
      ...over.table,
    },
    season: {
      played: 8,
      wins: 7,
      draws: 1,
      losses: 0,
      goalsFor: 18,
      goalsAgainst: 4,
      goalsForAverage: 2.25,
      goalsAgainstAverage: 0.5,
      cleanSheets: 5,
      failedToScore: 0,
      home: {
        played: 4,
        wins: 4,
        draws: 0,
        losses: 0,
        goalsFor: 11,
        goalsAgainst: 1,
      },
      away: {
        played: 4,
        wins: 3,
        draws: 1,
        losses: 0,
        goalsFor: 7,
        goalsAgainst: 3,
      },
      form: "WWDWWW",
      ...over.season,
    },
    recent: over.recent ?? [
      match({ kickoffAt: "2026-08-24T15:00:00.000Z", result: "W", home: true }),
      match({ kickoffAt: "2026-08-20T19:00:00.000Z", result: "W", home: false }),
      match({ kickoffAt: "2026-08-16T15:00:00.000Z", result: "D", home: true }),
      match({ kickoffAt: "2026-08-12T15:00:00.000Z", result: "W", home: false }),
      match({ kickoffAt: "2026-08-08T15:00:00.000Z", result: "W", home: true }),
      match({
        kickoffAt: "2026-08-01T15:00:00.000Z",
        result: "L",
        home: false,
        possession: 48,
      }),
      match({ kickoffAt: "2026-07-25T15:00:00.000Z", result: "W", home: true }),
    ],
    absences: over.absences ?? {
      injuries: {
        published: true,
        items: [{ playerName: "Timber", detail: "Knock" }],
      },
      suspensions: { published: true, items: [] },
    },
    squad: over.squad ?? { listed: 24, starters: 11, bench: 7 },
    schedule: over.schedule ?? {
      nextKickoffAt: "2026-08-31T15:00:00.000Z",
      nextIsDerby: null,
      rivalry: null,
      travelKm: null,
    },
    environment: over.environment ?? {
      weather: "Clear",
      altitudeMeters: null,
      refereeName: "A. Taylor",
    },
    transfers: over.transfers ?? {
      published: false,
      incoming: null,
      outgoing: null,
      estimatedImpact: null,
      managerChanged: null,
      youthPromotions: null,
    },
    styleAxes: over.styleAxes ?? {
      possession: 0.58,
      pressing: 0.72,
      directness: 0.48,
      width: 0.66,
      tempo: 0.7,
    },
    expectedGoalsSeason: over.expectedGoalsSeason ?? { for: 2.1, against: 0.7 },
  });
}
