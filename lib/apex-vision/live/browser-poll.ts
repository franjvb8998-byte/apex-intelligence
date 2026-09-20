import {
  LIVE_REFRESH_INTERVAL_MS,
  matchCenterLiveApiHref,
  type LiveFreshness,
  type MatchCenterLiveView,
} from "@/lib/apex-vision/live/view";

export type MatchCenterLivePollHost = {
  setInterval: (handler: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
  addEventListener: (
    type: "pagehide" | "visibilitychange",
    listener: () => void,
  ) => void;
  removeEventListener: (
    type: "pagehide" | "visibilitychange",
    listener: () => void,
  ) => void;
  visibilityState: () => DocumentVisibilityState;
};

export type MatchCenterLivePollSession = {
  stop: () => void;
  activeIntervalCount: () => number;
};

export type StartMatchCenterLivePollInput = {
  fixtureId: number;
  intervalMs: number;
  shouldStart: boolean;
  freshness: LiveFreshness | null | undefined;
  fetchLive: (href: string) => Promise<MatchCenterLiveView | null>;
  onView: (view: MatchCenterLiveView) => void;
  host?: MatchCenterLivePollHost;
};

function browserHost(): MatchCenterLivePollHost {
  return {
    setInterval: (handler, ms) => window.setInterval(handler, ms),
    clearInterval: (id) => window.clearInterval(id),
    addEventListener: (type, listener) => {
      if (type === "visibilitychange") {
        document.addEventListener(type, listener);
        return;
      }
      window.addEventListener(type, listener);
    },
    removeEventListener: (type, listener) => {
      if (type === "visibilitychange") {
        document.removeEventListener(type, listener);
        return;
      }
      window.removeEventListener(type, listener);
    },
    visibilityState: () => document.visibilityState,
  };
}

/**
 * One provider LivePhase polling loop. Never talks to API-Football.
 * Cadence is floored at 60s. Mock 5s ticks must not call this.
 */
export function startMatchCenterLivePoll(
  input: StartMatchCenterLivePollInput,
): MatchCenterLivePollSession {
  const host = input.host ?? browserHost();
  let stopped = false;
  let cancelled = false;
  let polling = false;
  let timer: number | null = null;
  let inFlight = false;

  const session: MatchCenterLivePollSession = {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelled = true;
      polling = false;
      if (timer != null) {
        host.clearInterval(timer);
        timer = null;
      }
      host.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pagehide", onPageHide);
    },
    activeIntervalCount() {
      return timer == null ? 0 : 1;
    },
  };

  if (!input.shouldStart) return session;

  polling = true;
  const cadence = Math.max(LIVE_REFRESH_INTERVAL_MS, input.intervalMs);
  const href = matchCenterLiveApiHref(input.fixtureId);

  async function pull() {
    if (inFlight || cancelled || !polling) return;
    inFlight = true;
    try {
      const view = await input.fetchLive(href);
      if (!view || cancelled) return;
      input.onView(view);
      if (!view.refresh.shouldPoll) {
        session.stop();
      }
    } catch {
      // Failed APEX pulls wait for the next interval. No rapid retry.
    } finally {
      inFlight = false;
    }
  }

  function onVisibility() {
    if (polling && host.visibilityState() === "visible") void pull();
  }

  function onPageHide() {
    session.stop();
  }

  timer = host.setInterval(() => {
    void pull();
  }, cadence);
  host.addEventListener("visibilitychange", onVisibility);
  host.addEventListener("pagehide", onPageHide);

  if (input.freshness !== "LIVE") {
    void pull();
  }

  return session;
}
