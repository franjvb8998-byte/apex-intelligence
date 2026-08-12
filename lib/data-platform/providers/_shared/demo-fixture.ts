import type { DataProviderId } from "@/lib/data-platform/types/ids";
import type {
  ApexMatchStatus,
} from "@/lib/data-platform/types/match";
import type { ApexEventType } from "@/lib/data-platform/types/event";
import type { PlayerPosition } from "@/lib/data-platform/types/team";

/** Shared fixture shape used by mock envelopes before mapping to Apex*. */
export type MockFixturePayload = {
  match: {
    id: string;
    league: { id: string; name: string; country: string; season: string };
    home: { id: string; name: string; shortName: string };
    away: { id: string; name: string; shortName: string };
    kickoffAt: string;
    status: ApexMatchStatus;
    score: { home: number | null; away: number | null };
    minute: number | null;
    venue?: { name: string; city: string; country: string };
  };
  players: Array<{
    id: string;
    teamId: string;
    name: string;
    shirtNumber: number | null;
    position: PlayerPosition;
  }>;
  events: Array<{
    id: string;
    minute: number | null;
    occurredAt: string;
    type: ApexEventType;
    teamId: string | null;
    playerId: string | null;
    payload?: Record<string, unknown>;
  }>;
  odds: Array<{
    id: string;
    market: "1x2" | "over_under";
    line: number | null;
    bookmaker: string;
    selections: Array<{
      key: string;
      label: string;
      decimalOdds: number;
    }>;
    capturedAt: string;
  }>;
};

export const DEMO_MATCH_EXTERNAL_ID = "demo-1001";

export function createDemoFixturePayload(
  provider: DataProviderId,
): MockFixturePayload {
  const kickoffAt = "2026-08-15T18:00:00.000Z";
  return {
    match: {
      id: DEMO_MATCH_EXTERNAL_ID,
      league: {
        id: `${provider}-league-39`,
        name: "Premier League",
        country: "England",
        season: "2025/2026",
      },
      home: {
        id: `${provider}-team-home`,
        name: "Northbridge FC",
        shortName: "NOR",
      },
      away: {
        id: `${provider}-team-away`,
        name: "Southport United",
        shortName: "SOU",
      },
      kickoffAt,
      status: "scheduled",
      score: { home: null, away: null },
      minute: null,
      venue: {
        name: "Apex Arena",
        city: "London",
        country: "England",
      },
    },
    players: [
      {
        id: `${provider}-p1`,
        teamId: `${provider}-team-home`,
        name: "Alex Rivera",
        shirtNumber: 9,
        position: "forward",
      },
      {
        id: `${provider}-p2`,
        teamId: `${provider}-team-away`,
        name: "Jordan Blake",
        shirtNumber: 10,
        position: "midfielder",
      },
    ],
    events: [],
    odds: [
      {
        id: `${provider}-odds-1x2`,
        market: "1x2",
        line: null,
        bookmaker: "MockBook",
        selections: [
          { key: "home", label: "Home", decimalOdds: 2.1 },
          { key: "draw", label: "Draw", decimalOdds: 3.4 },
          { key: "away", label: "Away", decimalOdds: 3.5 },
        ],
        capturedAt: "2026-08-11T12:00:00.000Z",
      },
      {
        id: `${provider}-odds-ou25`,
        market: "over_under",
        line: 2.5,
        bookmaker: "MockBook",
        selections: [
          { key: "over", label: "Over 2.5", decimalOdds: 1.9 },
          { key: "under", label: "Under 2.5", decimalOdds: 1.95 },
        ],
        capturedAt: "2026-08-11T12:00:00.000Z",
      },
    ],
  };
}

/** Deterministic Apex ids from provider + external id (no DB yet). */
export function apexIdFor(
  provider: DataProviderId,
  entity: string,
  externalId: string,
): string {
  return `apex:${provider}:${entity}:${externalId}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
