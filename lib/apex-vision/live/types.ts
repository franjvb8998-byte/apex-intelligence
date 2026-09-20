/**
 * Honest provider-backed live fixture state for APEX Vision.
 * No invented coordinates, xG, attacks, or PE recalculation.
 */

export const LIVE_TRANSPORT_SOURCE = "API_FOOTBALL" as const;

export type LiveTransportSource = typeof LIVE_TRANSPORT_SOURCE;

export type LiveEventClass =
  | "GOAL"
  | "CARD"
  | "SUBSTITUTION"
  | "VAR"
  | "OTHER";

export type LiveEventsSource =
  | "NESTED"
  | "UNAVAILABLE"
  | "DEDICATED_EVENTS_FALLBACK";

export type LiveFixtureEvent = {
  eventId: number | null;
  elapsed: number | null;
  extra: number | null;
  teamId: number | null;
  teamName: string | null;
  playerId: number | null;
  playerName: string | null;
  assistId: number | null;
  assistName: string | null;
  type: string;
  detail: string;
  comments: string | null;
  eventClass: LiveEventClass;
};

export type LiveFixtureState = {
  fixtureId: number;
  leagueId: number | null;
  leagueName: string | null;
  season: number | null;
  homeTeamId: number | null;
  homeTeamName: string | null;
  awayTeamId: number | null;
  awayTeamName: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  statusShort: string | null;
  elapsed: number | null;
  kickoffUtc: string | null;
  fetchedAtUtc: string;
  source: LiveTransportSource;
  nestedEventsAvailable: boolean;
  eventsSource: LiveEventsSource;
  events: LiveFixtureEvent[];
};

export type LiveTransportSnapshot = {
  source: LiveTransportSource;
  fetchedAtUtc: string;
  fixtures: LiveFixtureState[];
};
