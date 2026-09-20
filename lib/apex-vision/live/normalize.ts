/**
 * Normalize vendor fixture/event payloads into honest Vision live state.
 * Unknown event types stay OTHER. They are never mapped to mock timeline types.
 */

import type {
  ApiFootballEvent,
  ApiFootballFixtureItem,
} from "@/lib/data-platform/providers/api-football/types";
import { LIVE_TRANSPORT_SOURCE, type LiveEventClass, type LiveFixtureEvent, type LiveFixtureState } from "@/lib/apex-vision/live/types";

function integerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function classifyProviderEventClass(
  type: string | null | undefined,
): LiveEventClass {
  const normalized = (type ?? "").trim().toLowerCase();
  if (normalized === "goal") return "GOAL";
  if (normalized === "card") return "CARD";
  if (normalized === "subst") return "SUBSTITUTION";
  if (normalized === "var") return "VAR";
  return "OTHER";
}

export function normalizeLiveEvent(event: ApiFootballEvent): LiveFixtureEvent {
  const type = stringOrNull(event.type) ?? "";
  const detail = stringOrNull(event.detail) ?? "";
  return {
    eventId: integerOrNull(event.id),
    elapsed: integerOrNull(event.time?.elapsed),
    extra: integerOrNull(event.time?.extra),
    teamId: integerOrNull(event.team?.id),
    teamName: stringOrNull(event.team?.name),
    playerId: integerOrNull(event.player?.id),
    playerName: stringOrNull(event.player?.name),
    assistId: integerOrNull(event.assist?.id),
    assistName: stringOrNull(event.assist?.name),
    type,
    detail,
    comments: stringOrNull(event.comments),
    eventClass: classifyProviderEventClass(type),
  };
}

export function normalizeLiveFixture(
  item: ApiFootballFixtureItem,
  fetchedAtUtc: string,
): LiveFixtureState {
  const nestedEventsAvailable = Array.isArray(item.events);
  const events = nestedEventsAvailable
    ? item.events!.map((event) => normalizeLiveEvent(event))
    : [];
  return {
    fixtureId: integerOrNull(item.fixture?.id) ?? 0,
    leagueId: integerOrNull(item.league?.id),
    leagueName: stringOrNull(item.league?.name),
    season: integerOrNull(item.league?.season),
    homeTeamId: integerOrNull(item.teams?.home?.id),
    homeTeamName: stringOrNull(item.teams?.home?.name),
    awayTeamId: integerOrNull(item.teams?.away?.id),
    awayTeamName: stringOrNull(item.teams?.away?.name),
    homeGoals: integerOrNull(item.goals?.home),
    awayGoals: integerOrNull(item.goals?.away),
    statusShort: stringOrNull(item.fixture?.status?.short),
    elapsed: integerOrNull(item.fixture?.status?.elapsed),
    kickoffUtc: stringOrNull(item.fixture?.date),
    fetchedAtUtc,
    source: LIVE_TRANSPORT_SOURCE,
    nestedEventsAvailable,
    eventsSource: nestedEventsAvailable ? "NESTED" : "UNAVAILABLE",
    events,
  };
}

export function scoringGoalCount(events: LiveFixtureEvent[]): number {
  return events.filter((event) => event.eventClass === "GOAL").length;
}

export function scoreTotal(homeGoals: number | null, awayGoals: number | null): number | null {
  if (homeGoals == null || awayGoals == null) return null;
  return homeGoals + awayGoals;
}
