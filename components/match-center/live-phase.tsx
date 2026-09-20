"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AiSidePanel } from "@/components/apex-vision/ai-side-panel";
import { MomentumBar } from "@/components/apex-vision/momentum-bar";
import { PitchField } from "@/components/apex-vision/pitch-field";
import { PressureIndicator } from "@/components/apex-vision/pressure-indicator";
import { VisionTimeline } from "@/components/apex-vision/vision-timeline";
import {
  Badge,
  Card,
} from "@/components/design-system";
import { UnavailableDataCard } from "@/components/app-shell/states";
import { LineupsCard, hasPublishedLineup } from "@/components/match-center/lineups-card";
import { ProviderLiveTimeline } from "@/components/match-center/provider-live-timeline";
import { simulateVisionTick } from "@/lib/apex-vision";
import {
  heuristicFromScore,
  matchCenterLiveApiHref,
  matchCenterLivePollIntervalMs,
  shouldStartMatchCenterLivePoll,
  type MatchCenterLiveView,
} from "@/lib/apex-vision/live";
import type { MatchCenterLiveData } from "@/lib/match-center/types";
import type { VisionLiveState } from "@/lib/apex-vision/types";

const MOCK_TICK_MS = 5000;

type LivePhaseProps = {
  data: MatchCenterLiveData;
};

function freshnessTone(
  freshness: MatchCenterLiveView["freshness"],
): "danger" | "warning" | "neutral" {
  if (freshness === "LIVE") return "danger";
  if (freshness === "STALE") return "warning";
  return "neutral";
}

/**
 * Live phase — mock ticks only when source is mock.
 * Provider-backed matches poll APEX (~60s), never API-Football.
 */
export function LivePhase({ data }: LivePhaseProps) {
  const t = useTranslations("matchCenter");
  const vision = useTranslations("vision");
  const isMock = data.source === "mock";
  const [state, setState] = useState<VisionLiveState>(data.vision);
  const [visionBaseline, setVisionBaseline] = useState(data.vision);
  const [providerLive, setProviderLive] = useState<MatchCenterLiveView | null>(
    data.providerLive,
  );

  if (data.vision !== visionBaseline) {
    setVisionBaseline(data.vision);
    setState(data.vision);
    setProviderLive(data.providerLive);
  }

  const lineups = data.lineups ?? { home: null, away: null };
  const showLineups =
    hasPublishedLineup(lineups.home) || hasPublishedLineup(lineups.away);

  useEffect(() => {
    if (!isMock) return;
    const id = window.setInterval(() => {
      setState((prev) => simulateVisionTick(prev));
    }, MOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, [isMock]);

  useEffect(() => {
    if (isMock || data.fixtureId == null) return;
    const fixtureId = data.fixtureId;
    let cancelled = false;
    let polling = shouldStartMatchCenterLivePoll({
      isMock,
      fixtureId,
      catalogueLive: data.catalogueLive,
      providerLive: data.providerLive,
    });
    if (!polling) return;

    const intervalMs = matchCenterLivePollIntervalMs(data.providerLive);
    let inFlight = false;
    const timer = window.setInterval(() => {
      void pull();
    }, intervalMs);

    async function pull() {
      if (inFlight || cancelled || !polling) return;
      inFlight = true;
      try {
        const href = matchCenterLiveApiHref(fixtureId);
        const response = await fetch(href);
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { data?: MatchCenterLiveView };
        if (!body.data || cancelled) return;
        setProviderLive(body.data);
        if (!body.data.refresh.shouldPoll) {
          polling = false;
          window.clearInterval(timer);
        }
      } catch {
        // Failed APEX pulls wait for the next interval. No rapid retry.
      } finally {
        inFlight = false;
      }
    }

    if (!data.providerLive || data.providerLive.freshness !== "LIVE") {
      void pull();
    }

    const onVisibility = () => {
      if (polling && document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      polling = false;
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isMock, data.fixtureId, data.catalogueLive, data.providerLive]);

  const live = providerLive;
  const scoreHome = live?.homeGoals ?? state.score.home;
  const scoreAway = live?.awayGoals ?? state.score.away;
  const minute = live?.elapsed ?? state.minute;
  const statusShort = live?.statusShort;
  const heuristic = heuristicFromScore(
    typeof scoreHome === "number" ? scoreHome : state.score.home,
    typeof scoreAway === "number" ? scoreAway : state.score.away,
  );
  const lastEvent = live?.events[live.events.length - 1] ?? null;
  const highlight =
    lastEvent?.eventClass === "GOAL" ||
    lastEvent?.eventClass === "CARD" ||
    lastEvent?.eventClass === "SUBSTITUTION" ||
    lastEvent?.eventClass === "VAR"
      ? lastEvent.eventClass
      : null;

  return (
    <div className="space-y-6" role="tabpanel" aria-labelledby="match-center-tab-live">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {isMock ? (
            <Badge tone="info">{t("livePreview")}</Badge>
          ) : live ? (
            <Badge tone={freshnessTone(live.freshness)}>{live.freshness}</Badge>
          ) : (
            <Badge tone="neutral">UNAVAILABLE</Badge>
          )}
          <Badge tone="accent">APEX Vision</Badge>
          {data.source === "data-platform" && <Badge>API-Football</Badge>}
          {statusShort ? <Badge tone="info">{statusShort}</Badge> : null}
          {!isMock && live?.statusCopyKey ? (
            <Badge tone="neutral">{vision(live.statusCopyKey)}</Badge>
          ) : null}
        </div>
        <Card padding="sm" className="min-w-[10rem] text-center">
          <p className="font-mono text-2xl font-bold tabular-nums text-white">
            {scoreHome ?? 0} – {scoreAway ?? 0}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            {vision("minute", { minute: minute ?? 0 })}
          </p>
          {!isMock && live?.fetchedAtUtc ? (
            <p className="mt-1 text-[11px] text-[var(--apex-fg-subtle)]">
              {vision("lastUpdated")}: {live.fetchedAtUtc}
            </p>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <PitchField
            players={state.players}
            ball={state.ball}
            homeShort={state.homeTeam.shortName}
            awayShort={state.awayTeam.shortName}
            schematic={!isMock}
            showBall={isMock}
            highlightClass={!isMock ? highlight : null}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <MomentumBar
              value={!isMock ? heuristic.momentum : state.momentum}
              homeLabel={state.homeTeam.shortName}
              awayLabel={state.awayTeam.shortName}
              heuristic={!isMock}
            />
            <PressureIndicator
              value={!isMock ? heuristic.pressure : state.pressure}
              side={!isMock ? heuristic.pressureSide : state.pressureSide}
              homeLabel={state.homeTeam.shortName}
              awayLabel={state.awayTeam.shortName}
              heuristic={!isMock}
            />
          </div>

          <UnavailableDataCard
            title={t("heatmapUnavailable")}
            description={t("heatmapUnavailableDescription")}
          />

          {showLineups && (
            <LineupsCard home={lineups.home} away={lineups.away} />
          )}

          {isMock ? (
            <VisionTimeline
              events={state.events}
              homeShort={state.homeTeam.shortName}
              awayShort={state.awayTeam.shortName}
            />
          ) : (
            <ProviderLiveTimeline
              events={live?.events ?? []}
              homeShort={state.homeTeam.shortName}
              awayShort={state.awayTeam.shortName}
            />
          )}
        </div>

        <div className="xl:col-span-2">
          <AiSidePanel
            state={state}
            marketsOrigin={isMock ? "LIVE" : "PREMATCH"}
          />
        </div>
      </div>
    </div>
  );
}
