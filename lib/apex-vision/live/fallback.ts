/**
 * Dedicated /fixtures/events safety fallback policy.
 * Nested events are primary. Empty 0-0 histories do not trigger fallback.
 */

import { scoringGoalCount, scoreTotal } from "@/lib/apex-vision/live/normalize";
import type { LiveFixtureEvent, LiveFixtureState } from "@/lib/apex-vision/live/types";

export type LiveFallbackReason =
  | "NESTED_EVENTS_UNAVAILABLE"
  | "SCORE_CHANGED_WITHOUT_GOAL_EVENT"
  | "EVENTS_DISAPPEARED";

export type LiveFallbackDecision = {
  trigger: boolean;
  reason: LiveFallbackReason | null;
};

function eventIdentity(event: LiveFixtureEvent): string {
  return [
    event.elapsed ?? "",
    event.extra ?? "",
    event.type,
    event.detail,
    event.teamId ?? "",
    event.playerId ?? "",
  ].join("|");
}

export function evaluateDedicatedEventsFallback(input: {
  current: LiveFixtureState;
  previous: LiveFixtureState | null;
}): LiveFallbackDecision {
  const { current, previous } = input;

  if (!current.nestedEventsAvailable) {
    return { trigger: true, reason: "NESTED_EVENTS_UNAVAILABLE" };
  }

  if (previous && previous.events.length > 0) {
    const currentIds = new Set(current.events.map(eventIdentity));
    const disappeared = previous.events.some(
      (event) => !currentIds.has(eventIdentity(event)),
    );
    if (disappeared) {
      return { trigger: true, reason: "EVENTS_DISAPPEARED" };
    }
  }

  const total = scoreTotal(current.homeGoals, current.awayGoals);
  const goals = scoringGoalCount(current.events);
  const previousTotal = previous
    ? scoreTotal(previous.homeGoals, previous.awayGoals)
    : null;
  const scoreIncreased =
    total != null && previousTotal != null && total > previousTotal;
  const scoreHasGoalsWithoutEvents = total != null && total > goals;

  if (scoreIncreased && scoreHasGoalsWithoutEvents) {
    return { trigger: true, reason: "SCORE_CHANGED_WITHOUT_GOAL_EVENT" };
  }
  if (previous == null && scoreHasGoalsWithoutEvents) {
    return { trigger: true, reason: "SCORE_CHANGED_WITHOUT_GOAL_EVENT" };
  }

  return { trigger: false, reason: null };
}

export type DedicatedEventsFallbackGuard = {
  shouldAllow(fixtureId: number, nowMs: number): boolean;
  mark(fixtureId: number, nowMs: number): void;
};

/**
 * Bounds dedicated-event calls: per-fixture cooldown, no every-heartbeat polling.
 */
export function createDedicatedEventsFallbackGuard(options: {
  cooldownMs: number;
} = { cooldownMs: 60_000 }): DedicatedEventsFallbackGuard {
  const lastByFixture = new Map<number, number>();
  return {
    shouldAllow(fixtureId, nowMs) {
      const last = lastByFixture.get(fixtureId);
      if (last == null) return true;
      return nowMs - last >= options.cooldownMs;
    },
    mark(fixtureId, nowMs) {
      lastByFixture.set(fixtureId, nowMs);
    },
  };
}
