/**
 * Match Center view of provider live state.
 * Honest freshness, no invented XY / PE deltas.
 */

import {
  classifyLiveStatus,
  liveStatusCopyKey,
  shouldKeepLiveTracking,
  type LiveStatusCopyKey,
  type LiveStatusKind,
} from "@/lib/apex-vision/live/status";
import type {
  LiveEventClass,
  LiveFixtureEvent,
  LiveFixtureState,
} from "@/lib/apex-vision/live/types";

export type LiveFreshness = "LIVE" | "STALE" | "UNAVAILABLE";

export type LiveRefreshSource = "CACHE" | "PROVIDER" | "STORE" | "NONE";

/**
 * Coordinator-layer refresh classification. Not a wire sniffer.
 * Does not prove that an external HTTP request occurred or was skipped.
 *
 * VISION_STORE_CACHE — store was fresh; snapshot was not invoked.
 * LIVE_CACHE_REUSE — live HTTP cache key was already populated before snapshot.
 * PROVIDER_REFRESH — snapshot ran because the store was not fresh; origin vs
 *   live-cache fill is not observed at the socket.
 * NONE — no refresh path.
 */
export type LiveHttpOrigin =
  | "VISION_STORE_CACHE"
  | "LIVE_CACHE_REUSE"
  | "PROVIDER_REFRESH"
  | "NONE";

export function liveHttpOriginFromRefreshSource(
  source: LiveRefreshSource,
): LiveHttpOrigin {
  if (source === "CACHE" || source === "STORE") return "VISION_STORE_CACHE";
  if (source === "PROVIDER") return "PROVIDER_REFRESH";
  return "NONE";
}

/** Economy refresh target. */
export const LIVE_REFRESH_INTERVAL_MS = 60_000;
/** HT may refresh slower. */
export const HT_REFRESH_INTERVAL_MS = 90_000;
/**
 * Accepted freshness window after a 60s refresh.
 * LIVE if fetchedAt is within this age; otherwise STALE.
 */
export const LIVE_FRESHNESS_WINDOW_MS = 90_000;

export const MATCH_CENTER_LIVE_API_PATH = "/api/match-center/live";

export function matchCenterLiveApiHref(fixtureId: number): string {
  return `${MATCH_CENTER_LIVE_API_PATH}/${fixtureId}`;
}

/**
 * Browser polls APEX only when the fixture is still trackable.
 * Catalogue-live covers HT (mapped to live). Known terminal/PST/CANC/ABD/SUSP
 * must not start a refresh loop.
 */
export function shouldStartMatchCenterLivePoll(input: {
  isMock: boolean;
  fixtureId: number | null;
  catalogueLive: boolean;
  providerLive: MatchCenterLiveView | null;
}): boolean {
  if (input.isMock || input.fixtureId == null) return false;
  if (input.providerLive?.refresh.shouldPoll) return true;
  if (shouldKeepLiveTracking(input.providerLive?.statusShort)) return true;
  if (
    input.providerLive &&
    input.providerLive.freshness !== "UNAVAILABLE" &&
    !input.providerLive.refresh.shouldPoll
  ) {
    return false;
  }
  return input.catalogueLive;
}

export function matchCenterLivePollIntervalMs(
  providerLive: MatchCenterLiveView | null,
): number {
  const requested =
    providerLive?.refresh.intervalMs ?? LIVE_REFRESH_INTERVAL_MS;
  return Math.max(LIVE_REFRESH_INTERVAL_MS, requested);
}

export type MatchCenterLiveViewEvent = {
  id: string;
  minute: number | null;
  extra: number | null;
  eventClass: LiveEventClass;
  type: string;
  detail: string;
  comments: string | null;
  teamId: number | null;
  teamName: string | null;
  side: "home" | "away" | "unknown";
  playerId: number | null;
  playerName: string | null;
  assistId: number | null;
  assistName: string | null;
};

export type MatchCenterLiveView = {
  fixtureId: number;
  freshness: LiveFreshness;
  fetchedAtUtc: string | null;
  statusShort: string | null;
  statusKind: LiveStatusKind;
  statusCopyKey: LiveStatusCopyKey;
  elapsed: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeamId: number | null;
  homeTeamName: string | null;
  awayTeamId: number | null;
  awayTeamName: string | null;
  events: MatchCenterLiveViewEvent[];
  tracking: {
    schematic: true;
    exactBallTracking: false;
    exactPlayerTracking: false;
  };
  marketsOrigin: "PREMATCH";
  heuristicOrigin: "APEX_HEURISTIC";
  refresh: {
    shouldPoll: boolean;
    intervalMs: number;
    lastProviderRefreshAt: string | null;
    lastSuccessfulRefreshAt: string | null;
    refreshSource: LiveRefreshSource;
    refreshPerformed: boolean;
    cacheHit: boolean;
    httpOrigin: LiveHttpOrigin;
  };
};

export function classifyLiveFreshness(input: {
  fetchedAtUtc: string | null | undefined;
  nowMs: number;
  windowMs?: number;
}): LiveFreshness {
  if (!input.fetchedAtUtc) return "UNAVAILABLE";
  const fetched = Date.parse(input.fetchedAtUtc);
  if (!Number.isFinite(fetched)) return "UNAVAILABLE";
  const age = input.nowMs - fetched;
  if (age <= (input.windowMs ?? LIVE_FRESHNESS_WINDOW_MS)) return "LIVE";
  return "STALE";
}

function eventSide(
  event: LiveFixtureEvent,
  homeTeamId: number | null,
  awayTeamId: number | null,
): MatchCenterLiveViewEvent["side"] {
  if (event.teamId != null && homeTeamId != null && event.teamId === homeTeamId) {
    return "home";
  }
  if (event.teamId != null && awayTeamId != null && event.teamId === awayTeamId) {
    return "away";
  }
  return "unknown";
}

export function toMatchCenterLiveViewEvent(
  event: LiveFixtureEvent,
  fixtureId: number,
  index: number,
  homeTeamId: number | null,
  awayTeamId: number | null,
): MatchCenterLiveViewEvent {
  const id =
    event.eventId != null
      ? String(event.eventId)
      : `${fixtureId}-${event.elapsed ?? "x"}-${event.type}-${index}`;
  return {
    id,
    minute: event.elapsed,
    extra: event.extra,
    eventClass: event.eventClass,
    type: event.type,
    detail: event.detail,
    comments: event.comments,
    teamId: event.teamId,
    teamName: event.teamName,
    side: eventSide(event, homeTeamId, awayTeamId),
    playerId: event.playerId,
    playerName: event.playerName,
    assistId: event.assistId,
    assistName: event.assistName,
  };
}

export function unavailableLiveView(
  fixtureId: number,
  nowUtc: string,
): MatchCenterLiveView {
  return {
    fixtureId,
    freshness: "UNAVAILABLE",
    fetchedAtUtc: null,
    statusShort: null,
    statusKind: "other",
    statusCopyKey: "statusOther",
    elapsed: null,
    homeGoals: null,
    awayGoals: null,
    homeTeamId: null,
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: null,
    events: [],
    tracking: {
      schematic: true,
      exactBallTracking: false,
      exactPlayerTracking: false,
    },
    marketsOrigin: "PREMATCH",
    heuristicOrigin: "APEX_HEURISTIC",
    refresh: {
      shouldPoll: false,
      intervalMs: LIVE_REFRESH_INTERVAL_MS,
      lastProviderRefreshAt: nowUtc,
      lastSuccessfulRefreshAt: null,
      refreshSource: "NONE",
      refreshPerformed: false,
      cacheHit: false,
      httpOrigin: "NONE",
    },
  };
}

export function toMatchCenterLiveView(input: {
  state: LiveFixtureState;
  nowMs: number;
  refreshSource: LiveRefreshSource;
  refreshPerformed: boolean;
  cacheHit: boolean;
  lastProviderRefreshAt: string | null;
  httpOrigin?: LiveHttpOrigin;
}): MatchCenterLiveView {
  const { state } = input;
  const kind = classifyLiveStatus(state.statusShort);
  const freshness = classifyLiveFreshness({
    fetchedAtUtc: state.fetchedAtUtc,
    nowMs: input.nowMs,
  });
  const shouldPoll = shouldKeepLiveTracking(state.statusShort);
  return {
    fixtureId: state.fixtureId,
    freshness,
    fetchedAtUtc: state.fetchedAtUtc,
    statusShort: state.statusShort,
    statusKind: kind,
    statusCopyKey: liveStatusCopyKey(state.statusShort),
    elapsed: state.elapsed,
    homeGoals: state.homeGoals,
    awayGoals: state.awayGoals,
    homeTeamId: state.homeTeamId,
    homeTeamName: state.homeTeamName,
    awayTeamId: state.awayTeamId,
    awayTeamName: state.awayTeamName,
    events: state.events.map((event, index) =>
      toMatchCenterLiveViewEvent(
        event,
        state.fixtureId,
        index,
        state.homeTeamId,
        state.awayTeamId,
      ),
    ),
    tracking: {
      schematic: true,
      exactBallTracking: false,
      exactPlayerTracking: false,
    },
    marketsOrigin: "PREMATCH",
    heuristicOrigin: "APEX_HEURISTIC",
    refresh: {
      shouldPoll,
      intervalMs:
        kind === "halftime" ? HT_REFRESH_INTERVAL_MS : LIVE_REFRESH_INTERVAL_MS,
      lastProviderRefreshAt: input.lastProviderRefreshAt,
      lastSuccessfulRefreshAt: state.fetchedAtUtc,
      refreshSource: input.refreshSource,
      refreshPerformed: input.refreshPerformed,
      cacheHit: input.cacheHit,
      httpOrigin:
        input.httpOrigin ?? liveHttpOriginFromRefreshSource(input.refreshSource),
    },
  };
}

export function heuristicFromScore(
  homeGoals: number | null,
  awayGoals: number | null,
): {
  momentum: number;
  pressure: number;
  pressureSide: "home" | "away";
} {
  const home = homeGoals ?? 0;
  const away = awayGoals ?? 0;
  return {
    momentum: Math.max(-100, Math.min(100, (home - away) * 22)),
    pressure: Math.max(20, Math.min(80, 50 + (home - away) * 12)),
    pressureSide: home >= away ? "home" : "away",
  };
}

export function cardToneFromDetail(
  detail: string,
): "yellow" | "red" | "card" {
  const d = detail.toLowerCase();
  if (d.includes("red")) return "red";
  if (d.includes("yellow")) return "yellow";
  return "card";
}
